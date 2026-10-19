import React from 'react';

interface ConnectionStatusProps {
  status: 'connected' | 'connecting' | 'disconnected';
  className?: string;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  className = '',
}) => {
  const config = {
    connected: {
      color: 'bg-signal-lime',
      text: 'Signal Active',
      aura: 'rgba(213, 255, 112, 0.4)',
    },
    connecting: {
      color: 'bg-amber-400',
      text: 'Acquiring Signal...',
      aura: 'rgba(251, 191, 36, 0.3)',
    },
    disconnected: {
      color: 'bg-coral',
      text: 'Signal Lost',
      aura: 'rgba(255, 121, 94, 0.4)',
    },
  }[status];

  return (
    <div
      className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-ink-elevated border border-ink-border text-xs font-mono select-none ${className}`}
      title={`Connection: ${config.text}`}
    >
      <span className="relative flex h-2 w-2">
        {status === 'connected' && (
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: config.aura }}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color}`} />
      </span>
      <span className="text-text-secondary text-[11px] tracking-wide font-medium">{config.text}</span>
    </div>
  );
};
