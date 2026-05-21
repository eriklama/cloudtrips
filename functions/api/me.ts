import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await requireUser(context);

    // Check email verification status
    const row = await context.env.DB
      .prepare(`SELECT email_verified_at FROM users WHERE id = ? LIMIT 1`)
      .bind(user.id)
      .first<{ email_verified_at: string | null }>();

    return json({
      ok: true,
      user: {
        ...user,
        emailVerified: Boolean(row?.email_verified_at)
      }
    });
  } catch (err) {
    console.warn('Auth failed (/me):', err);
    return error('Unauthorized.', 401);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }
  return onRequestGet(context);
}