import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

/**
 * POST /api/duplicateTrip
 * Body: { tripId }
 *
 * Creates a copy of the trip with all its activities.
 * New trip name is prefixed with "Copy of ".
 * Activity IDs are regenerated to avoid conflicts.
 */

type ActivityRow = {
  id: string;
  type: string;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  cost: number;
  currency: string;
  distance: number;
  notes: string;
  sort_order: number;
};

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

  try {
    // Verify ownership
    const original = await env.DB
      .prepare(`SELECT id, name, notes, country FROM trips WHERE id = ? AND user_id = ? LIMIT 1`)
      .bind(tripId, user.id)
      .first<{ id: string; name: string; notes: string; country: string }>();

    if (!original) return error('Trip not found.', 404);

    // Fetch all activities
    const result = await env.DB
      .prepare(`
        SELECT id, type, name, location, start_date, end_date,
               cost, currency, distance, notes, sort_order
        FROM activities
        WHERE trip_id = ?
        ORDER BY sort_order ASC, start_date ASC
      `)
      .bind(tripId)
      .all<ActivityRow>();

    const activities = result.results ?? [];

    // Create new trip
    const newTripId = crypto.randomUUID();
    const newName = `Copy of ${original.name}`;

    await env.DB
      .prepare(`
        INSERT INTO trips (id, user_id, name, notes, country, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(newTripId, user.id, newName, original.notes ?? '', original.country ?? '')
      .run();

    // Duplicate activities with new IDs
    if (activities.length > 0) {
      const inserts = activities.map((a) =>
        env.DB.prepare(`
          INSERT INTO activities
            (id, trip_id, user_id, type, name, location,
             start_date, end_date, cost, currency, distance,
             notes, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          newTripId,
          user.id,
          a.type,
          a.name,
          a.location,
          a.start_date,
          a.end_date,
          a.cost,
          a.currency,
          a.distance,
          a.notes,
          a.sort_order
        )
      );

      await env.DB.batch(inserts);
    }

    return json({
      ok: true,
      trip: {
        id: newTripId,
        name: newName,
        activitiesCount: activities.length
      }
    });
  } catch (err) {
    console.error('DB error (duplicateTrip):', err);
    return error('Failed to duplicate trip.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}
