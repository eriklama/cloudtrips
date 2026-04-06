import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  let user: { id: string; email?: string };
  try {
    user = await requireUser(context);
  } catch (err) {
    console.warn('Auth failed (deleteTrip):', err);
    return error('Unauthorized.', 401);
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const url = new URL(request.url);
  const id = String(body?.id || url.searchParams.get('trip') || '').trim();

  if (!id) {
    return error('Trip id is required.', 400);
  }

  try {
    const existing = await env.DB
      .prepare(`
        SELECT id
        FROM trips
        WHERE id = ? AND user_id = ?
        LIMIT 1
      `)
      .bind(id, user.id)
      .first<{ id: string }>();

    if (!existing) {
      return error('Trip not found.', 404);
    }

    await env.DB
      .prepare(`
        DELETE FROM trip_share_tokens
        WHERE trip_id = ?
      `)
      .bind(id)
      .run()
      .catch(() => {});

    await env.DB
      .prepare(`
        DELETE FROM trips
        WHERE id = ? AND user_id = ?
      `)
      .bind(id, user.id)
      .run();

    return json({
      ok: true,
      deletedId: id
    });
  } catch (err) {
    console.error('DB error (deleteTrip):', err);
    return error('Failed to delete trip.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }
  return onRequestPost(context);
}
