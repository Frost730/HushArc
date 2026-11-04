import crypto from 'crypto';
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
  private shortCodeToRoom = new Map<string, { roomId: string; accessSecret: string; shortCode: string }>();

  private readonly idleTimeoutMs: number;
  private readonly maxRooms: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(idleTimeoutMinutes = 60, maxRooms = 5000) {
    this.idleTimeoutMs = idleTimeoutMinutes * 60 * 1000;
    this.maxRooms = maxRooms;

    // Prune abandoned or expired rooms every 60 seconds
    this.cleanupInterval = setInterval(() => {
      this.pruneExpiredRooms();
    }, 60_000);
  }

  /**
   * Normalizes short codes for lookup (strips hyphens/spaces and standardizes casing).
   */
  private normalizeShortCode(code: string): string {
    return code.trim().replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  }

  /**
   * Generates a clean, human-friendly 6-digit room code (e.g. 482-915) using CSPRNG.
   */
  private generateUniqueShortCode(): string {
    for (let attempts = 0; attempts < 200; attempts++) {
      // Cryptographically secure random integer between 100000 and 999999
      const num = crypto.randomInt(100000, 1000000);
      const code = `${String(num).slice(0, 3)}-${String(num).slice(3)}`;
      const normalized = this.normalizeShortCode(code);
      if (!this.shortCodeToRoom.has(normalized)) {
        return code;
      }
    }
    // Fallback alphanumeric using CSPRNG
    const alpha = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alpha[crypto.randomInt(0, alpha.length)];
    }
    return `${code.slice(0, 3)}-${code.slice(3)}`;
  }

  /**
   * Creates a new ephemeral room with an access secret and easy-to-type short code.
   * Returns null if server has reached maximum capacity.
   * Note: The encryption secret is NEVER received or handled by the server;
   * it stays in the client's URL fragment or is exchanged via sealed box!
   */
  public createRoom(options?: { maxParticipants?: number; isDirect?: boolean }): {
    roomId: string;
    accessSecret: string;
    shortCode: string;
  } | null {
    if (this.rooms.size >= this.maxRooms) {
      return null;
    }

    const roomId = generateSecureToken(16); // 128-bit URL-safe random string
    const accessSecret = generateSecureToken(32); // 256-bit access capability
    const accessSecretHash = hashAccessSecret(accessSecret);
    const shortCode = this.generateUniqueShortCode();

    const room: Room = {
      id: roomId,
      shortCode,
      accessSecretHash,
      createdAt: Date.now(),
      lastActivityAt: Date.now(),
      maxParticipants: options?.maxParticipants ?? 10,
      isDirect: options?.isDirect ?? false,
      participants: new Map(),
      currentEpoch: 1,
    };

    this.rooms.set(roomId, room);
    this.shortCodeToRoom.set(this.normalizeShortCode(shortCode), { roomId, accessSecret, shortCode });
    return { roomId, accessSecret, shortCode };
  }

  /**
   * Resolves a human-entered short code to its roomId and accessSecret.
   */
  public resolveShortCode(code: string): { roomId: string; accessSecret: string; shortCode: string } | null {
    if (!code) return null;
    const normalized = this.normalizeShortCode(code);
    const entry = this.shortCodeToRoom.get(normalized);
    if (!entry) return null;

    const room = this.rooms.get(entry.roomId);
    if (!room) {
      this.shortCodeToRoom.delete(normalized);
      return null;
    }

    return entry;
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
    const { roomId, participantId, nickname, publicKey, accessSecret } = params;

    const validation = this.validateRoomAccess(roomId, accessSecret);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }

    const room = this.rooms.get(roomId)!;

    const participant: Participant = {
      id: participantId,
      nickname,
      publicKey,
      joinedAt: Date.now(),
      lastPing: Date.now(),
    };

    room.participants.set(participant.id, participant);
    room.lastActivityAt = Date.now();

    this.sockets.set(socket, {
      socket,
      roomId,
      participantId: participant.id,
      isAlive: true,
    });
    this.participantSockets.set(participant.id, socket);

    return { success: true, room };
  }

  /**
   * Retrieve participant socket by ID.
   */
  public getParticipantSocket(participantId: string): WebSocket | undefined {
    return this.participantSockets.get(participantId);
  }

  /**
   * Send event to an individual participant.
   */
  public sendToParticipant(participantId: string, event: ServerEvent): boolean {
    const sock = this.participantSockets.get(participantId);
    if (sock && sock.readyState === 1) { // WebSocket.OPEN
      sock.send(JSON.stringify(event));
      return true;
    }
    return false;
  }

  /**
   * Broadcast an event to all participants in a room.
   */
  public broadcastToRoom(roomId: string, event: ServerEvent, exceptParticipantId?: string): number {
    const room = this.rooms.get(roomId);
    if (!room) return 0;

    room.lastActivityAt = Date.now();
    const payload = JSON.stringify(event);
    let deliveredCount = 0;

    for (const [pId] of room.participants) {
      if (exceptParticipantId && pId === exceptParticipantId) {
        continue;
      }

      const sock = this.participantSockets.get(pId);
      if (sock && sock.readyState === 1) { // WebSocket.OPEN
        sock.send(payload);
        deliveredCount++;
      }
    }

    return deliveredCount;
  }

  /**
   * Get room metadata (never exposes private participant data or secrets).
   */
  public getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * Get metadata for a connected socket.
   */
  public getSocketInfo(socket: WebSocket): ConnectedSocket | undefined {
    return this.sockets.get(socket);
  }

  /**
   * Leave room / remove socket (alias for removeSocket).
   */
  public leaveRoom(socket: WebSocket, reason = 'Disconnected'): void {
    this.removeSocket(socket, reason);
  }

  /**
   * Remove a socket and its participant from the room.
   */
  public removeSocket(socket: WebSocket, reason = 'Disconnected'): void {
    const info = this.sockets.get(socket);
    if (!info) return;

    const { roomId, participantId } = info;
    this.sockets.delete(socket);
    this.participantSockets.delete(participantId);

    const room = this.rooms.get(roomId);
    if (!room) return;

    room.participants.delete(participantId);
    room.lastActivityAt = Date.now();

    // If room is now empty, destroy it immediately per Strict Ephemeral Policy
    if (room.participants.size === 0) {
      this.destroyRoom(roomId, 'All participants departed.');
    } else {
      // Notify remaining room participants
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

    // Delete short code mapping
    this.shortCodeToRoom.delete(this.normalizeShortCode(room.shortCode));

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
      const isPastIdleTimeout = now - room.lastActivityAt > this.idleTimeoutMs;
      // Rooms created more than 5 minutes ago that never had participants are pruned
      const isAbandoned = room.participants.size === 0 && now - room.createdAt > 300_000;
      if (isPastIdleTimeout || isAbandoned) {
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
    this.shortCodeToRoom.clear();
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
