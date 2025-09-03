import { useState } from 'react';
import { SmartCompressionPreview } from './SmartCompressionPreview';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ZoomIn, Maximize2 } from 'lucide-react';

interface CompressionThumbnailGridProps {
  images: Array<{
    id: string;
    src: string;
    alt: string;
    title?: string;
  }>;
  className?: string;
  showPreviewDialog?: boolean;
}

export function CompressionThumbnailGrid({ 
  images, 
  className = "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4",
  showPreviewDialog = true 
}: CompressionThumbnailGridProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const selectedImageData = images.find(img => img.id === selectedImage);

  return (
    <>
      <div className={className}>
        {images.map((image) => (
          <div key={image.id} className="group relative">
            <div className="relative overflow-hidden rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-colors">
              <SmartCompressionPreview
                src={image.src}
                alt={image.alt}
                className="w-full h-32 object-cover"
                showControls={false}
                showStats={false}
              />
              
              {/* Overlay with compression info */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="text-center">
                  {showPreviewDialog && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setSelectedImage(image.id)}
                      className="mb-2"
                    >
                      <ZoomIn className="h-4 w-4 mr-2" />
                      Preview
                    </Button>
                  )}
                  <div className="text-white text-xs">
                    <Badge variant="default" className="bg-green-500">
                      Smart Compressed
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Quick compression indicator */}
              <div className="absolute top-2 right-2">
                <Badge variant="default" className="bg-green-500 text-white text-xs">
                  <ZoomIn className="h-3 w-3 mr-1" />
                  Optimized
                </Badge>
              </div>
            </div>

            {image.title && (
              <div className="mt-2 text-sm font-medium text-gray-700 truncate">
                {image.title}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Preview Dialog */}
      {showPreviewDialog && selectedImageData && (
        <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Maximize2 className="h-5 w-5" />
                Smart Compression Preview
              </DialogTitle>
              <DialogDescription>
                {selectedImageData.title || selectedImageData.alt}
              </DialogDescription>
            </DialogHeader>
            
            <div className="mt-4">
              <SmartCompressionPreview
                src={selectedImageData.src}
                alt={selectedImageData.alt}
                className="w-full h-64 object-cover rounded-lg"
                showControls={true}
                showStats={true}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}