import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken, getUserType } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { useOptimizedGeolocation } from '@/hooks/use-optimized-geolocation';
import { loadGoogleMapsAPI } from '@/lib/google-maps';
import GoogleMap from '@/components/google-map';
import { 
  MapPin, 
  Clock, 
  LogOut, 
  CheckCircle, 
  XCircle, 
  Navigation,
  Building2,
  User,
  CalendarDays,
  RefreshCw,
  Calendar,
  History,
  Edit
} from 'lucide-react';
import { EmployeeProfileDialog } from '@/components/EmployeeProfileDialog';
import { ThemeToggle } from '@/components/ThemeToggle';

interface EmployeeData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  siteId: number | null;
  profileImage?: string;
  isRemote?: boolean;
}

interface WorkSite {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
  isRemote?: boolean;
}

interface AttendanceRecord {
  id: number;
  checkInTime: string;
  checkOutTime: string | null;
  isOnSite: boolean;
}

export default function EmployeeDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);
  const [serverLocationStatus, setServerLocationStatus] = useState<{ distanceFromSite: number | null; isOnSite: boolean | null } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const offsiteCounterRef = useRef(0);
  const OFFSITE_THRESHOLD = 3;

  // GPS accuracy buffer to account for mobile GPS inaccuracies (typically 3-10m)
  // Using a 50m buffer to reduce false negatives when employees are on site
  const GPS_ACCURACY_BUFFER = 50; // meters - increased from 15m for better reliability

  // Use optimized geolocation hook with high accuracy and throttling
  const {
    latitude,
    longitude,
    accuracy,
    error: locationError,
    loading: isGettingLocation,
    timestamp,
  } = useOptimizedGeolocation({
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
    minAccuracy: 50, // Skip readings with accuracy > 50m initially (warm-up filter)
    throttleMs: 10000, // Send to backend every 10 seconds
    onLocationUpdate: async (position) => {
      // Update server location status when location changes
      if (currentAttendance && !(currentAttendance as AttendanceRecord).checkOutTime) {
        try {
          const response = await apiRequest('POST', '/api/employee/location', {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          const data = await response.json();
          setServerLocationStatus({
            distanceFromSite: data.distanceFromSite ?? null,
            isOnSite: typeof data.isOnSite === 'boolean' ? data.isOnSite : null,
          });

          if (data.autoCheckedOut) {
            offsiteCounterRef.current = 0;
            queryClient.invalidateQueries({ queryKey: ['/api/employee/attendance/current'] });
            toast({
              title: 'Auto Checked Out',
              description: 'You have been automatically checked out for being outside the work site.',
              variant: 'destructive',
            });
          }
        } catch (error) {
        }
      }
    },
  });

  // Derive currentLocation from optimized hook
  const currentLocation = latitude && longitude ? {
    lat: latitude,
    lng: longitude,
    accuracy: accuracy || undefined,
  } : null;

  // Check authentication
  useEffect(() => {
    const token = getAuthToken();
    const userType = getUserType();
    
    if (!token || userType !== 'employee') {
      setLocation('/employee/login');
      return;
    }

    // Load Google Maps API
    loadGoogleMapsAPI()
      .then(() => setMapLoaded(true))
      .catch((error) => {
      });
  }, [setLocation]);

  // Get employee data
  const { data: employee, isLoading: employeeLoading } = useQuery({
    queryKey: ['/api/employee/profile'],
    retry: false,
    staleTime: 0, // Always refetch to get latest data
    gcTime: 0, // Don't cache the response
  });

  // Get assigned work site (always fetch if siteId exists, even for remote employees)
  const { data: workSite, isLoading: siteLoading } = useQuery({
    queryKey: ['/api/employee/site'],
    retry: false,
    enabled: !!(employee as EmployeeData)?.siteId,
    staleTime: 0, // Always refetch to get latest data
    gcTime: 0, // Don't cache the response
  });

  // Get current attendance
  const { data: currentAttendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ['/api/employee/attendance/current'],
    retry: false,
    staleTime: 0, // Always refetch to get latest data
    gcTime: 0, // Don't cache the response
  });

  // Get 30-day attendance history
  const { data: attendanceHistory = [], isLoading: historyLoading } = useQuery({
    queryKey: ['/api/employee/attendance/history'],
    retry: false,
    staleTime: 0,
    gcTime: 0,
  });

  // Location tracking is now handled by useOptimizedGeolocation hook
  // No need for manual location fetching code

  // FIX: Check if employee is within geofence and calculate distance with improved logging
  const getDistanceInfo = (locationAccuracy?: number) => {
    if (!currentLocation || !workSite) {
      return { isWithin: false, distance: 0 };
    }
    
    const site = workSite as WorkSite;
    
    // FIX: Ensure coordinates are numeric and valid before calculation
    const empLat = Number(currentLocation.lat);
    const empLng = Number(currentLocation.lng);
    const siteLat = Number(site.latitude);
    const siteLng = Number(site.longitude);
    
    // Validate coordinates
    if (isNaN(empLat) || isNaN(empLng) || isNaN(siteLat) || isNaN(siteLng)) {
      return { isWithin: false, distance: Infinity };
    }
    
    const distance = calculateDistance(empLat, empLng, siteLat, siteLng);
    
    // FIX: Use dynamic buffer based on GPS accuracy, but cap at 50m for consistency
    // GPS accuracy is typically in meters, so we use it directly but limit to buffer max
    const dynamicBuffer = locationAccuracy && !isNaN(locationAccuracy) 
      ? Math.min(Math.max(locationAccuracy, GPS_ACCURACY_BUFFER), GPS_ACCURACY_BUFFER) // Use buffer, not accuracy directly
      : GPS_ACCURACY_BUFFER;
    
    // Use effective radius with GPS accuracy buffer to account for GPS inaccuracies
    const effectiveRadius = site.geofenceRadius + dynamicBuffer;
    const isWithin = distance <= effectiveRadius;
    
    return {
      isWithin: isWithin,
      distance: Math.round(distance),
      isWithinActualRadius: distance <= site.geofenceRadius, // For display purposes, use actual radius
      effectiveRadius: Math.round(effectiveRadius)
    };
  };

  // Check if employee is within geofence (for validation - uses buffer)
  const isWithinGeofence = (locationAccuracy?: number) => {
    return getDistanceInfo(locationAccuracy).isWithin;
  };

  // Check if employee is within actual geofence (for display - no buffer)
  const isWithinActualGeofence = (locationAccuracy?: number) => {
    return getDistanceInfo(locationAccuracy).isWithinActualRadius;
  };

  const getLatestDistance = () => {
    if (serverLocationStatus && serverLocationStatus.distanceFromSite !== null) {
      return serverLocationStatus.distanceFromSite;
    }
    return getDistanceInfo(currentLocation?.accuracy).distance;
  };

  const isCurrentlyOnSite = () => {
    if (serverLocationStatus && serverLocationStatus.isOnSite !== null) {
      return serverLocationStatus.isOnSite;
    }
    return isWithinActualGeofence(currentLocation?.accuracy);
  };

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  // Check in mutation
  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!currentLocation) throw new Error('Location not available');
      
      const response = await apiRequest('POST', '/api/employee/attendance/checkin', {
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
      });
      return response;
    },
    onSuccess: async () => {
      toast({
        title: 'Checked In',
        description: 'Successfully marked attendance.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/employee/attendance/current'] });
      offsiteCounterRef.current = 0;
      
      // Start location tracking
      if (currentLocation) {
        try {
          const locationResponse = await apiRequest('POST', '/api/employee/location', {
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
          });
          const locationData = await locationResponse.json();
          setServerLocationStatus({
            distanceFromSite: locationData.distanceFromSite ?? null,
            isOnSite: typeof locationData.isOnSite === 'boolean' ? locationData.isOnSite : null,
          });
        } catch (error) {
        }
      }
    },
    onError: (error: any) => {
      // Try to parse error message if it contains JSON
      let errorMessage = error.message || 'Unable to check in. Please try again.';
      
      // Check if error message contains JSON (format: "400: {...}")
      const jsonMatch = errorMessage.match(/\{.*\}/);
      if (jsonMatch) {
        try {
          const errorData = JSON.parse(jsonMatch[0]);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch (e) {
          // If parsing fails, use the original message
        }
      }
      
      toast({
        title: 'Check-in Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    },
  });

  // Check out mutation
  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!currentLocation) throw new Error('Location not available');
      
      const response = await apiRequest('POST', '/api/employee/attendance/checkout', {
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Checked Out',
        description: 'Successfully marked departure.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/employee/attendance/current'] });
      setServerLocationStatus(null);
      offsiteCounterRef.current = 0;
    },
    onError: (error: any) => {
      toast({
        title: 'Check-out Failed',
        description: error.message || 'Unable to check out. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userType');
    setLocation('/employee/login');
    offsiteCounterRef.current = 0;
  };

  const handleCheckIn = () => {
    // For remote employees or remote sites, skip geofence validation - they can check in from anywhere
    const employeeData = employee as EmployeeData;
    const site = workSite as WorkSite;
    const isRemote = employeeData?.isRemote || site?.isRemote;
    
    if (!isRemote && !isWithinGeofence(currentLocation?.accuracy)) {
      toast({
        title: 'Location Required',
        description: 'You must be at the work site to check in.',
        variant: 'destructive',
      });
      return;
    }
    checkInMutation.mutate();
  };

  const handleCheckOut = () => {
    checkOutMutation.mutate();
  };

  // Location updates are now handled by useOptimizedGeolocation hook
  // No need for periodic location updates

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/employee/profile'] });
    queryClient.invalidateQueries({ queryKey: ['/api/employee/site'] });
    queryClient.invalidateQueries({ queryKey: ['/api/employee/attendance/current'] });
    toast({
      title: 'Refreshed',
      description: 'Data updated successfully',
    });
  };

  // Calculate working hours for a record
  const calculateWorkingHours = (checkInTime: string, checkOutTime?: string) => {
    if (!checkOutTime) return 0;
    const start = new Date(checkInTime);
    const end = new Date(checkOutTime);
    const diffMs = end.getTime() - start.getTime();
    return diffMs / (1000 * 60 * 60); // Convert to hours
  };

  // Calculate today's total hours
  const calculateTodayHours = () => {
    if (!attendanceHistory || !(attendanceHistory as any[])?.length) return 0;
    
    const today = new Date().toDateString();
    let todayTotal = 0;
    
    (attendanceHistory as any[]).forEach((record: any) => {
      const recordDate = new Date(record.checkInTime).toDateString();
      if (recordDate === today) {
        const hours = calculateWorkingHours(record.checkInTime, record.checkOutTime);
        todayTotal += hours;
      }
    });
    
    // If currently checked in, add hours from current session
    if (currentAttendance && !(currentAttendance as any).checkOutTime) {
      const currentDate = new Date((currentAttendance as any).checkInTime).toDateString();
      if (currentDate === today) {
        const hoursFromCurrentSession = calculateWorkingHours(
          (currentAttendance as any).checkInTime, 
          new Date().toISOString()
        );
        todayTotal += hoursFromCurrentSession;
      }
    }
    
    return todayTotal;
  };

  // Format hours to display (e.g., "8.5h" or "8h 30m")
  const formatHours = (hours: number) => {
    if (hours === 0) return "0h";
    const wholeHours = Math.floor(hours);
    const minutes = Math.round((hours - wholeHours) * 60);
    
    if (minutes === 0) {
      return `${wholeHours}h`;
    } else {
      return `${wholeHours}h ${minutes}m`;
    }
  };

  if (employeeLoading || siteLoading || attendanceLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Skeleton className="h-16 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-purple-50/20 dark:from-slate-900 dark:via-slate-800/50 dark:to-slate-900">
      {/* Header */}
      <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-md border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 py-2 sm:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
              <div className="bg-black rounded-lg sm:rounded-xl p-1.5 sm:p-3 shadow-sm">
                <img 
                  src="/logo-192.png" 
                  alt="AIHP CrewTrack" 
                  className="h-8 w-8 sm:h-12 sm:w-12 md:h-14 md:w-14 object-contain"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg md:text-2xl font-semibold truncate">
                  <span className="text-black dark:text-white">A</span><span className="text-red-600">I</span><span className="text-black dark:text-white">HP</span> <span className="text-black dark:text-white">CrewTrack</span>
                </h1>
                <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 hidden sm:block">Employee Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3">
              {employee && (
                <div 
                  className="text-right cursor-pointer bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg px-2 sm:px-4 py-1 sm:py-2 border border-blue-200 dark:border-blue-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all hover:shadow-sm hidden sm:block"
                  onClick={() => setIsProfileDialogOpen(true)}
                >
                  <p className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    {(employee as EmployeeData).firstName} {(employee as EmployeeData).lastName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 hidden md:block">{(employee as EmployeeData).email}</p>
                </div>
              )}
              <div className="scale-90 sm:scale-100">
                <ThemeToggle />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                className="hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all h-8 w-8 sm:h-9 sm:w-auto sm:px-3 p-0"
              >
                <RefreshCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="text-red-600 dark:text-red-400 hover:text-white hover:bg-gradient-to-r hover:from-red-600 hover:to-red-700 border-red-300 dark:border-red-700 hover:border-red-600 transition-all duration-200 shadow-sm hover:shadow-md h-8 w-8 sm:h-9 sm:w-auto sm:px-3 p-0 sm:p-2"
              >
                <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Attendance Card */}
            <Card className="border-2 border-slate-300 dark:border-slate-600 shadow-sm bg-gradient-to-br from-white to-green-50/20 dark:from-slate-800 dark:to-green-900/10 hover:shadow-md transition-all duration-200">
              <CardHeader className="bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/20 border-b-2 border-slate-300 dark:border-slate-600">
                <CardTitle className="flex items-center space-x-2 text-green-800 dark:text-green-200">
                  <div className="bg-gradient-to-br from-green-400 to-green-500 rounded-lg p-2">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-semibold">Attendance</span>
                </CardTitle>
                <CardDescription className="text-green-700 dark:text-green-400 mt-1">
                  Mark your attendance for today
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                {currentAttendance && !(currentAttendance as AttendanceRecord).checkOutTime ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg px-4 py-3 border border-green-200/50 dark:border-green-800/50">
                      <div className="flex items-center space-x-3">
                        <div className="bg-gradient-to-br from-green-400 to-green-500 rounded-full p-2">
                          <CheckCircle className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <span className="text-green-800 dark:text-green-200 font-semibold text-base block">Checked In</span>
                          <span className="text-green-600 dark:text-green-400 text-sm">
                            {new Date((currentAttendance as AttendanceRecord).checkInTime).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>
                      <Badge className="bg-gradient-to-r from-green-400 to-green-500 text-white border-0 shadow-sm">
                        Active
                      </Badge>
                    </div>
                    <Button 
                      onClick={handleCheckOut}
                      variant="destructive"
                      className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-sm"
                      disabled={checkOutMutation.isPending}
                    >
                      {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800 rounded-lg px-4 py-3 border-2 border-slate-300 dark:border-slate-600">
                      <div className="bg-slate-200 dark:bg-slate-700 rounded-full p-2">
                        <XCircle className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                      </div>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">Not Checked In</span>
                    </div>
                    
                    {locationError && (
                      <Alert variant="destructive" className="bg-red-50 border-red-200">
                        <AlertDescription className="text-red-800">{locationError}</AlertDescription>
                      </Alert>
                    )}
                    
                    {!currentLocation && isGettingLocation && (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Getting location...</p>
                      </div>
                    )}
                    
                    {currentLocation && (
                      <div className="space-y-3 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200/50 dark:border-blue-700/50">
                        {(() => {
                          const employeeData = employee as EmployeeData;
                          const site = workSite as WorkSite;
                          const isRemote = employeeData?.isRemote || site?.isRemote;
                          const isWithinRange = isWithinGeofence(currentLocation?.accuracy);
                          const shouldDisable = !isRemote && !isWithinRange;
                          
                          return (
                            <>
                              {isRemote && (
                                <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg p-3 mb-3">
                                  <div className="flex items-center space-x-2">
                                    <Badge className="bg-blue-500 text-white">Remote Work Site</Badge>
                                    <p className="text-sm text-blue-800 dark:text-blue-200">
                                      You can check in from anywhere. Your location will still be tracked.
                                    </p>
                                  </div>
                                </div>
                              )}
                              {!isRemote && workSite && (
                                <div className="flex items-center justify-between text-sm bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-900">
                                  <span className="font-medium text-slate-700 dark:text-slate-300">Status:</span>
                                  <Badge 
                                    className={isCurrentlyOnSite() 
                                      ? "bg-gradient-to-r from-green-400 to-green-500 text-white border-0 shadow-sm" 
                                      : "bg-gradient-to-r from-red-400 to-red-500 text-white border-0 shadow-sm"
                                    }
                                  >
                                    {isCurrentlyOnSite() ? 'On Site' : 'Away from Site'}
                                  </Badge>
                                </div>
                              )}
                              <Button 
                                onClick={handleCheckIn}
                                className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={shouldDisable || checkInMutation.isPending}
                              >
                                {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
                              </Button>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Work Site Info */}
            <Card className="border-2 border-slate-300 dark:border-slate-600 shadow-sm bg-gradient-to-br from-white to-blue-50/20 dark:from-slate-800 dark:to-blue-900/10 hover:shadow-md transition-all duration-200">
              <CardHeader className="bg-gradient-to-r from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 border-b-2 border-slate-300 dark:border-slate-600">
                <CardTitle className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
                  <div className="bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg p-2">
                    <MapPin className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-semibold">Work Site</span>
                </CardTitle>
                <CardDescription className="text-blue-700 dark:text-blue-400 mt-1">
                  Your assigned work location
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                {workSite ? (
                  <div className="space-y-4">
                    <div className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4 border border-blue-200/50 dark:border-blue-800/50">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-base text-slate-900 dark:text-slate-100">{(workSite as WorkSite).name}</h3>
                        {(workSite as WorkSite).isRemote && (
                          <Badge className="bg-blue-500 text-white">Remote</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300">{(workSite as WorkSite).address}</p>
                    </div>
                    
                    {!(workSite as WorkSite).isRemote && (
                      <>
                        <div className="flex items-center justify-between text-sm bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-900">
                          <span className="font-medium text-slate-700 dark:text-slate-300">Geofence Radius:</span>
                          <Badge className="bg-gradient-to-r from-blue-400 to-blue-500 text-white border-0 shadow-sm">
                            {(workSite as WorkSite).geofenceRadius}m
                          </Badge>
                        </div>
                        
                        {currentLocation && (
                          <div className="flex items-center justify-between text-sm bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-900">
                            <span className="font-medium text-slate-700 dark:text-slate-300">Distance:</span>
                            <Badge className="bg-gradient-to-r from-purple-400 to-purple-500 text-white border-0 shadow-sm">
                              {(() => {
                                const distance = getLatestDistance();
                                if (distance === Infinity) {
                                  return 'N/A';
                                }
                                const isWithinRange = isCurrentlyOnSite();
                                return `${Math.round(distance)}m${isWithinRange ? ' (Within Range)' : ''}`;
                              })()}
                            </Badge>
                          </div>
                        )}
                        
                        {currentLocation && (
                          <div className="flex items-center justify-between text-sm bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-blue-100 dark:border-blue-900">
                            <span className="font-medium text-slate-700 dark:text-slate-300">Status:</span>
                            <Badge 
                              className={isCurrentlyOnSite() 
                                ? "bg-gradient-to-r from-green-400 to-green-500 text-white border-0 shadow-sm" 
                                : "bg-gradient-to-r from-red-400 to-red-500 text-white border-0 shadow-sm"
                              }
                            >
                              {isCurrentlyOnSite() ? 'On Site' : 'Away from Site'}
                            </Badge>
                          </div>
                        )}
                      </>
                    )}
                    {(workSite as WorkSite).isRemote && (
                      <div className="bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg p-3">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          This is a remote work site. You can check in and check out from anywhere. Your location will still be tracked for monitoring purposes.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg border-2 border-dashed border-slate-300">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
                      <MapPin className="h-8 w-8 text-blue-600" />
                    </div>
                    <p className="text-slate-700 font-medium">No work site assigned</p>
                    <p className="text-sm text-slate-500 mt-1">Contact your administrator</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Today's Hours */}
          <Card className="border-2 border-slate-300 dark:border-slate-600 shadow-sm bg-gradient-to-br from-white to-orange-50/20 dark:from-slate-800 dark:to-orange-900/10 hover:shadow-md transition-all duration-200">
            <CardHeader className="bg-gradient-to-r from-orange-50/50 to-amber-50/50 dark:from-orange-900/20 dark:to-amber-900/20 border-b-2 border-slate-300 dark:border-slate-600">
              <CardTitle className="flex items-center space-x-2 text-orange-800 dark:text-orange-200">
                <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-lg p-2">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <span className="font-semibold">Today's Hours</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="text-center">
                <div className="bg-gradient-to-br from-orange-50/50 to-amber-50/50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-6 border border-orange-200/50 dark:border-orange-800/50 mb-4">
                  <p className="text-4xl font-semibold bg-gradient-to-r from-orange-500 to-amber-500 dark:from-orange-400 dark:to-amber-400 bg-clip-text text-transparent mb-2">
                    {formatHours(calculateTodayHours())}
                  </p>
                  {currentAttendance && !(currentAttendance as AttendanceRecord).checkOutTime ? (
                    <div>
                      <Badge className="bg-gradient-to-r from-green-400 to-green-500 text-white border-0 shadow-sm mb-2">
                        Currently Working
                      </Badge>
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                        Started at {new Date((currentAttendance as AttendanceRecord).checkInTime).toLocaleTimeString()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {calculateTodayHours() > 0 ? 'Total hours worked today' : 'Not currently checked in'}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 30-Day Attendance History */}
          <Card className="border-2 border-slate-300 dark:border-slate-600 shadow-sm bg-gradient-to-br from-white to-indigo-50/20 dark:from-slate-800 dark:to-indigo-900/10 hover:shadow-md transition-all duration-200">
            <CardHeader className="bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b-2 border-slate-300 dark:border-slate-600">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2 text-indigo-800 dark:text-indigo-200">
                    <div className="bg-gradient-to-br from-indigo-400 to-indigo-500 rounded-lg p-2">
                      <History className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-semibold">Attendance History (Last 30 Days)</span>
                  </CardTitle>
                  <CardDescription className="text-indigo-600 dark:text-indigo-300 mt-1">
                    Your check-in and check-out records
                  </CardDescription>
                </div>
                <div className="text-right bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg px-4 py-2 border border-indigo-200/50 dark:border-indigo-800/50">
                  <p className="text-xs text-indigo-600 dark:text-indigo-300 font-medium">Today's Total</p>
                  <p className="text-xl font-semibold bg-gradient-to-r from-indigo-500 to-purple-500 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                    {formatHours(calculateTodayHours())}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {historyLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : attendanceHistory.length === 0 ? (
                <div className="text-center py-12 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-lg border-2 border-dashed border-slate-300 dark:border-slate-700">
                  <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center">
                    <Calendar className="h-10 w-10 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <p className="text-slate-900 dark:text-slate-100 font-semibold text-base mb-2">No attendance records</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Your check-ins and check-outs will appear here</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                  {attendanceHistory.map((record: any) => (
                    <div 
                      key={record.id} 
                      className="flex items-center justify-between p-4 bg-gradient-to-br from-white to-indigo-50/50 dark:from-slate-800 dark:to-indigo-900/30 rounded-lg border border-indigo-100 dark:border-indigo-800 hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="bg-gradient-to-br from-indigo-400 to-purple-500 rounded-lg p-2">
                          <CalendarDays className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {new Date(record.checkInTime).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            Check-in: {new Date(record.checkInTime).toLocaleTimeString()}
                          </span>
                          {record.checkOutTime && (
                            <span className="text-xs text-slate-600 dark:text-slate-400">
                              Check-out: {new Date(record.checkOutTime).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        {record.checkOutTime ? (
                          <Badge className="bg-gradient-to-r from-green-400 to-green-500 text-white border-0 shadow-sm">
                            Completed
                          </Badge>
                        ) : (
                          <Badge className="bg-gradient-to-r from-orange-400 to-orange-500 text-white border-0 shadow-sm">
                            Still Active
                          </Badge>
                        )}
                        
                        <div className="text-right bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-indigo-100 dark:border-indigo-900">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 block">
                            {record.checkOutTime ? formatHours(calculateWorkingHours(record.checkInTime, record.checkOutTime)) : 'In Progress'}
                          </span>
                          {!record.checkOutTime && (
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {formatHours(calculateWorkingHours(record.checkInTime, new Date().toISOString()))} so far
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Profile Dialog */}
      {employee && (
        <EmployeeProfileDialog
          employee={employee as EmployeeData}
          isOpen={isProfileDialogOpen}
          onClose={() => setIsProfileDialogOpen(false)}
        />
      )}
    </div>
  );
}