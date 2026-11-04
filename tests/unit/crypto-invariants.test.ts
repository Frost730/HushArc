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
  bestEffortZeroize,
} from '../../src/lib/crypto/e2ee.js';

describe('The 7 Core Libsodium Zero-Knowledge Security Invariants (F15)', () => {
  beforeAll(async () => {
    await ensureSodiumReady();
  });

  // ==========================================
  // Invariant 1: Key Derivation & Cryptographic Entropy
  // ==========================================
  describe('Invariant 1: Key Derivation & Entropy', () => {
    it('generates 256-bit (32-byte) symmetric keys with high collision resistance', async () => {
      const keys = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const key = await generateSymmetricRoomKey();
        expect(key).toBeDefined();
        // 32 bytes in URLSAFE_NO_PADDING base64 is exactly 43 characters
        expect(key.length).toBe(43);
        keys.add(key);
      }
      expect(keys.size).toBe(20);
    });

    it('generates random identifiers of arbitrary specified byte lengths', async () => {
      const id16 = await generateSecureRandomId(16);
      const id32 = await generateSecureRandomId(32);
      expect(id16).toBeDefined();
      expect(id32).toBeDefined();
      expect(id32.length).toBeGreaterThan(id16.length);
    });
  });

  // ==========================================
  // Invariant 2: Authenticated Encryption (XChaCha20-Poly1305)
  // ==========================================
  describe('Invariant 2: Authenticated Encryption (IND-CPA / Nonce Randomness)', () => {
    it('generates unique random 192-bit nonces and distinct ciphertexts for identical plaintexts', async () => {
      const roomKey = await generateSymmetricRoomKey();
      const plaintext = 'HushArc living signal ephemeral verification payload';

      const enc1 = await encryptTextMessage(plaintext, roomKey, 'epoch-1');
      const enc2 = await encryptTextMessage(plaintext, roomKey, 'epoch-1');

      expect(enc1.nonce).not.toBe(enc2.nonce);
      expect(enc1.ciphertext).not.toBe(enc2.ciphertext);
      expect(enc1.ciphertext).not.toContain(plaintext);
      expect(enc2.ciphertext).not.toContain(plaintext);

      // Both decrypt cleanly to identical plaintext
      const dec1 = await decryptTextMessage(enc1.ciphertext, enc1.nonce, roomKey, 'epoch-1');
      const dec2 = await decryptTextMessage(enc2.ciphertext, enc2.nonce, roomKey, 'epoch-1');
      expect(dec1).toBe(plaintext);
      expect(dec2).toBe(plaintext);
    });

    it('encrypts and decrypts empty string payloads without corruption', async () => {
      const roomKey = await generateSymmetricRoomKey();
      const enc = await encryptTextMessage('', roomKey, 'epoch-1');
      expect(enc.ciphertext).toBeDefined();
      expect(enc.nonce).toBeDefined();

      const dec = await decryptTextMessage(enc.ciphertext, enc.nonce, roomKey, 'epoch-1');
      expect(dec).toBe('');
    });

    it('supports unicode, emojis, and multi-byte utf-8 strings correctly', async () => {
      const roomKey = await generateSymmetricRoomKey();
      const complexText = '🔒 HushArc 📡 Living Signal — 宇宙、星空、量子暗号 🚀✨ \u{1F980}';

      const enc = await encryptTextMessage(complexText, roomKey, 'epoch-1');
      const dec = await decryptTextMessage(enc.ciphertext, enc.nonce, roomKey, 'epoch-1');
      expect(dec).toBe(complexText);
    });
  });

  // ==========================================
  // Invariant 3: AAD Binding to Conversation Epoch
  // ==========================================
  describe('Invariant 3: AAD Epoch Binding', () => {
    it('strictly fails decryption when ciphertext is authenticated under different epoch AAD', async () => {
      const roomKey = await generateSymmetricRoomKey();
      const enc = await encryptTextMessage('Epoch bound message', roomKey, 'epoch-1');

      // Attempt decryption under epoch-2
      await expect(
        decryptTextMessage(enc.ciphertext, enc.nonce, roomKey, 'epoch-2')
      ).rejects.toThrow();

      // Attempt decryption with empty AAD
      await expect(
        decryptTextMessage(enc.ciphertext, enc.nonce, roomKey, '')
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // Invariant 4: Tamper & Malleability Resistance
  // ==========================================
  describe('Invariant 4: Tamper & Malleability Resistance', () => {
    it('detects and rejects single-bit tampering of ciphertext', async () => {
      const roomKey = await generateSymmetricRoomKey();
      const enc = await encryptTextMessage('Integrity sensitive payload', roomKey);

      // Flip first character
      const tampered = (enc.ciphertext[0] === 'A' ? 'B' : 'A') + enc.ciphertext.slice(1);
      await expect(
        decryptTextMessage(tampered, enc.nonce, roomKey)
      ).rejects.toThrow();
    });

    it('rejects tampered or corrupt nonces', async () => {
      const roomKey = await generateSymmetricRoomKey();
      const enc = await encryptTextMessage('Nonce test payload', roomKey);

      const tamperedNonce = (enc.nonce[0] === 'A' ? 'B' : 'A') + enc.nonce.slice(1);
      await expect(
        decryptTextMessage(enc.ciphertext, tamperedNonce, roomKey)
      ).rejects.toThrow();
    });

    it('rejects truncated ciphertext', async () => {
      const roomKey = await generateSymmetricRoomKey();
      const enc = await encryptTextMessage('Truncation test', roomKey);

      const truncated = enc.ciphertext.slice(0, Math.floor(enc.ciphertext.length / 2));
      await expect(
        decryptTextMessage(truncated, enc.nonce, roomKey)
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // Invariant 5: Asymmetric Key Exchange (X25519 Sealed Box)
  // ==========================================
  describe('Invariant 5: Asymmetric Key Exchange (X25519 Sealed Box)', () => {
    it('seals and unseals symmetric room keys for recipient public key with zero prior handshake', async () => {
      const recipient = await generateEphemeralKeyPair();
      const roomKey = await generateSymmetricRoomKey();

      const sealed = await sealRoomKeyForPeer(roomKey, recipient.publicKey);
      expect(sealed.ciphertext).toBeDefined();

      const unsealed = await unsealRoomKeyFromPeer(
        sealed.ciphertext,
        recipient.publicKey,
        recipient.privateKey
      );
      expect(unsealed).toBe(roomKey);
    });

    it('prevents unauthorized third-parties from unsealing peer keys', async () => {
      const bob = await generateEphemeralKeyPair();
      const eve = await generateEphemeralKeyPair();
      const roomKey = await generateSymmetricRoomKey();

      const sealedForBob = await sealRoomKeyForPeer(roomKey, bob.publicKey);

      // Eve attempts to unseal Bob's key
      await expect(
        unsealRoomKeyFromPeer(sealedForBob.ciphertext, eve.publicKey, eve.privateKey)
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // Invariant 6: Binary Chunk Streaming Integrity
  // ==========================================
  describe('Invariant 6: Binary Chunk Streaming Integrity', () => {
    it('encrypts and decrypts binary payloads from 0 bytes to 64 KB with full fidelity', async () => {
      const roomKey = await generateSymmetricRoomKey();

      // Zero-byte chunk
      const emptyChunk = new Uint8Array(0);
      const encEmpty = await encryptBinaryChunk(emptyChunk, roomKey, 'chunk-empty');
      const decEmpty = await decryptBinaryChunk(encEmpty.ciphertext, encEmpty.nonce, roomKey, 'chunk-empty');
      expect(decEmpty).toEqual(emptyChunk);

      // 64 KB binary chunk with pseudo-random bytes
      const largeChunk = new Uint8Array(64 * 1024);
      for (let i = 0; i < largeChunk.length; i++) {
        largeChunk[i] = (i * 37) % 256;
      }
      const encLarge = await encryptBinaryChunk(largeChunk, roomKey, 'chunk-64k');
      const decLarge = await decryptBinaryChunk(encLarge.ciphertext, encLarge.nonce, roomKey, 'chunk-64k');
      expect(decLarge).toEqual(largeChunk);
    });

    it('fails decryption if binary chunk ID in AAD does not match', async () => {
      const roomKey = await generateSymmetricRoomKey();
      const chunk = new Uint8Array([10, 20, 30, 40]);

      const enc = await encryptBinaryChunk(chunk, roomKey, 'chunk-index-0');

      await expect(
        decryptBinaryChunk(enc.ciphertext, enc.nonce, roomKey, 'chunk-index-1')
      ).rejects.toThrow();
    });
  });

  // ==========================================
  // Invariant 7: Memory Zeroization & Hygiene
  // ==========================================
  describe('Invariant 7: Memory Zeroization', () => {
    it('wipes decrypted binary chunk buffers cleanly using bestEffortZeroize', async () => {
      const roomKey = await generateSymmetricRoomKey();
      const chunk = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
      const enc = await encryptBinaryChunk(chunk, roomKey, 'chunk-zeroize');

      const decrypted = await decryptBinaryChunk(enc.ciphertext, enc.nonce, roomKey, 'chunk-zeroize');
      expect(decrypted.some((b) => b !== 0)).toBe(true);

      bestEffortZeroize(decrypted);
      expect(decrypted.every((b) => b === 0)).toBe(true);
    });
  });
});
