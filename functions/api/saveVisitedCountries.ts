import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  let user: { id: string };
  try {
    user = await requireUser(context);
  } catch {
    return error('Unauthorized.', 401);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const countries = Array.isArray(body?.countries)
    ? [...new Set(body.countries.map((c: unknown) => String(c).trim()).filter(Boolean))].sort()
    : [];

  try {
    await env.DB
      .prepare(`UPDATE users SET visited_countries = ? WHERE id = ?`)
      .bind(JSON.stringify(countries), user.id)
      .run();

    return json({ ok: true, countries });
  } catch (err) {
    console.error('DB error (saveVisitedCountries):', err);
    return error('Failed to save visited countries.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}
