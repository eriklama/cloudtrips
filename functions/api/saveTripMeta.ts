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

  const id = String(body?.id || '').trim();
  const name = String(body?.name || '').trim();
  const notes = String(body?.notes ?? '').trim();
  const country = String(body?.country ?? '').trim();

  if (!name) return error('Trip name is required.', 400);

  try {
    if (id) {
      const result = await env.DB
        .prepare(`UPDATE trips SET name = ?, notes = ?, country = ? WHERE id = ? AND user_id = ?`)
        .bind(name, notes, country, id, user.id)
        .run();

      if (!result.meta?.changes) return error('Trip not found.', 404);

      return json({ ok: true, trip: { id, name, notes, country } });
    } else {
      const tripId = crypto.randomUUID();
      await env.DB
        .prepare(`
          INSERT INTO trips (id, user_id, name, notes, country, created_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `)
        .bind(tripId, user.id, name, notes, country)
        .run();

      return json({ ok: true, trip: { id: tripId, name, notes, country, activities: [] } });
    }
  } catch (err) {
    console.error('DB error (saveTripMeta):', err);
    return error('Failed to save trip.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}
