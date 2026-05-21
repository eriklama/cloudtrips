import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

/**
 * POST /api/setUserUnlimited
 * Admin only. Toggles pdf_exports_unlimited and/or is_admin for a user.
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

  let body: { userId?: string; field?: string; value?: boolean } = {};
  try {
    body = await context.request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const { userId, field, value } = body;

  if (!userId) return error('userId is required.', 400);
  if (!['pdf_exports_unlimited', 'is_admin'].includes(field ?? '')) {
    return error('field must be pdf_exports_unlimited or is_admin.', 400);
  }
  if (typeof value !== 'boolean') return error('value must be a boolean.', 400);

  // Prevent admin from removing their own admin status
  if (field === 'is_admin' && userId === user.id && !value) {
    return error('You cannot remove your own admin status.', 400);
  }

  try {
    const result = await env.DB
      .prepare(`UPDATE users SET ${field} = ? WHERE id = ?`)
      .bind(value ? 1 : 0, userId)
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
