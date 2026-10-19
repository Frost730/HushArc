import React, { useState } from 'react';
import { Copy, Check, Share2, Radio } from 'lucide-react';
import { HushArcMark } from './HushArcMark.js';

interface EmptyRoomStateProps {
  invitationUrl: string;
  isDirect: boolean;
}

export const EmptyRoomState: React.FC<EmptyRoomStateProps> = ({
  invitationUrl,
  isDirect,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'HushArc Private Conversation',
          text: 'Join my private, ephemeral, end-to-end encrypted room on HushArc.',
          url: invitationUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
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
          {isDirect ? 'Waiting for companion signal...' : 'Room open for participants'}
        </h3>
        <p className="text-xs text-text-secondary leading-relaxed max-w-xs mx-auto">
          Share your private invitation link. The encryption key is embedded in the URL fragment
          and will never be transmitted to the server.
        </p>
      </div>

      <div className="w-full space-y-3">
        <div className="flex items-center gap-2 p-2 bg-ink rounded-lg border border-ink-border text-left">
          <input
            type="text"
            readOnly
            value={invitationUrl}
            className="w-full bg-transparent text-xs font-mono text-text-secondary outline-none truncate select-all px-1"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 p-2 rounded-md bg-ink-elevated hover:bg-ink-hover border border-ink-border text-text-primary hover:text-signal-lime transition-colors flex items-center gap-1.5 text-xs font-mono"
            title="Copy invitation link"
          >
            {copied ? (
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

        {typeof navigator !== 'undefined' && 'share' in navigator && (
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full py-2.5 px-4 rounded-lg bg-ink-elevated hover:bg-ink-hover border border-ink-border text-text-primary font-mono text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5 text-signal-lime" />
            <span>Share via Device Sheet</span>
          </button>
        )}
      </div>

      <div className="text-[11px] font-mono text-sage-light tracking-wide bg-ink-elevated/40 px-3 py-1.5 rounded-full border border-ink-border/50">
        ⚡ No message queue • Both participants must be online
      </div>
    </div>
  );
};
