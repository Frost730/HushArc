import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EphemeralRoomManager } from '../../server/room-manager.js';

describe('EphemeralRoomManager (In-Memory)', () => {
  let roomManager: EphemeralRoomManager;

  beforeEach(() => {
    roomManager = new EphemeralRoomManager(30);
  });

  afterEach(() => {
    roomManager.shutdown();
  });

  it('creates an ephemeral room with unique ID and independent access secret', () => {
    const { roomId, accessSecret, shortCode } = roomManager.createRoom();

    expect(roomId).toBeDefined();
    expect(accessSecret).toBeDefined();
    expect(shortCode).toBeDefined();
    expect(shortCode).toMatch(/^[0-9A-Z]{3}-[0-9A-Z]{3}$/);
    expect(roomId).not.toBe(accessSecret);
    expect(roomId.length).toBeGreaterThanOrEqual(16);

    const room = roomManager.getRoom(roomId);
    expect(room).toBeDefined();
    expect(room?.id).toBe(roomId);
    expect(room?.shortCode).toBe(shortCode);
    expect(room?.participants.size).toBe(0);

    const resolved = roomManager.resolveShortCode(shortCode);
    expect(resolved).toBeDefined();
    expect(resolved?.roomId).toBe(roomId);
    expect(resolved?.accessSecret).toBe(accessSecret);

    // Resolves even without hyphens or lowercase
    const resolvedNormalized = roomManager.resolveShortCode(shortCode.replace('-', '').toLowerCase());
    expect(resolvedNormalized?.roomId).toBe(roomId);
  });

  it('validates correct access secret and rejects wrong access secret', () => {
    const { roomId, accessSecret } = roomManager.createRoom();

    const valid = roomManager.validateRoomAccess(roomId, accessSecret);
    expect(valid.valid).toBe(true);

    const invalid = roomManager.validateRoomAccess(roomId, 'wrong-secret-token');
    expect(invalid.valid).toBe(false);
    expect(invalid.reason).toContain('Invalid room access capability');
  });

  it('rejects nonexistent or expired rooms', () => {
    const check = roomManager.validateRoomAccess('nonexistent-room', 'any-secret');
    expect(check.valid).toBe(false);
    expect(check.reason).toContain('Room does not exist or has expired');
  });

  it('enforces room maximum participant capacity', () => {
    const { roomId, accessSecret } = roomManager.createRoom({ maxParticipants: 2 });
    const mockSocket1 = {} as any;
    const mockSocket2 = {} as any;
    const mockSocket3 = {} as any;

    const j1 = roomManager.joinRoom(mockSocket1, {
      roomId,
      participantId: 'p1',
      nickname: 'Alice',
      publicKey: 'pubKey1',
      accessSecret,
    });
    expect(j1.success).toBe(true);

    const j2 = roomManager.joinRoom(mockSocket2, {
      roomId,
      participantId: 'p2',
      nickname: 'Bob',
      publicKey: 'pubKey2',
      accessSecret,
    });
    expect(j2.success).toBe(true);

    // 3rd participant should be rejected due to capacity limit
    const j3 = roomManager.joinRoom(mockSocket3, {
      roomId,
      participantId: 'p3',
      nickname: 'Charlie',
      publicKey: 'pubKey3',
      accessSecret,
    });
    expect(j3.success).toBe(false);
    expect(j3.reason).toContain('maximum capacity');
  });

  it('immediately destroys a room when its last participant leaves', () => {
    const { roomId, accessSecret } = roomManager.createRoom();
    const mockSocket = {} as any;

    roomManager.joinRoom(mockSocket, {
      roomId,
      participantId: 'solo-user',
      nickname: 'Solo',
      publicKey: 'pubKey',
      accessSecret,
    });

    expect(roomManager.getRoom(roomId)).toBeDefined();

    // Solo user leaves
    roomManager.leaveRoom(mockSocket, 'Departed');

    // Room must now be destroyed immediately
    expect(roomManager.getRoom(roomId)).toBeUndefined();
    expect(roomManager.getRoomCount()).toBe(0);
  });

  it('shutdown clears all active rooms and sockets with zero lingering references', () => {
    roomManager.createRoom();
    roomManager.createRoom();
    expect(roomManager.getRoomCount()).toBe(2);

    roomManager.shutdown();
    expect(roomManager.getRoomCount()).toBe(0);
  });
});
