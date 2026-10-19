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
      className="absolute bottom-full mb-1 right-0 z-30 p-1.5 bg-ink-elevated border border-ink-border rounded-xl shadow-xl flex items-center gap-1 select-none animate-fadeIn"
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
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-ink-hover text-base transition-transform active:scale-125 hover:scale-110"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};
