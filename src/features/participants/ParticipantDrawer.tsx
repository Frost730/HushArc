import React, { useState } from 'react';
import { X, Users, RefreshCw, KeyRound, Radio } from 'lucide-react';

interface ParticipantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  participants: Array<{ id: string; nickname: string; publicKey: string; joinedAt: number }>;
  myParticipantId: string;
  currentEpoch: number;
  onRotateKey: () => Promise<void>;
}

export const ParticipantDrawer: React.FC<ParticipantDrawerProps> = ({
  isOpen,
  onClose,
  participants,
  myParticipantId,
  currentEpoch,
  onRotateKey,
}) => {
  const [rotating, setRotating] = useState(false);

  if (!isOpen) return null;

  const handleRotate = async () => {
    setRotating(true);
    try {
      await onRotateKey();
    } finally {
      setRotating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-full sm:max-w-sm h-full bg-ink-elevated border-l border-ink-border p-4 sm:p-5 flex flex-col justify-between shadow-2xl safe-top safe-bottom safe-x"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-ink-border">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-signal-lime" />
              <h3 className="font-display font-semibold text-text-primary text-sm">
                Active Participants ({participants.length})
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary transition-colors active:scale-95"
              aria-label="Close participants list"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-1">
            {participants.map((p) => {
              const isMe = p.id === myParticipantId;
              const fingerprint = p.publicKey.slice(0, 8);

              return (
                <div
                  key={p.id}
                  className="p-3 bg-ink rounded-xl border border-ink-border space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-text-primary flex items-center gap-1.5 font-mono">
                      <Radio className="w-3 h-3 text-signal-lime animate-pulse" />
                      {p.nickname} {isMe && <span className="text-signal-lime font-bold">(You)</span>}
                    </span>
                    <span className="text-[10px] font-mono text-text-muted">
                      {new Date(p.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] font-mono text-text-muted">
                    <KeyRound className="w-3 h-3 text-sage-light" />
                    <span>X25519: {fingerprint}...</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-4 border-t border-ink-border space-y-3">
          <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-text-muted">Current Epoch:</span>
            <span className="text-signal-lime font-semibold">Epoch {currentEpoch}</span>
          </div>

          <button
            type="button"
            onClick={handleRotate}
            disabled={rotating}
            className="w-full min-h-[44px] py-3 px-3 rounded-xl bg-ink-hover hover:bg-ink-subtle border border-ink-border text-text-primary hover:text-signal-lime font-mono text-xs flex items-center justify-center gap-2 transition-colors active:scale-98 disabled:opacity-50"
            title="Rotate the symmetric room key for all remaining members"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rotating ? 'animate-spin' : ''}`} />
            <span>{rotating ? 'Distributing Keys...' : 'Rotate Group Key'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
