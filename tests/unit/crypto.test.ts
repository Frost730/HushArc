import { describe, it, expect, beforeAll } from 'vitest';
import {
  ensureSodiumReady,
  generateSecureRandomId,
  generateEphemeralKeyPair,
  generateSymmetricRoomKey,
  encryptTextMessage,
  decryptTextMessage,
  sealRoomKeyForPeer,
  unsealRoomKeyFromPeer,
  encryptBinaryChunk,
  decryptBinaryChunk,
} from '../../src/lib/crypto/e2ee.js';

describe('HushArc Cryptographic Engine (Libsodium)', () => {
  beforeAll(async () => {
    await ensureSodiumReady();
  });

  it('generates cryptographically secure random identifiers', async () => {
    const id1 = await generateSecureRandomId(16);
    const id2 = await generateSecureRandomId(16);

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);
    expect(id1.length).toBeGreaterThanOrEqual(16);
  });

  it('generates symmetric room keys of correct entropy', async () => {
    const key1 = await generateSymmetricRoomKey();
    const key2 = await generateSymmetricRoomKey();

    expect(key1).toBeDefined();
    expect(key2).toBeDefined();
    expect(key1).not.toBe(key2);
  });

  it('encrypts and decrypts messages with XChaCha20-Poly1305 authenticated encryption', async () => {
    const roomKey = await generateSymmetricRoomKey();
    const secretMessage = 'Some things belong in the moment. HushArc Living Signal.';

    const encrypted = await encryptTextMessage(secretMessage, roomKey, 'room-123');
    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.nonce).toBeDefined();
    expect(encrypted.ciphertext).not.toBe(secretMessage);

    const decrypted = await decryptTextMessage(encrypted.ciphertext, encrypted.nonce, roomKey, 'room-123');
    expect(decrypted).toBe(secretMessage);
  });

  it('strictly rejects tampered ciphertext', async () => {
    const roomKey = await generateSymmetricRoomKey();
    const secretMessage = 'Tamper test payload';

    const encrypted = await encryptTextMessage(secretMessage, roomKey);

    // Corrupt one character in ciphertext
    const corruptedCiphertext =
      encrypted.ciphertext.slice(0, 5) +
      (encrypted.ciphertext[5] === 'A' ? 'B' : 'A') +
      encrypted.ciphertext.slice(6);

    await expect(
      decryptTextMessage(corruptedCiphertext, encrypted.nonce, roomKey)
    ).rejects.toThrow();
  });

  it('strictly rejects tampered nonce or mismatched additional data', async () => {
    const roomKey = await generateSymmetricRoomKey();
    const secretMessage = 'Integrity test';

    const encrypted = await encryptTextMessage(secretMessage, roomKey, 'epoch-1');

    // Attempt decryption with altered additional data
    await expect(
      decryptTextMessage(encrypted.ciphertext, encrypted.nonce, roomKey, 'epoch-2')
    ).rejects.toThrow();
  });

  it('seals and unseals rotated room keys for peer public keys', async () => {
    const aliceKeys = await generateEphemeralKeyPair();
    const bobKeys = await generateEphemeralKeyPair();

    const newEpochKey = await generateSymmetricRoomKey();

    // Alice seals the new room key specifically for Bob's public key
    const sealedForBob = await sealRoomKeyForPeer(newEpochKey, bobKeys.publicKey);

    // Bob unseals with Bob's private key
    const unsealedByBob = await unsealRoomKeyFromPeer(
      sealedForBob.ciphertext,
      bobKeys.publicKey,
      bobKeys.privateKey
    );
    expect(unsealedByBob).toBe(newEpochKey);

    // Alice should NOT be able to unseal Bob's sealed packet
    await expect(
      unsealRoomKeyFromPeer(sealedForBob.ciphertext, aliceKeys.publicKey, aliceKeys.privateKey)
    ).rejects.toThrow();
  });

  it('encrypts and decrypts binary chunks with full integrity', async () => {
    const roomKey = await generateSymmetricRoomKey();
    const rawBytes = new Uint8Array([0x00, 0x48, 0x75, 0x73, 0x68, 0x41, 0x72, 0x63, 0xff, 0xfe]);

    const encrypted = await encryptBinaryChunk(rawBytes, roomKey, 'chunk-0');
    expect(encrypted.ciphertext).toBeDefined();

    const decrypted = await decryptBinaryChunk(encrypted.ciphertext, encrypted.nonce, roomKey, 'chunk-0');
    expect(decrypted).toEqual(rawBytes);
  });
});
