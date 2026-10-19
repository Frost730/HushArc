import http from 'http';
import { createApp } from './app.js';
import { EphemeralRoomManager } from './room-manager.js';
import { setupWebSocket } from './websocket.js';

const PORT = parseInt(process.env.PORT || '10000', 10);
const HOST = '0.0.0.0';

const roomManager = new EphemeralRoomManager(60); // 60 minutes room idle timeout
const app = createApp(roomManager);
const server = http.createServer(app);

// Attach WebSocket server sharing same origin and port
const wss = setupWebSocket(server, roomManager);

server.listen(PORT, HOST, () => {
  console.log(`[HushArc] Ephemeral secure server listening on http://${HOST}:${PORT}`);
  console.log(`[HushArc] WebSocket endpoint ready at ws://${HOST}:${PORT}/ws`);
  console.log(`[HushArc] Strict Ephemeral Policy Active: Zero disk or database persistence.`);
});

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n[HushArc] Received ${signal}. Initiating graceful shutdown...`);

  // Wipe all active rooms and inform clients
  roomManager.shutdown();

  wss.close(() => {
    console.log('[HushArc] WebSocket server closed.');
  });

  server.close(() => {
    console.log('[HushArc] HTTP server closed cleanly. Exiting process.');
    process.exit(0);
  });

  // Force exit if not closed within 5 seconds
  setTimeout(() => {
    console.error('[HushArc] Forced termination after timeout.');
    process.exit(1);
  }, 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
