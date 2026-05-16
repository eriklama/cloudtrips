/* =========================
 * api.js
 * Handles all HTTP communication with the backend.
 * Depends on: auth.js (for getAuthToken, getShareToken, isGuestView)
 * ========================= */

async function apiFetch(url, options = {}) {
  const authToken = getAuthToken();

  const headers = {
    ...(options.headers || {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
  };

  const response = await fetch(url, {
    ...options,
    headers
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');

  if (response.status === 401) {
    console.warn('401 Unauthorized from API:', url);

    if (isGuestView()) {
      const body = isJson ? await response.json().catch(() => null) : null;
      throw new Error(body?.error || 'This shared link is invalid or has expired.');
    }

    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;

    try {
      if (isJson) {
        const errorPayload = await response.json();
        message = errorPayload?.error || errorPayload?.message || message;
      } else {
        const text = await response.text();
        if (text) message = text;
      }
    } catch {
      // ignore parsing errors
    }

    throw new Error(message);
  }

  if (!isJson) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
}

function apiGet(url) {
  const token = getShareToken();

  const finalUrl = token
    ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`
    : url;

  return apiFetch(finalUrl);
}

function apiPost(url, payload) {
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

function apiDelete(url, payload) {
  return apiFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload || {})
  });
}

async function fetchTrip(tripId, { forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cached = getTripFromCache(tripId);
    if (cached) return cached;
  }

  const url = `${API.GET_TRIP}?id=${encodeURIComponent(tripId)}`;
  const data = await apiGet(url);

  if (!data) {
    throw new Error('Failed to load trip (unauthorized or missing)');
  }

  const trip = normalizeFullTrip(data?.trip || data);
  saveTripToCache(trip);
  return trip;
}

async function saveTripMeta(trip) {
  if (!trip?.id) throw new Error('Trip id is required');
  const result = await apiPost(API.SAVE_TRIP_META, {
    id: trip.id,
    name: trip.name || 'Untitled trip',
    notes: trip.notes || ''
  });
  saveTripToCache(trip);
  return result;
}

async function upsertActivity(tripId, activity) {
  const normalized = normalizeActivity(activity);
  return apiPost(API.UPSERT_ACTIVITY, {
    tripId,
    activity: {
      id: normalized.id || uuid(),
      type: normalized.type || 'other',
      name: normalized.name || '',
      location: normalized.location || '',
      startDate: normalized.startDate || '',
      endDate: normalized.endDate || '',
      cost: Number(normalized.cost || 0),
      currency: normalized.currency || 'EUR',
      distance: Number(normalized.distance || normalized.km || 0),
      notes: normalized.notes || '',
      sortOrder: normalized.sortOrder !== undefined ? normalized.sortOrder : 0
    }
  });
}

async function deleteActivityById(activityId) {
  return apiPost(API.DELETE_ACTIVITY, { activityId });
}

async function reorderActivities(tripId, updates) {
  return apiPost(API.REORDER_ACTIVITIES, { tripId, updates });
}

