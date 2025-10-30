# AIHP CrewTrack Design Guidelines

## Design Approach
**System**: Hybrid approach drawing from Linear (dashboard clarity), Monday.com (data density), and Mapbox (geospatial visualization), using shadcn/ui components as foundation with heavy customization for enterprise workforce management.

## Core Design Principles
- **Data-First Hierarchy**: Critical workforce metrics always visible
- **Spatial Clarity**: Maps and location data receive prominent treatment
- **Status-Driven Design**: Real-time updates create visual urgency through subtle animations
- **Professional Polish**: Enterprise-grade finish with premium interactions

---

## Typography System

**Primary Font**: Inter (Google Fonts)
**Accent Font**: JetBrains Mono (for coordinates, timestamps, IDs)

**Hierarchy**:
- Page Titles: text-3xl font-bold tracking-tight
- Section Headers: text-xl font-semibold
- Card Titles: text-base font-medium
- Body Text: text-sm font-normal
- Captions/Meta: text-xs text-muted-foreground
- Data Values: text-2xl font-bold tabular-nums (for metrics)

---

## Layout System

**Spacing Units**: Tailwind 2, 4, 6, 8, 12, 16 (px-4, py-8, gap-6 patterns)

**Grid Structure**:
- Dashboard: 12-column grid (grid-cols-12)
- Cards: 1-2-3-4 column responsive (grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4)
- Sidebar: Fixed 280px width (w-70) on desktop, full-width drawer on mobile

**Container Widths**:
- Dashboard content: max-w-screen-2xl mx-auto
- Forms/Login: max-w-md mx-auto
- Map views: Full width with minimal padding (px-4)

---

## Color Architecture

**Blue Primary System** (user will implement):
- Primary: Main blue for CTAs, active states
- Primary-dark: Hover states, emphasis
- Primary-light: Backgrounds, subtle highlights

**Functional Colors**:
- Success: Green for online/active status
- Warning: Amber for approaching geofence boundaries
- Danger: Red for offline/emergency alerts
- Info: Cyan for location updates

**Backgrounds**:
- Login Pages: Dark slate gradient (slate-900 to slate-800)
- Dashboard: Light neutral (slate-50/white) with subtle texture
- Cards: White with border-slate-200 borders

---

## Component Library

### 1. Authentication Pages

**Login Screen**:
- Centered card (max-w-md) with backdrop-blur effect
- White AIHP logo at top (h-12)
- Dark slate gradient background (from-slate-900 to-slate-800)
- Form fields: Email, Password with show/hide toggle
- "Remember me" checkbox + "Forgot password" link
- Primary blue CTA button (w-full)
- Footer with version number and support link

**Layout**: Single centered card with generous padding (p-8), logo above, form below, subtle shadow (shadow-2xl)

### 2. Dashboard Layout

**Top Navigation Bar** (h-16 sticky top-0):
- AIHP Logo (left, h-8)
- Search bar (center, max-w-xl) with keyboard shortcut hint (⌘K)
- Right cluster: Notifications bell (with badge), user profile dropdown
- Background: white with border-b shadow-sm

**Left Sidebar** (280px fixed):
- Navigation sections: Dashboard, Employees, Locations, Geofences, Reports, Settings
- Icons from Heroicons (outline style)
- Active state: bg-blue-50 border-l-4 border-blue-600
- Collapse button at bottom

**Main Content Area**:
- Padding: p-6 lg:p-8
- Breadcrumb navigation at top
- Page header with title + actions row

### 3. Dashboard Widgets

**Metrics Cards** (grid-cols-4 gap-6):
Each card contains:
- Large number (text-3xl font-bold)
- Label (text-sm text-muted-foreground)
- Trend indicator (↑/↓ with percentage, text-xs)
- Mini sparkline chart area
- Background: white, rounded-lg, p-6, border, shadow-sm

**Live Map Widget** (spans 2 columns):
- Full-bleed map (h-96 lg:h-[500px])
- Floating controls overlay (top-right): Zoom, Layer toggle, Fullscreen
- Employee markers with status color rings
- Geofence boundaries with fill opacity
- Selected employee info card (bottom-left overlay with backdrop-blur)

**Recent Activity Feed**:
- Timeline layout with vertical line
- Activity items: Avatar, timestamp, action description
- Max height with overflow scroll (max-h-96)

