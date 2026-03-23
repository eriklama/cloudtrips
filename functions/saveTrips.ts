export const onRequestPost = async ({ request, env }: any) => {
  try {
    const trips = await request.json();

    if (!Array.isArray(trips)) {
      return new Response(JSON.stringify({
        error: "Invalid payload",
        message: "Trips payload must be an array"
      }), {
        status: 400,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store"
        }
      });
    }

    const payload = JSON.stringify(trips);

    if (payload.length > 1_000_000) {
      return new Response(JSON.stringify({
        error: "Payload too large"
      }), {
        status: 413,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store"
        }
      });
    }

    await env.TRIPS.put("trips", payload);

    return new Response(JSON.stringify({
      ok: true,
      count: trips.length
    }), {
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store"
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: "KV write failed",
      message: String(e)
    }), {
      status: 500,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store"
      }
    });
  }
};
