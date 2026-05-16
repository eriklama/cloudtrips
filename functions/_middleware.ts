const ALLOWED_ORIGINS = new Set([
  'https://cloudtrips.uk',
  'https://www.cloudtrips.uk',
  'https://cloudtrips.pages.dev'
]);

export async function onRequest(context: any) {
  const { request, next } = context;
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.has(origin);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(allowed ? origin : '')
    });
  }

  const response = await next();

  // Attach CORS headers to all responses
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders(allowed ? origin : '')).forEach(([k, v]) => newHeaders.set(k, v));

  return new Response(response.body, {
    status: response.status,
    headers: newHeaders
  });
}

function corsHeaders(origin: string) {
  return {
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin'
  };
}