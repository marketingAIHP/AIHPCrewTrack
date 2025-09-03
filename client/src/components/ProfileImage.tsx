interface ProfileImageProps {
  src?: string;
  alt: string;
  className?: string;
  initials?: string;
}

export function ProfileImage({ src, alt, className = "w-12 h-12 rounded-full", initials }: ProfileImageProps) {
  if (src) {
    return (
      <img 
        src={src} 
        alt={alt} 
        className={`${className} object-cover`}
        onError={(e) => {
          console.error('Image failed to load:', src);
          // Hide the image and show initials fallback
          e.currentTarget.style.display = 'none';
          const fallback = e.currentTarget.nextElementSibling as HTMLElement;
          if (fallback) fallback.style.display = 'flex';
        }}
      />
    );
  }

  return (
    <div className={`${className} bg-blue-100 flex items-center justify-center`}>
      <span className="text-blue-600 font-bold text-sm">
        {initials}
      </span>
    </div>
  );
}