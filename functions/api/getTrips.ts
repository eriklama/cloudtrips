import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

type TripSummaryRow = {
  id: string;
  name: string;
  notes: string | null;
  country: string | null;
  created_at: string | null;
  activities_count: number;
  start_date: string | null;
  end_date: string | null;
  is_shared: number; // 0 = owned, 1 = shared with me
  owner_email: string | null;
};

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
        SELECT
          t.id,
          t.name,
          t.notes,
          t.country,
          t.created_at,
          COUNT(a.id)                          AS activities_count,
          MIN(NULLIF(a.start_date, ''))         AS start_date,
          MAX(
            CASE
              WHEN a.end_date != '' THEN a.end_date
              ELSE a.start_date
            END
          )                                    AS end_date,
          CASE WHEN t.user_id = ? THEN 0 ELSE 1 END AS is_shared,
          ou.email                             AS owner_email
        FROM trips t
        LEFT JOIN activities a ON a.trip_id = t.id
        LEFT JOIN users ou ON ou.id = t.user_id
        WHERE t.user_id = ?
           OR EXISTS (
             SELECT 1 FROM trip_members tm
             WHERE tm.trip_id = t.id AND tm.user_id = ?
           )
        GROUP BY t.id
        ORDER BY COALESCE(t.created_at, '') DESC, t.name ASC
      `)
      .bind(user.id, user.id, user.id)
      .all<TripSummaryRow>();

    const rows = Array.isArray(result?.results) ? result.results : [];

    const trips = rows.map((row) => ({
      id: row.id,
      name: row.name,
      notes: row.notes ?? '',
      country: row.country ?? '',
      activitiesCount: Number(row.activities_count ?? 0),
      startDate: row.start_date ?? '',
      endDate: row.end_date ?? '',
      isShared: Boolean(row.is_shared),
      ownerEmail: row.is_shared ? (row.owner_email ?? '') : null
    }));

    return json({ ok: true, trips });
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
