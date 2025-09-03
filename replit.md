# Replit.md

## Overview
This project is a full-stack labor tracking and workforce management application. It enables administrators to manage employees and work sites, offering real-time location tracking, geofencing capabilities for field workers, and comprehensive attendance reporting. The application's core purpose is to streamline workforce management, enhance operational efficiency through accurate attendance and location data, and provide robust tools for oversight.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Updates (September 2025)
- **Production-Ready Deployment**: Implemented comprehensive responsive design across all admin panels (dashboard, employee management, site management)
- **Employee Management Enhancement**: Added site assignment functionality to employee creation form with proper backend handling
- **Image Upload Fixes**: Resolved image upload stuck at 100% issue for both employee profiles and site images with improved error handling
- **Error Handling Improvements**: Fixed delete employee error display while maintaining successful operation functionality
- **Mobile Responsiveness**: Implemented mobile-first design with adaptive layouts (1-4 columns), responsive navigation, and optimized touch interfaces
- **Backend Optimization**: Enhanced upload parameter handling and improved error responses for better user experience
- **Production Testing**: All core features tested and verified working including employee creation, site assignment, image uploads, and deletions
- **Adaptive Image Compression (September 3, 2025)**: Implemented intelligent image compression system with 96-97% size reduction, WebP format support, device-aware optimization, and progressive loading. Achieved dramatic performance improvements with thumbnail-first loading strategy.
- **Critical API Fix (September 3, 2025)**: Resolved fundamental apiRequest parameter order mismatch causing "Failed to execute fetch" errors in employee creation/update forms. Fixed backend schema validation for partial employee updates. All CRUD operations now working correctly with proper error handling.
- **Smart Compression Features Removal (September 3, 2025)**: Removed advanced smart compression preview thumbnails and related UI components per user request. Maintained core image compression functionality with basic adaptive loading.

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
*   **Profile Image Management**: Comprehensive system for uploading, previewing, and removing profile images for both admin and employee profiles, with cloud object storage. Images display consistently across all application interfaces including employee cards, active employee lists, on-site tracking, live map sidebar, and notifications.
*   **Site Image Management**: Complete image upload and display system for work sites using the same authenticated storage infrastructure as profile images. Site images are processed through secure backend endpoints and display properly in site cards using the AuthenticatedImage component with automatic fallback to placeholder graphics.
*   **Hierarchical Area Organization**: Work sites can be organized into logical areas for better management. Areas contain multiple work sites and provide hierarchical structure for large organizations with multiple locations or districts. Full CRUD operations for both areas and sites with validation to prevent deletion of areas with associated sites.

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