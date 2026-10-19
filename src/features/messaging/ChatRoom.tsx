import React, { useState } from 'react';
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
  onExit: () => void;
}

export const ChatRoom: React.FC<ChatRoomProps> = ({
  roomId,
  accessSecret,
  encryptionKey,
  nickname,
  onExit,
}) => {
  const [replyTarget, setReplyTarget] = useState<DecryptedMessage | null>(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const invitationUrl = buildInvitationUrl({ roomId, accessSecret, encryptionKey });
  const roomCode = React.useMemo(
    () => encodeRoomCode({ roomId, accessSecret, encryptionKey }),
    [roomId, accessSecret, encryptionKey]
  );

  const handleRoomEnded = React.useCallback(
    (_reason: string) => {
      // Room ended, exit back to welcome screen cleanly
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

  const handleLeave = () => {
    leaveRoom();
    onExit();
  };

  const handleEndRoom = () => {
    if (window.confirm('Are you sure you want to end this room for all participants? All active connections will be terminated immediately.')) {
      endRoom();
      onExit();
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-ink overflow-hidden select-none">
      {/* Top Header Bar */}
      <header className="h-16 px-4 bg-ink-elevated border-b border-ink-border flex items-center justify-between z-10 shrink-0">
        <div className="flex items-center gap-3">
          <HushArcMark size="xs" animate={true} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm tracking-tight text-text-primary">
                HushArc
              </span>
              <span className="text-[11px] font-mono text-text-muted bg-ink px-2 py-0.5 rounded border border-ink-border">
                {roomId.slice(0, 8)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <ConnectionStatus status={connectionStatus} />
              <EncryptionIndicator
                epoch={currentEpoch}
                hasKey={hasKey}
                publicKey={myPublicKey}
              />
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-ink hover:bg-ink-hover border border-ink-border text-text-primary hover:text-signal-lime text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Invite Link"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Invite</span>
          </button>

          <button
            type="button"
            onClick={() => setShowParticipants(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-ink hover:bg-ink-hover border border-ink-border text-text-primary hover:text-signal-lime text-xs font-mono flex items-center gap-1.5 transition-colors relative"
            title="Active Participants"
          >
            <Users className="w-3.5 h-3.5" />
            <span>{participants.length}</span>
          </button>

          <button
            type="button"
            onClick={handleLeave}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-ink hover:bg-ink-hover border border-ink-border text-text-muted hover:text-text-primary text-xs font-mono flex items-center gap-1.5 transition-colors"
            title="Leave Conversation"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </button>

          <button
            type="button"
            onClick={handleEndRoom}
            className="p-2 rounded-lg bg-ink hover:bg-coral-dim border border-ink-border text-text-muted hover:text-coral text-xs transition-colors"
            title="End Room for Everyone"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Global Error Banner */}
      {error && (
        <div className="bg-coral-dim border-b border-coral text-coral px-4 py-2 text-xs font-mono flex items-center justify-between">
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
          <EmptyRoomState invitationUrl={invitationUrl} isDirect={true} roomCode={roomCode} />
        ) : (
          <MessageList
            messages={messages}
            myParticipantId={myParticipantId}
            onReply={(msg) => setReplyTarget(msg)}
            onReact={(msgId, emoji) => sendReaction(msgId, emoji)}
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
          onSendMessage={(text, replyToId) => sendMessage(text, replyToId)}
          onSendAttachment={(file) => sendAttachment(file)}
          onTyping={(isTyping) => sendTyping(isTyping)}
          replyToMessage={replyTarget}
          onClearReply={() => setReplyTarget(null)}
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
        onEnterRoom={() => setShowInviteModal(false)}
      />
    </div>
  );
};
