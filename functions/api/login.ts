import { createAuthToken, normalizeUserEmail, verifyPassword } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
};

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 60 * 15; // 15 minutes

async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
  const key = `login_attempts:${ip}`;
  const current = await env.RATE_LIMIT_KV.get(key);
  const attempts = current ? parseInt(current) : 0;

  if (attempts >= MAX_ATTEMPTS) return false;

  await env.RATE_LIMIT_KV.put(key, String(attempts + 1), {
    expirationTtl: WINDOW_SECONDS
  });

  return true;
}

export async function onRequestPost(context: { request: Request; env: Env }) {
  try {
    const { request, env } = context;

    const ip = request.headers.get('cf-connecting-ip') || 'unknown';
    const allowed = await checkRateLimit(env, ip);
    if (!allowed) {
      return error('Too many login attempts. Please try again in 15 minutes.', 429);
    }

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
      .first<UserRow>();

    if (!user) {
      return error('Invalid email or password.', 401);
    }

    const ok = await verifyPassword(password, user.password_hash, env);
    if (!ok) {
      return error('Invalid email or password.', 401);
    }

    const token = await createAuthToken(
      { id: user.id, email: user.email },
      env
    );

    return json({
      ok: true,
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (err: any) {
    console.error('LOGIN ERROR:', err);
    return error(err?.message || 'Login failed.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }
  return onRequestPost(context);
}
