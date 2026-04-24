import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

type TripRow = {
  id: string;
  name: string;
  activities_json: string | null;
  created_at?: string | null;
};

function safeParseActivities(value: string | null): any[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { env } = context;

  let user: { id: string; email?: string };
  try {
    user = await requireUser(context);
  } catch (err) {
    console.warn('Auth failed (getTrips):', err);
    return error('Unauthorized.', 401);
  }

  try {
    const result = await env.DB
      .prepare(`
        SELECT id, name, activities_json, created_at
        FROM trips
        WHERE user_id = ?
        ORDER BY COALESCE(created_at, '') DESC, name ASC
      `)
      .bind(user.id)
      .all<TripRow>();

    const rows = Array.isArray(result?.results) ? result.results : [];

    const trips = rows.map((row) => {
      const activities = safeParseActivities(row.activities_json);

      const dated = activities
        .map((a) => ({
          startDate: String(a?.startDate || '').trim(),
          endDate: String(a?.endDate || '').trim()
        }))
        .filter((a) => a.startDate || a.endDate);

      const startDates = dated.map((a) => a.startDate).filter(Boolean).sort();
      const endDates = dated.map((a) => a.endDate).filter(Boolean).sort();

      return {
        id: row.id,
        name: row.name,
        activitiesCount: activities.length,
        startDate: startDates[0] || '',
        endDate: endDates[endDates.length - 1] || startDates[startDates.length - 1] || ''
      };
    });

    return json({
      ok: true,
      trips
    });
  } catch (err) {
    console.error('DB error (getTrips):', err);
    return error('Failed to load trips.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }
  return onRequestGet(context);
}
