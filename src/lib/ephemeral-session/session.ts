export interface RoomInvitationParams {
  roomId: string;
  accessSecret: string;
  encryptionKey: string;
}

function toBase64Url(str: string): string {
  let base64: string;
  if (typeof Buffer !== 'undefined') {
    base64 = Buffer.from(str, 'utf-8').toString('base64');
  } else {
    base64 = btoa(str);
  }
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf-8');
  } else {
    return atob(base64);
  }
}

/**
 * Encodes room parameters into a portable, compact join code (e.g. HUSH-...)
 */
export function encodeRoomCode(params: RoomInvitationParams): string {
  const payload = `${params.roomId}:${params.accessSecret}:${params.encryptionKey}`;
  return `HUSH-${toBase64Url(payload)}`;
}

/**
 * Decodes a room join code into its components.
 */
export function decodeRoomCode(rawCode: string): RoomInvitationParams | null {
  try {
    let clean = rawCode.trim();
    if (clean.toUpperCase().startsWith('HUSH-')) {
      clean = clean.slice(5);
    }
    const decoded = fromBase64Url(clean);
    const parts = decoded.split(':');
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      return {
        roomId: parts[0],
        accessSecret: parts[1],
        encryptionKey: parts[2],
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Parses either a full invitation URL, a relative path, or a HUSH-... Room Code.
 */
export function parseInvitationInput(input: string): RoomInvitationParams | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Try decoding as room code
  const codeResult = decodeRoomCode(trimmed);
  if (codeResult) return codeResult;

  // 2. Try parsing as invitation URL
  try {
    let urlStr = trimmed;
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
      urlStr = 'https://dummy.local' + (urlStr.startsWith('/') ? '' : '/') + urlStr;
    }
    const parsedUrl = new URL(urlStr);
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean);
    let roomId = '';
    if (pathParts[0] === 'r' && pathParts[1]) {
      roomId = pathParts[1];
    } else if (pathParts[0] && pathParts[0] !== 'r') {
      roomId = pathParts[0];
    }

    const hashParams = new URLSearchParams(parsedUrl.hash.replace(/^#/, ''));
    let accessSecret = hashParams.get('access') || parsedUrl.searchParams.get('access') || '';
    let encryptionKey = hashParams.get('key') || parsedUrl.searchParams.get('key') || '';

    if (roomId && accessSecret && encryptionKey) {
      return { roomId, accessSecret, encryptionKey };
    }
  } catch {
    // Ignore URL parse error
  }

  return null;
}

/**
 * Extracts the room access secret and symmetric encryption key from the window.location.hash,
 * then IMMEDIATELY removes the fragment from the browser URL using window.history.replaceState
 * so that secrets are never saved in browser history, referrer headers, or leaked to third parties.
 */
export function extractAndCleanInvitationFragment(): {
  accessSecret: string | null;
  encryptionKey: string | null;
} {
  if (typeof window === 'undefined') {
    return { accessSecret: null, encryptionKey: null };
  }

  const hash = window.location.hash.replace(/^#/, '');
  const searchParams = new URLSearchParams(window.location.search);
  let accessSecret: string | null = null;
  let encryptionKey: string | null = null;

  if (hash) {
    const hashParams = new URLSearchParams(hash);
    accessSecret = hashParams.get('access');
    encryptionKey = hashParams.get('key');
  }

  // Fallback to search parameters if not found in hash
  if (!accessSecret) accessSecret = searchParams.get('access');
  if (!encryptionKey) encryptionKey = searchParams.get('key');

  // CRITICAL PRIVACY ACTION: Immediately erase fragment and sensitive search params from URL history
  try {
    window.history.replaceState(null, '', window.location.pathname);
  } catch {
    // Best-effort
  }

  return { accessSecret, encryptionKey };
}

/**
 * Builds a secure room invitation link with the encryption key strictly in the URL fragment.
 * Format: https://origin/r/:roomId#access=:accessSecret&key=:encryptionKey
 */
export function buildInvitationUrl(params: RoomInvitationParams): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://husharc.onrender.com';
  return `${origin}/r/${encodeURIComponent(params.roomId)}#access=${encodeURIComponent(params.accessSecret)}&key=${encodeURIComponent(params.encryptionKey)}`;
}

/**
 * Generates an evocative temporary nickname inspired by astronomical/radio signals
 * if the user doesn't specify one.
 */
export function generateRandomNickname(): string {
  const adjectives = [
    'Solar', 'Lunar', 'Echo', 'Silent', 'Orbital',
    'Radiant', 'Stellar', 'Cosmic', 'Shadow', 'Pulsar',
    'Zenith', 'Nebula', 'Astral', 'Aurora', 'Vesper'
  ];
  const nouns = [
    'Signal', 'Arc', 'Pulse', 'Wave', 'Orbit',
    'Beacon', 'Node', 'Relay', 'Transit', 'Vector',
    'Drift', 'Trace', 'Horizon', 'Flux', 'Ray'
  ];

  const adj = adjectives[Math.floor(Math.random() * adjectives.length)]!;
  const noun = nouns[Math.floor(Math.random() * nouns.length)]!;
  const num = Math.floor(10 + Math.random() * 90);
  return `${adj} ${noun} ${num}`;
}

/**
 * Zeroizes in-memory session variables and returns clean state.
 */
export function purgeLocalSession(): void {
  // Clear any accidental storage entries
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.clear();
      // Ensure no messages ever touched localStorage
      localStorage.removeItem('husharc_transcript');
      localStorage.removeItem('husharc_key');
    } catch {
      // Storage might be restricted
    }
  }
}
