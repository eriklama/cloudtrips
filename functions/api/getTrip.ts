import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

type TripRow = {
  id: string;
  name: string;
  activities_json: string | null;
  share_token?: string | null;
  share_enabled?: number | null;
};

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const token = url.searchParams.get('token');

  if (!id) {
    return error('Trip id is required.', 400);
  }

  let row: TripRow | null = null;

  try {
    // =========================================
    // 🔓 1. GUEST ACCESS (via share token)
    // =========================================
    if (token) {
      row = await env.DB
        .prepare(`
          SELECT id, name, activities_json, share_token, share_enabled
          FROM trips
          WHERE id = ?
            AND share_enabled = 1
            AND share_token = ?
          LIMIT 1
        `)
        .bind(id, token)
        .first<TripRow>();

      if (!row) {
        return error('Invalid or expired share link.', 401);
      }
    } else {
      // =========================================
      // 🔐 2. OWNER ACCESS (auth required)
      // =========================================
      const user = await requireUser(request, env);
      if (!user) {
        return error('Unauthorized.', 401);
      }

      row = await env.DB
        .prepare(`
          SELECT id, name, activities_json
          FROM trips
          WHERE id = ? AND user_id = ?
          LIMIT 1
        `)
        .bind(id, user.id)
        .first<TripRow>();

      if (!row) {
        return error('Trip not found.', 404);
      }
    }
  } catch (err) {
    console.error('DB error (getTrip):', err);
    return error('Failed to load trip.', 500);
  }

  // =========================================
  // 🧠 Parse activities safely
  // =========================================
  let activities: any[] = [];

  if (row.activities_json) {
    try {
      const parsed = JSON.parse(row.activities_json);
      if (Array.isArray(parsed)) {
        activities = parsed;
      }
    } catch {
      activities = [];
    }
  }

  // =========================================
  // ✅ Response
  // =========================================
  return json({
    ok: true,
    trip: {
      id: row.id,
      name: row.name,
      activities
    }
  });
}

export function onRequest() {
  return methodNotAllowed(['GET']);
}
