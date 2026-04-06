import type { PagesFunction } from '@cloudflare/workers-types';
import { requireUser } from '../_lib/auth';
import { json, error, methodNotAllowed } from '../_lib/http';

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
      return error('Unauthorized.', 401);
    }

    let body: any;
    try {
      body = await context.request.json();
    } catch {
      return error('Invalid JSON body.', 400);
    }

    const tripId = String(body?.tripId || '').trim();
    if (!tripId) {
      return error('tripId is required.', 400);
    }

    const trip = await context.env.DB
      .prepare(`
        SELECT id
        FROM trips
        WHERE id = ? AND user_id = ?
        LIMIT 1
      `)
      .bind(tripId, user.id)
      .first<{ id: string }>();

    if (!trip) {
      return error('Trip not found.', 404);
    }

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
      .bind(tripId, token, user.id, null)
      .run();

    const shareUrl = `/trip.html?id=${encodeURIComponent(tripId)}&token=${encodeURIComponent(token)}`;

    return json({
      ok: true,
      shareUrl
    });
  } catch (err: any) {
    console.error('shareTrip error:', err);
    return error('Failed to create share link.', 500);
  }
};

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }
  return onRequestPost(context);
};
