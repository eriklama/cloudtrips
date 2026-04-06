import { requireUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json } from '../_lib/http';

export async function onRequestGet(context: { request: Request; env: Env }) {
  let user;

  try {
    user = await requireUser(context);
  } catch (err) {
    console.warn('Auth failed (/me):', err);
    return error('Unauthorized', 401);
  }

  return json({
    ok: true,
    user
  });
}
