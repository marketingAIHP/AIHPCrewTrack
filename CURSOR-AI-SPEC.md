# AIHP CrewTrack - Complete Application Specification for Cursor AI

## Executive Summary
AIHP CrewTrack is a production-ready full-stack workforce management system with real-time GPS tracking, geofence-based attendance, hierarchical work site organization, and comprehensive employee management. Built with React, TypeScript, Express, and PostgreSQL.

---

## Technology Stack

### Frontend
- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite 5.4.19
- **Routing**: Wouter 3.3.5
- **State Management**: TanStack React Query 5.60.5
- **Styling**: Tailwind CSS 3.4.17 + shadcn/ui components
- **Forms**: React Hook Form 7.55.0 + Zod validation
- **Maps**: Google Maps JavaScript API
- **Icons**: Lucide React 0.453.0

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express 4.21.2
- **Database**: PostgreSQL (Neon serverless)
- **ORM**: Drizzle ORM 0.39.1
- **Authentication**: JWT (jsonwebtoken 9.0.2) + bcrypt 6.0.0
- **Real-time**: WebSockets (ws 8.18.0)
- **Email**: SendGrid (@sendgrid/mail 8.1.5)
- **Image Processing**: Sharp 0.34.3
- **Storage**: Google Cloud Storage 7.16.0

### Development Tools
- **TypeScript**: 5.6.3
- **ESBuild**: 0.25.0 (for backend bundling)
- **TSX**: 4.19.1 (for development)
- **Drizzle Kit**: 0.30.4 (for migrations)

---

## Project Structure

```
aihp-crewtrack/
├── client/                          # Frontend React application
│   ├── public/                      # Static assets
│   │   ├── logo-192.png            # PWA app icon 192x192
│   │   ├── logo-512.png            # PWA app icon 512x512
│   │   ├── favicon-16x16.png       # Browser favicon 16x16
│   │   ├── favicon-32x32.png       # Browser favicon 32x32
│   │   ├── apple-touch-icon.png    # iOS home screen icon
│   │   └── manifest.json           # PWA manifest
│   ├── src/
│   │   ├── components/             # Reusable UI components
│   │   │   └── ui/                 # shadcn/ui components
│   │   ├── hooks/                  # Custom React hooks
│   │   ├── lib/                    # Utilities and helpers
│   │   │   ├── queryClient.ts     # TanStack Query configuration
│   │   │   └── utils.ts           # General utilities
│   │   ├── pages/                  # Page components
│   │   │   ├── admin-login.tsx    # Admin login page
│   │   │   ├── employee-login.tsx # Employee login page
│   │   │   ├── admin-dashboard.tsx# Admin dashboard
│   │   │   └── employee-portal.tsx# Employee portal
│   │   ├── App.tsx                 # Main app with routing
│   │   ├── main.tsx               # React entry point
│   │   └── index.css              # Global styles + Tailwind
│   └── index.html                  # HTML template
├── server/                          # Backend Express application
│   ├── routes.ts                   # API routes
│   ├── storage.ts                  # Database interface + implementation
│   ├── index.ts                    # Server entry point
│   └── vite.ts                     # Vite dev server integration
├── shared/                          # Shared types and schemas
│   └── schema.ts                   # Drizzle database schema + Zod validation
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── vite.config.ts                  # Vite build configuration
├── tailwind.config.ts              # Tailwind CSS configuration
├── drizzle.config.ts               # Drizzle ORM configuration
└── render.yaml                     # Render deployment configuration
```

---

## Database Schema (PostgreSQL with Drizzle ORM)

### Tables Overview
1. **admins** - Administrator accounts
2. **employees** - Employee records
3. **work_sites** - Individual work locations
4. **areas** - Hierarchical grouping of work sites
5. **location_updates** - GPS tracking history
6. **attendance_records** - Check-in/check-out records
7. **notifications** - Admin notification queue

### Complete Schema Definition

