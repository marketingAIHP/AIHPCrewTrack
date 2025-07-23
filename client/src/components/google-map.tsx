import { useEffect, useRef } from 'react';

interface GoogleMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  mapType?: 'roadmap' | 'satellite';
  markers?: Array<{
    position: { lat: number; lng: number };
    title: string;
    color?: string;
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
    if (!mapRef.current) return;

    // Initialize Google Map
    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center,
      zoom,
      mapTypeId: mapType === 'satellite' ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP,
      zoomControl: false,
      mapTypeControl: false,
      scaleControl: false,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: false,
      disableDefaultUI: true,
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

    // Add new markers
    markers.forEach(markerData => {
      const marker = new google.maps.Marker({
        position: markerData.position,
        map: mapInstanceRef.current,
        title: markerData.title,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: markerData.color || 'red',
          fillOpacity: 1,
          strokeColor: 'white',
          strokeWeight: 2,
        },
      });

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
      mapInstanceRef.current.setZoom(zoom);
    }
  }, [zoom]);

  // Update map type when prop changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      const mapTypeId = mapType === 'satellite' ? google.maps.MapTypeId.SATELLITE : google.maps.MapTypeId.ROADMAP;
      mapInstanceRef.current.setMapTypeId(mapTypeId);
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
