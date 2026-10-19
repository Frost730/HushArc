import React, { useState } from 'react';
import { X, Sparkles, Shield, Users, User, ArrowRight, Loader2 } from 'lucide-react';
import { HushArcMark } from '../../components/HushArcMark.js';
import { generateRandomNickname, buildInvitationUrl } from '../../lib/ephemeral-session/session.js';
import { generateSymmetricRoomKey } from '../../lib/crypto/e2ee.js';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomCreated: (
    invitationUrl: string,
    roomId: string,
    accessSecret: string,
    encryptionKey: string,
    nickname: string
  ) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onRoomCreated,
}) => {
  const [isDirect, setIsDirect] = useState(true);
  const [nickname, setNickname] = useState(() => generateRandomNickname());
  const [maxParticipants, setMaxParticipants] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRandomizeNickname = () => {
    setNickname(generateRandomNickname());
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // 1. Call Express backend to initialize ephemeral room state
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isDirect,
          maxParticipants: isDirect ? 2 : maxParticipants,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create ephemeral room. Please try again.');
      }

      const { roomId, accessSecret } = await res.json();

      // 2. Independently generate symmetric room key in browser
      const encryptionKey = await generateSymmetricRoomKey();

      // 3. Assemble invitation URL with encryption key in the hash fragment
      const invitationUrl = buildInvitationUrl({
        roomId,
        accessSecret,
        encryptionKey,
      });

      onRoomCreated(invitationUrl, roomId, accessSecret, encryptionKey, nickname);
    } catch (err: any) {
      setError(err?.message || 'Error initializing room');
    } finally {
      setLoading(false);
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
              Create Ephemeral Room
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
          <div className="p-3 bg-coral-dim border border-coral text-coral rounded-xl text-xs font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Room Type Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-text-muted uppercase tracking-wider">
              Conversation Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsDirect(true)}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                  isDirect
                    ? 'bg-ink border-signal-lime text-signal-lime shadow-signal-glow-sm'
                    : 'bg-ink/50 border-ink-border text-text-secondary hover:border-ink-subtle'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Direct Signal (1:1)</span>
              </button>
              <button
                type="button"
                onClick={() => setIsDirect(false)}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border text-xs font-medium transition-all ${
                  !isDirect
                    ? 'bg-ink border-signal-lime text-signal-lime shadow-signal-glow-sm'
                    : 'bg-ink/50 border-ink-border text-text-secondary hover:border-ink-subtle'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Group Arc</span>
              </button>
            </div>
          </div>

          {/* Group Capacity Slider */}
          {!isDirect && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-text-muted">Max Group Members:</span>
                <span className="text-signal-lime font-semibold">{maxParticipants}</span>
              </div>
              <input
                type="range"
                min="3"
                max="25"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(parseInt(e.target.value, 10))}
                className="w-full accent-signal-lime bg-ink h-1.5 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          )}

          {/* Temporary Nickname */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-mono text-text-muted uppercase tracking-wider flex items-center justify-between">
              <span>Your Temporary Identity</span>
              <span className="text-sage-light normal-case">Not an account</span>
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
                title="Generate another signal identity"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="p-3 bg-ink/40 rounded-xl border border-ink-border/50 text-[11px] text-text-muted space-y-1">
            <div className="flex items-center gap-1.5 text-text-secondary font-medium">
              <Shield className="w-3.5 h-3.5 text-signal-lime" />
              <span>Zero Record Guarantee</span>
            </div>
            <p>No chat history is kept on the server or on disk. Disconnecting destroys all traces.</p>
          </div>

          <button
            type="submit"
            disabled={loading || !nickname.trim()}
            className="w-full py-2.5 px-4 rounded-xl bg-signal-lime hover:bg-[#c2ed5c] disabled:opacity-50 text-ink font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-signal-glow-sm mt-3"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Establishing Secure Epoch...</span>
              </>
            ) : (
              <>
                <span>Launch Ephemeral Room</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
