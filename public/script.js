const API_GET_TRIPS = '/getTrips';
const API_GET_TRIP = '/getTrip';
const API_SAVE_TRIP = '/saveTrip';
const API_DELETE_TRIP = '/deleteTrip';

let trips = [];
let currentTrip = null;
let editingActivityId = null;

/* ---------- INIT ---------- */

document.addEventListener('DOMContentLoaded', async () => {
  initTheme();
  applyTheme();
  wireThemeToggle();

  try {
    if (document.getElementById('trip-list')) {
      await loadTrips();
    }

    if (document.getElementById('activities')) {
      await loadTripPage();
    }

    if (document.getElementById('timeline')) {
      await loadTimeline();
    }

    if (document.getElementById('cost-table')) {
      await loadCosts();
    }
  } catch (error) {
    console.error(error);
  }

  refreshIcons();
});

/* ---------- THEME ---------- */

function initTheme() {
  const saved = localStorage.getItem('cloudtrips_theme');
  if (!saved) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    localStorage.setItem('cloudtrips_theme', prefersDark ? 'dark' : 'light');
  }
}

function applyTheme() {
  const theme = localStorage.getItem('cloudtrips_theme') || 'light';
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

function wireThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const current = localStorage.getItem('cloudtrips_theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('cloudtrips_theme', next);
    applyTheme();
  });
}

/* ---------- PIN STORAGE ---------- */

function getTripPinKey(tripId) {
  return `trip_pin_${tripId}`;
}

function getStoredTripPin(tripId) {
  if (!tripId) return '';
  return localStorage.getItem(getTripPinKey(tripId)) || '';
}

function storeTripPin(tripId, pin) {
  if (!tripId || !pin) return;
  localStorage.setItem(getTripPinKey(tripId), String(pin).trim());
}

function removeStoredTripPin(tripId) {
  if (!tripId) return;
  localStorage.removeItem(getTripPinKey(tripId));
}

function ensureTripPin(tripId, promptText = 'Enter trip PIN:') {
  let pin = getStoredTripPin(tripId);
  if (pin) return pin;

  const entered = prompt(promptText);
  if (!entered || !entered.trim()) return '';

  pin = entered.trim();
  storeTripPin(tripId, pin);
  return pin;
}

/* ---------- HELPERS ---------- */

function getTripIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
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
  if (Number.isNaN(date.getTime())) return value;
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
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'undated';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeTripsResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.trips)) return data.trips;
  return [];
}

function withTripQuery(url, tripId) {
  const full = new URL(url, window.location.origin);
  full.searchParams.set('trip', tripId);
  return `${full.pathname}${full.search}`;
}

async function parseJsonSafe(res) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/* ---------- API ---------- */

async function apiGet(url, hasRetried = false) {
  const fullUrl = new URL(url, window.location.origin);

  // ✅ FIX: use "trip", not "id"
  const tripId = fullUrl.searchParams.get('trip');

  let pin = tripId ? getStoredTripPin(tripId) : '';

  // 🔒 Ensure PIN exists BEFORE first request
  if (tripId && !pin) {
    pin = ensureTripPin(tripId, 'Enter trip PIN:');
    if (!pin) throw new Error('PIN required');
  }

  const res = await fetch(fullUrl.toString(), {
    method: 'GET',
    headers: pin ? { 'x-pin': pin } : {}
  });

  if (res.status === 401 && tripId && !hasRetried) {
    console.warn('PIN rejected, retrying…');

    removeStoredTripPin(tripId);

    const enteredPin = ensureTripPin(tripId, 'Wrong PIN, try again:');
    if (!enteredPin) {
      throw new Error('PIN required');
    }

    return apiGet(url, true);
  }

  if (!res.ok) {
    const err = await parseJsonSafe(res);
    throw new Error(
      `GET ${url} failed with ${res.status}${err?.error ? `: ${err.error}` : ''}`
    );
  }

  return res.json();
}

