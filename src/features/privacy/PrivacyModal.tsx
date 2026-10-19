import React from 'react';
import { X, ShieldCheck, DatabaseZap, EyeOff, AlertTriangle, Cpu } from 'lucide-react';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg bg-ink-elevated border border-ink-border rounded-2xl p-6 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-ink-border">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-signal-lime" />
            <h2 className="font-display font-semibold text-lg text-text-primary">
              HushArc Security & Ephemeral Model
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-text-muted hover:text-text-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs font-sans text-text-secondary leading-relaxed">
          <div className="p-3.5 bg-ink rounded-xl border border-ink-border space-y-2">
            <div className="flex items-center gap-2 text-text-primary font-semibold font-mono text-[13px]">
              <DatabaseZap className="w-4 h-4 text-signal-lime" />
              Strict No-Persistence Architecture
            </div>
            <p>
              HushArc contains no PostgreSQL, SQLite, Redis, MongoDB, or local filesystems. Active
              rooms exist exclusively in server RAM. When the last participant leaves or closes the
              tab, the room and its metadata are destroyed immediately.
            </p>
          </div>

          <div className="p-3.5 bg-ink rounded-xl border border-ink-border space-y-2">
            <div className="flex items-center gap-2 text-text-primary font-semibold font-mono text-[13px]">
              <EyeOff className="w-4 h-4 text-signal-lime" />
              Genuine End-to-End Encryption
            </div>
            <p>
              Messages are encrypted inside your browser using Libsodium authenticated encryption
              (<strong>XChaCha20-Poly1305</strong>). The encryption key is held only in the browser
              memory and passed through the URL hash fragment (#key=...), which web browsers never
              send to the Express backend.
            </p>
          </div>

          <div className="p-3.5 bg-ink rounded-xl border border-ink-border space-y-2">
            <div className="flex items-center gap-2 text-text-primary font-semibold font-mono text-[13px]">
              <Cpu className="w-4 h-4 text-signal-lime" />
              No Offline Queue
            </div>
            <p>
              If a recipient is not connected when a transmission is dispatched, the message is not
              stored for later delivery. Both participants must be simultaneously present in the
              moment.
            </p>
          </div>

          <div className="p-3.5 bg-ink/60 rounded-xl border border-coral/30 space-y-2 text-text-secondary">
            <div className="flex items-center gap-2 text-coral font-semibold font-mono text-[13px]">
              <AlertTriangle className="w-4 h-4" />
              Honest Security Boundaries & Limitations
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
              <li>
                Anyone with the full invitation URL can join the room. Treat links as bearer credentials.
              </li>
              <li>
                We do not promise "total untraceability" from network intermediaries; Render and ISPs
                may log TCP connection timestamps and IP metadata.
              </li>
              <li>
                Authorized room participants can copy or screenshot plaintext while in the room.
              </li>
              <li>
                JavaScript memory cannot be guaranteed physically zeroized by the OS after process exit.
              </li>
            </ul>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-xl bg-signal-lime hover:bg-[#c2ed5c] text-ink font-semibold text-xs transition-colors shadow-signal-glow-sm"
        >
          I Understand
        </button>
      </div>
    </div>
  );
};
