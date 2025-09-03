import { pgTable, text, serial, integer, boolean, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Admin users table
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  companyName: text("company_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  profileImage: text("profile_image"),
  role: text("role").notNull().default("admin"), // "super_admin" or "admin"
  isVerified: boolean("is_verified").default(false), // Email verification status
  verificationToken: text("verification_token"), // For email verification
  isActive: boolean("is_active").default(false), // Activated by super admin
  createdAt: timestamp("created_at").defaultNow(),
});

// Labor employees table
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id"), // Custom employee ID (like "EMP001") - made optional to avoid conflicts
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address"), // Added for employee profile updates
  password: text("password").notNull(),
  adminId: integer("admin_id").notNull().references(() => admins.id),
  siteId: integer("site_id").references(() => workSites.id),
  departmentId: integer("department_id").references(() => departments.id),
  profileImage: text("profile_image"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Departments table
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  adminId: integer("admin_id").notNull().references(() => admins.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Areas table for organizing work sites
export const areas = pgTable("areas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  adminId: integer("admin_id").notNull().references(() => admins.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Work sites table
export const workSites = pgTable("work_sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  geofenceRadius: integer("geofence_radius").notNull().default(200), // in meters
  siteImage: text("site_image"), // URL to site image in object storage
  areaId: integer("area_id").references(() => areas.id),
  adminId: integer("admin_id").notNull().references(() => admins.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Location tracking table
export const locationTracking = pgTable("location_tracking", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  latitude: decimal("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: decimal("longitude", { precision: 11, scale: 8 }).notNull(),
  isOnSite: boolean("is_on_site").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Attendance tracking table
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id),
  siteId: integer("site_id").notNull().references(() => workSites.id),
  checkInTime: timestamp("check_in_time").defaultNow(),
  checkOutTime: timestamp("check_out_time"),
  checkInLatitude: decimal("check_in_latitude", { precision: 10, scale: 8 }),
  checkInLongitude: decimal("check_in_longitude", { precision: 11, scale: 8 }),
  checkOutLatitude: decimal("check_out_latitude", { precision: 10, scale: 8 }),
  checkOutLongitude: decimal("check_out_longitude", { precision: 11, scale: 8 }),
});

// Relations
export const adminsRelations = relations(admins, ({ many }) => ({
  employees: many(employees),
  workSites: many(workSites),
  departments: many(departments),
  areas: many(areas),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  admin: one(admins, {
    fields: [employees.adminId],
    references: [admins.id],
  }),
  assignedSite: one(workSites, {
    fields: [employees.siteId],
    references: [workSites.id],
  }),
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  locationHistory: many(locationTracking),
  attendanceHistory: many(attendance),
}));

export const areasRelations = relations(areas, ({ one, many }) => ({
  admin: one(admins, {
    fields: [areas.adminId],
    references: [admins.id],
  }),
  workSites: many(workSites),
}));

export const workSitesRelations = relations(workSites, ({ one, many }) => ({
  admin: one(admins, {
    fields: [workSites.adminId],
    references: [admins.id],
  }),
  area: one(areas, {
    fields: [workSites.areaId],
    references: [areas.id],
  }),
  assignedEmployees: many(employees),
  attendanceRecords: many(attendance),
}));

export const locationTrackingRelations = relations(locationTracking, ({ one }) => ({
  employee: one(employees, {
    fields: [locationTracking.employeeId],
    references: [employees.id],
  }),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  admin: one(admins, {
    fields: [departments.adminId],
    references: [admins.id],
  }),
  employees: many(employees),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  employee: one(employees, {
    fields: [attendance.employeeId],
    references: [employees.id],
  }),
  site: one(workSites, {
    fields: [attendance.siteId],
    references: [workSites.id],
  }),
}));

// Password validation schema
const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters long")
  .regex(/^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
    "Password must contain at least one letter, one number, and one special character");

// Insert schemas with password validation
export const insertAdminSchema = createInsertSchema(admins).omit({ 
  id: true, 
  createdAt: true 
}).extend({
  password: passwordSchema,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({ 
  id: true, 
  createdAt: true, 
  isActive: true 
}).extend({
  password: passwordSchema,
  departmentId: z.union([z.string(), z.number()]).optional(),
  phone: z.string().optional(),
});

// Employee profile update schema (limited fields for employees)
export const updateEmployeeProfileSchema = z.object({
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  address: z.string().optional(),
  profileImage: z.string().optional(),
});

// Admin verification schema
export const adminVerificationSchema = z.object({
  token: z.string(),
});

// Super admin schemas for managing regular admins
export const adminActivationSchema = z.object({
  adminId: z.number(),
  isActive: z.boolean(),
});

export const insertWorkSiteSchema = createInsertSchema(workSites).omit({ id: true, createdAt: true, isActive: true }).extend({
  latitude: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? val : val.toString()),
  longitude: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? val : val.toString()),
  geofenceRadius: z.union([z.string(), z.number()]).transform(val => typeof val === 'string' ? parseInt(val) : val),
  areaId: z.union([z.string(), z.number(), z.null()]).transform(val => val === null || val === 'none' ? null : typeof val === 'string' ? (val === 'none' ? null : parseInt(val)) : val).optional(),
});
export const insertAreaSchema = createInsertSchema(areas).omit({ id: true, createdAt: true, isActive: true });
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true, isActive: true });
export const insertLocationTrackingSchema = createInsertSchema(locationTracking).omit({ id: true, timestamp: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, checkInTime: true });

// Types
export type Admin = typeof admins.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type WorkSite = typeof workSites.$inferSelect;
export type Area = typeof areas.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type LocationTracking = typeof locationTracking.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;

export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type InsertWorkSite = z.infer<typeof insertWorkSiteSchema>;
export type InsertArea = z.infer<typeof insertAreaSchema>;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type InsertLocationTracking = z.infer<typeof insertLocationTrackingSchema>;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;

// Auth schemas
export const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const employeeLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type AdminLogin = z.infer<typeof adminLoginSchema>;
export type EmployeeLogin = z.infer<typeof employeeLoginSchema>;
export type UpdateEmployeeProfile = z.infer<typeof updateEmployeeProfileSchema>;
export type AdminVerification = z.infer<typeof adminVerificationSchema>;
export type AdminActivation = z.infer<typeof adminActivationSchema>;
