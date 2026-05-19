import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import { canAccessTrip } from '../_lib/members';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  let user: { id: string };
  try {
    user = await requireUser(context);
  } catch {
    return error('Unauthorized.', 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const tripId = String(body?.tripId || '').trim();
  if (!tripId) return error('tripId is required.', 400);

  // Verify trip ownership OR membership
  const { access } = await canAccessTrip(env, tripId, user.id);
  if (!access) return error('Trip not found.', 404);

  const a = body?.activity;
  if (!a) return error('activity is required.', 400);

  const id = String(a.id || crypto.randomUUID()).trim();
  const type = String(a.type || 'other').trim() || 'other';
  const name = String(a.name || '').trim();
  const location = String(a.location || '').trim();
  const startDate = String(a.startDate || '').trim();
  const endDate = String(a.endDate || '').trim();
  const cost = Number(a.cost ?? 0);
  const currency = String(a.currency || 'EUR').toUpperCase();
  const distance = Number(a.distance ?? a.km ?? 0);
  const notes = String(a.notes || '').trim();
  const sortOrder = Number(a.sortOrder ?? 0);

  try {
    await env.DB
      .prepare(`
        INSERT INTO activities
          (id, trip_id, user_id, type, name, location,
           start_date, end_date, cost, currency, distance,
           notes, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type       = excluded.type,
          name       = excluded.name,
          location   = excluded.location,
          start_date = excluded.start_date,
          end_date   = excluded.end_date,
          cost       = excluded.cost,
          currency   = excluded.currency,
          distance   = excluded.distance,
          notes      = excluded.notes,
          sort_order = excluded.sort_order
      `)
      .bind(
        id, tripId, user.id,
        type, name, location,
        startDate, endDate,
        cost, currency, distance,
        notes, sortOrder
      )
      .run();

    return json({ ok: true, activity: { id, type, name, location, startDate, endDate, cost, currency, distance, notes, sortOrder } });
  } catch (err) {
    console.error('DB error (upsertActivity):', err);
    return error('Failed to save activity.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}
