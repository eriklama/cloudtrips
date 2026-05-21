import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import { sha256Hex } from '../_lib/share';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { env } = context;

  let body: { token?: string } = {};
  try {
    body = await context.request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const token = String(body.token || '').trim();
  if (!token) return error('Token is required.', 400);

  const tokenHash = await sha256Hex(token);

  const row = await env.DB
    .prepare(`
      SELECT ev.id, ev.user_id, ev.expires_at, ev.used_at
      FROM email_verifications ev
      WHERE ev.token_hash = ?
      LIMIT 1
    `)
    .bind(tokenHash)
    .first<{ id: string; user_id: string; expires_at: string; used_at: string | null }>();

  if (!row) return error('Invalid or expired verification link.', 400);
  if (row.used_at) return error('This verification link has already been used.', 400);
  if (new Date(row.expires_at) < new Date()) return error('This verification link has expired.', 400);

  const now = new Date().toISOString();

  // Mark token used + set email_verified_at on user
  await env.DB.batch([
    env.DB.prepare(`UPDATE email_verifications SET used_at = ? WHERE id = ?`).bind(now, row.id),
    env.DB.prepare(`UPDATE users SET email_verified_at = ? WHERE id = ?`).bind(now, row.user_id)
  ]);

  return json({ ok: true });
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}
