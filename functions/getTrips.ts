export const onRequestGet = async ({ env }: any) => {
  try {
    const raw = await env.TRIPS.get('trips');

    if (!raw) {
      return new Response('[]', {
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store"
        }
      });
    }

    let data;

    try {
      data = JSON.parse(raw);
    } catch {
      data = [];
    }

    if (!Array.isArray(data)) {
      data = [];
    }

    return new Response(JSON.stringify(data), {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store"
      }
    });

  } catch (e) {
    return new Response(JSON.stringify({
      error: "KV read failed",
      message: String(e)
    }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};
