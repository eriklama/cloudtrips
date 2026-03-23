export const onRequestPost = async ({ request, env }: any) => {
  try {
    const trips = await request.json();

    await env.TRIPS?.put('trips', JSON.stringify(trips));

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({
      error: "KV write failed",
      message: String(e)
    }), {
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
};