async function apiPost(url, payload, hasRetried = false) {
  const tripId = payload?.id || '';
  const pin = tripId ? getStoredTripPin(tripId) : '';
  const isUpdate = !!tripId && !!pin;
  const finalUrl = isUpdate ? withTripQuery(url, tripId) : url;

  const res = await fetch(finalUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(isUpdate && pin ? { 'x-pin': pin } : {})
    },
    body: JSON.stringify(payload)
  });

  if (res.status === 401 && tripId && !hasRetried) {
    removeStoredTripPin(tripId);
    const enteredPin = ensureTripPin(tripId, 'Enter trip PIN:');
    if (!enteredPin) {
      throw new Error('PIN required');
    }
    return apiPost(url, payload, true);
  }

  if (!res.ok) {
    const err = await parseJsonSafe(res);
    throw new Error(`POST ${url} failed with ${res.status}${err?.error ? `: ${err.error}` : ''}`);
  }

  return parseJsonSafe(res);
}

async function apiDelete(url, payload, hasRetried = false) {
  const tripId = payload?.id || '';
  const pin = tripId ? getStoredTripPin(tripId) : '';

  const finalUrl = `${url}?trip=${encodeURIComponent(tripId)}`;

  const res = await fetch(finalUrl, {
    method: 'POST', // ✅ FIX HERE
    headers: {
      'Content-Type': 'application/json',
      ...(pin ? { 'x-pin': pin } : {})
    }
  });

  if (res.status === 401 && tripId && !hasRetried) {
    removeStoredTripPin(tripId);
    const enteredPin = ensureTripPin(tripId, 'Enter trip PIN:');
    if (!enteredPin) throw new Error('PIN required');
    return apiDelete(url, payload, true);
  }

  if (!res.ok) {
    const err = await parseJsonSafe(res);
    throw new Error(`DELETE ${url} failed with ${res.status}${err?.error ? `: ${err.error}` : ''}`);
  }

  return parseJsonSafe(res);
}

  if (res.status === 401 && tripId && !hasRetried) {
    removeStoredTripPin(tripId);
    const enteredPin = ensureTripPin(tripId, 'Enter trip PIN:');
    if (!enteredPin) {
      throw new Error('PIN required');
    }
    return apiDelete(url, payload, true);
  }

  if (!res.ok) {
    const err = await parseJsonSafe(res);
    throw new Error(`DELETE ${url} failed with ${res.status}${err?.error ? `: ${err.error}` : ''}`);
  }

  return parseJsonSafe(res);
}

/* ---------- TRIPS LIST PAGE ---------- */

async function loadTrips() {
  const container = document.getElementById('trip-list');
  if (!container) return;

  container.innerHTML = loadingCardGrid();

  try {
    const data = await apiGet(API_GET_TRIPS);
    const list = normalizeTripsResponse(data);
    trips = safeArray(list).map(normalizeTripSummary);

    if (!trips.length) {
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
      'Please check your API routes or server logs.',
      'triangle-alert'
    );
    refreshIcons();
  }
}

function normalizeTripSummary(raw) {
  return {
    id: raw.id ?? raw.tripId ?? raw._id ?? '',
    name: raw.name ?? raw.title ?? 'Untitled trip',
    activitiesCount: Array.isArray(raw.activities) ? raw.activities.length : Number(raw.activitiesCount || 0),
    startDate: raw.startDate || raw.start || null,
    endDate: raw.endDate || raw.end || null
  };
}

