import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

function sanitizeActivity(activity: any) {
  const toNumber = (v: any) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    id: String(activity?.id || crypto.randomUUID()),
    type: String(activity?.type || 'other'),
    startDate: String(activity?.startDate || ''),
    endDate: String(activity?.endDate || ''),
    cost: toNumber(activity?.cost),
    notes: String(activity?.notes || ''),
    location: String(activity?.location || ''),
    distance: toNumber(activity?.distance)
  };
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // 🔐 Auth
  const user = await requireUser(request, env);
  if (!user) {
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
    // =========================
    // UPDATE EXISTING TRIP
    // =========================
    if (id) {
      const result = await env.DB
        .prepare(`
          UPDATE trips
          SET name = ?, activities_json = ?
          WHERE id = ? AND user_id = ?
        `)
        .bind(name, activitiesJson, id, user.id)
        .run();

      // ⚠️ No rows updated → not found or not owned
      if (!result.meta || result.meta.changes === 0) {
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

    // =========================
    // CREATE NEW TRIP
    // =========================
    const newId = crypto.randomUUID();

    await env.DB
      .prepare(`
        INSERT INTO trips (id, user_id, name, activities_json)
        VALUES (?, ?, ?, ?)
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

export function onRequest() {
  return methodNotAllowed(['POST']);
}
