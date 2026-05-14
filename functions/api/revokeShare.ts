import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}) {
  const { request, env } = context;

  const user = await requireUser(context);

  let body: { shareId?: string } = {};
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const shareId = String(body.shareId || '').trim();
  if (!shareId) {
    return error('shareId is required.', 400);
  }

  // Verify the share belongs to a trip owned by this user
  const share = await env.DB
    .prepare(`
      SELECT ts.id
      FROM trip_shares ts
      JOIN trips t ON t.id = ts.trip_id
      WHERE ts.id = ?
        AND t.user_id = ?
        AND ts.revoked_at IS NULL
      LIMIT 1
    `)
    .bind(shareId, user.id)
    .first<{ id: string }>();

  if (!share) {
    return error('Share not found.', 404);
  }

  await env.DB
    .prepare(`UPDATE trip_shares SET revoked_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), shareId)
    .run();

  return json({ ok: true });
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }
  return onRequestPost(context);
}