```typescript
// File: shared/schema.ts

import { pgTable, text, serial, timestamp, boolean, doublePrecision, integer, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ADMINS TABLE
export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  organization: text("organization").notNull().unique(),
  profileImage: text("profile_image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertAdminSchema = createInsertSchema(admins).omit({
  id: true,
  createdAt: true,
});
export type InsertAdmin = z.infer<typeof insertAdminSchema>;
export type Admin = typeof admins.$inferSelect;

// AREAS TABLE (Hierarchical organization)
export const areas = pgTable("areas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  adminId: integer("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const areasRelations = relations(areas, ({ one, many }) => ({
  admin: one(admins, {
    fields: [areas.adminId],
    references: [admins.id],
  }),
  workSites: many(workSites),
}));

export const insertAreaSchema = createInsertSchema(areas).omit({
  id: true,
  createdAt: true,
});
export type InsertArea = z.infer<typeof insertAreaSchema>;
export type Area = typeof areas.$inferSelect;

// WORK SITES TABLE
export const workSites = pgTable("work_sites", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  geofenceRadius: doublePrecision("geofence_radius").notNull().default(100), // meters
  adminId: integer("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
  areaId: integer("area_id").references(() => areas.id, { onDelete: "set null" }),
  siteImage: text("site_image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const workSitesRelations = relations(workSites, ({ one, many }) => ({
  admin: one(admins, {
    fields: [workSites.adminId],
    references: [admins.id],
  }),
  area: one(areas, {
    fields: [workSites.areaId],
    references: [areas.id],
  }),
  employees: many(employees),
  attendanceRecords: many(attendanceRecords),
}));

export const insertWorkSiteSchema = createInsertSchema(workSites).omit({
  id: true,
  createdAt: true,
});
export type InsertWorkSite = z.infer<typeof insertWorkSiteSchema>;
export type WorkSite = typeof workSites.$inferSelect;

// EMPLOYEES TABLE
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  position: text("position"),
  adminId: integer("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
  workSiteId: integer("work_site_id").references(() => workSites.id, { onDelete: "set null" }),
  profileImage: text("profile_image"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const employeesRelations = relations(employees, ({ one, many }) => ({
  admin: one(admins, {
    fields: [employees.adminId],
    references: [admins.id],
  }),
  workSite: one(workSites, {
    fields: [employees.workSiteId],
    references: [workSites.id],
  }),
  locationUpdates: many(locationUpdates),
  attendanceRecords: many(attendanceRecords),
}));

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
  createdAt: true,
  isActive: true,
});
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employees.$inferSelect;

// LOCATION UPDATES TABLE
export const locationUpdates = pgTable("location_updates", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  accuracy: doublePrecision("accuracy"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const locationUpdatesRelations = relations(locationUpdates, ({ one }) => ({
  employee: one(employees, {
    fields: [locationUpdates.employeeId],
    references: [employees.id],
  }),
}));

export const insertLocationUpdateSchema = createInsertSchema(locationUpdates).omit({
  id: true,
  timestamp: true,
});
export type InsertLocationUpdate = z.infer<typeof insertLocationUpdateSchema>;
export type LocationUpdate = typeof locationUpdates.$inferSelect;

// ATTENDANCE RECORDS TABLE
export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
  workSiteId: integer("work_site_id").notNull().references(() => workSites.id, { onDelete: "cascade" }),
  checkIn: timestamp("check_in").notNull(),
  checkOut: timestamp("check_out"),
  checkInLatitude: doublePrecision("check_in_latitude").notNull(),
  checkInLongitude: doublePrecision("check_in_longitude").notNull(),
  checkOutLatitude: doublePrecision("check_out_latitude"),
  checkOutLongitude: doublePrecision("check_out_longitude"),
});

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  employee: one(employees, {
    fields: [attendanceRecords.employeeId],
    references: [employees.id],
  }),
  workSite: one(workSites, {
    fields: [attendanceRecords.workSiteId],
    references: [workSites.id],
  }),
}));

export const insertAttendanceRecordSchema = createInsertSchema(attendanceRecords).omit({
  id: true,
});
export type InsertAttendanceRecord = z.infer<typeof insertAttendanceRecordSchema>;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;

// NOTIFICATIONS TABLE
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  adminId: integer("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'check_in', 'check_out', 'alert'
  message: text("message").notNull(),
  employeeId: integer("employee_id").references(() => employees.id, { onDelete: "cascade" }),
  workSiteId: integer("work_site_id").references(() => workSites.id, { onDelete: "set null" }),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  admin: one(admins, {
    fields: [notifications.adminId],
    references: [admins.id],
  }),
  employee: one(employees, {
    fields: [notifications.employeeId],
    references: [employees.id],
  }),
  workSite: one(workSites, {
    fields: [notifications.workSiteId],
    references: [workSites.id],
  }),
}));

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  isRead: true,
});
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;
```

