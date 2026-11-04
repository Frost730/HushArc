import http from 'http';
import WebSocket from 'ws';
import { createApp } from '../../server/app.js';
import { EphemeralRoomManager } from '../../server/room-manager.js';
import { setupWebSocket } from '../../server/websocket.js';

export interface EphemeralTestServerInstance {
  server: http.Server;
  roomManager: EphemeralRoomManager;
  port: number;
  serverUrl: string;
  wsUrl: string;
  shutdown: () => Promise<void>;
  createRoom: (maxParticipants?: number) => Promise<{ roomId: string; accessSecret: string; shortCode: string }>;
}

/**
 * Creates and starts an isolated ephemeral HTTP & WebSocket server instance
 * bound to an OS-allocated dynamic port (port 0).
 */
export async function startEphemeralTestServer(
  maxParticipantsPerRoom: number = 10
): Promise<EphemeralTestServerInstance> {
  const roomManager = new EphemeralRoomManager(maxParticipantsPerRoom);
  const app = createApp(roomManager);
  const server = http.createServer(app);
  setupWebSocket(server, roomManager);

  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        return reject(new Error('Failed to bind server address'));
      }
      const port = address.port;
      const serverUrl = `http://127.0.0.1:${port}`;
      const wsUrl = `ws://127.0.0.1:${port}/ws`;

      const createRoom = async (maxParticipants: number = 5) => {
        const res = await fetch(`${serverUrl}/api/rooms/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ maxParticipants }),
        });
        if (!res.ok) {
          throw new Error(`Failed to create room: ${res.status} ${res.statusText}`);
        }
        return (await res.json()) as { roomId: string; accessSecret: string; shortCode: string };
      };

      const shutdown = async () => {
        roomManager.shutdown();
        await new Promise<void>((resClose) => server.close(() => resClose()));
      };

      resolve({
        server,
        roomManager,
        port,
        serverUrl,
        wsUrl,
        shutdown,
        createRoom,
      });
    });
  });
}

/**
 * Helper to wait for a specific WebSocket event matching a predicate.
 */
export function waitForWsEvent<T = any>(
  ws: WebSocket,
  predicate: (ev: any) => boolean,
  timeoutMs: number = 4000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timed out waiting for WebSocket event (${timeoutMs}ms)`));
    }, timeoutMs);

    const handler = (data: WebSocket.Data) => {
      try {
        const parsed = JSON.parse(data.toString());
        if (predicate(parsed)) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(parsed as T);
        }
      } catch (err) {
        // Ignore non-JSON messages or parse errors
      }
    };

    ws.on('message', handler);
  });
}
