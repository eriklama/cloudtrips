import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

/**
 * POST /api/adminDeleteUser
 * Admin only. Permanently deletes any user account and all their data.
 */

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { env } = context;

  let admin: { id: string; email: string };
  try {
    admin = await requireUser(context) as { id: string; email: string };
  } catch {
    return error('Unauthorized.', 401);
  }

  const adminRow = await env.DB
    .prepare(`SELECT is_admin FROM users WHERE id = ? LIMIT 1`)
    .bind(admin.id)
    .first<{ is_admin: number }>();

  if (!adminRow?.is_admin) return error('Forbidden.', 403);

  let body: { userId?: string } = {};
  try {
    body = await context.request.json();
  } catch {
    return error('Invalid JSON body.', 400);
  }

  const { userId } = body;
  if (!userId) return error('userId is required.', 400);

  // Prevent admin from deleting their own account via this endpoint
  if (userId === admin.id) {
    return error('Use account settings to delete your own account.', 400);
  }

  const target = await env.DB
    .prepare(`SELECT id, email FROM users WHERE id = ? LIMIT 1`)
    .bind(userId)
    .first<{ id: string; email: string }>();

  if (!target) return error('User not found.', 404);

  try {
    await env.DB.batch([
      env.DB.prepare(`DELETE FROM trip_members WHERE user_id = ?`).bind(userId),
      env.DB.prepare(`DELETE FROM trip_members WHERE invited_by = ?`).bind(userId),
      env.DB.prepare(`DELETE FROM trip_invites WHERE invited_by = ?`).bind(userId),
      env.DB.prepare(`DELETE FROM activities WHERE user_id = ?`).bind(userId),
      env.DB.prepare(`DELETE FROM trip_shares WHERE created_by_user_id = ?`).bind(userId),
      env.DB.prepare(`DELETE FROM trips WHERE user_id = ?`).bind(userId),
      env.DB.prepare(`DELETE FROM password_resets WHERE user_id = ?`).bind(userId),
      env.DB.prepare(`DELETE FROM email_verifications WHERE user_id = ?`).bind(userId),
      env.DB.prepare(`DELETE FROM users WHERE id = ?`).bind(userId),
    ]);

    // Notify deleted user (non-fatal)
    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': env.BREVO_API_KEY
        },
        body: JSON.stringify({
          sender: { name: 'CloudTrips', email: env.BREVO_SENDER_EMAIL },
          to: [{ email: target.email }],
          subject: 'Your CloudTrips account has been deleted',
          htmlContent: `
            <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
              <h1 style="font-size:22px;font-weight:700;margin-bottom:8px;color:#0f172a;">Account deleted</h1>
              <p style="color:#475569;margin-bottom:24px;">
                Your CloudTrips account and all associated data have been permanently deleted by an administrator.
              </p>
              <p style="color:#94a3b8;font-size:13px;">
                If you have questions, contact us at
                <a href="mailto:hello@cloudtrips.uk" style="color:#6366f1;">hello@cloudtrips.uk</a>.
              </p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;" />
              <p style="color:#cbd5e1;font-size:12px;">CloudTrips · cloudtrips.uk</p>
            </div>
          `
        })
      });
    } catch (emailErr) {
      console.error('Failed to send deletion notification:', emailErr);
    }

    return json({ ok: true, deletedEmail: target.email });
  } catch (err) {
    console.error('adminDeleteUser error:', err);
    return error('Failed to delete user.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}