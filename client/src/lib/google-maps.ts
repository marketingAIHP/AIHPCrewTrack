declare global {
  interface Window {
    initMap: () => void;
    google: typeof google;
  }
}

let isLoading = false;
let isLoaded = false;

export const loadGoogleMapsAPI = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    if (isLoaded && window.google && window.google.maps) {
      resolve();
      return;
    }

    // If currently loading, wait for it to complete
    if (isLoading) {
      const checkLoaded = () => {
        if (isLoaded && window.google && window.google.maps) {
          resolve();
        } else {
          setTimeout(checkLoaded, 100);
        }
      };
      checkLoaded();
      return;
    }

    isLoading = true;

    // Create callback function
    window.initMap = () => {
      isLoaded = true;
      isLoading = false;
      resolve();
    };

    // Get API key from server config
    fetch('/api/config')
      .then(res => res.json())
      .then(config => {
        // Create script element
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${config.GOOGLE_MAPS_API_KEY}&callback=initMap&loading=async`;
        script.async = true;
        script.defer = true;
    
        script.onerror = () => {
          isLoading = false;
          reject(new Error('Failed to load Google Maps API'));
        };

        document.head.appendChild(script);
      })
      .catch(() => {
        isLoading = false;
        reject(new Error('Failed to fetch API configuration'));
      });
  });
};

export const isGoogleMapsLoaded = (): boolean => {
  return isLoaded && window.google && window.google.maps;
};