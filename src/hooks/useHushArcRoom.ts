import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ensureSodiumReady,
  generateEphemeralKeyPair,
  generateSecureRandomId,
  generateSymmetricRoomKey,
  encryptTextMessage,
  decryptTextMessage,
  sealRoomKeyForPeer,
  unsealRoomKeyFromPeer,
  encryptBinaryChunk,
  decryptBinaryChunk,
  EphemeralKeyPair,
} from '../lib/crypto/e2ee.js';
import { purgeLocalSession } from '../lib/ephemeral-session/session.js';
import type { ClientEvent, ServerEvent } from '../../server/types.js';

export interface EphemeralAttachment {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  blobUrl?: string; // Decrypted in-memory Blob URL
  progress: number; // 0 to 100
  isComplete: boolean;
}

export interface DecryptedMessage {
  id: string;
  senderId: string;
  senderNickname: string;
  isMine: boolean;
  plaintext: string;
  timestamp: number;
  epoch: number;
  deliveryStatus: 'sending' | 'sent' | 'delivered' | 'failed';
  recipientCount?: number;
  replyToId?: string;
  reactions: Record<string, string[]>; // emoji -> array of nicknames
  attachment?: EphemeralAttachment;
}

export interface UseHushArcRoomOptions {
  roomId: string;
  accessSecret: string;
  initialRoomKey: string;
  initialNickname?: string;
  onRoomEnded?: (reason: string) => void;
}

