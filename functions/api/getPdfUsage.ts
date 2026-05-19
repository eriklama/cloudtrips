import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

/**
 * GET /api/getPdfUsage
 * Admin-only. Returns Browserless PDF usage counts per month from KV.
 */

export async function onRequestGet(context: { request: Request; env: Env & { RATE_LIMIT_KV: KVNamespace } }) {
  const { env } = context;

  let user: { id: string; email: string };
  try {
    user = await requireUser(context) as { id: string; email: string };
  } catch {
    return error('Unauthorized.', 401);
  }

  if (user.email !== env.ADMIN_EMAIL) {
    return error('Forbidden.', 403);
  }

  try {
    const { keys } = await env.RATE_LIMIT_KV.list({ prefix: 'browserless_usage_' });

    const usage = await Promise.all(
      keys.map(async ({ name }) => {
        const value = await env.RATE_LIMIT_KV.get(name);
        const month = name.replace('browserless_usage_', '').replace('_', '-');
        return { month, count: parseInt(value || '0', 10) };
      })
    );

    usage.sort((a, b) => b.month.localeCompare(a.month));

    return json({ ok: true, usage, limit: 1000 });
  } catch (err) {
    console.error('getPdfUsage error:', err);
    return error('Failed to load usage.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env & { RATE_LIMIT_KV: KVNamespace } }) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  return onRequestGet(context);
}
