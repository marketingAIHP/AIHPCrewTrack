import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
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

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

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

  const httpServer = createServer(app);
  
  // WebSocket server for real-time location updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store active WebSocket connections
  const adminConnections = new Map<number, WebSocket>();
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
        adminConnections.set(decoded.id, ws);
      } else if (decoded.type === 'employee') {
        employeeConnections.set(decoded.id, ws);
      }

      ws.on('close', () => {
        if (decoded.type === 'admin') {
          adminConnections.delete(decoded.id);
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
                const adminWs = adminConnections.get(employee.adminId);
                if (adminWs && adminWs.readyState === WebSocket.OPEN) {
                  adminWs.send(JSON.stringify({
                    type: 'employee_location',
                    employeeId: decoded.id,
                    latitude,
                    longitude,
                    isOnSite,
                    timestamp: new Date().toISOString(),
                  }));
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

  // Admin Authentication Routes
  app.post('/api/admin/signup', async (req, res) => {
    try {
      const validatedData = insertAdminSchema.parse(req.body);
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
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch dashboard stats' });
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

  app.post('/api/admin/employees', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      console.log('Employee creation request body:', JSON.stringify(req.body, null, 2));
      const validatedData = insertEmployeeSchema.parse(req.body);
      console.log('Validated data:', JSON.stringify(validatedData, null, 2));
      const hashedPassword = await bcrypt.hash(validatedData.password, 10);
      
      const employee = await storage.createEmployee({
        ...validatedData,
        password: hashedPassword,
        adminId: req.user!.id,
      });

      res.status(201).json(employee);
    } catch (error) {
      console.error('Employee creation error:', error);
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
      const validatedData = insertWorkSiteSchema.parse(req.body);
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

  // Location Tracking Routes
  app.get('/api/admin/locations', authenticateToken('admin'), async (req: AuthenticatedRequest, res) => {
    try {
      const employees = await storage.getEmployeesByAdmin(req.user!.id);
      const locations = await Promise.all(
        employees.map(async (employee) => {
          const location = await storage.getLatestEmployeeLocation(employee.id);
          return {
            employee,
            location,
          };
        })
      );
      
      res.json(locations);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch employee locations' });
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

  return httpServer;
}
