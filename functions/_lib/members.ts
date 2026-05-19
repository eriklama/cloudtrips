import type { Env } from './auth';

/**
 * Check if a user is the owner of a trip.
 */
export async function isTripOwner(env: Env, tripId: string, userId: string): Promise<boolean> {
  const row = await env.DB
    .prepare(`SELECT id FROM trips WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(tripId, userId)
    .first<{ id: string }>();
  return Boolean(row);
}

/**
 * Check if a user is a member (editor) of a trip.
 */
export async function isTripMember(env: Env, tripId: string, userId: string): Promise<boolean> {
  const row = await env.DB
    .prepare(`SELECT id FROM trip_members WHERE trip_id = ? AND user_id = ? LIMIT 1`)
    .bind(tripId, userId)
    .first<{ id: string }>();
  return Boolean(row);
}

/**
 * Check if a user can access a trip (owner or member).
 */
export async function canAccessTrip(env: Env, tripId: string, userId: string): Promise<{ access: boolean; isOwner: boolean }> {
  const [owner, member] = await Promise.all([
    isTripOwner(env, tripId, userId),
    isTripMember(env, tripId, userId)
  ]);
  return { access: owner || member, isOwner: owner };
}

/**
 * Hash an invite token for storage (SHA-256, hex).
 */
export async function hashInviteToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate a random URL-safe token.
 */
export function generateInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
