import React, { useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken, getUserType } from '@/lib/auth';
import { loadGoogleMapsAPI } from '@/lib/google-maps';
import GoogleMap from '@/components/google-map';
import { useWebSocket } from '@/hooks/useWebSocket';
import { 
  ArrowLeft, 
  Download, 
  Users, 
  MapPin, 
  Plus,
  Minus,
  Maximize 
} from 'lucide-react';

interface EmployeeLocation {
  employee: any;
  location: any;
}

export default function LiveTracking() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [employeeLocations, setEmployeeLocations] = useState<EmployeeLocation[]>([]);
  const [mapCenter] = useState({ lat: 28.44065, lng: 77.08154 }); // Default to Delhi area
  const [mapZoom, setMapZoom] = useState(12);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const initializeCalledRef = useRef(false);

  // Initialize component only once
  React.useEffect(() => {
    if (initializeCalledRef.current) return;
    initializeCalledRef.current = true;

    const token = getAuthToken();
    const userType = getUserType();
    
    if (!token || userType !== 'admin') {
      toast({
        title: 'Unauthorized',
        description: 'Please log in as an admin to access this page.',
        variant: 'destructive',
      });
      setLocation('/admin/login');
      return;
    }

    // Load Google Maps API
    loadGoogleMapsAPI()
      .then(() => setMapLoaded(true))
      .catch((error) => {
        console.error('Failed to load Google Maps:', error);
        toast({
          title: 'Error',
          description: 'Failed to load Google Maps. Map features will not work.',
          variant: 'destructive',
        });
      });

    // Fullscreen event listeners
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['/api/admin/locations'],
    enabled: !!getAuthToken() && getUserType() === 'admin',
    refetchInterval: 30000,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['/api/admin/sites'],
    enabled: !!getAuthToken() && getUserType() === 'admin',
  });

  // WebSocket for real-time updates
  const { isConnected } = useWebSocket({
    onMessage: (data) => {
      if (data.type === 'employee_location') {
        setEmployeeLocations(prev => {
          const updated = prev.map(item => 
            item.employee.id === data.employeeId 
              ? { ...item, location: data.location }
              : item
          );
          
          if (!prev.find(item => item.employee.id === data.employeeId)) {
            updated.push({
              employee: data.employee,
              location: data.location
            });
          }
          
          return updated;
        });
      }
    }
  });

  const getStatusColor = (employee: any, location: any) => {
    if (!location) return 'bg-gray-500';
    
    const assignedSites = Array.isArray(sites) ? sites.filter((site: any) => 
      Array.isArray(employee.assignedSites) && employee.assignedSites.includes(site.id)
    ) : [];
    
    if (assignedSites.length === 0) return 'bg-gray-500';
    
    for (const site of assignedSites) {
      const distance = calculateDistance(
        location.latitude, location.longitude,
        site.latitude, site.longitude
      );
      if (distance <= site.geofenceRadius) {
        return 'bg-green-500';
      }
    }
    
    return 'bg-red-500';
  };

  const getStatusText = (employee: any, location: any) => {
    if (!location) return 'No Location';
    
    const assignedSites = Array.isArray(sites) ? sites.filter((site: any) => 
      Array.isArray(employee.assignedSites) && employee.assignedSites.includes(site.id)
    ) : [];
    
    if (assignedSites.length === 0) return 'No Assigned Site';
    
    for (const site of assignedSites) {
      const distance = calculateDistance(
        location.latitude, location.longitude,
        site.latitude, site.longitude
      );
      if (distance <= site.geofenceRadius) {
        return `On Site: ${site.name}`;
      }
    }
    
    return 'Outside Site Boundary';
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const getSiteName = (siteId: number) => {
    const site = Array.isArray(sites) ? sites.find((s: any) => s.id === siteId) : null;
    return site?.name || 'Unknown Site';
  };

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    setMapZoom(prev => {
      if (direction === 'in') {
        return Math.min(prev + 1, 20);
      } else {
        return Math.max(prev - 1, 1);
      }
    });
  }, []);

  const toggleMapType = useCallback(() => {
    setMapType(prev => prev === 'roadmap' ? 'satellite' : 'roadmap');
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => {
      const newFullscreenState = !prev;
      
      if (newFullscreenState) {
        document.documentElement.requestFullscreen?.();
      } else {
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        }
      }
      
      return newFullscreenState;
    });
  }, []);

  const goToEmployeeProfile = useCallback((employeeId: number) => {
    setLocation(`/admin/employees/${employeeId}`);
  }, [setLocation]);

  const getMapMarkers = () => {
    const markers: any[] = [];
    
    if (Array.isArray(locations)) {
      locations.forEach((item: any) => {
        if (item.location?.latitude && item.location?.longitude) {
          markers.push({
            position: { lat: item.location.latitude, lng: item.location.longitude },
            title: `${item.employee.firstName} ${item.employee.lastName}`,
            color: getStatusColor(item.employee, item.location) === 'bg-green-500' ? 'green' : 
                   getStatusColor(item.employee, item.location) === 'bg-red-500' ? 'red' : 'gray',
          });
        }
      });
    }
    
    return markers;
  };

  const getMapGeofences = () => {
    if (!Array.isArray(sites)) return [];
    
    return sites.map((site: any) => ({
      center: { lat: site.latitude, lng: site.longitude },
      radius: site.geofenceRadius,
      color: '#1976D2',
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => setLocation('/admin/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">Live Employee Tracking</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600">
                {isConnected ? 'Live Updates' : 'Connecting...'}
              </span>
            </div>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Currently Tracked</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {Array.isArray(locations) ? locations.length : 0}
              </div>
              <p className="text-xs text-muted-foreground">employees online</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On Site</CardTitle>
              <MapPin className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {Array.isArray(locations) ? 
                  locations.filter((item: any) => 
                    getStatusColor(item.employee, item.location) === 'bg-green-500'
                  ).length : 0
                }
              </div>
              <p className="text-xs text-muted-foreground">within boundaries</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Outside Boundary</CardTitle>
              <MapPin className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {Array.isArray(locations) ? 
                  locations.filter((item: any) => 
                    getStatusColor(item.employee, item.location) === 'bg-red-500'
                  ).length : 0
                }
              </div>
              <p className="text-xs text-muted-foreground">need attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Employee List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Employee Status</h2>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {Array.isArray(locations) && locations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No employees currently tracked
                  </div>
                ) : (
                  Array.isArray(locations) && locations.map((item: any) => (
                    <Card key={item.employee.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4" onClick={() => goToEmployeeProfile(item.employee.id)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(item.employee, item.location)}`}></div>
                            <div>
                              <p className="font-medium text-gray-900 hover:text-blue-600">
                                {item.employee.firstName} {item.employee.lastName}
                              </p>
                              <p className="text-sm text-gray-500">{item.employee.email}</p>
                            </div>
                          </div>
                          <Badge variant={getStatusColor(item.employee, item.location) === 'bg-green-500' ? 'default' : 'destructive'}>
                            {getStatusText(item.employee, item.location)}
                          </Badge>
                        </div>
                        
                        {item.location && (
                          <div className="mt-2 text-xs text-gray-500">
                            Last updated: {new Date(item.location.timestamp).toLocaleTimeString()}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            )}
          </div>
          
          {/* Interactive Map */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Real-time Map</h2>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>On Site</span>
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span>Outside Boundary</span>
                    <div className="w-3 h-3 bg-blue-500 rounded-full opacity-30"></div>
                    <span>Site Boundary</span>
                  </div>
                </div>
              </div>
              
              {/* Interactive Map Container */}
              <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white' : 'h-96 lg:h-[500px]'} relative`}>
                {mapLoaded ? (
                  <GoogleMap
                    center={mapCenter}
                    zoom={mapZoom}
                    mapType={mapType}
                    markers={getMapMarkers()}
                    geofences={getMapGeofences()}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                      <p className="text-gray-600">Loading map...</p>
                    </div>
                  </div>
                )}
                
                {/* Map Controls */}
                <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-2 space-y-2">
                  <Button variant="ghost" size="sm" onClick={() => handleZoom('in')} title="Zoom In">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleZoom('out')} title="Zoom Out">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={toggleMapType} title="Toggle Satellite View">
                    {mapType === 'roadmap' ? 'Satellite' : 'Map'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={toggleFullscreen} title="Toggle Fullscreen">
                    <Maximize className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}