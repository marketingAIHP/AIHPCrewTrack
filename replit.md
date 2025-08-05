# Replit.md

## Overview
This project is a full-stack labor tracking and workforce management application. It enables administrators to manage employees and work sites, offering real-time location tracking, geofencing capabilities for field workers, and comprehensive attendance reporting. The application's core purpose is to streamline workforce management, enhance operational efficiency through accurate attendance and location data, and provide robust tools for oversight.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
The application uses React with Tailwind CSS and shadcn/ui for a modern, responsive interface. It features interactive image dialogs for profile management, custom map icons (red for employees, green for sites, blue for geofences), and professional HTML reports for email exports. Map controls are customized to remove default UI elements, providing a clean user experience. Notification displays are integrated via toast notifications and a header dropdown.

### Technical Implementations
**Frontend**: Built with React and TypeScript, leveraging TanStack React Query for server state management and Wouter for client-side routing. Vite is used for fast development and optimized production builds.
**Backend**: Developed with Express.js and TypeScript, designed as a RESTful API with WebSocket support for real-time features. JWT-based authentication with bcrypt for password hashing ensures secure access.
**Database**: Utilizes PostgreSQL with Neon serverless connection and Drizzle ORM for type-safe operations. The schema includes relational designs for admins, employees, work sites, location tracking, and attendance.

### Feature Specifications
*   **Authentication System**: Separate login flows for administrators and employees with JWT-based authentication, role-based access control, and bcrypt for secure password hashing. Includes geofence-based attendance validation for employees.
*   **Location Tracking**: Real-time GPS tracking via browser geolocation API, with configurable geofencing for attendance validation and WebSocket integration for live updates.
*   **Administrative Dashboard**: Provides CRUD operations for employee and site management, a live map visualization of employee locations and site boundaries, and analytics for attendance monitoring. Includes email export functionality for attendance reports.
*   **Employee Interface**: A dedicated portal for workers to manage attendance with geofence validation, view site information, and track work hours.
*   **Map Integration**: Interactive Google Maps with custom markers and controls, displaying real-time employee positions, work sites, and geofence boundaries. Features clickable markers and employee names for detailed profile navigation.
*   **Data Validation & Security**: Strong password requirements, unique email validation for both admin and employee accounts, and organization uniqueness constraints. Robust error handling provides detailed validation messages.
*   **Real-time Notifications**: WebSocket-based notifications alert administrators to employee check-in/out events, with toast notifications and a persistent notification history.
*   **Profile Image Management**: Comprehensive system for uploading, previewing, and removing profile images for both admin and employee profiles, with base64 storage.

### System Design Choices
The application follows a monorepo structure with shared TypeScript types for full-stack type safety. It prioritizes real-time data synchronization, robust error handling, and a clear separation of concerns between frontend, backend, and database layers. Location updates are optimized for server load and battery life (1-minute interval), and automatic check-out occurs when employees leave geofences. Caching is disabled for critical employee data to ensure data freshness.

## External Dependencies

*   **Database**: PostgreSQL (via Neon serverless)
*   **Mapping & Geolocation**: Google Maps JavaScript API, Browser Geolocation API
*   **Email Service**: SendGrid
*   **Real-time Communication**: WebSockets
*   **UI Components**: Radix UI primitives, shadcn/ui
*   **Icons**: Lucide React
*   **Authentication**: jsonwebtoken, bcrypt
*   **ORM**: Drizzle ORM
*   **Frontend Framework**: React
*   **Backend Framework**: Express.js
*   **Styling**: Tailwind CSS
*   **State Management**: TanStack React Query
*   **Routing**: Wouter
*   **Build Tool**: Vite