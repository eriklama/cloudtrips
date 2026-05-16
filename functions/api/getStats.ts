import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

/**
 * GET /api/getStats
 *
 * Returns aggregated stats across all trips for the authenticated user.
 * Per-trip: id, name, country, startDate, endDate, days, activitiesCount, totalKm, costsByCurrency
 * All-time: totalTrips, totalDays, totalKm, totalActivities, countries visited
 */

type TripStatsRow = {
  id: string;
  name: string;
  country: string | null;
  created_at: string | null;
  activities_count: number;
  total_km: number;
  start_date: string | null;
  end_date: string | null;
};

type CostRow = {
  trip_id: string;
  currency: string;
  total: number;
};

type DayRow = {
  trip_id: string;
  day_count: number;
};

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { env } = context;

  let user: { id: string };
  try {
    user = await requireUser(context);
  } catch {
    return error('Unauthorized.', 401);
  }

  try {
    const [tripsResult, costsResult, daysResult] = await Promise.all([
      // Trip summaries
      env.DB.prepare(`
        SELECT
          t.id,
          t.name,
          t.country,
          t.created_at,
          COUNT(a.id)                        AS activities_count,
          COALESCE(SUM(a.distance), 0)       AS total_km,
          MIN(NULLIF(a.start_date, ''))       AS start_date,
          MAX(
            CASE WHEN a.end_date != '' THEN a.end_date ELSE a.start_date END
          )                                  AS end_date
        FROM trips t
        LEFT JOIN activities a ON a.trip_id = t.id
        WHERE t.user_id = ?
        GROUP BY t.id
        ORDER BY MIN(NULLIF(a.start_date, '')) DESC, t.created_at DESC
      `).bind(user.id).all<TripStatsRow>(),

      // Costs per trip per currency
      env.DB.prepare(`
        SELECT a.trip_id, a.currency, SUM(a.cost) AS total
        FROM activities a
        INNER JOIN trips t ON t.id = a.trip_id
        WHERE t.user_id = ? AND a.cost > 0
        GROUP BY a.trip_id, a.currency
      `).bind(user.id).all<CostRow>(),

      // Distinct days per trip
      env.DB.prepare(`
        SELECT
          a.trip_id,
          COUNT(DISTINCT DATE(a.start_date)) AS day_count
        FROM activities a
        INNER JOIN trips t ON t.id = a.trip_id
        WHERE t.user_id = ? AND a.start_date != ''
        GROUP BY a.trip_id
      `).bind(user.id).all<DayRow>(),
    ]);

    const trips = tripsResult.results ?? [];
    const costs = costsResult.results ?? [];
    const days = daysResult.results ?? [];

    // Index costs and days by trip_id
    const costsByTrip: Record<string, Record<string, number>> = {};
    for (const row of costs) {
      if (!costsByTrip[row.trip_id]) costsByTrip[row.trip_id] = {};
      costsByTrip[row.trip_id][row.currency] = Number(row.total);
    }

    const daysByTrip: Record<string, number> = {};
    for (const row of days) {
      daysByTrip[row.trip_id] = Number(row.day_count);
    }

    const tripStats = trips.map(t => ({
      id: t.id,
      name: t.name,
      country: t.country ?? '',
      startDate: t.start_date ?? '',
      endDate: t.end_date ?? '',
      days: daysByTrip[t.id] ?? 0,
      activitiesCount: Number(t.activities_count ?? 0),
      totalKm: Number(t.total_km ?? 0),
      costsByCurrency: costsByTrip[t.id] ?? {}
    }));

    // All-time aggregates
    const totalTrips = tripStats.length;
    const totalDays = tripStats.reduce((s, t) => s + t.days, 0);
    const totalKm = tripStats.reduce((s, t) => s + t.totalKm, 0);
    const totalActivities = tripStats.reduce((s, t) => s + t.activitiesCount, 0);
    const countries = [...new Set(tripStats.map(t => t.country).filter(Boolean))];

    return json({
      ok: true,
      trips: tripStats,
      allTime: { totalTrips, totalDays, totalKm, totalActivities, countries }
    });
  } catch (err) {
    console.error('DB error (getStats):', err);
    return error('Failed to load stats.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'GET') return methodNotAllowed(['GET']);
  return onRequestGet(context);
}
