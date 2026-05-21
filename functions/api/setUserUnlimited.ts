import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

/**
 * POST /api/setUserUnlimited
 * Admin only. Sets pdf_monthly_limit or is_admin for a user.
 *
 * Body:
 *   { userId, field: 'pdf_monthly_limit', value: 0 | 5 | 100 }
 *   { userId, field: 'is_admin', value: true | false }
 */

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { env } = context;

  let user: { id: string; email: string };
  try {
    user = await requireUser(context) as { id: string; email: string };
  } catch {
    return error('Unauthorized.', 401);
  }

  const adminRow = await env.DB
    .prepare(`SELECT is_admin FROM users WHERE id = ? LIMIT 1`)
    .bind(user.id)
    .first<{ is_admin: number }>();

  if (!adminRow?.is_admin) return error('Forbidden.', 403);

  let body: { userId?: string; field?: string; value?: number | boolean } = {};
  try {
    body = await context.request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const { userId, field, value } = body;
  if (!userId) return error('userId is required.', 400);
  if (!['pdf_monthly_limit', 'is_admin'].includes(field ?? '')) {
    return error('field must be pdf_monthly_limit or is_admin.', 400);
  }

  if (field === 'is_admin') {
    if (typeof value !== 'boolean') return error('value must be a boolean for is_admin.', 400);
    if (userId === user.id && !value) return error('You cannot remove your own admin status.', 400);
  }

  if (field === 'pdf_monthly_limit') {
    if (typeof value !== 'number' || ![0, 5, 100].includes(value as number)) {
      return error('pdf_monthly_limit must be 0 (unlimited), 5 (free), or 100 (paid).', 400);
    }
  }

  try {
    const dbValue = field === 'is_admin' ? (value ? 1 : 0) : value;
    const result = await env.DB
      .prepare(`UPDATE users SET ${field} = ? WHERE id = ?`)
      .bind(dbValue, userId)
      .run();

    if (!result.meta?.changes) return error('User not found.', 404);

    return json({ ok: true, userId, field, value });
  } catch (err) {
    console.error('DB error (setUserUnlimited):', err);
    return error('Failed to update user.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}
