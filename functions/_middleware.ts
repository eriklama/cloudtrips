const ALLOWED_ORIGINS = new Set([
  'https://cloudtrips.uk',
  'https://www.cloudtrips.uk',
  'https://cloudtrips.pages.dev'
]);

export async function onRequest(context: any) {
  const { request, next, env } = context;
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

  // Log errors to D1:
  // - All 5xx (server errors)
  // - 4xx from /api/ except 401 (401 = normal "not logged in", not worth logging)
  const reqUrl = new URL(request.url);
  const shouldLog =
    response.status >= 500 ||
    (response.status >= 400 && response.status !== 401 && reqUrl.pathname.startsWith('/api/'));
  if (shouldLog) {
    try {
      const url = new URL(request.url);
      const cloned = response.clone();
      let message = '';
      try {
        const body = await cloned.json() as any;
        message = body?.error || String(response.status);
      } catch {
        message = String(response.status);
      }

      // Extract user_id from JWT if present (best effort)
      let userId: string | null = null;
      try {
        const auth = request.headers.get('Authorization') || '';
        const token = auth.replace('Bearer ', '');
        if (token) {
          const payload = JSON.parse(atob(token.split('.')[1]));
          userId = payload?.sub || null;
        }
      } catch { /* ignore */ }

      await env.DB.prepare(`
        INSERT INTO error_logs (id, endpoint, method, status, message, user_id, ip, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).bind(
        crypto.randomUUID(),
        url.pathname,
        request.method,
        response.status,
        message.slice(0, 500),
        userId,
        request.headers.get('cf-connecting-ip') || null
      ).run();
    } catch (logErr) {
      console.error('Failed to log error:', logErr);
    }
  }

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