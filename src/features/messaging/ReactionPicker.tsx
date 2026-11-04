import React from 'react';

interface ReactionPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose: () => void;
}

const COMMON_EMOJIS = ['⚡', '🔒', '👁️', '🤫', '🛰️', '🔥', '❤️', '✨'];

export const ReactionPicker: React.FC<ReactionPickerProps> = ({
  onSelectEmoji,
  onClose,
}) => {
  return (
    <div
      className="absolute bottom-full mb-1.5 right-0 z-30 p-1.5 bg-ink-elevated border border-ink-border rounded-xl shadow-xl flex items-center flex-wrap max-w-[260px] sm:max-w-none gap-1 select-none animate-fadeIn"
      onClick={(e) => e.stopPropagation()}
    >
      {COMMON_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => {
            onSelectEmoji(emoji);
            onClose();
          }}
          className="w-9 h-9 sm:w-8 sm:h-8 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-ink-hover text-base transition-transform active:scale-125 hover:scale-110"
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};
