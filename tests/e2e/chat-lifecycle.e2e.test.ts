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
  encryptTextMessage,
  decryptTextMessage,
  sealRoomKeyForPeer,
  unsealRoomKeyFromPeer,
} from '../../src/lib/crypto/e2ee.js';

describe('Tier 4: Chat Lifecycle E2E Test Suite (chat-lifecycle.e2e)', () => {
  let testServer: EphemeralTestServerInstance;

  beforeAll(async () => {
    await ensureSodiumReady();
    testServer = await startEphemeralTestServer(10);
  });

  afterAll(async () => {
    await testServer.shutdown();
  });

  it('completes entire ephemeral chat lifecycle: join, sealed-box key exchange, messaging, quoted reply, reaction, leave, and room termination', async () => {
    // 1. Create Room
    const { roomId, accessSecret, shortCode } = await testServer.createRoom(5);
    expect(roomId).toBeDefined();
    expect(accessSecret).toBeDefined();
    expect(shortCode).toHaveLength(7); // format: XXX-XXX

    // Cryptographic entities
    let currentRoomKey = await generateSymmetricRoomKey();
    const aliceKeys = await generateEphemeralKeyPair();
    const bobKeys = await generateEphemeralKeyPair();
    const aliceId = 'alice-' + Math.random().toString(36).slice(2, 8);
    const bobId = 'bob-' + Math.random().toString(36).slice(2, 8);

    // 2. Alice connects & joins
    const aliceWs = new WebSocket(testServer.wsUrl);
    await new Promise<void>((res) => aliceWs.on('open', res));

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

    const aliceAccepted = await waitForWsEvent(aliceWs, (ev) => ev.type === 'join_accepted');
    expect(aliceAccepted.type).toBe('join_accepted');
    expect(aliceAccepted.participants).toHaveLength(1);
    expect(aliceAccepted.epoch).toBe(1);

    // 3. Bob connects & joins
    const bobWs = new WebSocket(testServer.wsUrl);
    await new Promise<void>((res) => bobWs.on('open', res));

    const aliceSawBobJoinPromise = waitForWsEvent(
      aliceWs,
      (ev) => ev.type === 'participant_joined' && ev.participant.id === bobId
    );

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

    const bobAccepted = await waitForWsEvent(bobWs, (ev) => ev.type === 'join_accepted');
    expect(bobAccepted.participants).toHaveLength(2);

    const aliceSawBob = await aliceSawBobJoinPromise;
    expect(aliceSawBob.participant.nickname).toBe('Bob');

    // 4. Sealed-box Key Exchange: Alice seals room key for Bob's public key
    const sealedForBob = await sealRoomKeyForPeer(currentRoomKey, bobKeys.publicKey);
    aliceWs.send(
      JSON.stringify({
        type: 'key_exchange',
        roomId,
        recipientId: bobId,
        sealedKey: sealedForBob.ciphertext,
      })
    );

    const bobReceivedKey = await waitForWsEvent(
      bobWs,
      (ev) => ev.type === 'key_exchange_relayed'
    );
    const bobUnsealedKey = await unsealRoomKeyFromPeer(
      bobReceivedKey.sealedKey,
      bobKeys.publicKey,
      bobKeys.privateKey
    );
    expect(bobUnsealedKey).toBe(currentRoomKey);

    // 5. Alice transmits encrypted message
    const aliceMessageText = 'Hello Bob! This is an ephemeral signal.';
    const encryptedByAlice = await encryptTextMessage(
      aliceMessageText,
      currentRoomKey,
      'epoch-1'
    );
    const msg1Id = 'msg-1-' + Math.random().toString(36).slice(2, 8);

    const bobReceivePromise = waitForWsEvent(
      bobWs,
      (ev) => ev.type === 'encrypted_message_relayed' && ev.messageId === msg1Id
    );

    aliceWs.send(
      JSON.stringify({
        type: 'encrypted_message',
        roomId,
        messageId: msg1Id,
        epoch: 1,
        nonce: encryptedByAlice.nonce,
        ciphertext: encryptedByAlice.ciphertext,
      })
    );

    const aliceReceipt = await waitForWsEvent(
      aliceWs,
      (ev) => ev.type === 'message_delivered_receipt' && ev.messageId === msg1Id
    );
    expect(aliceReceipt.recipientCount).toBe(1);

    const bobMsgEvent = await bobReceivePromise;
    const decryptedByBob = await decryptTextMessage(
      bobMsgEvent.ciphertext,
      bobMsgEvent.nonce,
      bobUnsealedKey,
      `epoch-${bobMsgEvent.epoch}`
    );
    expect(decryptedByBob).toBe(aliceMessageText);

    // 6. Bob sends quoted reply
    const bobReplyText = 'Received loud and clear, Alice!';
    const encryptedReply = await encryptTextMessage(
      bobReplyText,
      bobUnsealedKey,
      'epoch-1'
    );
    const msg2Id = 'msg-2-' + Math.random().toString(36).slice(2, 8);

    const aliceReceiveReplyPromise = waitForWsEvent(
      aliceWs,
      (ev) => ev.type === 'encrypted_message_relayed' && ev.messageId === msg2Id
    );

    bobWs.send(
      JSON.stringify({
        type: 'encrypted_message',
        roomId,
        messageId: msg2Id,
        epoch: 1,
        nonce: encryptedReply.nonce,
        ciphertext: encryptedReply.ciphertext,
        replyToId: msg1Id,
      })
    );

    const aliceReplyEvent = await aliceReceiveReplyPromise;
    expect(aliceReplyEvent.replyToId).toBe(msg1Id);
    const decryptedByAlice = await decryptTextMessage(
      aliceReplyEvent.ciphertext,
      aliceReplyEvent.nonce,
      currentRoomKey,
      `epoch-${aliceReplyEvent.epoch}`
    );
    expect(decryptedByAlice).toBe(bobReplyText);

    // 7. Alice sends encrypted emoji reaction to Bob's reply
    const reactionEmoji = '⚡';
    const encryptedReaction = await encryptTextMessage(
      reactionEmoji,
      currentRoomKey,
      'epoch-1'
    );

    const bobReactionPromise = waitForWsEvent(
      bobWs,
      (ev) => ev.type === 'reaction_relayed' && ev.messageId === msg2Id
    );

    aliceWs.send(
      JSON.stringify({
        type: 'reaction',
        roomId,
        messageId: msg2Id,
        epoch: 1,
        nonce: encryptedReaction.nonce,
        ciphertext: encryptedReaction.ciphertext,
      })
    );

    const bobReactionEvent = await bobReactionPromise;
    const decryptedReaction = await decryptTextMessage(
      bobReactionEvent.ciphertext,
      bobReactionEvent.nonce,
      bobUnsealedKey,
      `epoch-${bobReactionEvent.epoch}`
    );
    expect(decryptedReaction).toBe(reactionEmoji);

    // 8. Bob leaves room
    const aliceSawBobLeavePromise = waitForWsEvent(
      aliceWs,
      (ev) => ev.type === 'participant_left' && ev.participantId === bobId
    );
    bobWs.send(JSON.stringify({ type: 'leave', roomId }));
    bobWs.close(1000);

    const bobLeftEvent = await aliceSawBobLeavePromise;
    expect(bobLeftEvent.participantId).toBe(bobId);

    // 9. Alice ends room for everyone
    aliceWs.send(JSON.stringify({ type: 'end_room', roomId }));
    
    // Allow brief tick for server to process end_room and remove room
    await new Promise((res) => setTimeout(res, 50));
    aliceWs.close(1000);

    // Verify room is purged from roomManager
    expect(testServer.roomManager.getRoom(roomId)).toBeUndefined();
  });
});
