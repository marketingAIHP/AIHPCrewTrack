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
  insertLocationTrackingSchema,
  insertAttendanceSchema,
} from "@shared/schema";
import { sendEmail } from './sendgrid';
import * as XLSX from 'xlsx';
import { createObjectCsvWriter } from 'csv-writer';
import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import path from 'path';

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
    type: 'admin' | 'employee';
  };
}

// Authentication middleware
const authenticateToken = (userType?: 'admin' | 'employee') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'Access token required' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (userType && decoded.type !== userType) {
        return res.status(403).json({ message: 'Insufficient permissions' });
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
        siteId: employee.siteId,
        profileImage: employee.profileImage,
      });
    } catch (error) {
      console.error('Error fetching employee profile:', error);
      res.status(500).json({ message: 'Failed to fetch profile' });
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

      // Check if employee is within geofence
      const distance = calculateDistance(
        latitude,
        longitude,
        parseFloat(site.latitude),
        parseFloat(site.longitude)
      );

      if (distance > site.geofenceRadius) {
        return res.status(400).json({ 
          message: `You must be within ${site.geofenceRadius}m of the work site to check in. You are ${Math.round(distance)}m away.`
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

  // Upload admin profile image
  app.post('/api/admin/profile-image', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { imageData } = req.body;

      if (!imageData) {
        return res.status(400).json({ message: 'Image data is required' });
      }

      // Update admin profile with image data
      const updatedAdmin = await storage.updateAdmin(req.user!.id, {
        profileImage: imageData
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
      const { imageData } = req.body;

      if (!imageData) {
        return res.status(400).json({ message: 'Image data is required' });
      }

      // Update employee profile with image data
      const updatedEmployee = await storage.updateEmployee(req.user!.id, {
        profileImage: imageData
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
      const { imageData } = req.body;

      if (!imageData) {
        return res.status(400).json({ message: 'Image data is required' });
      }

      // Check if this employee belongs to the admin
      const adminEmployees = await storage.getEmployeesByAdmin(req.user!.id);
      if (!adminEmployees.find(emp => emp.id === employeeId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Update employee profile with image data
      const updatedEmployee = await storage.updateEmployee(employeeId, {
        profileImage: imageData
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
      const validatedData = insertEmployeeSchema.omit({ adminId: true }).parse(req.body);
      console.log('Validated data:', JSON.stringify(validatedData, null, 2));
      
      // Check if email already exists across both admin and employee tables
      const emailExists = await storage.checkEmailExists(validatedData.email);
      if (emailExists) {
        return res.status(400).json({ 
          message: 'Email address already exists. Please use a different email address.' 
        });
      }

      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      const employee = await storage.createEmployee({
        ...validatedData,
        password: hashedPassword,
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
      const validatedData = insertEmployeeSchema.partial().parse(req.body);
      
      if (validatedData.password) {
        validatedData.password = await bcrypt.hash(validatedData.password, 10);
      }
      
      const employee = await storage.updateEmployee(id, validatedData);
      res.json(employee);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update employee' });
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
      
      const site = await storage.createWorkSite({
        ...validatedData,
        adminId: req.user!.id,
      });

      res.status(201).json(site);
    } catch (error) {
      console.error('Site creation error:', error);
      res.status(400).json({ message: error instanceof Error ? error.message : 'Failed to create work site' });
    }
  });

  app.put('/api/admin/sites/:id', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id);
      const validatedData = insertWorkSiteSchema.partial().parse(req.body);
      
      const site = await storage.updateWorkSite(id, validatedData);
      res.json(site);
    } catch (error) {
      res.status(400).json({ message: 'Failed to update work site' });
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
        reportContent = await generatePdfReport(attendanceData, thirtyDaysAgo);
        emailHtml = 'Please find the attendance report attached as a PDF file.';
        attachments = [{
          content: reportContent.toString('base64'),
          filename: `attendance-report-${new Date().toISOString().split('T')[0]}.pdf`,
          type: 'application/pdf',
          disposition: 'attachment'
        }];
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
        res.status(500).json({ message: 'Failed to send email' });
      }
    } catch (error) {
      console.error('Export report error:', error);
      res.status(500).json({ message: 'Failed to generate and send report' });
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

// Generate PDF report using Puppeteer
async function generatePdfReport(attendanceData: any[], fromDate: Date): Promise<Buffer> {
  const html = generateAttendanceReportHtml(attendanceData, fromDate);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '1cm',
        bottom: '1cm',
        left: '1cm',
        right: '1cm'
      }
    });
    
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
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
