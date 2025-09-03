import { useState, useEffect } from 'react';
import { AdaptiveImage } from './AdaptiveImage';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, Download, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CompressionResult {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  format: 'webp' | 'jpeg' | 'png';
  quality: number;
}

interface SmartCompressionPreviewProps {
  src: string;
  alt: string;
  className?: string;
  showControls?: boolean;
  showStats?: boolean;
}

export function SmartCompressionPreview({ 
  src, 
  alt, 
  className = "w-full h-48 object-cover rounded-lg",
  showControls = true,
  showStats = true 
}: SmartCompressionPreviewProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [compressionResults, setCompressionResults] = useState<CompressionResult[]>([]);
  const [selectedPreview, setSelectedPreview] = useState<'original' | 'thumbnail' | 'medium' | 'large'>('thumbnail');
  const [previewMode, setPreviewMode] = useState<'side-by-side' | 'toggle'>('side-by-side');

  useEffect(() => {
    if (!src) return;

    const analyzeCompression = async () => {
      setIsLoading(true);
      
      try {
        // Get original image size
        const originalResponse = await fetch(src, { method: 'HEAD' });
        const originalSize = parseInt(originalResponse.headers.get('content-length') || '0');

        // Test different compression levels
        const compressionTests: Array<{size: string; quality: number; format: 'webp' | 'jpeg' | 'png'}> = [
          { size: 'thumbnail', quality: 75, format: 'webp' },
          { size: 'medium', quality: 80, format: 'webp' },
          { size: 'large', quality: 85, format: 'jpeg' },
        ];

        const results: CompressionResult[] = [];

        for (const test of compressionTests) {
          try {
            const compressedUrl = `${src}?compress=true&size=${test.size}`;
            const compressedResponse = await fetch(compressedUrl, { method: 'HEAD' });
            const compressedSize = parseInt(compressedResponse.headers.get('content-length') || '0');
            
            if (originalSize && compressedSize) {
              const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
              results.push({
                originalSize,
                compressedSize,
                compressionRatio,
                format: test.format,
                quality: test.quality
              });
            }
          } catch (error) {
            console.warn(`Failed to test compression for ${test.size}:`, error);
          }
        }

        setCompressionResults(results);
      } catch (error) {
        console.error('Compression analysis failed:', error);
      } finally {
        setIsLoading(false);
      }
    };

    analyzeCompression();
  }, [src]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getPreviewUrl = (mode: typeof selectedPreview): string => {
    if (mode === 'original') return src;
    return `${src}?compress=true&size=${mode}`;
  };

  const getBestCompression = (): CompressionResult | null => {
    if (compressionResults.length === 0) return null;
    return compressionResults.reduce((best, current) => 
      current.compressionRatio > best.compressionRatio ? current : best
    );
  };

  if (isLoading) {
    return (
      <div className={`${className} bg-gradient-to-r from-blue-50 to-purple-50 flex items-center justify-center border-2 border-dashed border-blue-200 rounded-lg`}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-2" />
          <div className="text-sm font-medium text-blue-600">Analyzing Compression</div>
          <div className="text-xs text-blue-400 mt-1">Testing optimal settings...</div>
        </div>
      </div>
    );
  }

  const bestCompression = getBestCompression();

  return (
    <div className="space-y-4">
      {/* Preview Area */}
      <div className="relative group">
        {previewMode === 'side-by-side' ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="relative">
              <div className="absolute top-2 left-2 z-10">
                <Badge variant="secondary" className="bg-gray-800 text-white">
                  Original
                </Badge>
              </div>
              <AdaptiveImage
                src={src}
                alt={`${alt} - Original`}
                className={className}
                sizes="large"
              />
            </div>
            <div className="relative">
              <div className="absolute top-2 left-2 z-10">
                <Badge variant="default" className="bg-green-500 text-white">
                  Compressed
                </Badge>
              </div>
              <AdaptiveImage
                src={getPreviewUrl(selectedPreview)}
                alt={`${alt} - Compressed`}
                className={className}
                sizes={selectedPreview === 'original' ? 'large' : selectedPreview}
              />
              {bestCompression && (
                <div className="absolute top-2 right-2 z-10">
                  <Badge variant="default" className="bg-green-500 text-white">
                    -{Math.round(bestCompression.compressionRatio)}%
                  </Badge>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative">
            <AdaptiveImage
              src={getPreviewUrl(selectedPreview)}
              alt={alt}
              className={className}
              sizes={selectedPreview === 'original' ? 'large' : selectedPreview}
            />
            <div className="absolute top-2 left-2 z-10">
              <Badge variant={selectedPreview === 'original' ? 'secondary' : 'default'}>
                {selectedPreview === 'original' ? 'Original' : 'Compressed'}
              </Badge>
            </div>
            {selectedPreview !== 'original' && bestCompression && (
              <div className="absolute top-2 right-2 z-10">
                <Badge variant="default" className="bg-green-500 text-white">
                  -{Math.round(bestCompression.compressionRatio)}%
                </Badge>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Controls */}
      {showControls && (
        <div className="flex flex-wrap gap-2 justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPreviewMode(previewMode === 'side-by-side' ? 'toggle' : 'side-by-side')}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewMode === 'side-by-side' ? 'Toggle View' : 'Side by Side'}
          </Button>
          
          {previewMode === 'toggle' && (
            <>
              {['original', 'thumbnail', 'medium', 'large'].map((mode) => (
                <Button
                  key={mode}
                  variant={selectedPreview === mode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedPreview(mode as typeof selectedPreview)}
                >
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Compression Statistics */}
      {showStats && compressionResults.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-5 w-5 text-green-600" />
            <h3 className="font-semibold text-green-800">Smart Compression Results</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {compressionResults.map((result, index) => {
              const sizeNames = ['Thumbnail', 'Medium', 'Large'];
              return (
                <div key={index} className="bg-white rounded-lg p-3 border">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-700">{sizeNames[index]}</span>
                    <Badge variant="outline" className="text-xs">
                      {result.format.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Original:</span>
                      <span className="line-through text-gray-400">
                        {formatFileSize(result.originalSize)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Compressed:</span>
                      <span className="font-medium text-green-600">
                        {formatFileSize(result.compressedSize)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Savings:</span>
                      <span className="font-bold text-green-700">
                        {Math.round(result.compressionRatio)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {bestCompression && (
            <div className="mt-4 p-3 bg-green-100 rounded-lg border border-green-300">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-green-700" />
                <span className="font-medium text-green-800">
                  Best Compression: {Math.round(bestCompression.compressionRatio)}% smaller
                </span>
              </div>
              <div className="text-sm text-green-700 mt-1">
                Bandwidth saved: {formatFileSize(bestCompression.originalSize - bestCompression.compressedSize)} per image
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}