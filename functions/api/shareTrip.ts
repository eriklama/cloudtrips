import type { PagesFunction } from '@cloudflare/workers-types';
import { requireUser } from '../_lib/auth';
import { json, badRequest, methodNotAllowed, unauthorized, serverError } from '../_lib/http';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  PASSWORD_PEPPER?: string;
}

function generateSecureToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  try {
    const user = await requireUser(context);
    if (!user?.id) {
      return unauthorized('Authentication required');
    }

    let body: any;
    try {
      body = await context.request.json();
    } catch {
      return badRequest('Invalid JSON body');
    }

    const tripId = String(body?.tripId || '').trim();
    if (!tripId) {
      return badRequest('tripId is required');
    }

    // Confirm the trip belongs to the authenticated user
    const ownedTrip = await context.env.DB
      .prepare(`
        SELECT id
        FROM trips
        WHERE id = ? AND user_id = ?
        LIMIT 1
      `)
      .bind(tripId, user.id)
      .first<{ id: string }>();

    if (!ownedTrip) {
      return unauthorized('Trip not found or access denied');
    }

    // Revoke any previous active share tokens for this trip
    await context.env.DB
      .prepare(`
        UPDATE trip_share_tokens
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE trip_id = ?
          AND revoked_at IS NULL
      `)
      .bind(tripId)
      .run();

    const token = generateSecureToken();

    // Optional: set expiry here if you want expiring links
    const expiresAt = null; // e.g. new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString()

    await context.env.DB
      .prepare(`
        INSERT INTO trip_share_tokens (
          trip_id,
          token,
          created_by_user_id,
          expires_at
        )
        VALUES (?, ?, ?, ?)
      `)
      .bind(tripId, token, user.id, expiresAt)
      .run();

    const shareUrl = `/trip.html?id=${encodeURIComponent(tripId)}&token=${encodeURIComponent(token)}`;

    return json({
      ok: true,
      shareUrl
    });
  } catch (err: any) {
    console.error('shareTrip error:', err);
    return serverError('Failed to create share link');
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return methodNotAllowed('Method not allowed');
  }
  return onRequestPost(context);
};
