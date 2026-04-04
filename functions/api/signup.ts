import { createAuthToken, hashPassword, isStrongEnoughPassword, isValidEmail, normalizeUserEmail } from '../_lib/auth';
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

  if (!isValidEmail(email)) {
    return error('Please enter a valid email address.', 400);
  }

  if (!isStrongEnoughPassword(password)) {
    return error('Password must be at least 8 characters long.', 400);
  }

  const existing = await env.DB
    .prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`)
    .bind(email)
    .first();

  if (existing) {
    return error('An account with this email already exists.', 409);
  }

  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password, env);

  await env.DB
    .prepare(`
      INSERT INTO users (id, email, password_hash)
      VALUES (?, ?, ?)
    `)
    .bind(userId, email, passwordHash)
    .run();

  const token = await createAuthToken({ id: userId, email }, env);

  return json({
    ok: true,
    token,
    user: {
      id: userId,
      email
    }
  });
}

export function onRequest() {
  return methodNotAllowed(['POST']);
}
