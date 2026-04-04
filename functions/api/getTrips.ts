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
  const { request, env } = context;

  const user = await requireUser(request, env);
  if (!user) {
    return error('Unauthorized.', 401);
  }

  const result = await env.DB
    .prepare(`
      SELECT id, name, activities_json, created_at
      FROM trips
      WHERE user_id = ?
      ORDER BY COALESCE(created_at, '') DESC, name ASC
    `)
    .bind(user.id)
    .all<TripRow>();

  const rows = Array.isArray(result.results) ? result.results : [];

  const trips = rows.map((row) => {
    let activities: any[] = [];
    try {
      const parsed = JSON.parse(row.activities_json || '[]');
      activities = Array.isArray(parsed) ? parsed : [];
    } catch {
      activities = [];
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

  return json(trips);
}

export function onRequest() {
  return methodNotAllowed(['GET']);
}
