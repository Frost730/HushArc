import { describe, it, expect } from 'vitest';
import {
  encodeRoomCode,
  decodeRoomCode,
  parseInvitationInput,
  buildInvitationUrl,
} from '../../src/lib/ephemeral-session/session.js';

describe('Ephemeral Session Room Code and Invitation Tests', () => {
  const sampleParams = {
    roomId: 'room-123-abc',
    accessSecret: 'sec-456-def',
    encryptionKey: 'key-789-ghi',
  };

  it('encodes and decodes room code reversibly', () => {
    const code = encodeRoomCode(sampleParams);
    expect(code.startsWith('HUSH-')).toBe(true);

    const decoded = decodeRoomCode(code);
    expect(decoded).not.toBeNull();
    expect(decoded?.roomId).toBe(sampleParams.roomId);
    expect(decoded?.accessSecret).toBe(sampleParams.accessSecret);
    expect(decoded?.encryptionKey).toBe(sampleParams.encryptionKey);
  });

  it('decodes room code with case-insensitive prefix', () => {
    const code = encodeRoomCode(sampleParams);
    const lowerPrefixCode = 'hush-' + code.slice(5);
    const decoded = decodeRoomCode(lowerPrefixCode);
    expect(decoded).not.toBeNull();
    expect(decoded?.roomId).toBe(sampleParams.roomId);
  });

  it('parseInvitationInput accepts room code format', () => {
    const code = encodeRoomCode(sampleParams);
    const parsed = parseInvitationInput(code);
    expect(parsed).not.toBeNull();
    expect(parsed?.roomId).toBe(sampleParams.roomId);
    expect(parsed?.accessSecret).toBe(sampleParams.accessSecret);
    expect(parsed?.encryptionKey).toBe(sampleParams.encryptionKey);
  });

  it('parseInvitationInput accepts full invitation URL', () => {
    const url = buildInvitationUrl(sampleParams);
    const parsed = parseInvitationInput(url);
    expect(parsed).not.toBeNull();
    expect(parsed?.roomId).toBe(sampleParams.roomId);
    expect(parsed?.accessSecret).toBe(sampleParams.accessSecret);
    expect(parsed?.encryptionKey).toBe(sampleParams.encryptionKey);
  });

  it('returns null on invalid room code or input', () => {
    expect(decodeRoomCode('HUSH-invalid')).toBeNull();
    expect(parseInvitationInput('random garbage')).toBeNull();
    expect(parseInvitationInput('')).toBeNull();
  });
});
