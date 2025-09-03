import sharp from 'sharp';
import { Request, Response } from 'express';

interface CompressionOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  progressive?: boolean;
}

export class ImageCompressionService {
  // Get optimal compression settings based on user agent and accept headers
  getOptimalSettings(req: Request): CompressionOptions {
    const userAgent = req.get('User-Agent') || '';
    const acceptHeader = req.get('Accept') || '';
    
    // Check if browser supports WebP
    const supportsWebP = acceptHeader.includes('image/webp');
    
    // Detect mobile devices
    const isMobile = /Mobile|Android|iPhone|iPad/.test(userAgent);
    
    // Base settings
    let settings: CompressionOptions = {
      format: supportsWebP ? 'webp' : 'jpeg',
      progressive: true,
    };
    
    // Adjust quality and size based on device
    if (isMobile) {
      settings.quality = 75; // Lower quality for mobile
      settings.width = 800; // Max width for mobile
    } else {
      settings.quality = 85; // Higher quality for desktop
      settings.width = 1200; // Max width for desktop
    }
    
    // Check for slow connection hints
    const connectionHeader = req.get('Downlink') || req.get('Connection');
    if (connectionHeader && (connectionHeader.includes('slow') || parseFloat(connectionHeader) < 1)) {
      settings.quality = Math.max(60, settings.quality! - 15);
      settings.width = Math.min(600, settings.width!);
    }
    
    return settings;
  }
  
  // Compress image buffer
  async compressImage(imageBuffer: Buffer, options: CompressionOptions): Promise<Buffer> {
    let transformer = sharp(imageBuffer);
    
    // Resize if width/height specified
    if (options.width || options.height) {
      transformer = transformer.resize(options.width, options.height, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }
    
    // Apply format-specific compression
    switch (options.format) {
      case 'webp':
        transformer = transformer.webp({ 
          quality: options.quality
        });
        break;
      case 'jpeg':
        transformer = transformer.jpeg({ 
          quality: options.quality,
          progressive: options.progressive 
        });
        break;
      case 'png':
        transformer = transformer.png({ 
          compressionLevel: 9,
          progressive: options.progressive 
        });
        break;
    }
    
    return await transformer.toBuffer();
  }
  
  // Get content type for format
  getContentType(format: string): string {
    switch (format) {
      case 'webp': return 'image/webp';
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      default: return 'image/jpeg';
    }
  }
  
  // Generate multiple sizes for responsive images
  async generateResponsiveSizes(imageBuffer: Buffer): Promise<{
    thumbnail: Buffer;
    medium: Buffer;
    large: Buffer;
    format: string;
  }> {
    const format = 'webp'; // Use WebP for best compression
    
    const [thumbnail, medium, large] = await Promise.all([
      this.compressImage(imageBuffer, { width: 150, height: 150, quality: 70, format }),
      this.compressImage(imageBuffer, { width: 400, quality: 80, format }),
      this.compressImage(imageBuffer, { width: 800, quality: 85, format })
    ]);
    
    return { thumbnail, medium, large, format };
  }
}