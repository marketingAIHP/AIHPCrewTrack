interface CompressionIndicatorProps {
  show: boolean;
  compressionRatio?: number;
}

export function CompressionIndicator({ show, compressionRatio }: CompressionIndicatorProps) {
  if (!show) return null;

  return (
    <div className="flex items-center justify-center p-2 bg-green-50 border border-green-200 rounded-lg">
      <div className="text-center">
        <div className="text-sm font-medium text-green-800">
          🚀 Image Optimized!
        </div>
        {compressionRatio && compressionRatio > 0 && (
          <div className="text-xs text-green-600 mt-1">
            Reduced size by {Math.round(compressionRatio)}%
          </div>
        )}
        <div className="text-xs text-gray-500 mt-1">
          Faster loading • Better performance
        </div>
      </div>
    </div>
  );
}