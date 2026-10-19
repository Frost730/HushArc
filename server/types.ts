/**
 * HushArc Server Types
 * Strictly ephemeral runtime models and protocol event definitions
 */

export interface Participant {
  id: string; // Random cryptographically secure identifier
  nickname: string; // User-selected temporary display name
  publicKey: string; // Base64 X25519 public key for receiving encrypted epoch keys
  joinedAt: number;
  lastPing: number;
}

export interface Room {
  id: string; // Random room ID
  accessSecretHash: string; // Hash of the room's access secret (never plaintext, never encryption key)
  createdAt: number;
  lastActivityAt: number;
  maxParticipants: number;
  isDirect: boolean;
  participants: Map<string, Participant>; // participantId -> Participant
  currentEpoch: number;
}

// Client -> Server WebSocket Events
export type ClientEvent =
  | {
      type: 'join';
      roomId: string;
      participantId: string;
      nickname: string;
      publicKey: string;
      accessSecret: string;
    }
  | {
      type: 'encrypted_message';
      roomId: string;
      messageId: string;
      epoch: number;
      nonce: string; // base64
      ciphertext: string; // base64
      replyToId?: string;
    }
  | {
      type: 'reaction';
      roomId: string;
      messageId: string;
      epoch: number;
      nonce: string;
      ciphertext: string; // encrypted emoji reaction
    }
  | {
      type: 'typing';
      roomId: string;
      isTyping: boolean;
    }
  | {
      type: 'key_rotation_epoch';
      roomId: string;
      newEpoch: number;
      encryptedKeys: Record<string, { nonce: string; ciphertext: string }>; // participantId -> encrypted room key
    }
  | {
      type: 'leave';
      roomId: string;
    }
  | {
      type: 'end_room';
      roomId: string;
    }
  | {
      type: 'ping';
    };

// Server -> Client WebSocket Events
export type ServerEvent =
  | {
      type: 'join_accepted';
      roomId: string;
      participantId: string;
      epoch: number;
      participants: Array<{ id: string; nickname: string; publicKey: string; joinedAt: number }>;
    }
  | {
      type: 'join_rejected';
      reason: string;
    }
  | {
      type: 'participant_joined';
      participant: { id: string; nickname: string; publicKey: string; joinedAt: number };
    }
  | {
      type: 'participant_left';
      participantId: string;
      reason?: string;
    }
  | {
      type: 'encrypted_message_relayed';
      messageId: string;
      senderId: string;
      senderNickname: string;
      epoch: number;
      nonce: string;
      ciphertext: string;
      replyToId?: string;
      timestamp: number;
    }
  | {
      type: 'message_delivered_receipt';
      messageId: string;
      recipientCount: number;
    }
  | {
      type: 'reaction_relayed';
      messageId: string;
      senderId: string;
      epoch: number;
      nonce: string;
      ciphertext: string;
      timestamp: number;
    }
  | {
      type: 'typing_relayed';
      participantId: string;
      nickname: string;
      isTyping: boolean;
    }
  | {
      type: 'key_rotation_relayed';
      newEpoch: number;
      senderId: string;
      encryptedKeyForYou: { nonce: string; ciphertext: string };
    }
  | {
      type: 'room_ended';
      reason: string;
    }
  | {
      type: 'error';
      code: string;
      message: string;
    }
  | {
      type: 'pong';
    };
