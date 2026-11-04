import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import {
  startEphemeralTestServer,
  waitForWsEvent,
  EphemeralTestServerInstance,
} from '../helpers/ephemeral-test-server.js';
import {
  ensureSodiumReady,
  generateEphemeralKeyPair,
  generateSymmetricRoomKey,
  encryptBinaryChunk,
  decryptBinaryChunk,
} from '../../src/lib/crypto/e2ee.js';

describe('Tier 4: Network Edge Cases & Resilience E2E Test Suite (network-edge-cases.e2e)', () => {
  let testServer: EphemeralTestServerInstance;

  beforeAll(async () => {
    await ensureSodiumReady();
    testServer = await startEphemeralTestServer(2); // Small capacity for capacity test
  });

  afterAll(async () => {
    await testServer.shutdown();
  });

  it('rejects connection attempt when invalid accessSecret is provided', async () => {
    const { roomId } = await testServer.createRoom(2);
    const keys = await generateEphemeralKeyPair();

    const ws = new WebSocket(testServer.wsUrl);
    await new Promise<void>((res) => ws.on('open', res));

    ws.send(
      JSON.stringify({
        type: 'join',
        roomId,
        participantId: 'attacker-12345',
        nickname: 'Eve',
        publicKey: keys.publicKey,
        accessSecret: 'wrong-secret-key-12345678', // >= 16 chars to pass zod schema
      })
    );

    const rejection = await waitForWsEvent(ws, (ev) => ev.type === 'join_rejected');
    expect(rejection.type).toBe('join_rejected');
    expect(rejection.reason).toMatch(/Invalid room access/i);
    ws.close(1000);
  });

  it('rejects connection attempt when target room does not exist', async () => {
    const keys = await generateEphemeralKeyPair();
    const ws = new WebSocket(testServer.wsUrl);
    await new Promise<void>((res) => ws.on('open', res));

    ws.send(
      JSON.stringify({
        type: 'join',
        roomId: 'non-existent-room-999', // >= 8 chars
        participantId: 'user-lost-12345',  // >= 8 chars
        nickname: 'LostUser',
        publicKey: keys.publicKey,
        accessSecret: 'valid-length-secret-1234', // >= 16 chars
      })
    );

    const rejection = await waitForWsEvent(ws, (ev) => ev.type === 'join_rejected');
    expect(rejection.type).toBe('join_rejected');
    expect(rejection.reason).toMatch(/Room does not exist/i);
    ws.close(1000);
  });

  it('enforces room participant capacity limits and rejects overflow users', async () => {
    // Room with maxParticipants = 2
    const { roomId, accessSecret } = await testServer.createRoom(2);

    const p1Keys = await generateEphemeralKeyPair();
    const p2Keys = await generateEphemeralKeyPair();
    const p3Keys = await generateEphemeralKeyPair();

    const ws1 = new WebSocket(testServer.wsUrl);
    await new Promise<void>((res) => ws1.on('open', res));
    ws1.send(
      JSON.stringify({
        type: 'join',
        roomId,
        participantId: 'participant-1-alpha',
        nickname: 'Participant 1',
        publicKey: p1Keys.publicKey,
        accessSecret,
      })
    );
    await waitForWsEvent(ws1, (ev) => ev.type === 'join_accepted');

    const ws2 = new WebSocket(testServer.wsUrl);
    await new Promise<void>((res) => ws2.on('open', res));
    ws2.send(
      JSON.stringify({
        type: 'join',
        roomId,
        participantId: 'participant-2-bravo',
        nickname: 'Participant 2',
        publicKey: p2Keys.publicKey,
        accessSecret,
      })
    );
    await waitForWsEvent(ws2, (ev) => ev.type === 'join_accepted');

    // 3rd participant attempts to join room of capacity 2
    const ws3 = new WebSocket(testServer.wsUrl);
    await new Promise<void>((res) => ws3.on('open', res));
    ws3.send(
      JSON.stringify({
        type: 'join',
        roomId,
        participantId: 'participant-3-charlie',
        nickname: 'Participant 3',
        publicKey: p3Keys.publicKey,
        accessSecret,
      })
    );

    const rejection = await waitForWsEvent(ws3, (ev) => ev.type === 'join_rejected');
    expect(rejection.type).toBe('join_rejected');
    expect(rejection.reason).toMatch(/maximum capacity/i);

    ws1.close(1000);
    ws2.close(1000);
    ws3.close(1000);
  });

  it('streams encrypted binary chunks and recovers gracefully if peer drops midway', async () => {
    const { roomId, accessSecret } = await testServer.createRoom(5);
    const roomKey = await generateSymmetricRoomKey();
    const senderKeys = await generateEphemeralKeyPair();
    const receiverKeys = await generateEphemeralKeyPair();

    const senderWs = new WebSocket(testServer.wsUrl);
    const receiverWs = new WebSocket(testServer.wsUrl);

    await Promise.all([
      new Promise<void>((res) => senderWs.on('open', res)),
      new Promise<void>((res) => receiverWs.on('open', res)),
    ]);

    senderWs.send(
      JSON.stringify({
        type: 'join',
        roomId,
        participantId: 'sender-file-user',
        nickname: 'Sender',
        publicKey: senderKeys.publicKey,
        accessSecret,
      })
    );
    await waitForWsEvent(senderWs, (ev) => ev.type === 'join_accepted');

    receiverWs.send(
      JSON.stringify({
        type: 'join',
        roomId,
        participantId: 'receiver-file-user',
        nickname: 'Receiver',
        publicKey: receiverKeys.publicKey,
        accessSecret,
      })
    );
    await waitForWsEvent(receiverWs, (ev) => ev.type === 'join_accepted');

    // Prepare 3 chunks of a simulated 96 KB binary file
    const attachmentId = 'att-stream-' + Math.random().toString(36).slice(2, 8);
    const totalChunks = 3;
    const chunkSize = 32768; // 32 KB
    const originalChunks: Uint8Array[] = [];

    for (let i = 0; i < totalChunks; i++) {
      const chunk = new Uint8Array(chunkSize);
      chunk.fill(i + 1);
      originalChunks.push(chunk);
    }

    // Send chunk 0
    const enc0 = await encryptBinaryChunk(originalChunks[0], roomKey, 'epoch-1');
    senderWs.send(
      JSON.stringify({
        type: 'attachment_chunk',
        roomId,
        attachmentId,
        fileName: 'test-data.bin',
        fileType: 'application/octet-stream',
        fileSize: chunkSize * totalChunks,
        chunkIndex: 0,
        totalChunks,
        epoch: 1,
        nonce: enc0.nonce,
        ciphertext: enc0.ciphertext,
      })
    );

    const receivedChunk0 = await waitForWsEvent(
      receiverWs,
      (ev) => ev.type === 'attachment_chunk_relayed' && ev.chunkIndex === 0
    );
    const dec0 = await decryptBinaryChunk(
      receivedChunk0.ciphertext,
      receivedChunk0.nonce,
      roomKey,
      'epoch-1'
    );
    expect(dec0[0]).toBe(1);
    expect(dec0.length).toBe(chunkSize);

    // Abruptly terminate receiver WebSocket midway through chunk streaming
    receiverWs.close(1001, 'Abrupt user navigation');

    // Sender continues sending remaining chunks
    const enc1 = await encryptBinaryChunk(originalChunks[1], roomKey, 'epoch-1');
    expect(() => {
      senderWs.send(
        JSON.stringify({
          type: 'attachment_chunk',
          roomId,
          attachmentId,
          fileName: 'test-data.bin',
          fileType: 'application/octet-stream',
          fileSize: chunkSize * totalChunks,
          chunkIndex: 1,
          totalChunks,
          epoch: 1,
          nonce: enc1.nonce,
          ciphertext: enc1.ciphertext,
        })
      );
    }).not.toThrow();

    // Verify sender connection remains completely healthy and server does not crash
    expect(senderWs.readyState).toBe(WebSocket.OPEN);
    senderWs.close(1000);
  });
});
