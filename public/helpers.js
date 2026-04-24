/* =========================
 * helpers.js
 * Pure utility functions — no dependencies on other modules.
 * ========================= */

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

/* =========================
 * FORMATTERS
 * ========================= */

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

  return new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(date);
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

/* =========================
 * DATE KEY HELPERS
 * ========================= */

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

/* =========================
 * TIMELINE STORAGE HELPERS
 * ========================= */

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
    window.localStorage.setItem(
      getTimelineViewStorageKey(tripId),
      view === 'calendar' ? 'calendar' : 'timeline'
    );
  } catch {
    // ignore storage errors
  }
}

/* =========================
 * TYPE META & ICONS
 * ========================= */

function getTypeMeta(type) {
  const normalized = String(type || 'other').toLowerCase();
  const map = {
    plane:         { icon: 'plane',       badge: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300' },
    car:           { icon: 'car',         badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' },
    hike:          { icon: 'mountain',    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' },
    city:          { icon: 'building-2',  badge: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300' },
    accommodation: { icon: 'bed-double',  badge: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300' },
    other:         { icon: 'map-pinned',  badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' }
  };
  return map[normalized] || map.other;
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
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

function normalizeTripsResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.trips)) return data.trips;
  return [];
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
  if (form) form.style.display = 'none';

  const addBtn = document.querySelector('button[onclick="addActivity()"]');
  if (addBtn) addBtn.style.display = 'none';

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
 * TRIP CACHE
 * ========================= */

function saveTripToCache(trip) {
  try {
    sessionStorage.setItem(`trip_cache_${trip.id}`, JSON.stringify(trip));
  } catch {
    // ignore storage errors
  }
}

function getTripFromCache(tripId) {
  try {
    const cached = sessionStorage.getItem(`trip_cache_${tripId}`);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function clearTripCache(tripId) {
  try {
    sessionStorage.removeItem(`trip_cache_${tripId}`);
  } catch {
    // ignore
  }
}