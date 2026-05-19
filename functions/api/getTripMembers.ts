import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import { canAccessTrip } from '../_lib/members';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  let user: { id: string };
  try { user = await requireUser(context); } catch { return error('Unauthorized.', 401); }

  const tripId = new URL(request.url).searchParams.get('tripId')?.trim();
  if (!tripId) return error('tripId is required.', 400);

  const { access, isOwner } = await canAccessTrip(env, tripId, user.id);
  if (!access) return error('Trip not found.', 404);

  const [membersResult, pendingResult] = await Promise.all([
    env.DB.prepare(`
      SELECT tm.id, tm.user_id, tm.role, tm.created_at, u.email
      FROM trip_members tm
      JOIN users u ON u.id = tm.user_id
      WHERE tm.trip_id = ?
      ORDER BY tm.created_at ASC
    `).bind(tripId).all<{ id: string; user_id: string; role: string; created_at: string; email: string }>(),

    env.DB.prepare(`
      SELECT id, email, expires_at, created_at
      FROM trip_invites
      WHERE trip_id = ? AND accepted_at IS NULL AND expires_at > datetime('now')
      ORDER BY created_at DESC
    `).bind(tripId).all<{ id: string; email: string; expires_at: string; created_at: string }>()
  ]);

  // Get owner info
  const owner = await env.DB
    .prepare(`SELECT id, email FROM users WHERE id = (SELECT user_id FROM trips WHERE id = ?) LIMIT 1`)
    .bind(tripId)
    .first<{ id: string; email: string }>();

  return json({
    ok: true,
    isOwner,
    owner: owner ? { id: owner.id, email: owner.email } : null,
    members: membersResult.results ?? [],
    pendingInvites: pendingResult.results ?? []
  });
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  return onRequestGet(context);
}
