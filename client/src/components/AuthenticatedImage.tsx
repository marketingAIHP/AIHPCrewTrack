import { useAuthenticatedImage } from '@/hooks/useAuthenticatedImage';
import React from 'react';

interface AuthenticatedImageProps {
  src?: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  fallback?: React.ReactNode;
}

export const AuthenticatedImage = React.memo(function AuthenticatedImage({ 
  src, 
  alt, 
  className, 
  onClick, 
  fallback 
}: AuthenticatedImageProps) {
  const { blobUrl, loading, error } = useAuthenticatedImage(src);

  if (!src || error) {
    return <>{fallback}</>;
  }

  if (loading) {
    return (
      <div className={`${className} animate-pulse bg-gray-200 flex items-center justify-center`}>
        <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      onClick={onClick}
      loading="lazy"
    />
  );
});