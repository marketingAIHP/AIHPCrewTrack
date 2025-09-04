import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import WebSocket from "ws";
import { storage } from "./storage";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  adminLoginSchema,
  employeeLoginSchema,
  insertAdminSchema,
  insertEmployeeSchema,
  insertWorkSiteSchema,
  insertAreaSchema,
  insertDepartmentSchema,
  insertLocationTrackingSchema,
  insertAttendanceSchema,
  updateEmployeeProfileSchema,
  adminVerificationSchema,
  adminActivationSchema,
} from "@shared/schema";
import { sendEmail } from './sendgrid';
import * as XLSX from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';
import PDFDocument from 'pdfkit';
import { ObjectStorageService, ObjectNotFoundError } from './objectStorage';
import { ImageCompressionService } from './imageCompression';

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// WebSocket connections for real-time notifications
const adminConnections = new Map<number, WebSocket[]>(); // adminId -> WebSocket[]

// Notification stack to maintain last 5 transactions per admin
const notificationStacks = new Map<number, any[]>(); // adminId -> notifications[]

// Helper to add notification to stack
function addToNotificationStack(adminId: number, notification: any) {
  const stack = notificationStacks.get(adminId) || [];
  stack.unshift(notification); // Add to beginning
  if (stack.length > 5) {
    stack.pop(); // Remove oldest if more than 5
  }
  notificationStacks.set(adminId, stack);
}

// Helper function to send notification to admin
function notifyAdmin(adminId: number, notification: any) {
  // Add to notification stack first
  addToNotificationStack(adminId, notification);
  
  const connections = adminConnections.get(adminId) || [];
  console.log(`Attempting to notify admin ${adminId}, found ${connections.length} connections`);
  
  // Clean up closed connections first
  const activeConnections = connections.filter(ws => ws.readyState === WebSocket.OPEN);
  adminConnections.set(adminId, activeConnections);
  
  if (activeConnections.length === 0) {
    console.log(`No active connections for admin ${adminId}`);
    return;
  }
  
  const message = JSON.stringify({
    type: 'notification',
    data: notification
  });
  
  // Send to only the first active connection to avoid duplicates
  const ws = activeConnections[0];
  try {
    ws.send(message);
    console.log(`Notification sent to admin ${adminId} (using 1 connection out of ${activeConnections.length})`);
  } catch (error) {
    console.error(`Failed to send notification to admin ${adminId}:`, error);
  }
}

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    type: 'admin' | 'employee' | 'super_admin';
  };
}