export function useHushArcRoom(options: UseHushArcRoomOptions) {
  const { roomId, accessSecret, initialRoomKey, initialNickname, onRoomEnded } = options;

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Array<{ id: string; nickname: string; publicKey: string; joinedAt: number }>>([]);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [currentEpoch, setCurrentEpoch] = useState(1);
  const [myParticipantId, setMyParticipantId] = useState<string>('');
  const [myNickname, setMyNickname] = useState<string>(initialNickname || 'Silent Orbit');

  const [hasKey, setHasKey] = useState<boolean>(Boolean(initialRoomKey));

  // Cryptographic and callback references (strictly kept in JS closure memory)
  const roomKeyRef = useRef<string>(initialRoomKey);
  const keyPairRef = useRef<EphemeralKeyPair | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingAttachmentsRef = useRef<
    Map<
      string,
      {
        chunks: (Uint8Array | null)[];
        receivedCount: number;
        totalChunks: number;
        fileName: string;
        fileType: string;
        fileSize: number;
        senderId: string;
        senderNickname: string;
      }
    >
  >(new Map());
  const createdBlobUrlsRef = useRef<string[]>([]);

  const onRoomEndedRef = useRef(onRoomEnded);
  useEffect(() => {
    onRoomEndedRef.current = onRoomEnded;
  }, [onRoomEnded]);

  const initialNicknameRef = useRef(initialNickname || 'Silent Orbit');
  useEffect(() => {
    if (initialNickname) {
      initialNicknameRef.current = initialNickname;
    }
  }, [initialNickname]);

  useEffect(() => {
    if (initialRoomKey) {
      roomKeyRef.current = initialRoomKey;
    }
  }, [initialRoomKey]);

  // Initialize ephemeral cryptography and connect WebSocket ONCE per room session
  useEffect(() => {
    let isCancelled = false;

    async function init() {
      try {
        await ensureSodiumReady();
        const pair = await generateEphemeralKeyPair();
        const pId = await generateSecureRandomId(16);

        if (isCancelled) return;

        keyPairRef.current = pair;
        setMyParticipantId(pId);

        // Determine protocol ws/wss based on page origin
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isCancelled) return;
          // Send join event
          const joinEvent: ClientEvent = {
            type: 'join',
            roomId,
            participantId: pId,
            nickname: initialNicknameRef.current,
            publicKey: pair.publicKey,
            accessSecret,
          };
          ws.send(JSON.stringify(joinEvent));
        };

        ws.onmessage = async (event) => {
          if (isCancelled) return;

          try {
            const data: ServerEvent = JSON.parse(event.data);

            switch (data.type) {
              case 'join_accepted':
                setConnectionStatus('connected');
                setCurrentEpoch(data.epoch);
                setParticipants(data.participants);
                break;

              case 'join_rejected':
                setConnectionStatus('disconnected');
                setError(data.reason);
                if (onRoomEndedRef.current) onRoomEndedRef.current(data.reason);
                break;

              case 'participant_joined':
                setParticipants((prev) => {
                  if (prev.some((p) => p.id === data.participant.id)) return prev;
                  return [...prev, data.participant];
                });

                // Automatic peer key exchange: if we possess the room key, immediately seal and relay it to the joining peer
                if (roomKeyRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  sealRoomKeyForPeer(roomKeyRef.current, data.participant.publicKey)
                    .then((sealedKey) => {
                      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        wsRef.current.send(
                          JSON.stringify({
                            type: 'key_exchange',
                            roomId,
                            recipientId: data.participant.id,
                            sealedKey: sealedKey.ciphertext,
                          })
                        );
                      }
                    })
                    .catch((err) => {
                      console.error('[HushArc] Failed to seal room key for peer:', err);
                    });
                }
                break;

              case 'key_exchange_relayed': {
                if (keyPairRef.current) {
                  try {
                    const unsealedKey = await unsealRoomKeyFromPeer(
                      data.sealedKey,
                      keyPairRef.current.publicKey,
                      keyPairRef.current.privateKey
                    );
                    roomKeyRef.current = unsealedKey;
                    setHasKey(true);
                  } catch (err) {
                    console.error('[HushArc] Failed to unseal room key from peer:', err);
                  }
                }
                break;
              }

              case 'participant_left':
                setParticipants((prev) => prev.filter((p) => p.id !== data.participantId));
                setTypingUsers((prev) => prev.filter((u) => u !== data.participantId));
                break;

              case 'encrypted_message_relayed': {
                try {
                  const plaintext = await decryptTextMessage(
                    data.ciphertext,
                    data.nonce,
                    roomKeyRef.current,
                    `epoch-${data.epoch}`
                  );

                  const newMsg: DecryptedMessage = {
                    id: data.messageId,
                    senderId: data.senderId,
                    senderNickname: data.senderNickname,
                    isMine: false,
                    plaintext,
                    timestamp: data.timestamp,
                    epoch: data.epoch,
                    deliveryStatus: 'delivered',
                    replyToId: data.replyToId,
                    reactions: {},
                  };

                  setMessages((prev) => [...prev, newMsg]);
                } catch {
                  // Decryption authentication failed: corrupted or wrong key!
                  console.error('[HushArc] Decryption failed for incoming message.');
                }
                break;
              }

              case 'message_delivered_receipt':
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === data.messageId
                      ? { ...m, deliveryStatus: 'delivered', recipientCount: data.recipientCount }
                      : m
                  )
                );
                break;

              case 'reaction_relayed': {
                try {
                  const emoji = await decryptTextMessage(
                    data.ciphertext,
                    data.nonce,
                    roomKeyRef.current,
                    `epoch-${data.epoch}`
                  );

                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== data.messageId) return m;
                      const currentReactions = { ...m.reactions };
                      const list = currentReactions[emoji] || [];
                      if (!list.includes(data.senderId)) {
                        currentReactions[emoji] = [...list, data.senderId];
                      }
                      return { ...m, reactions: currentReactions };
                    })
                  );
                } catch {
                  // Ignore invalid reaction
                }
                break;
              }

              case 'typing_relayed':
                setTypingUsers((prev) => {
                  if (data.isTyping) {
                    return prev.includes(data.nickname) ? prev : [...prev, data.nickname];
                  } else {
                    return prev.filter((n) => n !== data.nickname);
                  }
                });
                break;

              case 'key_rotation_relayed': {
                if (keyPairRef.current) {
                  try {
                    const newKey = await unsealRoomKeyFromPeer(
                      data.encryptedKeyForYou.ciphertext,
                      keyPairRef.current.publicKey,
                      keyPairRef.current.privateKey
                    );
                    roomKeyRef.current = newKey;
                    setCurrentEpoch(data.newEpoch);
                  } catch (e) {
                    console.error('[HushArc] Failed to unseal rotated room key:', e);
                  }
                }
                break;
              }

              case 'attachment_chunk_relayed': {
                try {
                  const chunkBytes = await decryptBinaryChunk(
                    data.ciphertext,
                    data.nonce,
                    roomKeyRef.current,
                    `epoch-${data.epoch}`
                  );

                  let record = incomingAttachmentsRef.current.get(data.attachmentId);
                  if (!record) {
                    record = {
                      chunks: new Array(data.totalChunks).fill(null),
                      receivedCount: 0,
                      totalChunks: data.totalChunks,
                      fileName: data.fileName,
                      fileType: data.fileType,
                      fileSize: data.fileSize,
                      senderId: data.senderId,
                      senderNickname: data.senderNickname,
                    };
                    incomingAttachmentsRef.current.set(data.attachmentId, record);
                  }

                  if (record.chunks[data.chunkIndex] === null) {
                    record.chunks[data.chunkIndex] = chunkBytes;
                    record.receivedCount += 1;
                  }

                  const progress = Math.round((record.receivedCount / record.totalChunks) * 100);
                  const isComplete = record.receivedCount === record.totalChunks;

                  let blobUrl: string | undefined = undefined;
                  if (isComplete) {
                    const blob = new Blob(record.chunks as BlobPart[], { type: record.fileType });
                    blobUrl = URL.createObjectURL(blob);
                    createdBlobUrlsRef.current.push(blobUrl);
                    incomingAttachmentsRef.current.delete(data.attachmentId);
                  }

                  setMessages((prev) => {
                    const existingIndex = prev.findIndex((m) => m.id === data.attachmentId);
                    if (existingIndex >= 0) {
                      const updated = [...prev];
                      const existingMsg = updated[existingIndex]!;
                      updated[existingIndex] = {
                        ...existingMsg,
                        attachment: {
                          ...existingMsg.attachment!,
                          progress,
                          isComplete,
                          blobUrl: blobUrl || existingMsg.attachment?.blobUrl,
                        },
                      };
                      return updated;
                    } else {
                      const newMsg: DecryptedMessage = {
                        id: data.attachmentId,
                        senderId: data.senderId,
                        senderNickname: data.senderNickname,
                        isMine: false,
                        plaintext: `Shared file: ${data.fileName}`,
                        timestamp: data.timestamp,
                        epoch: data.epoch,
                        deliveryStatus: 'delivered',
                        reactions: {},
                        attachment: {
                          id: data.attachmentId,
                          fileName: data.fileName,
                          fileType: data.fileType,
                          fileSize: data.fileSize,
                          blobUrl,
                          progress,
                          isComplete,
                        },
                      };
                      return [...prev, newMsg];
                    }
                  });
                } catch (e) {
                  console.error('[HushArc] Failed to decrypt attachment chunk:', e);
                }
                break;
              }

              case 'room_ended':
                setConnectionStatus('disconnected');
                setError(data.reason);
                if (onRoomEndedRef.current) onRoomEndedRef.current(data.reason);
                break;

              case 'error':
                setError(data.message);
                break;
            }
          } catch (e) {
            console.error('[HushArc] Error processing server event:', e);
          }
        };

        ws.onclose = () => {
          if (!isCancelled) {
            setConnectionStatus('disconnected');
          }
        };

        ws.onerror = () => {
          if (!isCancelled) {
            setConnectionStatus('disconnected');
            setError('Connection error');
          }
        };
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || 'Failed to initialize cryptographic session');
          setConnectionStatus('disconnected');
        }
      }
    }

    init();

    return () => {
      isCancelled = true;
      if (wsRef.current) {
        try {
          wsRef.current.close(1000, 'Exited');
        } catch {
          // ignore
        }
        wsRef.current = null;
      }
      // Revoke all in-memory Blob URLs immediately to free memory
      for (const url of createdBlobUrlsRef.current) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          // ignore
        }
      }
      createdBlobUrlsRef.current = [];
      incomingAttachmentsRef.current.clear();

      // Purge all cryptographic keys from memory
      roomKeyRef.current = '';
      keyPairRef.current = null;
      purgeLocalSession();
    };
  }, [roomId, accessSecret]);

  // Send an end-to-end encrypted message
  const sendMessage = useCallback(
    async (plaintext: string, replyToId?: string) => {
      const trimmed = plaintext.trim();
      if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        return;
      }

      try {
        const msgId = 'msg-' + (await generateSecureRandomId(12));
        const encrypted = await encryptTextMessage(
          trimmed,
          roomKeyRef.current,
          `epoch-${currentEpoch}`
        );

        // Add to local transcript immediately with 'sending' status
        const localMsg: DecryptedMessage = {
          id: msgId,
          senderId: myParticipantId,
          senderNickname: myNickname,
          isMine: true,
          plaintext: trimmed,
          timestamp: Date.now(),
          epoch: currentEpoch,
          deliveryStatus: 'sending',
          replyToId,
          reactions: {},
        };

        setMessages((prev) => [...prev, localMsg]);

        const clientEvent: ClientEvent = {
          type: 'encrypted_message',
          roomId,
          messageId: msgId,
          epoch: currentEpoch,
          nonce: encrypted.nonce,
          ciphertext: encrypted.ciphertext,
          replyToId,
        };

        wsRef.current.send(JSON.stringify(clientEvent));
      } catch (err) {
        console.error('[HushArc] Failed to encrypt message:', err);
      }
    },
    [roomId, currentEpoch, myParticipantId, myNickname]
  );

  // Send an encrypted emoji reaction
  const sendReaction = useCallback(
    async (messageId: string, emoji: string) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      try {
        const encrypted = await encryptTextMessage(
          emoji,
          roomKeyRef.current,
          `epoch-${currentEpoch}`
        );

        const clientEvent: ClientEvent = {
          type: 'reaction',
          roomId,
          messageId,
          epoch: currentEpoch,
          nonce: encrypted.nonce,
          ciphertext: encrypted.ciphertext,
        };

        wsRef.current.send(JSON.stringify(clientEvent));
      } catch (err) {
        console.error('[HushArc] Failed to encrypt reaction:', err);
      }
    },
    [roomId, currentEpoch]
  );

  // Broadcast typing status with auto-clearing timeout
  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      wsRef.current.send(
        JSON.stringify({
          type: 'typing',
          roomId,
          isTyping,
        })
      );

      if (isTyping) {
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
          sendTyping(false);
        }, 3000);
      }
    },
    [roomId]
  );

  // Rotate group room key
  const rotateRoomKey = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    try {
      const newEpoch = currentEpoch + 1;
      const newKey = await generateSymmetricRoomKey();
      const encryptedBundles: Record<string, { nonce: string; ciphertext: string }> = {};

      for (const p of participants) {
        if (p.id === myParticipantId) continue;
        const sealed = await sealRoomKeyForPeer(newKey, p.publicKey);
        encryptedBundles[p.id] = {
          nonce: '',
          ciphertext: sealed.ciphertext,
        };
      }

      // Update local key
      roomKeyRef.current = newKey;
      setCurrentEpoch(newEpoch);

      wsRef.current.send(
        JSON.stringify({
          type: 'key_rotation_epoch',
          roomId,
          newEpoch,
          encryptedKeys: encryptedBundles,
        })
      );
    } catch (err) {
      console.error('[HushArc] Key rotation error:', err);
    }
  }, [roomId, currentEpoch, participants, myParticipantId]);

  // Leave room and cleanly wipe in-memory transcript
  const leaveRoom = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave', roomId }));
      wsRef.current.close(1000, 'Left room');
    }
    // Wipe client transcript and cryptographic references immediately
    setMessages([]);
    roomKeyRef.current = '';
    keyPairRef.current = null;
    purgeLocalSession();
  }, [roomId]);

  // End room for everyone
  const endRoom = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end_room', roomId }));
      wsRef.current.close(1000, 'Room ended');
    }
    setMessages([]);
    roomKeyRef.current = '';
    keyPairRef.current = null;
    purgeLocalSession();
  }, [roomId]);

  // Send an encrypted ephemeral binary attachment (chunked at 32KB)
  const sendAttachment = useCallback(
    async (file: File) => {
      const maxSizeBytes = 5 * 1024 * 1024; // 5 MB
      if (file.size > maxSizeBytes) {
        throw new Error('File exceeds maximum size of 5 MB.');
      }
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        throw new Error('Signal connection not active.');
      }

      const attachmentId = 'att-' + (await generateSecureRandomId(12));
      const chunkSize = 32768; // 32 KB chunks
      const totalChunks = Math.ceil(file.size / chunkSize);

      // Local preview
      const localBlobUrl = URL.createObjectURL(file);
      createdBlobUrlsRef.current.push(localBlobUrl);

      const localMsg: DecryptedMessage = {
        id: attachmentId,
        senderId: myParticipantId,
        senderNickname: myNickname,
        isMine: true,
        plaintext: `Shared file: ${file.name}`,
        timestamp: Date.now(),
        epoch: currentEpoch,
        deliveryStatus: 'sending',
        reactions: {},
        attachment: {
          id: attachmentId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          blobUrl: localBlobUrl,
          progress: 100,
          isComplete: true,
        },
      };

      setMessages((prev) => [...prev, localMsg]);

      // Stream encrypted chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const slice = file.slice(start, end);
        const buffer = await slice.arrayBuffer();
        const chunkBytes = new Uint8Array(buffer);

        const encrypted = await encryptBinaryChunk(
          chunkBytes,
          roomKeyRef.current,
          `epoch-${currentEpoch}`
        );

        const clientEvent: ClientEvent = {
          type: 'attachment_chunk',
          roomId,
          attachmentId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          chunkIndex: i,
          totalChunks,
          epoch: currentEpoch,
          nonce: encrypted.nonce,
          ciphertext: encrypted.ciphertext,
        };

        wsRef.current.send(JSON.stringify(clientEvent));

        // Gentle pause between chunks to keep network/socket smooth
        if (totalChunks > 1) {
          await new Promise((r) => setTimeout(r, 8));
        }
      }

      setMessages((prev) =>
        prev.map((m) => (m.id === attachmentId ? { ...m, deliveryStatus: 'delivered' } : m))
      );
    },
    [roomId, currentEpoch, myParticipantId, myNickname]
  );

  return {
    connectionStatus,
    error,
    participants,
    messages,
    typingUsers,
    currentEpoch,
    myParticipantId,
    myNickname,
    setMyNickname,
    sendMessage,
    sendAttachment,
    sendReaction,
    sendTyping,
    rotateRoomKey,
    leaveRoom,
    endRoom,
    hasKey: hasKey || Boolean(roomKeyRef.current),
    myPublicKey: keyPairRef.current?.publicKey,
  };
}
