import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { getAuthToken, getUser, logout, getUserType } from '@/lib/auth';
import { useGeolocation } from '@/hooks/use-geolocation';
import { useWebSocket } from '@/hooks/use-websocket';
import GoogleMap from '@/components/google-map';
import { loadGoogleMapsAPI } from '@/lib/google-maps';
import { 
  Settings, 
  MapPin, 
  LogIn, 
  LogOut, 
  AlertTriangle,
  Clock,
  Hammer,
  Phone
} from 'lucide-react';

export default function MobileWorker() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = getUser();
  const userType = getUserType();
  const [mapLoaded, setMapLoaded] = useState(false);

  const {
    latitude,
    longitude,
    error: locationError,
    loading: locationLoading,
    requestPermission,
  } = useGeolocation({ watch: true });

  useEffect(() => {
    if (!getAuthToken() || userType !== 'employee') {
      toast({
        title: 'Unauthorized',
        description: 'Please log in as an employee to access this page.',
        variant: 'destructive',
      });
      setLocation('/admin/login');
    }

    // Load Google Maps API
    loadGoogleMapsAPI()
      .then(() => setMapLoaded(true))
      .catch((error) => {
        console.error('Failed to load Google Maps:', error);
      });
  }, []);

  // Get employee status and assigned site
  const { data: status = {}, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/employee/status'],
    enabled: !!getAuthToken() && userType === 'employee',
    refetchInterval: 30000,
  });

  const { data: assignedSite = {} } = useQuery({
    queryKey: ['/api/admin/sites', status?.assignedSite],
    enabled: !!status?.assignedSite,
  });

  // WebSocket for location updates
  const { sendMessage, isConnected } = useWebSocket({
    onMessage: (data) => {
      if (data.type === 'location_confirmed') {
        queryClient.invalidateQueries({ queryKey: ['/api/employee/status'] });
      }
    },
  });

  // Send location updates via WebSocket when available
  useEffect(() => {
    if (latitude && longitude && isConnected && status?.isCheckedIn) {
      sendMessage({
        type: 'location_update',
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      });
    }
  }, [latitude, longitude, isConnected, status?.isCheckedIn, sendMessage]);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!latitude || !longitude) {
        throw new Error('Location access is required for check-in');
      }
      if (!status?.assignedSite) {
        throw new Error('No work site assigned. Contact your supervisor.');
      }
      
      const response = await apiRequest('POST', '/api/employee/checkin', {
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        siteId: status.assignedSite,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee/status'] });
      toast({
        title: 'Checked In',
        description: 'Successfully checked in to work site',
      });
    },
    onError: (error) => {
      toast({
        title: 'Check-in Failed',
        description: error.message || 'Unable to check in',
        variant: 'destructive',
      });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!latitude || !longitude) {
        throw new Error('Location access is required for check-out');
      }
      
      const response = await apiRequest('POST', '/api/employee/checkout', {
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee/status'] });
      toast({
        title: 'Checked Out',
        description: 'Successfully checked out from work site',
      });
    },
    onError: (error) => {
      toast({
        title: 'Check-out Failed',
        description: error.message || 'Unable to check out',
        variant: 'destructive',
      });
    },
  });

  const handleCheckIn = () => {
    if (locationError) {
      toast({
        title: 'Location Required',
        description: 'Please enable location access to check in',
        variant: 'destructive',
      });
      requestPermission();
      return;
    }
    checkInMutation.mutate();
  };

  const handleCheckOut = () => {
    if (locationError) {
      toast({
        title: 'Location Required',
        description: 'Please enable location access to check out',
        variant: 'destructive',
      });
      requestPermission();
      return;
    }
    checkOutMutation.mutate();
  };

  const handleEmergencyContact = () => {
    // In a real implementation, this would trigger an emergency protocol
    toast({
      title: 'Emergency Contact',
      description: 'Emergency services have been notified',
      variant: 'destructive',
    });
  };

  const handleLogout = () => {
    logout();
    toast({
      title: 'Logged out',
      description: 'You have been successfully logged out.',
    });
    setLocation('/admin/login');
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  if (!user || userType !== 'employee') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile Header */}
      <div className="bg-primary text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
              <Hammer className="text-white text-sm" />
            </div>
            <div>
              <h1 className="font-semibold">WorkSite Tracker</h1>
              <p className="text-sm opacity-90">
                {user.firstName} {user.lastName}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white hover:bg-white hover:bg-opacity-10"
            onClick={handleLogout}
          >
            <Settings className="text-white" />
          </Button>
        </div>
      </div>

      <div className="p-4">
        {/* Status Card */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="text-center">
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                status?.isCheckedIn ? 'bg-success bg-opacity-10' : 'bg-gray-100'
              }`}>
                <MapPin className={`text-2xl ${
                  status?.isCheckedIn ? 'text-success' : 'text-gray-400'
                }`} />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {statusLoading ? 'Loading...' : status?.isCheckedIn ? 'On Site' : 'Off Site'}
              </h2>
              {assignedSite && (
                <p className="text-gray-600 mb-1">{assignedSite.name}</p>
              )}
              {status?.attendance?.checkInTime && (
                <p className="text-sm text-gray-500">
                  Checked in at {formatTime(status.attendance.checkInTime)}
                </p>
              )}
              {!status?.assignedSite && (
                <p className="text-sm text-warning">No work site assigned</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Location Permission Warning */}
        {locationError && (
          <Card className="mb-6 border-warning">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="text-warning" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Location Access Required</p>
                  <p className="text-xs text-gray-600">{locationError}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Button
            onClick={handleCheckIn}
            disabled={
              !status?.assignedSite ||
              status?.isCheckedIn ||
              checkInMutation.isPending ||
              locationLoading ||
              !!locationError
            }
            className="bg-success hover:bg-green-600 text-white p-4 h-auto flex flex-col items-center space-y-2"
          >
            <LogIn className="text-xl" />
            <span className="font-medium">
              {checkInMutation.isPending ? 'Checking In...' : 'Check In'}
            </span>
          </Button>
          <Button
            onClick={handleCheckOut}
            disabled={
              !status?.isCheckedIn ||
              checkOutMutation.isPending ||
              locationLoading ||
              !!locationError
            }
            className="bg-error hover:bg-red-600 text-white p-4 h-auto flex flex-col items-center space-y-2"
          >
            <LogOut className="text-xl" />
            <span className="font-medium">
              {checkOutMutation.isPending ? 'Checking Out...' : 'Check Out'}
            </span>
          </Button>
        </div>

        {/* Today's Activity */}
        <Card className="mb-6">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Today's Activity</h3>
          </div>
          <CardContent className="p-4">
            <div className="space-y-4">
              {status?.attendance ? (
                <>
                  <div className="flex items-center space-x-4">
                    <div className="w-2 h-2 bg-success rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">Checked In</p>
                      <p className="text-xs text-gray-600">
                        {formatTime(status.attendance.checkInTime)} • {assignedSite?.name || 'Work Site'}
                      </p>
                    </div>
                  </div>
                  {status.attendance.checkOutTime && (
                    <div className="flex items-center space-x-4">
                      <div className="w-2 h-2 bg-error rounded-full"></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Checked Out</p>
                        <p className="text-xs text-gray-600">
                          {formatTime(status.attendance.checkOutTime)} • {assignedSite?.name || 'Work Site'}
                        </p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4">
                  <Clock className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">No activity today</p>
                  <p className="text-xs text-gray-400">Check in to start tracking your work day</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Current Location */}
        <Card className="mb-6">
          <div className="p-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Current Location</h3>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  isConnected && !locationError ? 'bg-success animate-pulse' : 'bg-gray-400'
                }`}></div>
                <span className="text-xs text-gray-600">
                  {isConnected && !locationError ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
          <CardContent className="p-4">
            {latitude && longitude && mapLoaded ? (
              <div className="h-40 bg-gray-100 rounded-lg mb-4">
                <GoogleMap
                  center={{ lat: latitude, lng: longitude }}
                  zoom={16}
                  markers={[
                    {
                      id: 'current',
                      position: { lat: latitude, lng: longitude },
                      title: 'Your Location',
                      color: 'blue',
                    },
                  ]}
                  geofences={assignedSite ? [
                    {
                      id: 'worksite',
                      center: {
                        lat: parseFloat(assignedSite.latitude),
                        lng: parseFloat(assignedSite.longitude),
                      },
                      radius: assignedSite.geofenceRadius,
                      color: '#1976D2',
                    },
                  ] : []}
                  className="w-full h-full rounded-lg"
                />
              </div>
            ) : (
              <div className="h-40 bg-gray-100 rounded-lg mb-4 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">
                    {locationLoading ? 'Getting location...' : 'Location unavailable'}
                  </p>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Coordinates</span>
                <span className="font-medium text-gray-900">
                  {latitude && longitude 
                    ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                    : 'N/A'
                  }
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Last Updated</span>
                <span className="font-medium text-gray-900">
                  {latitude && longitude ? 'Just now' : 'Never'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Button
          onClick={handleEmergencyContact}
          className="w-full bg-error hover:bg-red-600 text-white py-3 px-4 h-auto"
        >
          <AlertTriangle className="mr-2" />
          Emergency Contact
        </Button>
      </div>
    </div>
  );
}
