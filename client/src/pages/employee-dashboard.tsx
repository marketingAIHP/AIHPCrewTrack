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
  CalendarDays
} from 'lucide-react';

interface EmployeeData {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  siteId: number | null;
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
  });

  // Get assigned work site
  const { data: workSite, isLoading: siteLoading } = useQuery({
    queryKey: ['/api/employee/site'],
    retry: false,
    enabled: !!employee?.siteId,
  });

  // Get current attendance
  const { data: currentAttendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ['/api/employee/attendance/current'],
    retry: false,
  });

  // Get location on component mount
  useEffect(() => {
    getCurrentLocation();
  }, []);

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

  // Check if employee is within geofence
  const isWithinGeofence = () => {
    if (!currentLocation || !workSite) return false;
    
    const distance = calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      parseFloat(workSite.latitude),
      parseFloat(workSite.longitude)
    );
    
    return distance <= workSite.geofenceRadius;
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
      
      const response = await apiRequest('/api/employee/attendance/checkin', {
        method: 'POST',
        body: JSON.stringify({
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
        }),
      });
      return response;
    },
    onSuccess: () => {
      toast({
        title: 'Checked In',
        description: 'Successfully marked attendance.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/employee/attendance/current'] });
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
      
      const response = await apiRequest('/api/employee/attendance/checkout', {
        method: 'POST',
        body: JSON.stringify({
          latitude: currentLocation.lat,
          longitude: currentLocation.lng,
        }),
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
              <Building2 className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">WorkTracker</h1>
                <p className="text-sm text-gray-500">Employee Dashboard</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {employee && (
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">
                    {employee.firstName} {employee.lastName}
                  </p>
                  <p className="text-xs text-gray-500">{employee.email}</p>
                </div>
              )}
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
                {currentAttendance && !currentAttendance.checkOutTime ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-green-600 font-medium">Checked In</span>
                      <Badge variant="secondary">
                        {new Date(currentAttendance.checkInTime).toLocaleTimeString()}
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
                            {isWithinGeofence() ? 'At Work Site' : 'Away from Site'}
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
                      <h3 className="font-medium text-gray-900">{workSite.name}</h3>
                      <p className="text-sm text-gray-600">{workSite.address}</p>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span>Geofence Radius:</span>
                      <Badge variant="outline">{workSite.geofenceRadius}m</Badge>
                    </div>
                    
                    {currentLocation && (
                      <div className="flex items-center justify-between text-sm">
                        <span>Distance:</span>
                        <Badge variant="outline">
                          {Math.round(calculateDistance(
                            currentLocation.lat,
                            currentLocation.lng,
                            parseFloat(workSite.latitude),
                            parseFloat(workSite.longitude)
                          ))}m away
                        </Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-500">No work site assigned</p>
                    <p className="text-sm text-gray-400">Contact your administrator</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Today's Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CalendarDays className="h-5 w-5" />
                <span>Today's Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentAttendance ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">
                      {new Date(currentAttendance.checkInTime).toLocaleTimeString()}
                    </p>
                    <p className="text-sm text-gray-600">Check In Time</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {currentAttendance.checkOutTime 
                        ? new Date(currentAttendance.checkOutTime).toLocaleTimeString()
                        : '--:--'
                      }
                    </p>
                    <p className="text-sm text-gray-600">Check Out Time</p>
                  </div>
                  
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">
                      {currentAttendance.checkOutTime 
                        ? `${Math.round((new Date(currentAttendance.checkOutTime).getTime() - new Date(currentAttendance.checkInTime).getTime()) / (1000 * 60 * 60 * 100)) / 10}h`
                        : 'Active'
                      }
                    </p>
                    <p className="text-sm text-gray-600">Hours Worked</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No attendance recorded today</p>
                  <p className="text-sm text-gray-400">Check in to start tracking your work hours</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}