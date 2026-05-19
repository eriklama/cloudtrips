import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import { hashInviteToken } from '../_lib/members';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const params = new URL(request.url).searchParams;
  const token = params.get('token')?.trim();

  if (!token) return error('Token is required.', 400);

  const tokenHash = await hashInviteToken(token);

  // Find valid invite
  const invite = await env.DB
    .prepare(`
      SELECT id, trip_id, email, expires_at, accepted_at
      FROM trip_invites
      WHERE token_hash = ? LIMIT 1
    `)
    .bind(tokenHash)
    .first<{ id: string; trip_id: string; email: string; expires_at: string; accepted_at: string | null }>();

  if (!invite) return error('Invalid or expired invite link.', 404);
  if (invite.accepted_at) return error('This invite has already been accepted.', 409);
  if (new Date(invite.expires_at) < new Date()) return error('This invite has expired.', 410);

  // Require auth — user must be logged in to accept
  let user: { id: string; email: string };
  try {
    user = await requireUser(context) as { id: string; email: string };
  } catch {
    // Return a special response so the frontend can redirect to login with the token preserved
    return json({ ok: false, requiresAuth: true, token });
  }

  // Email must match (or we allow any logged-in user if email is not registered)
  const invitedUserRow = await env.DB
    .prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`)
    .bind(invite.email)
    .first<{ id: string }>();

  // If the invited email belongs to a different account, reject
  if (invitedUserRow && invitedUserRow.id !== user.id) {
    return error('This invite was sent to a different email address.', 403);
  }

  // Add to trip_members
  try {
    await env.DB
      .prepare(`
        INSERT OR IGNORE INTO trip_members (trip_id, user_id, role, invited_by)
        SELECT ?, ?, 'editor', invited_by FROM trip_invites WHERE id = ?
      `)
      .bind(invite.trip_id, user.id, invite.id)
      .run();

    // Mark invite as accepted
    await env.DB
      .prepare(`UPDATE trip_invites SET accepted_at = datetime('now') WHERE id = ?`)
      .bind(invite.id)
      .run();

    // Get trip name for response
    const trip = await env.DB
      .prepare(`SELECT id, name FROM trips WHERE id = ? LIMIT 1`)
      .bind(invite.trip_id)
      .first<{ id: string; name: string }>();

    return json({ ok: true, tripId: invite.trip_id, tripName: trip?.name || '' });
  } catch (err) {
    console.error('acceptInvite error:', err);
    return error('Failed to accept invite.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  return onRequestGet(context);
}
