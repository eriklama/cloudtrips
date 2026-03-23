interface Env {
  TRIPS: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const data = await env.TRIPS.get('trips');

  let trips: unknown = [];
  if (data) {
    try {
      trips = JSON.parse(data);
    } catch {
      trips = [];
    }
  }

  return new Response(JSON.stringify(trips), {
    headers: {
      'content-type': 'application/json; charset=UTF-8',
      'cache-control': 'no-store'
    }
  });
};
