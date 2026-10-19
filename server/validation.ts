import { z } from 'zod';

export const CreateRoomRequestSchema = z.object({
  maxParticipants: z.number().int().min(2).max(50).default(10),
  isDirect: z.boolean().default(false),
});

export const JoinEventSchema = z.object({
  type: z.literal('join'),
  roomId: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  participantId: z.string().min(8).max(64).regex(/^[a-zA-Z0-9_-]+$/),
  nickname: z.string().min(1).max(32).transform(s => s.trim()),
  publicKey: z.string().min(20).max(128),
  accessSecret: z.string().min(16).max(128),
});

export const EncryptedMessageEventSchema = z.object({
  type: z.literal('encrypted_message'),
  roomId: z.string().min(8).max(64),
  messageId: z.string().min(4).max(64),
  epoch: z.number().int().min(1),
  nonce: z.string().min(16).max(64),
  ciphertext: z.string().min(1).max(65536), // Max 64KB per encrypted payload
  replyToId: z.string().min(4).max(64).optional(),
});

export const ReactionEventSchema = z.object({
  type: z.literal('reaction'),
  roomId: z.string().min(8).max(64),
  messageId: z.string().min(4).max(64),
  epoch: z.number().int().min(1),
  nonce: z.string().min(16).max(64),
  ciphertext: z.string().min(1).max(1024), // Max 1KB for encrypted reaction
});

export const TypingEventSchema = z.object({
  type: z.literal('typing'),
  roomId: z.string().min(8).max(64),
  isTyping: z.boolean(),
});

export const KeyRotationEpochEventSchema = z.object({
  type: z.literal('key_rotation_epoch'),
  roomId: z.string().min(8).max(64),
  newEpoch: z.number().int().min(1),
  encryptedKeys: z.record(
    z.string().min(8).max(64),
    z.object({
      nonce: z.string().max(64).optional().default(''),
      ciphertext: z.string().min(1).max(2048),
    })
  ),
});

export const AttachmentChunkEventSchema = z.object({
  type: z.literal('attachment_chunk'),
  roomId: z.string().min(8).max(64),
  attachmentId: z.string().min(4).max(64),
  fileName: z.string().min(1).max(100),
  fileType: z.string().min(1).max(64),
  fileSize: z.number().int().min(1).max(5 * 1024 * 1024), // Max 5MB
  chunkIndex: z.number().int().min(0),
  totalChunks: z.number().int().min(1).max(250),
  epoch: z.number().int().min(1),
  nonce: z.string().min(16).max(64),
  ciphertext: z.string().min(1).max(65536),
});

export const LeaveEventSchema = z.object({
  type: z.literal('leave'),
  roomId: z.string().min(8).max(64),
});

export const EndRoomEventSchema = z.object({
  type: z.literal('end_room'),
  roomId: z.string().min(8).max(64),
});

export const PingEventSchema = z.object({
  type: z.literal('ping'),
});

export const ClientEventSchema = z.discriminatedUnion('type', [
  JoinEventSchema,
  EncryptedMessageEventSchema,
  ReactionEventSchema,
  TypingEventSchema,
  KeyRotationEpochEventSchema,
  AttachmentChunkEventSchema,
  LeaveEventSchema,
  EndRoomEventSchema,
  PingEventSchema,
]);
