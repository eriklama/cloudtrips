import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

type TripRow = {
  id: string;
  name: string;
  activities_json: string | null;
};

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  // 🔐 Auth
  const user = await requireUser(request, env);
  if (!user) {
    return error('Unauthorized.', 401);
  }

  // 📥 Input
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return error('Trip id is required.', 400);
  }

  // 📦 DB query
  let row: TripRow | null = null;
  try {
    row = await env.DB
      .prepare(`
        SELECT id, name, activities_json
        FROM trips
        WHERE id = ? AND user_id = ?
        LIMIT 1
      `)
      .bind(id, user.id)
      .first<TripRow>();
  } catch (err) {
    console.error('DB error (getTrip):', err);
    return error('Failed to load trip.', 500);
  }

  if (!row) {
    return error('Trip not found.', 404);
  }

  // 🧠 Parse activities safely
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

  // ✅ Response
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
