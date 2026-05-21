import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import { verifyPassword, normalizeUserEmail } from '../_lib/auth';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { env } = context;

  let user: { id: string; email: string };
  try {
    user = await requireUser(context) as { id: string; email: string };
  } catch {
    return error('Unauthorized.', 401);
  }

  let body: { password?: string } = {};
  try {
    body = await context.request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const password = String(body.password || '');
  if (!password) return error('Password is required to delete your account.', 400);

  // Verify password before deleting
  const row = await env.DB
    .prepare(`SELECT password_hash FROM users WHERE id = ? LIMIT 1`)
    .bind(user.id)
    .first<{ password_hash: string }>();

  if (!row) return error('User not found.', 404);

  const valid = await verifyPassword(password, row.password_hash, env);
  if (!valid) return error('Incorrect password.', 403);

  try {
    // Delete in order — trips cascade to activities/members/shares via FK
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM trip_members WHERE user_id = ?`).bind(user.id),
      env.DB.prepare(`DELETE FROM trip_members WHERE invited_by = ?`).bind(user.id),
      env.DB.prepare(`DELETE FROM trip_invites WHERE invited_by = ?`).bind(user.id),
      env.DB.prepare(`DELETE FROM activities WHERE user_id = ?`).bind(user.id),
      env.DB.prepare(`DELETE FROM trip_shares WHERE created_by_user_id = ?`).bind(user.id),
      env.DB.prepare(`DELETE FROM trips WHERE user_id = ?`).bind(user.id),
      env.DB.prepare(`DELETE FROM password_resets WHERE user_id = ?`).bind(user.id),
      env.DB.prepare(`DELETE FROM email_verifications WHERE user_id = ?`).bind(user.id),
      env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(user.id),
    ]);

    // Send goodbye email (non-fatal)
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': env.BREVO_API_KEY
        },
        body: JSON.stringify({
          sender: { name: 'CloudTrips', email: env.BREVO_SENDER_EMAIL },
          to: [{ email: user.email }],
          subject: 'Your CloudTrips account has been deleted',
          htmlContent: `
            <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
              <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;color:#0f172a;">Account deleted</h1>
              <p style="color:#475569;margin-bottom:24px;">
                Your CloudTrips account and all associated data have been permanently deleted.
              </p>
              <p style="color:#94a3b8;font-size:13px;">
                If you didn't request this, please contact us at
                <a href="mailto:hello@cloudtrips.uk" style="color:#6366f1;">hello@cloudtrips.uk</a>.
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
              <p style="color:#cbd5e1;font-size:12px;">CloudTrips · cloudtrips.uk</p>
            </div>
          `
        })
      });
    } catch (emailErr) {
      console.error('Failed to send account deletion email:', emailErr);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('deleteAccount error:', err);
    return error('Failed to delete account.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}