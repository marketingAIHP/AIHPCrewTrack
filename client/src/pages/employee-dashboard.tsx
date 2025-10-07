import { useState, useEffect } from 'react';
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

interface EmployeeData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  siteId: number | null;
  profileImage?: string;
}

interface WorkSite {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  geofenceRadius: number;
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
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string>('');
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false);

  // Check authentication
  useEffect(() => {
    const token = getAuthToken();
    const userType = getUserType();
    
    if (!token || userType !== 'employee') {
      setLocation('/employee/login');
      return;
    }
  }, [setLocation]);

  // Get employee data
  const { data: employee, isLoading: employeeLoading } = useQuery({
    queryKey: ['/api/employee/profile'],
    retry: false,
    staleTime: 0, // Always refetch to get latest data
    gcTime: 0, // Don't cache the response
  });

  // Get assigned work site
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

  // Get location on component mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

  // Auto-update location for checked-in employees - 1 minute intervals
  useEffect(() => {
    const interval = setInterval(() => {
      // Only update location if employee is checked in
      if (currentAttendance && !(currentAttendance as AttendanceRecord).checkOutTime) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            
            // Update current location state
            setCurrentLocation({ lat, lng });
            
            // Check if still within geofence
            if (workSite) {
              const siteLat = parseFloat((workSite as WorkSite).latitude.toString());
              const siteLng = parseFloat((workSite as WorkSite).longitude.toString());
              const distance = calculateDistance(lat, lng, siteLat, siteLng);
              const isWithinFence = distance <= (workSite as WorkSite).geofenceRadius;
              
              // If outside geofence, auto check-out
              if (!isWithinFence) {
                handleCheckOut();
                toast({
                  title: 'Auto Check-Out',
                  description: 'You left the work site area. Automatically checked out.',
                  variant: 'destructive',
                });
                return;
              }
            }
            
            // Send location to server for tracking
            apiRequest('POST', '/api/employee/location', {
              latitude: lat,
              longitude: lng,
            }).catch(console.error);
          },
          (error) => console.error('Location tracking error:', error),
          { enableHighAccuracy: true }
        );
      }
    }, 60000); // Update every 1 minute

    return () => clearInterval(interval);
  }, [currentAttendance, workSite]);

  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    setLocationError('');

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsGettingLocation(false);
      },
      (error) => {
        let errorMessage = 'Unable to get your location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location services.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        setLocationError(errorMessage);
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Check if employee is within geofence and calculate distance
  const getDistanceInfo = () => {
    if (!currentLocation || !workSite) return { isWithin: false, distance: 0 };
    
    const site = workSite as WorkSite;
    const distance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      parseFloat(site.latitude.toString()),
      parseFloat(site.longitude.toString())
    );
    
    return {
      isWithin: distance <= site.geofenceRadius,
      distance: Math.round(distance)
    };
  };

  // Check if employee is within geofence
  const isWithinGeofence = () => {
    return getDistanceInfo().isWithin;
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
    onSuccess: () => {
      toast({
        title: 'Checked In',
        description: 'Successfully marked attendance.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/employee/attendance/current'] });
      
      // Start location tracking
      if (currentLocation) {
        apiRequest('POST', '/api/employee/location', {
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
        }).catch(console.error);
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Check-in Failed',
        description: error.message || 'Unable to check in. Please try again.',
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
  };

  const handleCheckIn = () => {
    if (!isWithinGeofence()) {
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img 
                src="/logo-192.png" 
                alt="AIHP CrewTrack" 
                className="h-10 w-10 object-contain"
              />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">AIHP CrewTrack</h1>
                <p className="text-sm text-gray-500">Employee Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {employee && (
                <div className="text-right cursor-pointer" onClick={() => setIsProfileDialogOpen(true)}>
                  <p className="text-sm font-medium text-gray-900 hover:text-blue-600">
                    {(employee as EmployeeData).firstName} {(employee as EmployeeData).lastName}
                  </p>
                  <p className="text-xs text-gray-500">{(employee as EmployeeData).email}</p>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
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
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="h-5 w-5" />
                  <span>Attendance</span>
                </CardTitle>
                <CardDescription>
                  Mark your attendance for today
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentAttendance && !(currentAttendance as AttendanceRecord).checkOutTime ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-green-600 font-medium">Checked In</span>
                      <Badge variant="secondary">
                        {new Date((currentAttendance as AttendanceRecord).checkInTime).toLocaleTimeString()}
                      </Badge>
                    </div>
                    <Button 
                      onClick={handleCheckOut}
                      variant="destructive"
                      className="w-full"
                      disabled={checkOutMutation.isPending}
                    >
                      {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <XCircle className="h-5 w-5 text-gray-400" />
                      <span className="text-gray-600">Not Checked In</span>
                    </div>
                    
                    {locationError && (
                      <Alert variant="destructive">
                        <AlertDescription>{locationError}</AlertDescription>
                      </Alert>
                    )}
                    
                    {!currentLocation && (
                      <Button 
                        onClick={getCurrentLocation}
                        variant="outline"
                        className="w-full"
                        disabled={isGettingLocation}
                      >
                        <Navigation className="h-4 w-4 mr-2" />
                        {isGettingLocation ? 'Getting Location...' : 'Get My Location'}
                      </Button>
                    )}
                    
                    {currentLocation && workSite && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span>Status:</span>
                          <Badge variant={isWithinGeofence() ? "default" : "secondary"}>
                            {isWithinGeofence() ? 'On Site' : 'Away from Site'}
                          </Badge>
                        </div>
                        <Button 
                          onClick={handleCheckIn}
                          className="w-full"
                          disabled={!isWithinGeofence() || checkInMutation.isPending}
                        >
                          {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Work Site Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5" />
                  <span>Work Site</span>
                </CardTitle>
                <CardDescription>
                  Your assigned work location
                </CardDescription>
              </CardHeader>
              <CardContent>
                {workSite ? (
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium text-gray-900">{(workSite as WorkSite).name}</h3>
                      <p className="text-sm text-gray-600">{(workSite as WorkSite).address}</p>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span>Geofence Radius:</span>
                      <Badge variant="outline">{(workSite as WorkSite).geofenceRadius}m</Badge>
                    </div>
                    
                    {currentLocation && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Distance:</span>
                        <Badge variant="outline">
                          {(() => {
                            const { isWithin, distance } = getDistanceInfo();
                            return isWithin ? '0m (On Site)' : `${distance}m`;
                          })()}
                        </Badge>
                      </div>
                    )}
                    
                    {currentLocation && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Status:</span>
                        <Badge variant={isWithinGeofence() ? "default" : "secondary"}>
                          {isWithinGeofence() ? 'On Site' : 'Away from Site'}
                        </Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    <p>No work site assigned</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Today's Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Today's Hours</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600 mb-2">
                  {formatHours(calculateTodayHours())}
                </p>
                {currentAttendance && !(currentAttendance as AttendanceRecord).checkOutTime ? (
                  <div>
                    <Badge variant="default" className="mb-2">Currently Working</Badge>
                    <p className="text-sm text-gray-600">
                      Started at {new Date((currentAttendance as AttendanceRecord).checkInTime).toLocaleTimeString()}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">
                    {calculateTodayHours() > 0 ? 'Total hours worked today' : 'Not currently checked in'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 30-Day Attendance History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <History className="h-5 w-5" />
                    <span>Attendance History (Last 30 Days)</span>
                  </CardTitle>
                  <CardDescription>
                    Your check-in and check-out records
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Today's Total</p>
                  <p className="text-xl font-bold text-blue-600">{formatHours(calculateTodayHours())}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : attendanceHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No attendance records in the last 30 days</p>
                  <p className="text-sm text-gray-400">Your check-ins and check-outs will appear here</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {attendanceHistory.map((record: any) => (
                    <div 
                      key={record.id} 
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {new Date(record.checkInTime).toLocaleDateString()}
                          </span>
                          <span className="text-xs text-gray-500">
                            Check-in: {new Date(record.checkInTime).toLocaleTimeString()}
                          </span>
                          {record.checkOutTime && (
                            <span className="text-xs text-gray-500">
                              Check-out: {new Date(record.checkOutTime).toLocaleTimeString()}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {record.checkOutTime ? (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Completed
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            Still Active
                          </Badge>
                        )}
                        
                        <div className="text-right">
                          <span className="text-sm font-medium text-gray-900">
                            {record.checkOutTime ? formatHours(calculateWorkingHours(record.checkInTime, record.checkOutTime)) : 'In Progress'}
                          </span>
                          {!record.checkOutTime && (
                            <p className="text-xs text-gray-500">
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