export interface Env {
  DB: D1Database;
}

type TripListRow = {
  id: string;
  name: string;
};

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const result = await env.DB.prepare(
      `
      SELECT id, name
      FROM trips
      ORDER BY name COLLATE NOCASE
      `
    ).all<TripListRow>();

    return json(result.results ?? []);
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
