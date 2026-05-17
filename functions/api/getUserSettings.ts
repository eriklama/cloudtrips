import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

const VALID_CURRENCIES = new Set([
  'EUR', 'USD', 'GBP', 'CZK', 'CHF', 'PLN',
  'HUF', 'SEK', 'NOK', 'DKK'
]);

const DEFAULT_SETTINGS = {
  defaultCurrency: ''
};

export async function onRequestGet(context: { request: Request; env: Env }) {
  let user: { id: string };
  try {
    user = await requireUser(context);
  } catch {
    return error('Unauthorized.', 401);
  }

  try {
    const row = await context.env.DB
      .prepare(`SELECT settings FROM users WHERE id = ? LIMIT 1`)
      .bind(user.id)
      .first<{ settings: string | null }>();

    if (!row) return error('User not found.', 404);

    let settings = DEFAULT_SETTINGS;
    try {
      const parsed = JSON.parse(row.settings || '{}');
      settings = {
        defaultCurrency: VALID_CURRENCIES.has(parsed.defaultCurrency)
          ? parsed.defaultCurrency
          : ''
      };
    } catch {
      // malformed JSON — return defaults
    }

    return json({ ok: true, settings });
  } catch (err) {
    console.error('DB error (getUserSettings):', err);
    return error('Failed to load settings.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  return onRequestGet(context);
}
