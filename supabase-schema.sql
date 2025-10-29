-- =====================================================
-- AIHP CrewTrack - Supabase Database Schema
-- =====================================================
-- Copy and paste this entire file into Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- =====================================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. ADMINS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  profile_image TEXT,
  role TEXT NOT NULL DEFAULT 'admin', -- 'super_admin' or 'admin'
  is_verified BOOLEAN DEFAULT FALSE, -- Email verification status
  verification_token TEXT, -- For email verification
  is_active BOOLEAN DEFAULT FALSE, -- Activated by super admin
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster email lookups
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_company ON admins(company_name);

-- =====================================================
-- 2. DEPARTMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_departments_admin ON departments(admin_id);

-- =====================================================
-- 3. AREAS TABLE (for organizing work sites)
-- =====================================================
CREATE TABLE IF NOT EXISTS areas (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_areas_admin ON areas(admin_id);

-- =====================================================
-- 4. WORK SITES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS work_sites (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  geofence_radius INTEGER NOT NULL DEFAULT 200, -- in meters
  site_image TEXT, -- URL to site image
  area_id INTEGER REFERENCES areas(id) ON DELETE SET NULL,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_work_sites_admin ON work_sites(admin_id);
CREATE INDEX IF NOT EXISTS idx_work_sites_area ON work_sites(area_id);
CREATE INDEX IF NOT EXISTS idx_work_sites_location ON work_sites(latitude, longitude);

-- =====================================================
-- 5. EMPLOYEES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS employees (
  id SERIAL PRIMARY KEY,
  employee_id TEXT, -- Custom employee ID (like "EMP001")
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  password TEXT NOT NULL,
  admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  site_id INTEGER REFERENCES work_sites(id) ON DELETE SET NULL,
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  profile_image TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_admin ON employees(admin_id);
CREATE INDEX IF NOT EXISTS idx_employees_site ON employees(site_id);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_email ON employees(email);

-- =====================================================
-- 6. LOCATION TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS location_tracking (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  is_on_site BOOLEAN NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_location_tracking_employee ON location_tracking(employee_id);
CREATE INDEX IF NOT EXISTS idx_location_tracking_timestamp ON location_tracking(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_location_tracking_location ON location_tracking(latitude, longitude);

-- =====================================================
-- 7. ATTENDANCE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL REFERENCES work_sites(id) ON DELETE CASCADE,
  check_in_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  check_out_time TIMESTAMP WITH TIME ZONE,
  check_in_latitude DECIMAL(10, 8),
  check_in_longitude DECIMAL(11, 8),
  check_out_latitude DECIMAL(10, 8),
  check_out_longitude DECIMAL(11, 8)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_site ON attendance(site_id);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in ON attendance(check_in_time DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_check_out ON attendance(check_out_time DESC);

-- =====================================================
-- HELPFUL FUNCTIONS
-- =====================================================

-- Function to calculate distance between two points (Haversine formula)
-- Returns distance in meters
CREATE OR REPLACE FUNCTION calculate_distance(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  R CONSTANT DECIMAL := 6371000; -- Earth radius in meters
  phi1 DECIMAL;
  phi2 DECIMAL;
  delta_phi DECIMAL;
  delta_lambda DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  phi1 := RADIANS(lat1);
  phi2 := RADIANS(lat2);
  delta_phi := RADIANS(lat2 - lat1);
  delta_lambda := RADIANS(lon2 - lon1);
  
  a := SIN(delta_phi / 2) * SIN(delta_phi / 2) +
       COS(phi1) * COS(phi2) *
       SIN(delta_lambda / 2) * SIN(delta_lambda / 2);
  
  c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
  
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if employee is within geofence
CREATE OR REPLACE FUNCTION is_within_geofence(
  employee_lat DECIMAL,
  employee_lon DECIMAL,
  site_lat DECIMAL,
  site_lon DECIMAL,
  radius INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN calculate_distance(employee_lat, employee_lon, site_lat, site_lon) <= radius;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- ROW LEVEL SECURITY (RLS) - Optional but Recommended
-- =====================================================
-- Uncomment these if you want to use Supabase Auth
-- with Row Level Security

-- Enable RLS on all tables
-- ALTER TABLE admins ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE work_sites ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE location_tracking ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Example RLS Policies (customize as needed)
-- Admin can see their own data and their employees' data
-- CREATE POLICY "Admins can view their own data"
--   ON admins FOR SELECT
--   USING (auth.uid()::text = id::text);

-- CREATE POLICY "Admins can view their employees"
--   ON employees FOR SELECT
--   USING (admin_id IN (SELECT id FROM admins WHERE auth.uid()::text = id::text));

-- =====================================================
-- INITIAL DATA (Optional)
-- =====================================================
-- Create a super admin account (password: Admin@123)
-- Password is bcrypt hashed
INSERT INTO admins (first_name, last_name, company_name, email, password, role, is_verified, is_active)
VALUES (
  'Super',
  'Admin',
  'AIHP CrewTrack',
  'admin@aihpcrewtrack.com',
  '$2b$10$YourHashedPasswordHere', -- Replace with actual bcrypt hash
  'super_admin',
  TRUE,
  TRUE
) ON CONFLICT (email) DO NOTHING;

-- =====================================================
-- HELPFUL QUERIES FOR TESTING
-- =====================================================

-- View all tables
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Count records in each table
-- SELECT 
--   'admins' as table_name, COUNT(*) as count FROM admins
-- UNION ALL
-- SELECT 'employees', COUNT(*) FROM employees
-- UNION ALL
-- SELECT 'work_sites', COUNT(*) FROM work_sites
-- UNION ALL
-- SELECT 'areas', COUNT(*) FROM areas
-- UNION ALL
-- SELECT 'departments', COUNT(*) FROM departments
-- UNION ALL
-- SELECT 'location_tracking', COUNT(*) FROM location_tracking
-- UNION ALL
-- SELECT 'attendance', COUNT(*) FROM attendance;

-- Get latest location for each employee
-- SELECT DISTINCT ON (employee_id)
--   employee_id,
--   latitude,
--   longitude,
--   is_on_site,
--   timestamp
-- FROM location_tracking
-- ORDER BY employee_id, timestamp DESC;

-- Get active employees with their assigned sites
-- SELECT 
--   e.id,
--   e.first_name || ' ' || e.last_name as employee_name,
--   e.email,
--   w.name as site_name,
--   d.name as department_name
-- FROM employees e
-- LEFT JOIN work_sites w ON e.site_id = w.id
-- LEFT JOIN departments d ON e.department_id = d.id
-- WHERE e.is_active = TRUE;

-- =====================================================
-- SCHEMA SETUP COMPLETE! ✅
-- =====================================================
-- 
-- Next Steps:
-- 1. Copy this entire SQL file
-- 2. Go to your Supabase Dashboard
-- 3. Navigate to SQL Editor
-- 4. Click "New Query"
-- 5. Paste this entire content
-- 6. Click "Run" or press Ctrl+Enter
-- 7. Verify all tables are created
--
-- To verify, run: 
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_schema = 'public' ORDER BY table_name;
-- =====================================================
