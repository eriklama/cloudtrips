import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

type TripRow = {
  id: string;
  name: string;
  activities_json: string | null;
  created_at?: string | null;
};

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { env } = context;

  // 🔐 STRICT AUTH (no silent fallback!)
  let user;
  try {
    user = await requireUser(context);
  } catch (err) {
    console.warn('Auth failed (getTrips):', err);
    return error('Unauthorized', 401);
  }

  // 📦 Fetch trips for user
  let result;
  try {
    result = await env.DB
      .prepare(`
        SELECT id, name, activities_json, created_at
        FROM trips
        WHERE user_id = ?
        ORDER BY COALESCE(created_at, '') DESC, name ASC
      `)
      .bind(user.id)
      .all<TripRow>();
  } catch (err) {
    console.error('DB error (getTrips):', err);
    return error('Failed to load trips.', 500);
  }

  const rows = Array.isArray(result?.results) ? result.results : [];

  // 🧠 Transform
  const trips = rows.map((row) => {
    let activities: any[] = [];

    if (row.activities_json) {
      try {
        const parsed = JSON.parse(row.activities_json);
        if (Array.isArray(parsed)) {
          activities = parsed;
        }
      } catch {
        // ignore corrupted JSON
        activities = [];
      }
    }

    const sortedDates = activities
      .map((a) => a?.startDate || '')
      .filter(Boolean)
      .sort();

    return {
      id: row.id,
      name: row.name,
      activitiesCount: activities.length,
      startDate: sortedDates[0] || '',
      endDate: sortedDates[sortedDates.length - 1] || ''
    };
  });

  // ✅ Correct response
  return json({
    ok: true,
    trips
  });
}

/* ---------- METHOD GUARD ---------- */

export function onRequest() {
  return methodNotAllowed(['GET']);
}
