import crypto from 'crypto';
import { ISession, ClassSession } from '../models/Session';

/**
 * TOTP-style rotating tokens for attendance sessions.
 *
 * Rationale: a static code can be screenshotted and forwarded on WhatsApp,
 * letting an absent student mark themselves in. By deriving the displayed
 * QR / code from HMAC(secret, timeBucket), the value a friend forwards stops
 * working within seconds. The server accepts the current bucket OR the
 * previous one to tolerate clock skew + network latency.
 */

export const QR_BUCKET_MS = 15_000; // QR rotates every 15 seconds
export const CODE_BUCKET_MS = 30_000; // short code rotates every 30 seconds

// Crockford-ish base32: no I/O/0/1 to avoid look-alike characters when typing.
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;

function bucket(now: number, sizeMs: number): number {
  return Math.floor(now / sizeMs);
}

function bucketEnd(bucketIndex: number, sizeMs: number): Date {
  return new Date((bucketIndex + 1) * sizeMs);
}

function hmac(secret: string, label: string, bucketIndex: number): Buffer {
  return crypto.createHmac('sha256', Buffer.from(secret, 'hex'))
    .update(`${label}:${bucketIndex}`)
    .digest();
}

/** Constant-time string compare so we don't leak match info via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/* --- QR token ----------------------------------------------------------- */
// Format: <sessionId>.<bucket>.<12 hex chars of HMAC>
// The session ID lets us look up the session in O(1) instead of scanning.

function qrSig(session: ISession, bucketIndex: number): string {
  return hmac(session.secret, 'qr', bucketIndex).toString('hex').slice(0, 12);
}

export function currentQrToken(session: ISession, now = Date.now()): {
  token: string;
  rotatesAt: Date;
} {
  const b = bucket(now, QR_BUCKET_MS);
  return {
    token: `${session._id.toString()}.${b}.${qrSig(session, b)}`,
    rotatesAt: bucketEnd(b, QR_BUCKET_MS),
  };
}

/** Returns the session referenced by a QR token, or null if invalid/expired. */
export async function resolveQrToken(token: string, now = Date.now()): Promise<ISession | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [sessionId, bucketStr, sig] = parts;
  const submittedBucket = Number(bucketStr);
  if (!Number.isFinite(submittedBucket)) return null;

  const currentBucket = bucket(now, QR_BUCKET_MS);
  // Accept current bucket and previous bucket (15s grace).
  if (submittedBucket !== currentBucket && submittedBucket !== currentBucket - 1) {
    return null;
  }

  const session = await ClassSession.findById(sessionId);
  if (!session || session.closedAt) return null;

  const expected = qrSig(session, submittedBucket);
  if (!safeEqual(sig, expected)) return null;
  return session;
}

/* --- Short code --------------------------------------------------------- */
// Format: 6-char alphanumeric, derived from HMAC.
// No session ID is embedded (it would make the code too long), so the server
// scans active sessions to find the match. With a handful of active sessions
// this is effectively free.

export function currentCode(session: ISession, now = Date.now()): {
  value: string;
  rotatesAt: Date;
} {
  const b = bucket(now, CODE_BUCKET_MS);
  return { value: codeFor(session, b), rotatesAt: bucketEnd(b, CODE_BUCKET_MS) };
}

function codeFor(session: ISession, bucketIndex: number): string {
  const h = hmac(session.secret, 'code', bucketIndex);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[h[i] % CODE_ALPHABET.length];
  }
  return out;
}

export function isValidCodeShape(input: string): boolean {
  return /^[A-Z0-9]{6}$/.test(input);
}

/** Finds the active session whose current (or previous) bucket code matches. */
export async function resolveCode(input: string, now = Date.now()): Promise<ISession | null> {
  const normalized = input.trim().toUpperCase();
  if (!isValidCodeShape(normalized)) return null;

  const currentBucket = bucket(now, CODE_BUCKET_MS);
  const buckets = [currentBucket, currentBucket - 1];

  // Only scan active sessions; closed ones can't be marked into anyway.
  const active = await ClassSession.find({ closedAt: { $exists: false } });
  for (const session of active) {
    for (const b of buckets) {
      if (safeEqual(normalized, codeFor(session, b))) return session;
    }
  }
  return null;
}

/* --- Helpers ------------------------------------------------------------ */

export function newSessionSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
