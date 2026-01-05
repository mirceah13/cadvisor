import React from 'react';

interface LogoProps {
  className?: string;
  width?: number;
  height?: number;
  showText?: boolean;
}

export function Logo({ className = '', width = 40, height = 40, showText = true }: LogoProps) {
  const primaryColor = '#870b2c';
  
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={width}
        height={height}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* 3D Hexagonal cube design */}
        <defs>
          <linearGradient id="gradientTop" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={primaryColor} stopOpacity="0.9" />
            <stop offset="100%" stopColor={primaryColor} stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="gradientLeft" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} stopOpacity="0.7" />
            <stop offset="100%" stopColor={primaryColor} stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="gradientRight" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={primaryColor} stopOpacity="0.6" />
            <stop offset="100%" stopColor={primaryColor} stopOpacity="0.4" />
          </linearGradient>
        </defs>
        
        {/* Top face */}
        <path
          d="M 50 20 L 75 35 L 50 50 L 25 35 Z"
          fill="url(#gradientTop)"
          stroke={primaryColor}
          strokeWidth="1.5"
        />
        
        {/* Left face */}
        <path
          d="M 25 35 L 25 65 L 50 80 L 50 50 Z"
          fill="url(#gradientLeft)"
          stroke={primaryColor}
          strokeWidth="1.5"
        />
        
        {/* Right face */}
        <path
          d="M 50 50 L 50 80 L 75 65 L 75 35 Z"
          fill="url(#gradientRight)"
          stroke={primaryColor}
          strokeWidth="1.5"
        />
        
        {/* Inner detail lines for depth */}
        <line x1="50" y1="35" x2="50" y2="50" stroke={primaryColor} strokeWidth="1" opacity="0.3" />
        <line x1="37.5" y1="42.5" x2="50" y2="50" stroke={primaryColor} strokeWidth="1" opacity="0.3" />
        <line x1="62.5" y1="42.5" x2="50" y2="50" stroke={primaryColor} strokeWidth="1" opacity="0.3" />
      </svg>
      
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="text-xl font-bold tracking-tight" style={{ color: primaryColor }}>
            <span className="font-bold">CADV</span><span className="font-semibold">isor</span>
          </span>
          <span className="text-xs text-muted-foreground -mt-0.5">
            Architecture Intelligence
          </span>
        </div>
      )}
    </div>
  );
}

export function LogoIcon({ className = '', width = 40, height = 40 }: Omit<LogoProps, 'showText'>) {
  return <Logo className={className} width={width} height={height} showText={false} />;
}