// Authentication middleware
const authenticateToken = (userType?: 'admin' | 'employee' | 'super_admin' | ('admin' | 'employee' | 'super_admin')[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (userType) {
        const allowedTypes = Array.isArray(userType) ? userType : [userType];
        if (!allowedTypes.includes(decoded.type)) {
          return res.status(403).json({ message: 'Insufficient permissions' });
        }
      }
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(403).json({ message: 'Invalid token' });
    }
  };
};

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Configuration endpoint
  app.get('/api/config', (req, res) => {
    res.json({
      GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY
    });
  });

  // Employee Authentication Routes
  app.post('/api/employee/login', async (req, res) => {
    try {
      const { email, password } = employeeLoginSchema.parse(req.body);

      const employee = await storage.getEmployeeByEmail(email);
      if (!employee) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, employee.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: employee.id, type: 'employee' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ 
        token,
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          phone: employee.phone,
          siteId: employee.siteId,
          profileImage: employee.profileImage,
        }
      });
    } catch (error) {
      console.error('Employee login error:', error);
      res.status(400).json({ message: 'Invalid request data' });
    }
  });

  // Employee Profile Routes
  app.get('/api/employee/profile', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      const employee = await storage.getEmployee(req.user!.id);
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      res.json({
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        phone: employee.phone,
        address: employee.address,
        siteId: employee.siteId,
        profileImage: employee.profileImage,
      });
    } catch (error) {
      console.error('Error fetching employee profile:', error);
      res.status(500).json({ message: 'Failed to fetch profile' });
    }
  });

  // Employee profile update route (limited fields)
  app.put('/api/employee/profile', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = updateEmployeeProfileSchema.parse(req.body);
      
      // Normalize profile image URL if provided
      if (validatedData.profileImage) {
        const objectStorageService = new ObjectStorageService();
        validatedData.profileImage = await objectStorageService.trySetObjectEntityPath(validatedData.profileImage);
      }
      
      const employee = await storage.updateEmployee(req.user!.id, validatedData);
      const { password, ...employeeData } = employee;
      res.json(employeeData);
    } catch (error) {
      console.error('Error updating employee profile:', error);
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return res.status(400).json({ message: errorMessages.join(', ') });
      }
      res.status(400).json({ message: 'Failed to update profile' });
    }
  });

  // Employee Work Site Route
  app.get('/api/employee/site', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      const employee = await storage.getEmployee(req.user!.id);
      if (!employee || !employee.siteId) {
        return res.status(404).json({ message: 'No work site assigned' });
      }

      const site = await storage.getWorkSite(employee.siteId);
      if (!site) {
        return res.status(404).json({ message: 'Work site not found' });
      }

      res.json(site);
    } catch (error) {
      console.error('Error fetching employee site:', error);
      res.status(500).json({ message: 'Failed to fetch work site' });
    }
  });

  // Employee Attendance Routes
  app.get('/api/employee/attendance/current', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      const attendance = await storage.getCurrentAttendance(req.user!.id);
      res.json(attendance || null);
    } catch (error) {
      console.error('Error fetching current attendance:', error);
      res.status(500).json({ message: 'Failed to fetch attendance' });
    }
  });

  app.post('/api/employee/attendance/checkin', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      const { latitude, longitude } = req.body;
      const employeeId = req.user!.id;

      // Get employee and assigned work site
      const employee = await storage.getEmployee(employeeId);
      if (!employee || !employee.siteId) {
        return res.status(400).json({ message: 'No work site assigned' });
      }

      const site = await storage.getWorkSite(employee.siteId);
      if (!site) {
        return res.status(400).json({ message: 'Work site not found' });
      }

      // Check if employee is within geofence with improved accuracy
      const distance = calculateDistance(
        latitude,
        longitude,
        parseFloat(site.latitude),
        parseFloat(site.longitude)
      );

      // Add buffer for GPS accuracy issues (typically 3-5m accuracy for mobile GPS)
      const gpsAccuracyBuffer = 10; // meters
      const effectiveRadius = site.geofenceRadius + gpsAccuracyBuffer;

      console.log(`Geofence check: Distance=${Math.round(distance)}m, Radius=${site.geofenceRadius}m, EffectiveRadius=${effectiveRadius}m`);

      if (distance > effectiveRadius) {
        return res.status(400).json({ 
          message: `You must be within ${site.geofenceRadius}m of the work site to check in. You are ${Math.round(distance)}m away.`,
          distance: Math.round(distance),
          requiredRadius: site.geofenceRadius
        });
      }

      // Check if already checked in
      const currentAttendance = await storage.getCurrentAttendance(employeeId);
      if (currentAttendance && !currentAttendance.checkOutTime) {
        return res.status(400).json({ message: 'Already checked in' });
      }

      // Create attendance record
      const attendance = await storage.createAttendance({
        employeeId,
        siteId: employee.siteId,
        checkInLatitude: latitude.toString(),
        checkInLongitude: longitude.toString(),
      });

      // Create location tracking record
      await storage.createLocationTracking({
        employeeId,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        isOnSite: true,
      });

      // Send real-time notification to admin
      console.log(`Sending check-in notification for employee ${employee.firstName} ${employee.lastName} to admin ${employee.adminId}`);
      console.log(`Admin connections available:`, Array.from(adminConnections.keys()));
      console.log(`Admin ${employee.adminId} connections count:`, adminConnections.get(employee.adminId)?.length || 0);
      notifyAdmin(employee.adminId, {
        type: 'employee_checkin',
        message: `${employee.firstName} ${employee.lastName} checked in at ${site.name}`,
        employee: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email
        },
        site: {
          id: site.id,
          name: site.name,
          address: site.address
        },
        timestamp: new Date().toISOString(),
        location: { latitude, longitude }
      });

      res.json(attendance);
    } catch (error) {
      console.error('Error checking in:', error);
      res.status(500).json({ message: 'Failed to check in' });
    }
  });

  app.post('/api/employee/attendance/checkout', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      const { latitude, longitude } = req.body;
      const employeeId = req.user!.id;

      // Get current attendance
      const currentAttendance = await storage.getCurrentAttendance(employeeId);
      if (!currentAttendance || currentAttendance.checkOutTime) {
        return res.status(400).json({ message: 'Not currently checked in' });
      }

      // Update attendance record
      const updatedAttendance = await storage.updateAttendance(currentAttendance.id, {
        checkOutTime: new Date(),
        checkOutLatitude: latitude.toString(),
        checkOutLongitude: longitude.toString(),
      });

      // Create location tracking record
      await storage.createLocationTracking({
        employeeId,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        isOnSite: false,
      });

      // Send real-time notification to admin
      const employee = await storage.getEmployee(employeeId);
      if (employee) {
        const site = employee.siteId ? await storage.getWorkSite(employee.siteId) : null;
        notifyAdmin(employee.adminId, {
          type: 'employee_checkout',
          message: `${employee.firstName} ${employee.lastName} checked out from ${site?.name || 'work site'}`,
          employee: {
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            email: employee.email
          },
          site: site ? {
            id: site.id,
            name: site.name,
            address: site.address
          } : null,
          timestamp: new Date().toISOString(),
          location: { latitude, longitude }
        });
      }

      res.json(updatedAttendance);
    } catch (error) {
      console.error('Error checking out:', error);
      res.status(500).json({ message: 'Failed to check out' });
    }
  });

  const httpServer = createServer(app);
  
  // WebSocket server for real-time location updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store active WebSocket connections for employees
  const employeeConnections = new Map<number, WebSocket>();

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    
    if (!token) {
      ws.close(1008, 'Token required');
      return;
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      if (decoded.type === 'admin') {
        // Add admin connection to notifications map
        const connections = adminConnections.get(decoded.id) || [];
        connections.push(ws);
        adminConnections.set(decoded.id, connections);
        console.log(`Admin ${decoded.id} connected to WebSocket. Total connections: ${connections.length}`);
        
        // Send initial connection confirmation
        ws.send(JSON.stringify({
          type: 'connection_established',
          message: 'Connected to notification system'
        }));

        // Send last 5 notifications if any (only for the first connection to avoid duplicates)
        const existingConnections = adminConnections.get(decoded.id) || [];
        if (existingConnections.length === 1) { // Only send history for first connection
          const recentNotifications = notificationStacks.get(decoded.id) || [];
          if (recentNotifications.length > 0) {
            recentNotifications.forEach(notification => {
              ws.send(JSON.stringify({
                type: 'notification',
                data: notification
              }));
            });
          }
        }
      } else if (decoded.type === 'employee') {
        employeeConnections.set(decoded.id, ws);
      }

      ws.on('close', () => {
        if (decoded.type === 'admin') {
          const connections = adminConnections.get(decoded.id) || [];
          const updatedConnections = connections.filter(conn => conn !== ws);
          if (updatedConnections.length > 0) {
            adminConnections.set(decoded.id, updatedConnections);
          } else {
            adminConnections.delete(decoded.id);
          }
          console.log(`Admin ${decoded.id} disconnected. Remaining connections: ${updatedConnections.length}`);
        } else if (decoded.type === 'employee') {
          employeeConnections.delete(decoded.id);
        }
      });

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'location_update' && decoded.type === 'employee') {
            const { latitude, longitude } = message;
            const employee = await storage.getEmployee(decoded.id);
            
            if (employee && employee.siteId) {
              const site = await storage.getWorkSite(employee.siteId);
              
              if (site) {
                const distance = calculateDistance(
                  parseFloat(latitude),
                  parseFloat(longitude),
                  parseFloat(site.latitude),
                  parseFloat(site.longitude)
                );
                
                const isOnSite = distance <= site.geofenceRadius;
                
                // Save location tracking
                await storage.createLocationTracking({
                  employeeId: decoded.id,
                  latitude,
                  longitude,
                  isOnSite,
                });

                // Broadcast to admin
                const adminWsList = adminConnections.get(employee.adminId);
                if (adminWsList) {
                  adminWsList.forEach(adminWs => {
                    if (adminWs.readyState === WebSocket.OPEN) {
                      adminWs.send(JSON.stringify({
                    type: 'employee_location',
                    employeeId: decoded.id,
                    latitude,
                    longitude,
                    isOnSite,
                        timestamp: new Date().toISOString(),
                      }));
                    }
                  });
                }
              }
            }
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

    } catch (error) {
      ws.close(1008, 'Invalid token');
    }
  });

  // Add endpoint to get recent notifications
  app.get('/api/admin/notifications/recent', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const adminId = req.user!.id;
      const recentNotifications = notificationStacks.get(adminId) || [];
      res.json(recentNotifications);
    } catch (error) {
      console.error('Error fetching recent notifications:', error);
      res.status(500).json({ message: 'Failed to fetch notifications' });
    }
  });

  // Admin Authentication Routes
  app.post('/api/admin/signup', async (req, res) => {
    try {
      const validatedData = insertAdminSchema.parse(req.body);
      
      // Check if email already exists across both admin and employee tables
      const emailExists = await storage.checkEmailExists(validatedData.email);
      if (emailExists) {
        return res.status(400).json({ 
          message: 'Email address already exists. Please use a different email address.' 
        });
      }

      // Check if organization already exists
      const existingAdmin = await storage.getAdminByCompanyName(validatedData.companyName);
      if (existingAdmin) {
        return res.status(400).json({ 
          message: 'An admin account for this organization already exists. Only one admin account per organization is allowed.' 
        });
      }

      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      const admin = await storage.createAdmin({
        ...validatedData,
        password: hashedPassword,
      });

      const token = jwt.sign(
        { id: admin.id, type: 'admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ 
        token, 
        admin: { 
          id: admin.id, 
          firstName: admin.firstName, 
          lastName: admin.lastName,
          companyName: admin.companyName,
          email: admin.email 
        } 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return res.status(400).json({ message: errorMessages.join(', ') });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : 'Signup failed' });
    }
  });

  app.post('/api/admin/login', async (req, res) => {
    try {
      const { email, password } = adminLoginSchema.parse(req.body);
      const admin = await storage.getAdminByEmail(email);
      
      if (!admin || !(await bcrypt.compare(password, admin.password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      // Check if admin is verified and active
      if (!admin.isVerified) {
        return res.status(401).json({ message: 'Email not verified. Please check your email and verify your account.' });
      }

      if (!admin.isActive) {
        return res.status(401).json({ message: 'Account pending activation by Super Admin. Please contact support.' });
      }

      const token = jwt.sign(
        { id: admin.id, type: 'admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ 
        token, 
        admin: { 
          id: admin.id, 
          firstName: admin.firstName, 
          lastName: admin.lastName,
          companyName: admin.companyName,
          email: admin.email,
          role: admin.role 
        } 
      });
    } catch (error) {
      res.status(400).json({ message: 'Login failed' });
    }
  });

  // Employee Authentication Routes
  app.post('/api/employee/login', async (req, res) => {
    try {
      const { email, password } = employeeLoginSchema.parse(req.body);
      const employee = await storage.getEmployeeByEmail(email);
      
      if (!employee || !(await bcrypt.compare(password, employee.password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: employee.id, type: 'employee' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ 
        token, 
        employee: { 
          id: employee.id, 
          firstName: employee.firstName, 
          lastName: employee.lastName,
          email: employee.email,
          siteId: employee.siteId
        } 
      });
    } catch (error) {
      res.status(400).json({ message: 'Login failed' });
    }
  });

  // Admin Dashboard Routes
  app.get('/api/admin/dashboard', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const stats = await storage.getDashboardStats(req.user!.id);
      
      // Calculate "on site now" - employees checked in and within geofence
      const employees = await storage.getEmployeesByAdmin(req.user!.id);
      let onSiteCount = 0;
      
      for (const employee of employees) {
        const currentAttendance = await storage.getCurrentAttendance(employee.id);
        if (currentAttendance && employee.siteId) {
          const location = await storage.getLatestEmployeeLocation(employee.id);
          if (location) {
            const assignedSite = await storage.getWorkSite(employee.siteId);
            if (assignedSite) {
              const distance = calculateDistance(
                parseFloat(location.latitude),
                parseFloat(location.longitude),
                parseFloat(assignedSite.latitude),
                parseFloat(assignedSite.longitude)
              );
              if (distance <= assignedSite.geofenceRadius) {
                onSiteCount++;
              }
            }
          }
        }
      }
      
      res.json({
        ...stats,
        onSiteNow: onSiteCount.toString()
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch dashboard stats' });
    }
  });

  // Recent activities endpoint
  app.get('/api/admin/recent-activities', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const days = parseInt(req.query.days as string) || 7;
      const activities = await storage.getRecentActivities(req.user!.id, days);
      res.json(activities);
    } catch (error) {
      console.error('Error fetching recent activities:', error);
      res.status(500).json({ message: 'Failed to fetch recent activities' });
    }
  });

  // Admin profile route
  app.get('/api/admin/profile', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const adminId = req.user!.id;
      const admin = await storage.getAdmin(adminId);
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      res.json({
        id: admin.id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        email: admin.email,
        profileImage: admin.profileImage,
        createdAt: admin.createdAt
      });
    } catch (error) {
      console.error('Error fetching admin profile:', error);
      res.status(500).json({ message: 'Failed to fetch admin profile' });
    }
  });

  // Update admin profile
  app.put('/api/admin/profile', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { firstName, lastName, email } = req.body;

      if (!firstName || !lastName || !email) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      // Check if email is already taken by another admin
      const existingAdmin = await storage.getAdminByEmail(email);
      if (existingAdmin && existingAdmin.id !== req.user!.id) {
        return res.status(400).json({ message: 'Email already in use' });
      }

      const updatedAdmin = await storage.updateAdmin(req.user!.id, {
        firstName,
        lastName,
        email
      });

      res.json({
        id: updatedAdmin.id,
        firstName: updatedAdmin.firstName,
        lastName: updatedAdmin.lastName,
        email: updatedAdmin.email,
        profileImage: updatedAdmin.profileImage,
        createdAt: updatedAdmin.createdAt
      });
    } catch (error) {
      console.error('Error updating admin profile:', error);
      res.status(500).json({ message: 'Failed to update admin profile' });
    }
  });

  // Change admin password
  app.post('/api/admin/change-password', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required' });
      }

      const admin = await storage.getAdmin(req.user!.id);
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, admin.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      
      await storage.updateAdminPassword(req.user!.id, hashedNewPassword);

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error changing admin password:', error);
      res.status(500).json({ message: 'Failed to change password' });
    }
  });

  // Update notification preferences (placeholder for now)
  app.put('/api/admin/notification-preferences', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const preferences = req.body;
      
      // For now, we'll just return success. In a real app, you'd save these to the database
      console.log('Notification preferences updated for admin:', req.user!.id, preferences);
      
      res.json({ message: 'Notification preferences updated successfully' });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({ message: 'Failed to update notification preferences' });
    }
  });

  // Object storage endpoints for profile images
  app.post('/api/objects/upload', authenticateToken(['admin', 'employee']), async (req: AuthenticatedRequest, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({ message: 'Failed to get upload URL' });
    }
  });

  // Serve object storage images with adaptive compression
  app.get('/objects/*', async (req, res) => {
    try {
      const objectPath = req.path; // Full path like /objects/profile-images/uuid
      const objectStorageService = new ObjectStorageService();
      const compressionService = new ImageCompressionService();
      
      // Get the file object
      const file = await objectStorageService.getObjectEntityFile(objectPath);
      
      // Check if compression is requested via query params
      const compress = req.query.compress === 'true' || req.query.size;
      
      if (compress && (objectPath.includes('profile-images') || objectPath.includes('site-images'))) {
        // Get optimal compression settings
        const compressionOptions = compressionService.getOptimalSettings(req);
        
        // Apply size override if specified
        if (req.query.size) {
          const size = req.query.size as string;
          switch (size) {
            case 'thumbnail':
              compressionOptions.width = 150;
              compressionOptions.height = 150;
              break;
            case 'medium':
              compressionOptions.width = 400;
              break;
            case 'large':
              compressionOptions.width = 800;
              break;
          }
        }
        
        // Get original file buffer
        const chunks: Buffer[] = [];
        const stream = file.createReadStream();
        
        for await (const chunk of stream) {
          chunks.push(chunk);
        }
        const originalBuffer = Buffer.concat(chunks);
        
        // Compress the image
        const compressedBuffer = await compressionService.compressImage(originalBuffer, compressionOptions);
        
        // Set appropriate headers
        res.set({
          'Content-Type': compressionService.getContentType(compressionOptions.format!),
          'Content-Length': compressedBuffer.length.toString(),
          'Cache-Control': 'public, max-age=86400', // 24 hours
          'Vary': 'Accept, User-Agent'
        });
        
        res.send(compressedBuffer);
      } else {
        // Serve original file without compression
        await objectStorageService.downloadObject(file, res);
      }
    } catch (error) {
      console.error('Error serving object:', error);
      res.status(404).json({ message: 'Object not found' });
    }
  });

  // Upload and process site image
  app.post('/api/admin/site-image', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { imageURL } = req.body;

      if (!imageURL) {
        return res.status(400).json({ message: 'Image URL is required' });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityPath(imageURL);

      res.json({
        siteImage: objectPath,
        message: 'Site image processed successfully'
      });
    } catch (error) {
      console.error('Error processing site image:', error);
      res.status(500).json({ message: 'Failed to process site image' });
    }
  });

  // Serve private objects with authentication
  app.get('/objects/:objectPath(*)', authenticateToken(['admin', 'employee']), async (req: AuthenticatedRequest, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error('Error serving object:', error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Upload admin profile image
  app.post('/api/admin/profile-image', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { imageURL } = req.body;

      if (!imageURL) {
        return res.status(400).json({ message: 'Image URL is required' });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityPath(imageURL);

      // Update admin profile with object path
      const updatedAdmin = await storage.updateAdmin(req.user!.id, {
        profileImage: objectPath
      });

      res.json({
        profileImage: updatedAdmin.profileImage,
        message: 'Profile image updated successfully'
      });
    } catch (error) {
      console.error('Error uploading admin profile image:', error);
      res.status(500).json({ message: 'Failed to upload profile image' });
    }
  });

  // Remove admin profile image
  app.delete('/api/admin/profile-image', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      await storage.updateAdmin(req.user!.id, {
        profileImage: null
      });

      res.json({ message: 'Profile image removed successfully' });
    } catch (error) {
      console.error('Error removing admin profile image:', error);
      res.status(500).json({ message: 'Failed to remove profile image' });
    }
  });

  // Upload employee profile image
  app.post('/api/employee/profile-image', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      const { imageURL } = req.body;

      if (!imageURL) {
        return res.status(400).json({ message: 'Image URL is required' });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityPath(imageURL);

      // Update employee profile with object path
      const updatedEmployee = await storage.updateEmployee(req.user!.id, {
        profileImage: objectPath
      });

      res.json({
        profileImage: updatedEmployee.profileImage,
        message: 'Profile image updated successfully'
      });
    } catch (error) {
      console.error('Error uploading employee profile image:', error);
      res.status(500).json({ message: 'Failed to upload profile image' });
    }
  });

  // Remove employee profile image
  app.delete('/api/employee/profile-image', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      await storage.updateEmployee(req.user!.id, {
        profileImage: null
      });

      res.json({ message: 'Profile image removed successfully' });
    } catch (error) {
      console.error('Error removing employee profile image:', error);
      res.status(500).json({ message: 'Failed to remove profile image' });
    }
  });

  // Admin endpoints for managing employee profile images
  app.post('/api/admin/employees/:id/profile-image', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const { imageURL } = req.body;

      if (!imageURL) {
        return res.status(400).json({ message: 'Image URL is required' });
      }

      // Check if this employee belongs to the admin
      const adminEmployees = await storage.getEmployeesByAdmin(req.user!.id);
      if (!adminEmployees.find(emp => emp.id === employeeId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityPath(imageURL);

      // Update employee profile with object path
      const updatedEmployee = await storage.updateEmployee(employeeId, {
        profileImage: objectPath
      });

      res.json({
        profileImage: updatedEmployee.profileImage,
        message: 'Employee profile image updated successfully'
      });
    } catch (error) {
      console.error('Error uploading employee profile image:', error);
      res.status(500).json({ message: 'Failed to upload profile image' });
    }
  });

  app.delete('/api/admin/employees/:id/profile-image', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const employeeId = parseInt(req.params.id);

      // Check if this employee belongs to the admin
      const adminEmployees = await storage.getEmployeesByAdmin(req.user!.id);
      if (!adminEmployees.find(emp => emp.id === employeeId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.updateEmployee(employeeId, {
        profileImage: null
      });

      res.json({ message: 'Employee profile image removed successfully' });
    } catch (error) {
      console.error('Error removing employee profile image:', error);
      res.status(500).json({ message: 'Failed to remove profile image' });
    }
  });

  // Department Management Routes
  app.get('/api/admin/departments', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const departments = await storage.getDepartmentsByAdmin(req.user!.id);
      res.json(departments);
    } catch (error) {
      console.error('Error fetching departments:', error);
      res.status(500).json({ message: 'Failed to fetch departments' });
    }
  });

  app.post('/api/admin/departments', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertDepartmentSchema.parse({
        ...req.body,
        adminId: req.user!.id,
      });

      const department = await storage.createDepartment(validatedData);
      res.json(department);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return res.status(400).json({ message: errorMessages.join(', ') });
      }
      console.error('Error creating department:', error);
      res.status(500).json({ message: 'Failed to create department' });
    }
  });

  app.put('/api/admin/departments/:id', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const departmentId = parseInt(req.params.id);
      const { name, description } = req.body;

      // Check if this department belongs to the admin
      const department = await storage.getDepartment(departmentId);
      if (!department || department.adminId !== req.user!.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const updatedDepartment = await storage.updateDepartment(departmentId, {
        name,
        description,
      });

      res.json(updatedDepartment);
    } catch (error) {
      console.error('Error updating department:', error);
      res.status(500).json({ message: 'Failed to update department' });
    }
  });

  app.delete('/api/admin/departments/:id', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const departmentId = parseInt(req.params.id);

      // Check if this department belongs to the admin
      const department = await storage.getDepartment(departmentId);
      if (!department || department.adminId !== req.user!.id) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if department has employees assigned
      const employees = await storage.getEmployeesByDepartment(departmentId);
      if (employees.length > 0) {
        return res.status(400).json({ 
          message: 'Cannot delete department with assigned employees. Please reassign employees first.' 
        });
      }

      await storage.deleteDepartment(departmentId);
      res.json({ message: 'Department deleted successfully' });
    } catch (error) {
      console.error('Error deleting department:', error);
      res.status(500).json({ message: 'Failed to delete department' });
    }
  });

  // Employee Management Routes
  app.get('/api/admin/employees', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const employees = await storage.getEmployeesByAdmin(req.user!.id);
      res.json(employees);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch employees' });
    }
  });

  app.get('/api/admin/employees/:id', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const employee = await storage.getEmployee(employeeId);
      
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      // Check if this employee belongs to the admin
      const adminEmployees = await storage.getEmployeesByAdmin(req.user!.id);
      if (!adminEmployees.find(emp => emp.id === employeeId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      res.json(employee);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch employee' });
    }
  });

  app.get('/api/admin/employees/:id/attendance', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const attendance = await storage.getEmployeeAttendanceHistory(employeeId, new Date(0));
      res.json(attendance);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch attendance records' });
    }
  });

  app.get('/api/admin/employees/:id/locations', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const employeeId = parseInt(req.params.id);
      const locations = await storage.getEmployeeLocationHistory(employeeId);
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch location history' });
    }
  });

  app.post('/api/admin/employees', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      console.log('Employee creation request body:', JSON.stringify(req.body, null, 2));
      
      // Pre-process data before validation
      const processedData = { ...req.body };
      
      // Convert departmentId to number if it's a string
      if (processedData.departmentId) {
        if (typeof processedData.departmentId === 'string') {
          if (processedData.departmentId === 'none' || processedData.departmentId === '') {
            processedData.departmentId = null;
          } else {
            processedData.departmentId = parseInt(processedData.departmentId);
          }
        }
      }
      
      // Convert siteId to number if it's a string
      if (processedData.siteId) {
        if (typeof processedData.siteId === 'string') {
          if (processedData.siteId === 'none' || processedData.siteId === '') {
            processedData.siteId = null;
          } else {
            processedData.siteId = parseInt(processedData.siteId);
          }
        }
      }
      
      // Remove adminId from validation since we set it manually
      const validatedData = insertEmployeeSchema.omit({ adminId: true }).parse(processedData);
      
      console.log('Validated data:', JSON.stringify(validatedData, null, 2));
      
      // Check if email already exists across both admin and employee tables
      const emailExists = await storage.checkEmailExists(validatedData.email);
      if (emailExists) {
        return res.status(400).json({ 
          message: 'Email address already exists. Please use a different email address.' 
        });
      }

      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      // Normalize profile image URL if provided
      let profileImage = validatedData.profileImage;
      if (profileImage) {
        const objectStorageService = new ObjectStorageService();
        profileImage = await objectStorageService.trySetObjectEntityPath(profileImage);
      }
      
      // Auto-generate employeeId if not provided
      let employeeId = validatedData.employeeId;
      if (!employeeId) {
        const employees = await storage.getEmployeesByAdmin(req.user!.id);
        employeeId = `EMP${String(employees.length + 1).padStart(3, '0')}`;
      }
      
      const employee = await storage.createEmployee({
        ...validatedData,
        employeeId,
        password: hashedPassword,
        profileImage,
        adminId: req.user!.id,
      });

      res.status(201).json(employee);
    } catch (error) {
      console.error('Employee creation error:', error);
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return res.status(400).json({ message: errorMessages.join(', ') });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to create employee' });
    }
  });

  app.put('/api/admin/employees/:id', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Pre-process data before validation
      const processedData = { ...req.body };
      
      // Convert departmentId to number if it's a string
      if (processedData.departmentId) {
        if (typeof processedData.departmentId === 'string') {
          if (processedData.departmentId === 'none' || processedData.departmentId === '') {
            processedData.departmentId = null;
          } else {
            processedData.departmentId = parseInt(processedData.departmentId);
          }
        }
      }
      
      // Convert siteId to number if it's a string
      if (processedData.siteId) {
        if (typeof processedData.siteId === 'string') {
          if (processedData.siteId === 'none' || processedData.siteId === '') {
            processedData.siteId = null;
          } else {
            processedData.siteId = parseInt(processedData.siteId);
          }
        }
      }
      
      const validatedData = insertEmployeeSchema.omit({ 
        adminId: true, 
        password: true 
      }).partial().parse(processedData);
      
      // Handle password updates separately if provided in original body
      let hashedPassword;
      if (req.body.password) {
        hashedPassword = await bcrypt.hash(req.body.password, 10);
      }
      
      // Normalize profile image URL if provided
      if (validatedData.profileImage) {
        const objectStorageService = new ObjectStorageService();
        validatedData.profileImage = await objectStorageService.trySetObjectEntityPath(validatedData.profileImage);
      }
      
      const employee = await storage.updateEmployee(id, {
        ...validatedData,
        ...(hashedPassword && { password: hashedPassword })
      });
      res.json(employee);
    } catch (error) {
      console.error('Employee update error:', error);
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return res.status(400).json({ message: errorMessages.join(', ') });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to update employee' });
    }
  });

  app.delete('/api/admin/employees/:id', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEmployee(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete employee' });
    }
  });

  // Work Site Management Routes
  app.get('/api/admin/sites', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const sites = await storage.getWorkSitesByAdmin(req.user!.id);
      res.json(sites);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch work sites' });
    }
  });

  app.post('/api/admin/sites', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      console.log('Site creation request body:', JSON.stringify(req.body, null, 2));
      const validatedData = insertWorkSiteSchema.omit({ adminId: true }).parse(req.body);
      console.log('Validated site data:', JSON.stringify(validatedData, null, 2));
      
      // Process site image URL if provided
      let processedData = validatedData;
      if (validatedData.siteImage) {
        try {
          const objectStorageService = new ObjectStorageService();
          const objectPath = await objectStorageService.trySetObjectEntityPath(validatedData.siteImage);
          processedData = {
            ...validatedData,
            siteImage: objectPath
          };
          console.log('Processed site image URL:', objectPath);
        } catch (error) {
          console.error('Error processing site image URL:', error);
          // Continue without image rather than failing entire site creation
          processedData = {
            ...validatedData,
            siteImage: undefined
          };
        }
      }
      
      const site = await storage.createWorkSite({
        ...processedData,
        adminId: req.user!.id,
      });

      res.status(201).json(site);
    } catch (error) {
      console.error('Site creation error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors.map(e => e.message).join(', ') });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to create work site' });
    }
  });

  app.put('/api/admin/sites/:id', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      console.log('Site update request body:', JSON.stringify(req.body, null, 2));
      
      const validatedData = insertWorkSiteSchema.partial().parse(req.body);
      console.log('Validated site update data:', JSON.stringify(validatedData, null, 2));
      
      // Process site image URL if provided
      let processedData = validatedData;
      if (validatedData.siteImage) {
        try {
          const objectStorageService = new ObjectStorageService();
          const objectPath = await objectStorageService.trySetObjectEntityPath(validatedData.siteImage);
          processedData = {
            ...validatedData,
            siteImage: objectPath
          };
          console.log('Processed updated site image URL:', objectPath);
        } catch (error) {
          console.error('Error processing updated site image URL:', error);
          // Continue with original data on image processing error
        }
      }
      
      const site = await storage.updateWorkSite(id, processedData);
      res.json(site);
    } catch (error) {
      console.error('Site update error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors.map(e => e.message).join(', ') });
      }
      res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to update work site' });
    }
  });

  app.delete('/api/admin/sites/:id', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteWorkSite(id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete work site' });
    }
  });

  // Upload work site image
  app.put('/api/admin/sites/:id/image', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const siteId = parseInt(req.params.id);
      const { siteImageURL } = req.body;

      if (!siteImageURL) {
        return res.status(400).json({ message: 'Site image URL is required' });
      }

      // Check if this site belongs to the admin
      const adminSites = await storage.getWorkSitesByAdmin(req.user!.id);
      if (!adminSites.find(site => site.id === siteId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityPath(siteImageURL);

      // Update work site with object path
      const updatedSite = await storage.updateWorkSite(siteId, {
        siteImage: objectPath
      });

      res.json({
        siteImage: updatedSite.siteImage,
        message: 'Site image updated successfully'
      });
    } catch (error) {
      console.error('Error uploading site image:', error);
      res.status(500).json({ message: 'Failed to upload site image' });
    }
  });

  // Remove work site image
  app.delete('/api/admin/sites/:id/image', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const siteId = parseInt(req.params.id);

      // Check if this site belongs to the admin
      const adminSites = await storage.getWorkSitesByAdmin(req.user!.id);
      if (!adminSites.find(site => site.id === siteId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.updateWorkSite(siteId, {
        siteImage: null
      });

      res.json({ message: 'Site image removed successfully' });
    } catch (error) {
      console.error('Error removing site image:', error);
      res.status(500).json({ message: 'Failed to remove site image' });
    }
  });

  // Areas Management Routes
  app.get('/api/admin/areas', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const areas = await storage.getAreasByAdmin(req.user!.id);
      res.json(areas);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch areas' });
    }
  });

  app.post('/api/admin/areas', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const validatedData = insertAreaSchema.parse({
        ...req.body,
        adminId: req.user!.id,
      });
      const area = await storage.createArea(validatedData);
      res.status(201).json(area);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: error.errors.map(e => e.message).join(', ') });
      }
      res.status(400).json({ message: 'Failed to create area' });
    }
  });

  app.put('/api/admin/areas/:id', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const areaId = parseInt(req.params.id);
      const validatedData = insertAreaSchema.partial().parse(req.body);
      
      // Check if this area belongs to the admin
      const adminAreas = await storage.getAreasByAdmin(req.user!.id);
      if (!adminAreas.find(area => area.id === areaId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      const area = await storage.updateArea(areaId, validatedData);
      res.json(area);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update area' });
    }
  });

  app.delete('/api/admin/areas/:id', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const areaId = parseInt(req.params.id);
      
      // Check if this area belongs to the admin
      const adminAreas = await storage.getAreasByAdmin(req.user!.id);
      if (!adminAreas.find(area => area.id === areaId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      await storage.deleteArea(areaId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete area' });
    }
  });

  // Employee Check-in/Check-out Routes
  app.post('/api/employee/checkin', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      const { latitude, longitude, siteId } = req.body;
      
      // Check if employee is already checked in
      const currentAttendance = await storage.getCurrentAttendance(req.user!.id);
      if (currentAttendance) {
        return res.status(400).json({ message: 'Already checked in' });
      }

      const attendance = await storage.createAttendance({
        employeeId: req.user!.id,
        siteId: parseInt(siteId),
        checkInLatitude: latitude,
        checkInLongitude: longitude,
      });

      res.json(attendance);
    } catch (error) {
      res.status(400).json({ message: 'Check-in failed' });
    }
  });

  app.post('/api/employee/checkout', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      const { latitude, longitude } = req.body;
      
      const currentAttendance = await storage.getCurrentAttendance(req.user!.id);
      if (!currentAttendance) {
        return res.status(400).json({ message: 'Not currently checked in' });
      }

      const updatedAttendance = await storage.updateAttendance(currentAttendance.id, {
        checkOutTime: new Date(),
        checkOutLatitude: latitude,
        checkOutLongitude: longitude,
      });

      res.json(updatedAttendance);
    } catch (error) {
      res.status(400).json({ message: 'Check-out failed' });
    }
  });

  // Employee attendance history route (30-day filter)
  app.get('/api/employee/attendance/history', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      // Get attendance history from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const history = await storage.getEmployeeAttendanceHistory(req.user!.id, thirtyDaysAgo);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch attendance history' });
    }
  });

  // Location Tracking Routes
  app.get('/api/admin/locations', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const employees = await storage.getEmployeesByAdmin(req.user!.id);
      const locations = await Promise.all(
        employees.map(async (employee) => {
          // Only show locations for employees who are currently checked in
          const currentAttendance = await storage.getCurrentAttendance(employee.id);
          if (currentAttendance) {
            const location = await storage.getLatestEmployeeLocation(employee.id);
            
            // Calculate if employee is within geofence
            let isWithinGeofence = false;
            const siteId = employee.siteId;
            if (location && siteId) {
              const assignedSite = await storage.getWorkSite(siteId);
              if (assignedSite) {
                const distance = calculateDistance(
                  parseFloat(location.latitude),
                  parseFloat(location.longitude),
                  parseFloat(assignedSite.latitude),
                  parseFloat(assignedSite.longitude)
                );
                isWithinGeofence = distance <= assignedSite.geofenceRadius;
                console.log(`Employee ${employee.firstName} distance: ${distance}m, geofence: ${assignedSite.geofenceRadius}m, within: ${isWithinGeofence}`);
              }
            }
            
            return {
              employee: {
                ...employee,
                isCheckedIn: true,
                isActive: true
              },
              location: location ? {
                ...location,
                isWithinGeofence
              } : null,
            };
          }
          return null;
        })
      );
      
      // Filter out null values (employees not checked in)
      const activeLocations = locations.filter(Boolean);
      res.json(activeLocations);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch employee locations' });
    }
  });

  app.post('/api/employee/location', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      const { latitude, longitude } = req.body;
      const employee = await storage.getEmployee(req.user!.id);
      
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      // Calculate if employee is on site
      const assignedSite = employee.siteId ? await storage.getWorkSite(employee.siteId) : null;
      let isOnSite = false;
      
      if (assignedSite) {
        const distance = calculateDistance(
          parseFloat(latitude),
          parseFloat(longitude),
          parseFloat(assignedSite.latitude),
          parseFloat(assignedSite.longitude)
        );
        isOnSite = distance <= assignedSite.geofenceRadius;
      }

      // Save location tracking
      await storage.createLocationTracking({
        employeeId: employee.id,
        latitude,
        longitude,
        isOnSite,
      });

      res.json({ success: true, isOnSite });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update location' });
    }
  });

  app.get('/api/employee/status', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      const currentAttendance = await storage.getCurrentAttendance(req.user!.id);
      const employee = await storage.getEmployee(req.user!.id);
      
      res.json({
        isCheckedIn: !!currentAttendance,
        attendance: currentAttendance,
        assignedSite: employee?.siteId,
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch employee status' });
    }
  });

  // Export Report endpoint
  app.post('/api/admin/export-report', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { email, fromEmail, subject, format = 'html' } = req.body;
      
      if (!email || !fromEmail || !subject) {
        return res.status(400).json({ message: 'Email, fromEmail, and subject are required' });
      }

      // Validate format
      const validFormats = ['html', 'pdf', 'excel', 'csv'];
      if (!validFormats.includes(format)) {
        return res.status(400).json({ message: 'Invalid format. Must be one of: html, pdf, excel, csv' });
      }

      // Get all employees for this admin
      const employees = await storage.getEmployeesByAdmin(req.user!.id);
      
      // Get 30-day attendance data for all employees
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const attendanceData = await Promise.all(
        employees.map(async (employee) => {
          const history = await storage.getEmployeeAttendanceHistory(employee.id, thirtyDaysAgo);
          const site = employee.siteId ? await storage.getWorkSite(employee.siteId) : null;
          
          return {
            employee,
            site,
            attendance: history
          };
        })
      );

      // Generate report based on format
      let reportContent: string | Buffer;
      let attachments: any[] = [];
      let emailHtml = '';

      if (format === 'html') {
        reportContent = generateAttendanceReportHtml(attendanceData, thirtyDaysAgo);
        emailHtml = reportContent;
      } else if (format === 'pdf') {
        try {
          reportContent = await generatePdfReport(attendanceData, thirtyDaysAgo);
          emailHtml = 'Please find the attendance report attached as a PDF file.';
          attachments = [{
            content: reportContent.toString('base64'),
            filename: `attendance-report-${new Date().toISOString().split('T')[0]}.pdf`,
            type: 'application/pdf',
            disposition: 'attachment'
          }];
        } catch (pdfError) {
          console.error('PDF generation failed, falling back to HTML:', pdfError);
          // Fallback to HTML format if PDF generation fails
          reportContent = generateAttendanceReportHtml(attendanceData, thirtyDaysAgo);
          emailHtml = reportContent;
          attachments = [];
        }
      } else if (format === 'excel') {
        reportContent = await generateExcelReport(attendanceData, thirtyDaysAgo);
        emailHtml = 'Please find the attendance report attached as an Excel file.';
        attachments = [{
          content: reportContent.toString('base64'),
          filename: `attendance-report-${new Date().toISOString().split('T')[0]}.xlsx`,
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          disposition: 'attachment'
        }];
      } else if (format === 'csv') {
        reportContent = await generateCsvReport(attendanceData, thirtyDaysAgo);
        emailHtml = 'Please find the attendance report attached as a CSV file.';
        attachments = [{
          content: Buffer.from(reportContent).toString('base64'),
          filename: `attendance-report-${new Date().toISOString().split('T')[0]}.csv`,
          type: 'text/csv',
          disposition: 'attachment'
        }];
      }
      
      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email) || !emailRegex.test(fromEmail)) {
        return res.status(400).json({ message: 'Invalid email address format' });
      }

      console.log(`Sending attendance report (${format.toUpperCase()}) from ${fromEmail} to ${email}`);
      console.log(`Report contains ${attendanceData.length} employees`);

      // For SendGrid to work properly, the 'from' email should be verified
      // We'll use a safer approach with a verified sender
      let actualFromEmail = fromEmail;
      
      // If using Gmail, suggest using a verified sender to avoid spam filters
      if (fromEmail.includes('@gmail.com') || fromEmail.includes('@yahoo.com') || fromEmail.includes('@hotmail.com')) {
        console.warn(`Warning: Using ${fromEmail} as sender. For better delivery, verify this email in SendGrid.`);
      }

      // Send email
      const emailSent = await sendEmail({
        to: email,
        from: actualFromEmail,
        subject: subject,
        html: emailHtml,
        text: 'Please view this email in HTML format to see the attendance report.',
        attachments: attachments
      });

      if (emailSent) {
        res.json({ message: 'Report sent successfully' });
      } else {
        res.status(500).json({ message: 'Failed to send email (export failed)' });
      }
    } catch (error) {
      console.error('Export report error:', error);
      res.status(500).json({ message: 'Failed to generate and send report (export failed)' });
    }
  });

  // Super Admin Routes
  app.post('/api/super-admin/login', async (req, res) => {
    try {
      const { email, password } = adminLoginSchema.parse(req.body);

      const admin = await storage.getAdminByEmail(email);
      if (!admin || admin.role !== 'super_admin') {
        return res.status(401).json({ message: 'Invalid credentials or insufficient permissions' });
      }

      const isValidPassword = await bcrypt.compare(password, admin.password);
      if (!isValidPassword) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign(
        { id: admin.id, type: 'super_admin' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({ 
        token,
        admin: {
          id: admin.id,
          firstName: admin.firstName,
          lastName: admin.lastName,
          email: admin.email,
          role: admin.role,
        }
      });
    } catch (error) {
      res.status(401).json({ message: 'Invalid credentials' });
    }
  });

  // Super Admin - Get all pending admins
  app.get('/api/super-admin/pending-admins', authenticateToken('super_admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const pendingAdmins = await storage.getPendingAdmins();
      res.json(pendingAdmins);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch pending admins' });
    }
  });

  // Super Admin - Activate/Deactivate admin
  app.put('/api/super-admin/activate-admin', authenticateToken('super_admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { adminId, isActive } = adminActivationSchema.parse(req.body);
      
      const updatedAdmin = await storage.updateAdminStatus(adminId, isActive);
      res.json(updatedAdmin);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update admin status' });
    }
  });

  // Admin Email Verification
  app.post('/api/admin/verify-email', async (req, res) => {
    try {
      const { token } = adminVerificationSchema.parse(req.body);
      
      const admin = await storage.verifyAdminEmail(token);
      if (!admin) {
        return res.status(400).json({ message: 'Invalid or expired verification token' });
      }

      res.json({ message: 'Email verified successfully. Your account is pending activation by a Super Admin.' });
    } catch (error) {
      res.status(400).json({ message: 'Invalid verification token' });
    }
  });

  // Resend Verification Email
  app.post('/api/admin/resend-verification', async (req, res) => {
    try {
      const { email } = req.body;
      
      const admin = await storage.getAdminByEmail(email);
      if (!admin) {
        return res.status(404).json({ message: 'Admin account not found' });
      }

      if (admin.isVerified) {
        return res.status(400).json({ message: 'Email is already verified' });
      }

      // Generate new verification token
      const verificationToken = jwt.sign(
        { email: admin.email, timestamp: Date.now() },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Update admin with new token
      await storage.updateAdmin(admin.id, { verificationToken });

      // Send verification email
      const verificationLink = `${req.protocol}://${req.get('host')}/admin/verify-email?token=${verificationToken}`;
      
      console.log('Resending verification email to:', email);
      console.log('New verification link:', verificationLink);
      
      const emailSent = await sendEmail({
        to: email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@labourtrackr.com',
        subject: 'Verify Your Admin Account - LabourTrackr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #007cba;">Email Verification - LabourTrackr</h2>
            <p>Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" style="background: #007cba; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
            </div>
            <p><strong>Important:</strong> This verification link will expire in 24 hours.</p>
            <p>After email verification, a Super Admin will need to activate your account before you can access the system.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">If you didn't request this verification, please ignore this email.</p>
          </div>
        `,
        text: `Please verify your email by visiting: ${verificationLink}. This link expires in 24 hours.`
      });

      if (emailSent) {
        res.json({ 
          message: 'Verification email sent successfully. Please check your email.',
          details: 'A new verification email has been sent to your email address.'
        });
      } else {
        console.error('Failed to resend verification email for admin:', email);
        res.status(500).json({ 
          message: 'Failed to send verification email. Please contact support.',
          error: 'Email delivery failed'
        });
      }
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({ message: 'Failed to resend verification email' });
    }
  });

  // Enhanced Admin Signup with email verification
  app.post('/api/admin/signup', async (req, res) => {
    try {
      const validatedData = insertAdminSchema.parse(req.body);
      
      // Check if email already exists
      const existingAdmin = await storage.getAdminByEmail(validatedData.email);
      if (existingAdmin) {
        return res.status(400).json({ message: 'Email already registered' });
      }

      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      // Generate verification token
      const verificationToken = jwt.sign(
        { email: validatedData.email, timestamp: Date.now() },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      const admin = await storage.createAdmin({
        ...validatedData,
        password: hashedPassword,
        verificationToken,
        isVerified: false,
        isActive: false,
      });

      // Send verification email
      const verificationLink = `${req.protocol}://${req.get('host')}/admin/verify-email?token=${verificationToken}`;
      
      console.log('Sending verification email to:', validatedData.email);
      console.log('Verification link:', verificationLink);
      
      const emailSent = await sendEmail({
        to: validatedData.email,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@labourtrackr.com',
        subject: 'Verify Your Admin Account - LabourTrackr',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #007cba;">Welcome to LabourTrackr!</h2>
            <p>Thank you for signing up as an admin. Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" style="background: #007cba; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">Verify Email Address</a>
            </div>
            <p><strong>Important:</strong> This verification link will expire in 24 hours.</p>
            <p>After email verification, a Super Admin will need to activate your account before you can access the system.</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">If you didn't request this account, please ignore this email.</p>
          </div>
        `,
        text: `Welcome to LabourTrackr! Please verify your email by visiting: ${verificationLink}. This link expires in 24 hours.`
      });

      console.log('Email sent result:', emailSent);

      if (emailSent) {
        res.status(201).json({ 
          message: 'Account created successfully. Please check your email to verify your account.',
          requiresVerification: true 
        });
      } else {
        res.status(201).json({ 
          message: 'Account created but verification email failed to send. Please contact support.',
          requiresVerification: true 
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorMessages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
        return res.status(400).json({ message: errorMessages.join(', ') });
      }
      res.status(400).json({ message: 'Failed to create admin account' });
    }
  });

  return httpServer;
}

// Helper function to generate HTML report
function generateAttendanceReportHtml(attendanceData: any[], fromDate: Date): string {
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const calculateHours = (checkIn: Date | string, checkOut: Date | string | null) => {
    if (!checkOut) return 'In Progress';
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Employee Attendance Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
        .employee-section { margin-bottom: 30px; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
        .employee-header { background: #e9ecef; padding: 15px; }
        .attendance-table { width: 100%; border-collapse: collapse; }
        .attendance-table th, .attendance-table td { padding: 10px; text-align: left; border-bottom: 1px solid #dee2e6; }
        .attendance-table th { background: #f8f9fa; font-weight: bold; }
        .no-data { text-align: center; padding: 20px; color: #6c757d; }
        .summary { background: #e3f2fd; padding: 15px; border-radius: 4px; margin: 10px 0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Employee Attendance Report</h1>
        <p><strong>Report Period:</strong> ${formatDate(fromDate)} - ${formatDate(new Date())}</p>
        <p><strong>Generated on:</strong> ${formatDate(new Date())} at ${formatTime(new Date())}</p>
      </div>

      ${attendanceData.map(({ employee, site, attendance }) => `
        <div class="employee-section">
          <div class="employee-header">
            <h2>${employee.firstName} ${employee.lastName}</h2>
            <p><strong>Email:</strong> ${employee.email}</p>
            <p><strong>Assigned Site:</strong> ${site ? site.name : 'No assigned site'}</p>
            ${site ? `<p><strong>Site Address:</strong> ${site.address}</p>` : ''}
          </div>
          
          <div class="summary">
            <strong>Summary:</strong> ${attendance.length} attendance records in the last 30 days
          </div>

          ${attendance.length > 0 ? `
            <table class="attendance-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Hours Worked</th>
                  <th>Site</th>
                </tr>
              </thead>
              <tbody>
                ${attendance.map((record: any) => `
                  <tr>
                    <td>${formatDate(record.checkInTime)}</td>
                    <td>${formatTime(record.checkInTime)}</td>
                    <td>${record.checkOutTime ? formatTime(record.checkOutTime) : 'Still checked in'}</td>
                    <td>${calculateHours(record.checkInTime, record.checkOutTime)}</td>
                    <td>${site ? site.name : 'Unknown'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `
            <div class="no-data">
              No attendance records found for this employee in the last 30 days.
            </div>
          `}
        </div>
      `).join('')}

      <div class="header">
        <p><em>This report was automatically generated by the Labor Tracking System.</em></p>
      </div>
    </body>
    </html>
  `;
}

// Generate PDF report using PDFKit
async function generatePdfReport(attendanceData: any[], fromDate: Date): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Helper functions
      const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      };

      const formatTime = (date: Date | string) => {
        return new Date(date).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      };

      const calculateHours = (checkIn: Date | string, checkOut: Date | string | null) => {
        if (!checkOut) return 'In Progress';
        const start = new Date(checkIn);
        const end = new Date(checkOut);
        const diffMs = end.getTime() - start.getTime();
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${hours}h ${minutes}m`;
      };

      // Header
      doc.fontSize(24).text('Employee Attendance Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12)
        .text(`Report Period: ${formatDate(fromDate)} - ${formatDate(new Date())}`)
        .text(`Generated on: ${formatDate(new Date())} at ${formatTime(new Date())}`)
        .moveDown(2);

      // Employee data
      attendanceData.forEach(({ employee, site, attendance }, index) => {
        if (index > 0) {
          doc.addPage();
        }

        // Employee header
        doc.fontSize(18).text(`${employee.firstName} ${employee.lastName}`, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(12)
          .text(`Email: ${employee.email}`)
          .text(`Assigned Site: ${site ? site.name : 'No assigned site'}`)
          .text(`Site Address: ${site ? site.address : 'N/A'}`)
          .text(`Total Records: ${attendance.length} attendance records in the last 30 days`)
          .moveDown();

        if (attendance.length > 0) {
          // Table header
          const tableTop = doc.y;
          const colWidths = [80, 80, 80, 80, 120];
          const headers = ['Date', 'Check In', 'Check Out', 'Hours', 'Site'];
          
          let x = 50;
          headers.forEach((header, i) => {
            doc.rect(x, tableTop, colWidths[i], 25).stroke();
            doc.fontSize(10).text(header, x + 5, tableTop + 8, { width: colWidths[i] - 10 });
            x += colWidths[i];
          });

          // Table rows
          let y = tableTop + 25;
          attendance.forEach((record: any) => {
            if (y > 700) { // New page if needed
              doc.addPage();
              y = 50;
            }

            x = 50;
            const rowData = [
              formatDate(record.checkInTime),
              formatTime(record.checkInTime),
              record.checkOutTime ? formatTime(record.checkOutTime) : 'Still in',
              calculateHours(record.checkInTime, record.checkOutTime),
              site ? site.name : 'Unknown'
            ];

            rowData.forEach((data, i) => {
              doc.rect(x, y, colWidths[i], 20).stroke();
              doc.fontSize(9).text(data, x + 3, y + 5, { width: colWidths[i] - 6, height: 15 });
              x += colWidths[i];
            });
            y += 20;
          });
        } else {
          doc.text('No attendance records found for this employee in the last 30 days.');
        }
      });

      // Footer
      doc.fontSize(10).text('This report was automatically generated by the Labor Tracking System.', 50, 750, {
        align: 'center'
      });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Generate Excel report using XLSX
async function generateExcelReport(attendanceData: any[], fromDate: Date): Promise<Buffer> {
  const workbook = XLSX.utils.book_new();
  
  // Summary sheet
  const summaryData = attendanceData.map(({ employee, site, attendance }) => ({
    'Employee Name': `${employee.firstName} ${employee.lastName}`,
    'Email': employee.email,
    'Assigned Site': site ? site.name : 'No assigned site',
    'Site Address': site ? site.address : '',
    'Total Records': attendance.length,
    'Active Days': attendance.length
  }));
  
  const summarySheet = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
  
  // Detailed attendance sheet
  const detailedData: any[] = [];
  attendanceData.forEach(({ employee, site, attendance }) => {
    attendance.forEach((record: any) => {
      const checkIn = new Date(record.checkInTime);
      const checkOut = record.checkOutTime ? new Date(record.checkOutTime) : null;
      const hours = checkOut ? 
        Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) * 100) / 100 : 0;
      
      detailedData.push({
        'Employee Name': `${employee.firstName} ${employee.lastName}`,
        'Email': employee.email,
        'Date': checkIn.toLocaleDateString(),
        'Check In Time': checkIn.toLocaleTimeString(),
        'Check Out Time': checkOut ? checkOut.toLocaleTimeString() : 'Still checked in',
        'Hours Worked': checkOut ? hours : 'In Progress',
        'Site Name': site ? site.name : 'Unknown',
        'Site Address': site ? site.address : ''
      });
    });
  });
  
  const detailedSheet = XLSX.utils.json_to_sheet(detailedData);
  XLSX.utils.book_append_sheet(workbook, detailedSheet, 'Detailed Attendance');
  
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

// Generate CSV report
async function generateCsvReport(attendanceData: any[], fromDate: Date): Promise<string> {
  const csvData: any[] = [];
  
  attendanceData.forEach(({ employee, site, attendance }) => {
    attendance.forEach((record: any) => {
      const checkIn = new Date(record.checkInTime);
      const checkOut = record.checkOutTime ? new Date(record.checkOutTime) : null;
      const hours = checkOut ? 
        Math.round((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60) * 100) / 100 : 0;
      
      csvData.push({
        employee_name: `${employee.firstName} ${employee.lastName}`,
        email: employee.email,
        date: checkIn.toLocaleDateString(),
        check_in_time: checkIn.toLocaleTimeString(),
        check_out_time: checkOut ? checkOut.toLocaleTimeString() : 'Still checked in',
        hours_worked: checkOut ? hours : 'In Progress',
        site_name: site ? site.name : 'Unknown',
        site_address: site ? site.address : ''
      });
    });
  });
  
  // Convert to CSV format manually
  if (csvData.length === 0) {
    return 'employee_name,email,date,check_in_time,check_out_time,hours_worked,site_name,site_address\n';
  }
  
  const headers = Object.keys(csvData[0]);
  const csvContent = [
    headers.join(','),
    ...csvData.map(row => 
      headers.map(header => {
        const value = row[header];
        // Escape commas and quotes in CSV
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');
  
  return csvContent;
}
