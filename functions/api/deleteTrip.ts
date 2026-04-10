import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import { revokeSharesForTrip } from '../_lib/share';

type TripRow = {
  id: string;
  user_id: string;
};

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}) {
  const { request, env } = context;

  const user = await requireUser(context);
  if (!user) {
    return error('Unauthorized.', 401);
  }

  let body: { id?: string; tripId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const tripId = String(body.id || body.tripId || '').trim();
  if (!tripId) {
    return error('Trip id is required.', 400);
  }

  const trip = await env.DB
    .prepare(`
      SELECT id, user_id
      FROM trips
      WHERE id = ?
      LIMIT 1
    `)
    .bind(tripId)
    .first<TripRow>();

  if (!trip) {
    return error('Trip not found.', 404);
  }

  if (trip.user_id !== user.id) {
    return error('Forbidden.', 403);
  }

  try {
    await revokeSharesForTrip({ env, tripId });

    await env.DB
      .prepare(`
        DELETE FROM trips
        WHERE id = ? AND user_id = ?
      `)
      .bind(tripId, user.id)
      .run();

    return json({
      ok: true
    });
  } catch (err) {
    console.error('deleteTrip error:', err);
    return error('Failed to delete trip.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }
  return onRequestPost(context);
}