function renderTripList() {
  const container = document.getElementById('trip-list');
  if (!container) return;

  container.innerHTML = trips.map((trip) => {
    return `
      <article class="group rounded-3xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary-500/30">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
              <i data-lucide="map" class="h-5 w-5"></i>
            </div>
            <div>
              <h3 class="text-lg font-semibold tracking-tight">${escapeHtml(trip.name)}</h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">${trip.activitiesCount} activities</p>
            </div>
          </div>
        </div>

        <div class="mb-5 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
            <i data-lucide="calendar-days" class="h-3.5 w-3.5"></i>
            ${trip.startDate ? formatDayLabel(trip.startDate) : 'No start date'}
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
  const input = document.getElementById('newTripName');
  if (!input) return;

  const name = input.value.trim();
  if (!name) {
    alert('Please enter a trip name.');
    input.focus();
    return;
  }

  const pin = prompt('Set PIN for this trip:');
  if (!pin || !pin.trim()) {
    alert('PIN is required.');
    return;
  }

  const newTrip = {
    id: uuid(),
    name,
    pin: pin.trim(),
    activities: []
  };

  try {
    await apiPost(API_SAVE_TRIP, newTrip);
    storeTripPin(newTrip.id, newTrip.pin);
    input.value = '';
    await loadTrips();
  } catch (error) {
    console.error(error);
    removeStoredTripPin(newTrip.id);
    alert(`Failed to create trip.${error?.message ? `\n${error.message}` : ''}`);
  }
}

function openTrip(tripId) {
  const pin = ensureTripPin(tripId, 'Enter trip PIN to open this trip:');
  if (!pin) return;
  window.location.href = `/trip.html?id=${encodeURIComponent(tripId)}`;
}

async function renameTrip(tripId) {
  const trip = trips.find((t) => String(t.id) === String(tripId));
  if (!trip) return;

  const pin = ensureTripPin(tripId, 'Enter trip PIN to rename this trip:');
  if (!pin) return;

  const newName = prompt('Rename trip:', trip.name);
  if (newName === null) return;

  const trimmed = newName.trim();
  if (!trimmed) {
    alert('Trip name cannot be empty.');
    return;
  }

  try {
    const fullTrip = await fetchTrip(tripId);
    fullTrip.name = trimmed;
    await saveTrip(fullTrip);
    await loadTrips();
  } catch (error) {
    console.error(error);
    alert(`Failed to rename trip.${error?.message ? `\n${error.message}` : ''}`);
  }
}

async function deleteTrip(tripId) {
  const trip = trips.find((t) => String(t.id) === String(tripId));
  const pin = ensureTripPin(tripId, 'Enter trip PIN to delete this trip:');
  if (!pin) return;

  const ok = confirm(`Delete trip "${trip?.name || 'this trip'}"?`);
  if (!ok) return;

  try {
    await apiDelete(API_DELETE_TRIP, { id: tripId });
    removeStoredTripPin(tripId);
    await loadTrips();
  } catch (error) {
    console.error(error);
    alert(`Failed to delete trip.${error?.message ? `\n${error.message}` : ''}`);
  }
}

/* ---------- TRIP PAGE ---------- */

async function loadTripPage() {
  const tripId = getTripIdFromUrl();
  if (!tripId) {
    alert('Trip ID is missing.');
    return;
  }

  ensureTripPin(tripId, 'Enter trip PIN:');

  try {
    currentTrip = await fetchTrip(tripId);

    const titleEl = document.getElementById('trip-title');
    const heroTitleEl = document.getElementById('trip-title-hero');

    if (titleEl) titleEl.textContent = currentTrip.name || 'Trip';
    if (heroTitleEl) heroTitleEl.textContent = currentTrip.name || 'Trip';

    renderActivities();
  } catch (error) {
    console.error(error);
    const container = document.getElementById('activities');
    if (container) {
      container.innerHTML = emptyState(
        'Failed to load trip',
        error?.message || 'Check whether the trip exists and the correct PIN is stored.',
        'triangle-alert'
      );
      refreshIcons();
    }
  }
}

async function fetchTrip(tripId) {
  const data = await apiGet(`${API_GET_TRIP}?trip=${encodeURIComponent(tripId)}`);
  return normalizeFullTrip(data);
}

function normalizeFullTrip(raw) {
  return {
    id: raw.id ?? raw.tripId ?? raw._id ?? '',
    name: raw.name ?? raw.title ?? 'Untitled trip',
    pin: '',
    activities: sortActivities(
      safeArray(raw.activities).map((a) => ({
        id: a.id ?? a.activityId ?? uuid(),
        name: a.name ?? a.location ?? '',
        type: (a.type ?? 'other').toLowerCase(),
        location: a.location ?? a.name ?? '',
        startDate: a.start ?? a.startDate ?? '',
        endDate: a.end ?? a.endDate ?? '',
        cost: Number(a.cost || 0),
        km: Number(a.km || 0),
        notes: a.notes ?? ''
      }))
    )
  };
}

function renderActivities() {
  const container = document.getElementById('activities');
  if (!container || !currentTrip) return;

  const activities = sortActivities(currentTrip.activities);
  currentTrip.activities = activities;

  if (!activities.length) {
    container.innerHTML = emptyState(
      'No activities yet',
      'Add your first activity to build the itinerary.',
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

            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Start</div>
                <div class="text-sm font-medium">${escapeHtml(formatDateTime(activity.startDate))}</div>
              </div>
              <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">End</div>
                <div class="text-sm font-medium">${escapeHtml(formatDateTime(activity.endDate))}</div>
              </div>
              <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Cost</div>
                <div class="text-sm font-medium">${escapeHtml(formatCurrency(activity.cost))}</div>
              </div>
              <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Notes</div>
                <div class="text-sm font-medium">${escapeHtml(activity.notes || '—')}</div>
              </div>
            </div>
          </div>

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
        </div>
      </article>
    `;
  }).join('');

  refreshIcons();
}

