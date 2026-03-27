export interface Env {
  DB: D1Database;
}

type IncomingActivity = {
  id?: string;
  type?: string;
  location?: string;
  start?: string;
  end?: string;
  cost?: number | string | null;
  km?: number | string | null;
  notes?: string;
};

type NormalizedActivity = {
  id: string;
  type: string;
  location: string;
  start: string;
  end: string;
  cost: number;
  km: number;
  notes: string;
};

type NormalizedTrip = {
  id: string;
  name: string;
  pin: string;
  activities: NormalizedActivity[];
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const url = new URL(request.url);
    const tripIdFromQuery = url.searchParams.get('trip')?.trim();

    const body = (await request.json()) as unknown;
    if (!isRecord(body)) {
      return json({ error: 'Expected a trip object' }, 400);
    }

    const trip = normalizeTrip(body);

    if (!tripIdFromQuery) {
      if (!trip.pin) {
        return json({ error: 'PIN is required' }, 400);
      }

      await env.DB.prepare(
        `
        INSERT INTO trips (id, name, pin)
        VALUES (?, ?, ?)
        `
      )
        .bind(trip.id, trip.name, trip.pin)
        .run();

      for (const activity of trip.activities) {
        await env.DB.prepare(
          `
          INSERT INTO activities (
            id,
            trip_id,
            type,
            location,
            start,
            end,
            cost,
            km,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
          .bind(
            activity.id,
            trip.id,
            activity.type,
            activity.location,
            activity.start,
            activity.end,
            activity.cost,
            activity.km,
            activity.notes
          )
          .run();
      }

      return json({ ok: true, id: trip.id });
    }

    const pin = request.headers.get('x-pin')?.trim();
    if (!pin) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const existingTrip = await env.DB.prepare(
      `
      SELECT id, pin
      FROM trips
      WHERE id = ?
      LIMIT 1
      `
    )
      .bind(tripIdFromQuery)
      .first<{ id: string; pin: string }>();

    if (!existingTrip) {
      return json({ error: 'Trip not found' }, 404);
    }

    if (existingTrip.pin !== pin) {
      return json({ error: 'Unauthorized' }, 401);
    }

    if (trip.id !== tripIdFromQuery) {
      return json({ error: 'Trip ID mismatch' }, 400);
    }

    const statements: D1PreparedStatement[] = [];

    statements.push(
      env.DB.prepare(
        `
        UPDATE trips
        SET name = ?
        WHERE id = ?
        `
      ).bind(trip.name, trip.id)
    );

    statements.push(
      env.DB.prepare(
        `
        DELETE FROM activities
        WHERE trip_id = ?
        `
      ).bind(trip.id)
    );

    for (const activity of trip.activities) {
      statements.push(
        env.DB.prepare(
          `
          INSERT INTO activities (
            id,
            trip_id,
            type,
            location,
            start,
            end,
            cost,
            km,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        ).bind(
          activity.id,
          trip.id,
          activity.type,
          activity.location,
          activity.start,
          activity.end,
          activity.cost,
          activity.km,
          activity.notes
        )
      );
    }

    await env.DB.batch(statements);

    return json({ ok: true });
  } catch (error) {
    console.error('saveTrip failed', error);
    return json({ error: 'Failed to save trip' }, 500);
  }
};

function normalizeTrip(input: Record<string, unknown>): NormalizedTrip {
  const tripId = asNonEmptyString(input.id) || `trip_${Date.now()}`;
  const tripName = asNonEmptyString(input.name) || 'Untitled trip';
  const tripPin = asNonEmptyString(input.pin);

  const rawActivities = Array.isArray(input.activities) ? input.activities : [];

  const activities: NormalizedActivity[] = rawActivities.map((activity, index) => {
    const a = isRecord(activity) ? activity : {};

    return {
      id: asNonEmptyString(a.id) || `activity_${tripId}_${index}`,
      type: asNonEmptyString(a.type) || 'other',
      location: asString(a.location),
      start: asString(a.start),
      end: asString(a.end),
      cost: asNumber(a.cost),
      km: asNumber(a.km),
      notes: asString(a.notes),
    };
  });

  return {
    id: tripId,
    name: tripName,
    pin: tripPin,
    activities,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNonEmptyString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
