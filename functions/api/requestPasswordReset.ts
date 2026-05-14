import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import { sha256Hex, generateShareToken, makeId } from '../_lib/share';

const MAX_ATTEMPTS = 3;
const WINDOW_SECONDS = 60 * 15;

async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
  const key = `pwd_reset_attempts:${ip}`;
  const current = await env.RATE_LIMIT_KV.get(key);
  const attempts = current ? parseInt(current) : 0;
  if (attempts >= MAX_ATTEMPTS) return false;
  await env.RATE_LIMIT_KV.put(key, String(attempts + 1), {
    expirationTtl: WINDOW_SECONDS
  });
  return true;
}

export async function onRequestPost(context: {
  request: Request;
  env: Env;
}) {
  const { request, env } = context;

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const allowed = await checkRateLimit(env, ip);
  if (!allowed) {
    // Return success even on rate limit — don't reveal limiting
    return json({ ok: true });
  }

  let body: { email?: string } = {};
  try {
    body = await request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const email = String(body.email || '').trim().toLowerCase();
  if (!email) {
    return error('Email is required.', 400);
  }

  // Always return success to avoid email enumeration
  const user = await env.DB
    .prepare(`SELECT id, email FROM users WHERE email = ? LIMIT 1`)
    .bind(email)
    .first<{ id: string; email: string }>();

  if (!user) {
    return json({ ok: true });
  }

  // Invalidate any existing unused tokens for this user
  await env.DB
    .prepare(`UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL`)
    .bind(new Date().toISOString(), user.id)
    .run();

  // Create new reset token — expires in 1 hour
  const token = generateShareToken(32);
  const tokenHash = await sha256Hex(token);
  const id = makeId();
  const expiresAt = new Date();
  expiresAt.setUTCHours(expiresAt.getUTCHours() + 1);

  await env.DB
    .prepare(`
      INSERT INTO password_resets (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `)
    .bind(id, user.id, tokenHash, expiresAt.toISOString())
    .run();

  const resetUrl = `https://cloudtrips.pages.dev/reset.html?token=${encodeURIComponent(token)}`;

  // Send email via Resend
  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.RESEND_API_KEY}`
    },
    body: JSON.stringify({
      from: 'CloudTrips <onboarding@resend.dev>',
      to: [user.email],
      subject: 'Reset your CloudTrips password',
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;color:#0f172a;">Reset your password</h1>
          <p style="color:#475569;margin-bottom:24px;">
            Click the button below to set a new password for your CloudTrips account.
            This link expires in <strong>1 hour</strong>.
          </p>
          <a href="${resetUrl}"
            style="display:inline-block;background:#6366f1;color:#fff;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;margin-bottom:24px;">
            Reset password
          </a>
          <p style="color:#94a3b8;font-size:13px;">
            If you didn't request this, you can safely ignore this email.<br/>
            The link will expire automatically.
          </p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
          <p style="color:#cbd5e1;font-size:12px;">CloudTrips · cloudtrips.pages.dev</p>
        </div>
      `
    })
  });

  if (!emailRes.ok) {
    console.error('Resend error:', await emailRes.text());
    return error('Failed to send reset email.', 500);
  }

  return json({ ok: true });
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') {
    return methodNotAllowed(['POST']);
  }
  return onRequestPost(context);
}
