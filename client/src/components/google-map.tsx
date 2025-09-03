import { useEffect, useRef } from 'react';

interface GoogleMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  mapType?: 'roadmap' | 'satellite';
  markers?: Array<{
    position: { lat: number; lng: number };
    title: string;
    color?: string;
    type?: 'employee' | 'site';
    onClick?: () => void;
  }>;
  geofences?: Array<{
    center: { lat: number; lng: number };
    radius: number;
    color?: string;
  }>;
  className?: string;
  onMapClick?: (lat: number, lng: number) => void;
}

export default function GoogleMap({
  center,
  zoom = 13,
  mapType = 'roadmap',
  markers = [],
  geofences = [],
  className = '',
  onMapClick,
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const circlesRef = useRef<google.maps.Circle[]>([]);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;

    // Initialize Google Map
    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center,
      zoom,
      mapTypeId: mapType === 'satellite' ? 'satellite' : 'roadmap',
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: false,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false,
      disableDefaultUI: true,
      scrollwheel: true, // Enable mouse wheel zoom
      gestureHandling: 'auto', // Enable all gestures including zoom
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    // Add click listener
    if (onMapClick) {
      mapInstanceRef.current.addListener('click', (event: google.maps.MapMouseEvent) => {
        if (event.latLng) {
          onMapClick(event.latLng.lat(), event.latLng.lng());
        }
      });
    }
  }, []);

  // Update map center when prop changes
  useEffect(() => {
    if (mapInstanceRef.current && center && typeof center.lat === 'number' && typeof center.lng === 'number') {
      mapInstanceRef.current.setCenter(center);
    }
  }, [center]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add new markers with custom icons
    markers.forEach(markerData => {
      let customIcon;
      
      if (markerData.type === 'site') {
        // Create custom site icon SVG (building/location marker in green)
        customIcon = {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" 
                    fill="${markerData.color || '#22c55e'}" stroke="#ffffff" stroke-width="1"/>
              <rect x="8" y="6" width="8" height="10" rx="1" fill="#ffffff"/>
              <rect x="9" y="7" width="2" height="2" fill="${markerData.color || '#22c55e'}"/>
              <rect x="13" y="7" width="2" height="2" fill="${markerData.color || '#22c55e'}"/>
              <rect x="9" y="10" width="2" height="2" fill="${markerData.color || '#22c55e'}"/>
              <rect x="13" y="10" width="2" height="2" fill="${markerData.color || '#22c55e'}"/>
              <rect x="11" y="13" width="2" height="3" fill="${markerData.color || '#22c55e'}"/>
            </svg>
          `)}`,
          scaledSize: new (window as any).google.maps.Size(32, 32),
          anchor: new (window as any).google.maps.Point(16, 32),
        };
      } else {
        // Create custom person icon SVG (default for employees)
        customIcon = {
          url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" 
                    fill="${markerData.color || '#ff0000'}" stroke="#ffffff" stroke-width="1"/>
              <circle cx="12" cy="8.5" r="2" fill="#ffffff"/>
              <path d="M8.5 13.5c0-1.5 1.57-2.5 3.5-2.5s3.5 1 3.5 2.5v1h-7v-1z" fill="#ffffff"/>
            </svg>
          `)}`,
          scaledSize: new (window as any).google.maps.Size(32, 32),
          anchor: new (window as any).google.maps.Point(16, 32),
        };
      }

      const marker = new google.maps.Marker({
        position: markerData.position,
        map: mapInstanceRef.current,
        title: markerData.title,
        icon: customIcon,
      });

      // Add click listener if onClick is provided
      if (markerData.onClick) {
        (marker as any).addListener('click', markerData.onClick);
      }

      markersRef.current.push(marker);
    });
  }, [markers]);

  // Update geofences
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing circles
    circlesRef.current.forEach(circle => circle.setMap(null));
    circlesRef.current = [];

    // Add new circles
    geofences.forEach(geofence => {
      const circle = new google.maps.Circle({
        center: geofence.center,
        radius: geofence.radius,
        map: mapInstanceRef.current,
        fillColor: geofence.color || '#1976D2',
        fillOpacity: 0.1,
        strokeColor: geofence.color || '#1976D2',
        strokeOpacity: 0.8,
        strokeWeight: 2,
        strokeDasharray: '5,5',
      });

      circlesRef.current.push(circle);
    });
  }, [geofences]);

  // Update zoom when prop changes
  useEffect(() => {
    if (mapInstanceRef.current && typeof zoom === 'number') {
      (mapInstanceRef.current as any).setZoom(zoom);
    }
  }, [zoom]);

  // Update map type when prop changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      const mapTypeId = mapType === 'satellite' ? 'satellite' : 'roadmap';
      (mapInstanceRef.current as any).setMapTypeId(mapTypeId);
    }
  }, [mapType]);

  return (
    <div className={`w-full h-full ${className}`}>
      <div ref={mapRef} className="w-full h-full rounded-lg" />
      <style>{`
        .gm-style-mtc { display: none !important; }
        .gm-bundled-control { display: none !important; }
        .gm-fullscreen-control { display: none !important; }
        .gmnoprint { display: none !important; }
        .gm-control-active { display: none !important; }
        .gm-style .gm-style-mtc { display: none !important; }
        [title="Toggle between map and satellite imagery"] { display: none !important; }
        .gm-style-cc { display: none !important; }
        .gmnoprint div { display: none !important; }
      `}</style>
    </div>
  );
}

// Load Google Maps API
export function loadGoogleMapsAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=geometry`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Maps API'));
    
    document.head.appendChild(script);
  });
}
