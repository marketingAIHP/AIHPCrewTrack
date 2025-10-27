# AIHP CrewTrack

**Advanced workforce management and real-time employee tracking solution for efficient labor oversight and attendance monitoring.**

![AIHP CrewTrack](client/public/logo-192.png)

## Features

### Core Functionality
- 👥 **Employee Management** - Complete CRUD operations for workforce management
- 📍 **Real-time Location Tracking** - GPS-based employee location monitoring
- 🗺️ **Interactive Maps** - Google Maps integration with custom markers
- ⏰ **Attendance Tracking** - Geofence-based check-in/check-out system
- 🏢 **Work Site Management** - Hierarchical area and site organization
- 📧 **Email Notifications** - Automated attendance reports via SendGrid
- 🔐 **Role-based Access Control** - Separate admin and employee portals
- 📱 **Progressive Web App** - Mobile-first design with PWA support

### Technical Features
- Real-time WebSocket notifications
- Image upload with compression and cloud storage
- Dark mode support
- Responsive design for all devices
- Email verification system
- JWT-based authentication
- PostgreSQL database with Drizzle ORM

## Tech Stack

### Frontend
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS + shadcn/ui components
- TanStack React Query for state management
- Wouter for routing
- Lucide React for icons

### Backend
- Node.js with Express
- TypeScript
- PostgreSQL (Neon serverless)
- Drizzle ORM
- JWT authentication with bcrypt
- WebSocket for real-time features

### Services & APIs
- Google Maps JavaScript API
- SendGrid for email
- Google Cloud Storage for images

## Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- SendGrid API key
- Google Maps API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/aihp-crewtrack.git
cd aihp-crewtrack
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
# Create .env file with:
DATABASE_URL=your_postgresql_connection_string
SENDGRID_API_KEY=your_sendgrid_api_key
NODE_ENV=development
```

4. Push database schema:
```bash
npm run db:push
```

5. Start development server:
```bash
npm run dev
```

6. Open your browser:
```
http://localhost:5000
```

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run check` - TypeScript type checking
- `npm run db:push` - Push database schema changes

### Project Structure

```
aihp-crewtrack/
├── client/                 # React frontend
│   ├── public/            # Static assets (logos, manifest)
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── lib/           # Utilities and helpers
│   │   └── App.tsx        # Main app component
│   └── index.html
├── server/                 # Express backend
│   ├── routes.ts          # API routes
│   ├── storage.ts         # Database layer
│   ├── index.ts           # Server entry point
│   └── vite.ts            # Vite integration
├── shared/                 # Shared TypeScript types
│   └── schema.ts          # Drizzle database schema
└── package.json
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed deployment instructions to Render.

### Quick Deploy to Render

1. Push code to GitHub
2. Create PostgreSQL database on Render
3. Create Web Service connected to your GitHub repo
4. Set environment variables
5. Deploy!

Your app will be live at: `https://your-app-name.onrender.com`

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `SENDGRID_API_KEY` - SendGrid API key for emails
- `NODE_ENV` - `development` or `production`

### Optional
- `PORT` - Server port (default: 5000)
- `SESSION_SECRET` - Session encryption secret
- `JWT_SECRET` - JWT signing secret

## Features in Detail

### Admin Portal
- Dashboard with live employee tracking
- Employee management (create, edit, delete)
- Work site and area management
- Attendance reports with email export
- Real-time notifications for check-ins/check-outs
- Interactive map showing all employee locations

### Employee Portal
- Simple check-in/check-out interface
- Geofence validation for attendance
- View assigned work sites
- Profile management with image upload
- Work hours tracking

### Map Features
- Custom markers for employees (red), sites (green)
- Clickable markers with detailed information
- Geofence boundaries visualization
- Real-time position updates
- Employee name labels on map

## Security

- JWT-based authentication
- Bcrypt password hashing
- Role-based access control
- Secure session management
- Environment variable protection
- Input validation with Zod schemas

## Browser Support

- Chrome/Edge (recommended)
- Firefox
- Safari
- Mobile browsers (iOS Safari, Chrome Mobile)

## PWA Support

The app includes Progressive Web App features:
- Installable on mobile devices
- Offline capability (coming soon)
- App icons for home screen
- Mobile-optimized interface

## Contributing

This is a proprietary project. For bug reports or feature requests, please contact the development team.

## License

MIT License - see LICENSE file for details

## Support

For support, please contact your system administrator or the AIHP development team.

---

**Built with ❤️ by AIHP**
