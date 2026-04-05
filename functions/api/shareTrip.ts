export interface Env {
  DB: D1Database;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  try {
    const body = await request.json().catch(() => null) as { tripId?: string } | null;
    const tripId = body?.tripId?.trim();

    if (!tripId) {
      return json({ error: 'Missing tripId' }, 400);
    }

    const token = crypto.randomUUID();

    const existing = await env.DB
      .prepare('SELECT id FROM trips WHERE id = ?')
      .bind(tripId)
      .first();

    if (!existing) {
      return json({ error: 'Trip not found' }, 404);
    }

    await env.DB
      .prepare(`
        UPDATE trips
        SET share_token = ?, share_enabled = 1
        WHERE id = ?
      `)
      .bind(token, tripId)
      .run();

    return json({
      ok: true,
      tripId,
      shareUrl: `/trip.html?id=${encodeURIComponent(tripId)}&token=${encodeURIComponent(token)}`
    });
  } catch (error) {
    console.error('shareTrip error:', error);
    return json({ error: 'Failed to create share link' }, 500);
  }
}
