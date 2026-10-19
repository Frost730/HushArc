import React, { useState } from 'react';
import { X, KeyRound, Sparkles, ArrowRight, ShieldAlert } from 'lucide-react';
import { HushArcMark } from '../../components/HushArcMark.js';
import { generateRandomNickname } from '../../lib/ephemeral-session/session.js';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (roomId: string, accessSecret: string, encryptionKey: string, nickname: string) => void;
  initialRoomId?: string;
  initialAccessSecret?: string;
  initialEncryptionKey?: string;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  onClose,
  onJoin,
  initialRoomId = '',
  initialAccessSecret = '',
  initialEncryptionKey = '',
}) => {
  const [rawInput, setRawInput] = useState(
    initialRoomId && initialAccessSecret && initialEncryptionKey
      ? `/r/${initialRoomId}#access=${initialAccessSecret}&key=${initialEncryptionKey}`
      : ''
  );
  const [nickname, setNickname] = useState(() => generateRandomNickname());
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRandomizeNickname = () => {
    setNickname(generateRandomNickname());
  };

  const handleParseAndJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const input = rawInput.trim();
    if (!input) {
      setError('Please provide an invitation link or parameters');
      return;
    }

    try {
      // Check if it's already full URL or relative path
      let urlStr = input;
      if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
        urlStr = 'https://dummy.local' + (urlStr.startsWith('/') ? '' : '/') + urlStr;
      }

      const parsedUrl = new URL(urlStr);
      // Path format: /r/:roomId
      const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
      let extractedRoomId = '';
      if (pathParts[0] === 'r' && pathParts[1]) {
        extractedRoomId = pathParts[1];
      } else if (pathParts[0]) {
        extractedRoomId = pathParts[0];
      }

      const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
      let extractedAccess = hashParams.get('access') || initialAccessSecret;
      let extractedKey = hashParams.get('key') || initialEncryptionKey;

      // Also check query parameters if hash wasn't present
      if (!extractedAccess) extractedAccess = parsedUrl.searchParams.get('access') || '';
      if (!extractedKey) extractedKey = parsedUrl.searchParams.get('key') || '';

      if (!extractedRoomId || !extractedAccess || !extractedKey) {
        throw new Error(
          'Incomplete invitation link. Must contain room ID, access token, and encryption key (#access=...&key=...).'
        );
      }

      onJoin(extractedRoomId, extractedAccess, extractedKey, nickname.trim());
    } catch (err: any) {
      setError(err?.message || 'Invalid invitation link format.');
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
              Join Ephemeral Room
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

        {error && (
          <div className="p-3 bg-coral-dim border border-coral text-coral rounded-xl text-xs font-mono flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleParseAndJoin} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-text-muted uppercase tracking-wider">
              Invitation Link or Room Secret
            </label>
            <div className="flex items-center gap-2 p-2 bg-ink rounded-xl border border-ink-border focus-within:border-signal-lime">
              <KeyRound className="w-4 h-4 text-text-muted shrink-0 ml-1" />
              <input
                type="text"
                value={rawInput}
                onChange={(e) => setRawInput(e.target.value)}
                required
                className="w-full bg-transparent px-1 text-xs font-mono text-text-primary outline-none"
                placeholder="https://.../r/roomId#access=...&key=..."
              />
            </div>
            <p className="text-[11px] text-text-muted font-mono">
              Paste the complete URL shared by the room creator.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-text-muted uppercase tracking-wider flex items-center justify-between">
              <span>Your Temporary Moniker</span>
              <span className="text-sage-light normal-case">Optional</span>
            </label>
            <div className="flex items-center gap-2 p-1.5 bg-ink rounded-xl border border-ink-border focus-within:border-signal-lime">
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={30}
                required
                className="w-full bg-transparent px-2 text-xs font-mono text-text-primary outline-none"
                placeholder="Choose temporary moniker"
              />
              <button
                type="button"
                onClick={handleRandomizeNickname}
                className="p-1.5 rounded-lg bg-ink-elevated hover:bg-ink-hover text-text-secondary hover:text-signal-lime transition-colors"
                title="Generate another moniker"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-signal-lime hover:bg-[#c2ed5c] text-ink font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-signal-glow-sm mt-3"
          >
            <span>Decrypt and Enter</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
