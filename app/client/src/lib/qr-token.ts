/**
 * QR Token Utility - Generates and validates rotating QR tokens
 * Uses Web Crypto API for HMAC-SHA256 token generation
 */

/**
 * Generate a random secret string for HMAC signing
 */
export function generateSecret(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute HMAC-SHA256 of a message using a secret key
 */
async function hmacSHA256(message: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, msgData);
  const hashArray = Array.from(new Uint8Array(signature));
  // Return first 16 hex chars for a shorter token (still 64 bits of security)
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

export interface QRTokenPayload {
  sessionId: string;
  ts: number;
  token: string;
  // Keep original session data for backwards compat
  name?: string;
  date?: string;
  time?: string;
  duration?: number;
}

/**
 * Generate a rotating QR token
 * @param sessionId - The session UUID
 * @param secret - The session secret for HMAC signing
 * @param extraData - Optional extra data to include in the QR payload
 * @returns JSON string to encode in QR code
 */
export async function generateQRToken(
  sessionId: string,
  secret: string,
  extraData?: Record<string, any>
): Promise<string> {
  const ts = Date.now();
  const message = `${sessionId}:${ts}`;
  const token = await hmacSHA256(message, secret);

  const payload: QRTokenPayload = {
    sessionId,
    ts,
    token,
    ...extraData,
  };

  return JSON.stringify(payload);
}

/**
 * Validate a rotating QR token
 * @param payloadStr - JSON string from QR code
 * @param secret - The session secret for HMAC validation
 * @param maxAgeMs - Maximum token age in milliseconds (default: 10000ms = 10s)
 * @returns Object with validation result
 */
export async function validateQRToken(
  payloadStr: string,
  secret: string,
  maxAgeMs: number = 10000
): Promise<{
  valid: boolean;
  sessionId?: string;
  error?: string;
  payload?: QRTokenPayload;
}> {
  try {
    const payload: QRTokenPayload = JSON.parse(payloadStr);

    if (!payload.sessionId || !payload.ts || !payload.token) {
      return { valid: false, error: 'Invalid QR format: missing required fields' };
    }

    // Check timestamp freshness
    const age = Math.abs(Date.now() - payload.ts);
    if (age > maxAgeMs) {
      const secondsAgo = Math.round(age / 1000);
      return {
        valid: false,
        sessionId: payload.sessionId,
        error: `QR code expired (${secondsAgo}s old). Please scan the current code.`,
      };
    }

    // Verify HMAC token
    const message = `${payload.sessionId}:${payload.ts}`;
    const expectedToken = await hmacSHA256(message, secret);

    if (payload.token !== expectedToken) {
      return {
        valid: false,
        sessionId: payload.sessionId,
        error: 'Invalid QR code token. This code may have been tampered with.',
      };
    }

    return {
      valid: true,
      sessionId: payload.sessionId,
      payload,
    };
  } catch (e) {
    return { valid: false, error: 'Failed to parse QR code data' };
  }
}
