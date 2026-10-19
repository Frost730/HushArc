import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import WebSocket from 'ws';
import { createApp } from '../../server/app.js';
import { EphemeralRoomManager } from '../../server/room-manager.js';
import { setupWebSocket } from '../../server/websocket.js';
import {
  ensureSodiumReady,
  generateEphemeralKeyPair,
  generateSymmetricRoomKey,
  encryptTextMessage,
  decryptTextMessage,
  sealRoomKeyForPeer,
  unsealRoomKeyFromPeer,
} from '../../src/lib/crypto/e2ee.js';

describe('HushArc End-to-End WebSocket & E2EE Integration Test', () => {
  let server: http.Server;
  let roomManager: EphemeralRoomManager;
  let serverUrl: string;
  let wsUrl: string;

  beforeAll(async () => {
    await ensureSodiumReady();

    roomManager = new EphemeralRoomManager(10);
    const app = createApp(roomManager);
    server = http.createServer(app);
    setupWebSocket(server, roomManager);

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as any;
        const port = address.port;
        serverUrl = `http://127.0.0.1:${port}`;
        wsUrl = `ws://127.0.0.1:${port}/ws`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    roomManager.shutdown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('performs full secure ephemeral conversation flow between two participants', async () => {
    console.log('[Step 1] Checking health endpoint...');
    const healthRes = await fetch(`${serverUrl}/health`);
    expect(healthRes.status).toBe(200);
    const healthData = await healthRes.json();
    expect(healthData.status).toBe('ok');
    expect(healthData.rooms).toBeUndefined();
    expect(healthData.participants).toBeUndefined();

    console.log('[Step 2] Creating room via REST...');
    const createRes = await fetch(`${serverUrl}/api/rooms/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxParticipants: 5 }),
    });
    expect(createRes.status).toBe(201);
    const { roomId, accessSecret } = await createRes.json();

    let currentRoomKey = await generateSymmetricRoomKey();
    const aliceKeys = await generateEphemeralKeyPair();
    const bobKeys = await generateEphemeralKeyPair();

    const aliceId = 'alice-' + Math.random().toString(36).slice(2, 8);
    const bobId = 'bob-' + Math.random().toString(36).slice(2, 8);

    console.log('[Step 3] Alice connecting to WS...');
    const aliceWs = new WebSocket(wsUrl);
    await new Promise<void>((resolve) => aliceWs.on('open', resolve));

    aliceWs.send(
      JSON.stringify({
        type: 'join',
        roomId,
        participantId: aliceId,
        nickname: 'Alice',
        publicKey: aliceKeys.publicKey,
        accessSecret,
      })
    );

    const aliceJoinEvent = await new Promise<any>((resolve) => {
      aliceWs.once('message', (data) => resolve(JSON.parse(data.toString())));
    });
    console.log('[Step 3] Alice joined:', aliceJoinEvent.type);
    expect(aliceJoinEvent.type).toBe('join_accepted');

    console.log('[Step 4] Bob connecting to WS...');
    const bobWs = new WebSocket(wsUrl);
    await new Promise<void>((resolve) => bobWs.on('open', resolve));

    const aliceParticipantPromise = new Promise<any>((resolve) => {
      aliceWs.on('message', (data) => {
        const ev = JSON.parse(data.toString());
        if (ev.type === 'participant_joined') resolve(ev);
      });
    });

    bobWs.send(
      JSON.stringify({
        type: 'join',
        roomId,
        participantId: bobId,
        nickname: 'Bob',
        publicKey: bobKeys.publicKey,
        accessSecret,
      })
    );

    const bobJoinEvent = await new Promise<any>((resolve) => {
      bobWs.once('message', (data) => resolve(JSON.parse(data.toString())));
    });
    console.log('[Step 4] Bob joined:', bobJoinEvent.type);
    expect(bobJoinEvent.type).toBe('join_accepted');

    const bobJoinedForAlice = await aliceParticipantPromise;
    console.log('[Step 4] Alice saw Bob join:', bobJoinedForAlice.participant.id);

    console.log('[Step 5] Alice sending message to Bob...');
    const secretText = 'Ephemeral living signal verification message.';
    const encrypted = await encryptTextMessage(secretText, currentRoomKey, 'epoch-1');

    const bobMessagePromise = new Promise<any>((resolve) => {
      bobWs.on('message', (data) => {
        const ev = JSON.parse(data.toString());
        if (ev.type === 'encrypted_message_relayed') resolve(ev);
      });
    });

    const aliceReceiptPromise = new Promise<any>((resolve) => {
      aliceWs.on('message', (data) => {
        const ev = JSON.parse(data.toString());
        if (ev.type === 'message_delivered_receipt') resolve(ev);
      });
    });

    aliceWs.send(
      JSON.stringify({
        type: 'encrypted_message',
        roomId,
        messageId: 'msg-001',
        epoch: 1,
        nonce: encrypted.nonce,
        ciphertext: encrypted.ciphertext,
      })
    );

    const receipt = await aliceReceiptPromise;
    console.log('[Step 5] Alice receipt:', receipt.type);
    const relayedToBob = await bobMessagePromise;
    console.log('[Step 5] Bob received relayed message:', relayedToBob.messageId);

    // Bob decrypts the message locally
    const decryptedByBob = await decryptTextMessage(
      relayedToBob.ciphertext,
      relayedToBob.nonce,
      currentRoomKey,
      'epoch-1'
    );
    expect(decryptedByBob).toBe(secretText);

    // 6. Test that server never stored this message: room manager has no message list!
    const roomState = roomManager.getRoom(roomId);
    expect((roomState as any).messages).toBeUndefined();

    // 7. Test Key Rotation: Alice rotates room key for Epoch 2
    const rotatedRoomKey = await generateSymmetricRoomKey();
    const sealedForBob = await sealRoomKeyForPeer(rotatedRoomKey, bobKeys.publicKey);

    const bobKeyRotationPromise = new Promise<any>((resolve) => {
      bobWs.on('message', (data) => {
        const ev = JSON.parse(data.toString());
        if (ev.type === 'key_rotation_relayed') resolve(ev);
      });
    });

    aliceWs.send(
      JSON.stringify({
        type: 'key_rotation_epoch',
        roomId,
        newEpoch: 2,
        encryptedKeys: {
          [bobId]: {
            nonce: '',
            ciphertext: sealedForBob.ciphertext,
          },
        },
      })
    );

    const rotationNotice = await bobKeyRotationPromise;
    expect(rotationNotice.newEpoch).toBe(2);

    // Bob unseals the new room key
    const bobUnsealedNewKey = await unsealRoomKeyFromPeer(
      rotationNotice.encryptedKeyForYou.ciphertext,
      bobKeys.publicKey,
      bobKeys.privateKey
    );
    expect(bobUnsealedNewKey).toBe(rotatedRoomKey);
    currentRoomKey = rotatedRoomKey;

    // 8. Test Encrypted Message under Epoch 2 with new key
    const msg2Text = 'Second message under Epoch 2 encryption key!';
    const encrypted2 = await encryptTextMessage(msg2Text, currentRoomKey, 'epoch-2');

    const bobMsg2Promise = new Promise<any>((resolve) => {
      bobWs.on('message', (data) => {
        const ev = JSON.parse(data.toString());
        if (ev.type === 'encrypted_message_relayed' && ev.messageId === 'msg-002') resolve(ev);
      });
    });

    aliceWs.send(
      JSON.stringify({
        type: 'encrypted_message',
        roomId,
        messageId: 'msg-002',
        epoch: 2,
        nonce: encrypted2.nonce,
        ciphertext: encrypted2.ciphertext,
      })
    );

    const relayed2 = await bobMsg2Promise;
    const decrypted2 = await decryptTextMessage(
      relayed2.ciphertext,
      relayed2.nonce,
      currentRoomKey,
      'epoch-2'
    );
    expect(decrypted2).toBe(msg2Text);

    // 9. Participants leave and room is destroyed
    bobWs.send(JSON.stringify({ type: 'leave', roomId }));
    await new Promise((r) => setTimeout(r, 50));
    expect(roomManager.getRoom(roomId)?.participants.size).toBe(1);

    aliceWs.send(JSON.stringify({ type: 'leave', roomId }));
    await new Promise((r) => setTimeout(r, 50));
    expect(roomManager.getRoom(roomId)).toBeUndefined();
    expect(roomManager.getRoomCount()).toBe(0);

    aliceWs.close();
    bobWs.close();
  });
});