### 4. Employee Directory

**Grid View** (grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4):

Each Employee Card:
- Profile image (w-16 h-16 rounded-full) top-left
- Status indicator dot (absolute top-right of avatar)
- Name (text-base font-semibold)
- Role/Department (text-sm text-muted-foreground)
- Location snippet with map pin icon
- Last active timestamp
- Quick actions: Call, Message, View Profile icons
- Border-l-4 with status color
- Hover: shadow-md transition

**List View Alternative**:
- Table layout with sortable columns
- Sticky header row
- Columns: Photo, Name, Role, Location, Status, Last Seen, Actions

### 5. Location Tracking Interface

**Map Dominance**: Full-screen map (h-[calc(100vh-4rem)])

**Left Panel Overlay** (w-80, backdrop-blur-lg bg-white/95):
- Employee list with filters
- Real-time location updates (pulse animation)
- Distance from checkpoint metrics
- Grouped by status (Active, Break, Offline)

**Right Panel Controls**:
- Geofence management toggle
- Draw new boundary tool
- Time range selector (Today, This Week, Custom)
- Export location history button

### 6. Geofencing Visualization

**Map Layer**:
- Polygon boundaries with labeled names
- Color-coded by type (Job Site, Restricted, Break Zone)
- Fill opacity: 0.2, Stroke: 2px solid
- Hover shows: Name, Employee count inside, Alerts

**Boundary Cards** (stacked list on right):
- Thumbnail map preview
- Boundary name + type badge
- Employee count indicator
- Edit/Delete action buttons

### 7. Forms & Inputs

**Style**: shadcn/ui defaults with:
- Labels: text-sm font-medium mb-2
- Inputs: h-10 px-3 rounded-md border focus:ring-2 focus:ring-blue-500
- Validation: red border + error message (text-xs text-red-600)
- Helper text: text-xs text-muted-foreground

**Special Inputs**:
- Time pickers for shift schedules
- Location autocomplete with map preview
- Multi-select for employee assignment

### 8. Mobile Responsive Patterns

**Breakpoints**:
- Mobile: Single column, bottom navigation tabs
- Tablet (md): 2-column grids, collapsible sidebar
- Desktop (lg+): Full multi-column layouts

**Mobile Dashboard**:
- Metric cards: Single column stacked
- Map: Full-width, reduced height (h-64)
- Navigation: Bottom fixed tabs (Dashboard, Employees, Map, Profile)
- Sidebar: Drawer from left with overlay

---

## Animations & Transitions

**Minimal Motion Philosophy**:
- Page transitions: None (instant)
- Card hovers: shadow-md transition-shadow duration-200
- Status indicators: Pulse animation for "online" (animate-pulse slow)
- Real-time updates: Subtle fade-in for new data points
- Map markers: Bounce on new location update (once only)

**Forbidden**: Parallax, scroll-triggered animations, continuous motion

---

## Images

**No Hero Images** - This is a data-dense enterprise application.

**Image Usage**:
1. **Employee Profile Photos**: Circular avatars (w-10 h-10 to w-16 h-16), fallback to initials in colored circles
2. **Dashboard Illustrations**: Small spot illustrations for empty states (e.g., "No employees online" - 200x200px simple line art)
3. **Login Background**: Optional subtle pattern overlay on gradient (geometric grid pattern, low opacity)

**Image Placement**:
- Employee cards: Top-left or left-aligned in list view
- User profile dropdown: Small avatar next to name
- Empty states: Centered illustrations above text

---

## Professional Enterprise Polish

**Elevation System**:
- Level 0: border only (cards at rest)
- Level 1: shadow-sm (default elevation)
- Level 2: shadow-md (hover, active panels)
- Level 3: shadow-lg (modals, dropdowns)

**Status Communication**:
- Online: Green dot + "Active now"
- Idle: Amber dot + "Away 5m"
- Offline: Gray dot + "Last seen 2h ago"
- Emergency: Red pulsing dot + "ALERT"

**Data Density**:
- Dashboard: High density with clear grouping
- Forms: Generous spacing (gap-6) for clarity
- Tables: Compact rows (h-12) with zebra striping option

This design creates a premium, data-rich workforce management experience optimizing for speed, clarity, and real-time insights while maintaining professional polish throughout.