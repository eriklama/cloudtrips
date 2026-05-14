import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

type ShareRow = {
  id: string;
  mode: string | null;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
};

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}) {
  const { request, env } = context;

  const user = await requireUser(context);

  const url = new URL(request.url);
  const tripId = url.searchParams.get('tripId') || '';

  if (!tripId) {
    return error('tripId is required.', 400);
  }

  // Verify ownership
  const trip = await env.DB
    .prepare(`SELECT id FROM trips WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(tripId, user.id)
    .first<{ id: string }>();

  if (!trip) {
    return error('Trip not found.', 404);
  }

  const shares = await env.DB
    .prepare(`
      SELECT id, mode, created_at, expires_at, last_used_at
      FROM trip_shares
      WHERE trip_id = ?
        AND revoked_at IS NULL
      ORDER BY created_at DESC
    `)
    .bind(tripId)
    .all<ShareRow>();

  return json({
    ok: true,
    shares: shares.results ?? []
  });
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }
  return onRequestGet(context);
}
