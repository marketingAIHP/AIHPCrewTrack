import {
  admins,
  employees,
  workSites,
  areas,
  departments,
  locationTracking,
  attendance,
  type Admin,
  type Employee,
  type WorkSite,
  type Area,
  type Department,
  type LocationTracking,
  type Attendance,
  type InsertAdmin,
  type InsertEmployee,
  type InsertWorkSite,
  type InsertArea,
  type InsertDepartment,
  type InsertLocationTracking,
  type InsertAttendance,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql } from "drizzle-orm";

export interface IStorage {
  // Admin operations
  getAdmin(id: number): Promise<Admin | undefined>;
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  getAdminByCompanyName(companyName: string): Promise<Admin | undefined>;
  checkEmailExists(email: string): Promise<boolean>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  updateAdmin(id: number, data: Partial<InsertAdmin>): Promise<Admin>;
  updateAdminPassword(id: number, hashedPassword: string): Promise<void>;
  
  // Super Admin operations
  getPendingAdmins(): Promise<Admin[]>;
  updateAdminStatus(adminId: number, isActive: boolean): Promise<Admin>;
  verifyAdminEmail(token: string): Promise<Admin | null>;
  getAdminCount(): Promise<number>;
  getSuperAdmins(): Promise<Admin[]>;

  // Employee operations
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployeeByEmail(email: string): Promise<Employee | undefined>;
  getEmployeesByAdmin(adminId: number): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;

  // Area operations
  getArea(id: number): Promise<Area | undefined>;
  getAreasByAdmin(adminId: number): Promise<Area[]>;
  createArea(area: InsertArea): Promise<Area>;
  updateArea(id: number, area: Partial<InsertArea>): Promise<Area>;
  deleteArea(id: number): Promise<void>;

  // Work site operations
  getWorkSite(id: number): Promise<WorkSite | undefined>;
  getWorkSitesByAdmin(adminId: number): Promise<WorkSite[]>;
  createWorkSite(site: InsertWorkSite): Promise<WorkSite>;
  updateWorkSite(id: number, site: Partial<InsertWorkSite>): Promise<WorkSite>;
  deleteWorkSite(id: number): Promise<void>;

