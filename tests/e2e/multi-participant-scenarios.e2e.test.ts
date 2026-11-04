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

describe('Tier 4: Multi-Participant Encrypted Group Arc (multi-participant-scenarios.e2e)', () => {
  let testServer: EphemeralTestServerInstance;

  beforeAll(async () => {
    await ensureSodiumReady();
    testServer = await startEphemeralTestServer(10);
  });

  afterAll(async () => {
    await testServer.shutdown();
  });

  it('orchestrates 4-participant encrypted group session with dynamic key rotation and room teardown', async () => {
    const { roomId, accessSecret } = await testServer.createRoom(6);

    let epoch1Key = await generateSymmetricRoomKey();
    const names = ['Alice', 'Bob', 'Charlie', 'Dana'];
    const participants: Array<{
      id: string;
      name: string;
      keys: { publicKey: string; privateKey: string };
      ws: WebSocket;
      currentKey: string;
    }> = [];

    // Connect and join each participant
    for (const name of names) {
      const keys = await generateEphemeralKeyPair();
      const id = `${name.toLowerCase()}-${Math.random().toString(36).slice(2, 6)}`;
      const ws = new WebSocket(testServer.wsUrl);
      await new Promise<void>((res) => ws.on('open', res));

      ws.send(
        JSON.stringify({
          type: 'join',
          roomId,
          participantId: id,
          nickname: name,
          publicKey: keys.publicKey,
          accessSecret,
        })
      );

      const accepted = await waitForWsEvent(ws, (ev) => ev.type === 'join_accepted');
      expect(accepted.type).toBe('join_accepted');

      participants.push({
        id,
        name,
        keys,
        ws,
        currentKey: name === 'Alice' ? epoch1Key : '',
      });
    }

    expect(participants).toHaveLength(4);

    // Alice distributes epoch1 key to Bob, Charlie, Dana via sealed-box
    const alice = participants[0];
    for (let i = 1; i < participants.length; i++) {
      const peer = participants[i];
      const sealed = await sealRoomKeyForPeer(epoch1Key, peer.keys.publicKey);
      alice.ws.send(
        JSON.stringify({
          type: 'key_exchange',
          roomId,
          recipientId: peer.id,
          sealedKey: sealed.ciphertext,
        })
      );

      const relayed = await waitForWsEvent(
        peer.ws,
        (ev) => ev.type === 'key_exchange_relayed'
      );
      peer.currentKey = await unsealRoomKeyFromPeer(
        relayed.sealedKey,
        peer.keys.publicKey,
        peer.keys.privateKey
      );
      expect(peer.currentKey).toBe(epoch1Key);
    }

    // Bob broadcasts an encrypted message to the group under Epoch 1
    const bob = participants[1];
    const bobMsgText = 'Greetings from Bob to the entire Arc!';
    const encBobMsg = await encryptTextMessage(bobMsgText, bob.currentKey, 'epoch-1');
    const msgId = 'group-msg-1';

    const receivePromises = [alice, participants[2], participants[3]].map((p) =>
      waitForWsEvent(p.ws, (ev) => ev.type === 'encrypted_message_relayed' && ev.messageId === msgId)
    );

    bob.ws.send(
      JSON.stringify({
        type: 'encrypted_message',
        roomId,
        messageId: msgId,
        epoch: 1,
        nonce: encBobMsg.nonce,
        ciphertext: encBobMsg.ciphertext,
      })
    );

    const receivedEvents = await Promise.all(receivePromises);
    for (let i = 0; i < receivedEvents.length; i++) {
      const ev = receivedEvents[i];
      const recipient = [alice, participants[2], participants[3]][i];
      const dec = await decryptTextMessage(
        ev.ciphertext,
        ev.nonce,
        recipient.currentKey,
        'epoch-1'
      );
      expect(dec).toBe(bobMsgText);
    }

    // Now Alice triggers Key Rotation to Epoch 2
    const epoch2Key = await generateSymmetricRoomKey();
    const encryptedBundles: Record<string, { nonce: string; ciphertext: string }> = {};

    for (let i = 1; i < participants.length; i++) {
      const peer = participants[i];
      const sealed = await sealRoomKeyForPeer(epoch2Key, peer.keys.publicKey);
      encryptedBundles[peer.id] = {
        nonce: '',
        ciphertext: sealed.ciphertext,
      };
    }

    // Listen for rotation events on peers
    const rotationPromises = [participants[1], participants[2], participants[3]].map((p) =>
      waitForWsEvent(p.ws, (ev) => ev.type === 'key_rotation_relayed' && ev.newEpoch === 2)
    );

    alice.ws.send(
      JSON.stringify({
        type: 'key_rotation_epoch',
        roomId,
        newEpoch: 2,
        encryptedKeys: encryptedBundles,
      })
    );

    alice.currentKey = epoch2Key;
    const rotationEvents = await Promise.all(rotationPromises);

    // Each peer unseals new key
    for (let i = 1; i < participants.length; i++) {
      const peer = participants[i];
      const ev = rotationEvents[i - 1];
      peer.currentKey = await unsealRoomKeyFromPeer(
        ev.encryptedKeyForYou.ciphertext,
        peer.keys.publicKey,
        peer.keys.privateKey
      );
      expect(peer.currentKey).toBe(epoch2Key);
    }

    // Charlie transmits under Epoch 2
    const charlie = participants[2];
    const charlieMsgText = 'Post-rotation secret signal under Epoch 2!';
    const encCharlieMsg = await encryptTextMessage(
      charlieMsgText,
      charlie.currentKey,
      'epoch-2'
    );
    const msg2Id = 'group-msg-2';

    const receivePromisesEpoch2 = [alice, bob, participants[3]].map((p) =>
      waitForWsEvent(p.ws, (ev) => ev.type === 'encrypted_message_relayed' && ev.messageId === msg2Id)
    );

    charlie.ws.send(
      JSON.stringify({
        type: 'encrypted_message',
        roomId,
        messageId: msg2Id,
        epoch: 2,
        nonce: encCharlieMsg.nonce,
        ciphertext: encCharlieMsg.ciphertext,
      })
    );

    const receivedEpoch2Events = await Promise.all(receivePromisesEpoch2);
    for (let i = 0; i < receivedEpoch2Events.length; i++) {
      const ev = receivedEpoch2Events[i];
      const recipient = [alice, bob, participants[3]][i];
      const dec = await decryptTextMessage(
        ev.ciphertext,
        ev.nonce,
        recipient.currentKey,
        'epoch-2'
      );
      expect(dec).toBe(charlieMsgText);
    }

    // Verify forward secrecy: attempting to decrypt Epoch 2 message with stale Epoch 1 key MUST throw
    await expect(
      decryptTextMessage(
        encCharlieMsg.ciphertext,
        encCharlieMsg.nonce,
        epoch1Key,
        'epoch-2'
      )
    ).rejects.toThrow();

    // Clean teardown: close all connections
    for (const p of participants) {
      p.ws.close(1000);
    }
  });
});
