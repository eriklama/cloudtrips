import { createAuthToken, hashPassword, isStrongEnoughPassword, isValidEmail, normalizeUserEmail } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const { request, env } = context;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return error('Invalid JSON body.', 400);
    }

    console.log('Signup body:', body);

    const email = normalizeUserEmail(body?.email || '');
    const password = String(body?.password || '');

    if (!isValidEmail(email)) {
      return error('Please enter a valid email address.', 400);
    }

    if (!isStrongEnoughPassword(password)) {
      return error('Password must be at least 8 characters long.', 400);
    }

    console.log('Checking existing user...');

    const existing = await env.DB
      .prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`)
      .bind(email)
      .first();

    if (existing) {
      return error('An account with this email already exists.', 409);
    }

    console.log('Creating user...');

    const userId = crypto.randomUUID();

    console.log('Hashing password...');
    const passwordHash = await hashPassword(password, env);

    console.log('Inserting user...');
    await env.DB
      .prepare(`
        INSERT INTO users (id, email, password_hash)
        VALUES (?, ?, ?)
      `)
      .bind(userId, email, passwordHash)
      .run();

    console.log('Creating token...');
    const token = await createAuthToken({ id: userId, email }, env);

    return json({
      ok: true,
      token,
      user: {
        id: userId,
        email
      }
    });

  } catch (err: any) {
    console.error('❌ SIGNUP ERROR:', err);

    return new Response(
      JSON.stringify({
        error: err?.message || String(err)
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

export function onRequest() {
  return methodNotAllowed(['POST']);
}
