import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import { isTripOwner } from '../_lib/members';

export async function onRequestPost(context: { request: Request; env: Env }) {
  const { request, env } = context;

  let user: { id: string };
  try { user = await requireUser(context); } catch { return error('Unauthorized.', 401); }

  let body: any;
  try { body = await request.json(); } catch { return error('Invalid JSON.', 400); }

  const tripId = String(body?.tripId || '').trim();
  const memberId = String(body?.memberId || '').trim();   // user_id to remove
  const inviteId = String(body?.inviteId || '').trim();   // invite id to cancel

  if (!tripId) return error('tripId is required.', 400);
  if (!memberId && !inviteId) return error('memberId or inviteId is required.', 400);

  const isOwner = await isTripOwner(env, tripId, user.id);

  // Members can remove themselves; owners can remove anyone
  if (memberId) {
    if (!isOwner && memberId !== user.id) return error('Only the owner can remove other members.', 403);

    const result = await env.DB
      .prepare(`DELETE FROM trip_members WHERE trip_id = ? AND user_id = ?`)
      .bind(tripId, memberId)
      .run();

    if (!result.meta?.changes) return error('Member not found.', 404);
    return json({ ok: true });
  }

  if (inviteId) {
    if (!isOwner) return error('Only the owner can cancel invites.', 403);

    const result = await env.DB
      .prepare(`DELETE FROM trip_invites WHERE id = ? AND trip_id = ?`)
      .bind(inviteId, tripId)
      .run();

    if (!result.meta?.changes) return error('Invite not found.', 404);
    return json({ ok: true });
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'POST') return methodNotAllowed(['POST']);
  return onRequestPost(context);
}
