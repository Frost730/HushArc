import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

// Constant-time token verification
export function hashAccessSecret(secret: string): string {
  return crypto.createHash('sha256').update(secret, 'utf8').digest('hex');
}

export function verifyAccessSecret(providedSecret: string, storedHash: string): boolean {
  const providedHash = hashAccessSecret(providedSecret);
  const bufA = Buffer.from(providedHash, 'hex');
  const bufB = Buffer.from(storedHash, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// Generate cryptographically secure random token (URL-safe base64url or hex)
export function generateSecureToken(byteLength = 32): string {
  return crypto.randomBytes(byteLength).toString('base64url');
}

// In-memory sliding window rate limiter
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export class EphemeralRateLimiter {
  private limits = new Map<string, RateLimitEntry>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(windowMs = 60_000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Prune stale entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.limits.entries()) {
        if (entry.resetAt <= now) {
          this.limits.delete(key);
        }
      }
    }, 300_000).unref();
  }

  public isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.limits.get(key);

    if (!entry || entry.resetAt <= now) {
      this.limits.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      return false;
    }

    entry.count += 1;
    return true;
  }
}

// Global IP limiter for REST API endpoints
const apiLimiter = new EphemeralRateLimiter(60_000, 30); // 30 requests per minute

export function expressRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  if (!apiLimiter.isAllowed(ip)) {
    res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
    return;
  }
  next();
}

// Security headers middleware
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  // Prevent any URL referrer leakage (crucial so invitation fragments or paths are never leaked to external sites)
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // Content Security Policy: strictly self-hosted, no third-party CDNs, fonts, or scripts
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self' ws: wss:; frame-ancestors 'none'; base-uri 'self'; form-action 'self';"
  );

  next();
}
