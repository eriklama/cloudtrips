export const onRequestGet = async ({ env }: any) => {
  try {
    const raw = await env.TRIPS?.get('trips');

    return new Response(raw || '[]', {
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
