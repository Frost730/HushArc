import type { WebSocket } from 'ws';
import type { Room, Participant, ServerEvent } from './types.js';
import { generateSecureToken, hashAccessSecret, verifyAccessSecret } from './security.js';

interface ConnectedSocket {
  socket: WebSocket;
  roomId: string;
  participantId: string;
  isAlive: boolean;
}

export class EphemeralRoomManager {
  // In-memory strictly ephemeral state - never written to disk or database
  private rooms = new Map<string, Room>();
  private sockets = new Map<WebSocket, ConnectedSocket>();
  private participantSockets = new Map<string, WebSocket>(); // participantId -> WebSocket

  private readonly idleTimeoutMs: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(idleTimeoutMinutes = 60) {
    this.idleTimeoutMs = idleTimeoutMinutes * 60 * 1000;

    // Prune abandoned or expired rooms every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.pruneExpiredRooms();
    }, 60_000);
  }

  /**
   * Creates a new ephemeral room with an access secret.
   * Note: The encryption secret is NEVER received or handled by the server;
   * it stays in the client's URL fragment!
   */
  public createRoom(options?: { maxParticipants?: number; isDirect?: boolean }): {
    roomId: string;
    accessSecret: string;
  } {
    const roomId = generateSecureToken(16); // 128-bit URL-safe random string
    const accessSecret = generateSecureToken(32); // 256-bit access capability
    const accessSecretHash = hashAccessSecret(accessSecret);

    const room: Room = {
      id: roomId,
      accessSecretHash,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      maxParticipants: options?.maxParticipants ?? 10,
      isDirect: options?.isDirect ?? false,
      participants: new Map(),
      currentEpoch: 1,
    };

    this.rooms.set(roomId, room);
    return { roomId, accessSecret };
  }

  /**
   * Validate that room exists and accessSecret matches.
   */
  public validateRoomAccess(roomId: string, accessSecret: string): { valid: boolean; reason?: string } {
    const room = this.rooms.get(roomId);
    if (!room) {
      return { valid: false, reason: 'Room does not exist or has expired.' };
    }

    if (!verifyAccessSecret(accessSecret, room.accessSecretHash)) {
      return { valid: false, reason: 'Invalid room access capability.' };
    }

    if (room.participants.size >= room.maxParticipants) {
      return { valid: false, reason: 'Room has reached maximum capacity.' };
    }

    return { valid: true };
  }

  /**
   * Register a participant into an existing room.
   */
  public joinRoom(
    socket: WebSocket,
    params: {
      roomId: string;
      participantId: string;
      nickname: string;
      publicKey: string;
      accessSecret: string;
    }
  ): { success: boolean; room?: Room; reason?: string } {
    const validation = this.validateRoomAccess(params.roomId, params.accessSecret);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    const room = this.rooms.get(params.roomId)!;

    // Check if participantId is already taken in this room
    if (room.participants.has(params.participantId)) {
      return { success: false, reason: 'Participant identifier already active in room.' };
    }

    const participant: Participant = {
      id: params.participantId,
      nickname: params.nickname,
      publicKey: params.publicKey,
      joinedAt: Date.now(),
      lastPing: Date.now(),
    };

    room.participants.set(participant.id, participant);
    room.lastActivityAt = Date.now();

    // Track active socket association
    this.sockets.set(socket, {
      socket,
      roomId: room.id,
      participantId: participant.id,
      isAlive: true,
    });
    this.participantSockets.set(participant.id, socket);

    return { success: true, room };
  }

  /**
   * Returns current participant info for a socket.
   */
  public getSocketInfo(socket: WebSocket): ConnectedSocket | undefined {
    return this.sockets.get(socket);
  }

  /**
   * Returns a room by ID.
   */
  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Broadcast an event to all participants in a room, optionally excluding sender.
   */
  public broadcastToRoom(roomId: string, event: ServerEvent, excludeParticipantId?: string): number {
    const room = this.rooms.get(roomId);
    if (!room) return 0;

    room.lastActivityAt = Date.now();
    const payload = JSON.stringify(event);
    let deliveredCount = 0;

    for (const [pId] of room.participants) {
      if (excludeParticipantId && pId === excludeParticipantId) {
        continue;
      }
      const sock = this.participantSockets.get(pId);
      if (sock && sock.readyState === 1 /* WebSocket.OPEN */) {
        sock.send(payload);
        deliveredCount++;
      }
    }

    return deliveredCount;
  }

  /**
   * Send an event directly to a specific participant.
   */
  public sendToParticipant(participantId: string, event: ServerEvent): boolean {
    const sock = this.participantSockets.get(participantId);
    if (sock && sock.readyState === 1 /* WebSocket.OPEN */) {
      sock.send(JSON.stringify(event));
      return true;
    }
    return false;
  }

  /**
   * Remove a participant from their room (e.g. voluntary leave or socket closed).
   */
  public leaveRoom(socket: WebSocket, reason = 'Participant left'): void {
    const info = this.sockets.get(socket);
    if (!info) return;

    const { roomId, participantId } = info;
    this.sockets.delete(socket);
    this.participantSockets.delete(participantId);

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.participants.delete(participantId);
    room.lastActivityAt = Date.now();

    // If room is now empty, destroy it immediately!
    if (room.participants.size === 0) {
      this.destroyRoom(roomId, 'All participants left the room.');
    } else {
      // Notify remaining members
      this.broadcastToRoom(roomId, {
        type: 'participant_left',
        participantId,
        reason,
      });
    }
  }

  /**
   * Explicitly terminate a room (e.g. owner ended room or security condition failed).
   */
  public endRoom(roomId: string, reason = 'Room ended by participant'): void {
    this.destroyRoom(roomId, reason);
  }

  /**
   * Destroy a room immediately and wipe all in-memory references.
   */
  public destroyRoom(roomId: string, reason: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    // Notify any remaining sockets
    const endEvent: ServerEvent = { type: 'room_ended', reason };
    const payload = JSON.stringify(endEvent);

    for (const [pId] of room.participants) {
      const sock = this.participantSockets.get(pId);
      if (sock) {
        if (sock.readyState === 1) {
          sock.send(payload);
          sock.close(1000, reason);
        }
        this.sockets.delete(sock);
      }
      this.participantSockets.delete(pId);
    }

    room.participants.clear();
    this.rooms.delete(roomId);
  }

  /**
   * Increment epoch for room key rotation.
   */
  public updateRoomEpoch(roomId: string, newEpoch: number): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.currentEpoch = newEpoch;
    room.lastActivityAt = Date.now();
    return true;
  }

  /**
   * Mark socket ping/pong alive.
   */
  public setSocketAlive(socket: WebSocket, isAlive: boolean): void {
    const info = this.sockets.get(socket);
    if (info) {
      info.isAlive = isAlive;
    }
  }

  /**
   * Prune inactive or dead sockets and expired rooms.
   */
  public pruneExpiredRooms(): void {
    const now = Date.now();
    for (const [roomId, room] of this.rooms.entries()) {
      if (now - room.lastActivityAt > this.idleTimeoutMs || room.participants.size === 0) {
        this.destroyRoom(roomId, 'Room expired due to inactivity.');
      }
    }
  }

  /**
   * Graceful server shutdown: closes all sockets, notifies clients, wipes all rooms.
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    for (const roomId of Array.from(this.rooms.keys())) {
      this.destroyRoom(roomId, 'Server restarting. All ephemeral rooms have been closed.');
    }

    this.rooms.clear();
    this.sockets.clear();
    this.participantSockets.clear();
  }

  /**
   * Diagnostics for tests (never exposes secrets or keys)
   */
  public getRoomCount(): number {
    return this.rooms.size;
  }
}