---

## Core Features Implementation

### 1. Authentication System

**Location**: `server/routes.ts`

```typescript
// Admin Login
POST /api/admin/login
Body: { email: string, password: string }
Response: { admin: Admin, token: string }

// Employee Login  
POST /api/employee/login
Body: { email: string, password: string }
Response: { employee: Employee, token: string }

// Validation: Geofence check for employees
// Uses bcrypt for password comparison
// Returns JWT token for session management
```

**JWT Configuration**:
- Secret: Auto-generated or from `JWT_SECRET` env var
- Expiration: 7 days
- Payload: `{ userId, userType: 'admin' | 'employee' }`

### 2. Real-time Location Tracking

**Frontend Implementation** (`client/src/pages/employee-portal.tsx`):
```typescript
// Browser Geolocation API
navigator.geolocation.watchPosition((position) => {
  const { latitude, longitude, accuracy } = position.coords;
  
  // Send to server via API
  fetch('/api/location/update', {
    method: 'POST',
    body: JSON.stringify({ employeeId, latitude, longitude, accuracy })
  });
}, {
  enableHighAccuracy: true,
  timeout: 5000,
  maximumAge: 0
});

// Update interval: Every 60 seconds
```

**Backend** (`server/routes.ts`):
```typescript
POST /api/location/update
Body: { employeeId: number, latitude: number, longitude: number, accuracy?: number }
// Stores in location_updates table
// Broadcasts via WebSocket to admin dashboard
```

### 3. Geofence-based Attendance

**Algorithm** (Haversine formula):
```typescript
function isWithinGeofence(
  employeeLat: number,
  employeeLng: number,
  siteLat: number,
  siteLng: number,
  radiusMeters: number
): boolean {
  const R = 6371000; // Earth radius in meters
  const φ1 = (employeeLat * Math.PI) / 180;
  const φ2 = (siteLat * Math.PI) / 180;
  const Δφ = ((siteLat - employeeLat) * Math.PI) / 180;
  const Δλ = ((siteLng - employeeLng) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance <= radiusMeters;
}
```

**Check-in Flow**:
1. Employee clicks "Check In"
2. Get current GPS location
3. Validate against assigned work site geofence
4. If valid, create attendance record with check-in time
5. Send notification to admin via WebSocket
6. Store in `attendance_records` table

**Check-out Flow**:
1. Employee clicks "Check Out"
2. Get current GPS location
3. Update existing attendance record with check-out time
4. Calculate total hours worked
5. Notify admin

### 4. Image Upload with Compression

**Configuration** (`server/routes.ts`):
```typescript
// Sharp image processing
import sharp from 'sharp';

// Compression settings
const compressImage = async (buffer: Buffer) => {
  return await sharp(buffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .toBuffer();
};

// Routes
POST /api/employee/:id/upload-image
POST /api/site/:id/upload-image
POST /api/admin/upload-image

// Storage: Google Cloud Storage
// Bucket: Auto-configured via @google-cloud/storage
```

**Image Display** (`client/src/components/AuthenticatedImage.tsx`):
```typescript
// Fetches images with authentication header
// Automatic fallback to placeholder
// Lazy loading support
```

