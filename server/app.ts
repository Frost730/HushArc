import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { EphemeralRoomManager } from './room-manager.js';
import { CreateRoomRequestSchema } from './validation.js';
import { securityHeadersMiddleware, expressRateLimit, resolveCodeRateLimit } from './security.js';

export function createApp(roomManager: EphemeralRoomManager): express.Express {
  const app = express();

  // Trust first proxy (Render, Nginx, Cloudflare) for accurate client IP resolution
  app.set('trust proxy', 1);

  // Security headers
  app.use(securityHeadersMiddleware);

  // Restrictive CORS: only allow same-origin, localhost, and configured or deploy domains
  app.use(
    cors({
      origin: (origin, callback) => {
        // Requests with no origin (e.g., same-origin navigation, curl, server-to-server)
        if (!origin) return callback(null, true);

        try {
          const parsed = new URL(origin);
          const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
          const isRender = parsed.hostname.endsWith('.onrender.com');
          const isCustomAllowed = process.env.ALLOWED_ORIGIN && origin === process.env.ALLOWED_ORIGIN;

          if (isLocalhost || isRender || isCustomAllowed) {
            return callback(null, true);
          }
          return callback(new Error('Cross-origin request blocked by security policy.'));
        } catch {
          return callback(new Error('Malformed Origin header.'));
        }
      },
      credentials: true,
    })
  );

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
    const created = roomManager.createRoom({
      maxParticipants,
      isDirect,
    });

    if (!created) {
      res.status(503).json({
        error: 'Server is currently at maximum ephemeral room capacity. Please try again in a few minutes.',
      });
      return;
    }

    const { roomId, accessSecret, shortCode } = created;

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
  // Protected with dedicated strict rate limiting against enumeration
  app.get('/api/rooms/resolve/:code', resolveCodeRateLimit, (req, res) => {
    const code = req.params.code;
    if (!code || !/^[0-9A-Za-z-]{3,9}$/.test(code)) {
      res.status(400).json({ error: 'Invalid room code format.' });
      return;
    }

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
    app.use(
      express.static(distPath, {
        maxAge: '1h',
        index: false,
      })
    );

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
