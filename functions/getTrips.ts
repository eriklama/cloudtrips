interface Env {
  TRIPS: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const raw = await env.TRIPS.get('trips');

    if (!raw) {
      return new Response('[]', {
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'cache-control': 'no-store'
        }
      });
    }

    let parsed: any;

    try {
      parsed = JSON.parse(raw);
    } catch {
      // corrupted KV data → fallback
      return new Response('[]', {
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'cache-control': 'no-store'
        }
      });
    }

    // ✅ Support BOTH formats:
    // 1. old: [...]
    // 2. new: { updated, data: [...] }

    let trips;

    if (Array.isArray(parsed)) {
      trips = parsed; // old format
    } else if (parsed && Array.isArray(parsed.data)) {
      trips = parsed.data; // new format
    } else {
      trips = [];
    }

    return new Response(JSON.stringify(trips), {
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'cache-control': 'no-store'
      }
    });

  } catch {
    return new Response('[]', {
      status: 500,
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'cache-control': 'no-store'
      }
    });
  }
};
