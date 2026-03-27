export interface Env {
  DB: D1Database;
}

type TripRow = {
  id: string;
  name: string;
  pin: string;
};

type ActivityRow = {
  id: string;
  trip_id: string;
  type: string | null;
  location: string | null;
  start: string | null;
  end: string | null;
  cost: number | string | null;
  notes: string | null;
};

type Activity = {
  id: string;
  type: string;
  location: string;
  start: string;
  end: string;
  cost: number;
  notes: string;
};

type Trip = {
  id: string;
  name: string;
  activities: Activity[];
};

export const onRequestGet: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const pin = request.headers.get('x-pin')?.trim();

    if (!pin) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const tripResult = await env.DB.prepare(
      `
      SELECT id, name, pin
      FROM trips
      WHERE pin = ?
      ORDER BY name COLLATE NOCASE
      `
    )
      .bind(pin)
      .all<TripRow>();

    const tripRows = tripResult.results ?? [];

    if (tripRows.length === 0) {
      return json([]);
    }

    const tripIds = tripRows.map((trip) => trip.id);
    const placeholders = tripIds.map(() => '?').join(', ');

    const activityResult = await env.DB.prepare(
      `
      SELECT id, trip_id, type, location, start, end, cost, notes
      FROM activities
      WHERE trip_id IN (${placeholders})
      ORDER BY start ASC, id ASC
      `
    )
      .bind(...tripIds)
      .all<ActivityRow>();

    const activityRows = activityResult.results ?? [];

    const activitiesByTripId = new Map<string, Activity[]>();

    for (const row of activityRows) {
      const activity: Activity = {
        id: row.id,
        type: row.type ?? 'other',
        location: row.location ?? '',
        start: row.start ?? '',
        end: row.end ?? '',
        cost: Number(row.cost ?? 0),
        notes: row.notes ?? '',
      };

      const existing = activitiesByTripId.get(row.trip_id) ?? [];
      existing.push(activity);
      activitiesByTripId.set(row.trip_id, existing);
    }

    const trips: Trip[] = tripRows.map((trip) => ({
      id: trip.id,
      name: trip.name,
      activities: activitiesByTripId.get(trip.id) ?? [],
    }));

    return json(trips);
  } catch (error) {
    console.error('getTrips failed', error);
    return json({ error: 'Failed to load trips' }, 500);
  }
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
