import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

type ActivityInput = {
  id?: unknown;
  type?: unknown;
  name?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  cost?: unknown;
  currency?: unknown;
  notes?: unknown;
  location?: unknown;
  distance?: unknown;
  km?: unknown;
  sortOrder?: unknown;
};

function toString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : String(value ?? fallback);
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function sanitizeActivity(activity: ActivityInput) {
  return {
    id: toString(activity?.id || crypto.randomUUID()).trim(),
    type: toString(activity?.type || 'other').trim() || 'other',
    name: toString(activity?.name || '').trim(),
    location: toString(activity?.location || '').trim(),
    startDate: toString(activity?.startDate || '').trim(),
    endDate: toString(activity?.endDate || '').trim(),
    cost: toNumber(activity?.cost),
    currency: toString(activity?.currency || 'EUR').trim().toUpperCase() || 'EUR',
    notes: toString(activity?.notes || '').trim(),
    distance: toNumber(
      activity?.distance !== undefined ? activity.distance : activity?.km
    ),
    sortOrder: toNumber(activity?.sortOrder)
  };
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  let user: { id: string; email?: string };
  try {
    user = await requireUser(context);
  } catch (err) {
    console.warn('Auth failed (saveTrip):', err);
    return error('Unauthorized.', 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const id = String(body?.id || '').trim();
  const name = String(body?.name || '').trim();
  const notes = String(body?.notes || '').trim();

  if (!name) {
    return error('Trip name is required.', 400);
  }

  const rawActivities = Array.isArray(body?.activities) ? body.activities : [];
  const activities = rawActivities.map(sanitizeActivity);

  try {
    let tripId = id;

    if (tripId) {
      // Verify trip exists and belongs to user
      const existing = await env.DB
        .prepare(`SELECT id FROM trips WHERE id = ? AND user_id = ? LIMIT 1`)
        .bind(tripId, user.id)
        .first<{ id: string }>();

      if (!existing) {
        return error('Trip not found.', 404);
      }

      await env.DB
        .prepare(`UPDATE trips SET name = ?, notes = ? WHERE id = ? AND user_id = ?`)
        .bind(name, notes, tripId, user.id)
        .run();
    } else {
      // Create new trip
      tripId = crypto.randomUUID();
      await env.DB
        .prepare(`
          INSERT INTO trips (id, user_id, name, notes, created_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `)
        .bind(tripId, user.id, name, notes)
        .run();
    }

    // Replace all activities for this trip atomically:
    // delete existing rows, then bulk-insert the new set.
    await env.DB
      .prepare(`DELETE FROM activities WHERE trip_id = ? AND user_id = ?`)
      .bind(tripId, user.id)
      .run();

    if (activities.length > 0) {
      // D1 supports batch() for multiple statements in one round-trip
      const inserts = activities.map((a) =>
        env.DB.prepare(`
          INSERT INTO activities
            (id, trip_id, user_id, type, name, location,
             start_date, end_date, cost, currency, distance,
             notes, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          a.id, tripId, user.id,
          a.type, a.name, a.location,
          a.startDate, a.endDate,
          a.cost, a.currency, a.distance,
          a.notes, a.sortOrder
        )
      );

      await env.DB.batch(inserts);
    }

    return json({
      ok: true,
      trip: { id: tripId, name, notes, activities }
    });
  } catch (err) {
    console.error('DB error (saveTrip):', err);
    return error('Failed to save trip.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }
  return onRequestPost(context);
}
