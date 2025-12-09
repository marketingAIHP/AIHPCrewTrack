import React, { useState, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Maximize,
  RefreshCw
} from 'lucide-react';
import ExportReportDialog from '@/components/ExportReportDialog';

interface EmployeeLocation {
  employee: any;
  location: any;
}

export default function LiveTracking() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [mapLoaded, setMapLoaded] = useState(false);
  const [employeeLocations, setEmployeeLocations] = useState<EmployeeLocation[]>([]);
  const [mapCenter, setMapCenter] = useState({ lat: 28.44065, lng: 77.08154 }); // Default to Delhi area
  const [mapZoom, setMapZoom] = useState(12);
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('roadmap');
  const [useClustering, setUseClustering] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [profileImageModalOpen, setProfileImageModalOpen] = useState(false);
  const [selectedProfileImage, setSelectedProfileImage] = useState<{url: string, name: string} | null>(null);
  const initializeCalledRef = useRef(false);
  const zoomedSiteIdRef = useRef<number | null>(null);
  const zoomedEmployeeIdRef = useRef<number | null>(null);

  // Check authentication on every render - this page is admin-only
  const token = getAuthToken();
  const userType = getUserType();
  
  // Immediately redirect if not admin - don't render anything
  React.useEffect(() => {
    if (!token || userType !== 'admin') {
      toast({
        title: 'Unauthorized',
        description: 'This page is only accessible to administrators.',
        variant: 'destructive',
      });
      setLocation('/admin/login');
    }
  }, [token, userType, setLocation, toast]);

  // Don't render anything if user is not an admin
  if (!token || userType !== 'admin') {
    return null;
  }

  // Initialize component only once
  React.useEffect(() => {
    if (initializeCalledRef.current) return;
    initializeCalledRef.current = true;

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

  const queryClient = useQueryClient();
  const { data: locations = [], isLoading, refetch: refetchLocations, isRefetching } = useQuery({
    queryKey: ['/api/admin/locations'],
    enabled: !!getAuthToken() && getUserType() === 'admin',
    refetchInterval: 10000, // Update every 10 seconds for real-time tracking
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['/api/admin/sites'],
    enabled: !!getAuthToken() && getUserType() === 'admin',
  });

  // Get siteId from URL query parameter and zoom to that site
  React.useEffect(() => {
    if (!sites || sites.length === 0 || !mapLoaded) return;

    const urlParams = new URLSearchParams(window.location.search);
    const siteIdParam = urlParams.get('siteId');
    
    if (siteIdParam) {
      const siteId = parseInt(siteIdParam);
      if (!Number.isNaN(siteId) && zoomedSiteIdRef.current !== siteId) {
        const selectedSite = Array.isArray(sites) 
          ? sites.find((site: any) => site.id === siteId) 
          : null;
        
        if (selectedSite) {
          const lat = parseFloat(selectedSite.latitude);
          const lng = parseFloat(selectedSite.longitude);
          
          if (!isNaN(lat) && !isNaN(lng)) {
            // Zooming to selected site
            setMapCenter({ lat, lng });
            // Zoom to a close level to show the site clearly (zoom level 17 is good for site view)
            setMapZoom(17);
            zoomedSiteIdRef.current = siteId;
            
            toast({
              title: 'Viewing Site',
              description: `Centered map on ${selectedSite.name}`,
            });
          }
        }
      }
    }
  }, [sites, mapLoaded, toast]);

  // Zoom to specific employee when employeeId is provided in query params
  React.useEffect(() => {
    if (!mapLoaded) return;
    if (!Array.isArray(locations) || locations.length === 0) return;

    const urlParams = new URLSearchParams(window.location.search);
    const employeeIdParam = urlParams.get('employeeId');
    if (!employeeIdParam) return;

    const employeeId = parseInt(employeeIdParam, 10);
    if (Number.isNaN(employeeId)) return;

    if (zoomedEmployeeIdRef.current === employeeId) return;

    const employeeEntry = locations.find((item: any) => item.employee?.id === employeeId);
    const lat = employeeEntry?.location?.latitude;
    const lng = employeeEntry?.location?.longitude;

    if (lat != null && lng != null) {
      const parsedLat = parseFloat(lat);
      const parsedLng = parseFloat(lng);
      if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
        setMapCenter({ lat: parsedLat, lng: parsedLng });
        setMapZoom(18);
        zoomedEmployeeIdRef.current = employeeId;
        toast({
          title: 'Live Tracking',
          description: `Centered on ${employeeEntry.employee.firstName} ${employeeEntry.employee.lastName}`,
        });
      }
    }
  }, [mapLoaded, locations, toast]);

  // WebSocket for real-time updates
  const { isConnected } = useWebSocket({
    onMessage: (data) => {
      if (data.type === 'employee_location') {
        // Invalidate and refetch locations when WebSocket receives update
        queryClient.invalidateQueries({ queryKey: ['/api/admin/locations'] });
      }
    }
  });

  // Sync locations from query data
  React.useEffect(() => {
    if (Array.isArray(locations)) {
      setEmployeeLocations(locations);
    }
  }, [locations]);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    await refetchLocations();
    toast({
      title: 'Location Updated',
      description: 'Employee locations have been refreshed',
    });
  }, [refetchLocations, toast]);

  const isLocationOnSite = (location: any, employee: any) => {
    // Remote employees are always considered "on site"
    if (employee?.isRemote) return true;
    return location?.isOnSite ?? location?.isWithinGeofence ?? false;
  };

  const getStatusColor = (employee: any, location: any) => {
    // Remote employees always show as purple (on site)
    if (employee?.isRemote) return 'bg-purple-500';
    
    if (!location) return 'bg-gray-500';
    
    // Check if employee has a siteId (assigned site) - handle both camelCase and snake_case
    const siteId = employee.siteId || employee.site_id;
    if (!siteId) return 'bg-gray-500';
    
    // Find the assigned site
    const assignedSite = Array.isArray(sites) ? sites.find((site: any) => site.id === siteId) : null;
    
    if (!assignedSite) return 'bg-gray-500';
    
    // Check if location is within the geofence using isWithinGeofence from server
    if (isLocationOnSite(location, employee)) {
      return 'bg-green-500';
    }
    
    return 'bg-red-500';
  };

  const getStatusColorHex = (employee: any, location: any) => {
    // Remote employees always show as purple
    if (employee?.isRemote) return '#9333ea';
    
    if (!location) return '#6b7280';
    
    const siteId = employee.siteId || employee.site_id;
    if (!siteId) return '#6b7280';
    
    const assignedSite = Array.isArray(sites) ? sites.find((site: any) => site.id === siteId) : null;
    if (!assignedSite) return '#6b7280';
    
    if (isLocationOnSite(location, employee)) {
      return '#22c55e';
    }
    
    return '#ef4444';
  };

  const getStatusText = (employee: any, location: any) => {
    // Remote employees
    if (employee?.isRemote) {
      return 'Remote Work';
    }
    
    if (!location || location.id === 0) return 'No Location';
    
    // Check if employee has a siteId (assigned site) - handle both camelCase and snake_case
    const siteId = employee.siteId || employee.site_id;
    if (!siteId) {
      return 'No Assigned Site';
    }
    
    // Find the assigned site
    const assignedSite = Array.isArray(sites) ? sites.find((site: any) => site.id === siteId) : null;
    
    if (!assignedSite) {
      return 'Unknown Site';
    }
    
    // Use server-calculated isWithinGeofence status
    if (isLocationOnSite(location, employee)) {
      return `On Site: ${assignedSite.name}`;
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

  const fitToBounds = useCallback(() => {
    const markerPositions: Array<{ lat: number; lng: number }> = [];
    if (Array.isArray(locations)) {
      locations.forEach((item: any) => {
        if (item.location?.latitude && item.location?.longitude) {
          const lat = parseFloat(item.location.latitude);
          const lng = parseFloat(item.location.longitude);
          if (!isNaN(lat) && !isNaN(lng)) markerPositions.push({ lat, lng });
        }
      });
    }
    if (Array.isArray(sites)) {
      sites.forEach((site: any) => {
        const lat = parseFloat(site.latitude);
        const lng = parseFloat(site.longitude);
        if (!isNaN(lat) && !isNaN(lng)) markerPositions.push({ lat, lng });
      });
    }

    if (markerPositions.length === 0) return;

    // Compute center
    const avgLat = markerPositions.reduce((sum, p) => sum + p.lat, 0) / markerPositions.length;
    const avgLng = markerPositions.reduce((sum, p) => sum + p.lng, 0) / markerPositions.length;
    setMapCenter({ lat: avgLat, lng: avgLng });

    // Compute approximate span and pick a zoom
    let maxDistance = 0;
    for (let i = 0; i < markerPositions.length; i++) {
      maxDistance = Math.max(maxDistance, calculateDistance(avgLat, avgLng, markerPositions[i].lat, markerPositions[i].lng));
    }
    // Heuristic zoom mapping
    let newZoom = 12;
    if (maxDistance > 50000) newZoom = 8;
    else if (maxDistance > 20000) newZoom = 10;
    else if (maxDistance > 5000) newZoom = 12;
    else if (maxDistance > 2000) newZoom = 13;
    else if (maxDistance > 1000) newZoom = 14;
    else newZoom = 15;
    setMapZoom(newZoom);
  }, [locations, sites]);

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

  // Function to zoom to specific employee location
  const zoomToLocation = useCallback((lat: number, lng: number) => {
    setMapCenter({ lat, lng });
    setMapZoom(18); // Close zoom level to see the employee clearly
  }, []);

  const getMapMarkers = () => {
    const markers: any[] = [];
    
    // Add employee markers (red person icons) with optional clustering
    if (Array.isArray(locations)) {
      if (useClustering) {
        const clusterMap = new Map<string, { lat: number; lng: number; count: number }>();
        locations.forEach((item: any) => {
          if (item.location?.latitude && item.location?.longitude) {
            const lat = parseFloat(item.location.latitude);
            const lng = parseFloat(item.location.longitude);
            if (isNaN(lat) || isNaN(lng)) return;
            // Simple grid-based clustering (~110m at equator per 0.001 degree)
            const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
            const existing = clusterMap.get(key);
            if (existing) {
              existing.count += 1;
            } else {
              clusterMap.set(key, { lat, lng, count: 1 });
            }
          }
        });
        clusterMap.forEach(({ lat, lng, count }) => {
          markers.push({
            position: { lat, lng },
            title: count > 1 ? `${count} employees` : `1 employee`,
            color: '#ff0000',
            type: 'employee',
            label: count.toString(),
            onClick: () => zoomToLocation(lat, lng),
          });
        });
      } else {
        locations.forEach((item: any) => {
          // For remote employees, show marker even if location is placeholder (id === 0)
          const hasValidLocation = item.location?.latitude && item.location?.longitude && item.location.id !== 0;
          const isRemote = item.employee?.isRemote;
          
          if (hasValidLocation || isRemote) {
            // For remote employees without location, use last known location or skip marker
            if (isRemote && (!item.location || item.location.id === 0)) {
              // Skip marker for remote employees without location data
              return;
            }
            
            const lat = parseFloat(item.location.latitude);
            const lng = parseFloat(item.location.longitude);
            
            if (!isNaN(lat) && !isNaN(lng)) {
              markers.push({
                position: { lat, lng },
                title: `${item.employee.firstName} ${item.employee.lastName}${isRemote ? ' (Remote)' : ''}`,
                color: getStatusColorHex(item.employee, item.location),
                type: 'employee',
                onClick: () => zoomToLocation(lat, lng),
              });
            }
          }
        });
      }
    }
    
    // Add site markers (green building icons)
    if (Array.isArray(sites)) {
      sites.forEach((site: any) => {
        const lat = parseFloat(site.latitude);
        const lng = parseFloat(site.longitude);
        
        if (!isNaN(lat) && !isNaN(lng)) {
          markers.push({
            position: { lat, lng },
            title: `Work Site: ${site.name}`,
            color: '#22c55e', // Green color for sites
            type: 'site',
            label: site.name,
            onClick: () => zoomToLocation(lat, lng), // Can also zoom to site
          });
        }
      });
    }
    
    return markers;
  };

  const getMapGeofences = () => {
    if (!Array.isArray(sites)) return [];
    
    return sites.map((site: any) => {
      const lat = parseFloat(site.latitude);
      const lng = parseFloat(site.longitude);
      const radius = parseFloat(site.geofenceRadius);
      
      if (!isNaN(lat) && !isNaN(lng) && !isNaN(radius)) {
        return {
          center: { lat, lng },
          radius: radius,
          color: '#1976D2',
        };
      }
      return null;
    }).filter((item): item is { center: { lat: number; lng: number }; radius: number; color: string } => item !== null);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Page Title */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => setLocation('/admin/dashboard')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Live Employee Tracking</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-gray-600 dark:text-slate-400">
                {isConnected ? 'Live Updates' : 'Connecting...'}
              </span>
            </div>
            <Button 
              variant="outline" 
              onClick={handleRefresh}
              disabled={isRefetching}
              className="flex items-center space-x-2"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              <span>Refresh Locations</span>
            </Button>
            <ExportReportDialog>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
            </ExportReportDialog>
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
                  locations.filter((item: any) => isLocationOnSite(item.location, item.employee)).length : 0
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
                  locations.filter((item: any) => item.location && !isLocationOnSite(item.location, item.employee)).length : 0
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Employee Status</h2>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {Array.isArray(locations) && locations.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                    No employees currently tracked
                  </div>
                ) : (
                  Array.isArray(locations) && locations.map((item: any) => (
                    <Card key={item.employee.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4" onClick={() => goToEmployeeProfile(item.employee.id)}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="relative">
                              {item.employee.profileImage ? (
                                <img
                                  src={item.employee.profileImage}
                                  alt={`${item.employee.firstName} ${item.employee.lastName}`}
                                  className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProfileImage({
                                      url: item.employee.profileImage!,
                                      name: `${item.employee.firstName} ${item.employee.lastName}`
                                    });
                                    setProfileImageModalOpen(true);
                                  }}
                                />
                              ) : (
                                <div className="w-10 h-10 bg-gray-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
                                  <span className="text-gray-600 dark:text-slate-300 font-medium text-sm">
                                    {item.employee.firstName[0]}{item.employee.lastName[0]}
                                  </span>
                                </div>
                              )}
                              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${getStatusColor(item.employee, item.location)}`}></div>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400">
                                {item.employee.firstName} {item.employee.lastName}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-slate-400">{item.employee.email}</p>
                            </div>
                          </div>
                          <Badge variant={getStatusColor(item.employee, item.location) === 'bg-green-500' ? 'default' : 'destructive'}>
                            {getStatusText(item.employee, item.location)}
                          </Badge>
                        </div>
                        
                        {item.location && (
                          <div className="mt-2 text-xs text-gray-500 dark:text-slate-400">
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
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Real-time Map</h2>
              <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-4 text-sm text-gray-700 dark:text-slate-300">
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span>Employees</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span>Work Sites</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <div className="w-3 h-3 bg-blue-500 rounded-full opacity-30"></div>
                      <span>Site Boundary</span>
                    </div>
                  </div>
                <div className="hidden md:flex items-center space-x-2 text-sm text-gray-700 dark:text-slate-300">
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="h-4 w-4" checked={useClustering} onChange={(e) => setUseClustering(e.target.checked)} />
                    <span>Cluster markers</span>
                  </label>
                </div>
                </div>
              </div>
              
              {/* Interactive Map Container */}
              <div className={`${isFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-slate-900' : 'h-96 lg:h-[500px]'} relative`}>
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
                  <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-slate-700 rounded-lg">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-2"></div>
                      <p className="text-gray-600 dark:text-slate-300">Loading map...</p>
                    </div>
                  </div>
                )}
                
                {/* Map Controls */}
                <div className="absolute top-4 right-4 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-2 space-y-2 border border-slate-200 dark:border-slate-700">
                  <Button variant="ghost" size="sm" onClick={() => handleZoom('in')} title="Zoom In">
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleZoom('out')} title="Zoom Out">
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={toggleMapType} title="Toggle Satellite View">
                    {mapType === 'roadmap' ? 'Satellite' : 'Map'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={fitToBounds} title="Fit to bounds">
                    Fit
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

      {/* Profile Image Modal */}
      <Dialog open={profileImageModalOpen} onOpenChange={setProfileImageModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Profile Picture</DialogTitle>
            <DialogDescription>
              {selectedProfileImage?.name}
            </DialogDescription>
          </DialogHeader>
          {selectedProfileImage && (
            <div className="flex justify-center p-4">
              <img
                src={selectedProfileImage.url}
                alt={selectedProfileImage.name}
                className="max-w-full max-h-96 object-contain rounded-lg"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}