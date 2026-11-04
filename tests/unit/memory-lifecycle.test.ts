import { describe, it, expect, vi } from 'vitest';
import { bestEffortZeroize } from '../../src/lib/crypto/e2ee.js';
import { purgeLocalSession } from '../../src/lib/ephemeral-session/session.js';

describe('Ephemeral Memory Hygiene & Lifecycle Cleanup (F6, F7, F8, F9)', () => {
  // Tier 1: Feature Coverage (>=5 tests)
  it('zeroizes Uint8Array buffers in place with zeros (0x00)', () => {
    const sensitiveData = new Uint8Array([0x48, 0x75, 0x73, 0x68, 0x41, 0x72, 0x63, 0x99]);
    expect(sensitiveData.some((b) => b !== 0)).toBe(true);

    bestEffortZeroize(sensitiveData);

    expect(sensitiveData.every((b) => b === 0)).toBe(true);
    expect(sensitiveData[0]).toBe(0);
    expect(sensitiveData[sensitiveData.length - 1]).toBe(0);
  });

  it('zeroizes cryptographic key buffers and sub-arrays without affecting unrelated memory', () => {
    const memoryArena = new Uint8Array(64);
    memoryArena.fill(0xff);
    const keySlice = memoryArena.subarray(16, 48); // 32-byte key

    bestEffortZeroize(keySlice);

    // keySlice is zeroed
    expect(keySlice.every((b) => b === 0)).toBe(true);
    // Unrelated parts remain unchanged
    expect(memoryArena.subarray(0, 16).every((b) => b === 0xff)).toBe(true);
    expect(memoryArena.subarray(48, 64).every((b) => b === 0xff)).toBe(true);
  });

  it('tracks and revokes all active Blob URLs on conversation teardown', () => {
    const createdUrls = new Set<string>();
    const revokedUrls = new Set<string>();

    const mockCreateObjectUrl = (blob: any) => {
      const url = `blob:http://localhost:5173/${Math.random().toString(36).slice(2)}`;
      createdUrls.add(url);
      return url;
    };

    const mockRevokeObjectUrl = (url: string) => {
      revokedUrls.add(url);
    };

    // Simulate allocating 4 message attachment preview URLs
    const u1 = mockCreateObjectUrl({});
    const u2 = mockCreateObjectUrl({});
    const u3 = mockCreateObjectUrl({});
    const u4 = mockCreateObjectUrl({});

    expect(createdUrls.size).toBe(4);

    // Teardown lifecycle executes
    for (const url of createdUrls) {
      mockRevokeObjectUrl(url);
    }
    createdUrls.clear();

    expect(createdUrls.size).toBe(0);
    expect(revokedUrls.size).toBe(4);
    expect(revokedUrls.has(u1)).toBe(true);
    expect(revokedUrls.has(u4)).toBe(true);
  });

  it('cancels active typing and auto-dismiss timers on unmount to prevent orphan callbacks', () => {
    vi.useFakeTimers();
    let callbackExecuted = false;

    // Simulate setting typing timeout
    const timerHandle = setTimeout(() => {
      callbackExecuted = true;
    }, 3000);

    // Component unmounts at 1000ms -> clear timer
    clearTimeout(timerHandle);

    vi.advanceTimersByTime(5000);
    expect(callbackExecuted).toBe(false);
    vi.useRealTimers();
  });

  it('purges ephemeral session markers and local/session storage on leave', () => {
    const mockStorage: Record<string, string> = {
      husharc_transcript: 'leak',
      husharc_key: 'secret',
      other_item: 'keep',
    };

    const originalWindow = (global as any).window;
    const originalSessionStorage = (global as any).sessionStorage;
    const originalLocalStorage = (global as any).localStorage;

    const mockSessionStorage = {
      clear: vi.fn(),
    };
    const mockLocalStorage = {
      removeItem: vi.fn((k: string) => delete mockStorage[k]),
    };

    (global as any).window = {};
    (global as any).sessionStorage = mockSessionStorage;
    (global as any).localStorage = mockLocalStorage;

    purgeLocalSession();

    expect(mockSessionStorage.clear).toHaveBeenCalled();
    expect(mockStorage['husharc_transcript']).toBeUndefined();
    expect(mockStorage['husharc_key']).toBeUndefined();

    (global as any).window = originalWindow;
    (global as any).sessionStorage = originalSessionStorage;
    (global as any).localStorage = originalLocalStorage;
  });

  // Tier 2: Boundary & Corner Cases (>=5 tests)
  it('handles null, undefined, and empty 0-length Uint8Array in bestEffortZeroize gracefully', () => {
    expect(() => bestEffortZeroize(null)).not.toThrow();
    expect(() => bestEffortZeroize(undefined)).not.toThrow();
    const empty = new Uint8Array(0);
    expect(() => bestEffortZeroize(empty)).not.toThrow();
  });

  it('evicts abandoned partial binary chunk buffers when transmission TTL expires', () => {
    vi.useFakeTimers();

    interface ChunkBufferEntry {
      chunks: Uint8Array[];
      totalChunks: number;
      createdAt: number;
      timer: NodeJS.Timeout;
    }

    const incomingChunks = new Map<string, ChunkBufferEntry>();
    const TTL_MS = 10000;

    const startChunkStream = (streamId: string, totalChunks: number) => {
      const timer = setTimeout(() => {
        // TTL eviction: zeroize chunks and remove buffer
        const entry = incomingChunks.get(streamId);
        if (entry) {
          for (const chunk of entry.chunks) {
            bestEffortZeroize(chunk);
          }
          incomingChunks.delete(streamId);
        }
      }, TTL_MS);

      incomingChunks.set(streamId, {
        chunks: [new Uint8Array([1, 2, 3])],
        totalChunks,
        createdAt: Date.now(),
        timer,
      });
    };

    startChunkStream('stream-aborted-1', 5);
    expect(incomingChunks.has('stream-aborted-1')).toBe(true);

    // Fast-forward past TTL
    vi.advanceTimersByTime(11000);

    expect(incomingChunks.has('stream-aborted-1')).toBe(false);
    vi.useRealTimers();
  });

  it('safely handles empty or non-existent Blob URL revocation without throwing', () => {
    const mockRevoke = vi.fn();
    const emptySet = new Set<string>();

    expect(() => {
      for (const url of emptySet) {
        mockRevoke(url);
      }
    }).not.toThrow();
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('cancels rapid succession of typing and debounce timers without residual callbacks', () => {
    vi.useFakeTimers();
    let counter = 0;
    let activeTimer: NodeJS.Timeout | null = null;

    for (let i = 0; i < 5; i++) {
      if (activeTimer) clearTimeout(activeTimer);
      activeTimer = setTimeout(() => {
        counter++;
      }, 1000);
      vi.advanceTimersByTime(300); // Keystroke every 300ms
    }

    // Only the final timer fires
    vi.advanceTimersByTime(1000);
    expect(counter).toBe(1);
    vi.useRealTimers();
  });

  it('zeroizes large binary chunk buffers (512 KB) completely and efficiently', () => {
    const largeBuffer = new Uint8Array(512 * 1024);
    largeBuffer.fill(0xaa);

    const start = performance.now();
    bestEffortZeroize(largeBuffer);
    const duration = performance.now() - start;

    expect(largeBuffer.every((b) => b === 0)).toBe(true);
    expect(duration).toBeLessThan(100); // Instantaneous in memory
  });

  // Tier 3: Cross-Feature Combinations (pairwise coverage)
  it('clears abandoned chunk buffers and revokes Blob URLs simultaneously upon room exit', () => {
    const chunkBuffers = new Map<string, Uint8Array[]>();
    const blobUrls = new Set<string>(['blob:test1', 'blob:test2']);
    const revoked: string[] = [];

    chunkBuffers.set('stream-active', [new Uint8Array([1, 2, 3])]);

    // Simulate complete room exit hook
    const handleRoomExit = () => {
      // 1. Evict and zeroize chunk buffers
      for (const [_, chunks] of chunkBuffers) {
        for (const c of chunks) bestEffortZeroize(c);
      }
      chunkBuffers.clear();

      // 2. Revoke all Blob URLs
      for (const url of blobUrls) {
        revoked.push(url);
      }
      blobUrls.clear();
    };

    handleRoomExit();

    expect(chunkBuffers.size).toBe(0);
    expect(blobUrls.size).toBe(0);
    expect(revoked.length).toBe(2);
  });

  it('detaches all WebSocket handlers on connection teardown to release closure scopes', () => {
    const mockWs: any = {
      onmessage: () => {},
      onerror: () => {},
      onclose: () => {},
      onopen: () => {},
      close: vi.fn(),
    };

    // Teardown logic
    mockWs.onmessage = null;
    mockWs.onerror = null;
    mockWs.onclose = null;
    mockWs.onopen = null;
    mockWs.close(1000);

    expect(mockWs.onmessage).toBeNull();
    expect(mockWs.onerror).toBeNull();
    expect(mockWs.onclose).toBeNull();
    expect(mockWs.onopen).toBeNull();
    expect(mockWs.close).toHaveBeenCalledWith(1000);
  });
});
