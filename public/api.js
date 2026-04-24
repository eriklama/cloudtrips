/* =========================
 * api.js
 * Handles all HTTP communication with the backend.
 * Depends on: auth.js (for getShareToken, isGuestView)
 * ========================= */

const API = {
  GET_TRIPS: '/api/getTrips',
  GET_TRIP: '/api/getTrip',
  SAVE_TRIP: '/api/saveTrip',
  DELETE_TRIP: '/api/deleteTrip',
  SHARE_TRIP: '/api/shareTrip'
};

async function apiFetch(url, options = {}) {
  const authToken = window.localStorage.getItem('cloudtrips_auth_token');

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

async function fetchTrip(tripId) {
  const url = `${API.GET_TRIP}?id=${encodeURIComponent(tripId)}`;
  const data = await apiGet(url);

  if (!data) {
    throw new Error('Failed to load trip (unauthorized or missing)');
  }

  return normalizeFullTrip(data?.trip || data);
}

async function saveTrip(trip) {
  if (!trip) {
    throw new Error('Invalid trip object');
  }

  const payload = {
    ...(trip.id ? { id: trip.id } : {}),
    name: trip.name || 'Untitled trip',
    activities: safeArray(trip.activities).map((activity) => {
      const normalized = normalizeActivity(activity);

      return {
        id: normalized.id || uuid(),
        type: normalized.type || 'other',
        location: normalized.location || normalized.name || '',
        startDate: normalized.startDate || '',
        endDate: normalized.endDate || '',
        cost: Number(normalized.cost || 0),
        distance: Number(normalized.distance || normalized.km || 0),
        notes: normalized.notes || ''
      };
    })
  };

  return apiPost(API.SAVE_TRIP, payload);
}
