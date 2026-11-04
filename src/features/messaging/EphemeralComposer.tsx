import React, { useState, useRef, useEffect } from 'react';
import { Send, X, CornerDownRight, Paperclip, Loader2 } from 'lucide-react';
import type { DecryptedMessage } from '../../hooks/useHushArcRoom.js';

interface EphemeralComposerProps {
  onSendMessage: (text: string, replyToId?: string) => void;
  onSendAttachment?: (file: File) => Promise<void>;
  onTyping: (isTyping: boolean) => void;
  replyToMessage?: DecryptedMessage | null;
  onClearReply: () => void;
  disabled?: boolean;
}

export const EphemeralComposer: React.FC<EphemeralComposerProps> = ({
  onSendMessage,
  onSendAttachment,
  onTyping,
  replyToMessage,
  onClearReply,
  disabled = false,
}) => {
  const [text, setText] = useState('');
  const [isAttaching, setIsAttaching] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileClick = () => {
    setAttachmentError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input value so selecting the same file again triggers change
    e.target.value = '';

    // Enforce 5MB limit
    if (file.size > 5 * 1024 * 1024) {
      setAttachmentError('Attachment exceeds 5 MB limit');
      setTimeout(() => setAttachmentError(null), 4000);
      return;
    }

    if (!onSendAttachment) return;

    try {
      setIsAttaching(true);
      setAttachmentError(null);
      await onSendAttachment(file);
    } catch (err) {
      setAttachmentError(err instanceof Error ? err.message : 'Failed to transmit attachment');
      setTimeout(() => setAttachmentError(null), 4000);
    } finally {
      setIsAttaching(false);
    }
  };

  return (
    <div className="w-full bg-ink-elevated border-t border-ink-border p-2.5 sm:p-3 space-y-2 safe-bottom shrink-0">
      {/* Quoted reply banner */}
      {replyToMessage && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-ink rounded-lg border border-ink-border text-xs font-mono">
          <div className="flex items-center gap-2 truncate text-text-secondary">
            <CornerDownRight className="w-3.5 h-3.5 text-signal-lime shrink-0" />
            <span className="font-semibold text-text-primary">{replyToMessage.senderNickname}:</span>
            <span className="truncate max-w-[200px] sm:max-w-[320px] text-text-muted">{replyToMessage.plaintext}</span>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="p-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center text-text-muted hover:text-text-primary transition-colors active:scale-95"
            aria-label="Cancel reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Attachment error badge */}
      {attachmentError && (
        <div className="px-3 py-1 bg-coral-dim border border-coral text-coral rounded-lg text-xs font-mono">
          {attachmentError}
        </div>
      )}

      {/* Main composer bar */}
      <div className="flex items-end gap-1.5 sm:gap-2 bg-ink p-1 sm:p-1.5 rounded-xl border border-ink-border focus-within:border-signal-lime transition-colors">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || isAttaching}
        />

        {/* Attachment trigger (>=44x44px accessible touch target) */}
        <button
          type="button"
          onClick={handleFileClick}
          disabled={disabled || isAttaching}
          className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-text-muted hover:text-signal-lime hover:bg-ink-surface disabled:opacity-30 transition-all active:scale-95"
          title="Attach encrypted file (max 5MB, chunked at 32KB)"
          aria-label="Attach file"
        >
          {isAttaching ? (
            <Loader2 className="w-5 h-5 animate-spin text-signal-lime" />
          ) : (
            <Paperclip className="w-5 h-5" />
          )}
        </button>

        {/* Message Input: 16px (text-base) on mobile viewports prevents iOS Safari auto-zoom, text-xs on larger screens */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Transmit signal... (Enter to send)"
          rows={1}
          maxLength={2000}
          className="w-full bg-transparent px-2 py-2.5 text-base sm:text-xs font-sans text-text-primary placeholder:text-text-muted outline-none resize-none max-h-36 overflow-y-auto leading-relaxed"
        />

        {/* Send trigger (>=44x44px accessible touch target) */}
        <button
          type="button"
          onClick={handleSend}
          disabled={disabled || !text.trim()}
          className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg bg-signal-lime hover:bg-[#c2ed5c] disabled:opacity-30 disabled:hover:bg-signal-lime text-ink font-semibold transition-all active:scale-95 shadow-signal-glow-sm"
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
