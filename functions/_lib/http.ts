export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), {
    ...init,
    headers
  });
}

export function error(message: string, status = 400): Response {
  return json({ error: message }, { status });
}

export function methodNotAllowed(allowed: string[]): Response {
  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      allow: allowed.join(', ')
    }
  });
}
