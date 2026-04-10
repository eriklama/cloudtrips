import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  let user: { id: string; email?: string };
  try {
    user = await requireUser(context);
  } catch (err) {
    console.warn('Auth failed (disableShare):', err);
    return error('Unauthorized.', 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const tripId = String(body?.tripId || '').trim();
  if (!tripId) {
    return error('tripId is required.', 400);
  }

  try {
    const trip = await env.DB
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

    await env.DB
      .prepare(`
        UPDATE trip_shares
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE trip_id = ?
          AND revoked_at IS NULL
      `)
      .bind(tripId)
      .run();

    return json({ ok: true });
  } catch (err) {
    console.error('disableShare error:', err);
    return error('Failed to disable sharing.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }
  return onRequestPost(context);
}
