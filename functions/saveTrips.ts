interface Env {
  TRIPS: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const trips = await request.json();

    if (!Array.isArray(trips)) {
      return new Response(JSON.stringify({ ok: false, error: 'Trips payload must be an array.' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=UTF-8' }
      });
    }

    await env.TRIPS.put('trips', JSON.stringify(trips));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body.' }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }
};
