import React, { useState, useRef, useEffect } from 'react';
import { Check, CheckCheck, CornerDownRight, Smile, Reply, FileText, Download, X } from 'lucide-react';
import type { DecryptedMessage } from '../../hooks/useHushArcRoom.js';
import { ReactionPicker } from './ReactionPicker.js';

interface MessageListProps {
  messages: DecryptedMessage[];
  onReply: (message: DecryptedMessage) => void;
  onReact: (messageId: string, emoji: string) => void;
  myParticipantId?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Sanitize filename to prevent directory traversal or script injection in download attributes
function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/[\x00-\x1f\x80-\x9f]/g, '')
    .trim() || 'attachment';
}

// Check if an image format is safe for inline rendering (strictly raster images, no SVGs)
function isSafeRasterImage(fileType: string): boolean {
  const lower = fileType.toLowerCase();
  return (
    (lower === 'image/jpeg' ||
      lower === 'image/png' ||
      lower === 'image/webp' ||
      lower === 'image/gif') &&
    !lower.includes('svg') &&
    !lower.includes('xml')
  );
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  onReply,
  onReact,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  };

  // Find quoted reply message text
  const getQuotedMessage = (replyId?: string) => {
    if (!replyId) return null;
    return messages.find((m) => m.id === replyId);
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => {
        const isMine = msg.isMine;
        const quoted = getQuotedMessage(msg.replyToId);
        const hasReactions = Object.keys(msg.reactions).length > 0;
        const safeName = msg.attachment ? sanitizeFileName(msg.attachment.fileName) : '';

        return (
          <div
            key={msg.id}
            className={`group relative flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-2xl ${
              isMine ? 'ml-auto' : 'mr-auto'
            } space-y-1 animate-fadeIn`}
          >
            {/* Speaker Header */}
            <div className="flex items-center gap-2 px-1 text-[11px] font-mono select-none">
              <span
                className={`font-semibold ${
                  isMine ? 'text-signal-lime' : 'text-sage-light'
                }`}
              >
                {msg.senderNickname}
              </span>
              <span className="text-text-muted text-[10px]">{formatTime(msg.timestamp)}</span>
              {isMine && (
                <span title={`Delivery: ${msg.deliveryStatus}`} className="inline-flex items-center ml-0.5">
                  {msg.deliveryStatus === 'sending' ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  ) : msg.deliveryStatus === 'delivered' ? (
                    <CheckCheck className="w-3.5 h-3.5 text-signal-lime" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-text-muted" />
                  )}
                </span>
              )}
            </div>

            {/* Quoted Message Snippet */}
            {quoted && (
              <div
                className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono rounded-lg border border-ink-border bg-ink/70 text-text-muted max-w-md ${
                  isMine ? 'border-r-2 border-r-signal-lime' : 'border-l-2 border-l-sage'
                }`}
              >
                <CornerDownRight className="w-3 h-3 text-signal-lime shrink-0" />
                <span className="font-semibold text-text-secondary">{quoted.senderNickname}:</span>
                <span className="truncate">{quoted.plaintext}</span>
              </div>
            )}

            {/* Message Body */}
            <div
              className={`relative px-4 py-2.5 rounded-2xl text-xs font-sans leading-relaxed break-words max-w-full ${
                isMine
                  ? 'bg-ink-surface border border-ink-border text-text-primary rounded-tr-sm shadow-sm'
                  : 'bg-ink-elevated border border-ink-border text-text-primary rounded-tl-sm shadow-sm'
              }`}
            >
              {msg.attachment ? (
                <div className="space-y-2">
                  {isSafeRasterImage(msg.attachment.fileType) && msg.attachment.blobUrl && (
                    <div className="overflow-hidden rounded-xl border border-ink-border max-w-sm">
                      <img
                        src={msg.attachment.blobUrl}
                        alt={safeName}
                        className="max-h-64 w-auto object-cover hover:scale-[1.02] transition-transform duration-200 cursor-pointer"
                        onClick={() =>
                          setPreviewImage({
                            url: msg.attachment!.blobUrl!,
                            name: safeName,
                          })
                        }
                      />
                    </div>
                  )}

                  {/* File info bar & ephemeral download trigger */}
                  <div className="flex items-center gap-2.5 p-2 bg-ink/60 rounded-xl border border-ink-border font-mono text-xs">
                    <FileText className="w-5 h-5 text-signal-lime shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-text-primary truncate" title={safeName}>
                        {safeName}
                      </div>
                      <div className="text-[10px] text-text-muted">
                        {formatBytes(msg.attachment.fileSize)}
                        {!msg.attachment.isComplete && ` • Decrypting chunks (${msg.attachment.progress}%)...`}
                      </div>
                      {!msg.attachment.isComplete && (
                        <div className="w-full bg-ink-border h-1 rounded-full mt-1 overflow-hidden">
                          <div
                            className="bg-signal-lime h-full transition-all duration-150"
                            style={{ width: `${msg.attachment.progress}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {msg.attachment.blobUrl && msg.attachment.isComplete && (
                      <a
                        href={msg.attachment.blobUrl}
                        download={safeName}
                        className="p-1.5 rounded-lg bg-ink hover:bg-signal-lime text-text-muted hover:text-ink transition-colors shrink-0"
                        title="Download ephemeral file"
                        aria-label="Download attachment"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap selection:bg-signal-lime selection:text-ink">
                  {msg.plaintext}
                </div>
              )}

              {/* Action Toolbar on hover/focus */}
              <div
                className={`absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-ink-elevated border border-ink-border rounded-lg p-0.5 shadow-lg select-none z-10 ${
                  isMine ? '-left-16' : '-right-16'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onReply(msg)}
                  className="p-1 hover:text-signal-lime text-text-muted transition-colors rounded"
                  title="Reply"
                >
                  <Reply className="w-3.5 h-3.5" />
                </button>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveReactionMessageId(
                        activeReactionMessageId === msg.id ? null : msg.id
                      )
                    }
                    className="p-1 hover:text-signal-lime text-text-muted transition-colors rounded"
                    title="React with encrypted emoji"
                  >
                    <Smile className="w-3.5 h-3.5" />
                  </button>
                  {activeReactionMessageId === msg.id && (
                    <ReactionPicker
                      onSelectEmoji={(emoji) => onReact(msg.id, emoji)}
                      onClose={() => setActiveReactionMessageId(null)}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Reactions row */}
            {hasReactions && (
              <div className="flex flex-wrap gap-1 px-1 pt-0.5">
                {Object.entries(msg.reactions).map(([emoji, senders]) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onReact(msg.id, emoji)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-ink border border-ink-border hover:border-signal-lime text-[11px] font-mono text-text-secondary transition-colors"
                  >
                    <span>{emoji}</span>
                    <span>{senders.length}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />

      {/* Safe In-App Image Lightbox Modal (avoids cross-origin window.open execution) */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-ink-elevated border border-ink-border rounded-2xl p-2 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-ink-border">
              <span className="text-xs font-mono text-text-muted truncate max-w-xs">{previewImage.name}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
