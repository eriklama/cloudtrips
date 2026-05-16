import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

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

  try {
    // user_id check ensures you can only delete your own activities
    const result = await env.DB
      .prepare(`DELETE FROM activities WHERE id = ? AND user_id = ?`)
      .bind(activityId, user.id)
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
