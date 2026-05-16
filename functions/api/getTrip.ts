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
  notes: string | null;
  country: string | null;
  created_at?: string | null;
};

type ActivityRow = {
  id: string;
  type: string;
  name: string;
  location: string;
  start_date: string;
  end_date: string;
  cost: number;
  currency: string;
  distance: number;
  notes: string;
  sort_order: number;
};

function rowToActivity(row: ActivityRow) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    start: row.start_date,
    end: row.end_date,
    cost: row.cost,
    currency: row.currency,
    distance: row.distance,
    km: row.distance,
    notes: row.notes,
    sortOrder: row.sort_order
  };
}

function stripCosts(activities: ReturnType<typeof rowToActivity>[]) {
  return activities.map((a) => ({ ...a, cost: 0, currency: undefined }));
}

const PAGE_SIZE = 50;

async function fetchActivities(
  env: Env,
  tripId: string,
  page: number
): Promise<{ activities: ReturnType<typeof rowToActivity>[]; totalCount: number; hasMore: boolean }> {
  const offset = (page - 1) * PAGE_SIZE;

  const [result, countRow] = await Promise.all([
    env.DB
      .prepare(`
        SELECT id, type, name, location, start_date, end_date,
               cost, currency, distance, notes, sort_order
        FROM activities
        WHERE trip_id = ?
        ORDER BY sort_order ASC, start_date ASC
        LIMIT ? OFFSET ?
      `)
      .bind(tripId, PAGE_SIZE, offset)
      .all<ActivityRow>(),
    env.DB
      .prepare(`SELECT COUNT(*) as count FROM activities WHERE trip_id = ?`)
      .bind(tripId)
      .first<{ count: number }>()
  ]);

  const totalCount = Number(countRow?.count ?? 0);
  const activities = (result.results ?? []).map(rowToActivity);

  return {
    activities,
    totalCount,
    hasMore: offset + activities.length < totalCount
  };
}

export async function onRequestGet(context: {
  request: Request;
  env: Env;
}) {
  const { request, env } = context;
  const url = new URL(request.url);
  const tripId = (url.searchParams.get('trip') || url.searchParams.get('id') || '').trim();
  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));

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
          SELECT id, user_id, name, notes, country, created_at
          FROM trips
          WHERE id = ? AND user_id = ?
          LIMIT 1
        `)
        .bind(tripId, user.id)
        .first<TripRow>();

      if (ownedTrip) {
        const { activities, totalCount, hasMore } = await fetchActivities(env, tripId, page);
        return json({
          ok: true,
          trip: {
            id: ownedTrip.id,
            name: ownedTrip.name,
            notes: ownedTrip.notes ?? '',
            country: ownedTrip.country ?? '',
            activities,
            created_at: ownedTrip.created_at ?? null
          },
          pagination: { page, totalCount, hasMore },
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
          SELECT id, user_id, name, notes, country, created_at
          FROM trips
          WHERE id = ?
          LIMIT 1
        `)
        .bind(tripId)
        .first<TripRow>();

      if (!sharedTrip) {
        return error('Trip not found.', 404);
      }

      await touchShareUsage({ env, shareId: share.id });

      let { activities, totalCount, hasMore } = await fetchActivities(env, tripId, page);
      if (share.mode === 'public') {
        activities = stripCosts(activities);
      }

      return json({
        ok: true,
        trip: {
          id: sharedTrip.id,
          name: sharedTrip.name,
          notes: sharedTrip.notes ?? '',
          country: sharedTrip.country ?? '',
          activities,
          created_at: sharedTrip.created_at ?? null
        },
        pagination: { page, totalCount, hasMore },
        readOnly: true,
        access: 'shared',
        shareMode: share.mode ?? 'full',
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