function getActivityFormData() {
  return {
    name: document.getElementById('activityName')?.value.trim() || '',
    type: document.getElementById('activityType')?.value || 'other',
    startDate: document.getElementById('startDate')?.value || '',
    endDate: document.getElementById('endDate')?.value || '',
    cost: Number(document.getElementById('cost')?.value || 0),
    notes: document.getElementById('notes')?.value.trim() || '',
    km: Number(document.getElementById('km')?.value || 0)
  };
}

function setActivityFormData(activity) {
  const data = activity || {
    name: '',
    type: 'other',
    startDate: '',
    endDate: '',
    cost: '',
    notes: '',
    km: ''
  };

  const name = document.getElementById('activityName');
  const type = document.getElementById('activityType');
  const start = document.getElementById('startDate');
  const end = document.getElementById('endDate');
  const cost = document.getElementById('cost');
  const notes = document.getElementById('notes');
  const km = document.getElementById('km');

  if (name) name.value = data.location || data.name || '';
  if (type) type.value = data.type || 'other';
  if (start) start.value = data.startDate || '';
  if (end) end.value = data.endDate || '';
  if (cost) cost.value = data.cost || '';
  if (notes) notes.value = data.notes || '';
  if (km) km.value = data.km || '';
}

function resetActivityForm() {
  setActivityFormData(null);
  editingActivityId = null;

  const title = document.getElementById('activity-form-title');
  const cancelBtn = document.getElementById('cancel-edit-btn');

  if (title) title.textContent = 'Add activity';
  if (cancelBtn) cancelBtn.classList.add('hidden');
}

function cancelEditActivity() {
  resetActivityForm();
}

async function saveActivity() {
  if (!currentTrip) return;

  const data = getActivityFormData();

  if (!data.name) {
    alert('Activity name is required.');
    return;
  }

  const activity = {
    id: editingActivityId || uuid(),
    name: data.name,
    location: data.name,
    type: data.type,
    startDate: data.startDate,
    endDate: data.endDate,
    start: data.startDate,
    end: data.endDate,
    cost: data.cost,
    km: data.km,
    notes: data.notes
  };

  if (editingActivityId) {
    const index = currentTrip.activities.findIndex((a) => String(a.id) === String(editingActivityId));
    if (index >= 0) {
      currentTrip.activities[index] = activity;
    }
  } else {
    currentTrip.activities.push(activity);
  }

  currentTrip.activities = sortActivities(currentTrip.activities);

  try {
    await saveTrip(currentTrip);
    resetActivityForm();
    renderActivities();
  } catch (error) {
    console.error(error);
    alert(`Failed to save activity.${error?.message ? `\n${error.message}` : ''}`);
  }
}

