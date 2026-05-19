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
  const updates = body?.updates;

  if (!tripId) return error('tripId is required.', 400);
  if (!Array.isArray(updates) || updates.length === 0) return error('updates array is required.', 400);

  const { access } = await canAccessTrip(env, tripId, user.id);
  if (!access) return error('Trip not found.', 404);

  try {
    const statements = updates.map(({ id, sortOrder }: { id: string; sortOrder: number }) =>
      env.DB
        .prepare(`UPDATE activities SET sort_order = ? WHERE id = ? AND trip_id = ?`)
        .bind(Number(sortOrder), String(id), tripId)
    );

    await env.DB.batch(statements);
    return json({ ok: true });
  } catch (err) {
    console.error('DB error (reorderActivities):', err);
    return error('Failed to reorder activities.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}
