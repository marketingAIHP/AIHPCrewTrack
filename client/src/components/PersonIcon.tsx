import React from 'react';

interface PersonIconProps {
  size?: number;
  color?: string;
  className?: string;
}

export function PersonIcon({ size = 24, color = '#ff0000', className = '' }: PersonIconProps) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Location pin outline */}
      <path 
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" 
        fill={color}
        stroke="#ffffff"
        strokeWidth="1"
      />
      {/* Person figure inside the pin */}
      <circle cx="12" cy="8.5" r="2" fill="#ffffff" />
      <path 
        d="M8.5 13.5c0-1.5 1.57-2.5 3.5-2.5s3.5 1 3.5 2.5v1h-7v-1z" 
        fill="#ffffff"
      />
    </svg>
  );
}

export default PersonIcon;