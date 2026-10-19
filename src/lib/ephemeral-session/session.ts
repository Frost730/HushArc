
export interface RoomInvitationParams {
  roomId: string;
  accessSecret: string;
  encryptionKey: string;
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
  if (!hash) {
    return { accessSecret: null, encryptionKey: null };
  }

  const params = new URLSearchParams(hash);
  const accessSecret = params.get('access');
  const encryptionKey = params.get('key');

  // CRITICAL PRIVACY ACTION: Immediately erase the fragment from URL history
  try {
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', cleanUrl);
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
