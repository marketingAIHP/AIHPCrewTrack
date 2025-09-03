import { useState, useEffect } from 'react';
import { AdaptiveImage } from './AdaptiveImage';

interface CompressedImagePreviewProps {
  src?: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
  showCompressionInfo?: boolean;
}

export function CompressedImagePreview({ 
  src, 
  alt, 
  className = 'w-20 h-20 rounded-lg',
  fallback,
  showCompressionInfo = true 
}: CompressedImagePreviewProps) {
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [compressedSize, setCompressedSize] = useState<number>(0);
  const [compressionRatio, setCompressionRatio] = useState<number>(0);

  useEffect(() => {
    if (!src || !showCompressionInfo) return;

    const measureImageSizes = async () => {
      try {
        // Get original image size
        const originalResponse = await fetch(src, { method: 'HEAD' });
        const originalBytes = parseInt(originalResponse.headers.get('content-length') || '0');
        
        // Get compressed image size  
        const compressedResponse = await fetch(`${src}?compress=true&size=thumbnail`, { method: 'HEAD' });
        const compressedBytes = parseInt(compressedResponse.headers.get('content-length') || '0');
        
        if (originalBytes && compressedBytes) {
          setOriginalSize(originalBytes);
          setCompressedSize(compressedBytes);
          setCompressionRatio(((originalBytes - compressedBytes) / originalBytes) * 100);
        }
      } catch (error) {
        console.log('Could not measure compression ratio:', error);
      }
    };

    measureImageSizes();
  }, [src, showCompressionInfo]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return Math.round(bytes / (1024 * 1024)) + ' MB';
  };

  if (!src) {
    return fallback ? <>{fallback}</> : null;
  }

  return (
    <div className="relative">
      <AdaptiveImage
        src={src}
        alt={alt}
        className={className}
        sizes="thumbnail"
        fallback={fallback}
      />
      
      {showCompressionInfo && compressionRatio > 0 && (
        <div className="absolute -bottom-1 -right-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full font-medium shadow-sm">
          -{Math.round(compressionRatio)}%
        </div>
      )}
      
      {showCompressionInfo && originalSize > 0 && compressedSize > 0 && (
        <div className="mt-1 text-xs text-gray-500 text-center">
          <span className="line-through">{formatFileSize(originalSize)}</span>
          {' → '}
          <span className="font-medium text-green-600">{formatFileSize(compressedSize)}</span>
        </div>
      )}
    </div>
  );
}