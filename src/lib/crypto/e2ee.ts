import _sodium from 'libsodium-wrappers';

let isReady = false;

export async function ensureSodiumReady(): Promise<typeof _sodium> {
  await _sodium.ready;
  isReady = true;
  return _sodium;
}

export function getSodium(): typeof _sodium {
  if (!isReady) {
    throw new Error('Sodium is not initialized yet. Call ensureSodiumReady() first.');
  }
  return _sodium;
}

export interface EphemeralKeyPair {
  publicKey: string; // Base64
  privateKey: string; // Base64
}

export interface EncryptedPayload {
  ciphertext: string; // Base64
  nonce: string; // Base64
}

/**
 * Generate a cryptographically secure random token (URL-safe string).
 */
export async function generateSecureRandomId(bytes = 16): Promise<string> {
  const sodium = await ensureSodiumReady();
  const randomBytes = sodium.randombytes_buf(bytes);
  return sodium.to_base64(randomBytes, sodium.base64_variants.URLSAFE_NO_PADDING);
}

/**
 * Generate an ephemeral X25519 keypair for public-key key distribution.
 */
export async function generateEphemeralKeyPair(): Promise<EphemeralKeyPair> {
  const sodium = await ensureSodiumReady();
  const pair = sodium.crypto_box_keypair();
  return {
    publicKey: sodium.to_base64(pair.publicKey, sodium.base64_variants.ORIGINAL),
    privateKey: sodium.to_base64(pair.privateKey, sodium.base64_variants.ORIGINAL),
  };
}

/**
 * Generate a fresh 256-bit symmetric room key for XChaCha20-Poly1305.
 */
export async function generateSymmetricRoomKey(): Promise<string> {
  const sodium = await ensureSodiumReady();
  const key = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
  return sodium.to_base64(key, sodium.base64_variants.URLSAFE_NO_PADDING);
}

/**
 * Encrypt a plaintext message using authenticated XChaCha20-Poly1305 with a fresh 24-byte nonce.
 */
export async function encryptTextMessage(
  plaintext: string,
  base64UrlKey: string,
  additionalData = ''
): Promise<EncryptedPayload> {
  const sodium = await ensureSodiumReady();
  const key = sodium.from_base64(base64UrlKey, sodium.base64_variants.URLSAFE_NO_PADDING);
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES); // 24 bytes

  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    additionalData.length > 0 ? additionalData : null,
    null,
    nonce,
    key
  );

  return {
    ciphertext: sodium.to_base64(ciphertext, sodium.base64_variants.ORIGINAL),
    nonce: sodium.to_base64(nonce, sodium.base64_variants.ORIGINAL),
  };
}

/**
 * Decrypt and authenticate a ciphertext message using XChaCha20-Poly1305.
 * Throws an error if ciphertext or additional data has been tampered with or key is incorrect.
 */
export async function decryptTextMessage(
  ciphertextBase64: string,
  nonceBase64: string,
  base64UrlKey: string,
  additionalData = ''
): Promise<string> {
  const sodium = await ensureSodiumReady();
  const key = sodium.from_base64(base64UrlKey, sodium.base64_variants.URLSAFE_NO_PADDING);
  const nonce = sodium.from_base64(nonceBase64, sodium.base64_variants.ORIGINAL);
  const ciphertext = sodium.from_base64(ciphertextBase64, sodium.base64_variants.ORIGINAL);

  const decryptedBytes = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    ciphertext,
    additionalData.length > 0 ? additionalData : null,
    nonce,
    key
  );

  return sodium.to_string(decryptedBytes);
}

/**
 * Seal a new room key for a peer's public key using crypto_box_seal (anonymous public-key encryption).
 */
export async function sealRoomKeyForPeer(
  newRoomKey: string,
  peerPublicKeyBase64: string
): Promise<{ ciphertext: string }> {
  const sodium = await ensureSodiumReady();
  const peerPublicKey = sodium.from_base64(peerPublicKeyBase64, sodium.base64_variants.ORIGINAL);
  const messageBytes = sodium.from_string(newRoomKey);
  const sealed = sodium.crypto_box_seal(messageBytes, peerPublicKey);

  return {
    ciphertext: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL),
  };
}

/**
 * Unseal a rotated room key sent to our public key using our private key.
 */
export async function unsealRoomKeyFromPeer(
  sealedCiphertextBase64: string,
  myPublicKeyBase64: string,
  myPrivateKeyBase64: string
): Promise<string> {
  const sodium = await ensureSodiumReady();
  const sealed = sodium.from_base64(sealedCiphertextBase64, sodium.base64_variants.ORIGINAL);
  const myPublicKey = sodium.from_base64(myPublicKeyBase64, sodium.base64_variants.ORIGINAL);
  const myPrivateKey = sodium.from_base64(myPrivateKeyBase64, sodium.base64_variants.ORIGINAL);

  const unsealedBytes = sodium.crypto_box_seal_open(sealed, myPublicKey, myPrivateKey);
  return sodium.to_string(unsealedBytes);
}

/**
 * Memory zeroization helper to overwrite buffer data where JavaScript permits.
 */
export function bestEffortZeroize(data: Uint8Array | null | undefined): void {
  if (data && data instanceof Uint8Array) {
    try {
      data.fill(0);
    } catch {
      // Best effort
    }
  }
}
