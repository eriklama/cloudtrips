import { createAuthToken, normalizeUserEmail, verifyPassword } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const email = normalizeUserEmail(body?.email || '');
  const password = String(body?.password || '');

  if (!email || !password) {
    return error('Email and password are required.', 400);
  }

  const user = await env.DB
    .prepare(`
      SELECT id, email, password_hash
      FROM users
      WHERE email = ?
      LIMIT 1
    `)
    .bind(email)
    .first<{ id: string; email: string; password_hash: string }>();

  if (!user) {
    return error('Invalid email or password.', 401);
  }

  const ok = await verifyPassword(password, user.password_hash, env);
  if (!ok) {
    return error('Invalid email or password.', 401);
  }

  const token = await createAuthToken({ id: user.id, email: user.email }, env);

  return json({
    ok: true,
    token,
    user: {
      id: user.id,
      email: user.email
    }
  });
}

export function onRequest() {
  return methodNotAllowed(['POST']);
}
