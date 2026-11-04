import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
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
  return (
    fileName
      .replace(/[/\\?%*:|"<>]/g, '_')
      .replace(/[\x00-\x1f\x80-\x9f]/g, '')
      .trim() || 'attachment'
  );
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

const formatTime = (ts: number) => {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
};

interface MessageItemProps {
  message: DecryptedMessage;
  quotedMessage?: DecryptedMessage | null;
  isMine: boolean;
  isActiveAction: boolean;
  isReactionPickerOpen: boolean;
  onToggleAction: (msgId: string) => void;
  onToggleReactionPicker: (msgId: string) => void;
  onReply: (msg: DecryptedMessage) => void;
  onReact: (msgId: string, emoji: string) => void;
  onOpenLightbox: (url: string, name: string) => void;
}

// Memoized individual message item to prevent re-rendering unaffected messages
const MessageItem = memo<MessageItemProps>(({
  message,
  quotedMessage,
  isMine,
  isActiveAction,
  isReactionPickerOpen,
  onToggleAction,
  onToggleReactionPicker,
  onReply,
  onReact,
  onOpenLightbox,
}) => {
  const hasReactions = Object.keys(message.reactions).length > 0;
  const safeName = message.attachment ? sanitizeFileName(message.attachment.fileName) : '';

  return (
    <div
      className={`group relative flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-[92%] sm:max-w-2xl ${
        isMine ? 'ml-auto' : 'mr-auto'
      } space-y-1 animate-fadeIn`}
    >
      {/* Speaker Header */}
      <div className="flex items-center gap-2 px-1 text-[11px] font-mono select-none">
        <span className={`font-semibold ${isMine ? 'text-signal-lime' : 'text-sage-light'}`}>
          {message.senderNickname}
        </span>
        <span className="text-text-muted text-[10px]">{formatTime(message.timestamp)}</span>
        {isMine && (
          <span title={`Delivery: ${message.deliveryStatus}`} className="inline-flex items-center ml-0.5">
            {message.deliveryStatus === 'sending' ? (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            ) : message.deliveryStatus === 'delivered' ? (
              <CheckCheck className="w-3.5 h-3.5 text-signal-lime" />
            ) : (
              <Check className="w-3.5 h-3.5 text-text-muted" />
            )}
          </span>
        )}
      </div>

      {/* Quoted Message Snippet */}
      {quotedMessage && (
        <div
          className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono rounded-lg border border-ink-border bg-ink/70 text-text-muted max-w-[240px] sm:max-w-md ${
            isMine ? 'border-r-2 border-r-signal-lime' : 'border-l-2 border-l-sage'
          }`}
        >
          <CornerDownRight className="w-3 h-3 text-signal-lime shrink-0" />
          <span className="font-semibold text-text-secondary truncate max-w-[80px]">
            {quotedMessage.senderNickname}:
          </span>
          <span className="truncate">{quotedMessage.plaintext}</span>
        </div>
      )}

      {/* Message Bubble Container */}
      <div className="relative group/bubble max-w-full">
        <div
          onClick={() => onToggleAction(message.id)}
          className={`relative px-3.5 sm:px-4 py-2.5 rounded-2xl text-xs font-sans leading-relaxed break-words max-w-full cursor-pointer select-text ${
            isMine
              ? 'bg-ink-surface border border-ink-border text-text-primary rounded-tr-sm shadow-sm'
              : 'bg-ink-elevated border border-ink-border text-text-primary rounded-tl-sm shadow-sm'
          }`}
        >
          {message.attachment ? (
            <div className="space-y-2">
              {isSafeRasterImage(message.attachment.fileType) && message.attachment.blobUrl && (
                <div className="overflow-hidden rounded-xl border border-ink-border max-w-sm">
                  <img
                    src={message.attachment.blobUrl}
                    alt={safeName}
                    className="max-h-60 sm:max-h-64 w-auto object-cover hover:scale-[1.02] transition-transform duration-200 cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenLightbox(message.attachment!.blobUrl!, safeName);
                    }}
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
                    {formatBytes(message.attachment.fileSize)}
                    {!message.attachment.isComplete && ` • Decrypting (${message.attachment.progress}%)...`}
                  </div>
                  {!message.attachment.isComplete && (
                    <div className="w-full bg-ink-border h-1 rounded-full mt-1 overflow-hidden">
                      <div
                        className="bg-signal-lime h-full transition-all duration-150"
                        style={{ width: `${message.attachment.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {message.attachment.blobUrl && message.attachment.isComplete && (
                  <a
                    href={message.attachment.blobUrl}
                    download={safeName}
                    onClick={(e) => e.stopPropagation()}
                    className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg bg-ink hover:bg-signal-lime text-text-muted hover:text-ink transition-colors shrink-0"
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
              {message.plaintext}
            </div>
          )}
        </div>

        {/* Action Toolbar: Visible on hover on desktop, or when activeAction on mobile/touch */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 transition-all flex items-center gap-1 bg-ink-elevated border border-ink-border rounded-lg p-0.5 shadow-lg select-none z-20 ${
            isMine ? '-left-16 sm:-left-16' : '-right-16 sm:-right-16'
          } ${
            isActiveAction
              ? 'opacity-100 scale-100 pointer-events-auto'
              : 'opacity-0 scale-95 pointer-events-none group-hover/bubble:opacity-100 group-hover/bubble:scale-100 group-hover/bubble:pointer-events-auto'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onReply(message)}
            className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center hover:text-signal-lime text-text-muted transition-colors rounded active:scale-95"
            title="Reply"
            aria-label="Reply to message"
          >
            <Reply className="w-3.5 h-3.5" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => onToggleReactionPicker(message.id)}
              className="p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center hover:text-signal-lime text-text-muted transition-colors rounded active:scale-95"
              title="React with encrypted emoji"
              aria-label="Add reaction"
            >
              <Smile className="w-3.5 h-3.5" />
            </button>
            {isReactionPickerOpen && (
              <ReactionPicker
                onSelectEmoji={(emoji) => onReact(message.id, emoji)}
                onClose={() => onToggleReactionPicker(message.id)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Reactions Row */}
      {hasReactions && (
        <div className="flex flex-wrap gap-1 px-1 pt-0.5">
          {Object.entries(message.reactions).map(([emoji, senders]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onReact(message.id, emoji)}
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
});

MessageItem.displayName = 'MessageItem';

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  onReply,
  onReact,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [activeReactionMessageId, setActiveReactionMessageId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Close active action popover when clicking anywhere else
  const handleContainerClick = () => {
    setActiveActionId(null);
    setActiveReactionMessageId(null);
  };

  // O(1) lookup Map for quoted message parents
  const messagesMap = useMemo(() => {
    return new Map(messages.map((m) => [m.id, m]));
  }, [messages]);

  const handleToggleAction = (msgId: string) => {
    setActiveActionId((prev) => (prev === msgId ? null : msgId));
    if (activeReactionMessageId !== msgId) {
      setActiveReactionMessageId(null);
    }
  };

  const handleToggleReactionPicker = (msgId: string) => {
    setActiveReactionMessageId((prev) => (prev === msgId ? null : msgId));
  };

  const handleOpenLightbox = (url: string, name: string) => {
    setPreviewImage({ url, name });
  };

  return (
    <div
      className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-4"
      onClick={handleContainerClick}
    >
      {messages.map((msg) => (
        <MessageItem
          key={msg.id}
          message={msg}
          quotedMessage={msg.replyToId ? messagesMap.get(msg.replyToId) : null}
          isMine={msg.isMine}
          isActiveAction={activeActionId === msg.id}
          isReactionPickerOpen={activeReactionMessageId === msg.id}
          onToggleAction={handleToggleAction}
          onToggleReactionPicker={handleToggleReactionPicker}
          onReply={onReply}
          onReact={onReact}
          onOpenLightbox={handleOpenLightbox}
        />
      ))}
      <div ref={bottomRef} />

      {/* Safe In-App Image Lightbox Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-fadeIn"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-4xl max-h-[90dvh] bg-ink-elevated border border-ink-border rounded-2xl p-2 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-2 border-b border-ink-border">
              <span className="text-xs font-mono text-text-muted truncate max-w-xs">{previewImage.name}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary transition-colors"
                aria-label="Close image preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center">
              <img
                src={previewImage.url}
                alt={previewImage.name}
                className="max-h-[75dvh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
