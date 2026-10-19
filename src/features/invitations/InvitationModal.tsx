import React, { useState } from 'react';
import { X, Copy, Check, Share2, ArrowRight, ShieldCheck, KeyRound, Link as LinkIcon } from 'lucide-react';
import { HushArcMark } from '../../components/HushArcMark.js';
import { encodeRoomCode, parseInvitationInput } from '../../lib/ephemeral-session/session.js';

interface InvitationModalProps {
  isOpen: boolean;
  invitationUrl: string;
  roomId: string;
  accessSecret?: string;
  encryptionKey?: string;
  shortCode?: string;
  onClose: () => void;
  onEnterRoom: () => void;
}

export const InvitationModal: React.FC<InvitationModalProps> = ({
  isOpen,
  invitationUrl,
  roomId,
  accessSecret,
  encryptionKey,
  shortCode,
  onClose,
  onEnterRoom,
}) => {
  const [activeTab, setActiveTab] = useState<'code' | 'link'>('code');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  // Use shortCode if available, otherwise compute legacy room code
  let roomCode = shortCode || '';
  if (!roomCode) {
    if (roomId && accessSecret && encryptionKey) {
      roomCode = encodeRoomCode({ roomId, accessSecret, encryptionKey });
    } else {
      const parsed = parseInvitationInput(invitationUrl);
      if (parsed) {
        roomCode = encodeRoomCode(parsed);
      }
    }
  }

  const handleCopyCode = async () => {
    if (!roomCode) return;
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'HushArc Ephemeral Room',
          text: `Join my private encrypted room on HushArc with code: ${roomCode}`,
          url: invitationUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopyLink();
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
              Room Ready: <span className="font-mono text-signal-lime">{shortCode || roomId.slice(0, 8)}</span>
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
            Invite your companion or group using the private room code or direct invitation link.
          </p>

          {/* Tab selector */}
          <div className="flex bg-ink p-1 rounded-xl border border-ink-border">
            <button
              type="button"
              onClick={() => setActiveTab('code')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all ${
                activeTab === 'code'
                  ? 'bg-ink-surface text-signal-lime shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Room Code</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('link')}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all ${
                activeTab === 'link'
                  ? 'bg-ink-surface text-signal-lime shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Invite Link</span>
            </button>
          </div>

          {/* Room Code Panel */}
          {activeTab === 'code' && (
            <div className="p-3 bg-ink rounded-xl border border-ink-border space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-[11px] font-mono text-text-muted uppercase tracking-wider">
                <span>Room Code</span>
                <span className="text-[10px] text-sage-light lowercase">{shortCode ? '6-digit code' : 'enter in "Join Room"'}</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={roomCode}
                  className="w-full bg-ink-surface p-2.5 rounded-lg text-base font-mono font-bold tracking-widest text-signal-lime outline-none truncate select-all border border-ink-border text-center"
                />
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="shrink-0 p-2.5 rounded-lg bg-ink-elevated hover:bg-ink-hover border border-ink-border text-text-primary hover:text-signal-lime transition-colors flex items-center gap-1.5 text-xs font-mono"
                  title="Copy room code"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-signal-lime" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-text-muted font-mono">
                {shortCode
                  ? 'Share this 6-digit code. Companions can type it directly into "Join with Code".'
                  : 'Give this code to anyone who already has the HushArc app open.'}
              </p>
            </div>
          )}

          {/* Invite Link Panel */}
          {activeTab === 'link' && (
            <div className="p-3 bg-ink rounded-xl border border-ink-border space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-[11px] font-mono text-text-muted uppercase tracking-wider">
                <span>Direct Invitation Link</span>
                <span className="text-[10px] text-sage-light lowercase">click to open</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={invitationUrl}
                  className="w-full bg-ink-surface p-2 rounded-lg text-xs font-mono text-signal-lime outline-none truncate select-all border border-ink-border"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 p-2 rounded-lg bg-ink-elevated hover:bg-ink-hover border border-ink-border text-text-primary hover:text-signal-lime transition-colors flex items-center gap-1.5 text-xs font-mono"
                  title="Copy invitation link"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-signal-lime" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-text-muted font-mono">
                Clicking this link opens HushArc and enters the room automatically.
              </p>
            </div>
          )}

          <div className="flex items-center gap-2 p-2 rounded-lg bg-ink/50 border border-ink-border/50 text-[11px] text-text-muted">
            <ShieldCheck className="w-4 h-4 text-signal-lime shrink-0" />
            <span>End-to-end encrypted. Keys are stored only on participants' devices.</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              type="button"
              onClick={handleShareLink}
              className="flex-1 py-2.5 px-4 rounded-xl bg-ink-hover hover:bg-ink-subtle border border-ink-border text-text-primary font-medium text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5 text-signal-lime" />
              <span>Share</span>
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
