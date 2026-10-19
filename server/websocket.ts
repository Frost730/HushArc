import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { EphemeralRoomManager } from './room-manager.js';
import { ClientEventSchema } from './validation.js';
import { EphemeralRateLimiter } from './security.js';
import type { ServerEvent } from './types.js';

export function setupWebSocket(httpServer: Server, roomManager: EphemeralRoomManager): WebSocketServer {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: 65536, // 64 KB maximum WebSocket message size
  });

  // Ephemeral per-connection rate limiter (max 60 events per 10s per socket)
  const socketRateLimiter = new EphemeralRateLimiter(10_000, 60);

  // Heartbeat interval to drop dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      const socketInfo = roomManager.getSocketInfo(ws);
      if (!socketInfo) {
        // Socket never joined any room within 60s
        ws.terminate();
        return;
      }

      if (!socketInfo.isAlive) {
        // Did not respond to ping
        roomManager.removeSocket(ws, 'Connection timed out');
        ws.terminate();
        return;
      }

      roomManager.setSocketAlive(ws, false);
      ws.ping();
    });
  }, 30_000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws: WebSocket, req) => {
    // Generate a temporary identifier for rate limiting before join
    const connectionKey = `${req.socket.remoteAddress || 'unknown'}:${Math.random().toString(36).slice(2)}`;

    ws.on('pong', () => {
      roomManager.setSocketAlive(ws, true);
    });

    ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      // 1. Rate limiting check
      if (!socketRateLimiter.isAllowed(connectionKey)) {
        sendError(ws, 'RATE_LIMITED', 'Too many events sent. Please slow down.');
        return;
      }

      // 2. Parse JSON
      let rawText: string;
      try {
        rawText = typeof data === 'string' ? data : Buffer.from(data as any).toString('utf8');
      } catch {
        sendError(ws, 'INVALID_PAYLOAD', 'Unable to decode message payload');
        return;
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        sendError(ws, 'INVALID_JSON', 'Malformed JSON payload');
        return;
      }

      // 3. Strict schema validation
      const parseResult = ClientEventSchema.safeParse(parsedJson);
      if (!parseResult.success) {
        sendError(ws, 'VALIDATION_FAILED', parseResult.error.errors[0]?.message || 'Invalid message format');
        return;
      }

      const event = parseResult.data;

      // Handle ping
      if (event.type === 'ping') {
        roomManager.setSocketAlive(ws, true);
        sendEvent(ws, { type: 'pong' });
        return;
      }

      // Handle join
      if (event.type === 'join') {
        const existingInfo = roomManager.getSocketInfo(ws);
        if (existingInfo) {
          sendError(ws, 'ALREADY_JOINED', 'Socket is already in a room.');
          return;
        }

        const joinResult = roomManager.joinRoom(ws, {
          roomId: event.roomId,
          participantId: event.participantId,
          nickname: event.nickname,
          publicKey: event.publicKey,
          accessSecret: event.accessSecret,
        });

        if (!joinResult.success || !joinResult.room) {
          sendEvent(ws, {
            type: 'join_rejected',
            reason: joinResult.reason || 'Failed to join room',
          });
          ws.close(4001, joinResult.reason);
          return;
        }

        const room = joinResult.room;
        const currentParticipants = Array.from(room.participants.values()).map(p => ({
          id: p.id,
          nickname: p.nickname,
          publicKey: p.publicKey,
          joinedAt: p.joinedAt,
        }));

        // Send accept event to joining user
        sendEvent(ws, {
          type: 'join_accepted',
          roomId: room.id,
          participantId: event.participantId,
          epoch: room.currentEpoch,
          participants: currentParticipants,
        });

        // Broadcast join to all other participants in the room
        roomManager.broadcastToRoom(
          room.id,
          {
            type: 'participant_joined',
            participant: {
              id: event.participantId,
              nickname: event.nickname,
              publicKey: event.publicKey,
              joinedAt: Date.now(),
            },
          },
          event.participantId // Exclude joiner
        );
        return;
      }

      // All remaining events REQUIRE an authenticated room membership
      const senderInfo = roomManager.getSocketInfo(ws);
      if (!senderInfo) {
        sendError(ws, 'UNAUTHORIZED', 'You must join a room first.');
        return;
      }

      // Verify that the event's roomId matches the socket's authenticated room
      if ('roomId' in event && event.roomId !== senderInfo.roomId) {
        sendError(ws, 'FORBIDDEN', 'Room ID mismatch. Cannot send to unauthenticated room.');
        return;
      }

      const activeRoom = roomManager.getRoom(senderInfo.roomId);
      if (!activeRoom) {
        sendError(ws, 'ROOM_NOT_FOUND', 'Active room is no longer available.');
        return;
      }

      const senderParticipant = activeRoom.participants.get(senderInfo.participantId);
      if (!senderParticipant) {
        sendError(ws, 'PARTICIPANT_NOT_FOUND', 'Participant membership invalidated.');
        return;
      }

      // Handle encrypted message routing (ZERO message storage!)
      if (event.type === 'encrypted_message') {
        const relayEvent: ServerEvent = {
          type: 'encrypted_message_relayed',
          messageId: event.messageId,
          senderId: senderInfo.participantId,
          senderNickname: senderParticipant.nickname,
          epoch: event.epoch,
          nonce: event.nonce,
          ciphertext: event.ciphertext,
          replyToId: event.replyToId,
          timestamp: Date.now(),
        };

        // Relay immediately to all other participants in the room
        const recipientCount = roomManager.broadcastToRoom(
          senderInfo.roomId,
          relayEvent,
          senderInfo.participantId
        );

        // Send delivery receipt to sender with exact recipient count
        sendEvent(ws, {
          type: 'message_delivered_receipt',
          messageId: event.messageId,
          recipientCount,
        });
        return;
      }

      // Handle encrypted reaction
      if (event.type === 'reaction') {
        const relayEvent: ServerEvent = {
          type: 'reaction_relayed',
          messageId: event.messageId,
          senderId: senderInfo.participantId,
          epoch: event.epoch,
          nonce: event.nonce,
          ciphertext: event.ciphertext,
          timestamp: Date.now(),
        };

        roomManager.broadcastToRoom(senderInfo.roomId, relayEvent);
        return;
      }

      // Handle typing status
      if (event.type === 'typing') {
        roomManager.broadcastToRoom(
          senderInfo.roomId,
          {
            type: 'typing_relayed',
            participantId: senderInfo.participantId,
            nickname: senderParticipant.nickname,
            isTyping: event.isTyping,
          },
          senderInfo.participantId
        );
        return;
      }

      // Handle encrypted binary attachment chunk relay (zero disk/server persistence)
      if (event.type === 'attachment_chunk') {
        const relayEvent: ServerEvent = {
          type: 'attachment_chunk_relayed',
          attachmentId: event.attachmentId,
          senderId: senderInfo.participantId,
          senderNickname: senderParticipant.nickname,
          fileName: event.fileName,
          fileType: event.fileType,
          fileSize: event.fileSize,
          chunkIndex: event.chunkIndex,
          totalChunks: event.totalChunks,
          epoch: event.epoch,
          nonce: event.nonce,
          ciphertext: event.ciphertext,
          timestamp: Date.now(),
        };

        // Stream chunk immediately to active room peers without caching
        roomManager.broadcastToRoom(
          senderInfo.roomId,
          relayEvent,
          senderInfo.participantId
        );
        return;
      }

      // Handle key rotation epoch announcement
      if (event.type === 'key_rotation_epoch') {
        // Sender has generated a new epoch key, encrypted each copy with the recipient's public key
        roomManager.updateRoomEpoch(senderInfo.roomId, event.newEpoch);

        for (const [targetParticipantId, encryptedBundle] of Object.entries(event.encryptedKeys) as [string, { nonce: string; ciphertext: string }][]) {
          if (targetParticipantId === senderInfo.participantId) continue;
          roomManager.sendToParticipant(targetParticipantId, {
            type: 'key_rotation_relayed',
            newEpoch: event.newEpoch,
            senderId: senderInfo.participantId,
            encryptedKeyForYou: encryptedBundle,
          });
        }
        return;
      }

      // Handle direct peer-to-peer sealed key exchange (for short code joiners)
      if (event.type === 'key_exchange') {
        roomManager.sendToParticipant(event.recipientId, {
          type: 'key_exchange_relayed',
          senderId: senderInfo.participantId,
          sealedKey: event.sealedKey,
        });
        return;
      }

      // Handle explicit leave
      if (event.type === 'leave') {
        roomManager.removeSocket(ws, 'Participant departed voluntarily');
        ws.close(1000, 'Left room');
        return;
      }

      // Handle end room
      if (event.type === 'end_room') {
        roomManager.endRoom(senderInfo.roomId, `Room terminated by ${senderParticipant.nickname}`);
        return;
      }
    });

    ws.on('close', () => {
      roomManager.removeSocket(ws, 'Disconnected');
    });

    ws.on('error', () => {
      roomManager.removeSocket(ws, 'Socket error');
    });
  });

  return wss;
}

function sendEvent(ws: WebSocket, event: ServerEvent): void {
  if (ws.readyState === 1 /* WebSocket.OPEN */) {
    ws.send(JSON.stringify(event));
  }
}

function sendError(ws: WebSocket, code: string, message: string): void {
  sendEvent(ws, {
    type: 'error',
    code,
    message,
  });
}
