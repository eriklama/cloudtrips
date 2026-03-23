interface Env {
  DB: D1Database;
}

type TripRow = {
  id: string;
  name: string;
};

type ActivityRow = {
  id: string;
  trip_id: string;
  type: string;
  location: string | null;
  start: string | null;
  end: string | null;
  cost: number | null;
  notes: string | null;
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const tripsResult = await env.DB
      .prepare('SELECT id, name FROM trips ORDER BY rowid DESC')
      .all<TripRow>();

    const activitiesResult = await env.DB
      .prepare(`
        SELECT id, trip_id, type, location, start, "end", cost, notes
        FROM activities
        ORDER BY datetime(start) ASC, rowid ASC
      `)
      .all<ActivityRow>();

    const trips = (tripsResult.results || []).map((trip) => ({
      id: trip.id,
      name: trip.name,
      activities: [] as Array<{
        id: string;
        type: string;
        location: string;
        start: string;
        end: string;
        cost: number;
        notes: string;
      }>
    }));

    const byTripId = new Map(trips.map((t) => [String(t.id), t]));

    for (const a of activitiesResult.results || []) {
      const trip = byTripId.get(String(a.trip_id));
      if (!trip) continue;

      trip.activities.push({
        id: a.id,
        type: a.type,
        location: a.location ?? '',
        start: a.start ?? '',
        end: a.end ?? '',
        cost: Number(a.cost ?? 0),
        notes: a.notes ?? ''
      });
    }

    return new Response(JSON.stringify(trips), {
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'cache-control': 'no-store'
      }
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: 'D1 read failed',
        message: String(e)
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'cache-control': 'no-store'
        }
      }
    );
  }
};
