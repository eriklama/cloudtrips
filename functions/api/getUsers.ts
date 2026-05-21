import { requireUser } from '../_lib/auth';
import type { Env, AuthUser } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

/**
 * GET /api/getUsers
 * Admin only. Returns all users with their status and monthly PDF usage.
 */

type UserRow = {
  id: string;
  email: string;
  is_admin: number;
  pdf_monthly_limit: number;
  email_verified_at: string | null;
  created_at: string | null;
};

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { env } = context;

  let user: AuthUser;
  try {
    user = await requireUser(context);
  } catch {
    return error('Unauthorized.', 401);
  }

  const adminRow = await env.DB
    .prepare(`SELECT is_admin FROM users WHERE id = ? LIMIT 1`)
    .bind(user.id)
    .first<{ is_admin: number }>();

  if (!adminRow?.is_admin) return error('Forbidden.', 403);

  try {
    const result = await env.DB
      .prepare(`
        SELECT id, email, is_admin, pdf_monthly_limit, email_verified_at, created_at
        FROM users
        ORDER BY created_at DESC
      `)
      .all<UserRow>();

    const now = new Date();
    const monthSuffix = `_${now.getUTCFullYear()}_${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const users = await Promise.all((result.results ?? []).map(async (u) => {
      const kvKey = `pdf_user_${u.id}${monthSuffix}`;
      const usage = await env.RATE_LIMIT_KV.get(kvKey);
      return {
        id: u.id,
        email: u.email,
        isAdmin: Boolean(u.is_admin),
        pdfMonthlyLimit: u.pdf_monthly_limit,
        emailVerified: Boolean(u.email_verified_at),
        pdfUsageThisMonth: usage ? parseInt(usage, 10) : 0,
        createdAt: u.created_at ?? ''
      };
    }));

    return json({ ok: true, users });
  } catch (err) {
    console.error('DB error (getUsers):', err);
    return error('Failed to load users.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  return onRequestGet(context);
}