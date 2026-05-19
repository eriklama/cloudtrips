import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

/**
 * GET /api/getStats
 *
 * Returns aggregated stats across all trips for the authenticated user.
 * Per-trip: id, name, country, startDate, endDate, days, activitiesCount, totalKm, costsByCurrency
 * All-time: totalTrips, totalDays, totalKm, totalActivities, countries visited
 *
 * NOTE: "days" is the trip length = (last day - first day) + 1, not distinct active days.
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

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { env } = context;

  let user: { id: string };
  try {
    user = await requireUser(context);
  } catch {
    return error('Unauthorized.', 401);
  }

  try {
    const [tripsResult, costsResult, userRow] = await Promise.all([
      // Trip summaries — start_date = earliest activity start, end_date = latest activity end/start
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

      // User visited countries
      env.DB.prepare(`SELECT visited_countries FROM users WHERE id = ? LIMIT 1`)
        .bind(user.id)
        .first<{ visited_countries: string }>(),
    ]);

    const trips = tripsResult.results ?? [];
    const costs = costsResult.results ?? [];

    // Index costs by trip_id
    const costsByTrip: Record<string, Record<string, number>> = {};
    for (const row of costs) {
      if (!costsByTrip[row.trip_id]) costsByTrip[row.trip_id] = {};
      costsByTrip[row.trip_id][row.currency] = Number(row.total);
    }

    // Calculate trip length as (last day - first day) + 1
    function tripLengthDays(startDate: string | null, endDate: string | null): number {
      if (!startDate) return 0;
      const start = new Date(startDate);
      const end = endDate ? new Date(endDate) : start;
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
      // Use date-only comparison (strip time)
      const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
      const endDay = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
      return Math.max(1, Math.round((endDay - startDay) / 86400000) + 1);
    }

    const tripStats = trips.map(t => ({
      id: t.id,
      name: t.name,
      country: t.country ?? '',
      startDate: t.start_date ?? '',
      endDate: t.end_date ?? '',
      days: tripLengthDays(t.start_date, t.end_date),
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

    // Parse visited countries
    let visitedCountries: string[] = [];
    try {
      visitedCountries = JSON.parse(userRow?.visited_countries || '[]');
    } catch { /* ignore */ }

    // Merge trip countries + manually visited countries
    const allVisited = [...new Set([
      ...tripStats.map(t => t.country).filter(Boolean),
      ...visitedCountries
    ])].sort();

    return json({
      ok: true,
      trips: tripStats,
      visitedCountries,
      allVisited,
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
