export interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const url = new URL(request.url);
    const tripId = url.searchParams.get('trip')?.trim();
    const pin = request.headers.get('x-pin')?.trim();

    if (!tripId || !pin) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // Check trip + PIN
    const trip = await env.DB.prepare(
      `SELECT id, pin FROM trips WHERE id = ? LIMIT 1`
    )
      .bind(tripId)
      .first<{ id: string; pin: string }>();

    if (!trip) {
      return json({ error: 'Trip not found' }, 404);
    }

    if (trip.pin !== pin) {
      return json({ error: 'Unauthorized' }, 401);
    }

    // Delete activities first (FK safety)
    await env.DB.prepare(
      `DELETE FROM activities WHERE trip_id = ?`
    )
      .bind(tripId)
      .run();

    // Delete trip
    await env.DB.prepare(
      `DELETE FROM trips WHERE id = ?`
    )
      .bind(tripId)
      .run();

    return json({ ok: true });
  } catch (e) {
    console.error('deleteTrip failed', e);
    return json({ error: 'Failed to delete trip' }, 500);
  }
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
