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

    await env.DB
      .prepare(`
        UPDATE trips
        SET share_token = NULL,
            share_enabled = 0
        WHERE id = ?
      `)
      .bind(tripId)
      .run();

    return json({ ok: true });
  } catch (error) {
    console.error('disableShare error:', error);
    return json({ error: 'Failed to disable sharing' }, 500);
  }
}
