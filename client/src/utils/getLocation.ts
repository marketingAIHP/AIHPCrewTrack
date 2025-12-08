/**
 * Fast location fetching utility with IP-based fallback
 * Returns the first available location source (GPS or IP)
 */

interface LocationResult {
  lat: number;
  lon: number;
  accuracy?: number;
  source: 'geolocation' | 'ipapi' | 'ipinfo';
  timestamp: number;
}

interface IPLocationResponse {
  latitude?: number;
  longitude?: number;
  lat?: number;
  lng?: number;
  lon?: number;
}

/**
 * Check if the page is served over HTTPS
 */
function checkHTTPS(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.protocol === 'https:';
}

/**
 * Get location from IP-based geolocation API
 */
async function getIPLocation(api: 'ipapi' | 'ipinfo'): Promise<LocationResult | null> {
  const startTime = performance.now();
  const url = api === 'ipapi' 
    ? 'https://ipapi.co/json/'
    : 'https://ipinfo.io/json';

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(3000), // 3 second timeout for IP API
    });

    if (!response.ok) {
      throw new Error(`IP API returned ${response.status}`);
    }

    const data: IPLocationResponse = await response.json();
    const lat = data.latitude ?? data.lat;
    const lon = data.longitude ?? data.lng ?? data.lon;

    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new Error('Invalid location data from IP API');
    }

    const duration = performance.now() - startTime;
    console.log(`✅ IP location (${api}) fetched in ${duration.toFixed(0)}ms:`, { lat, lon });

    return {
      lat,
      lon,
      source: api,
      timestamp: Date.now(),
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    console.warn(`⚠️ IP location (${api}) failed after ${duration.toFixed(0)}ms:`, error);
    return null;
  }
}

/**
 * Get location from browser geolocation API
 */
function getGeolocation(timeout: number = 5000): Promise<LocationResult> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    const startTime = performance.now();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const duration = performance.now() - startTime;
        const result: LocationResult = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? undefined,
          source: 'geolocation',
          timestamp: pos.timestamp || Date.now(),
        };
        console.log(`✅ GPS location fetched in ${duration.toFixed(0)}ms:`, {
          lat: result.lat,
          lon: result.lon,
          accuracy: result.accuracy,
        });
        resolve(result);
      },
      (err) => {
        const duration = performance.now() - startTime;
        console.warn(`⚠️ GPS location failed after ${duration.toFixed(0)}ms:`, {
          code: err.code,
          message: err.message,
        });
        reject(err);
      },
      {
        enableHighAccuracy: true,
        timeout: timeout,
        maximumAge: 0, // Always get fresh readings
      }
    );
  });
}

/**
 * Fast location fetching with automatic fallback
 * Returns the first available location (GPS or IP)
 */
export async function getFastLocation(options: {
  timeout?: number;
  enableIPFallback?: boolean;
} = {}): Promise<LocationResult> {
  const { timeout = 5000, enableIPFallback = true } = options;
  const startTime = performance.now();

  // Check HTTPS
  if (!checkHTTPS()) {
    console.warn('⚠️ Page is not served over HTTPS. Geolocation may be less accurate.');
    // Don't block, but warn the user
    if (typeof window !== 'undefined') {
      console.warn('Please access the site via HTTPS for best geolocation accuracy.');
    }
  }

  // Create promises for both GPS and IP fallback
  const promises: Promise<LocationResult>[] = [];

  // GPS promise
  const geoPromise = getGeolocation(timeout).catch((err) => {
    throw err; // Re-throw to be caught by Promise.any
  });

  promises.push(geoPromise);

  // IP fallback promises (try both APIs)
  if (enableIPFallback) {
    const ipapiPromise = getIPLocation('ipapi').then((result) => {
      if (!result) throw new Error('IP API (ipapi.co) returned no data');
      return result;
    });

    const ipinfoPromise = getIPLocation('ipinfo').then((result) => {
      if (!result) throw new Error('IP API (ipinfo.io) returned no data');
      return result;
    });

    promises.push(ipapiPromise, ipinfoPromise);
  }

  try {
    // Use Promise.any if available, otherwise fallback to Promise.race with error handling
    let result: LocationResult;
    
    if (typeof Promise.any === 'function') {
      result = await Promise.any(promises);
    } else {
      // Polyfill for Promise.any using Promise.race
      const errors: Error[] = [];
      const settledPromises = promises.map((promise, index) =>
        promise
          .then((value) => ({ status: 'fulfilled' as const, value, index }))
          .catch((error) => {
            errors[index] = error;
            return { status: 'rejected' as const, error, index };
          })
      );
      
      const settled = await Promise.all(settledPromises);
      const fulfilled = settled.find((s) => s.status === 'fulfilled');
      
      if (fulfilled) {
        result = fulfilled.value;
      } else {
        const error = new Error('All location methods failed');
        (error as any).errors = errors;
        throw error;
      }
    }
    
    const totalDuration = performance.now() - startTime;
    console.log(`🎯 Fast location resolved in ${totalDuration.toFixed(0)}ms from ${result.source}`);
    return result;
  } catch (error) {
    const totalDuration = performance.now() - startTime;
    console.error(`❌ All location methods failed after ${totalDuration.toFixed(0)}ms:`, error);
    
    // If all methods fail, throw a descriptive error
    throw new Error(
      'Unable to determine location. Please check your internet connection and location permissions.'
    );
  }
}

/**
 * Get initial location quickly (for immediate use)
 * Uses shorter timeout for GPS and enables IP fallback
 */
export async function getInitialLocation(): Promise<LocationResult> {
  return getFastLocation({
    timeout: 3000, // Shorter timeout for initial location
    enableIPFallback: true,
  });
}

