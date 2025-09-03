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
        size = 'medium';
      } else if (window.innerWidth >= 1200) {
        size = 'large';
      } else {
        size = 'medium';
      }
    } else {
      size = sizes;
    }
    
    params.append('size', size);
    
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
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        className={`${className} ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        onError={() => setHasError(true)}
        loading={lazy ? 'lazy' : 'eager'}
        style={{ 
          filter: isLoading ? 'blur(5px)' : 'none',
          transition: 'filter 0.3s ease'
        }}
      />
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