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

  const activityId = String(body?.activityId || '').trim();
  if (!activityId) return error('activityId is required.', 400);

  // Get the activity's trip_id to check access
  const activity = await env.DB
    .prepare(`SELECT trip_id FROM activities WHERE id = ? LIMIT 1`)
    .bind(activityId)
    .first<{ trip_id: string }>();

  if (!activity) return error('Activity not found.', 404);

  const { access } = await canAccessTrip(env, activity.trip_id, user.id);
  if (!access) return error('Activity not found.', 404);

  try {
    const result = await env.DB
      .prepare(`DELETE FROM activities WHERE id = ?`)
      .bind(activityId)
      .run();

    if (!result.meta?.changes) return error('Activity not found.', 404);

    return json({ ok: true, activityId });
  } catch (err) {
    console.error('DB error (deleteActivity):', err);
    return error('Failed to delete activity.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}
