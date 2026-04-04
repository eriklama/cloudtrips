export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const { request, env } = context;

    const user = await requireUser(request, env);
    if (!user) {
      return error('Unauthorized.', 401);
    }

    const result = await env.DB
      .prepare(`
        SELECT id, name, activities_json, created_at
        FROM trips
        WHERE user_id = ?
      `)
      .bind(user.id)
      .all();

    return json({
      ok: true,
      trips: result.results || []
    });

  } catch (err: any) {
    console.error('GET TRIPS ERROR:', err);

    return new Response(JSON.stringify({
      error: err?.message || String(err)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
