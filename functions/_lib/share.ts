export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  PASSWORD_PEPPER?: string;
}

export interface ShareRecord {
  id: string;
  trip_id: string;
  token_hash: string;
  created_by_user_id: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  last_used_at: string | null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function generateShareToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(digest);

  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return hex;
}

export function makeId(): string {
  return crypto.randomUUID();
}

export function getShareTokenFromRequest(request: Request): string | null {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  return token && token.trim() ? token.trim() : null;
}

export function toIsoOrNull(date: Date | null): string | null {
  return date ? date.toISOString() : null;
}

export function getDefaultShareExpiry(days = 30): Date {
  const now = new Date();
  now.setUTCDate(now.getUTCDate() + days);
  return now;
}

export async function createTripShare(params: {
  env: Env;
  tripId: string;
  userId: string;
  expiresAt?: Date | null;
}): Promise<{ token: string; expiresAt: string | null }> {
  const { env, tripId, userId, expiresAt = getDefaultShareExpiry(30) } = params;

  const token = generateShareToken();
  const tokenHash = await sha256Hex(token);
  const id = makeId();
  const expiresAtIso = toIsoOrNull(expiresAt);

  await env.DB
    .prepare(`
      INSERT INTO trip_shares (
        id,
        trip_id,
        token_hash,
        created_by_user_id,
        expires_at
      )
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(id, tripId, tokenHash, userId, expiresAtIso)
    .run();

  return {
    token,
    expiresAt: expiresAtIso
  };
}

export async function findValidShareByToken(params: {
  env: Env;
  token: string;
}): Promise<ShareRecord | null> {
  const { env, token } = params;

  const tokenHash = await sha256Hex(token);

  const row = await env.DB
    .prepare(`
      SELECT
        id,
        trip_id,
        token_hash,
        created_by_user_id,
        created_at,
        expires_at,
        revoked_at,
        last_used_at
      FROM trip_shares
      WHERE token_hash = ?
      LIMIT 1
    `)
    .bind(tokenHash)
    .first<ShareRecord>();

  if (!row) return null;
  if (row.revoked_at) return null;

  if (row.expires_at) {
    const expiresAtMs = Date.parse(row.expires_at);
    if (Number.isFinite(expiresAtMs) && expiresAtMs < Date.now()) {
      return null;
    }
  }

  return row;
}

export async function touchShareUsage(params: {
  env: Env;
  shareId: string;
}): Promise<void> {
  const { env, shareId } = params;

  await env.DB
    .prepare(`
      UPDATE trip_shares
      SET last_used_at = ?
      WHERE id = ?
    `)
    .bind(new Date().toISOString(), shareId)
    .run();
}

export async function revokeSharesForTrip(params: {
  env: Env;
  tripId: string;
}): Promise<void> {
  const { env, tripId } = params;

  await env.DB
    .prepare(`
      UPDATE trip_shares
      SET revoked_at = COALESCE(revoked_at, ?)
      WHERE trip_id = ?
        AND revoked_at IS NULL
    `)
    .bind(new Date().toISOString(), tripId)
    .run();
}
