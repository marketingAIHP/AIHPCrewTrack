import { useState, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { getAuthToken, getUserType } from '@/lib/auth';
import { useWebSocket } from '@/hooks/use-websocket';
import GoogleMap, { loadGoogleMapsAPI } from '@/components/google-map';
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
  const [mapCenter, setMapCenter] = useState({ lat: 40.7128, lng: -74.0060 });

  useEffect(() => {
    if (!getAuthToken() || getUserType() !== 'admin') {
      toast({
        title: 'Unauthorized',
        description: 'Please log in as an admin to access this page.',
        variant: 'destructive',
      });
      setLocation('/admin/login');
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
  }, []);

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['/api/admin/locations'],
    enabled: !!getAuthToken() && getUserType() === 'admin',
    refetchInterval: 30000, // Refetch every 30 seconds
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
              ? {
                  ...item,
                  location: {
                    latitude: data.latitude,
                    longitude: data.longitude,
                    isOnSite: data.isOnSite,
                    timestamp: data.timestamp,
                  }
                }
              : item
          );
          return updated;
        });
      }
    },
  });

  useEffect(() => {
    if (locations) {
      setEmployeeLocations(locations);
      
      // Center map on first location with valid coordinates
      const firstLocation = locations.find((loc: any) => loc.location);
      if (firstLocation?.location) {
        setMapCenter({
          lat: parseFloat(firstLocation.location.latitude),
          lng: parseFloat(firstLocation.location.longitude),
        });
      }
    }
  }, [locations]);

  const getMapMarkers = () => {
    return employeeLocations
      .filter(item => item.location)
      .map(item => ({
        id: item.employee.id.toString(),
        position: {
          lat: parseFloat(item.location.latitude),
          lng: parseFloat(item.location.longitude),
        },
        title: `${item.employee.firstName} ${item.employee.lastName}`,
        color: item.location.isOnSite ? 'green' : 'yellow' as 'green' | 'yellow',
      }));
  };

  const getMapGeofences = () => {
    return sites?.map((site: any) => ({
      id: site.id.toString(),
      center: {
        lat: parseFloat(site.latitude),
        lng: parseFloat(site.longitude),
      },
      radius: site.geofenceRadius,
      color: '#1976D2',
    })) || [];
  };

  const getSiteName = (siteId: number) => {
    const site = sites?.find((s: any) => s.id === siteId);
    return site?.name || 'Unknown Site';
  };

  if (!getAuthToken() || getUserType() !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Link href="/admin/dashboard">
                <Button variant="ghost" size="sm" className="mr-4">
                  <ArrowLeft />
                </Button>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">Live Employee Tracking</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full animate-pulse ${isConnected ? 'bg-success' : 'bg-error'}`}></div>
                <span className="text-sm text-gray-600">
                  {isConnected ? 'Live Updates' : 'Disconnected'}
                </span>
              </div>
              <Button className="bg-primary text-white hover:bg-blue-700">
                <Download className="mr-2 h-4 w-4" />
                Export Data
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Employee List Sidebar */}
          <div className="lg:col-span-1">
            <Card>
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-gray-900">Active Employees</h3>
                <p className="text-sm text-gray-600">
                  {employeeLocations.filter(item => item.location).length} currently tracked
                </p>
              </div>
              <CardContent className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {isLoading ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-gray-500">Loading employees...</p>
                  </div>
                ) : employeeLocations.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-500">No employees tracked</p>
                  </div>
                ) : (
                  employeeLocations.map((item) => (
                    <div key={item.employee.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-700">
                          {item.employee.firstName[0]}{item.employee.lastName[0]}
                        </span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {item.employee.firstName} {item.employee.lastName}
                        </p>
                        <p className="text-xs text-gray-600">
                          {item.employee.siteId ? getSiteName(item.employee.siteId) : 'No site assigned'}
                        </p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        item.location?.isOnSite ? 'bg-success' : 
                        item.location ? 'bg-warning' : 'bg-gray-400'
                      }`}></div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Map Area */}
          <div className="lg:col-span-3">
            <Card className="overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900">Real-Time Location Map</h3>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">Satellite</Button>
                    <Button size="sm" className="bg-primary text-white">Map</Button>
                  </div>
                </div>
              </div>
              
              {/* Interactive Map Container */}
              <div className="h-96 lg:h-[500px] relative">
                {mapLoaded ? (
                  <GoogleMap
                    center={mapCenter}
                    zoom={12}
                    markers={getMapMarkers()}
                    geofences={getMapGeofences()}
                    className="w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="mx-auto h-12 w-12 text-gray-400 mb-2" />
                      <p className="text-gray-600">Loading map...</p>
                    </div>
                  </div>
                )}
                
                {/* Map Controls */}
                <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-2 space-y-2">
                  <Button variant="ghost" size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Maximize className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Map Legend */}
              <div className="p-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex space-x-6">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-success rounded-full"></div>
                      <span className="text-sm text-gray-600">On Site</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-warning rounded-full"></div>
                      <span className="text-sm text-gray-600">Outside Boundary</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 border-2 border-dashed border-primary rounded-full"></div>
                      <span className="text-sm text-gray-600">Site Boundary</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    Last updated: <span className="font-medium">just now</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
