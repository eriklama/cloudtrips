export async function onRequest(context: any) {
  const { request, next } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders()
    });
  }

  const response = await next();

  // Attach CORS headers to all responses
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders()).forEach(([k, v]) => newHeaders.set(k, v));

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };
}
