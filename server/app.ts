import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { EphemeralRoomManager } from './room-manager.js';
import { CreateRoomRequestSchema } from './validation.js';
import { securityHeadersMiddleware, expressRateLimit } from './security.js';

export function createApp(roomManager: EphemeralRoomManager): express.Express {
  const app = express();

  // Basic security and parsing middlewares
  app.use(securityHeadersMiddleware);
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '32kb' }));

  // Strict Health Check endpoint - per requirements, never exposes keys, room IDs, or counts
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'husharc',
      uptime: Math.floor(process.uptime()),
      timestamp: Date.now(),
    });
  });

  // Ephemeral Room Creation endpoint
  app.post('/api/rooms/create', expressRateLimit, (req, res) => {
    const parseResult = CreateRoomRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid room creation request',
        details: parseResult.error.errors,
      });
      return;
    }

    const { maxParticipants, isDirect } = parseResult.data;
    const { roomId, accessSecret, shortCode } = roomManager.createRoom({
      maxParticipants,
      isDirect,
    });

    // Return the room ID, access secret, and easy-to-type shortCode.
    // NOTE: The client independently generates the E2E encryption key locally in the browser!
    res.status(201).json({
      roomId,
      accessSecret,
      shortCode,
      maxParticipants,
      isDirect,
      expiresInMinutes: 60,
    });
  });

  // Resolve easy-to-type short code to roomId and accessSecret
  app.get('/api/rooms/resolve/:code', expressRateLimit, (req, res) => {
    const code = req.params.code;
    const resolved = roomManager.resolveShortCode(code);
    if (!resolved) {
      res.status(404).json({ error: 'Room not found or has expired.' });
      return;
    }
    res.status(200).json(resolved);
  });

  // Serve static assets in production
  const distPath = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(distPath)) {
    // Serve static files
    app.use(express.static(distPath, {
      maxAge: '1h',
      index: false,
    }));

    // SPA fallback route
    app.get('*', (req, res, next) => {
      // Don't intercept API or WebSocket paths
      if (req.path.startsWith('/api') || req.path.startsWith('/ws') || req.path.startsWith('/health')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}