### 5. WebSocket Real-time Notifications

**Server Setup** (`server/index.ts`):
```typescript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // Parse admin ID from query params
  const adminId = new URL(req.url, 'http://localhost').searchParams.get('adminId');
  
  ws.on('message', (message) => {
    // Handle incoming messages
  });
});

// Broadcast function
function broadcastToAdmin(adminId: number, data: any) {
  wss.clients.forEach((client) => {
    if (client.adminId === adminId && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}
```

**Client Connection** (`client/src/pages/admin-dashboard.tsx`):
```typescript
const ws = new WebSocket(`ws://${window.location.host}?adminId=${adminId}`);

ws.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  // Display toast notification
  // Update notification list
  // Refresh employee locations
};
```

### 6. Google Maps Integration

**Configuration** (`client/index.html`):
```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places"></script>
```

**Map Features**:
- Custom markers (red: employees, green: sites, blue: geofences)
- Clickable markers with info windows
- Real-time employee location updates
- Geofence circle visualization
- Employee name labels

**Implementation** (`client/src/pages/admin-dashboard.tsx`):
```typescript
// Initialize map
const map = new google.maps.Map(mapRef.current, {
  center: { lat: 0, lng: 0 },
  zoom: 12,
  mapTypeControl: false,
  streetViewControl: false,
});

// Add employee marker
const marker = new google.maps.Marker({
  position: { lat: employee.latitude, lng: employee.longitude },
  map: map,
  icon: {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 8,
    fillColor: '#ef4444',
    fillOpacity: 1,
    strokeColor: '#fff',
    strokeWeight: 2,
  },
  title: employee.fullName,
});

// Add site geofence
const circle = new google.maps.Circle({
  map: map,
  center: { lat: site.latitude, lng: site.longitude },
  radius: site.geofenceRadius,
  fillColor: '#22c55e',
  fillOpacity: 0.2,
  strokeColor: '#22c55e',
  strokeOpacity: 0.8,
  strokeWeight: 2,
});
```

### 7. Email Notifications (SendGrid)

**Configuration** (`server/routes.ts`):
```typescript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

// Send attendance report
POST /api/attendance/email-report
Body: { 
  startDate: string,
  endDate: string,
  recipients: string[]
}

// Email template
const msg = {
  to: recipients,
  from: 'noreply@aihpcrewtrack.com',
  subject: 'Attendance Report',
  html: generateHTMLReport(attendanceData),
};

await sgMail.send(msg);
```

---

## API Endpoints Reference

### Admin Endpoints
```
POST   /api/admin/register          - Create admin account
POST   /api/admin/login             - Admin login
GET    /api/admin/me                - Get current admin
PUT    /api/admin/:id               - Update admin
POST   /api/admin/upload-image      - Upload admin profile image
```

### Employee Endpoints
```
POST   /api/employees               - Create employee
GET    /api/employees               - List all employees (admin)
GET    /api/employees/:id           - Get employee details
PUT    /api/employees/:id           - Update employee
DELETE /api/employees/:id           - Delete employee
POST   /api/employee/:id/upload-image - Upload profile image
POST   /api/employee/login          - Employee login
GET    /api/employee/me             - Get current employee
```

### Work Site Endpoints
```
POST   /api/sites                   - Create work site
GET    /api/sites                   - List all sites
GET    /api/sites/:id               - Get site details
PUT    /api/sites/:id               - Update site
DELETE /api/sites/:id               - Delete site
POST   /api/site/:id/upload-image   - Upload site image
```

### Area Endpoints
```
POST   /api/areas                   - Create area
GET    /api/areas                   - List all areas
GET    /api/areas/:id               - Get area details
PUT    /api/areas/:id               - Update area
DELETE /api/areas/:id               - Delete area (only if no sites)
```

### Location Endpoints
```
POST   /api/location/update         - Update employee location
GET    /api/location/active         - Get all active employee locations
```

### Attendance Endpoints
```
POST   /api/attendance/check-in     - Employee check-in
POST   /api/attendance/check-out    - Employee check-out
GET    /api/attendance              - Get attendance records
POST   /api/attendance/email-report - Email attendance report
```

### Notification Endpoints
```
GET    /api/notifications           - Get admin notifications
PUT    /api/notifications/:id/read  - Mark notification as read
DELETE /api/notifications/:id       - Delete notification
```

---

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Email
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxx

# Server
NODE_ENV=development|production
PORT=5000

# Authentication (auto-generated if not provided)
JWT_SECRET=your-secret-key
SESSION_SECRET=your-session-secret

# Google Maps (frontend)
VITE_GOOGLE_MAPS_API_KEY=your-api-key
```

