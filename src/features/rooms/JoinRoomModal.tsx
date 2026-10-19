import React, { useState } from 'react';
import { X, KeyRound, Sparkles, ArrowRight, ShieldAlert, Link as LinkIcon, Hash } from 'lucide-react';
import { HushArcMark } from '../../components/HushArcMark.js';
import { generateRandomNickname, parseInvitationInput, encodeRoomCode } from '../../lib/ephemeral-session/session.js';

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

  if (!isOpen) return null;

  const handleRandomizeNickname = () => {
    setNickname(generateRandomNickname());
  };

  const handleParseAndJoin = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const input = inputVal.trim();
    if (!input) {
      setError(activeTab === 'code' ? 'Please enter a room code.' : 'Please enter an invitation link.');
      return;
    }

    const parsed = parseInvitationInput(input);
    if (!parsed) {
      setError(
        activeTab === 'code'
          ? 'Invalid room code format. A valid code starts with "HUSH-".'
          : 'Invalid invitation link format. Must contain the room ID and parameters.'
      );
      return;
    }

    onJoin(parsed.roomId, parsed.accessSecret, parsed.encryptionKey, nickname.trim());
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
                {activeTab === 'code' ? 'Starts with HUSH-' : 'URL with access key'}
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
                className="w-full bg-transparent px-1 text-xs font-mono text-text-primary outline-none"
                placeholder={activeTab === 'code' ? 'HUSH-...' : 'https://.../r/...#access=...&key=...'}
              />
            </div>
            <p className="text-[11px] text-text-muted font-mono">
              {activeTab === 'code'
                ? 'Paste the room code provided by the conversation host.'
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
