export const onRequestGet = async ({ env }) => {
  return new Response(JSON.stringify({
    hasKV: !!env.TRIPS
  }), {
    headers: { 'content-type': 'application/json' }
  });
};