function editActivity(activityId) {
  if (!currentTrip) return;

  const activity = currentTrip.activities.find((a) => String(a.id) === String(activityId));
  if (!activity) return;

  editingActivityId = activity.id;
  setActivityFormData(activity);

  const title = document.getElementById('activity-form-title');
  const cancelBtn = document.getElementById('cancel-edit-btn');

  if (title) title.textContent = 'Edit activity';
  if (cancelBtn) cancelBtn.classList.remove('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteActivity(activityId) {
  if (!currentTrip) return;

  const activity = currentTrip.activities.find((a) => String(a.id) === String(activityId));
  const ok = confirm(`Delete activity "${activity?.location || activity?.name || 'this activity'}"?`);
  if (!ok) return;

  currentTrip.activities = currentTrip.activities.filter((a) => String(a.id) !== String(activityId));

  try {
    await saveTrip(currentTrip);
    if (editingActivityId === activityId) resetActivityForm();
    renderActivities();
  } catch (error) {
    console.error(error);
    alert(`Failed to delete activity.${error?.message ? `\n${error.message}` : ''}`);
  }
}

async function saveTrip(trip) {
  if (!trip || !trip.id) {
    throw new Error('Invalid trip object');
  }

  const payload = {
    id: trip.id,
    name: trip.name || 'Untitled trip',
    pin: '',
    activities: safeArray(trip.activities).map((activity) => ({
      id: activity.id || uuid(),
      type: activity.type || 'other',
      location: activity.location || activity.name || '',
      start: activity.start || activity.startDate || '',
      end: activity.end || activity.endDate || '',
      cost: Number(activity.cost || 0),
      km: Number(activity.km || 0),
      notes: activity.notes || ''
    }))
  };

  return apiPost(API_SAVE_TRIP, payload);
}

/* ---------- TIMELINE PAGE ---------- */

async function loadTimeline() {
  const tripId = getTripIdFromUrl();
  const container = document.getElementById('timeline');
  if (!tripId || !container) return;

  ensureTripPin(tripId, 'Enter trip PIN:');
  container.innerHTML = loadingTimeline();

  try {
    currentTrip = await fetchTrip(tripId);

    const titleEl = document.getElementById('timeline-title');
    const heroTitleEl = document.getElementById('timeline-hero-title');

    if (titleEl) titleEl.textContent = `${currentTrip.name} Timeline`;
    if (heroTitleEl) heroTitleEl.textContent = `${currentTrip.name} Timeline`;

    renderTimeline();
  } catch (error) {
    console.error(error);
    container.innerHTML = emptyState(
      'Failed to load timeline',
      error?.message || 'The trip data could not be loaded.',
      'triangle-alert'
    );
    refreshIcons();
  }
}

function renderTimeline() {
  const container = document.getElementById('timeline');
  if (!container || !currentTrip) return;

  const activities = sortActivities(currentTrip.activities);

  if (!activities.length) {
    container.innerHTML = emptyState(
      'No activities in timeline',
      'Go back to the trip page and add some activities first.',
      'calendar-plus'
    );
    refreshIcons();
    return;
  }

  const groups = new Map();

  for (const activity of activities) {
    const key = dayKey(activity.startDate);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(activity);
  }

  const groupEntries = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));

  container.innerHTML = groupEntries.map(([key, dayActivities]) => {
    const label = key === 'undated'
      ? 'No date'
      : formatDayLabel(dayActivities[0]?.startDate);

    return `
      <section class="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div class="mb-6 flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
            <i data-lucide="calendar-days" class="h-5 w-5"></i>
          </div>
          <div>
            <h3 class="text-lg font-semibold tracking-tight">${escapeHtml(label)}</h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">${dayActivities.length} item${dayActivities.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        <div class="relative ml-2 border-l-2 border-slate-200 pl-6 dark:border-slate-700">
          ${dayActivities.map((activity) => {
            const meta = getTypeMeta(activity.type);
            return `
              <article class="relative mb-5 last:mb-0">
                <span class="absolute -left-[31px] top-5 flex h-5 w-5 items-center justify-center rounded-full border-4 border-white bg-primary-600 dark:border-slate-900"></span>

                <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div class="mb-3 flex flex-wrap items-center gap-2">
                    <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                      <i data-lucide="${meta.icon}" class="h-4 w-4"></i>
                    </span>
                    <h4 class="text-base font-semibold tracking-tight">${escapeHtml(activity.location || activity.name || 'Untitled activity')}</h4>
                    <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${meta.badge}">
                      ${escapeHtml(activity.type)}
                    </span>
                  </div>

                  <div class="grid gap-3 md:grid-cols-[120px_120px_1fr_140px]">
                    <div>
                      <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Start</div>
                      <div class="text-sm font-medium">${escapeHtml(formatTimeOnly(activity.startDate))}</div>
                    </div>
                    <div>
                      <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">End</div>
                      <div class="text-sm font-medium">${escapeHtml(formatTimeOnly(activity.endDate))}</div>
                    </div>
                    <div>
                      <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Notes</div>
                      <div class="text-sm font-medium">${escapeHtml(activity.notes || '—')}</div>
                    </div>
                    <div>
                      <div class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Cost</div>
                      <div class="text-sm font-medium">${escapeHtml(formatCurrency(activity.cost))}</div>
                    </div>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </section>
    `;
  }).join('');

  refreshIcons();
}

/* ---------- COSTS PAGE ---------- */

async function loadCosts() {
  const tripId = getTripIdFromUrl();
  const table = document.getElementById('cost-table');
  if (!tripId || !table) return;

  ensureTripPin(tripId, 'Enter trip PIN:');

  table.innerHTML = `
    <tr>
      <td colspan="4" class="px-3 py-8 text-center text-slate-500 dark:text-slate-400">Loading costs…</td>
    </tr>
  `;

  try {
    currentTrip = await fetchTrip(tripId);

    const titleEl = document.getElementById('costs-title');
    const heroTitleEl = document.getElementById('costs-hero-title');

    if (titleEl) titleEl.textContent = `${currentTrip.name} Costs`;
    if (heroTitleEl) heroTitleEl.textContent = `${currentTrip.name} Costs`;

    renderCosts();
  } catch (error) {
    console.error(error);
    table.innerHTML = `
      <tr>
        <td colspan="4" class="px-3 py-8 text-center text-red-600 dark:text-red-400">${escapeHtml(error?.message || 'Failed to load costs.')}</td>
      </tr>
    `;
  }
}

function renderCosts() {
  const table = document.getElementById('cost-table');
  const totalEl = document.getElementById('totalCost');
  const summaryEl = document.getElementById('cost-summary');
  const itemsCountEl = document.getElementById('cost-items-count');
  const categoriesCountEl = document.getElementById('cost-categories-count');

  if (!table || !totalEl || !summaryEl || !currentTrip) return;

  const activities = sortActivities(currentTrip.activities);
  const total = activities.reduce((sum, a) => sum + Number(a.cost || 0), 0);

  const byType = activities.reduce((acc, activity) => {
    const key = activity.type || 'other';
    acc[key] = (acc[key] || 0) + Number(activity.cost || 0);
    return acc;
  }, {});

  const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  totalEl.textContent = formatCurrency(total);
  if (itemsCountEl) itemsCountEl.textContent = String(activities.length);
  if (categoriesCountEl) categoriesCountEl.textContent = String(typeEntries.length);

  summaryEl.innerHTML = typeEntries.length
    ? typeEntries.map(([type, amount]) => {
        const meta = getTypeMeta(type);
        const percent = total > 0 ? Math.round((amount / total) * 100) : 0;

        return `
          <div class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <span class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                  <i data-lucide="${meta.icon}" class="h-4 w-4"></i>
                </span>
                <div>
                  <div class="font-medium capitalize">${escapeHtml(type)}</div>
                  <div class="text-sm text-slate-500 dark:text-slate-400">${percent}% of total</div>
                </div>
              </div>
              <div class="font-semibold">${escapeHtml(formatCurrency(amount))}</div>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div class="h-full rounded-full bg-primary-600" style="width:${percent}%"></div>
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
            <td class="rounded-l-2xl px-3 py-3">
              <div class="flex items-center gap-3">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                  <i data-lucide="${meta.icon}" class="h-4 w-4"></i>
                </span>
                <span class="font-medium">${escapeHtml(activity.location || activity.name || 'Untitled')}</span>
              </div>
            </td>
            <td class="px-3 py-3">
              <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${meta.badge}">
                ${escapeHtml(activity.type)}
              </span>
            </td>
            <td class="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">${escapeHtml(formatDateTime(activity.startDate))}</td>
            <td class="rounded-r-2xl px-3 py-3 text-right font-semibold">${escapeHtml(formatCurrency(activity.cost))}</td>
          </tr>
        `;
      }).join('')
    : `
      <tr>
        <td colspan="4" class="px-3 py-8 text-center text-slate-500 dark:text-slate-400">No activities yet.</td>
      </tr>
    `;

  refreshIcons();
}

/* ---------- NAVIGATION ---------- */

function goToTrip() {
  const tripId = getTripIdFromUrl();
  if (!tripId) return;
  window.location.href = `/trip.html?id=${encodeURIComponent(tripId)}`;
}

function goToTimeline() {
  const tripId = getTripIdFromUrl();
  if (!tripId) return;
  window.location.href = `/timeline.html?id=${encodeURIComponent(tripId)}`;
}

function goToCosts() {
  const tripId = getTripIdFromUrl();
  if (!tripId) return;
  window.location.href = `/costs.html?id=${encodeURIComponent(tripId)}`;
}

/* ---------- UI SNIPPETS ---------- */

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

function refreshIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}
