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
              Zero Persistent Storage
            </div>
            <p>
              HushArc does not store messages on disk or in any permanent database. Active rooms exist
              only in live memory. When participants leave or close the page, the room and its
              messages are permanently destroyed.
            </p>
          </div>

          <div className="p-3.5 bg-ink rounded-xl border border-ink-border space-y-2">
            <div className="flex items-center gap-2 text-text-primary font-semibold font-mono text-[13px]">
              <EyeOff className="w-4 h-4 text-signal-lime" />
              End-to-End Encryption
            </div>
            <p>
              All messages are encrypted on your device before being sent. The server only relays
              encrypted ciphertext and has no ability to read your conversations.
            </p>
          </div>

          <div className="p-3.5 bg-ink rounded-xl border border-ink-border space-y-2">
            <div className="flex items-center gap-2 text-text-primary font-semibold font-mono text-[13px]">
              <Cpu className="w-4 h-4 text-signal-lime" />
              Live Presence Only
            </div>
            <p>
              There are no offline queues or stored inboxes. If a participant is not currently
              connected, messages are not stored for later delivery.
            </p>
          </div>

          <div className="p-3.5 bg-ink/60 rounded-xl border border-ink-border space-y-2 text-text-secondary">
            <div className="flex items-center gap-2 text-text-primary font-semibold font-mono text-[13px]">
              <AlertTriangle className="w-4 h-4 text-signal-lime" />
              Security Best Practices
            </div>
            <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
              <li>
                Anyone who receives your complete invitation link can join your room. Share links only with trusted people.
              </li>
              <li>
                Authorized room members can view and copy messages while connected.
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
