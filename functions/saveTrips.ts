interface Env {
  TRIPS: KVNamespace;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const trips = await request.json();

    if (!Array.isArray(trips)) {
      return new Response(JSON.stringify({ ok: false, error: 'Trips payload must be an array.' }), {
        status: 400,
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'cache-control': 'no-store'
        }
      });
    }

    const payload = JSON.stringify({
      updated: Date.now(),
      data: trips
    });

    if (payload.length > 1_000_000) {
      return new Response(JSON.stringify({ ok: false, error: 'Payload too large' }), {
        status: 413,
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'cache-control': 'no-store'
        }
      });
    }

    await env.TRIPS.put('trips', payload);

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'cache-control': 'no-store'
      }
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body.' }), {
      status: 400,
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'cache-control': 'no-store'
      }
    });
  }
};
