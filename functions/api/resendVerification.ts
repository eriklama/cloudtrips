import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import { sendVerificationEmail } from '../_lib/sendVerificationEmail';

const WINDOW_SECONDS = 60 * 2; // 2 minutes between resends

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { env } = context;

  let user: { id: string; email: string };
  try {
    user = await requireUser(context) as { id: string; email: string };
  } catch {
    return error('Unauthorized.', 401);
  }

  // Check already verified
  const row = await env.DB
    .prepare(`SELECT email_verified_at FROM users WHERE id = ? LIMIT 1`)
    .bind(user.id)
    .first<{ email_verified_at: string | null }>();

  if (row?.email_verified_at) {
    return error('Your email is already verified.', 400);
  }

  // Rate limit resends per user
  const rlKey = `resend_verification:${user.id}`;
  const recent = await env.RATE_LIMIT_KV.get(rlKey);
  if (recent) {
    return error('Please wait a moment before requesting another verification email.', 429);
  }
  await env.RATE_LIMIT_KV.put(rlKey, '1', { expirationTtl: WINDOW_SECONDS });

  try {
    await sendVerificationEmail(env, user.id, user.email);
    return json({ ok: true });
  } catch (err) {
    console.error('resendVerification error:', err);
    return error('Failed to send verification email.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}
