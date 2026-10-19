import React, { useState } from 'react';
import { X, Copy, Check, Share2, ArrowRight, ShieldCheck } from 'lucide-react';
import { HushArcMark } from '../../components/HushArcMark.js';

interface InvitationModalProps {
  isOpen: boolean;
  invitationUrl: string;
  roomId: string;
  onClose: () => void;
  onEnterRoom: () => void;
}

export const InvitationModal: React.FC<InvitationModalProps> = ({
  isOpen,
  invitationUrl,
  roomId,
  onClose,
  onEnterRoom,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'HushArc Ephemeral Room',
          text: 'Join my private end-to-end encrypted room on HushArc.',
          url: invitationUrl,
        });
      } catch {
        // Cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md bg-ink-elevated border border-ink-border rounded-2xl p-6 shadow-2xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-ink-border">
          <div className="flex items-center gap-2">
            <HushArcMark size="sm" animate={true} />
            <h3 className="font-display font-semibold text-text-primary text-base">
              Room Ready: {roomId.slice(0, 8)}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-text-secondary leading-relaxed">
            Your ephemeral room is active. Share this private link with your companion or group.
          </p>

          <div className="p-3 bg-ink rounded-xl border border-ink-border space-y-2">
            <div className="text-[11px] font-mono text-text-muted uppercase tracking-wider">
              Encrypted Bearer Invitation
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={invitationUrl}
                className="w-full bg-transparent text-xs font-mono text-signal-lime outline-none truncate select-all"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 p-2 rounded-lg bg-ink-elevated hover:bg-ink-hover border border-ink-border text-text-primary hover:text-signal-lime transition-colors flex items-center gap-1.5 text-xs font-mono"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-signal-lime" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 p-2.5 rounded-lg bg-ink/50 border border-ink-border/50 text-[11px] text-text-muted">
            <ShieldCheck className="w-4 h-4 text-signal-lime shrink-0 mt-0.5" />
            <span>
              The encryption key is placed in the URL fragment (<code className="text-signal-lime">#key=...</code>). The server never sees this key.
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 py-2.5 px-4 rounded-xl bg-ink-hover hover:bg-ink-subtle border border-ink-border text-text-primary font-medium text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-signal-lime" />
              <span>Share Link</span>
            </button>
          )}

          <button
            type="button"
            onClick={onEnterRoom}
            className="flex-1 py-2.5 px-4 rounded-xl bg-signal-lime hover:bg-[#c2ed5c] text-ink font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-signal-glow-sm"
          >
            <span>Enter Room</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
