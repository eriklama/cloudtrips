import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

export async function onRequestGet(context: { request: Request; env: Env }) {
  try {
    const user = await requireUser(context);

    return json({
      ok: true,
      user
    });
  } catch (err) {
    console.warn('Auth failed (/me):', err);
    return error('Unauthorized.', 401);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }
  return onRequestGet(context);
}
