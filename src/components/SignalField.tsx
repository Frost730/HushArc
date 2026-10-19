import React from 'react';

export const SignalField: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* Very faint background radial gradient anchoring the ink depth */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(30,45,36,0.35),rgba(10,14,13,0))]"
      />

      {/* Atmospheric orbital grid lines */}
      <svg
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140vw] h-[140vh] max-w-[1400px] max-h-[1400px] opacity-[0.04]"
        viewBox="0 0 1000 1000"
        fill="none"
      >
        <circle cx="500" cy="500" r="180" stroke="#D5FF70" strokeWidth="1" strokeDasharray="4 8" />
        <circle cx="500" cy="500" r="320" stroke="#F0F0E8" strokeWidth="1" strokeDasharray="6 12" />
        <circle cx="500" cy="500" r="460" stroke="#53645A" strokeWidth="1.5" strokeDasharray="8 16" />
        <line x1="500" y1="0" x2="500" y2="1000" stroke="#53645A" strokeWidth="0.5" strokeDasharray="4 12" />
        <line x1="0" y1="500" x2="1000" y2="500" stroke="#53645A" strokeWidth="0.5" strokeDasharray="4 12" />
      </svg>
    </div>
  );
};
