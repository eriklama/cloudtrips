(() => {
  'use strict';

  /* =========================
   * CONFIG / STATE
   * ========================= */

  const API = {
    GET_TRIPS: '/api/getTrips',
    GET_TRIP: '/api/getTrip',
    SAVE_TRIP: '/api/saveTrip',
    DELETE_TRIP: '/api/deleteTrip',
    SHARE_TRIP: '/api/shareTrip'
  };

  const state = {
    trips: [],
    currentTrip: null,
    editingActivityId: null,
    timelineCollapsedDays: new Set(),
    timelineView: 'timeline'
  };

  /* =========================
   * DOM HELPERS
   * ========================= */

  const $ = (id) => document.getElementById(id);
  const hasEl = (id) => Boolean($(id));

  function setText(id, text) {
    const element = $(id);
    if (element) {
      element.textContent = text;
    }
  }

  /* =========================
   * SHARE / GUEST MODE
   * ========================= */

  function getShareToken() {
    return new URLSearchParams(window.location.search).get('token') || '';
  }

  function isGuestView() {
    return Boolean(getShareToken());
  }

  function buildTripPageUrl(page, tripId) {
    const token = getShareToken();
    const params = new URLSearchParams();
    params.set('id', tripId);

    if (token) {
      params.set('token', token);
    }

    return `/${page}?${params.toString()}`;
  }

  function applySharedViewUi(pageTitleId, pageHeroTitleId) {
    if (!isGuestView()) return;

    const form = document.getElementById('activity-form');
    if (form) {
      form.style.display = 'none';
    }

    const addBtn = document.querySelector('button[onclick="addActivity()"]');
    if (addBtn) {
      addBtn.style.display = 'none';
    }

    const titleTargets = [pageTitleId, pageHeroTitleId].filter(Boolean);

    titleTargets.forEach((id) => {
      const element = document.getElementById(id);
      if (!element) return;

      const existingBadge = element.querySelector('[data-shared-view-badge]');
      if (existingBadge) return;

      const badge = document.createElement('span');
      badge.setAttribute('data-shared-view-badge', 'true');
      badge.className = 'ml-2 inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 align-middle';
      badge.textContent = 'Shared view';

      element.appendChild(badge);
    });
  }

  /* =========================
   * GENERAL HELPERS
   * ========================= */

  function getTripIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('id');
  }

  function safeArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatCurrency(value) {
    const amount = Number(value || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  function formatDateTime(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function formatDayLabel(value) {
    if (!value) return 'No date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No date';

    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(date);
  }

  function formatMonthLabel(value) {
    if (!value) return 'No month';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No month';

    return new Intl.DateTimeFormat('en-GB', {
      month: 'long',
      year: 'numeric'
    }).format(date);
  }

  function formatWeekdayShort(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short'
    }).format(date);
  }

  function formatDayNumber(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return String(date.getDate());
  }

  function formatTimeOnly(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';

    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function dayKey(value) {
    if (!value) return 'undated';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'undated';

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function monthKey(value) {
    if (!value) return 'undated';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'undated';

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  }

  function getTimelineViewStorageKey(tripId) {
    return `trip_timeline_view_${tripId}`;
  }

  function getSavedTimelineView(tripId) {
    try {
      const stored = window.localStorage.getItem(getTimelineViewStorageKey(tripId));
      return stored === 'calendar' ? 'calendar' : 'timeline';
    } catch {
      return 'timeline';
    }
  }

  function saveTimelineView(tripId, view) {
    try {
      window.localStorage.setItem(getTimelineViewStorageKey(tripId), view === 'calendar' ? 'calendar' : 'timeline');
    } catch {
      // ignore storage errors
    }
  }

  function uuid() {
    if (window.crypto && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  function sortActivities(activities) {
    return [...safeArray(activities)].sort((a, b) => {
      const aTime = a?.startDate ? new Date(a.startDate).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b?.startDate ? new Date(b.startDate).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }

  function normalizeTripsResponse(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.trips)) return data.trips;
    return [];
  }

  function getTypeMeta(type) {
    const normalized = String(type || 'other').toLowerCase();
    const map = {
      plane: { icon: 'plane', badge: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
      car: { icon: 'car', badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
      hike: { icon: 'mountain', badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
      city: { icon: 'building-2', badge: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' },
      accommodation: { icon: 'bed-double', badge: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
      other: { icon: 'map-pinned', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
    };

    return map[normalized] || map.other;
  }

  function refreshIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  /* =========================
   * MODALS
   * ========================= */

  function openTextModal({
    title = 'Enter value',
    placeholder = '',
    value = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    inputType = 'text'
  } = {}) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4';

      overlay.innerHTML = `
        <div class="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
          <h2 class="mb-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            ${escapeHtml(title)}
          </h2>

          <input
            id="app-modal-input"
            type="${escapeHtml(inputType)}"
            value="${escapeHtml(value)}"
            placeholder="${escapeHtml(placeholder)}"
            class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-primary-500/20"
          />

          <div class="mt-5 flex justify-end gap-2">
            <button
              id="app-modal-cancel"
              type="button"
              class="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              ${escapeHtml(cancelText)}
            </button>

            <button
              id="app-modal-confirm"
              type="button"
              class="inline-flex items-center justify-center rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              ${escapeHtml(confirmText)}
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      const input = overlay.querySelector('#app-modal-input');
      const confirmButton = overlay.querySelector('#app-modal-confirm');
      const cancelButton = overlay.querySelector('#app-modal-cancel');

      function close(result) {
        overlay.remove();
        resolve(result);
      }

      confirmButton.addEventListener('click', () => close(input.value.trim()));
      cancelButton.addEventListener('click', () => close(null));

      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) {
          close(null);
        }
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          confirmButton.click();
        }

        if (event.key === 'Escape') {
          close(null);
        }
      });

      requestAnimationFrame(() => {
        input.focus();
        if (inputType !== 'password') {
          input.setSelectionRange(0, input.value.length);
        }
      });
    });
  }

  /* =========================
   * NORMALIZERS
   * ========================= */

  function normalizeActivity(raw = {}) {
    const startDate = raw.startDate ?? raw.start ?? '';
    const endDate = raw.endDate ?? raw.end ?? '';
    const location = raw.location ?? raw.name ?? '';
    const name = raw.name ?? raw.location ?? '';
    const distance = Number(raw.distance ?? raw.km ?? 0);

    return {
      id: raw.id ?? raw.activityId ?? uuid(),
      name,
      location,
      type: String(raw.type ?? 'other').toLowerCase(),
      startDate,
      endDate,
      start: startDate,
      end: endDate,
      cost: Number(raw.cost || 0),
      distance,
      km: distance,
      notes: raw.notes ?? ''
    };
  }

  function normalizeFullTrip(raw) {
    return {
      id: raw.id ?? raw.tripId ?? raw._id ?? '',
      name: raw.name ?? raw.title ?? 'Untitled trip',
      activities: sortActivities(safeArray(raw.activities).map(normalizeActivity))
    };
  }

  function normalizeTripSummary(raw) {
    const normalizedActivities = sortActivities(
      safeArray(raw.activities).map(normalizeActivity)
    );

    let startDate = raw.startDate || raw.start || null;
    let endDate = raw.endDate || raw.end || null;

    if (!startDate || !endDate) {
      const derived = getDerivedTripDates(normalizedActivities);
      startDate = startDate || derived.startDate;
      endDate = endDate || derived.endDate;
    }

    return {
      id: raw.id ?? raw.tripId ?? raw._id ?? '',
      name: raw.name ?? raw.title ?? 'Untitled trip',
      activitiesCount: Number(raw.activitiesCount ?? normalizedActivities.length ?? 0),
      startDate,
      endDate
    };
  }

  function getDerivedTripDates(activities) {
    const dates = safeArray(activities)
      .flatMap((activity) => [activity.startDate, activity.endDate])
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()));

    if (!dates.length) {
      return { startDate: null, endDate: null };
    }

    return {
      startDate: new Date(Math.min(...dates.map((date) => date.getTime()))).toISOString(),
      endDate: new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString()
    };
  }

  /* =========================
 * API (AUTH VERSION)
 * ========================= */

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

  // ✅ Handle unauthorized (DO NOT redirect here)
  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  
  if (response.status === 401) {
  console.warn('401 Unauthorized from API:', url);

  // ✅ Allow shared (guest) access
  if (isGuestView()) {
    const body = isJson ? await response.json().catch(() => null) : null;
    throw new Error(body?.error || 'This shared link is invalid or has expired.');
  }

  throw new Error('Unauthorized');
}


  // ❌ Handle other errors
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

  // ✅ No JSON → return null
  if (!isJson) return null;

  // ✅ Safe JSON parse
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/* =========================
 * AUTH
 * ========================= */

async function requireAuth() {
  const token = localStorage.getItem('cloudtrips_auth_token');

  if (!token) {
  if (isGuestView()) {
    return true; // allow shared access
  }
  throw new Error('No token');
}

  let res;

  try {
    res = await fetch('/api/me', {
      headers: {
        Authorization: 'Bearer ' + token
      }
    });
  } catch (err) {
    console.error('Auth check network error:', err);

    // ❗ Do NOT log user out on network issues
    return true;
  }

  // ✅ Only treat 401 as auth failure
  if (res.status === 401) {
    throw new Error('Unauthorized');
  }

  // ⚠️ Other errors → log but allow app to continue
  if (!res.ok) {
    console.warn('Auth check failed but not 401:', res.status);
    return true;
  }

  // ✅ Auth is valid
  return true;
}

  function logout() {
  localStorage.removeItem('cloudtrips_auth_token');
  localStorage.removeItem('cloudtrips_auth_user');
  window.location.href = '/login.html';
}
  
/* =========================
 * API HELPERS
 * ========================= */

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
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
}

function apiDelete(url, payload) {
  return apiFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload || {})
  });
}

/* =========================
 * TRIP API
 * ========================= */

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

  /* =========================
   * UI PARTIALS
   * ========================= */

  function emptyState(title, message, icon) {
    return `
      <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-soft dark:border-slate-700 dark:bg-slate-900">
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <i data-lucide="${icon}" class="h-6 w-6"></i>
        </div>
        <h3 class="text-lg font-semibold tracking-tight">${escapeHtml(title)}</h3>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(message)}</p>
      </div>
    `;
  }

  function loadingCardGrid() {
    return `
      <div class="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-soft dark:border-slate-800 dark:bg-slate-900 md:col-span-2 xl:col-span-3">
        <div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600 dark:border-slate-700 dark:border-t-primary-400"></div>
        <p class="text-sm text-slate-500 dark:text-slate-400">Loading trips…</p>
      </div>
    `;
  }

  function loadingTimeline() {
    return `
      <div class="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600 dark:border-slate-700 dark:border-t-primary-400"></div>
        <p class="text-sm text-slate-500 dark:text-slate-400">Loading timeline…</p>
      </div>
    `;
  }

  /* =========================
   * INDEX PAGE
   * ========================= */

  async function loadTrips() {
    const container = $('trip-list');
    if (!container) return;

    container.innerHTML = loadingCardGrid();

    try {
      const data = await apiGet(API.GET_TRIPS);
      state.trips = safeArray(normalizeTripsResponse(data)).map(normalizeTripSummary);

      if (!state.trips.length) {
        container.innerHTML = emptyState(
          'No trips yet',
          'Create your first trip to start planning.',
          'luggage'
        );
        refreshIcons();
        return;
      }

      renderTripList();
    } catch (error) {
      console.error(error);
      container.innerHTML = emptyState(
        'Failed to load trips',
        error?.message || 'Please check your API routes or server logs.',
        'triangle-alert'
      );
      refreshIcons();
    }
  }

  function renderTripList() {
    const container = $('trip-list');
    if (!container) return;

    container.innerHTML = state.trips.map((trip) => {
      const dateLabel = trip.startDate
        ? `${formatDayLabel(trip.startDate)}${trip.endDate ? ' → ' + formatDayLabel(trip.endDate) : ''}`
        : 'Add activities to see timeline';

      return `
        <article class="group rounded-3xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary-500/30">
          <div class="mb-4 flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                <i data-lucide="map" class="h-5 w-5"></i>
              </div>
              <div>
                <h3 class="text-lg font-semibold tracking-tight">${escapeHtml(trip.name)}</h3>
              </div>
            </div>
          </div>

          <div class="mb-5 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
              <i data-lucide="calendar-days" class="h-3.5 w-3.5"></i>
              ${escapeHtml(dateLabel)}
            </span>
          </div>

          <div class="flex gap-2">
            <button onclick="openTrip('${escapeHtml(trip.id)}')" class="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
              <i data-lucide="arrow-right" class="h-4 w-4"></i>
              Open
            </button>

            <button onclick="renameTrip('${escapeHtml(trip.id)}')" class="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
              <i data-lucide="pencil" class="h-4 w-4"></i>
            </button>

            <button onclick="deleteTrip('${escapeHtml(trip.id)}')" class="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20">
              <i data-lucide="trash-2" class="h-4 w-4"></i>
            </button>
          </div>
        </article>
      `;
    }).join('');

    refreshIcons();
  }

  async function addTrip() {
    const input = $('newTripName');
    if (!input) return;

    const name = input.value.trim();
    if (!name) {
      alert('Please enter a trip name.');
      input.focus();
      return;
    }

    try {
      await apiPost(API.SAVE_TRIP, {
        name,
        activities: []
      });
      input.value = '';
      await loadTrips();
    } catch (error) {
      console.error(error);
      alert(`Failed to create trip.${error?.message ? `\n${error.message}` : ''}`);
    }
  }

  function openTrip(tripId) {
    window.location.href = buildTripPageUrl('trip.html', tripId);
  }

  async function renameTrip(tripId) {
    const trip = state.trips.find((item) => String(item.id) === String(tripId));
    if (!trip) return;

    const newName = await openTextModal({
      title: 'Rename trip',
      placeholder: 'Trip name',
      value: trip.name || '',
      confirmText: 'Save',
      cancelText: 'Cancel',
      inputType: 'text'
    });

    if (newName === null) return;

    const trimmed = newName.trim();
    if (!trimmed) {
      alert('Trip name cannot be empty.');
      return;
    }

    // update UI immediately
    const previousName = trip.name;
    trip.name = trimmed;
    renderTripList();

    try {
      const fullTrip = await fetchTrip(tripId);
      fullTrip.name = trimmed;
      await saveTrip(fullTrip);
    } catch (error) {
      // roll back on failure
      trip.name = previousName;
      renderTripList();
      console.error(error);
      alert(`Failed to rename trip.${error?.message ? `\n${error.message}` : ''}`);
    }
  }

  async function deleteTrip(tripId) {
    const trip = state.trips.find((item) => String(item.id) === String(tripId));
    const confirmed = confirm(`Delete trip \"${trip?.name || 'this trip'}\"?`);
    if (!confirmed) return;

    const previousTrips = [...state.trips];
    state.trips = state.trips.filter((item) => String(item.id) !== String(tripId));
    renderTripList();

    try {
      await apiDelete(API.DELETE_TRIP, { id: tripId });
    } catch (error) {
      state.trips = previousTrips;
      renderTripList();
      console.error(error);
      alert(`Failed to delete trip.${error?.message ? `\n${error.message}` : ''}`);
    }
  }

  /* =========================
   * TRIP PAGE
   * ========================= */

  async function loadTripPage() {
    const tripId = getTripIdFromUrl();
    if (!tripId) {
      alert('Trip ID is missing.');
      return;
    }

    try {
      state.currentTrip = await fetchTrip(tripId);
      setText('trip-title', state.currentTrip.name || 'Trip');
      setText('trip-title-hero', state.currentTrip.name || 'Trip');
      
      applySharedViewUi('trip-title', 'trip-title-hero');

      if (isGuestView()) {
  const shareBtn = document.querySelector('button[onclick="openShareModal()"]');
  if (shareBtn) {
    shareBtn.style.display = 'none';
  }
}
      renderActivities();
    } catch (error) {
      console.error(error);
      const container = $('activities');

      if (container) {
        container.innerHTML = emptyState(
          'Failed to load trip',
          error?.message || 'Check whether the trip exists.',
          'triangle-alert'
        );
        refreshIcons();
      }
    }
  }

  function getActivityFormData() {
    return {
      name: $('activityLocation')?.value.trim() || '',
      location: $('activityLocation')?.value.trim() || '',
      type: $('activityType')?.value || 'other',
      startDate: $('activityStart')?.value || '',
      endDate: $('activityEnd')?.value || '',
      cost: Number($('activityCost')?.value || 0),
      notes: $('activityNotes')?.value.trim() || '',
      km: Number($('activityDistance')?.value || 0),
      distance: Number($('activityDistance')?.value || 0)
    };
  }

  function setActivityFormData(activity) {
    const data = activity || {
      name: '',
      location: '',
      type: 'other',
      startDate: '',
      endDate: '',
      cost: '',
      notes: '',
      km: '',
      distance: ''
    };

    if ($('activityLocation')) $('activityLocation').value = data.location || data.name || '';
    if ($('activityType')) $('activityType').value = data.type || 'other';
    if ($('activityStart')) $('activityStart').value = data.startDate || '';
    if ($('activityEnd')) $('activityEnd').value = data.endDate || '';
    if ($('activityCost')) $('activityCost').value = data.cost || '';
    if ($('activityNotes')) $('activityNotes').value = data.notes || '';
    if ($('activityDistance')) $('activityDistance').value = data.distance || data.km || '';
  }

  function resetActivityForm() {
    setActivityFormData(null);
    state.editingActivityId = null;

    const title = $('activity-form-title');
    const cancelButton = $('cancel-edit-btn');
    const addButton = document.querySelector('button[onclick="addActivity()"]');

    if (title) title.textContent = 'Add activity';
    if (cancelButton) cancelButton.classList.add('hidden');
    if (addButton) addButton.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i>Add Activity';

    refreshIcons();
  }

  function cancelEditActivity() {
    resetActivityForm();
  }

  function renderActivities() {
    const container = $('activities');
    if (!container || !state.currentTrip) return;

    const activities = sortActivities(state.currentTrip.activities);
    state.currentTrip.activities = activities;

    if (!activities.length) {
      container.innerHTML = emptyState(
        isGuestView() ? 'No activities available' : 'No activities yet',
        isGuestView()
          ? 'This shared trip does not contain any activities yet.'
          : 'Add your first activity to build the itinerary.',
        'calendar-plus'
      );
      refreshIcons();
      return;
    }

    container.innerHTML = activities.map((activity) => {
      const meta = getTypeMeta(activity.type);
      return `
        <article class="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 flex-1">
              <div class="mb-3 flex flex-wrap items-center gap-2">
                <span class="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                  <i data-lucide="${meta.icon}" class="h-5 w-5"></i>
                </span>
                <h3 class="truncate text-lg font-semibold tracking-tight">${escapeHtml(activity.location || activity.name || 'Untitled activity')}</h3>
                <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${meta.badge}">
                  ${escapeHtml(activity.type)}
                </span>
              </div>

              <div class="space-y-3">
                <div class="grid grid-cols-2 gap-3">
                  <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                    <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Start</div>
                    <div class="text-sm font-medium">${escapeHtml(formatDateTime(activity.startDate))}</div>
                  </div>

                  <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                    <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">End</div>
                    <div class="text-sm font-medium">${escapeHtml(formatDateTime(activity.endDate))}</div>
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                    <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Cost</div>
                    <div class="text-sm font-medium">${escapeHtml(formatCurrency(activity.cost))}</div>
                  </div>

                  <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                    <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Distance</div>
                    <div class="text-sm font-medium">${activity.km ? escapeHtml(`${activity.km} km`) : '—'}</div>
                  </div>
                </div>

                <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Notes</div>
                  <div class="text-sm font-medium whitespace-pre-wrap break-words">${escapeHtml(activity.notes || '—')}</div>
                </div>
              </div>
            </div>

            ${!isGuestView() ? `
              <div class="flex gap-2">
                <button onclick="editActivity('${escapeHtml(activity.id)}')" class="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
                  <i data-lucide="pencil" class="h-4 w-4"></i>
                  Edit
                </button>
                <button onclick="deleteActivity('${escapeHtml(activity.id)}')" class="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20">
                  <i data-lucide="trash-2" class="h-4 w-4"></i>
                  Delete
                </button>
              </div>
            ` : ''}
          </div>
        </article>
      `;
    }).join('');

    refreshIcons();
  }

  async function saveActivity() {
    if (isGuestView()) {
      alert('This trip is shared (view-only).');
      return;
    }

    if (!state.currentTrip) return;

    const data = getActivityFormData();
    if (!data.location) {
      alert('Activity location/name is required.');
      return;
    }

    const activity = normalizeActivity({
      id: state.editingActivityId || uuid(),
      name: data.location,
      location: data.location,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      start: data.startDate,
      end: data.endDate,
      cost: data.cost,
      distance: data.distance,
      km: data.km,
      notes: data.notes
    });

    if (state.editingActivityId) {
      const index = state.currentTrip.activities.findIndex(
        (item) => String(item.id) === String(state.editingActivityId)
      );

      if (index >= 0) {
        state.currentTrip.activities[index] = activity;
      }
    } else {
      state.currentTrip.activities.push(activity);
    }

    state.currentTrip.activities = sortActivities(state.currentTrip.activities);

    try {
      await saveTrip(state.currentTrip);
      resetActivityForm();
      renderActivities();
    } catch (error) {
      console.error(error);
      alert(`Failed to save activity.${error?.message ? `\n${error.message}` : ''}`);
    }
  }

  function addActivity() {
    return saveActivity();
  }

  function editActivity(activityId) {
    if (isGuestView()) {
      alert('This trip is shared (view-only).');
      return;
    }

    if (!state.currentTrip) return;

    const activity = state.currentTrip.activities.find((item) => String(item.id) === String(activityId));
    if (!activity) return;

    state.editingActivityId = activity.id;
    setActivityFormData(activity);

    const title = $('activity-form-title');
    const cancelButton = $('cancel-edit-btn');
    const addButton = document.querySelector('button[onclick="addActivity()"]');

    if (title) title.textContent = 'Edit activity';
    if (cancelButton) cancelButton.classList.remove('hidden');
    if (addButton) addButton.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i>Save Activity';

    refreshIcons();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteActivity(activityId) {
    if (isGuestView()) {
      alert('This trip is shared (view-only).');
      return;
    }

    if (!state.currentTrip) return;

    const activity = state.currentTrip.activities.find((item) => String(item.id) === String(activityId));
    const confirmed = confirm(`Delete activity "${activity?.location || activity?.name || 'this activity'}"?`);
    if (!confirmed) return;

    state.currentTrip.activities = state.currentTrip.activities.filter(
      (item) => String(item.id) !== String(activityId)
    );

    try {
      await saveTrip(state.currentTrip);

      if (state.editingActivityId === activityId) {
        resetActivityForm();
      }

      renderActivities();
    } catch (error) {
      console.error(error);
      alert(`Failed to delete activity.${error?.message ? `\n${error.message}` : ''}`);
    }
  }

  /* =========================
   * TIMELINE PAGE
   * ========================= */

  function buildTimelineGroups(activities) {
    const groups = new Map();

    for (const activity of activities) {
      const key = dayKey(activity.startDate);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key).push(activity);
    }

    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }

  function renderTimelineActivity(activity) {
    const meta = getTypeMeta(activity.type);

    return `
      <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <div class="mb-2 flex flex-wrap items-center gap-2">
          <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
            <i data-lucide="${meta.icon}" class="h-4 w-4"></i>
          </span>

          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-semibold">${escapeHtml(activity.location || activity.name || 'Activity')}</div>
          </div>

          <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.badge}">
            ${escapeHtml(activity.type)}
          </span>
        </div>

        <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span>⏱ ${escapeHtml(formatTimeOnly(activity.startDate))} – ${escapeHtml(formatTimeOnly(activity.endDate))}</span>
          ${activity.km ? `<span>🚗 ${escapeHtml(`${activity.km} km`)}</span>` : ''}
          <span>💶 ${escapeHtml(formatCurrency(activity.cost))}</span>
        </div>

        ${activity.notes ? `
          <div class="mt-2 text-xs text-slate-600 dark:text-slate-300">
            ${escapeHtml(activity.notes)}
          </div>
        ` : ''}
      </div>
    `;
  }

  function toggleTimelineDay(day) {
    if (state.timelineCollapsedDays.has(day)) {
      state.timelineCollapsedDays.delete(day);
    } else {
      state.timelineCollapsedDays.add(day);
    }

    renderTimelinePage();
  }

  function switchTimelineView(view) {
    if (!state.currentTrip) return;

    state.timelineView = view === 'calendar' ? 'calendar' : 'timeline';
    saveTimelineView(state.currentTrip.id, state.timelineView);
    renderTimelinePage();
  }

  async function loadTimeline() {
    const tripId = getTripIdFromUrl();
    const container = $('timeline');
    const calendar = $('calendar-view');
    if (!tripId || !container || !calendar) return;

    container.innerHTML = loadingTimeline();
    calendar.innerHTML = '';

    try {
      state.currentTrip = await fetchTrip(tripId);
      state.timelineView = getSavedTimelineView(tripId);
      setText('timeline-title', `${state.currentTrip.name} Timeline`);
      setText('timeline-hero-title', `${state.currentTrip.name} Timeline`);
      applySharedViewUi('timeline-title', 'timeline-hero-title');
      renderTimelinePage();
    } catch (error) {
      console.error(error);
      container.innerHTML = emptyState(
        'Failed to load timeline',
        error?.message || 'The trip data could not be loaded.',
        'triangle-alert'
      );
      calendar.innerHTML = '';
      refreshIcons();
    }
  }

  function renderTimelinePage() {
    const tripId = state.currentTrip?.id;
    const timelineContainer = $('timeline');
    const calendarContainer = $('calendar-view');
    const timelineButton = $('btnTimelineView');
    const calendarButton = $('btnCalendarView');

    if (!timelineContainer || !calendarContainer || !state.currentTrip) return;

    if (timelineButton) {
      timelineButton.className = state.timelineView === 'timeline'
        ? 'inline-flex items-center justify-center gap-2 rounded-xl border border-primary-500 bg-primary-500 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-600'
        : 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800';
    }

    if (calendarButton) {
      calendarButton.className = state.timelineView === 'calendar'
        ? 'inline-flex items-center justify-center gap-2 rounded-xl border border-primary-500 bg-primary-500 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-600'
        : 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800';
    }

    if (tripId) {
      saveTimelineView(tripId, state.timelineView);
    }

    if (state.timelineView === 'calendar') {
      timelineContainer.classList.add('hidden');
      calendarContainer.classList.remove('hidden');
      renderCalendarView();
    } else {
      calendarContainer.classList.add('hidden');
      timelineContainer.classList.remove('hidden');
      renderTimeline();
    }

    refreshIcons();
  }

  function renderTimeline() {
    const container = $('timeline');
    if (!container || !state.currentTrip) return;

    const activities = sortActivities(state.currentTrip.activities);
    if (!activities.length) {
      container.innerHTML = emptyState(
        'No activities in timeline',
        'Go back to the trip page and add some activities first.',
        'calendar-plus'
      );
      refreshIcons();
      return;
    }

    const groupEntries = buildTimelineGroups(activities);

    container.innerHTML = groupEntries.map(([key, dayActivities]) => {
      const label = key === 'undated' ? 'No date' : formatDayLabel(dayActivities[0]?.startDate);
      const isCollapsed = state.timelineCollapsedDays.has(key);
      const totalCost = dayActivities.reduce((sum, activity) => sum + Number(activity.cost || 0), 0);
      const totalKm = dayActivities.reduce((sum, activity) => sum + Number(activity.km || 0), 0);

      return `
        <section class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-soft">
          <button
            type="button"
            onclick="toggleTimelineDay('${escapeHtml(key)}')"
            class="flex w-full items-center justify-between gap-3 bg-slate-800/70 px-4 py-3 text-left transition hover:bg-slate-800"
          >
            <div class="min-w-0">
              <div class="text-sm font-semibold tracking-tight text-slate-100">${escapeHtml(label)}</div>
              <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
                <span>${dayActivities.length} item${dayActivities.length === 1 ? '' : 's'}</span>
                <span>${escapeHtml(formatCurrency(totalCost))}</span>
                ${totalKm ? `<span>${escapeHtml(`${totalKm} km`)}</span>` : ''}
              </div>
            </div>

            <span class="shrink-0 text-sm text-slate-300">
              ${isCollapsed ? '▶' : '▼'}
            </span>
          </button>

          <div class="${isCollapsed ? 'hidden' : 'block'} p-3">
            <div class="space-y-2">
              ${dayActivities.map(renderTimelineActivity).join('')}
            </div>
          </div>
        </section>
      `;
    }).join('');

    refreshIcons();
  }

  function renderCalendarView() {
    const container = $('calendar-view');
    if (!container || !state.currentTrip) return;

    const activities = sortActivities(state.currentTrip.activities);
    if (!activities.length) {
      container.innerHTML = emptyState(
        'No activities in calendar view',
        'Go back to the trip page and add some activities first.',
        'calendar-plus'
      );
      refreshIcons();
      return;
    }

    const dayGroups = buildTimelineGroups(activities);
    const monthBuckets = new Map();

    for (const [key, dayActivities] of dayGroups) {
      const bucketKey = key === 'undated' ? 'undated' : monthKey(dayActivities[0]?.startDate);
      if (!monthBuckets.has(bucketKey)) {
        monthBuckets.set(bucketKey, []);
      }
      monthBuckets.get(bucketKey).push([key, dayActivities]);
    }

    container.innerHTML = [...monthBuckets.entries()].map(([bucketKey, entries]) => {
      const monthLabel = bucketKey === 'undated' ? 'Undated activities' : formatMonthLabel(entries[0]?.[1]?.[0]?.startDate);

      return `
        <section class="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 shadow-soft">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold tracking-tight text-slate-100">${escapeHtml(monthLabel)}</h3>
              <p class="mt-1 text-xs text-slate-400">${entries.length} day${entries.length === 1 ? '' : 's'}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            ${entries.map(([key, dayActivities]) => renderCalendarTile(key, dayActivities)).join('')}
          </div>
        </section>
      `;
    }).join('');

    refreshIcons();
  }

  function renderCalendarTile(key, dayActivities) {
    const dateValue = dayActivities[0]?.startDate;
    const label = key === 'undated' ? 'No date' : formatDayLabel(dateValue);
    const weekday = key === 'undated' ? '—' : formatWeekdayShort(dateValue);
    const dayNumber = key === 'undated' ? '—' : formatDayNumber(dateValue);
    const totalCost = dayActivities.reduce((sum, activity) => sum + Number(activity.cost || 0), 0);
    const totalKm = dayActivities.reduce((sum, activity) => sum + Number(activity.km || 0), 0);
    const previewItems = dayActivities.slice(0, 4).map((activity) => {
      const meta = getTypeMeta(activity.type);
      const name = activity.location || activity.name || 'Activity';
      return `
        <div class="flex items-start gap-2 rounded-xl bg-slate-950/80 px-3 py-2">
          <span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-300">
            <i data-lucide="${meta.icon}" class="h-3.5 w-3.5"></i>
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-slate-100">${escapeHtml(name)}</div>
            <div class="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-400">
              <span>${escapeHtml(formatTimeOnly(activity.startDate))}–${escapeHtml(formatTimeOnly(activity.endDate))}</span>
              ${activity.km ? `<span>${escapeHtml(`${activity.km} km`)}</span>` : ''}
              <span>${escapeHtml(formatCurrency(activity.cost))}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const extraCount = Math.max(dayActivities.length - 4, 0);

    return `
      <article class="flex min-h-[220px] flex-col rounded-2xl border border-slate-800 bg-slate-800/60 p-4 transition hover:border-primary-500/60 hover:bg-slate-800">
        <div class="mb-3 flex items-start justify-between gap-3">
          <div>
            <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">${escapeHtml(weekday)}</div>
            <div class="mt-1 text-3xl font-semibold leading-none text-slate-100">${escapeHtml(dayNumber)}</div>
          </div>
          <div class="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-right">
            <div class="text-[11px] uppercase tracking-wide text-slate-500">Summary</div>
            <div class="mt-1 text-xs text-slate-300">${escapeHtml(formatCurrency(totalCost))}</div>
            <div class="text-xs text-slate-400">${escapeHtml(`${totalKm || 0} km`)}</div>
          </div>
        </div>

        <div class="mb-3 text-xs text-slate-400">${escapeHtml(label)}</div>

        <div class="space-y-2">
          ${previewItems}
        </div>

        ${extraCount ? `
          <div class="mt-3 rounded-xl border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-400">
            +${extraCount} more item${extraCount === 1 ? '' : 's'} on this day
          </div>
        ` : ''}
      </article>
    `;
  }

  /* =========================
   * COSTS PAGE
   * ========================= */

  async function loadCosts() {
    const tripId = getTripIdFromUrl();
    const table = $('cost-table');
    if (!tripId || !table) return;

    table.innerHTML = `
      <tr>
        <td colspan="5" class="px-3 py-8 text-center text-slate-500 dark:text-slate-400">Loading costs…</td>
      </tr>
    `;

    try {
      state.currentTrip = await fetchTrip(tripId);
      setText('costs-title', `${state.currentTrip.name} Costs`);
      setText('costs-hero-title', `${state.currentTrip.name} Costs`);
      applySharedViewUi('costs-title', 'costs-hero-title');
      renderCosts();
    } catch (error) {
      console.error(error);
      table.innerHTML = `
        <tr>
          <td colspan="5" class="px-3 py-8 text-center text-red-600 dark:text-red-400">${escapeHtml(error?.message || 'Failed to load costs.')}</td>
        </tr>
      `;
    }
  }

  function renderCosts() {
    const table = $('cost-table');
    const totalEl = $('totalCost');
    const summaryEl = $('cost-summary');

    if (!table || !totalEl || !summaryEl || !state.currentTrip) return;

    const activities = sortActivities(state.currentTrip.activities);
    const total = activities.reduce((sum, activity) => sum + Number(activity.cost || 0), 0);
    const totalKm = activities.reduce((sum, activity) => sum + Number(activity.km || 0), 0);

    const byType = activities.reduce((accumulator, activity) => {
      const key = activity.type || 'other';
      accumulator[key] = (accumulator[key] || 0) + Number(activity.cost || 0);
      return accumulator;
    }, {});

    const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);

    totalEl.textContent = formatCurrency(total);

    const totalKmEl = $('totalKm');
    if (totalKmEl) {
      totalKmEl.textContent = totalKm ? `${totalKm} km` : '—';
    }

    summaryEl.innerHTML = typeEntries.length
      ? typeEntries.map(([type, amount]) => {
          const meta = getTypeMeta(type);
          const percent = total > 0 ? Math.round((amount / total) * 100) : 0;

          return `
            <div class="grid grid-cols-[1fr_60px_100px] items-center rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
              <div class="flex min-w-0 items-center gap-2">
                <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                  <i data-lucide="${meta.icon}" class="h-4 w-4"></i>
                </span>

                <span class="truncate font-medium capitalize">
                  ${escapeHtml(type)}
                </span>
              </div>

              <div class="text-right text-sm tabular-nums text-slate-400">
                ${percent}%
              </div>

              <div class="text-right text-sm font-medium tabular-nums">
                ${escapeHtml(formatCurrency(amount))}
              </div>
            </div>
          `;
        }).join('')
      : emptyState(
          'No costs yet',
          'Add cost values to activities to see the summary.',
          'wallet'
        );

    table.innerHTML = activities.length
      ? activities.map((activity) => {
          const meta = getTypeMeta(activity.type);

          return `
            <tr class="rounded-2xl bg-slate-50 dark:bg-slate-950/60">
              <td data-label="Activity" class="rounded-l-2xl px-3 py-3">
                <div class="flex items-center gap-3">
                  <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                    <i data-lucide="${meta.icon}" class="h-4 w-4"></i>
                  </span>
                  <span class="font-medium">${escapeHtml(activity.location || activity.name || 'Untitled')}</span>
                </div>
              </td>

              <td data-label="Type" class="px-3 py-3">
                <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${meta.badge}">
                  ${escapeHtml(activity.type)}
                </span>
              </td>

              <td data-label="Start" class="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                ${escapeHtml(formatDateTime(activity.startDate))}
              </td>

              <td data-label="Cost" class="px-3 py-3 text-right font-semibold">
                ${escapeHtml(formatCurrency(activity.cost))}
              </td>

              <td data-label="KM" class="rounded-r-2xl px-3 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
                ${activity.km ? escapeHtml(`${activity.km} km`) : '—'}
              </td>
            </tr>
          `;
        }).join('')
      : `
          <tr>
            <td colspan="5" class="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
              No activities yet.
            </td>
          </tr>
        `;

    refreshIcons();
  }

/* =========================
 * SHARE
 * ========================= */

async function openShareModal() {
  if (!state.currentTrip?.id) {
    alert('Trip not loaded.');
    return;
  }

  if (isGuestView()) {
    alert('Shared viewers cannot create links.');
    return;
  }

  const modal = document.getElementById('share-modal');
  const input = document.getElementById('share-link');

  if (!modal || !input) {
    alert('Share modal missing.');
    return;
  }

  try {
    input.value = 'Creating link...';

    const data = await apiPost(API.SHARE_TRIP, {
      tripId: state.currentTrip.id
    });

    const shareUrl = data?.shareUrl
      ? `${window.location.origin}${data.shareUrl}`
      : '';

    if (!shareUrl) throw new Error('No share link returned');

    input.value = shareUrl;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

  } catch (err) {
    console.error(err);
    alert('Failed to create share link');
  }
}

function closeShareModal() {
  const modal = document.getElementById('share-modal');
  if (!modal) return;

  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function copyShareLink() {
  const input = document.getElementById('share-link');
  if (!input || !input.value) return;

  try {
    await navigator.clipboard.writeText(input.value);
    alert('Copied!');
  } catch {
    input.select();
    document.execCommand('copy');
    alert('Copied!');
  }
}

  /* =========================
   * NAVIGATION
   * ========================= */

  function goToTrip() {
    const tripId = getTripIdFromUrl();
    if (!tripId) return;
    window.location.href = buildTripPageUrl('trip.html', tripId);
  }

  function goToTimeline() {
    const tripId = getTripIdFromUrl();
    if (!tripId) return;
    window.location.href = buildTripPageUrl('timeline.html', tripId);
  }

  function goToCosts() {
    const tripId = getTripIdFromUrl();
    if (!tripId) return;
    window.location.href = buildTripPageUrl('costs.html', tripId);
  }

  function goBack() {
    window.location.href = '/';
  }

  function openPrintView() {
    if (!state.currentTrip) {
      alert('Trip not loaded');
      return;
    }

    sessionStorage.setItem('print_trip', JSON.stringify(state.currentTrip));
    window.open('/print.html', '_blank');
  }

 /* =========================
 * APP INIT
 * ========================= */

async function init() {
  try {
    const onSharedPage = isGuestView();

    // 🔐 AUTH CHECK (ONLY for non-shared pages)
    if (!onSharedPage && typeof requireAuth === 'function') {
      try {
        const user = await requireAuth();
        console.log('AUTH USER:', user);
      } catch (e) {
        console.warn('AUTH FAILED → redirecting to login', e);

        // ❗ Clear broken session (optional but recommended)
        try {
          localStorage.removeItem('cloudtrips_auth_token');
          localStorage.removeItem('cloudtrips_auth_user');
        } catch {}

        // 🚀 Redirect and STOP app execution
        window.location.href = '/login.html';
        return; // ⛔ CRITICAL: prevents further execution
      }
    }

    // ✅ Only runs if auth succeeded
    if (hasEl('trip-list')) {
      await loadTrips();
    }

    if (hasEl('activities')) {
      await loadTripPage();
    }

    if (hasEl('timeline')) {
      await loadTimeline();
      renderHeaderNav('timeline');
    }

    if (hasEl('cost-table')) {
      await loadCosts();
      renderHeaderNav('costs');
    }

  } catch (error) {
    console.error('INIT ERROR:', error);
  }

  refreshIcons();
}

document.addEventListener('DOMContentLoaded', init);

  /* =========================
   * HEADER NAVIGATION
   * ========================= */

  function renderHeaderNav(current) {
    const nav = document.getElementById('nav-actions');
    if (!nav) return;

    nav.innerHTML = '';

    function createBtn(label, icon, onClick) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800 transition';
      btn.onclick = onClick;

      btn.innerHTML = `
        <i data-lucide="${icon}" class="h-4 w-4"></i>
        ${label}
      `;

      return btn;
    }

    nav.appendChild(createBtn('Home', 'home', () => {
      window.location.href = '/';
    }));

    if (current !== 'trip') {
      nav.appendChild(createBtn('Trip', 'notebook-pen', goToTrip));
    }

    if (current !== 'timeline') {
      nav.appendChild(createBtn('Timeline', 'list-tree', goToTimeline));
    }

    if (current !== 'costs') {
      nav.appendChild(createBtn('Costs', 'badge-euro', goToCosts));
    }

    if (current === 'timeline') {
      nav.appendChild(createBtn('Export', 'printer', openPrintView));
    }

    refreshIcons();
  }

  /* =========================
   * GLOBAL EXPORTS
   * ========================= */

  window.addTrip = addTrip;
  window.openTrip = openTrip;
  window.renameTrip = renameTrip;
  window.deleteTrip = deleteTrip;
  window.editActivity = editActivity;
  window.deleteActivity = deleteActivity;
  window.saveActivity = saveActivity;
  window.addActivity = addActivity;
  window.cancelEditActivity = cancelEditActivity;
  window.goBack = goBack;
  window.goToTrip = goToTrip;
  window.goToTimeline = goToTimeline;
  window.goToCosts = goToCosts;
  window.toggleTimelineDay = toggleTimelineDay;
  window.switchTimelineView = switchTimelineView;
  window.openPrintView = openPrintView;
  window.renderHeaderNav = renderHeaderNav;
  window.openShareModal = openShareModal;
  window.closeShareModal = closeShareModal;
  window.copyShareLink = copyShareLink;
  window.logout = logout;
})();