---

## Build & Deployment

### Development
```bash
npm install
npm run db:push          # Push schema to database
npm run dev              # Start dev server on port 5000
```

### Production Build
```bash
npm run build            # Build client + server
npm start                # Start production server
```

### Build Output
```
dist/
├── index.js            # Bundled server (ESM)
└── public/             # Client build
    ├── index.html      # HTML entry point
    ├── assets/         # JS/CSS bundles
    ├── logo-192.png    # PWA icons
    ├── logo-512.png
    ├── favicon-*.png   # Favicons
    └── manifest.json   # PWA manifest
```

---

## Key Design Patterns

### 1. Storage Interface Pattern
```typescript
// Interface for data operations
interface IStorage {
  createEmployee(data: InsertEmployee): Promise<Employee>;
  getEmployees(adminId: number): Promise<Employee[]>;
  // ... more methods
}

// PostgreSQL implementation
class PostgresStorage implements IStorage {
  // Uses Drizzle ORM
}
```

### 2. TanStack Query Pattern
```typescript
// Queries
const { data: employees } = useQuery({
  queryKey: ['/api/employees'],
});

// Mutations
const createMutation = useMutation({
  mutationFn: async (data) => apiRequest('POST', '/api/employees', data),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
  },
});
```

### 3. Form Validation Pattern
```typescript
const form = useForm<InsertEmployee>({
  resolver: zodResolver(insertEmployeeSchema.extend({
    password: z.string().min(8, "Password must be at least 8 characters"),
  })),
  defaultValues: {
    fullName: '',
    email: '',
    password: '',
    // ...
  },
});
```

---

## Styling & Theming

### Color Palette (`client/src/index.css`)
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 221.2 83.2% 53.3%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96.1%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --accent: 210 40% 96.1%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  /* ... more colors */
}
```

### Dark Mode
```css
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  /* ... dark variants */
}
```

### Component Usage
```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
```

---

## Security Implementation

### 1. Password Security
```typescript
import bcrypt from 'bcrypt';

// Hashing (10 rounds)
const hashedPassword = await bcrypt.hash(password, 10);

// Verification
const isValid = await bcrypt.compare(password, hashedPassword);
```

### 2. JWT Authentication
```typescript
import jwt from 'jsonwebtoken';

// Generate token
const token = jwt.sign(
  { userId: admin.id, userType: 'admin' },
  JWT_SECRET,
  { expiresIn: '7d' }
);

