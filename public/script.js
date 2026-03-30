
(() => {
  'use strict';

  /* =========================
   * CONFIG / STATE
   * ========================= */

  const API = {
    GET_TRIPS: '/getTrips',
    GET_TRIP: '/getTrip',
    SAVE_TRIP: '/saveTrip',
    DELETE_TRIP: '/deleteTrip'
  };

  const state = {
    trips: [],
    currentTrip: null,
    editingActivityId: null,
    timelineCollapsedDays: new Set()
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

  function withTripQuery(url, tripId) {
    const full = new URL(url, window.location.origin);
    full.searchParams.set('trip', tripId);
    return `${full.pathname}${full.search}`;
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

  function openPinModal(message = 'Enter trip PIN') {
    return openTextModal({
      title: message,
      placeholder: 'PIN',
      value: '',
      confirmText: 'Continue',
      cancelText: 'Cancel',
      inputType: 'password'
    });
  }

  /* =========================
   * PIN STORAGE
   * ========================= */

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

  async function ensureTripPin(tripId, message = 'Enter trip PIN:') {
    let pin = getStoredTripPin(tripId);
    if (pin) return pin;

    const entered = await openPinModal(message);
    if (!entered || !entered.trim()) return '';

    pin = entered.trim();
    storeTripPin(tripId, pin);
    return pin;
  }

  /* =========================
   * NORMALIZERS
   * ========================= */

  function normalizeActivity(raw) {
    const startDate = raw.startDate ?? raw.start ?? '';
    const endDate = raw.endDate ?? raw.end ?? '';
    const location = raw.location ?? raw.name ?? '';
    const name = raw.name ?? raw.location ?? '';

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
      km: Number(raw.km || raw.distance || 0),
      notes: raw.notes ?? ''
    };
  }

  function normalizeFullTrip(raw) {
    return {
      id: raw.id ?? raw.tripId ?? raw._id ?? '',
      name: raw.name ?? raw.title ?? 'Untitled trip',
      pin: '',
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
   * API
   * ========================= */

  async function parseJsonSafe(response) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  async function apiGet(url, hasRetried = false) {
    const fullUrl = new URL(url, window.location.origin);
    const tripId = fullUrl.searchParams.get('trip');

    let pin = tripId ? getStoredTripPin(tripId) : '';
    if (tripId && !pin) {
      pin = await ensureTripPin(tripId, 'Enter trip PIN:');
      if (!pin) {
        throw new Error('PIN required');
      }
    }

    const response = await fetch(fullUrl.toString(), {
      method: 'GET',
      headers: pin ? { 'x-pin': pin } : {}
    });

    if (response.status === 401 && tripId && !hasRetried) {
      removeStoredTripPin(tripId);

      const enteredPin = await ensureTripPin(tripId, 'Wrong PIN, try again:');
      if (!enteredPin) {
        throw new Error('PIN required');
      }

      return apiGet(url, true);
    }

    if (!response.ok) {
      const errorPayload = await parseJsonSafe(response);
      throw new Error(`GET ${url} failed with ${response.status}${errorPayload?.error ? `: ${errorPayload.error}` : ''}`);
    }

    return response.json();
  }

  async function apiPost(url, payload, hasRetried = false) {
    const tripId = payload?.id || '';
    const pin = tripId ? getStoredTripPin(tripId) : '';
    const isUpdate = Boolean(tripId && pin);
    const finalUrl = isUpdate ? withTripQuery(url, tripId) : url;

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(isUpdate && pin ? { 'x-pin': pin } : {})
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 401 && tripId && !hasRetried) {
      removeStoredTripPin(tripId);

      const enteredPin = await ensureTripPin(tripId, 'Enter trip PIN:');
      if (!enteredPin) {
        throw new Error('PIN required');
      }

      return apiPost(url, payload, true);
    }

    if (!response.ok) {
      const errorPayload = await parseJsonSafe(response);
      throw new Error(`POST ${url} failed with ${response.status}${errorPayload?.error ? `: ${errorPayload.error}` : ''}`);
    }

    return parseJsonSafe(response);
  }

  async function apiDelete(url, payload, hasRetried = false) {
    const tripId = payload?.id || '';
    const pin = tripId ? getStoredTripPin(tripId) : '';
    const finalUrl = `${url}?trip=${encodeURIComponent(tripId)}`;

    const response = await fetch(finalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(pin ? { 'x-pin': pin } : {})
      }
    });

    if (response.status === 401 && tripId && !hasRetried) {
      removeStoredTripPin(tripId);

      const enteredPin = await ensureTripPin(tripId, 'Enter trip PIN:');
      if (!enteredPin) {
        throw new Error('PIN required');
      }

      return apiDelete(url, payload, true);
    }

    if (!response.ok) {
      const errorPayload = await parseJsonSafe(response);
      throw new Error(`DELETE ${url} failed with ${response.status}${errorPayload?.error ? `: ${errorPayload.error}` : ''}`);
    }

    return parseJsonSafe(response);
  }

  async function fetchTrip(tripId) {
    const data = await apiGet(`${API.GET_TRIP}?trip=${encodeURIComponent(tripId)}`);
    return normalizeFullTrip(data);
  }

  async function saveTrip(trip) {
    if (!trip || !trip.id) {
      throw new Error('Invalid trip object');
    }

    const payload = {
      id: trip.id,
      name: trip.name || 'Untitled trip',
      pin: '',
      activities: safeArray(trip.activities).map((activity) => {
        const normalized = normalizeActivity(activity);
        return {
          id: normalized.id || uuid(),
          type: normalized.type || 'other',
          location: normalized.location || normalized.name || '',
          start: normalized.startDate || '',
          end: normalized.endDate || '',
          cost: Number(normalized.cost || 0),
          km: Number(normalized.km || 0),
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
        'Please check your API routes or server logs.',
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

    const pin = await openPinModal('Set PIN for this trip:');
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
      await apiPost(API.SAVE_TRIP, newTrip);
      storeTripPin(newTrip.id, newTrip.pin);
      input.value = '';
      await loadTrips();
    } catch (error) {
      console.error(error);
      removeStoredTripPin(newTrip.id);
      alert(`Failed to create trip.${error?.message ? `\n${error.message}` : ''}`);
    }
  }

  async function openTrip(tripId) {
    const pin = await ensureTripPin(tripId, 'Enter trip PIN to open this trip:');
    if (!pin) return;
    window.location.href = `/trip.html?id=${encodeURIComponent(tripId)}`;
  }

  async function renameTrip(tripId) {
    const trip = state.trips.find((item) => String(item.id) === String(tripId));
    if (!trip) return;

    const pin = await ensureTripPin(tripId, 'Enter trip PIN to rename this trip:');
    if (!pin) return;

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
    const trip = state.trips.find((item) => String(item.id) === String(tripId));
    const pin = await ensureTripPin(tripId, 'Enter trip PIN to delete this trip:');
    if (!pin) return;

    const confirmed = confirm(`Delete trip "${trip?.name || 'this trip'}"?`);
    if (!confirmed) return;

    try {
      await apiDelete(API.DELETE_TRIP, { id: tripId });
      removeStoredTripPin(tripId);
      await loadTrips();
    } catch (error) {
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

    const pin = await ensureTripPin(tripId, 'Enter trip PIN:');
    if (!pin) return;

    try {
      state.currentTrip = await fetchTrip(tripId);
      setText('trip-title', state.currentTrip.name || 'Trip');
      setText('trip-title-hero', state.currentTrip.name || 'Trip');
      renderActivities();
    } catch (error) {
      console.error(error);
      const container = $('activities');

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

  function getActivityFormData() {
    return {
      name: $('activityName')?.value.trim() || '',
      type: $('activityType')?.value || 'other',
      startDate: $('startDate')?.value || '',
      endDate: $('endDate')?.value || '',
      cost: Number($('cost')?.value || 0),
      notes: $('notes')?.value.trim() || '',
      km: Number($('activity-distance')?.value || 0)
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
      km: ''
    };

    if ($('activityName')) $('activityName').value = data.location || data.name || '';
    if ($('activityType')) $('activityType').value = data.type || 'other';
    if ($('startDate')) $('startDate').value = data.startDate || '';
    if ($('endDate')) $('endDate').value = data.endDate || '';
    if ($('cost')) $('cost').value = data.cost || '';
    if ($('notes')) $('notes').value = data.notes || '';
    if ($('activity-distance')) $('activity-distance').value = data.km || '';
  }

  function resetActivityForm() {
    setActivityFormData(null);
    state.editingActivityId = null;

    const title = $('activity-form-title');
    const cancelButton = $('cancel-edit-btn');

    if (title) title.textContent = 'Add activity';
    if (cancelButton) cancelButton.classList.add('hidden');
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

  async function saveActivity() {
    if (!state.currentTrip) return;

    const data = getActivityFormData();
    if (!data.name) {
      alert('Activity name is required.');
      return;
    }

    const activity = normalizeActivity({
      id: state.editingActivityId || uuid(),
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

  function editActivity(activityId) {
    if (!state.currentTrip) return;

    const activity = state.currentTrip.activities.find((item) => String(item.id) === String(activityId));
    if (!activity) return;

    state.editingActivityId = activity.id;
    setActivityFormData(activity);

    const title = $('activity-form-title');
    const cancelButton = $('cancel-edit-btn');

    if (title) title.textContent = 'Edit activity';
    if (cancelButton) cancelButton.classList.remove('hidden');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteActivity(activityId) {
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

  function toggleDay(day) {
    if (state.timelineCollapsedDays.has(day)) {
      state.timelineCollapsedDays.delete(day);
    } else {
      state.timelineCollapsedDays.add(day);
    }

    renderTimeline();
  }

  async function loadTimeline() {
    const tripId = getTripIdFromUrl();
    const container = $('timeline');
    if (!tripId || !container) return;

    const pin = await ensureTripPin(tripId, 'Enter trip PIN:');
    if (!pin) return;

    container.innerHTML = loadingTimeline();

    try {
      state.currentTrip = await fetchTrip(tripId);
      setText('timeline-title', `${state.currentTrip.name} Timeline`);
      setText('timeline-hero-title', `${state.currentTrip.name} Timeline`);
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

      return `
        <section class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onclick="toggleDay('${escapeHtml(key)}')"
            class="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100 dark:bg-slate-800/70 dark:hover:bg-slate-800"
          >
            <div class="min-w-0">
              <div class="text-sm font-semibold tracking-tight">${escapeHtml(label)}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">${dayActivities.length} item${dayActivities.length === 1 ? '' : 's'}</div>
            </div>

            <span class="shrink-0 text-sm text-slate-500 dark:text-slate-300">
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

  /* =========================
   * COSTS PAGE
   * ========================= */

  async function loadCosts() {
    const tripId = getTripIdFromUrl();
    const table = $('cost-table');
    if (!tripId || !table) return;

    const pin = await ensureTripPin(tripId, 'Enter trip PIN:');
    if (!pin) return;

    table.innerHTML = `
      <tr>
        <td colspan="5" class="px-3 py-8 text-center text-slate-500 dark:text-slate-400">Loading costs…</td>
      </tr>
    `;

    try {
      state.currentTrip = await fetchTrip(tripId);
      setText('costs-title', `${state.currentTrip.name} Costs`);
      setText('costs-hero-title', `${state.currentTrip.name} Costs`);
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

              <td class="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
                ${escapeHtml(formatDateTime(activity.startDate))}
              </td>

              <td class="px-3 py-3 text-right font-semibold">
                ${escapeHtml(formatCurrency(activity.cost))}
              </td>

              <td class="rounded-r-2xl px-3 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
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
   * NAVIGATION
   * ========================= */

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

  /* =========================
   * APP INIT
   * ========================= */

  async function init() {
    try {
      if (hasEl('trip-list')) {
        await loadTrips();
      }

      if (hasEl('activities')) {
        await loadTripPage();
      }

      if (hasEl('timeline')) {
        await loadTimeline();
      }

      if (hasEl('cost-table')) {
        await loadCosts();
      }
    } catch (error) {
      console.error(error);
    }

    refreshIcons();
  }

  document.addEventListener('DOMContentLoaded', init);

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
  window.cancelEditActivity = cancelEditActivity;
  window.goToTrip = goToTrip;
  window.goToTimeline = goToTimeline;
  window.goToCosts = goToCosts;
  window.toggleDay = toggleDay;
})();
