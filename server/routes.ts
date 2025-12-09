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
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import express from 'express';
import { ImageCompressionService } from './imageCompression';
import { uploadProfileImage, uploadSiteImage, uploadMiddleware, deleteImageFromSupabase, deleteSiteImageFromSupabase } from './uploadController';

const JWT_SECRET = (() => {
  const value = process.env.JWT_SECRET;
  if (!value) {
    throw new Error('JWT_SECRET environment variable must be set'); // Ensures leaked default secret removed
  }
  return value;
})();

const SENDGRID_FROM_EMAIL = (() => {
  const value = process.env.SENDGRID_FROM_EMAIL;
  if (!value) {
    throw new Error('SENDGRID_FROM_EMAIL environment variable must be set'); // Prevents fallback email leaking into repo
  }
  return value;
})();

// WebSocket connections for real-time notifications
const adminConnections = new Map<number, WebSocket[]>(); // adminId -> WebSocket[]

// Notification stack to maintain last 5 transactions per admin
const notificationStacks = new Map<number, any[]>(); // adminId -> notifications[]

// Active employee sessions to enforce single-device logins
const activeEmployeeSessions = new Map<number, string>(); // employeeId -> jwt token

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
  // Validate notification type
  if (!notification.type || (notification.type !== 'employee_checkin' && notification.type !== 'employee_checkout')) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('❌ Invalid notification type:', notification.type);
    }
    return;
  }
  
  // Add to notification stack first
  addToNotificationStack(adminId, notification);
  
  const connections = adminConnections.get(adminId) || [];
  
  // Clean up closed connections first
  const activeConnections = connections.filter(ws => ws.readyState === WebSocket.OPEN);
  adminConnections.set(adminId, activeConnections);
  
  if (activeConnections.length === 0) {
    // No active connections for admin
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
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`❌ Failed to send notification to admin ${adminId}:`, error);
    }
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
      if (decoded.type === 'employee') {
        const activeToken = activeEmployeeSessions.get(decoded.id);
        if (activeToken && activeToken !== token) {
          return res.status(401).json({ message: 'You have been logged out because your account was used on another device.' });
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

// GPS accuracy buffer to account for mobile GPS inaccuracies (typically 3-10m)
// Using a 50m buffer to reduce false negatives when employees are on site
// This accounts for GPS drift, device accuracy variations, and signal issues
const GPS_ACCURACY_BUFFER = 50; // meters - increased from 15m for better reliability

// Helper function to safely parse coordinate values
function parseCoordinate(value: number | string | null | undefined): number {
  if (value === null || value === undefined) {
    return NaN;
  }
  
  if (typeof value === 'number') {
    return isNaN(value) ? NaN : value;
  }
  
  if (typeof value === 'string') {
    // Remove any whitespace and parse
    const trimmed = value.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
      return NaN;
    }
    const parsed = parseFloat(trimmed);
    return isNaN(parsed) ? NaN : parsed;
  }
  
  return NaN;
}

// Helper function to check if coordinates might be swapped and auto-correct
function validateAndCorrectCoordinates(
  lat: number,
  lon: number,
  context: 'employee' | 'site'
): { lat: number; lon: number; swapped: boolean } {
  // Latitude should be between -90 and 90
  // Longitude should be between -180 and 180
  // If lat is outside [-90, 90] but within [-180, 180], and lon is within [-90, 90], they're likely swapped
  
  let finalLat = lat;
  let finalLon = lon;
  let swapped = false;
  
  // Check if coordinates might be swapped
  if ((lat < -90 || lat > 90) && (lon >= -90 && lon <= 90) && (lat >= -180 && lat <= 180)) {
    // Lat is invalid but could be a valid lon, and lon could be a valid lat - likely swapped
    finalLat = lon;
    finalLon = lat;
    swapped = true;
  }
  
  // Ensure final values are within valid ranges
  if (finalLat < -90 || finalLat > 90 || finalLon < -180 || finalLon > 180) {
  }
  
  return { lat: finalLat, lon: finalLon, swapped };
}

// Helper function to check if employee is within geofence with GPS accuracy buffer
function isWithinGeofence(
  employeeLat: number | string | null | undefined,
  employeeLon: number | string | null | undefined,
  siteLat: number | string | null | undefined,
  siteLon: number | string | null | undefined,
  geofenceRadius: number
): { isWithin: boolean; distance: number; effectiveRadius: number } {
  const rawEmpLat = parseCoordinate(employeeLat);
  const rawEmpLon = parseCoordinate(employeeLon);
  const rawSiteLat = parseCoordinate(siteLat);
  const rawSiteLon = parseCoordinate(siteLon);
  
  // Validate and correct coordinates for both employee and site
  const empCoords = validateAndCorrectCoordinates(rawEmpLat, rawEmpLon, 'employee');
  const siteCoords = validateAndCorrectCoordinates(rawSiteLat, rawSiteLon, 'site');
  
  const empLat = empCoords.lat;
  const empLon = empCoords.lon;
  const sLat = siteCoords.lat;
  const sLon = siteCoords.lon;
  
  // Validate coordinates are within valid ranges
  const isValidLat = !isNaN(empLat) && empLat >= -90 && empLat <= 90;
  const isValidLon = !isNaN(empLon) && empLon >= -180 && empLon <= 180;
  const isValidSiteLat = !isNaN(sLat) && sLat >= -90 && sLat <= 90;
  const isValidSiteLon = !isNaN(sLon) && sLon >= -180 && sLon <= 180;
  
  if (!isValidLat || !isValidLon || !isValidSiteLat || !isValidSiteLon) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Invalid coordinates for geofence check:', { 
        raw: {
          employeeLat: employeeLat, 
          employeeLon: employeeLon, 
          siteLat: siteLat, 
          siteLon: siteLon
        },
        parsed: { empLat, empLon, sLat, sLon },
        employeeSwapped: empCoords.swapped,
        siteSwapped: siteCoords.swapped,
        valid: { isValidLat, isValidLon, isValidSiteLat, isValidSiteLon }
      });
    }
    return { isWithin: false, distance: Infinity, effectiveRadius: geofenceRadius + GPS_ACCURACY_BUFFER };
  }
  
  // Calculate distance
  const distance = calculateDistance(empLat, empLon, sLat, sLon);
  const effectiveRadius = geofenceRadius + GPS_ACCURACY_BUFFER;
  const isWithin = distance <= effectiveRadius;
  
  // FIX: Improved logging with clear success/failure messages
  // Only log in development mode to reduce console noise in production
  if (process.env.NODE_ENV !== 'production') {
    const logMessage = isWithin 
      ? `✅ You are within site range (${Math.round(distance)}m from site, radius: ${geofenceRadius}m)`
      : `❌ You are ${Math.round(distance)}m away from site (radius: ${geofenceRadius}m)`;
    
    console.log('📍 Geofence calculation:', {
      employeeCoords: { 
        lat: empLat.toFixed(6), 
        lon: empLon.toFixed(6), 
        original: { lat: rawEmpLat, lon: rawEmpLon }, 
        swapped: empCoords.swapped 
      },
      siteCoords: { 
        lat: sLat.toFixed(6), 
        lon: sLon.toFixed(6), 
        original: { lat: rawSiteLat, lon: rawSiteLon }, 
        swapped: siteCoords.swapped 
      },
      distance: Math.round(distance),
      geofenceRadius,
      buffer: GPS_ACCURACY_BUFFER,
      effectiveRadius: Math.round(effectiveRadius),
      isWithin,
      message: logMessage
    });
  }
  
  // Log if distance is suspiciously large (more than geofence radius + 100m buffer)
  if (distance > geofenceRadius + 100) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('⚠️ Large distance calculated - possible coordinate issue:', {
        employeeCoords: { lat: empLat.toFixed(6), lon: empLon.toFixed(6) },
        siteCoords: { lat: sLat.toFixed(6), lon: sLon.toFixed(6) },
        distance: Math.round(distance),
        geofenceRadius,
        effectiveRadius: Math.round(effectiveRadius),
        difference: Math.round(distance - effectiveRadius),
        employeeSwapped: empCoords.swapped,
        siteSwapped: siteCoords.swapped
      });
    }
  }
  
  return { isWithin, distance, effectiveRadius };
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Ensure local upload dir exists
  const uploadDir = path.join(process.cwd(), 'server', 'public', 'uploads');
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (e) {
    console.error('Failed to ensure upload directory:', uploadDir, e);
  }
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

      activeEmployeeSessions.set(employee.id, token);

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

  app.post('/api/employee/logout', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    const activeToken = activeEmployeeSessions.get(req.user!.id);
    if (!activeToken || !token || activeToken === token) {
      activeEmployeeSessions.delete(req.user!.id);
    }
    res.json({ success: true });
  });

  // Employee Profile Routes
  app.get('/api/employee/profile', authenticateToken('employee'), async (req: AuthenticatedRequest, res) => {
    try {
      const employee = await storage.getEmployee(req.user!.id);
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }
      const { password, ...employeeData } = employee;
      res.json(employeeData);
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
      // FIX: Ensure coordinates are numeric, not strings
      const { latitude, longitude } = req.body;
      
      // FIX: Parse coordinates to ensure they're numbers
      const empLat = typeof latitude === 'string' ? parseFloat(latitude) : Number(latitude);
      const empLon = typeof longitude === 'string' ? parseFloat(longitude) : Number(longitude);
      
      // Validate coordinates
      if (isNaN(empLat) || isNaN(empLon) || !isFinite(empLat) || !isFinite(empLon)) {
        return res.status(400).json({ message: 'Invalid coordinates provided' });
      }
      
      const employeeId = req.user!.id;

      // Get employee
      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(400).json({ message: 'Employee not found' });
      }

      // For remote employees, allow check-in without a siteId
      // For non-remote employees, require a siteId
      if (!employee.isRemote && !employee.siteId) {
        return res.status(400).json({ message: 'No work site assigned' });
      }

      // Get site if employee has one assigned (may be null for remote employees)
      let site = null;
      if (employee.siteId) {
        site = await storage.getWorkSite(employee.siteId);
        if (!site) {
          return res.status(400).json({ message: 'Work site not found' });
        }
      }

      // For remote employees or remote sites, skip geofence validation - they can check in from anywhere
      // But still track their location for live tracking
      const isRemote = employee.isRemote || (site?.isRemote ?? false);
      
      if (!isRemote) {
        // FIX: Check if employee is within geofence with GPS accuracy buffer
        // Use parsed numeric values for accurate calculation
        const geofenceCheck = isWithinGeofence(
          empLat, // Use parsed numeric values
          empLon, // Use parsed numeric values
          site.latitude,
          site.longitude,
          site.geofenceRadius
        );

        // FIX: Log check-in attempt with clear message
        const logMessage = geofenceCheck.isWithin
          ? `✅ Check-in allowed: Employee ${employee.firstName} ${employee.lastName} is within site range (${Math.round(geofenceCheck.distance)}m from site)`
          : `❌ Check-in denied: Employee ${employee.firstName} ${employee.lastName} is ${Math.round(geofenceCheck.distance)}m away from site (required: within ${site.geofenceRadius}m)`;

        if (!geofenceCheck.isWithin) {
          return res.status(400).json({ 
            message: `You must be within ${site.geofenceRadius}m of the work site to check in. You are ${Math.round(geofenceCheck.distance)}m away.`,
            distance: Math.round(geofenceCheck.distance),
            requiredRadius: site.geofenceRadius
          });
        }
      } else {
        // Remote work site - log that geofence check is skipped
        const remoteType = employee.isRemote ? 'employee' : 'site';
        const siteName = site?.name || 'Remote Work Site';
      }

      // Check if already checked in
      const currentAttendance = await storage.getCurrentAttendance(employeeId);
      if (currentAttendance && !currentAttendance.checkOutTime) {
        // If there's an old attendance record that was never checked out, close it silently first
        // This prevents duplicate check-in issues and ensures data integrity
        
        // Close the old attendance record silently (without sending notification)
        // Use the same coordinates as the new check-in for the checkout
        await storage.updateAttendance(currentAttendance.id, {
          checkOutTime: new Date(),
          checkOutLatitude: empLat.toString(),
          checkOutLongitude: empLon.toString(),
        });
        
      }

      // FIX: Create attendance record with parsed numeric coordinates
      // For remote employees without a siteId, we need to get or create a default remote site
      // Since attendance table requires siteId, we'll use the employee's siteId if available
      // For remote employees, we should create a default "Remote Work Site" or make siteId nullable
      // For now, if siteId is null and employee is remote, we'll need to handle this
      // Check if we need to create a default remote site for this admin
      let finalSiteId = employee.siteId;
      if (!finalSiteId && employee.isRemote) {
        // For remote employees without a siteId, try to find or create a default remote site
        // Get all sites for this admin and find a remote one, or use the first site as fallback
        const adminSites = await storage.getWorkSitesByAdmin(employee.adminId);
        const remoteSite = adminSites.find(s => s.isRemote);
        if (remoteSite) {
          finalSiteId = remoteSite.id;
        } else if (adminSites.length > 0) {
          // Fallback to first site if no remote site exists
          finalSiteId = adminSites[0].id;
        } else {
          // If no sites exist, we can't create attendance - this shouldn't happen
          return res.status(400).json({ message: 'No work sites available for remote check-in. Please contact administrator.' });
        }
      }
      
      if (!finalSiteId) {
        return res.status(400).json({ message: 'No work site assigned' });
      }

      const attendance = await storage.createAttendance({
        employeeId,
        siteId: finalSiteId,
        checkInLatitude: empLat.toString(), // Store as string in DB
        checkInLongitude: empLon.toString(), // Store as string in DB
      });

      // FIX: Create location tracking record with parsed numeric coordinates
      await storage.createLocationTracking({
        employeeId,
        latitude: empLat.toString(), // Store as string in DB
        longitude: empLon.toString(), // Store as string in DB
        isOnSite: true,
      });

      // Send real-time notification to admin
      // IMPORTANT: Always send check-in notification with type 'employee_checkin'
      // Get the final site for notification (may be different from employee.siteId for remote employees)
      const finalSite = site || await storage.getWorkSite(finalSiteId);
      const siteName = finalSite?.name || 'Remote Work Site';
      const siteAddress = finalSite?.address || 'Remote Location';
      
      const checkInNotification = {
        type: 'employee_checkin' as const,
        message: `${employee.firstName} ${employee.lastName} checked in${employee.isRemote ? ' (Remote)' : ` at ${siteName}`}`,
        employee: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName
        },
        site: {
          id: finalSiteId,
          name: siteName,
          address: siteAddress
        },
        timestamp: new Date().toISOString(),
        location: { latitude, longitude }
      };
      
      notifyAdmin(employee.adminId, checkInNotification);

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

      const latNum = typeof latitude === 'string' ? parseFloat(latitude) : Number(latitude);
      const lonNum = typeof longitude === 'string' ? parseFloat(longitude) : Number(longitude);

      if (!isFinite(latNum) || !isFinite(lonNum)) {
        return res.status(400).json({ message: 'Valid latitude and longitude are required for checkout.' });
      }

      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        return res.status(404).json({ message: 'Employee not found' });
      }

      // Skip geofence validation for remote employees
      let site = null;
      if (!employee.isRemote && employee.siteId) {
        site = await storage.getWorkSite(employee.siteId);
        if (!site) {
          return res.status(404).json({ message: 'Assigned work site not found' });
        }

        const geofenceCheck = isWithinGeofence(
          latNum,
          lonNum,
          site.latitude,
          site.longitude,
          site.geofenceRadius
        );

        if (!geofenceCheck.isWithin) {
          return res.status(403).json({ message: 'You must be within the work site geofence to check out.' });
        }
      }

      // Get current attendance
      const currentAttendance = await storage.getCurrentAttendance(employeeId);
      if (!currentAttendance || currentAttendance.checkOutTime) {
        return res.status(400).json({ message: 'Not currently checked in' });
      }

      // Update attendance record
      const updatedAttendance = await storage.updateAttendance(currentAttendance.id, {
        checkOutTime: new Date(),
        checkOutLatitude: latNum.toString(),
        checkOutLongitude: lonNum.toString(),
      });

      // Create location tracking record
      await storage.createLocationTracking({
        employeeId,
        latitude: latNum.toString(),
        longitude: lonNum.toString(),
        isOnSite: true,
      });

      // Send real-time notification to admin
      // IMPORTANT: Always send check-out notification with type 'employee_checkout'
      const checkOutNotification = {
        type: 'employee_checkout' as const,
        message: `${employee.firstName} ${employee.lastName} checked out from ${site?.name || 'work site'}`,
        employee: {
          id: employee.id,
          name: `${employee.firstName} ${employee.lastName}`,
          email: employee.email,
          firstName: employee.firstName,
          lastName: employee.lastName
        },
        site: site ? {
          id: site.id,
          name: site.name,
          address: site.address
        } : null,
        timestamp: new Date().toISOString(),
        location: { latitude, longitude }
      };
      
      notifyAdmin(employee.adminId, checkOutNotification);

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

    try {
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');


      if (!token) {
        ws.close(1008, 'Token required');
        return;
      }

      let decoded: any;
      try {
        decoded = jwt.verify(token, JWT_SECRET) as any;
      } catch (error) {
        ws.close(1008, 'Invalid token');
        return;
      }

      if (decoded.type === 'admin') {
        const connections = adminConnections.get(decoded.id) || [];
        connections.push(ws);
        adminConnections.set(decoded.id, connections);

        try {
          ws.send(JSON.stringify({
            type: 'connection_established',
            message: 'Connected to notification system'
          }));
        } catch (error) {
        }

        const existingConnections = adminConnections.get(decoded.id) || [];
        if (existingConnections.length === 1) {
          const recentNotifications = notificationStacks.get(decoded.id) || [];
          if (recentNotifications.length > 0) {
            recentNotifications.forEach(notification => {
              try {
                ws.send(JSON.stringify({
                  type: 'notification',
                  data: notification
                }));
              } catch (error) {
              }
            });
          }
        }
      } else if (decoded.type === 'employee') {
        employeeConnections.set(decoded.id, ws);
      }

      ws.on('close', (code, reason) => {

        if (decoded.type === 'admin') {
          const connections = adminConnections.get(decoded.id) || [];
          const updatedConnections = connections.filter(conn => conn !== ws);
          if (updatedConnections.length > 0) {
            adminConnections.set(decoded.id, updatedConnections);
          } else {
            adminConnections.delete(decoded.id);
          }
        } else if (decoded.type === 'employee') {
          employeeConnections.delete(decoded.id);
        }
      });

      ws.on('error', (error) => {
      });

      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'location_update' && decoded.type === 'employee') {
            const { latitude, longitude } = message;
            const latNum = parseFloat(latitude);
            const lonNum = parseFloat(longitude);

            if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
              return;
            }

            const employee = await storage.getEmployee(decoded.id);

            if (employee && employee.siteId) {
              const site = await storage.getWorkSite(employee.siteId);

              if (site) {
                const distance = calculateDistance(
                  latNum,
                  lonNum,
                  parseFloat(site.latitude as any),
                  parseFloat(site.longitude as any)
                );

                const isOnSite = distance <= site.geofenceRadius;


                await storage.createLocationTracking({
                  employeeId: decoded.id,
                  latitude: latNum.toString(),
                  longitude: lonNum.toString(),
                  isOnSite,
                });

                const adminWsList = adminConnections.get(employee.adminId);
                if (adminWsList && adminWsList.length > 0) {
                  adminWsList.forEach(adminWs => {
                    if (adminWs.readyState === WebSocket.OPEN) {
                      try {
                        adminWs.send(JSON.stringify({
                          type: 'employee_location',
                          employeeId: decoded.id,
                          employee: {
                            id: employee.id,
                            firstName: employee.firstName,
                            lastName: employee.lastName,
                            siteId: employee.siteId,
                          },
                          location: {
                            latitude: latNum,
                            longitude: lonNum,
                            isOnSite,
                            distanceFromSite: Math.round(distance),
                            timestamp: new Date().toISOString(),
                          },
                        }));
                      } catch (error) {
                      }
                    }
                  });
                } else {
                }
              }
            }
          }
        } catch (error) {
        }
      });

    } catch (error) {
      try {
        ws.close(1011, 'Server error');
      } catch (e) {
      }
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

  // Alerts endpoint
  app.get('/api/admin/alerts', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const adminId = req.user!.id;
      const alerts = await storage.getAlerts(adminId);
      res.json(alerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({ message: 'Failed to fetch alerts' });
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
      
      // Calculate "on site now" - employees checked in and within geofence (or remote employees)
      const employees = await storage.getEmployeesByAdmin(req.user!.id);
      let onSiteCount = 0;
      
      for (const employee of employees) {
        const currentAttendance = await storage.getCurrentAttendance(employee.id);
        if (currentAttendance) {
          // Remote employees are always considered "on site" when checked in
          if (employee.isRemote) {
            onSiteCount++;
          } else if (employee.siteId) {
            // For regular employees, check if they're within geofence
            const location = await storage.getLatestEmployeeLocation(employee.id);
            if (location) {
              const assignedSite = await storage.getWorkSite(employee.siteId);
              if (assignedSite) {
                const geofenceCheck = isWithinGeofence(
                  location.latitude,
                  location.longitude,
                  assignedSite.latitude,
                  assignedSite.longitude,
                  assignedSite.geofenceRadius
                );
                if (geofenceCheck.isWithin) {
                  onSiteCount++;
                }
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

  // Delete activity endpoint
  app.delete('/api/admin/activities/:activityId', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const { activityId } = req.params;
      
      // Parse activity ID to get attendance record ID
      // Activity IDs are in format: "{attendanceId}-checkin" or "{attendanceId}-checkout"
      const attendanceIdMatch = activityId.match(/^(\d+)-(checkin|checkout)$/);
      if (!attendanceIdMatch) {
        return res.status(400).json({ message: 'Invalid activity ID format' });
      }
      
      const attendanceId = parseInt(attendanceIdMatch[1]);
      
      // Delete the attendance record (this will remove both check-in and check-out activities)
      await storage.deleteAttendance(attendanceId, req.user!.id);
      
      res.json({ message: 'Activity deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting activity:', error);
      if (error.message === 'Attendance record not found') {
        return res.status(404).json({ message: error.message });
      }
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({ message: error.message });
      }
      res.status(500).json({ message: 'Failed to delete activity' });
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
      // Notification preferences updated
      
      res.json({ message: 'Notification preferences updated successfully' });
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({ message: 'Failed to update notification preferences' });
    }
  });

  // Object storage endpoints for profile images
  app.post('/api/objects/upload', authenticateToken(['admin', 'employee']), async (req: AuthenticatedRequest, res) => {
    try {
      const id = randomUUID();
      
      // Use SERVER_URL from env for production, otherwise construct from request
      const baseURL = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
      const uploadURL = `${baseURL}/api/uploads/${id}`;
      
      // Upload URL generated
      res.json({ uploadURL });
    } catch (error) {
      console.error('Error getting upload URL:', error);
      res.status(500).json({ message: 'Failed to get upload URL' });
    }
  });

  // Receive raw PUT uploads and save to /uploads as webp
  app.put('/api/uploads/:id', authenticateToken(['admin', 'employee']), express.raw({ type: '*/*', limit: '15mb' }), async (req: AuthenticatedRequest, res) => {
    try {
      const id = req.params.id;
      // Upload started
      if (!Buffer.isBuffer(req.body) || (req.body as Buffer).length === 0) {
        return res.status(400).json({ message: 'Empty upload' });
      }
      const outPath = path.join(uploadDir, `${id}.webp`);
      await sharp(req.body as Buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(outPath);
      
      // Use SERVER_URL from env for production, otherwise construct from request
      const baseURL = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
      const publicUrl = `${baseURL}/uploads/${id}.webp`;
      
      // Upload completed
      return res.json({ url: publicUrl, uploadURL: publicUrl });
    } catch (error) {
      console.error('Upload write error:', error);
      return res.status(500).json({ message: 'Upload failed' });
    }
  });

  // NEW: Supabase Storage Upload Endpoint
  app.post('/api/upload', authenticateToken(['admin', 'employee']), uploadMiddleware, uploadProfileImage);
  
  // NEW: Supabase Storage Site Image Upload Endpoint
  app.post('/api/upload/site', authenticateToken(['admin', 'employee']), uploadMiddleware, uploadSiteImage);

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

      // Get current admin to find old profile image
      const currentAdmin = await storage.getAdmin(req.user!.id);
      const oldImageUrl = currentAdmin?.profileImage;

      // Delete old image from Supabase storage if it exists
      if (oldImageUrl) {
        await deleteImageFromSupabase(oldImageUrl);
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
      // Get current admin to find old profile image
      const currentAdmin = await storage.getAdmin(req.user!.id);
      const oldImageUrl = currentAdmin?.profileImage;

      // Delete old image from Supabase storage if it exists
      if (oldImageUrl) {
        await deleteImageFromSupabase(oldImageUrl);
      }

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

      // Get current employee to find old profile image
      const currentEmployee = await storage.getEmployee(req.user!.id);
      const oldImageUrl = currentEmployee?.profileImage;

      // Delete old image from Supabase storage if it exists
      if (oldImageUrl) {
        await deleteImageFromSupabase(oldImageUrl);
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
      // Get current employee to find old profile image
      const currentEmployee = await storage.getEmployee(req.user!.id);
      const oldImageUrl = currentEmployee?.profileImage;

      // Delete old image from Supabase storage if it exists
      if (oldImageUrl) {
        await deleteImageFromSupabase(oldImageUrl);
      }

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

      // Get current employee to find old profile image
      const currentEmployee = await storage.getEmployee(employeeId);
      const oldImageUrl = currentEmployee?.profileImage;

      // Delete old image from Supabase storage if it exists
      if (oldImageUrl) {
        await deleteImageFromSupabase(oldImageUrl);
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

      // Get current employee to find old profile image
      const currentEmployee = await storage.getEmployee(employeeId);
      const oldImageUrl = currentEmployee?.profileImage;

      // Delete old image from Supabase storage if it exists
      if (oldImageUrl) {
        await deleteImageFromSupabase(oldImageUrl);
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

      const { password, ...employeeData } = employee;
      res.json(employeeData);
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
      // Log employee creation attempt (sensitive data removed)
      
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
      
      // Handle remote work option - now comes directly as isRemote boolean
      const isRemote = processedData.isRemote === true;
      
      // If employee is remote, set siteId to null
      if (isRemote) {
        processedData.siteId = null;
      }
      
      // Remove adminId from validation since we set it manually
      const validatedData = insertEmployeeSchema.omit({ adminId: true }).parse(processedData);
      
      // Employee data validated successfully
      
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
        isRemote,
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
      
      // Handle remote work option - now comes directly as isRemote boolean
      const isRemote = processedData.isRemote === true;
      
      // If employee is remote, set siteId to null
      if (isRemote) {
        processedData.siteId = null;
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
        ...(hashedPassword && { password: hashedPassword }),
        isRemote: isRemote, // Always include isRemote if it was provided
      });
      const { password, ...employeeData } = employee;
      res.json(employeeData);
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
      const validatedData = insertWorkSiteSchema.omit({ adminId: true }).parse(req.body);
      
      // Process site image URL if provided
      let processedData = validatedData;
      if (validatedData.siteImage) {
        try {
          // If siteImage is a Supabase URL, use it directly; otherwise process it
          if (validatedData.siteImage.includes('supabase.co/storage/v1/object/public') && 
              validatedData.siteImage.includes('Work%20Site%20Images')) {
            // Already a Supabase URL, use as is
            processedData = {
              ...validatedData,
              siteImage: validatedData.siteImage
            };
          } else {
            // Process through ObjectStorageService
            const objectStorageService = new ObjectStorageService();
            const objectPath = await objectStorageService.trySetObjectEntityPath(validatedData.siteImage);
            processedData = {
              ...validatedData,
              siteImage: objectPath
            };
          }
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
      // Get current site to check for old image
      const currentSite = await storage.getWorkSite(id);
      
      const validatedData = insertWorkSiteSchema.partial().parse(req.body);
      
      // Process site image URL if provided
      let processedData = validatedData;
      if (validatedData.siteImage) {
        try {
          // If siteImage is a Supabase URL, use it directly; otherwise process it
          if (validatedData.siteImage.includes('supabase.co/storage/v1/object/public') && 
              validatedData.siteImage.includes('Work%20Site%20Images')) {
            // Already a Supabase URL, use as is
            // If new image URL is different and old one exists in Supabase, delete old image
            if (currentSite?.siteImage && currentSite.siteImage !== validatedData.siteImage) {
              // Check if old image is from Supabase "Work Site Images" bucket
              if (currentSite.siteImage.includes('supabase.co/storage/v1/object/public') && 
                  currentSite.siteImage.includes('Work%20Site%20Images')) {
                await deleteSiteImageFromSupabase(currentSite.siteImage);
              }
            }
            
            processedData = {
              ...validatedData,
              siteImage: validatedData.siteImage
            };
          } else {
            // Process through ObjectStorageService
            const objectStorageService = new ObjectStorageService();
            const objectPath = await objectStorageService.trySetObjectEntityPath(validatedData.siteImage);
            
            // If new image URL is different and old one exists in Supabase, delete old image
            if (currentSite?.siteImage && currentSite.siteImage !== objectPath) {
              // Check if old image is from Supabase "Work Site Images" bucket
              if (currentSite.siteImage.includes('supabase.co/storage/v1/object/public') && 
                  currentSite.siteImage.includes('Work%20Site%20Images')) {
                await deleteSiteImageFromSupabase(currentSite.siteImage);
              }
            }
            
            processedData = {
              ...validatedData,
              siteImage: objectPath
            };
            console.log('Processed updated site image URL:', objectPath);
          }
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
      
      // Get site before deleting to check for image
      const site = await storage.getWorkSite(id);
      
      // Delete the site image from Supabase storage if it exists
      if (site?.siteImage && site.siteImage.includes('supabase.co/storage/v1/object/public') && 
          site.siteImage.includes('Work%20Site%20Images')) {
        await deleteSiteImageFromSupabase(site.siteImage);
      }
      
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
      const site = adminSites.find(site => site.id === siteId);
      if (!site) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if siteImageURL is already a Supabase URL
      let finalImagePath: string;
      if (siteImageURL.includes('supabase.co/storage/v1/object/public') && 
          siteImageURL.includes('Work%20Site%20Images')) {
        // Already a Supabase URL, use as is
        finalImagePath = siteImageURL;
      } else {
        // Process through ObjectStorageService
        const objectStorageService = new ObjectStorageService();
        finalImagePath = await objectStorageService.trySetObjectEntityPath(siteImageURL);
      }

      // Delete old site image from Supabase if it exists and is different from new one
      if (site.siteImage && site.siteImage !== finalImagePath) {
        // Check if old image is from Supabase "Work Site Images" bucket
        if (site.siteImage.includes('supabase.co/storage/v1/object/public') && 
            site.siteImage.includes('Work%20Site%20Images')) {
          await deleteSiteImageFromSupabase(site.siteImage);
        }
      }

      // Update work site with object path
      const updatedSite = await storage.updateWorkSite(siteId, {
        siteImage: finalImagePath
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
      const site = adminSites.find(site => site.id === siteId);
      if (!site) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Delete the site image from Supabase storage before removing from database
      if (site.siteImage && site.siteImage.includes('supabase.co/storage/v1/object/public') && 
          site.siteImage.includes('Work%20Site%20Images')) {
        await deleteSiteImageFromSupabase(site.siteImage);
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
            let assignedSite = null;
            let isEmployeeWithinGeofence = false;
            let distanceFromSite: number | null = null;
            let geofenceRadius: number | null = null;

            if (employee.siteId) {
              assignedSite = await storage.getWorkSite(employee.siteId);
            }

            // For remote employees, always mark as within geofence (they can work from anywhere)
            if (employee.isRemote) {
              isEmployeeWithinGeofence = true;
              distanceFromSite = null; // No distance calculation for remote employees
              geofenceRadius = null;
              
              // For remote employees, always return a location object (even if no actual location data)
              // This ensures they appear in the "on site" list
              const currentTime = new Date().toISOString();
              return {
                employee: {
                  ...employee,
                  isCheckedIn: true,
                  isActive: true,
                  isRemote: true
                },
                location: location ? {
                  ...location,
                  isWithinGeofence: true,
                  distanceFromSite: null,
                  geofenceRadius: null,
                  isOnSite: true,
                  lastFetched: currentTime // Add timestamp for when this data was fetched
                } : {
                  // Return a placeholder location object for remote employees without location data
                  id: 0,
                  employeeId: employee.id,
                  latitude: '0',
                  longitude: '0',
                  timestamp: currentTime,
                  isWithinGeofence: true,
                  isOnSite: true,
                  distanceFromSite: null,
                  geofenceRadius: null,
                  lastFetched: currentTime // Add timestamp for when this data was fetched
                },
              };
            } else if (location && assignedSite) {
              const geofenceCheck = isWithinGeofence(
                location.latitude,
                location.longitude,
                assignedSite.latitude,
                assignedSite.longitude,
                assignedSite.geofenceRadius
              );
              isEmployeeWithinGeofence = geofenceCheck.isWithin;
              distanceFromSite = geofenceCheck.distance;
              geofenceRadius = assignedSite?.geofenceRadius ?? null;
            }
            
            const currentTime = new Date().toISOString();
            return {
              employee: {
                ...employee,
                isCheckedIn: true,
                isActive: true
              },
              location: location ? {
                ...location,
                isWithinGeofence: isEmployeeWithinGeofence,
                distanceFromSite: distanceFromSite !== null ? Math.round(distanceFromSite) : null,
                geofenceRadius,
                lastFetched: currentTime // Add timestamp for when this data was fetched
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
      const employeeId = req.user!.id;

      console.log('📍 Location update via HTTP:', { employeeId, latitude, longitude });

      const employee = await storage.getEmployee(employeeId);
      if (!employee) {
        console.error('❌ Employee not found:', employeeId);
        return res.status(404).json({ message: 'Employee not found' });
      }

      const assignedSite = employee.siteId ? await storage.getWorkSite(employee.siteId) : null;
      let isOnSite = false;
      let distanceFromSite: number | null = null;
      const empLat = parseFloat(latitude.toString());
      const empLng = parseFloat(longitude.toString());

      if (Number.isNaN(empLat) || Number.isNaN(empLng)) {
        console.error('❌ Invalid coordinates provided:', { latitude, longitude });
        return res.status(400).json({ message: 'Invalid coordinates provided' });
      }

      // For remote employees, always mark as "on site" since they can work from anywhere
      // Still calculate distance if they have an assigned site for tracking purposes
      if (employee.isRemote) {
        isOnSite = true; // Remote employees are always considered "on site" for tracking
        if (assignedSite) {
          const siteLat = parseFloat(assignedSite.latitude.toString());
          const siteLng = parseFloat(assignedSite.longitude.toString());
          const distance = calculateDistance(empLat, empLng, siteLat, siteLng);
          distanceFromSite = Math.round(distance);
        }
        console.log('📏 Remote employee location:', {
          distance: distanceFromSite,
          isOnSite: true,
          isRemote: true
        });
      } else if (assignedSite) {
        const siteLat = parseFloat(assignedSite.latitude.toString());
        const siteLng = parseFloat(assignedSite.longitude.toString());

        const distance = calculateDistance(empLat, empLng, siteLat, siteLng);
        distanceFromSite = Math.round(distance);
        isOnSite = distance <= assignedSite.geofenceRadius;

        console.log('📏 Distance calc:', {
          distance: distanceFromSite,
          radius: assignedSite.geofenceRadius,
          isOnSite,
          siteName: assignedSite.name
        });
      }

      await storage.createLocationTracking({
        employeeId: employee.id,
        latitude: empLat.toString(),
        longitude: empLng.toString(),
        isOnSite,
      });

      console.log('💾 Location saved to database');

      if (employee.adminId) {
        const locationUpdate = {
          type: 'employee_location',
          employeeId: employee.id,
          employee: {
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            siteId: employee.siteId,
          },
          location: {
            latitude: empLat,
            longitude: empLng,
            isOnSite,
            distanceFromSite,
            timestamp: new Date().toISOString(),
          },
        };

        notifyAdmin(employee.adminId, locationUpdate);
        console.log('📡 Broadcasted location to admin:', employee.adminId);
      }

      res.json({
        success: true,
        isOnSite,
        distanceFromSite,
        message: 'Location updated',
      });
    } catch (error) {
      console.error('❌ Location update error:', error);
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

      // Check if SendGrid API key is configured
      if (!process.env.SENDGRID_API_KEY) {
        console.error('SENDGRID_API_KEY is not configured');
        return res.status(500).json({ 
          message: 'Email service is not configured. Please contact the administrator.',
          error: 'SENDGRID_API_KEY missing'
        });
      }

      // Get all employees for this admin
      let employees;
      try {
        employees = await storage.getEmployeesByAdmin(req.user!.id);
      } catch (dbError) {
        console.error('Failed to fetch employees:', dbError);
        return res.status(500).json({ 
          message: 'Failed to fetch employee data',
          error: dbError instanceof Error ? dbError.message : 'Database error'
        });
      }
      
      // Get 30-day attendance data for all employees
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      let attendanceData;
      try {
        attendanceData = await Promise.all(
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
      } catch (dataError) {
        console.error('Failed to fetch attendance data:', dataError);
        return res.status(500).json({ 
          message: 'Failed to fetch attendance data',
          error: dataError instanceof Error ? dataError.message : 'Data fetch error'
        });
      }

      // Generate report based on format
      let reportContent: string | Buffer;
      let attachments: any[] = [];
      let emailHtml = '';

      try {
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
      } catch (reportError) {
        console.error('Report generation failed:', reportError);
        return res.status(500).json({ 
          message: `Failed to generate ${format.toUpperCase()} report`,
          error: reportError instanceof Error ? reportError.message : 'Report generation error'
        });
      }
      
      // Validate email addresses
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email) || !emailRegex.test(fromEmail)) {
        return res.status(400).json({ message: 'Invalid email address format' });
      }

      // Sending attendance report

      // For SendGrid to work properly, the 'from' email should be verified
      // We'll use a safer approach with a verified sender
      let actualFromEmail = fromEmail;
      
      // If using Gmail, suggest using a verified sender to avoid spam filters
      if (fromEmail.includes('@gmail.com') || fromEmail.includes('@yahoo.com') || fromEmail.includes('@hotmail.com')) {
        console.warn(`Warning: Using ${fromEmail} as sender. For better delivery, verify this email in SendGrid.`);
      }

      // Send email
      try {
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
          res.status(500).json({ 
            message: 'Failed to send email. Please check SendGrid configuration and verify the sender email is verified in SendGrid.',
            error: 'Email sending failed'
          });
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        const errorMessage = emailError instanceof Error ? emailError.message : 'Unknown email error';
        res.status(500).json({ 
          message: 'Failed to send email. Please check SendGrid configuration.',
          error: errorMessage
        });
      }
    } catch (error) {
      console.error('Export report error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ 
        message: 'Failed to generate and send report',
        error: errorMessage
      });
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
      
      // Resending verification email
      
      
      const emailSent = await sendEmail({
        to: email,
        from: SENDGRID_FROM_EMAIL,
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
      
      // Sending verification email
      
      const emailSent = await sendEmail({
        to: validatedData.email,
        from: SENDGRID_FROM_EMAIL,
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

      // Verification email sent

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
