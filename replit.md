# Replit.md

## Overview

This is a full-stack labor tracking and workforce management application built with React (frontend), Express.js (backend), and PostgreSQL database. The application enables administrators to manage employees and work sites while providing real-time location tracking and geofencing capabilities for field workers.

## Recent Changes (July 24, 2025)

### Employee Authentication System Implementation
- **Added employee sign-in portal** with separate login page and dashboard
- **Implemented geofence-based attendance tracking** for automatic check-in/out
- **Added role-based access control** separating admin and employee functionality
- **Created employee dashboard** with attendance controls and work site information
- **Added real-time location validation** to ensure employees are on-site before marking attendance
- **Implemented distance calculation** for geofence compliance verification

### Live Tracking Map Controls Implementation (July 23, 2025)
- **Fixed infinite loop issues** that were causing browser crashes in the live tracking component
- **Added functional map controls** including zoom in (+), zoom out (-), satellite toggle, and fullscreen buttons
- **Removed all Google Maps default UI** controls for clean interface
- **Implemented clickable employee names** that navigate to detailed profile pages
- **Created employee profile pages** showing personal info, attendance records, and location history
- **Added WebSocket integration** for real-time location updates every 30 seconds
- **Fixed Google Maps coordinate validation** to prevent setCenter errors

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack React Query for server state, local state for UI
- **Routing**: Wouter for client-side routing
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful API with WebSocket support for real-time features
- **Authentication**: JWT-based authentication with bcrypt for password hashing
- **Middleware**: Express middlewares for JSON parsing, logging, and error handling

### Database Architecture
- **Database**: PostgreSQL with Neon serverless connection
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema**: Relational design with admins, employees, work sites, location tracking, and attendance tables

## Key Components

### Authentication System
- **Dual User Types**: Separate login flows for administrators and employees
- **Employee Portal**: Independent sign-in system for workers with restricted access
- **Role-Based Access Control**: Admin functions completely separated from employee features
- **JWT Tokens**: Secure token-based authentication with role-based access control
- **Password Security**: Bcrypt hashing for secure password storage
- **Geofence Authentication**: Location-based attendance validation for employees

### Location Tracking
- **Real-time GPS**: Browser geolocation API for continuous location monitoring
- **Geofencing**: Configurable radius-based site boundaries for attendance validation
- **WebSocket Integration**: Live location updates for administrative monitoring

### Administrative Dashboard
- **Employee Management**: CRUD operations for employee records with site assignments
- **Site Management**: Work site creation and configuration with geofence settings
- **Live Tracking**: Real-time map visualization of employee locations and site boundaries
- **Dashboard Analytics**: Overview statistics and attendance monitoring

### Employee Interface
- **Employee Dashboard**: Dedicated portal for worker attendance and site information
- **Location Services**: Automatic GPS tracking with permission handling
- **Geofence Validation**: Attendance marking only allowed within work site boundaries
- **Attendance Management**: Clock in/out functionality with real-time location verification
- **Site Information**: Current work site details, distance calculation, and status display
- **Work Hours Tracking**: Automatic calculation of daily hours worked

### Map Integration
- **Google Maps**: Interactive maps for site visualization and location tracking with custom controls
- **Map Controls**: Zoom in/out, satellite/map toggle, and fullscreen functionality
- **Custom Markers**: Different marker types for employees, sites, and geofences
- **Real-time Updates**: Live position updates via WebSocket connections every 30 seconds
- **Employee Profiles**: Clickable employee names leading to detailed profile pages

## Data Flow

### Authentication Flow
1. User submits login credentials (admin or employee)
2. Server validates credentials and generates JWT token
3. Token stored in localStorage for subsequent API requests
4. Middleware validates tokens on protected routes

### Location Tracking Flow
1. Mobile worker enables location services
2. Browser geolocation API provides GPS coordinates
3. Location data sent to server via WebSocket or HTTP API
4. Server stores location and calculates geofence status
5. Real-time updates broadcast to administrative interfaces

### Attendance Management Flow
1. Employee attempts clock in/out action
2. Current location checked against assigned work site geofence
3. Attendance record created/updated based on location validation
4. Status updates reflected in administrative dashboard

## External Dependencies

### Core Framework Dependencies
- **React Ecosystem**: React, React DOM, React Router (Wouter)
- **Backend Framework**: Express.js with TypeScript support
- **Database**: PostgreSQL via Neon serverless with Drizzle ORM

### UI and Styling
- **Component Library**: Radix UI primitives with shadcn/ui
- **Styling**: Tailwind CSS with custom theme configuration
- **Icons**: Lucide React for consistent iconography

### Authentication and Security
- **JWT**: jsonwebtoken for token generation and validation
- **Password Hashing**: bcrypt for secure password storage
- **Session Management**: Browser localStorage for client-side token storage

### Location and Mapping
- **Maps**: Google Maps JavaScript API for interactive mapping
- **Geolocation**: Browser Geolocation API for GPS positioning
- **Real-time Communication**: WebSocket for live location updates

### Development Tools
- **Build System**: Vite for fast development and optimized production builds
- **TypeScript**: Full type safety across frontend and backend
- **Database Tools**: Drizzle Kit for migrations and schema management

## Deployment Strategy

### Development Environment
- **Local Development**: Vite dev server for frontend, tsx for backend development
- **Database**: Neon PostgreSQL with connection pooling
- **Environment Variables**: DATABASE_URL for database connection, JWT_SECRET for authentication

### Production Build
- **Frontend**: Vite production build with static asset optimization
- **Backend**: ESBuild compilation to optimized Node.js bundle
- **Deployment**: Single deployment artifact with static frontend and Express backend

### Database Management
- **Migrations**: Drizzle migrations for schema versioning
- **Connection Pooling**: Neon serverless with WebSocket support for production scaling
- **Schema Management**: Type-safe schema definitions with Drizzle ORM

The application follows a monorepo structure with shared TypeScript types and utilities, enabling type safety across the full stack while maintaining separation of concerns between frontend, backend, and database layers.