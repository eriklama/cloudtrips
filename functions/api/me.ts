import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

export async function onRequestGet(context: { request: Request; env: Env & { RATE_LIMIT_KV: KVNamespace } }) {
  try {
    const user = await requireUser(context);

    const row = await context.env.DB
      .prepare(`SELECT email_verified_at, is_admin, pdf_monthly_limit FROM users WHERE id = ? LIMIT 1`)
      .bind(user.id)
      .first<{ email_verified_at: string | null; is_admin: number; pdf_monthly_limit: number }>();

    // Read per-user PDF usage for current month from KV
    const now = new Date();
    const monthSuffix = `_${now.getUTCFullYear()}_${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
    const kvKey = `pdf_user_${user.id}${monthSuffix}`;
    const usage = await context.env.RATE_LIMIT_KV.get(kvKey);
    const pdfUsageThisMonth = usage ? parseInt(usage, 10) : 0;

    return json({
      ok: true,
      user: {
        ...user,
        emailVerified: Boolean(row?.email_verified_at),
        isAdmin: Boolean(row?.is_admin),
        pdfMonthlyLimit: row?.pdf_monthly_limit ?? 5,
        pdfUnlimited: (row?.pdf_monthly_limit ?? 5) === 0,
        pdfUsageThisMonth
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
