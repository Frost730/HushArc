import React, { useState } from 'react';
import { ShieldCheck, Info, X, KeyRound, Lock, EyeOff } from 'lucide-react';

interface EncryptionIndicatorProps {
  epoch: number;
  publicKey?: string;
  hasKey: boolean;
}

export const EncryptionIndicator: React.FC<EncryptionIndicatorProps> = ({
  epoch,
  publicKey,
  hasKey,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const keyFingerprint = publicKey ? publicKey.slice(0, 12) + '...' : 'Ephemeral';

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        type="button"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-ink-elevated hover:bg-ink-hover border border-ink-border text-xs font-mono transition-colors text-text-secondary hover:text-signal-lime focus:outline-none focus:ring-1 focus:ring-signal-lime"
        title="Inspect real cryptographic security"
      >
        <ShieldCheck className={`w-3.5 h-3.5 ${hasKey ? 'text-signal-lime' : 'text-coral'}`} />
        <span className="text-[11px] font-medium tracking-wide">
          {hasKey ? `E2EE • Epoch ${epoch}` : 'Key Unset'}
        </span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md bg-ink-elevated border border-ink-border rounded-xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-ink-border">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-signal-lime" />
                <h3 className="font-display font-semibold text-text-primary text-base">
                  Living Signal Cryptography
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-md transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-sans text-text-secondary leading-relaxed">
              <div className="p-3 bg-ink rounded-lg border border-ink-border space-y-2 font-mono">
                <div className="flex justify-between items-center">
                  <span className="text-text-muted flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-signal-lime" />
                    Symmetric Cipher:
                  </span>
                  <span className="text-text-primary font-semibold">XChaCha20-Poly1305</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-signal-lime" />
                    Key Exchange:
                  </span>
                  <span className="text-text-primary font-semibold">X25519 Ephemeral Box</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Current Epoch:</span>
                  <span className="text-signal-lime font-semibold">Epoch {epoch}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-muted">Public Identity Fingerprint:</span>
                  <span className="text-text-primary">{keyFingerprint}</span>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-start gap-2">
                  <EyeOff className="w-4 h-4 text-signal-lime shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-text-primary">True End-to-End Encryption:</strong> The
                    server merely routes authenticated ciphertext nonces. Express and Render have no
                    access to your encryption secret or plaintext.
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-sage-light shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-text-primary">Zero Disk Storage:</strong> When all
                    participants leave or close the page, the room is deleted instantly from server
                    memory. No message history is ever saved.
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2 px-4 rounded-lg bg-ink-hover hover:bg-ink-subtle text-text-primary font-medium text-xs border border-ink-border transition-colors mt-2"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
};
