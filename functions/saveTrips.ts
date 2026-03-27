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
  notes?: string;
};

type IncomingTrip = {
  id?: string;
  name?: string;
  activities?: IncomingActivity[];
};

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const pin = request.headers.get('x-pin')?.trim();

    if (!pin) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const body = (await request.json()) as unknown;

    if (!Array.isArray(body)) {
      return json({ error: 'Expected an array of trips' }, 400);
    }

    const trips = normalizeTrips(body);

    // Find trips currently owned by this PIN.
    const existingTripsResult = await env.DB.prepare(
      `
      SELECT id
      FROM trips
      WHERE pin = ?
      `
    )
      .bind(pin)
      .all<{ id: string }>();

    const existingTripIds = (existingTripsResult.results ?? []).map((row) => row.id);

    const statements: D1PreparedStatement[] = [];

    // Delete activities belonging to this PIN's current trips first.
    if (existingTripIds.length > 0) {
      const placeholders = existingTripIds.map(() => '?').join(', ');
      statements.push(
        env.DB.prepare(
          `
          DELETE FROM activities
          WHERE trip_id IN (${placeholders})
          `
        ).bind(...existingTripIds)
      );
    }

    // Delete this PIN's trips.
    statements.push(
      env.DB.prepare(
        `
        DELETE FROM trips
        WHERE pin = ?
        `
      ).bind(pin)
    );

    // Re-insert trips and activities for this PIN only.
    for (const trip of trips) {
      statements.push(
        env.DB.prepare(
          `
          INSERT INTO trips (id, name, pin)
          VALUES (?, ?, ?)
          `
        ).bind(trip.id, trip.name, pin)
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
              notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `
          ).bind(
            activity.id,
            trip.id,
            activity.type,
            activity.location,
            activity.start,
            activity.end,
            activity.cost,
            activity.notes
          )
        );
      }
    }

    if (statements.length > 0) {
      await env.DB.batch(statements);
    }

    return json({ ok: true });
  } catch (error) {
    console.error('saveTrips failed', error);
    return json({ error: 'Failed to save trips' }, 500);
  }
};

function normalizeTrips(input: unknown[]): NormalizedTrip[] {
  return input.map((trip, tripIndex) => {
    const tripObj = isRecord(trip) ? trip : {};

    const tripId = asNonEmptyString(tripObj.id) || `trip_${Date.now()}_${tripIndex}`;
    const tripName = asNonEmptyString(tripObj.name) || 'Untitled trip';

    const rawActivities = Array.isArray(tripObj.activities) ? tripObj.activities : [];

    const activities = rawActivities.map((activity, activityIndex) => {
      const activityObj = isRecord(activity) ? activity : {};

      return {
        id: asNonEmptyString(activityObj.id) || `activity_${tripId}_${activityIndex}`,
        type: asNonEmptyString(activityObj.type) || 'other',
        location: asString(activityObj.location),
        start: asString(activityObj.start),
        end: asString(activityObj.end),
        cost: asNumber(activityObj.cost),
        notes: asString(activityObj.notes),
      };
    });

    return {
      id: tripId,
      name: tripName,
      activities,
    };
  });
}

type NormalizedTrip = {
  id: string;
  name: string;
  activities: NormalizedActivity[];
};

type NormalizedActivity = {
  id: string;
  type: string;
  location: string;
  start: string;
  end: string;
  cost: number;
  notes: string;
};

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
