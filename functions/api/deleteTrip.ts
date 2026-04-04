import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // 🔐 Auth
  const user = await requireUser(request, env);
  if (!user) {
    return error('Unauthorized.', 401);
  }

  // 📥 Input
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
    // 🔍 Check existence (and ownership)
    const existing = await env.DB
      .prepare(`SELECT id FROM trips WHERE id = ? AND user_id = ? LIMIT 1`)
      .bind(id, user.id)
      .first();

    if (!existing) {
      return error('Trip not found.', 404);
    }

    // 🗑️ Delete
    await env.DB
      .prepare(`DELETE FROM trips WHERE id = ? AND user_id = ?`)
      .bind(id, user.id)
      .run();

  } catch (err) {
    console.error('DB error (deleteTrip):', err);
    return error('Failed to delete trip.', 500);
  }

  // ✅ Response
  return json({
    ok: true,
    deletedId: id
  });
}

export function onRequest() {
  return methodNotAllowed(['POST']);
}
