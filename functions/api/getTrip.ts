import type { PagesFunction } from '@cloudflare/workers-types';
import { requireUser } from '../_lib/auth';
import { json, error, methodNotAllowed } from '../_lib/http';

export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  PASSWORD_PEPPER?: string;
}

type TripRow = {
  id: string;
  name: string;
  user_id: string;
  activities_json: string | null;
};

/* ---------- HELPERS ---------- */

function parseActivities(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function getTripForOwner(env: Env, tripId: string, userId: string): Promise<TripRow | null> {
  return await env.DB
    .prepare(`
      SELECT id, name, user_id, activities_json
      FROM trips
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `)
    .bind(tripId, userId)
    .first<TripRow>();
}

async function getTripForGuest(env: Env, tripId: string, token: string): Promise<TripRow | null> {
  const row = await env.DB
    .prepare(`
      SELECT t.id, t.name, t.user_id, t.activities_json
      FROM trips t
      INNER JOIN trip_share_tokens s
        ON s.trip_id = t.id
      WHERE t.id = ?
        AND s.token = ?
        AND s.revoked_at IS NULL
        AND (s.expires_at IS NULL OR s.expires_at > CURRENT_TIMESTAMP)
      LIMIT 1
    `)
    .bind(tripId, token)
    .first<TripRow>();

  if (row) {
      // non-blocking audit update
      env.DB.prepare(`
        UPDATE trip_share_tokens
        SET last_used_at = CURRENT_TIMESTAMP
        WHERE token = ?
      `)
      .bind(token)
      .run()
      .catch(() => {});
  }

  return row;
}

/* ---------- HANDLER ---------- */

export const onRequestGet: PagesFunction<Env> = async (context) => {
  try {
    const url = new URL(context.request.url);
    const tripId = (url.searchParams.get('id') || '').trim();
    const token = (url.searchParams.get('token') || '').trim();

    if (!tripId) {
      return error('Trip id is required', 400);
    }

    /* ---------- GUEST ACCESS ---------- */

    if (token) {
      const trip = await getTripForGuest(context.env, tripId, token);

      if (!trip) {
        return error('Invalid or expired share token', 401);
      }

      return json({
        id: trip.id,
        name: trip.name,
        activities: parseActivities(trip.activities_json),
        readOnly: true,
        access: 'guest'
      });
    }

    /* ---------- OWNER ACCESS ---------- */

    const user = await requireUser(context);
    if (!user?.id) {
      return error('Authentication required', 401);
    }

    const trip = await getTripForOwner(context.env, tripId, user.id);

    if (!trip) {
      return error('Trip not found', 404);
    }

    return json({
      id: trip.id,
      name: trip.name,
      activities: parseActivities(trip.activities_json),
      readOnly: false,
      access: 'owner'
    });

  } catch (err: any) {
    console.error('getTrip error:', err);
    return error('Failed to load trip', 500);
  }
};

/* ---------- METHOD GUARD ---------- */

export const onRequest: PagesFunction<Env> = async (context) => {
  if (context.request.method !== 'GET') {
    return methodNotAllowed(['GET']);
  }
  return onRequestGet(context);
};
