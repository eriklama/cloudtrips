import {
  createAuthToken,
  hashPassword,
  isStrongEnoughPassword,
  isValidEmail,
  normalizeUserEmail
} from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

type UserRow = {
  id: string;
};

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // =========================
  // PARSE BODY
  // =========================
  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const email = normalizeUserEmail(body?.email || '');
  const password = String(body?.password || '');

  // =========================
  // VALIDATION
  // =========================
  if (!isValidEmail(email)) {
    return error('Please enter a valid email address.', 400);
  }

  if (!isStrongEnoughPassword(password)) {
    return error('Password must be at least 8 characters long.', 400);
  }

  try {
    // =========================
    // CHECK EXISTING USER
    // =========================
    const existing = await env.DB
      .prepare(`
        SELECT id
        FROM users
        WHERE email = ?
        LIMIT 1
      `)
      .bind(email)
      .first<UserRow>();

    if (existing) {
      return error('An account with this email already exists.', 409);
    }

    // =========================
    // CREATE USER
    // =========================
    const userId = crypto.randomUUID();

    const passwordHash = await hashPassword(password, env);

    await env.DB
      .prepare(`
        INSERT INTO users (id, email, password_hash)
        VALUES (?, ?, ?)
      `)
      .bind(userId, email, passwordHash)
      .run();

    // =========================
    // CREATE TOKEN
    // =========================
    const token = await createAuthToken(
      { id: userId, email },
      env
    );

    // =========================
    // RESPONSE
    // =========================
    return json({
      ok: true,
      token,
      user: {
        id: userId,
        email
      }
    });

  } catch (err: any) {
    console.error('SIGNUP ERROR:', err);
    return error(err?.message || 'Signup failed.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }
  return onRequestPost(context);
}
