import { useState } from 'react';
import { SmartCompressionPreview } from './SmartCompressionPreview';
import { CompressionThumbnailGrid } from './CompressionThumbnailGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Zap, Images, BarChart3 } from 'lucide-react';

interface CompressionDemoProps {
  images: Array<{
    id: string;
    src: string;
    alt: string;
    title?: string;
  }>;
  title?: string;
  description?: string;
}

export function CompressionDemo({ 
  images, 
  title = "Smart Image Compression", 
  description = "See how our intelligent compression reduces file sizes while maintaining quality" 
}: CompressionDemoProps) {
  const [selectedTab, setSelectedTab] = useState('preview');

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-blue-500" />
          {title}
          <Badge variant="default" className="ml-2 bg-green-500">
            Up to 97% smaller
          </Badge>
        </CardTitle>
        {description && (
          <p className="text-gray-600 text-sm">{description}</p>
        )}
      </CardHeader>
      
      <CardContent>
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="preview" className="flex items-center gap-2">
              <Images className="h-4 w-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="grid" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Grid View
            </TabsTrigger>
            <TabsTrigger value="detailed" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Detailed
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="preview" className="mt-6">
            {images.length > 0 && (
              <SmartCompressionPreview
                src={images[0].src}
                alt={images[0].alt}
                className="w-full h-64 rounded-lg object-cover"
                showControls={true}
                showStats={true}
              />
            )}
          </TabsContent>
          
          <TabsContent value="grid" className="mt-6">
            <CompressionThumbnailGrid
              images={images}
              showPreviewDialog={true}
            />
          </TabsContent>
          
          <TabsContent value="detailed" className="mt-6">
            <div className="space-y-6">
              {images.map((image) => (
                <div key={image.id} className="border rounded-lg p-4">
                  <h3 className="font-medium mb-3">{image.title || image.alt}</h3>
                  <SmartCompressionPreview
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-48 rounded-lg object-cover"
                    showControls={true}
                    showStats={true}
                  />
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}