import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import { createTripShare } from '../_lib/share';

type TripRow = {
  id: string;
  user_id: string;
  name: string;
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

  let body: { tripId?: string; expiresInDays?: number } = {};
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const tripId = String(body.tripId || '').trim();
  if (!tripId) {
    return error('tripId is required.', 400);
  }

  const trip = await env.DB
    .prepare(`
      SELECT id, user_id, name
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

  let expiresAt: Date | null = null;
  const requestedDays = Number(body.expiresInDays);

  if (Number.isFinite(requestedDays) && requestedDays > 0) {
    const boundedDays = Math.min(Math.max(Math.floor(requestedDays), 1), 365);
    expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + boundedDays);
  } else {
    expiresAt = new Date();
    expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
  }

  try {
    const share = await createTripShare({
      env,
      tripId,
      userId: user.id,
      expiresAt
    });

    const shareUrl = `/trip.html?id=${encodeURIComponent(tripId)}&token=${encodeURIComponent(share.token)}`;

    return json({
      ok: true,
      shareUrl,
      expiresAt: share.expiresAt
    });
  } catch (err) {
    console.error('shareTrip error:', err);
    return error('Failed to create share link.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }
  return onRequestPost(context);
}
