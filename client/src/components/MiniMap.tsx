import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAuthToken } from '@/lib/auth';
import { MapPin } from 'lucide-react';

declare global {
  interface Window {
    google: any;
    initMap: () => void;
  }
}

interface MiniMapProps {
  height?: string;
  showEmployeeCount?: boolean;
}

export default function MiniMap({ height = '256px', showEmployeeCount = true }: MiniMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Fetch configuration including Google Maps API key
  const { data: config } = useQuery<{ GOOGLE_MAPS_API_KEY: string }>({
    queryKey: ['/api/config'],
  });

  // Fetch work sites and employees data
  const { data: sites = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/sites'],
    enabled: !!getAuthToken(),
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/employees'],
    enabled: !!getAuthToken(),
  });

  // Load Google Maps API
  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google && window.google.maps) {
      setIsLoaded(true);
      return;
    }

    // Check if API key is available
    if (!config?.GOOGLE_MAPS_API_KEY) {
      console.warn('Google Maps API key not configured');
      setHasError(true);
      return;
    }

    // Check if script is already being loaded
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkGoogle = setInterval(() => {
        if (window.google && window.google.maps) {
          setIsLoaded(true);
          clearInterval(checkGoogle);
        }
      }, 100);
      return () => clearInterval(checkGoogle);
    }

    // Create unique callback name to avoid conflicts
    const callbackName = `initMap_${Date.now()}`;
    
    // Create callback function
    (window as any)[callbackName] = () => {
      setIsLoaded(true);
      delete (window as any)[callbackName]; // Cleanup
    };

    // Load Google Maps script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${config.GOOGLE_MAPS_API_KEY}&callback=${callbackName}&loading=async`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      console.error('Failed to load Google Maps API - Invalid API key');
      setHasError(true);
      setIsLoaded(false);
      delete (window as any)[callbackName]; // Cleanup
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete (window as any)[callbackName];
    };
  }, [config]);

  // Initialize map when Google Maps is loaded
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstance || hasError || !window.google) return;

    // Default center (can be customized based on sites)
    let center = { lat: 37.7749, lng: -122.4194 }; // San Francisco default
    
    // If we have sites, center on the first one
    if (sites.length > 0) {
      center = {
        lat: parseFloat(sites[0].latitude),
        lng: parseFloat(sites[0].longitude)
      };
    }

    const map = new window.google.maps.Map(mapRef.current, {
      zoom: sites.length > 0 ? 13 : 10,
      center,
      mapTypeId: 'roadmap',
      disableDefaultUI: true,
      gestureHandling: 'none',
      zoomControl: false,
      scrollwheel: false,
      disableDoubleClickZoom: true,
      draggable: false,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }]
        }
      ]
    });

    setMapInstance(map);
  }, [isLoaded, sites]);

  // Add markers for work sites
  useEffect(() => {
    if (!mapInstance || !sites.length) return;

    // Clear existing markers (if any)
    // Note: In a production app, you'd want to manage markers more efficiently

    sites.forEach((site: any) => {
      if (site.latitude && site.longitude) {
        const marker = new window.google.maps.Marker({
          position: {
            lat: parseFloat(site.latitude),
            lng: parseFloat(site.longitude)
          },
          map: mapInstance,
          title: site.name,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" fill="#3B82F6" stroke="#1E40AF" stroke-width="2"/>
                <circle cx="12" cy="10" r="3" fill="white"/>
              </svg>
            `),
            scaledSize: new window.google.maps.Size(24, 24),
            anchor: new window.google.maps.Point(12, 24)
          }
        });

        // Add geofence circle
        new window.google.maps.Circle({
          strokeColor: '#3B82F6',
          strokeOpacity: 0.4,
          strokeWeight: 2,
          fillColor: '#3B82F6',
          fillOpacity: 0.1,
          map: mapInstance,
          center: {
            lat: parseFloat(site.latitude),
            lng: parseFloat(site.longitude)
          },
          radius: site.geofenceRadius || 200
        });
      }
    });
  }, [mapInstance, sites]);

  const activeEmployees = employees.filter((emp: any) => emp.isActive).length;

  if (hasError || (!isLoaded && !window.google)) {
    return (
      <div 
        className="bg-gray-100 rounded-lg flex items-center justify-center"
        style={{ height }}
      >
        <div className="bg-white bg-opacity-95 rounded-lg p-6 text-center max-w-sm">
          <MapPin className="text-blue-500 text-3xl mb-3 mx-auto" />
          <p className="text-base font-semibold text-gray-900 mb-2">Live Locations Map</p>
          <p className="text-sm text-gray-600 mb-3">
            Map requires valid Google Maps API key
          </p>
          {showEmployeeCount && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-sm font-medium text-gray-700">
                {sites.length} work sites • {activeEmployees} active employees
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg overflow-hidden" style={{ height }}>
      <div ref={mapRef} className="w-full h-full" />
      {showEmployeeCount && (
        <div className="absolute bottom-3 left-3 bg-white bg-opacity-90 rounded-lg px-3 py-2 shadow-sm">
          <div className="flex items-center space-x-2">
            <MapPin className="text-primary text-sm" />
            <span className="text-xs font-medium text-gray-900">
              {sites.length} sites • {activeEmployees} employees
            </span>
          </div>
        </div>
      )}
    </div>
  );
}