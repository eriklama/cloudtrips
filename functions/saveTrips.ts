interface Env {
  DB: D1Database;
}

type IncomingActivity = {
  id?: string;
  type?: string;
  location?: string;
  start?: string;
  end?: string;
  cost?: number;
  notes?: string;
};

type IncomingTrip = {
  id?: string;
  name?: string;
  activities?: IncomingActivity[];
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const body = await request.json<IncomingTrip[]>();

    if (!Array.isArray(body)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid payload',
          message: 'Trips payload must be an array'
        }),
        {
          status: 400,
          headers: {
            'content-type': 'application/json; charset=UTF-8',
            'cache-control': 'no-store'
          }
        }
      );
    }

    const trips = body.map((trip) => ({
      id: String(trip.id ?? ''),
      name: String(trip.name ?? '').trim(),
      activities: Array.isArray(trip.activities) ? trip.activities : []
    }));

    for (const trip of trips) {
      if (!trip.id || !trip.name) {
        return new Response(
          JSON.stringify({
            error: 'Invalid trip',
            message: 'Each trip must have id and name'
          }),
          {
            status: 400,
            headers: {
              'content-type': 'application/json; charset=UTF-8',
              'cache-control': 'no-store'
            }
          }
        );
      }
    }

    await env.DB.exec('PRAGMA foreign_keys = ON;');

    const statements: D1PreparedStatement[] = [
      env.DB.prepare('DELETE FROM activities'),
      env.DB.prepare('DELETE FROM trips')
    ];

    for (const trip of trips) {
      statements.push(
        env.DB
          .prepare('INSERT INTO trips (id, name) VALUES (?, ?)')
          .bind(trip.id, trip.name)
      );

      for (const a of trip.activities) {
        const activityId = String(a.id ?? `a${Date.now()}${Math.random().toString(36).slice(2, 8)}`);
        const type = String(a.type ?? 'other');
        const location = String(a.location ?? '');
        const start = String(a.start ?? '');
        const end = String(a.end ?? '');
        const cost = Number(a.cost ?? 0);
        const notes = String(a.notes ?? '');

        statements.push(
          env.DB
            .prepare(`
              INSERT INTO activities (id, trip_id, type, location, start, "end", cost, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `)
            .bind(activityId, trip.id, type, location, start, end, cost, notes)
        );
      }
    }

    await env.DB.batch(statements);

    return new Response(
      JSON.stringify({
        ok: true,
        count: trips.length
      }),
      {
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'cache-control': 'no-store'
        }
      }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: 'D1 write failed',
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