// Verify token (middleware)
const decoded = jwt.verify(token, JWT_SECRET);
```

### 3. Input Validation
```typescript
// All inputs validated with Zod schemas
const validated = insertEmployeeSchema.parse(requestBody);
```

---

## PWA Configuration

### Manifest (`client/public/manifest.json`)
```json
{
  "name": "AIHP CrewTrack",
  "short_name": "CrewTrack",
  "description": "Workforce Management & Tracking",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#2563eb",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/logo-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/logo-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

---

## Testing Checklist

### Admin Features
- [ ] Admin registration and login
- [ ] Create/edit/delete employees
- [ ] Create/edit/delete work sites
- [ ] Create/edit/delete areas
- [ ] View live employee locations on map
- [ ] Receive real-time check-in/check-out notifications
- [ ] Export attendance reports via email
- [ ] Upload profile images
- [ ] Assign employees to sites

### Employee Features
- [ ] Employee login with geofence validation
- [ ] Check-in (only within geofence)
- [ ] Check-out
- [ ] View assigned work site
- [ ] Upload profile image
- [ ] Location tracking while logged in

### System Features
- [ ] Real-time WebSocket notifications
- [ ] Image upload and compression
- [ ] Google Maps integration
- [ ] Email delivery via SendGrid
- [ ] Mobile responsiveness
- [ ] PWA installation
- [ ] Dark mode toggle

---

## Production Deployment (Render.com)

### Prerequisites
1. GitHub repository
2. Render account
3. PostgreSQL database on Render
4. SendGrid API key

### Deployment Steps
1. Create PostgreSQL database
2. Create Web Service from GitHub
3. Configure build command: `npm install && npm run build`
4. Configure start command: `npm start`
5. Set environment variables
6. Deploy

### render.yaml Configuration
```yaml
services:
  - type: web
    name: aihp-crewtrack
    runtime: node
    buildCommand: npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: aihp-crewtrack-db
          property: connectionString
      - key: SENDGRID_API_KEY
        sync: false

databases:
  - name: aihp-crewtrack-db
    databaseName: crewtrack
```

---

## Important Notes for Cursor AI

1. **File Modifications**: The `server/vite.ts` file is protected and should never be modified
2. **Package Management**: Use Replit's package manager tool, don't manually edit `package.json`
3. **Database Migrations**: Always use `npm run db:push` instead of manual SQL
4. **Image Paths**: Use `@assets/...` alias for importing images in React components
5. **Environment Variables**: Frontend env vars must be prefixed with `VITE_`
6. **Port Binding**: Always bind to `0.0.0.0:5000` in production
7. **Static Files**: Public assets must be in `client/public/` directory
8. **Build Process**: Vite builds client to `dist/public`, esbuild bundles server to `dist/index.js`

---

## Complete Package.json

```json
{
  "name": "aihp-crewtrack",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "NODE_ENV=development tsx server/index.ts",
    "build": "vite build && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "check": "tsc",
    "db:push": "drizzle-kit push"
  },
  "dependencies": {
    "@sendgrid/mail": "^8.1.5",
    "@google-cloud/storage": "^7.16.0",
    "@neondatabase/serverless": "^0.10.4",
    "drizzle-orm": "^0.39.1",
    "drizzle-zod": "^0.7.0",
    "express": "^4.21.2",
    "bcrypt": "^6.0.0",
    "jsonwebtoken": "^9.0.2",
    "sharp": "^0.34.3",
    "ws": "^8.18.0",
    "compression": "^1.8.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@tanstack/react-query": "^5.60.5",
    "wouter": "^3.3.5",
    "react-hook-form": "^7.55.0",
    "@hookform/resolvers": "^3.10.0",
    "zod": "^3.24.2",
    "lucide-react": "^0.453.0",
    "tailwindcss": "^3.4.17",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.2",
    "vite": "^5.4.19",
    "typescript": "5.6.3",
    "esbuild": "^0.25.0",
    "tsx": "^4.19.1",
    "drizzle-kit": "^0.30.4",
    "@types/express": "4.17.21",
    "@types/bcrypt": "^6.0.0",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/ws": "^8.5.13",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1"
  }
}
```

---

## Cursor AI Prompt Template

When working with this codebase in Cursor AI, use this prompt:

```
I'm working on AIHP CrewTrack, a full-stack workforce management application with:
- React + TypeScript + Vite frontend
- Express + Node.js backend  
- PostgreSQL with Drizzle ORM
- Real-time location tracking via Google Maps
- Geofence-based attendance system
- WebSocket notifications
- Image upload with Sharp compression
- SendGrid email integration
- JWT authentication
- PWA support

The complete specification is in CURSOR-AI-SPEC.md. Please review it to understand the architecture before making suggestions.

[Your specific request here]
```

---

**This specification document contains everything needed to recreate or maintain the AIHP CrewTrack application.**
