import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';
import { SignalField } from '../components/SignalField.js';
import { WelcomeScreen } from '../features/welcome/WelcomeScreen.js';
import { extractAndCleanInvitationFragment, generateRandomNickname, purgeLocalSession } from '../lib/ephemeral-session/session.js';

// Lazy load secondary modal dialogs and the encrypted chat view for bundle code-splitting
const CreateRoomModal = lazy(() =>
  import('../features/rooms/CreateRoomModal.js').then((m) => ({ default: m.CreateRoomModal }))
);
const JoinRoomModal = lazy(() =>
  import('../features/rooms/JoinRoomModal.js').then((m) => ({ default: m.JoinRoomModal }))
);
const InvitationModal = lazy(() =>
  import('../features/invitations/InvitationModal.js').then((m) => ({ default: m.InvitationModal }))
);
const ChatRoom = lazy(() =>
  import('../features/messaging/ChatRoom.js').then((m) => ({ default: m.ChatRoom }))
);

interface ActiveRoomState {
  roomId: string;
  accessSecret: string;
  encryptionKey: string;
  nickname: string;
  shortCode?: string;
}

const LoadingBackdrop: React.FC = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
    <Loader2 className="w-8 h-8 animate-spin text-signal-lime" />
  </div>
);

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
    shortCode?: string;
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
        // User clicked a shared room link — directly join the conversation!
        const autoMoniker = generateRandomNickname();
        setActiveRoom({
          roomId: extractedRoomId,
          accessSecret,
          encryptionKey,
          nickname: autoMoniker,
        });
      } else {
        // Opened without access keys — prompt join modal so they can paste the code
        setJoinModalParams({
          roomId: extractedRoomId,
          accessSecret: '',
          encryptionKey: '',
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
    nickname: string,
    shortCode?: string
  ) => {
    setShowCreateModal(false);
    setInvitationModalData({
      url: invitationUrl,
      roomId,
      accessSecret,
      encryptionKey,
      nickname,
      shortCode,
    });
  };

  const handleEnterRoomFromInvite = () => {
    if (!invitationModalData) return;
    setActiveRoom({
      roomId: invitationModalData.roomId,
      accessSecret: invitationModalData.accessSecret,
      encryptionKey: invitationModalData.encryptionKey,
      nickname: invitationModalData.nickname,
      shortCode: invitationModalData.shortCode,
    });
    setInvitationModalData(null);
  };

  const handleJoinRoom = (
    roomId: string,
    accessSecret: string,
    encryptionKey: string,
    nickname: string,
    shortCode?: string
  ) => {
    setShowJoinModal(false);
    setActiveRoom({
      roomId,
      accessSecret,
      encryptionKey,
      nickname,
      shortCode,
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
    <div className="relative min-h-[100dvh] bg-ink text-text-primary overflow-x-hidden font-sans">
      {/* Living Signal ambient background field */}
      <SignalField />

      {/* Main View Router */}
      <Suspense fallback={<LoadingBackdrop />}>
        {activeRoom ? (
          <ChatRoom
            roomId={activeRoom.roomId}
            accessSecret={activeRoom.accessSecret}
            encryptionKey={activeRoom.encryptionKey}
            nickname={activeRoom.nickname}
            shortCode={activeRoom.shortCode}
            onExit={handleExitRoom}
          />
        ) : (
          <WelcomeScreen
            onCreateRoom={() => setShowCreateModal(true)}
            onJoinRoom={() => setShowJoinModal(true)}
          />
        )}

        {/* Modals */}
        {showCreateModal && (
          <CreateRoomModal
            isOpen={showCreateModal}
            onClose={() => setShowCreateModal(false)}
            onRoomCreated={handleRoomCreated}
          />
        )}

        {showJoinModal && (
          <JoinRoomModal
            isOpen={showJoinModal}
            onClose={() => setShowJoinModal(false)}
            onJoin={handleJoinRoom}
            initialRoomId={joinModalParams?.roomId}
            initialAccessSecret={joinModalParams?.accessSecret}
            initialEncryptionKey={joinModalParams?.encryptionKey}
          />
        )}

        {invitationModalData && (
          <InvitationModal
            isOpen={Boolean(invitationModalData)}
            invitationUrl={invitationModalData.url}
            roomId={invitationModalData.roomId}
            accessSecret={invitationModalData.accessSecret}
            encryptionKey={invitationModalData.encryptionKey}
            shortCode={invitationModalData.shortCode}
            onClose={() => setInvitationModalData(null)}
            onEnterRoom={handleEnterRoomFromInvite}
          />
        )}
      </Suspense>
    </div>
  );
};
