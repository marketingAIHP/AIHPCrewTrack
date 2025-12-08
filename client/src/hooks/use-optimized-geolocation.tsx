import { useState, useEffect, useRef, useCallback } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
  timestamp: number | null;
}

interface UseOptimizedGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  minAccuracy?: number; // Skip readings with accuracy worse than this (warm-up filter)
  throttleMs?: number; // Throttle backend updates
  onLocationUpdate?: (position: GeolocationPosition) => void; // Callback for location updates
}

/**
 * Optimized geolocation hook with:
 * - watchPosition() for continuous tracking
 * - High accuracy GPS settings
 * - Warm-up filtering (skips inaccurate initial readings)
 * - Throttled backend updates
 * - Real-time accuracy reporting
 */
export function useOptimizedGeolocation(options: UseOptimizedGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 0, // Always get fresh readings
    minAccuracy = 50, // Skip readings with accuracy > 50m initially
    throttleMs = 10000, // Send to backend every 10 seconds
    onLocationUpdate,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
    timestamp: null,
  });

  const watchIdRef = useRef<number | null>(null);
  const locationInitializedRef = useRef(false);
  const lastSentTimeRef = useRef(0);
  const onLocationUpdateRef = useRef(onLocationUpdate);

  // Update callback ref when it changes
  useEffect(() => {
    onLocationUpdateRef.current = onLocationUpdate;
  }, [onLocationUpdate]);

  const sendLocationToBackend = useCallback(async (latitude: number, longitude: number, accuracy: number, timestamp: number) => {
    const now = Date.now();
    
    // Throttle: only send if enough time has passed
    if (now - lastSentTimeRef.current < throttleMs) {
      return;
    }
    
    lastSentTimeRef.current = now;

    try {
      const token = localStorage.getItem('authToken');
      if (!token) {
        console.warn('No auth token available for location update');
        return;
      }

      const response = await fetch('/api/employee/location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude,
          longitude,
          accuracy,
          timestamp,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Location saved to server:', { latitude, longitude, accuracy });
      
      return data;
    } catch (error) {
      console.error('❌ Failed to send location to server:', error);
    }
  }, [throttleMs]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setState({
        latitude: null,
        longitude: null,
        accuracy: null,
        error: 'Geolocation is not supported by this browser.',
        loading: false,
        timestamp: null,
      });
      return;
    }

    const handleSuccess = (position: GeolocationPosition) => {
      const { latitude, longitude, accuracy, timestamp } = position.coords;
      const accuracyValue = accuracy || 100; // Default to 100m if accuracy is not provided

      console.log(`📍 GPS Update: Lat: ${latitude.toFixed(6)}, Lng: ${longitude.toFixed(6)}, Accuracy: ${accuracyValue.toFixed(0)}m`);

      // Warm-up filtering: Skip initial inaccurate readings
      if (!locationInitializedRef.current && accuracyValue > minAccuracy) {
        console.log(`⏳ Waiting for better GPS accuracy (current: ${accuracyValue.toFixed(0)}m, target: <${minAccuracy}m)...`);
        return;
      }

      // Mark as initialized once we get a good reading
      locationInitializedRef.current = true;

      // Update state immediately for real-time map updates
      setState({
        latitude,
        longitude,
        accuracy: accuracyValue,
        error: null,
        loading: false,
        timestamp,
      });

      // Call user-provided callback
      if (onLocationUpdateRef.current) {
        onLocationUpdateRef.current(position);
      }

      // Send to backend (throttled)
      sendLocationToBackend(latitude, longitude, accuracyValue, timestamp);
    };

    const handleError = (error: GeolocationPositionError) => {
      let errorMessage = 'An unknown error occurred.';
      
      switch (error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location access denied by user. Please allow location access to enable tracking.';
          break;
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information is unavailable. Try enabling GPS or moving outdoors.';
          break;
        case error.TIMEOUT:
          console.warn('GPS timeout — retrying...');
          // Don't set error on timeout, just log it
          return;
      }

      setState(prev => ({
        ...prev,
        error: errorMessage,
        loading: false,
      }));
    };

    const geoOptions: PositionOptions = {
      enableHighAccuracy,
      timeout,
      maximumAge,
    };

    console.log('🚀 Initializing high-accuracy GPS tracking...', geoOptions);

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      geoOptions
    );

    // Cleanup on unmount
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      locationInitializedRef.current = false;
      lastSentTimeRef.current = 0;
    };
  }, [enableHighAccuracy, timeout, maximumAge, minAccuracy, sendLocationToBackend]);

  const requestPermission = useCallback(async () => {
    if (!navigator.permissions) {
      return 'unsupported';
    }

    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return result.state;
    } catch {
      return 'unknown';
    }
  }, []);

  return {
    ...state,
    requestPermission,
  };
}

