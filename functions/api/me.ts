import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';

export async function onRequestGet(context: { request: Request; env: Env }) {
  const { request, env } = context;

  const user = await requireUser(request, env);
  if (!user) {
    return error('Unauthorized.', 401);
  }

  return json({
    ok: true,
    user
  });
}

export function onRequest() {
  return methodNotAllowed(['GET']);
}
