import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

type ActivityInput = {
  id?: unknown;
  type?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  cost?: unknown;
  notes?: unknown;
  location?: unknown;
  distance?: unknown;
  km?: unknown;
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
    startDate: toString(activity?.startDate || '').trim(),
    endDate: toString(activity?.endDate || '').trim(),
    cost: toNumber(activity?.cost),
    notes: toString(activity?.notes || '').trim(),
    location: toString(activity?.location || '').trim(),
    distance: toNumber(
      activity?.distance !== undefined ? activity.distance : activity?.km
    )
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

  if (!name) {
    return error('Trip name is required.', 400);
  }

  const rawActivities = Array.isArray(body?.activities) ? body.activities : [];
  const activities = rawActivities.map(sanitizeActivity);
  const activitiesJson = JSON.stringify(activities);

  try {
    if (id) {
      const result = await env.DB
        .prepare(`
          UPDATE trips
          SET name = ?, activities_json = ?
          WHERE id = ? AND user_id = ?
        `)
        .bind(name, activitiesJson, id, user.id)
        .run();

      const changes = Number(result?.meta?.changes || 0);
      if (changes === 0) {
        return error('Trip not found.', 404);
      }

      return json({
        ok: true,
        trip: {
          id,
          name,
          activities
        }
      });
    }

    const newId = crypto.randomUUID();

    await env.DB
  .prepare(`
    INSERT INTO trips (id, user_id, name, activities_json, created_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `)
  .bind(newId, user.id, name, activitiesJson)
  .run();

    return json({
      ok: true,
      trip: {
        id: newId,
        name,
        activities
      }
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
