import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import { sha256Hex } from '../_lib/share';
import { hashPassword, isStrongEnoughPassword } from '../_lib/auth';

type ResetRow = {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  used_at: string | null;
};

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}) {
  const { request, env } = context;

  let body: { token?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const token = String(body.token || '').trim();
  const password = String(body.password || '');

  if (!token) return error('Token is required.', 400);
  if (!password) return error('Password is required.', 400);
  if (!isStrongEnoughPassword(password)) {
    return error('Password must be at least 8 characters.', 400);
  }

  const tokenHash = await sha256Hex(token);

  const reset = await env.DB
    .prepare(`
      SELECT id, user_id, token_hash, expires_at, used_at
      FROM password_resets
      WHERE token_hash = ?
      LIMIT 1
    `)
    .bind(tokenHash)
    .first<ResetRow>();

  if (!reset) {
    return error('Invalid or expired reset link.', 400);
  }

  if (reset.used_at) {
    return error('This reset link has already been used.', 400);
  }

  const expiresAt = Date.parse(reset.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return error('This reset link has expired. Please request a new one.', 400);
  }

  // Hash new password and update user
  const passwordHash = await hashPassword(password, env);

  await env.DB
    .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
    .bind(passwordHash, reset.user_id)
    .run();

  // Mark token as used
  await env.DB
    .prepare(`UPDATE password_resets SET used_at = ? WHERE id = ?`)
    .bind(new Date().toISOString(), reset.id)
    .run();

  return json({ ok: true });
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }
  return onRequestPost(context);
}
