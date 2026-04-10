import { tryGetUser } from '../_lib/auth';
import type { Env } from '../_lib/auth';
import { error, json, methodNotAllowed } from '../_lib/http';
import {
  findValidShareByToken,
  getShareTokenFromRequest,
  touchShareUsage
} from '../_lib/share';

type TripRow = {
  id: string;
  user_id: string;
  name: string;
  activities_json: string | null;
  created_at?: string | null;
};

function parseActivities(value: string | null): unknown[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}) {
  const { request, env } = context;
  const url = new URL(request.url);
  const tripId = (url.searchParams.get('trip') || url.searchParams.get('id') || '').trim();

  if (!tripId) {
    return error('trip id is required.', 400);
  }

  const token = getShareTokenFromRequest(request);

  try {
    // 1) Logged-in owner path
    const user = await tryGetUser(context);
    if (user) {
      const ownedTrip = await env.DB
        .prepare(`
          SELECT id, user_id, name, activities_json, created_at
          FROM trips
          WHERE id = ? AND user_id = ?
          LIMIT 1
        `)
        .bind(tripId, user.id)
        .first<TripRow>();

      if (ownedTrip) {
        return json({
          ok: true,
          trip: {
            id: ownedTrip.id,
            name: ownedTrip.name,
            activities: parseActivities(ownedTrip.activities_json),
            created_at: ownedTrip.created_at ?? null
          },
          readOnly: false,
          access: 'owner'
        });
      }
    }

    // 2) Guest-share path
    if (token) {
      const share = await findValidShareByToken({ env, token });

      if (!share) {
        return error('Invalid or expired share token.', 401);
      }

      if (share.trip_id !== tripId) {
        return error('Invalid share token for this trip.', 403);
      }

      const sharedTrip = await env.DB
        .prepare(`
          SELECT id, user_id, name, activities_json, created_at
          FROM trips
          WHERE id = ?
          LIMIT 1
        `)
        .bind(tripId)
        .first<TripRow>();

      if (!sharedTrip) {
        return error('Trip not found.', 404);
      }

      await touchShareUsage({
        env,
        shareId: share.id
      });

      return json({
        ok: true,
        trip: {
          id: sharedTrip.id,
          name: sharedTrip.name,
          activities: parseActivities(sharedTrip.activities_json),
          created_at: sharedTrip.created_at ?? null
        },
        readOnly: true,
        access: 'shared',
        shareExpiresAt: share.expires_at
      });
    }

    return error('Unauthorized.', 401);
  } catch (err) {
    console.error('getTrip error:', err);
    return error('Failed to load trip.', 500);
  }
}

export function onRequest(context: { request: Request; env: Env }) {
  if (context.request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }
  return onRequestGet(context);
}
