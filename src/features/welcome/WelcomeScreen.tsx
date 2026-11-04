import React, { useState, useEffect } from 'react';
import { ArrowRight, KeyRound, Shield, Download } from 'lucide-react';
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
    <div className="relative min-h-[100dvh] flex flex-col justify-between p-4 sm:p-8 md:p-12 z-10 safe-top safe-bottom safe-x">
      {/* Top Header */}
      <header className="flex items-center justify-between w-full max-w-5xl mx-auto select-none">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <HushArcMark size="sm" animate={true} />
          <div>
            <h1 className="font-display font-bold text-base sm:text-lg tracking-tight text-text-primary">
              HushArc
            </h1>
            <p className="text-[9px] sm:text-[10px] font-mono text-sage-light tracking-widest uppercase">
              Living Signal
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
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
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-ink-elevated hover:bg-ink-hover border border-ink-border text-xs font-mono text-text-secondary hover:text-signal-lime transition-colors active:scale-95"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Privacy</span>
          </button>
        </div>
      </header>

      {/* Hero Focused Composition */}
      <main className="w-full max-w-4xl mx-auto my-auto py-8 sm:py-12 flex flex-col items-center text-center space-y-6 sm:space-y-8">
        <div className="relative flex justify-center">
          <HushArcMark size="xl" animate={true} />
        </div>

        <div className="space-y-3 sm:space-y-4 max-w-2xl px-2">
          <h2 className="font-display text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-text-primary leading-[1.15]">
            Some things belong{' '}
            <span className="text-signal-lime underline decoration-signal-lime/40 underline-offset-8">
              in the moment.
            </span>
          </h2>
          <p className="text-sm sm:text-lg text-text-secondary leading-relaxed font-sans max-w-xl mx-auto">
            No accounts. No archives. Just your people, here and now.
            Encrypted conversations that vanish when you depart.
          </p>
        </div>

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md pt-2 px-2">
          <button
            type="button"
            onClick={onCreateRoom}
            className="w-full sm:w-auto min-h-[48px] py-3.5 px-6 rounded-2xl bg-signal-lime hover:bg-[#c2ed5c] text-ink font-display font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5 shadow-signal-glow active:translate-y-0"
          >
            <span>Create a Room</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onJoinRoom}
            className="w-full sm:w-auto min-h-[48px] py-3.5 px-6 rounded-2xl bg-ink-elevated hover:bg-ink-hover border border-ink-border text-text-primary hover:text-signal-lime font-display font-semibold text-sm flex items-center justify-center gap-2 transition-colors active:scale-98"
          >
            <KeyRound className="w-4 h-4" />
            <span>Join with Code or Link</span>
          </button>
        </div>
      </main>

      {/* Footer Minimal Notice */}
      <footer className="w-full max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between pt-4 sm:pt-6 border-t border-ink-border/50 text-[11px] font-mono text-text-muted gap-2 select-none">
        <div>HushArc • Anonymous & Ephemeral</div>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            className="hover:text-text-primary underline transition-colors"
          >
            Privacy & Security
          </button>
        </div>
      </footer>

      {/* Security Details Modal */}
      <PrivacyModal isOpen={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </div>
  );
};
