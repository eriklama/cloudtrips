import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { env } = context;

  let user: { id: string };
  try {
    user = await requireUser(context);
  } catch {
    return error('Unauthorized.', 401);
  }

  try {
    const row = await env.DB
      .prepare(`SELECT visited_countries FROM users WHERE id = ? LIMIT 1`)
      .bind(user.id)
      .first<{ visited_countries: string }>();

    let countries: string[] = [];
    try {
      countries = JSON.parse(row?.visited_countries || '[]');
    } catch {
      countries = [];
    }

    return json({ ok: true, countries });
  } catch (err) {
    console.error('DB error (getVisitedCountries):', err);
    return error('Failed to load visited countries.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  return onRequestGet(context);
}
