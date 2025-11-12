import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

interface GoogleMapProps {
  center: { lat: number; lng: number };
  zoom?: number;
  mapType?: 'roadmap' | 'satellite';
  markers?: Array<{
    id?: string;
    position: { lat: number; lng: number };
    title: string;
    color?: string;
    type?: 'employee' | 'site' | 'cluster';
    label?: string;
    onClick?: () => void;
  }>;
  geofences?: Array<{
    id?: string;
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
  const { theme } = useTheme();

  useEffect(() => {
    // Ensure DOM element exists and is valid before creating map
    if (!mapRef.current || !window.google?.maps) {
      console.warn('Map container or Google Maps API not ready');
      return;
    }

    // Additional validation - check if element is actually in DOM
    if (!document.contains(mapRef.current)) {
      console.warn('Map container element not in document');
      return;
    }

    const updateLabelScale = () => {
      if (!mapInstanceRef.current || !mapRef.current) return;
      const zoomLevel = ((mapInstanceRef.current as any)?.getZoom?.() ?? 12) as number;
      const scale = Math.max(0.6, Math.min(1.6, zoomLevel / 12));
      mapRef.current.style.setProperty('--marker-label-scale', scale.toString());
    };

    try {
      // Initialize Google Map with error handling
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
        styles: theme === 'dark' ? [
          // Dark mode styles
          { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
          { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
          { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
          {
            featureType: 'administrative.locality',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#d59563' }],
          },
          {
            featureType: 'poi',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#d59563' }],
          },
          {
            featureType: 'poi.park',
            elementType: 'geometry',
            stylers: [{ color: '#263c3f' }],
          },
          {
            featureType: 'poi.park',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#6b9a76' }],
          },
          {
            featureType: 'road',
            elementType: 'geometry',
            stylers: [{ color: '#38414e' }],
          },
          {
            featureType: 'road',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#212a37' }],
          },
          {
            featureType: 'road',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#9ca5b3' }],
          },
          {
            featureType: 'road.highway',
            elementType: 'geometry',
            stylers: [{ color: '#746855' }],
          },
          {
            featureType: 'road.highway',
            elementType: 'geometry.stroke',
            stylers: [{ color: '#1f2835' }],
          },
          {
            featureType: 'road.highway',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#f3d19c' }],
          },
          {
            featureType: 'transit',
            elementType: 'geometry',
            stylers: [{ color: '#2f3948' }],
          },
          {
            featureType: 'transit.station',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#d59563' }],
          },
          {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#17263c' }],
          },
          {
            featureType: 'water',
            elementType: 'labels.text.fill',
            stylers: [{ color: '#515c6d' }],
          },
          {
            featureType: 'water',
            elementType: 'labels.text.stroke',
            stylers: [{ color: '#17263c' }],
          },
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ] : [
          // Light mode styles (default)
          {
            featureType: 'poi',
            elementType: 'labels',
            stylers: [{ visibility: 'off' }],
          },
        ],
      });

      // Add click listener with null check
      if (onMapClick && mapInstanceRef.current) {
        mapInstanceRef.current.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (event.latLng) {
            onMapClick(event.latLng.lat(), event.latLng.lng());
          }
        });
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.addListener('zoom_changed', updateLabelScale);
        updateLabelScale();
      }
    } catch (error) {
      console.error('Failed to initialize Google Map:', error);
    }
  }, [theme]);

  // Update map center when prop changes
  useEffect(() => {
    if (mapInstanceRef.current && center && typeof center.lat === 'number' && typeof center.lng === 'number') {
      mapInstanceRef.current.setCenter(center);
    }
  }, [center]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google?.maps) return;

    // Clear existing markers safely
    markersRef.current.forEach(marker => {
      try {
        marker.setMap(null);
      } catch (error) {
        console.warn('Error clearing marker:', error);
      }
    });
    markersRef.current = [];

