import React from 'react';

interface HushArcMarkProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animate?: boolean;
}

export const HushArcMark: React.FC<HushArcMarkProps> = ({
  size = 'md',
  className = '',
  animate = true,
}) => {
  const dimensionMap = {
    xs: 24,
    sm: 36,
    md: 52,
    lg: 80,
    xl: 120,
  };

  const dim = dimensionMap[size];

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: dim, height: dim }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 100"
        width={dim}
        height={dim}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="overflow-visible"
      >
        {/* Outer orbital arc (interrupted) */}
        <path
          d="M 50 8 A 42 42 0 1 1 12 68"
          stroke="#D5FF70"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeDasharray="170 35"
          className={animate ? 'animate-orbital origin-center' : ''}
          style={{ transformOrigin: '50px 50px' }}
        />

        {/* Counter-orbital middle arc */}
        <path
          d="M 80 50 A 30 30 0 1 1 50 20"
          stroke="#53645A"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="120 30"
          className={animate ? 'animate-orbital-reverse origin-center' : ''}
          style={{ transformOrigin: '50px 50px' }}
        />

        {/* Inner delicate signal arc */}
        <path
          d="M 32 50 A 18 18 0 0 1 68 50"
          stroke="#D5FF70"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* Living Signal central point */}
        <circle
          cx="50"
          cy="50"
          r="4.5"
          fill="#D5FF70"
          className={animate ? 'animate-signal-pulse' : ''}
        />
        {/* Subtle breathing outer aura */}
        <circle
          cx="50"
          cy="50"
          r="9"
          stroke="#D5FF70"
          strokeWidth="1"
          opacity="0.25"
        />
      </svg>
    </div>
  );
};
