import React, { useState } from 'react';
import { X, KeyRound, Sparkles, ArrowRight, ShieldAlert, Link as LinkIcon, Hash, Loader2 } from 'lucide-react';
import { HushArcMark } from '../../components/HushArcMark.js';
import { generateRandomNickname, parseInvitationInput, encodeRoomCode } from '../../lib/ephemeral-session/session.js';

interface JoinRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJoin: (roomId: string, accessSecret: string, encryptionKey: string, nickname: string, shortCode?: string) => void;
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
  const [activeTab, setActiveTab] = useState<'code' | 'link'>('code');
  const [inputVal, setInputVal] = useState(() => {
    if (initialRoomId && initialAccessSecret && initialEncryptionKey) {
      return encodeRoomCode({
        roomId: initialRoomId,
        accessSecret: initialAccessSecret,
        encryptionKey: initialEncryptionKey,
      });
    }
    return '';
  });
  const [nickname, setNickname] = useState(() => generateRandomNickname());
  const [error, setError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  React.useEffect(() => {
    if (initialRoomId && initialAccessSecret && initialEncryptionKey) {
      setInputVal(
        encodeRoomCode({
          roomId: initialRoomId,
          accessSecret: initialAccessSecret,
          encryptionKey: initialEncryptionKey,
        })
      );
    } else if (initialRoomId) {
      setInputVal(initialRoomId);
    }
  }, [initialRoomId, initialAccessSecret, initialEncryptionKey]);

  if (!isOpen) return null;

  const handleRandomizeNickname = () => {
    setNickname(generateRandomNickname());
  };

  const handleParseAndJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const input = inputVal.trim();
    if (!input) {
      setError(activeTab === 'code' ? 'Please enter a room code.' : 'Please enter an invitation link.');
      return;
    }

    // 1. Check if input is a direct link or legacy full base64 room code (starts with HUSH-)
    const parsed = parseInvitationInput(input);
    if (parsed) {
      onJoin(parsed.roomId, parsed.accessSecret, parsed.encryptionKey, nickname.trim());
      return;
    }

    // 2. Check if it's a 6-digit short code (e.g. 482-915 or 482915)
    const cleanCode = input.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
    if (cleanCode.length === 6) {
      setIsResolving(true);
      try {
        const res = await fetch(`/api/rooms/resolve/${encodeURIComponent(cleanCode)}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || 'Room not found or code expired.');
        }
        const data = await res.json();
        if (!data.roomId || !data.accessSecret) {
          throw new Error('Invalid room resolution response.');
        }
        // Room resolved! Join the room; encryption key is exchanged peer-to-peer over secure WebSocket
        onJoin(data.roomId, data.accessSecret, '', nickname.trim(), data.shortCode);
        return;
      } catch (err: any) {
        setError(err.message || 'Failed to resolve room code. Please check the code and try again.');
        return;
      } finally {
        setIsResolving(false);
      }
    }

    setError(
      activeTab === 'code'
        ? 'Invalid room code format. Please enter a 6-digit code (e.g. 482-915).'
        : 'Invalid invitation link format. Must contain the room ID and parameters.'
    );
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

        {/* Tab switch between Code and Link */}
        <div className="flex bg-ink p-1 rounded-xl border border-ink-border">
          <button
            type="button"
            onClick={() => {
              setActiveTab('code');
              setError(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all ${
              activeTab === 'code'
                ? 'bg-ink-surface text-signal-lime shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Hash className="w-3.5 h-3.5" />
            <span>Join with Code</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('link');
              setError(null);
            }}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-mono font-medium flex items-center justify-center gap-2 transition-all ${
              activeTab === 'link'
                ? 'bg-ink-surface text-signal-lime shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>Join with Link</span>
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
            <label className="text-[11px] font-mono text-text-muted uppercase tracking-wider flex items-center justify-between">
              <span>{activeTab === 'code' ? 'Room Code' : 'Invitation Link'}</span>
              <span className="text-[10px] text-sage-light normal-case">
                {activeTab === 'code' ? '6 digits (e.g. 482-915)' : 'URL with access key'}
              </span>
            </label>
            <div className="flex items-center gap-2 p-2 bg-ink rounded-xl border border-ink-border focus-within:border-signal-lime">
              {activeTab === 'code' ? (
                <KeyRound className="w-4 h-4 text-text-muted shrink-0 ml-1" />
              ) : (
                <LinkIcon className="w-4 h-4 text-text-muted shrink-0 ml-1" />
              )}
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                required
                className={`w-full bg-transparent px-1 text-xs font-mono outline-none ${
                  activeTab === 'code' ? 'text-signal-lime font-semibold tracking-wider text-sm' : 'text-text-primary'
                }`}
                placeholder={activeTab === 'code' ? 'e.g. 482-915' : 'https://.../r/...#access=...&key=...'}
              />
            </div>
            <p className="text-[11px] text-text-muted font-mono">
              {activeTab === 'code'
                ? 'Enter the 6-digit code provided by the conversation host.'
                : 'Paste the complete invitation URL shared with you.'}
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
            disabled={isResolving}
            className="w-full py-2.5 px-4 rounded-xl bg-signal-lime hover:bg-[#c2ed5c] disabled:opacity-50 disabled:cursor-not-allowed text-ink font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-signal-glow-sm mt-3"
          >
            {isResolving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Resolving Room Code...</span>
              </>
            ) : (
              <>
                <span>Decrypt and Enter</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