  // Department operations
  getDepartment(id: number): Promise<Department | undefined>;
  getDepartmentsByAdmin(adminId: number): Promise<Department[]>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: number, department: Partial<InsertDepartment>): Promise<Department>;
  deleteDepartment(id: number): Promise<void>;
  getEmployeesByDepartment(departmentId: number): Promise<Employee[]>;

  // Location tracking operations
  createLocationTracking(location: InsertLocationTracking): Promise<LocationTracking>;
  getLatestEmployeeLocation(employeeId: number): Promise<LocationTracking | undefined>;
  getEmployeeLocationHistory(employeeId: number, date?: Date): Promise<LocationTracking[]>;
  getFirstOffsiteLocationSince(employeeId: number, since: Date): Promise<LocationTracking | undefined>;

  // Attendance operations
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: number, attendance: Partial<Attendance>): Promise<Attendance>;
  deleteAttendance(id: number, adminId: number): Promise<void>;
  getCurrentAttendance(employeeId: number): Promise<Attendance | undefined>;
  getAttendanceByAdmin(adminId: number, date?: Date): Promise<Attendance[]>;
  getEmployeeAttendanceHistory(employeeId: number, fromDate: Date): Promise<Attendance[]>;
  getRecentActivities(adminId: number, days?: number): Promise<any[]>;

  // Dashboard stats
  getDashboardStats(adminId: number): Promise<{
    activeEmployees: number;
    workSites: number;
    onSiteNow: number;
    alerts: number;
  }>;
  
  // Alerts
  getAlerts(adminId: number): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // Admin operations
  async getAdmin(id: number): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.id, id));
    return admin || undefined;
  }

  async updateAdmin(id: number, data: Partial<InsertAdmin>): Promise<Admin> {
    const [admin] = await db
      .update(admins)
      .set(data)
      .where(eq(admins.id, id))
      .returning();
    return admin;
  }

  async updateAdminPassword(id: number, hashedPassword: string): Promise<void> {
    await db
      .update(admins)
      .set({ password: hashedPassword })
      .where(eq(admins.id, id));
  }

  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.email, email));
    return admin || undefined;
  }

  async getAdminByCompanyName(companyName: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.companyName, companyName));
    return admin || undefined;
  }

  async checkEmailExists(email: string): Promise<boolean> {
    // Check if email exists in admins table
    const [adminResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(admins)
      .where(eq(admins.email, email));
    
    // Check if email exists in employees table
    const [employeeResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(employees)
      .where(eq(employees.email, email));
    
    return adminResult.count > 0 || employeeResult.count > 0;
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const [newAdmin] = await db.insert(admins).values(admin).returning();
    return newAdmin;
  }

  async getAdminCount(): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(admins);
    return result.count;
  }

  async getSuperAdmins(): Promise<Admin[]> {
    return db
      .select()
      .from(admins)
      .where(eq(admins.role, 'super_admin'));
  }

  // Super Admin operations
  async getPendingAdmins(): Promise<Admin[]> {
    return db
      .select()
      .from(admins)
      .where(and(eq(admins.isVerified, true), eq(admins.isActive, false)))
      .orderBy(admins.createdAt);
  }

  async updateAdminStatus(adminId: number, isActive: boolean): Promise<Admin> {
    const [updatedAdmin] = await db
      .update(admins)
      .set({ isActive })
      .where(eq(admins.id, adminId))
      .returning();
    return updatedAdmin;
  }

  async verifyAdminEmail(token: string): Promise<Admin | null> {
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.verificationToken, token));
    
    if (!admin) return null;

    // Mark as verified
    const [verifiedAdmin] = await db
      .update(admins)
      .set({ 
        isVerified: true, 
        verificationToken: null 
      })
      .where(eq(admins.id, admin.id))
      .returning();

    return verifiedAdmin;
  }

  // Employee operations
  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee || undefined;
  }

  async getEmployeeByEmail(email: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.email, email));
    return employee || undefined;
  }

  async getEmployeesByAdmin(adminId: number): Promise<any[]> {
    return db
      .select({
        id: employees.id,
        firstName: employees.firstName,
        lastName: employees.lastName,
        email: employees.email,
        phone: employees.phone,
        adminId: employees.adminId,
        siteId: employees.siteId,
        departmentId: employees.departmentId,
        profileImage: employees.profileImage,
        isActive: employees.isActive,
        createdAt: employees.createdAt,
        siteName: workSites.name,
        departmentName: departments.name,
      })
      .from(employees)
      .leftJoin(workSites, eq(employees.siteId, workSites.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(eq(employees.adminId, adminId))
      .orderBy(employees.firstName, employees.lastName);
  }

  async createEmployee(employee: InsertEmployee): Promise<Employee> {
    const [newEmployee] = await db.insert(employees).values(employee).returning();
    return newEmployee;
  }

  async updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee> {
    const [updatedEmployee] = await db
      .update(employees)
      .set(employee)
      .where(eq(employees.id, id))
      .returning();
    return updatedEmployee;
  }

  async deleteEmployee(id: number): Promise<void> {
    await db.delete(employees).where(eq(employees.id, id));
  }

  // Area operations
  async getArea(id: number): Promise<Area | undefined> {
    const [area] = await db.select().from(areas).where(eq(areas.id, id));
    return area || undefined;
  }

  async getAreasByAdmin(adminId: number): Promise<Area[]> {
    return db
      .select()
      .from(areas)
      .where(and(eq(areas.adminId, adminId), eq(areas.isActive, true)))
      .orderBy(areas.name);
  }

  async createArea(area: InsertArea): Promise<Area> {
    const [newArea] = await db.insert(areas).values(area).returning();
    return newArea;
  }

  async updateArea(id: number, area: Partial<InsertArea>): Promise<Area> {
    const [updatedArea] = await db
      .update(areas)
      .set(area)
      .where(eq(areas.id, id))
      .returning();
    return updatedArea;
  }

  async deleteArea(id: number): Promise<void> {
    await db.delete(areas).where(eq(areas.id, id));
  }

  // Work site operations
  async getWorkSite(id: number): Promise<WorkSite | undefined> {
    const [site] = await db.select().from(workSites).where(eq(workSites.id, id));
    return site || undefined;
  }

  async getWorkSitesByAdmin(adminId: number): Promise<WorkSite[]> {
    return db.select().from(workSites).where(eq(workSites.adminId, adminId));
  }

  async createWorkSite(site: InsertWorkSite): Promise<WorkSite> {
    const [newSite] = await db.insert(workSites).values(site).returning();
    return newSite;
  }

  async updateWorkSite(id: number, site: Partial<InsertWorkSite>): Promise<WorkSite> {
    const [updatedSite] = await db
      .update(workSites)
      .set(site)
      .where(eq(workSites.id, id))
      .returning();
    return updatedSite;
  }

  async deleteWorkSite(id: number): Promise<void> {
    await db.delete(workSites).where(eq(workSites.id, id));
  }

  // Department operations
  async getDepartment(id: number): Promise<Department | undefined> {
    const [department] = await db.select().from(departments).where(eq(departments.id, id));
    return department || undefined;
  }

  async getDepartmentsByAdmin(adminId: number): Promise<Department[]> {
    return db
      .select()
      .from(departments)
      .where(and(eq(departments.adminId, adminId), eq(departments.isActive, true)))
      .orderBy(departments.name);
  }

  async createDepartment(department: InsertDepartment): Promise<Department> {
    const [newDepartment] = await db.insert(departments).values(department).returning();
    return newDepartment;
  }

  async updateDepartment(id: number, department: Partial<InsertDepartment>): Promise<Department> {
    const [updatedDepartment] = await db
      .update(departments)
      .set(department)
      .where(eq(departments.id, id))
      .returning();
    return updatedDepartment;
  }

  async deleteDepartment(id: number): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  async getEmployeesByDepartment(departmentId: number): Promise<Employee[]> {
    return db
      .select()
      .from(employees)
      .where(eq(employees.departmentId, departmentId));
  }

  // Location tracking operations
  async createLocationTracking(location: InsertLocationTracking): Promise<LocationTracking> {
    const [newLocation] = await db.insert(locationTracking).values(location).returning();
    return newLocation;
  }

  async getLatestEmployeeLocation(employeeId: number): Promise<LocationTracking | undefined> {
    const [location] = await db
      .select()
      .from(locationTracking)
      .where(eq(locationTracking.employeeId, employeeId))
      .orderBy(desc(locationTracking.timestamp))
      .limit(1);
    return location || undefined;
  }

  async getEmployeeLocationHistory(employeeId: number, date?: Date): Promise<LocationTracking[]> {
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return db
        .select()
        .from(locationTracking)
        .where(
          and(
            eq(locationTracking.employeeId, employeeId),
            sql`${locationTracking.timestamp} >= ${startOfDay}`,
            sql`${locationTracking.timestamp} <= ${endOfDay}`
          )
        )
        .orderBy(desc(locationTracking.timestamp));
    }

    return db
      .select()
      .from(locationTracking)
      .where(eq(locationTracking.employeeId, employeeId))
      .orderBy(desc(locationTracking.timestamp));
  }

  async getFirstOffsiteLocationSince(employeeId: number, since: Date): Promise<LocationTracking | undefined> {
    const [record] = await db
      .select()
      .from(locationTracking)
      .where(
        and(
          eq(locationTracking.employeeId, employeeId),
          eq(locationTracking.isOnSite, false),
          sql`${locationTracking.timestamp} >= ${since}`
        )
      )
      .orderBy(asc(locationTracking.timestamp))
      .limit(1);
    return record || undefined;
  }

  // Attendance operations
  async createAttendance(attendanceData: InsertAttendance): Promise<Attendance> {
    const [newAttendance] = await db.insert(attendance).values(attendanceData).returning();
    return newAttendance;
  }

  async updateAttendance(id: number, attendanceData: Partial<InsertAttendance>): Promise<Attendance> {
    const [updatedAttendance] = await db
      .update(attendance)
      .set(attendanceData)
      .where(eq(attendance.id, id))
      .returning();
    return updatedAttendance;
  }

  async deleteAttendance(id: number, adminId: number): Promise<void> {
    // Verify that the attendance record belongs to an employee of this admin
    const [attendanceRecord] = await db
      .select({
        attendanceId: attendance.id,
        employeeAdminId: employees.adminId,
      })
      .from(attendance)
      .innerJoin(employees, eq(attendance.employeeId, employees.id))
      .where(eq(attendance.id, id))
      .limit(1);

    if (!attendanceRecord) {
      throw new Error('Attendance record not found');
    }

    if (attendanceRecord.employeeAdminId !== adminId) {
      throw new Error('Unauthorized: Attendance record does not belong to your employees');
    }

    // Delete the attendance record
    await db
      .delete(attendance)
      .where(eq(attendance.id, id));
  }

  async getCurrentAttendance(employeeId: number): Promise<Attendance | undefined> {
    const [currentAttendance] = await db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.employeeId, employeeId),
          sql`${attendance.checkOutTime} IS NULL`
        )
      )
      .orderBy(desc(attendance.checkInTime))
      .limit(1);
    return currentAttendance || undefined;
  }



  async getAttendanceByAdmin(adminId: number, date?: Date): Promise<Attendance[]> {
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return db
        .select({
          id: attendance.id,
          employeeId: attendance.employeeId,
          siteId: attendance.siteId,
          checkInTime: attendance.checkInTime,
          checkOutTime: attendance.checkOutTime,
          checkInLatitude: attendance.checkInLatitude,
          checkInLongitude: attendance.checkInLongitude,
          checkOutLatitude: attendance.checkOutLatitude,
          checkOutLongitude: attendance.checkOutLongitude,
        })
        .from(attendance)
        .innerJoin(employees, eq(attendance.employeeId, employees.id))
        .where(
          and(
            eq(employees.adminId, adminId),
            sql`${attendance.checkInTime} >= ${startOfDay}`,
            sql`${attendance.checkInTime} <= ${endOfDay}`
          )
        )
        .orderBy(desc(attendance.checkInTime));
    }

    return db
      .select({
        id: attendance.id,
        employeeId: attendance.employeeId,
        siteId: attendance.siteId,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        checkInLatitude: attendance.checkInLatitude,
        checkInLongitude: attendance.checkInLongitude,
        checkOutLatitude: attendance.checkOutLatitude,
        checkOutLongitude: attendance.checkOutLongitude,
      })
      .from(attendance)
      .innerJoin(employees, eq(attendance.employeeId, employees.id))
      .where(eq(employees.adminId, adminId))
      .orderBy(desc(attendance.checkInTime));
  }

  async getEmployeeAttendanceHistory(employeeId: number, fromDate: Date): Promise<Attendance[]> {
    return db
      .select()
      .from(attendance)
      .where(
        and(
          eq(attendance.employeeId, employeeId),
          sql`${attendance.checkInTime} >= ${fromDate}`
        )
      )
      .orderBy(desc(attendance.checkInTime));
  }

  async getRecentActivities(adminId: number, days: number = 7): Promise<any[]> {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);
    fromDate.setHours(0, 0, 0, 0);

    const activities = await db
      .select({
        id: attendance.id,
        employeeId: attendance.employeeId,
        siteId: attendance.siteId,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName,
        employeeProfileImage: employees.profileImage,
        employeeEmail: employees.email,
        siteName: workSites.name,
      })
      .from(attendance)
      .innerJoin(employees, eq(attendance.employeeId, employees.id))
      .innerJoin(workSites, eq(attendance.siteId, workSites.id))
      .where(
        and(
          eq(employees.adminId, adminId),
          sql`${attendance.checkInTime} >= ${fromDate}`
        )
      )
      .orderBy(desc(attendance.checkInTime))
      .limit(20);

    // Process activities to include both check-ins and check-outs
    const processedActivities: any[] = [];
    
    activities.forEach((record) => {
      // Add check-in activity
      processedActivities.push({
        id: `${record.id}-checkin`,
        type: 'check-in',
        timestamp: record.checkInTime,
        employee: {
          id: record.employeeId,
          firstName: record.employeeFirstName,
          lastName: record.employeeLastName,
          profileImage: record.employeeProfileImage,
          email: record.employeeEmail,
        },
        site: {
          id: record.siteId,
          name: record.siteName,
        },
      });

      // Add check-out activity if exists
      if (record.checkOutTime) {
        processedActivities.push({
          id: `${record.id}-checkout`,
          type: 'check-out',
          timestamp: record.checkOutTime,
          employee: {
            id: record.employeeId,
            firstName: record.employeeFirstName,
            lastName: record.employeeLastName,
            profileImage: record.employeeProfileImage,
            email: record.employeeEmail,
          },
          site: {
            id: record.siteId,
            name: record.siteName,
          },
        });
      }
    });

    // Sort by timestamp descending
    processedActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return processedActivities.slice(0, 15); // Return top 15 activities
  }

  async getDashboardStats(adminId: number): Promise<{
    activeEmployees: number;
    workSites: number;
    onSiteNow: number;
    alerts: number;
  }> {
    // Get active employees count
    const [activeEmployeesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(employees)
      .where(and(eq(employees.adminId, adminId), eq(employees.isActive, true)));

    // Get work sites count
    const [workSitesResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(workSites)
      .where(and(eq(workSites.adminId, adminId), eq(workSites.isActive, true)));

    // Get employees currently on site
    const [onSiteResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(attendance)
      .innerJoin(employees, eq(attendance.employeeId, employees.id))
      .where(
        and(
          eq(employees.adminId, adminId),
          sql`${attendance.checkOutTime} IS NULL`
        )
      );

    // Calculate alerts count
    const alerts = await this.getAlerts(adminId);
    
    return {
      activeEmployees: activeEmployeesResult.count,
      workSites: workSitesResult.count,
      onSiteNow: onSiteResult.count,
      alerts: alerts.length,
    };
  }
  
  async getAlerts(adminId: number): Promise<any[]> {
    const alerts: any[] = [];
    
    // Helper function to calculate distance
    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371000; // Earth radius in meters
      const phi1 = lat1 * Math.PI / 180;
      const phi2 = lat2 * Math.PI / 180;
      const deltaPhi = (lat2 - lat1) * Math.PI / 180;
      const deltaLambda = (lon2 - lon1) * Math.PI / 180;
      
      const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                Math.cos(phi1) * Math.cos(phi2) *
                Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      
      return R * c; // Distance in meters
    };
    
    // GPS accuracy buffer to account for mobile GPS inaccuracies
    // FIX: Increased to 50m to match server-side buffer for consistency
    const GPS_ACCURACY_BUFFER = 50; // meters - increased from 15m for better reliability
    
    // Helper function to check if within geofence with GPS buffer
    const isWithinGeofenceWithBuffer = (distance: number, geofenceRadius: number): boolean => {
      return distance <= (geofenceRadius + GPS_ACCURACY_BUFFER);
    };
    
    // Get all employees for this admin
    const employees = await this.getEmployeesByAdmin(adminId);
    
    // Check for employees who are checked in but out of range
    // Skip remote employees - they can work from anywhere
    for (const employee of employees) {
      if (employee.isRemote || !employee.siteId || !employee.isActive) continue;
      
      const currentAttendance = await this.getCurrentAttendance(employee.id);
      if (!currentAttendance || currentAttendance.checkOutTime) continue;
      
      // Get the latest location
      const latestLocation = await this.getLatestEmployeeLocation(employee.id);
      if (!latestLocation) continue;
      
      const site = await this.getWorkSite(employee.siteId);
      if (!site) continue;
      
      // Skip geofence alerts for remote work sites - they can work from anywhere
      if (site.isRemote) continue;
      
      // Check if employee is out of range
      const distance = calculateDistance(
        parseFloat(latestLocation.latitude),
        parseFloat(latestLocation.longitude),
        parseFloat(site.latitude),
        parseFloat(site.longitude)
      );
      
      // Check if employee is out of range using GPS accuracy buffer
      const effectiveRadius = site.geofenceRadius + GPS_ACCURACY_BUFFER;
      if (distance > effectiveRadius) {
        alerts.push({
          id: `out-of-range-${employee.id}`,
          type: 'out_of_range',
          title: 'Employee Out of Range',
          message: `${employee.firstName} ${employee.lastName} is ${Math.round(distance)}m away from ${site.name} (radius: ${site.geofenceRadius}m)`,
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
          timestamp: latestLocation.timestamp,
          distance: Math.round(distance),
          geofenceRadius: site.geofenceRadius
        });
      }
      
      // Check for employees who left without checkout (checked in more than 8 hours ago without checkout)
      const checkInTime = new Date(currentAttendance.checkInTime);
      const hoursSinceCheckIn = (Date.now() - checkInTime.getTime()) / (1000 * 60 * 60);
      
      // If checked in more than 8 hours ago and no checkout, flag as alert
      if (hoursSinceCheckIn > 8) {
        // Check if there's a recent location (within last hour) but no checkout
        const locationAge = latestLocation ? (Date.now() - new Date(latestLocation.timestamp).getTime()) / (1000 * 60 * 60) : 24;
        
        if (locationAge > 1) { // No location update in last hour
          alerts.push({
            id: `no-checkout-${employee.id}`,
            type: 'no_checkout',
            title: 'Employee Left Without Checkout',
            message: `${employee.firstName} ${employee.lastName} checked in ${Math.round(hoursSinceCheckIn)} hours ago but hasn't checked out`,
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
            timestamp: checkInTime.toISOString(),
            hoursSinceCheckIn: Math.round(hoursSinceCheckIn)
          });
        }
      }
    }
    
    // Sort by timestamp (newest first)
    alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return alerts;
  }
}

export const storage = new DatabaseStorage();
