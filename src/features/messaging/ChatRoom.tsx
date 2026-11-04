import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { LogOut, Users, Share2, AlertCircle, Radio, Trash2 } from 'lucide-react';
import { HushArcMark } from '../../components/HushArcMark.js';
import { ConnectionStatus } from '../../components/ConnectionStatus.js';
import { EncryptionIndicator } from '../../components/EncryptionIndicator.js';
import { EmptyRoomState } from '../../components/EmptyRoomState.js';
import { MessageList } from './MessageList.js';
import { EphemeralComposer } from './EphemeralComposer.js';
import { ParticipantDrawer } from '../participants/ParticipantDrawer.js';
import { InvitationModal } from '../invitations/InvitationModal.js';
import { useHushArcRoom, DecryptedMessage } from '../../hooks/useHushArcRoom.js';
import { buildInvitationUrl, encodeRoomCode } from '../../lib/ephemeral-session/session.js';

interface ChatRoomProps {
  roomId: string;
  accessSecret: string;
  encryptionKey: string;
  nickname: string;
  shortCode?: string;
  onExit: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  roomId,
  accessSecret,
  encryptionKey,
  nickname,
  shortCode,
  onExit,
}) => {
  const [replyTarget, setReplyTarget] = useState<DecryptedMessage | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  // Dynamic visual viewport tracking for mobile virtual keyboard responsiveness
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const updateHeight = () => {
      if (window.visualViewport) {
        setViewportHeight(window.visualViewport.height);
      }
    };

    updateHeight();
    window.visualViewport.addEventListener('resize', updateHeight);
    window.visualViewport.addEventListener('scroll', updateHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateHeight);
      window.visualViewport?.removeEventListener('scroll', updateHeight);
    };
  }, []);

  const invitationUrl = useMemo(
    () => buildInvitationUrl({ roomId, accessSecret, encryptionKey }),
    [roomId, accessSecret, encryptionKey]
  );

  const roomCode = useMemo(
    () => encodeRoomCode({ roomId, accessSecret, encryptionKey }),
    [roomId, accessSecret, encryptionKey]
  );

  const handleRoomEnded = useCallback(
    (_reason: string) => {
      setTimeout(onExit, 2500);
    },
    [onExit]
  );

  const {
    connectionStatus,
    error,
    participants,
    messages,
    typingUsers,
    currentEpoch,
    myParticipantId,
    sendMessage,
    sendAttachment,
    sendReaction,
    sendTyping,
    rotateRoomKey,
    leaveRoom,
    endRoom,
    hasKey,
    myPublicKey,
  } = useHushArcRoom({
    roomId,
    accessSecret,
    initialRoomKey: encryptionKey,
    initialNickname: nickname,
    onRoomEnded: handleRoomEnded,
  });

  const handleLeave = useCallback(() => {
    leaveRoom();
    onExit();
  }, [leaveRoom, onExit]);

  const handleEndRoom = useCallback(() => {
    if (
      window.confirm(
        'Are you sure you want to end this room for all participants? All active connections will be terminated immediately.'
      )
    ) {
      endRoom();
      onExit();
    }
  }, [endRoom, onExit]);

  const handleReply = useCallback((msg: DecryptedMessage) => {
    setReplyTarget(msg);
  }, []);

  const handleClearReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  const containerStyle = viewportHeight ? { height: `${viewportHeight}px` } : undefined;

  return (
    <div
      style={containerStyle}
      className="flex flex-col h-[100dvh] max-h-[100dvh] w-full bg-ink overflow-hidden select-none safe-x"
    >
      {/* Top Header Bar with Safe Area Top padding */}
      <header className="pt-[env(safe-area-inset-top,0px)] px-2.5 sm:px-4 bg-ink-elevated border-b border-ink-border flex items-center justify-between z-10 shrink-0 min-h-[3.75rem]">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <HushArcMark size="xs" animate={true} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-display font-bold text-xs sm:text-sm tracking-tight text-text-primary truncate">
                HushArc
              </span>
              <span className="text-[10px] sm:text-[11px] font-mono text-signal-lime font-semibold bg-ink px-1.5 sm:px-2 py-0.5 rounded border border-ink-border shrink-0">
                {shortCode || roomId.slice(0, 6)}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5">
              <ConnectionStatus status={connectionStatus} />
              <EncryptionIndicator
                epoch={currentEpoch}
                hasKey={hasKey}
                publicKey={myPublicKey}
              />
            </div>
          </div>
        </div>

        {/* Action Controls (Responsive & accessible touch targets) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="p-2 sm:px-3 sm:py-1.5 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg bg-ink hover:bg-ink-hover border border-ink-border text-text-primary hover:text-signal-lime text-xs font-mono flex items-center justify-center gap-1.5 transition-colors active:scale-95"
            title="Invite Link"
            aria-label="Invite to room"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Invite</span>
          </button>

          <button
            type="button"
            onClick={() => setShowParticipants(true)}
            className="p-2 sm:px-3 sm:py-1.5 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg bg-ink hover:bg-ink-hover border border-ink-border text-text-primary hover:text-signal-lime text-xs font-mono flex items-center justify-center gap-1.5 transition-colors relative active:scale-95"
            title="Active Participants"
            aria-label="View active participants"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{participants.length}</span>
          </button>

          <button
            type="button"
            onClick={handleLeave}
            className="p-2 sm:px-3 sm:py-1.5 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg bg-ink hover:bg-ink-hover border border-ink-border text-text-muted hover:text-text-primary text-xs font-mono flex items-center justify-center gap-1.5 transition-colors active:scale-95"
            title="Leave Conversation"
            aria-label="Leave conversation"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>

          <button
            type="button"
            onClick={handleEndRoom}
            className="p-2 min-w-[36px] min-h-[36px] sm:min-w-[40px] sm:min-h-[40px] rounded-lg bg-ink hover:bg-coral-dim border border-ink-border text-text-muted hover:text-coral text-xs flex items-center justify-center transition-colors active:scale-95"
            title="End Room for Everyone"
            aria-label="End room for all participants"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div className="bg-coral-dim border-b border-coral text-coral px-3 sm:px-4 py-2 text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="underline text-[11px] font-semibold hover:opacity-80"
          >
            Return to Welcome
          </button>
        </div>
      )}

      {/* Main Conversation Canvas */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {messages.length === 0 && participants.length <= 1 ? (
          <EmptyRoomState
            invitationUrl={invitationUrl}
            isDirect={true}
            roomCode={roomCode}
            shortCode={shortCode}
          />
        ) : (
          <MessageList
            messages={messages}
            myParticipantId={myParticipantId}
            onReply={handleReply}
            onReact={sendReaction}
          />
        )}

        {/* Ephemeral Typing Indicator Pill */}
        {typingUsers.length > 0 && (
          <div className="px-4 py-1.5 flex items-center gap-2 text-[11px] font-mono text-signal-lime animate-fadeIn bg-ink-elevated/40 border-t border-ink-border/30">
            <Radio className="w-3 h-3 animate-pulse" />
            <span>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} transmitting...
            </span>
          </div>
        )}

        {/* Message Composer */}
        <EphemeralComposer
          onSendMessage={sendMessage}
          onSendAttachment={sendAttachment}
          onTyping={sendTyping}
          replyToMessage={replyTarget}
          onClearReply={handleClearReply}
          disabled={connectionStatus !== 'connected'}
        />
      </main>

      {/* Side Drawers & Modals */}
      <ParticipantDrawer
        isOpen={showParticipants}
        onClose={() => setShowParticipants(false)}
        participants={participants}
        myParticipantId={myParticipantId}
        currentEpoch={currentEpoch}
        onRotateKey={rotateRoomKey}
      />

      <InvitationModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        invitationUrl={invitationUrl}
        roomId={roomId}
        accessSecret={accessSecret}
        encryptionKey={encryptionKey}
        shortCode={shortCode}
        onEnterRoom={() => setShowInviteModal(false)}
      />
    </div>
  );
};
