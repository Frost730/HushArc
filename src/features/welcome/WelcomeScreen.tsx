import React, { useState, useEffect } from 'react';
import { ArrowRight, KeyRound, Shield, Lock, Download, Radio, EyeOff, ServerOff } from 'lucide-react';
import { HushArcMark } from '../../components/HushArcMark.js';
import { PrivacyModal } from '../privacy/PrivacyModal.js';

interface WelcomeScreenProps {
  onCreateRoom: () => void;
  onJoinRoom: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onCreateRoom,
  onJoinRoom,
}) => {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Catch PWA install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between p-6 sm:p-12 z-10">
      {/* Top Brand Anchor */}
      <header className="flex items-center justify-between w-full max-w-6xl mx-auto select-none">
        <div className="flex items-center gap-3">
          <HushArcMark size="sm" animate={true} />
          <div>
            <h1 className="font-display font-bold text-lg tracking-tight text-text-primary">
              HushArc
            </h1>
            <p className="text-[10px] font-mono text-sage-light tracking-widest uppercase">
              Living Signal • v1.0
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {deferredPrompt && (
            <button
              type="button"
              onClick={handleInstallPwa}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-elevated hover:bg-ink-hover border border-ink-border text-xs font-mono text-text-primary hover:text-signal-lime transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-signal-lime" />
              <span>Install App</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-elevated hover:bg-ink-hover border border-ink-border text-xs font-mono text-text-secondary hover:text-signal-lime transition-colors"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Security Model</span>
          </button>
        </div>
      </header>

      {/* Hero Editorial Composition */}
      <main className="w-full max-w-6xl mx-auto my-auto py-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Typographic Signal */}
        <div className="lg:col-span-7 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-ink-elevated border border-ink-border text-xs font-mono text-signal-lime">
            <Radio className="w-3 h-3 animate-pulse" />
            <span className="tracking-wide">No Database • Ephemeral Memory Only</span>
          </div>

          <div className="space-y-3">
            <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-text-primary leading-[1.08]">
              Some things belong{' '}
              <span className="text-signal-lime underline decoration-signal-lime/40 underline-offset-8">
                in the moment.
              </span>
            </h2>
            <p className="text-base sm:text-lg text-text-secondary leading-relaxed font-sans max-w-xl">
              No accounts. No archives. Just your people, here and now. Fully client-side end-to-end
              encrypted communications that vanish when you depart.
            </p>
          </div>

          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3">
            <button
              type="button"
              onClick={onCreateRoom}
              className="py-3.5 px-6 rounded-2xl bg-signal-lime hover:bg-[#c2ed5c] text-ink font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 shadow-signal-glow active:translate-y-0"
            >
              <span>Create an Ephemeral Room</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onJoinRoom}
              className="py-3.5 px-6 rounded-2xl bg-ink-elevated hover:bg-ink-hover border border-ink-border text-text-primary hover:text-signal-lime font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <KeyRound className="w-4 h-4" />
              <span>Join with Secret Link</span>
            </button>
          </div>
        </div>

        {/* Right Column: Architectural Invariants */}
        <div className="lg:col-span-5 space-y-3 font-mono">
          <div className="p-4 bg-ink-elevated/70 border border-ink-border rounded-2xl space-y-1.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-text-primary text-xs font-semibold">
              <ServerOff className="w-4 h-4 text-signal-lime" />
              <span>Zero Application Databases</span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed font-sans">
              No PostgreSQL, SQLite, MongoDB, or disk storage. Rooms disappear the second all
              participants leave.
            </p>
          </div>

          <div className="p-4 bg-ink-elevated/70 border border-ink-border rounded-2xl space-y-1.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-text-primary text-xs font-semibold">
              <Lock className="w-4 h-4 text-signal-lime" />
              <span>XChaCha20-Poly1305 AEAD</span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed font-sans">
              Encrypted locally on your machine via Libsodium before hitting the WebSocket. The server
              cannot inspect your conversations.
            </p>
          </div>

          <div className="p-4 bg-ink-elevated/70 border border-ink-border rounded-2xl space-y-1.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-text-primary text-xs font-semibold">
              <EyeOff className="w-4 h-4 text-signal-lime" />
              <span>Anonymous Ephemeral Identities</span>
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed font-sans">
              No email addresses, phone numbers, or passwords. Temporary cryptographic keys are
              created per conversation and discarded on exit.
            </p>
          </div>
        </div>
      </main>

      {/* Footer Minimal Notice */}
      <footer className="w-full max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-ink-border/50 text-[11px] font-mono text-text-muted gap-2 select-none">
        <div>HushArc • Hosted on a single Render Free Web Service</div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="hover:text-text-primary underline transition-colors"
          >
            Cryptography & Limitations
          </button>
          <span>Single Instance Memory</span>
        </div>
      </footer>

      {/* Security Details Modal */}
      <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </div>
  );
};
