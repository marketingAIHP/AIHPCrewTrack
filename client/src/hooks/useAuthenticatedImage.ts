import { useState, useEffect } from 'react';
import { getAuthToken } from '@/lib/auth';

export function useAuthenticatedImage(imageUrl?: string) {
  const [blobUrl, setBlobUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!imageUrl) {
      setBlobUrl('');
      return;
    }

    // If it's already a blob URL or doesn't need authentication, use it directly
    if (imageUrl.startsWith('blob:') || !imageUrl.includes('/objects/')) {
      setBlobUrl(imageUrl);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError('');

    const fetchImage = async () => {
      try {
        const response = await fetch(imageUrl, {
          headers: {
            'Authorization': `Bearer ${getAuthToken()}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load image: ${response.status}`);
        }

        const blob = await response.blob();
        if (!isCancelled) {
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load image');
          console.error('Failed to load authenticated image:', err);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    fetchImage();

    return () => {
      isCancelled = true;
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [imageUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (blobUrl && blobUrl.startsWith('blob:')) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  return { blobUrl, loading, error };
}