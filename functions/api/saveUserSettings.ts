import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

const VALID_CURRENCIES = new Set([
  'EUR', 'USD', 'GBP', 'CZK', 'CHF', 'PLN',
  'HUF', 'SEK', 'NOK', 'DKK'
]);

export async function onRequestPost(context: { request: Request; env: Env }) {
  let user: { id: string };
  try {
    user = await requireUser(context);
  } catch {
    return error('Unauthorized.', 401);
  }

  let body: any;
  try {
    body = await context.request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const defaultCurrency = String(body?.defaultCurrency ?? '').trim().toUpperCase();

  if (defaultCurrency && !VALID_CURRENCIES.has(defaultCurrency)) {
    return error('Invalid currency.', 400);
  }

  const settings = JSON.stringify({ defaultCurrency });

  try {
    const result = await context.env.DB
      .prepare(`UPDATE users SET settings = ? WHERE id = ?`)
      .bind(settings, user.id)
      .run();

    if (!result.meta?.changes) return error('User not found.', 404);

    return json({ ok: true, settings: { defaultCurrency } });
  } catch (err) {
    console.error('DB error (saveUserSettings):', err);
    return error('Failed to save settings.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}