    // Add new markers with custom icons
    markers.forEach(markerData => {
      let customIcon;
      
      if (markerData.type === 'site') {
        // Create custom site icon SVG (building/location marker in green)
        // If label exists, we'll handle it separately with custom overlay
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
          labelOrigin: new (window as any).google.maps.Point(16, 4),
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
          labelOrigin: new (window as any).google.maps.Point(16, 4),
        };
      }

      const marker = new google.maps.Marker({
        position: markerData.position,
        map: mapInstanceRef.current,
        title: markerData.title,
        icon: customIcon,
        label: markerData.label
          ? {
              text: markerData.label,
              color: markerData.type === 'site' ? '#ffffff' : '#ffffff',
              fontSize: markerData.type === 'site' ? '10px' : '12px',
              fontWeight: markerData.type === 'site' ? '500' : '600',
              className: markerData.type === 'site' ? 'map-marker-label site-label' : 'map-marker-label',
            }
          : undefined,
        zIndex: markerData.type === 'site' ? 50 : undefined,
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
    if (!mapInstanceRef.current || !window.google?.maps) return;

    // Clear existing circles safely
    circlesRef.current.forEach(circle => {
      try {
        circle.setMap(null);
      } catch (error) {
        console.warn('Error clearing geofence circle:', error);
      }
    });
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

  // Update map styles when theme changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const darkModeStyles = [
      // Dark mode styles
      { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
      { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
      {
        featureType: 'administrative.locality',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#d59563' }],
      },
      {
        featureType: 'poi',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#d59563' }],
      },
      {
        featureType: 'poi.park',
        elementType: 'geometry',
        stylers: [{ color: '#263c3f' }],
      },
      {
        featureType: 'poi.park',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#6b9a76' }],
      },
      {
        featureType: 'road',
        elementType: 'geometry',
        stylers: [{ color: '#38414e' }],
      },
      {
        featureType: 'road',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#212a37' }],
      },
      {
        featureType: 'road',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#9ca5b3' }],
      },
      {
        featureType: 'road.highway',
        elementType: 'geometry',
        stylers: [{ color: '#746855' }],
      },
      {
        featureType: 'road.highway',
        elementType: 'geometry.stroke',
        stylers: [{ color: '#1f2835' }],
      },
      {
        featureType: 'road.highway',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#f3d19c' }],
      },
      {
        featureType: 'transit',
        elementType: 'geometry',
        stylers: [{ color: '#2f3948' }],
      },
      {
        featureType: 'transit.station',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#d59563' }],
      },
      {
        featureType: 'water',
        elementType: 'geometry',
        stylers: [{ color: '#17263c' }],
      },
      {
        featureType: 'water',
        elementType: 'labels.text.fill',
        stylers: [{ color: '#515c6d' }],
      },
      {
        featureType: 'water',
        elementType: 'labels.text.stroke',
        stylers: [{ color: '#17263c' }],
      },
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
      },
    ];

    const lightModeStyles = [
      {
        featureType: 'poi',
        elementType: 'labels',
        stylers: [{ visibility: 'off' }],
      },
    ];

    (mapInstanceRef.current as any).setOptions({
      styles: theme === 'dark' ? darkModeStyles : lightModeStyles,
    });
  }, [theme]);

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
        .map-marker-label {
          background: rgba(17, 24, 39, 0.85);
          color: #fff;
          padding: 2px 6px;
          border-radius: 9999px;
          font-size: 12px;
          font-weight: 600;
          transform: translate(-50%, calc(-34px - (var(--marker-label-scale, 1) - 1) * 6px)) scale(var(--marker-label-scale, 1));
          transform-origin: center;
          white-space: nowrap;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.3);
          transition: transform 0.15s ease;
        }
        .map-marker-label.site-label {
          background: #000000 !important;
          color: #ffffff !important;
          font-size: 10px !important;
          font-weight: 500 !important;
          padding: 2px 8px !important;
          border: 1px solid #dc2626 !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(220, 38, 38, 0.2) !important;
        }
        /* Target Google Maps label elements directly */
        .gm-style .gm-style-iw-d + div div[style*="position"] {
          background: #000000 !important;
          color: #ffffff !important;
          font-size: 10px !important;
          border: 1px solid #dc2626 !important;
        }
        /* Style site labels using attribute selectors */
        div[style*="font-size: 10px"] {
          background: #000000 !important;
          color: #ffffff !important;
          border: 1px solid #dc2626 !important;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4) !important;
        }
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
