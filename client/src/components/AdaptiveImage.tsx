import { useState, useEffect } from 'react';

interface AdaptiveImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  sizes?: 'thumbnail' | 'medium' | 'large' | 'auto';
  lazy?: boolean;
}

export function AdaptiveImage({ 
  src, 
  alt, 
  className = '', 
  fallback, 
  sizes = 'auto',
  lazy = true 
}: AdaptiveImageProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [connectionSpeed, setConnectionSpeed] = useState<string>('fast');

  // Detect connection speed
  useEffect(() => {
    // @ts-ignore - Navigator.connection is experimental
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      const effectiveType = connection.effectiveType;
      setConnectionSpeed(effectiveType);
    }
  }, []);

  // Generate optimized image URL
  const getOptimizedImageSrc = (originalSrc: string, size?: string): string => {
    if (!originalSrc.includes('/objects/')) return originalSrc;
    
    const params = new URLSearchParams();
    params.append('compress', 'true');
    
    // Auto-detect size based on connection and viewport
    if (sizes === 'auto') {
      const isSlowConnection = connectionSpeed === 'slow-2g' || connectionSpeed === '2g';
      const isMobile = window.innerWidth < 768;
      
      if (isSlowConnection || isMobile) {
        size = 'thumbnail';
      } else if (window.innerWidth >= 1200) {
        size = 'large';
      } else {
        size = 'medium';
      }
    } else {
      size = sizes;
    }
    
    if (size) {
      params.append('size', size);
    }
    
    return `${originalSrc}?${params.toString()}`;
  };

  // Progressive image loading
  useEffect(() => {
    if (!src) return;
    
    setIsLoading(true);
    setHasError(false);
    
    // First, try to load a thumbnail for instant feedback
    if (sizes === 'auto' && src.includes('/objects/')) {
      const thumbnailSrc = getOptimizedImageSrc(src, 'thumbnail');
      const thumbnailImg = new Image();
      
      thumbnailImg.onload = () => {
        setImageSrc(thumbnailSrc);
        setIsLoading(false);
        
        // Then load the full-quality image in the background
        const fullImg = new Image();
        const fullSrc = getOptimizedImageSrc(src);
        
        fullImg.onload = () => {
          setImageSrc(fullSrc);
        };
        
        fullImg.onerror = () => {
          // Keep the thumbnail if full image fails
        };
        
        if (!lazy || isElementInViewport()) {
          fullImg.src = fullSrc;
        }
      };
      
      thumbnailImg.onerror = () => {
        // Fallback to original image
        loadOriginalImage();
      };
      
      thumbnailImg.src = thumbnailSrc;
    } else {
      loadOriginalImage();
    }
  }, [src, sizes, connectionSpeed]);

  const loadOriginalImage = () => {
    const img = new Image();
    const optimizedSrc = getOptimizedImageSrc(src);
    
    img.onload = () => {
      setImageSrc(optimizedSrc);
      setIsLoading(false);
    };
    
    img.onerror = () => {
      setHasError(true);
      setIsLoading(false);
    };
    
    img.src = optimizedSrc;
  };

  const isElementInViewport = (): boolean => {
    // Simple viewport detection - in real implementation, you'd use Intersection Observer
    return true; // Simplified for now
  };

  if (hasError && fallback) {
    return <>{fallback}</>;
  }

  if (hasError && !fallback) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <span className="text-gray-500 text-sm">Image failed to load</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 to-gray-300 animate-pulse flex items-center justify-center">
          <div className="text-gray-500 text-xs font-medium">
            Optimizing...
          </div>
        </div>
      )}
      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          className={`w-full h-full object-cover ${isLoading ? 'opacity-0' : 'opacity-100'} transition-all duration-500 ease-out`}
          onError={() => setHasError(true)}
          loading={lazy ? 'lazy' : 'eager'}
          style={{ 
            filter: isLoading ? 'blur(8px) brightness(0.8)' : 'none',
            transform: isLoading ? 'scale(1.05)' : 'scale(1)',
            transition: 'all 0.5s ease-out'
          }}
        />
      )}
      {/* Debug info for development */}
      {process.env.NODE_ENV === 'development' && imageSrc && (
        <div className="absolute bottom-0 right-0 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5">
          {connectionSpeed} | {sizes}
        </div>
      )}
    </div>
  );
}

// Hook for detecting connection speed
export function useConnectionSpeed() {
  const [connectionSpeed, setConnectionSpeed] = useState<{
    effectiveType: string;
    downlink: number;
    rtt: number;
  } | null>(null);

  useEffect(() => {
    // @ts-ignore
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    
    if (connection) {
      const updateConnectionInfo = () => {
        setConnectionSpeed({
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt
        });
      };
      
      updateConnectionInfo();
      connection.addEventListener('change', updateConnectionInfo);
      
      return () => {
        connection.removeEventListener('change', updateConnectionInfo);
      };
    }
  }, []);

  return connectionSpeed;
}