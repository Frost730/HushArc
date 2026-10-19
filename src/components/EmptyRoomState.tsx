import React, { useState } from 'react';
import { Copy, Check, Share2, Radio, KeyRound, Link as LinkIcon } from 'lucide-react';
import { HushArcMark } from './HushArcMark.js';
import { parseInvitationInput, encodeRoomCode } from '../lib/ephemeral-session/session.js';

interface EmptyRoomStateProps {
  invitationUrl: string;
  isDirect: boolean;
  roomCode?: string;
  shortCode?: string;
}

export const EmptyRoomState: React.FC<EmptyRoomStateProps> = ({
  invitationUrl,
  isDirect,
  roomCode: propRoomCode,
  shortCode,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Use shortCode if available, otherwise compute/fallback to roomCode
  let roomCode = shortCode || propRoomCode || '';
  if (!roomCode) {
    const parsed = parseInvitationInput(invitationUrl);
    if (parsed) {
      roomCode = encodeRoomCode(parsed);
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // Fallback
    }
  };

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

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'HushArc Private Conversation',
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
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto space-y-6 animate-fadeIn">
      <div className="relative">
        <HushArcMark size="lg" animate={true} />
        <div className="absolute -bottom-1 -right-1 p-1 bg-ink-elevated rounded-full border border-ink-border">
          <Radio className="w-4 h-4 text-signal-lime animate-pulse" />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-display font-semibold text-lg text-text-primary tracking-tight">
          {isDirect ? 'Waiting for companion...' : 'Room is ready for participants'}
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
          Share your private room code or direct invitation link to begin.
        </p>
      </div>

      <div className="w-full space-y-3">
        {/* Room Code Card */}
        {roomCode && (
          <div className="p-3 bg-ink rounded-xl border border-ink-border text-left space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono text-text-muted uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-signal-lime" />
                <span>Join with Code</span>
              </span>
              <span className="text-[10px] text-sage-light lowercase">{shortCode ? '6-digit code' : 'quick code'}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={roomCode}
                className="w-full bg-ink-surface p-2 rounded-lg text-sm font-mono font-bold tracking-wider text-signal-lime outline-none truncate select-all border border-ink-border text-center sm:text-left"
              />
              <button
                type="button"
                onClick={handleCopyCode}
                className="shrink-0 p-2 rounded-lg bg-ink-elevated hover:bg-ink-hover border border-ink-border text-text-primary hover:text-signal-lime transition-colors flex items-center gap-1.5 text-xs font-mono"
                title="Copy room code"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-signal-lime" />
                    <span className="text-signal-lime">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Invite Link Card */}
        <div className="p-3 bg-ink rounded-xl border border-ink-border text-left space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-text-muted uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-text-muted" />
              <span>Direct Link</span>
            </span>
            <span className="text-[10px] text-sage-light lowercase">click to join</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={invitationUrl}
              className="w-full bg-ink-surface p-2 rounded-lg text-xs font-mono text-text-secondary outline-none truncate select-all border border-ink-border"
            />
            <button
              type="button"
              onClick={handleCopyLink}
              className="shrink-0 p-2 rounded-lg bg-ink-elevated hover:bg-ink-hover border border-ink-border text-text-primary hover:text-signal-lime transition-colors flex items-center gap-1.5 text-xs font-mono"
              title="Copy invitation link"
            >
              {copiedLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-signal-lime" />
                  <span className="text-signal-lime">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>

        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full py-2.5 px-4 rounded-xl bg-ink-elevated hover:bg-ink-hover border border-ink-border text-text-primary font-mono text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-signal-lime" />
            <span>Share via Device Sheet</span>
          </button>
        )}
      </div>
    </div>
  );
};
