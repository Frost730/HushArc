import React, { useState, useEffect } from 'react';
import { SignalField } from '../components/SignalField.js';
import { WelcomeScreen } from '../features/welcome/WelcomeScreen.js';
import { CreateRoomModal } from '../features/rooms/CreateRoomModal.js';
import { JoinRoomModal } from '../features/rooms/JoinRoomModal.js';
import { InvitationModal } from '../features/invitations/InvitationModal.js';
import { ChatRoom } from '../features/messaging/ChatRoom.js';
import { extractAndCleanInvitationFragment, purgeLocalSession } from '../lib/ephemeral-session/session.js';

interface ActiveRoomState {
  roomId: string;
  accessSecret: string;
  encryptionKey: string;
  nickname: string;
}

export const App: React.FC = () => {
  const [activeRoom, setActiveRoom] = useState<ActiveRoomState | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [invitationModalData, setInvitationModalData] = useState<{
    url: string;
    roomId: string;
    accessSecret: string;
    encryptionKey: string;
    nickname: string;
  } | null>(null);

  // Auto-detect invitation URL on page load (e.g. /r/:roomId#access=...&key=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pathname = window.location.pathname;
    const match = pathname.match(/^\/r\/([a-zA-Z0-9_-]+)/);

    if (match && match[1]) {
      const extractedRoomId = match[1];
      const { accessSecret, encryptionKey } = extractAndCleanInvitationFragment();

      if (accessSecret && encryptionKey) {
        setJoinModalParams({
          roomId: extractedRoomId,
          accessSecret,
          encryptionKey,
        });
        setShowJoinModal(true);
      }
    }
  }, []);

  const [joinModalParams, setJoinModalParams] = useState<{
    roomId: string;
    accessSecret: string;
    encryptionKey: string;
  } | null>(null);

  const handleRoomCreated = (
    invitationUrl: string,
    roomId: string,
    accessSecret: string,
    encryptionKey: string,
    nickname: string
  ) => {
    setShowCreateModal(false);
    setInvitationModalData({
      url: invitationUrl,
      roomId,
      accessSecret,
      encryptionKey,
      nickname,
    });
  };

  const handleEnterRoomFromInvite = () => {
    if (!invitationModalData) return;
    setActiveRoom({
      roomId: invitationModalData.roomId,
      accessSecret: invitationModalData.accessSecret,
      encryptionKey: invitationModalData.encryptionKey,
      nickname: invitationModalData.nickname,
    });
    setInvitationModalData(null);
  };

  const handleJoinRoom = (
    roomId: string,
    accessSecret: string,
    encryptionKey: string,
    nickname: string
  ) => {
    setShowJoinModal(false);
    setActiveRoom({
      roomId,
      accessSecret,
      encryptionKey,
      nickname,
    });
  };

  const handleExitRoom = React.useCallback(() => {
    purgeLocalSession();
    setActiveRoom(null);
    try {
      window.history.replaceState(null, '', '/');
    } catch {
      // ignore
    }
  }, []);

  return (
    <div className="relative min-h-screen bg-ink text-text-primary overflow-x-hidden font-sans">
      {/* Living Signal ambient background field */}
      <SignalField />

      {/* Main View Router */}
      {activeRoom ? (
        <ChatRoom
          roomId={activeRoom.roomId}
          accessSecret={activeRoom.accessSecret}
          encryptionKey={activeRoom.encryptionKey}
          nickname={activeRoom.nickname}
          onExit={handleExitRoom}
        />
      ) : (
        <WelcomeScreen
          onCreateRoom={() => setShowCreateModal(true)}
          onJoinRoom={() => setShowJoinModal(true)}
        />
      )}

      {/* Modals */}
      <CreateRoomModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onRoomCreated={handleRoomCreated}
      />

      <JoinRoomModal
        isOpen={showJoinModal}
        onClose={() => setShowJoinModal(false)}
        onJoin={handleJoinRoom}
        initialRoomId={joinModalParams?.roomId}
        initialAccessSecret={joinModalParams?.accessSecret}
        initialEncryptionKey={joinModalParams?.encryptionKey}
      />

      {invitationModalData && (
        <InvitationModal
          isOpen={Boolean(invitationModalData)}
          invitationUrl={invitationModalData.url}
          roomId={invitationModalData.roomId}
          onClose={() => setInvitationModalData(null)}
          onEnterRoom={handleEnterRoomFromInvite}
        />
      )}
    </div>
  );
};
