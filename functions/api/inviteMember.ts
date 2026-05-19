import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import { isTripOwner, generateInviteToken, hashInviteToken } from '../_lib/members';
import { isValidEmail } from '../_lib/auth';

export async function onRequestPost(context: { request: Request; env: Env & { BREVO_API_KEY: string; BREVO_SENDER_EMAIL: string } }) {
  const { request, env } = context;

  let user: { id: string; email: string };
  try {
    user = await requireUser(context) as { id: string; email: string };
  } catch {
    return error('Unauthorized.', 401);
  }

  let body: any;
  try { body = await request.json(); } catch { return error('Invalid JSON.', 400); }

  const tripId = String(body?.tripId || '').trim();
  const inviteEmail = String(body?.email || '').trim().toLowerCase();

  if (!tripId) return error('tripId is required.', 400);
  if (!inviteEmail || !isValidEmail(inviteEmail)) return error('Valid email is required.', 400);
  if (inviteEmail === user.email.toLowerCase()) return error('You cannot invite yourself.', 400);

  // Only owner can invite
  const isOwner = await isTripOwner(env, tripId, user.id);
  if (!isOwner) return error('Only the trip owner can invite members.', 403);

  // Get trip name
  const trip = await env.DB
    .prepare(`SELECT name FROM trips WHERE id = ? LIMIT 1`)
    .bind(tripId)
    .first<{ name: string }>();
  if (!trip) return error('Trip not found.', 404);

  // Check if already a member
  const existingUser = await env.DB
    .prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`)
    .bind(inviteEmail)
    .first<{ id: string }>();

  if (existingUser) {
    const alreadyMember = await env.DB
      .prepare(`SELECT id FROM trip_members WHERE trip_id = ? AND user_id = ? LIMIT 1`)
      .bind(tripId, existingUser.id)
      .first<{ id: string }>();
    if (alreadyMember) return error('This person is already a member of this trip.', 409);
  }

  // Check for existing pending invite
  const existingInvite = await env.DB
    .prepare(`SELECT id FROM trip_invites WHERE trip_id = ? AND email = ? AND accepted_at IS NULL AND expires_at > datetime('now') LIMIT 1`)
    .bind(tripId, inviteEmail)
    .first<{ id: string }>();
  if (existingInvite) return error('An invite has already been sent to this email.', 409);

  // Generate token
  const token = generateInviteToken();
  const tokenHash = await hashInviteToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await env.DB
    .prepare(`INSERT INTO trip_invites (trip_id, email, token_hash, invited_by, expires_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(tripId, inviteEmail, tokenHash, user.id, expiresAt)
    .run();

  // Send invite email via Brevo
  const inviteUrl = `https://cloudtrips.uk/accept-invite.html?token=${encodeURIComponent(token)}`;

  try {
    await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': env.BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: 'CloudTrips', email: env.BREVO_SENDER_EMAIL },
        to: [{ email: inviteEmail }],
        subject: `${user.email} invited you to join "${trip.name}" on CloudTrips`,
        htmlContent: `
          <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px">
            <h2 style="margin:0 0 8px;font-size:20px">You've been invited!</h2>
            <p style="color:#555;margin:0 0 24px">${user.email} has invited you to collaborate on <strong>${trip.name}</strong> on CloudTrips.</p>
            <a href="${inviteUrl}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 24px;border-radius:12px;font-weight:600">Accept invite</a>
            <p style="color:#999;font-size:12px;margin:24px 0 0">This invite expires in 7 days. If you don't have a CloudTrips account, you'll be asked to create one first.</p>
          </div>
        `
      })
    });
  } catch (err) {
    console.error('Brevo error:', err);
    // Don't fail the request if email fails — invite is created
  }

  return json({ ok: true, message: `Invite sent to ${inviteEmail}.` });
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}
