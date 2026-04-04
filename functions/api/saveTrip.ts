import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

function sanitizeActivity(activity: any) {
  return {
    id: String(activity?.id || crypto.randomUUID()),
    type: String(activity?.type || 'other'),
    startDate: String(activity?.startDate || ''),
    endDate: String(activity?.endDate || ''),
    cost: Number.isFinite(Number(activity?.cost)) ? Number(activity.cost) : 0,
    notes: String(activity?.notes || ''),
    location: String(activity?.location || ''),
    distance: Number.isFinite(Number(activity?.distance)) ? Number(activity.distance) : 0
  };
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

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
  const rawActivities = Array.isArray(body?.activities) ? body.activities : [];
  const activities = rawActivities.map(sanitizeActivity);

  if (!name) {
    return error('Trip name is required.', 400);
  }

  const activitiesJson = JSON.stringify(activities);

  if (id) {
    const existing = await env.DB
      .prepare(`SELECT id FROM trips WHERE id = ? AND user_id = ? LIMIT 1`)
      .bind(id, user.id)
      .first();

    if (!existing) {
      return error('Trip not found.', 404);
    }

    await env.DB
      .prepare(`
        UPDATE trips
        SET name = ?, activities_json = ?
        WHERE id = ? AND user_id = ?
      `)
      .bind(name, activitiesJson, id, user.id)
      .run();

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
}

export function onRequest() {
  return methodNotAllowed(['POST']);
}
