import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

/**
 * GET /api/getErrors
 *
 * Returns the 50 most recent error log entries.
 * Authenticated users only — no admin role check since this is a personal app.
 *
 * Optional query params:
 *   ?limit=N   — number of rows (max 200, default 50)
 *   ?since=ISO — only errors after this timestamp
 */

type ErrorRow = {
  id: string;
  endpoint: string;
  method: string;
  status: number;
  message: string;
  user_id: string | null;
  ip: string | null;
  created_at: string;
};

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  let user: { id: string; email: string };
  try {
    user = await requireUser(context) as { id: string; email: string };
  } catch {
    return error('Unauthorized.', 401);
  }

  // Admin-only — check against ADMIN_EMAIL env var
  const adminEmail = (context as any).env?.ADMIN_EMAIL || '';
  if (!adminEmail || user.email !== adminEmail) {
    return error('Forbidden.', 403);
  }

  const url = new URL(request.url);
  const limit = Math.min(200, parseInt(url.searchParams.get('limit') || '50', 10));
  const since = url.searchParams.get('since') || '';

  try {
    const result = since
      ? await env.DB.prepare(`
          SELECT id, endpoint, method, status, message, user_id, ip, created_at
          FROM error_logs
          WHERE created_at > ?
          ORDER BY created_at DESC
          LIMIT ?
        `).bind(since, limit).all<ErrorRow>()
      : await env.DB.prepare(`
          SELECT id, endpoint, method, status, message, user_id, ip, created_at
          FROM error_logs
          ORDER BY created_at DESC
          LIMIT ?
        `).bind(limit).all<ErrorRow>();

    return json({
      ok: true,
      errors: result.results ?? [],
      count: result.results?.length ?? 0
    });
  } catch (err) {
    console.error('DB error (getErrors):', err);
    return error('Failed to load error logs.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  return onRequestGet(context);
}