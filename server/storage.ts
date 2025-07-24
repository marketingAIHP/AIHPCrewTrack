import {
  admins,
  employees,
  workSites,
  locationTracking,
  attendance,
  type Admin,
  type Employee,
  type WorkSite,
  type LocationTracking,
  type Attendance,
  type InsertAdmin,
  type InsertEmployee,
  type InsertWorkSite,
  type InsertLocationTracking,
  type InsertAttendance,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // Admin operations
  getAdmin(id: number): Promise<Admin | undefined>;
  getAdminByEmail(email: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;

  // Employee operations
  getEmployee(id: number): Promise<Employee | undefined>;
  getEmployeeByEmail(email: string): Promise<Employee | undefined>;
  getEmployeesByAdmin(adminId: number): Promise<Employee[]>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: number): Promise<void>;

  // Work site operations
  getWorkSite(id: number): Promise<WorkSite | undefined>;
  getWorkSitesByAdmin(adminId: number): Promise<WorkSite[]>;
  createWorkSite(site: InsertWorkSite): Promise<WorkSite>;
  updateWorkSite(id: number, site: Partial<InsertWorkSite>): Promise<WorkSite>;
  deleteWorkSite(id: number): Promise<void>;

  // Location tracking operations
  createLocationTracking(location: InsertLocationTracking): Promise<LocationTracking>;
  getLatestEmployeeLocation(employeeId: number): Promise<LocationTracking | undefined>;
  getEmployeeLocationHistory(employeeId: number, date?: Date): Promise<LocationTracking[]>;

  // Attendance operations
  createAttendance(attendance: InsertAttendance): Promise<Attendance>;
  updateAttendance(id: number, attendance: Partial<Attendance>): Promise<Attendance>;
  getCurrentAttendance(employeeId: number): Promise<Attendance | undefined>;
  getAttendanceByAdmin(adminId: number, date?: Date): Promise<Attendance[]>;

  // Dashboard stats
  getDashboardStats(adminId: number): Promise<{
    activeEmployees: number;
    workSites: number;
    onSiteNow: number;
    alerts: number;
  }>;
}

export class DatabaseStorage implements IStorage {
  // Admin operations
  async getAdmin(id: number): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.id, id));
    return admin || undefined;
  }

  async getAdminByEmail(email: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.email, email));
    return admin || undefined;
  }

  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const [newAdmin] = await db.insert(admins).values(admin).returning();
    return newAdmin;
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

  async getEmployeesByAdmin(adminId: number): Promise<Employee[]> {
    return db.select().from(employees).where(eq(employees.adminId, adminId));
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

    return {
      activeEmployees: activeEmployeesResult.count,
      workSites: workSitesResult.count,
      onSiteNow: onSiteResult.count,
      alerts: 0, // Placeholder for alert system
    };
  }
}

export const storage = new DatabaseStorage();
