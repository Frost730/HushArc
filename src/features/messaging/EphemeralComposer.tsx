import React, { useState, useRef, useEffect } from 'react';
import { Send, X, CornerDownRight } from 'lucide-react';
import type { DecryptedMessage } from '../../hooks/useHushArcRoom.js';

interface EphemeralComposerProps {
  onSendMessage: (text: string, replyToId?: string) => void;
  onTyping: (isTyping: boolean) => void;
  replyToMessage?: DecryptedMessage | null;
  onClearReply: () => void;
  disabled?: boolean;
}

export const EphemeralComposer: React.FC<EphemeralComposerProps> = ({
  onSendMessage,
  onTyping,
  replyToMessage,
  onClearReply,
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [text]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onTyping(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    onSendMessage(trimmed, replyToMessage?.id);
    setText('');
    onClearReply();
    onTyping(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  return (
    <div className="w-full bg-ink-elevated border-t border-ink-border p-3 space-y-2 safe-bottom">
      {/* Quoted reply banner */}
      {replyToMessage && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-ink rounded-lg border border-ink-border text-xs font-mono">
          <div className="flex items-center gap-2 truncate text-text-secondary">
            <CornerDownRight className="w-3.5 h-3.5 text-signal-lime shrink-0" />
            <span className="font-semibold text-text-primary">{replyToMessage.senderNickname}:</span>
            <span className="truncate max-w-[240px] text-text-muted">{replyToMessage.plaintext}</span>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="p-1 text-text-muted hover:text-text-primary"
            aria-label="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main text composer */}
      <div className="flex items-end gap-2 bg-ink p-1.5 rounded-xl border border-ink-border focus-within:border-signal-lime transition-colors">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Transmit ephemeral signal... (Enter to send)"
          rows={1}
          maxLength={2000}
          className="w-full bg-transparent px-3 py-2 text-xs font-sans text-text-primary placeholder:text-text-muted outline-none resize-none max-h-36 overflow-y-auto leading-relaxed"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="shrink-0 p-2.5 rounded-lg bg-signal-lime hover:bg-[#c2ed5c] disabled:opacity-30 disabled:hover:bg-signal-lime text-ink font-semibold transition-all active:scale-95 shadow-signal-glow-sm"
          title="Send message"
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>

      {text.length > 500 && (
        <div className="flex justify-end px-1 text-[10px] font-mono text-text-muted">
          <span>{text.length}/2000</span>
        </div>
      )}
    </div>
  );
};
