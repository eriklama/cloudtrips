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
    const url = new URL(request.url);
    const tripId = url.searchParams.get('trip')?.trim();
    const pin = request.headers.get('x-pin')?.trim();

    if (!tripId || !pin) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const tripResult = await env.DB.prepare(
      `
      SELECT id, name, pin
      FROM trips
      WHERE id = ?
      LIMIT 1
      `
    )
      .bind(tripId)
      .first<TripRow>();

    if (!tripResult) {
      return json({ error: 'Trip not found' }, 404);
    }

    if (tripResult.pin !== pin) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const activityResult = await env.DB.prepare(
      `
      SELECT id, trip_id, type, location, start, end, cost, notes
      FROM activities
      WHERE trip_id = ?
      ORDER BY start ASC, id ASC
      `
    )
      .bind(tripId)
      .all<ActivityRow>();

    const activities: Activity[] = (activityResult.results ?? []).map((row) => ({
      id: row.id,
      type: row.type ?? 'other',
      location: row.location ?? '',
      start: row.start ?? '',
      end: row.end ?? '',
      cost: Number(row.cost ?? 0),
      notes: row.notes ?? '',
    }));

    const trip: Trip = {
      id: tripResult.id,
      name: tripResult.name,
      activities,
    };

    return json(trip);
  } catch (error) {
    console.error('getTrip failed', error);
    return json({ error: 'Failed to load trip' }, 500);
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
