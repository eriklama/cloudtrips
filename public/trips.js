/* =========================
 * trips.js
 * Index page trip logic — load, add, rename, delete, open.
 * Depends on: state.js, helpers.js, ui.js, api.js
 * ========================= */

async function loadTrips() {
  const container = document.getElementById('trip-list');
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

// Populate year filter
const years = [...new Set(
  state.trips
    .map(t => t.startDate ? new Date(t.startDate).getFullYear() : null)
    .filter(Boolean)
    .sort((a, b) => b - a)
)];

const yearSelect = document.getElementById('tripYearFilter');
if (yearSelect) {
  const current = yearSelect.value;
  yearSelect.innerHTML = '<option value="">All years</option>' +
    years.map(y => `<option value="${y}" ${String(y) === current ? 'selected' : ''}>${y}</option>`).join('');
}

async function addTrip() {
  const input = document.getElementById('newTripName');
  if (!input) return;

  const name = input.value.trim();
  if (!name) {
    showToast('Please enter a trip name.', 'info');
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
    showToast(error?.message || 'Failed to create trip.', 'error');
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
    showToast('Trip name cannot be empty.', 'info');
    return;
  }

  const previousName = trip.name;
  trip.name = trimmed;
  renderTripList();

  try {
    const fullTrip = await fetchTrip(tripId, { forceRefresh: true });
    fullTrip.name = trimmed;
    await saveTrip(fullTrip);
  } catch (error) {
    trip.name = previousName;
    renderTripList();
    console.error(error);
    showToast(error?.message || 'Failed to rename trip.', 'error');
  }
}

async function deleteTrip(tripId) {
  const trip = state.trips.find((item) => String(item.id) === String(tripId));

  const confirmed = await openConfirmModal({
    title: 'Delete trip',
    message: `"${trip?.name || 'this trip'}" will be permanently deleted.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    danger: true
  });
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
    showToast(error?.message || 'Failed to delete trip.', 'error');
  }
}

function filterTrips() {
  const search = (document.getElementById('tripSearch')?.value || '').toLowerCase().trim();
  const year = document.getElementById('tripYearFilter')?.value || '';

  const filtered = state.trips.filter(trip => {
    const matchesSearch = !search ||
      trip.name.toLowerCase().includes(search) ||
      (trip.notes || '').toLowerCase().includes(search);

    const matchesYear = !year ||
      (trip.startDate && new Date(trip.startDate).getFullYear() === Number(year));

    return matchesSearch && matchesYear;
  });

  const container = document.getElementById('trip-list');
  if (!container) return;

  if (!filtered.length) {
    container.innerHTML = emptyState(
      'No trips found',
      'Try a different search or year filter.',
      'search'
    );
    refreshIcons();
    return;
  }

  container.innerHTML = filtered.map(trip => {
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

        <div class="mb-2 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
            <i data-lucide="calendar-days" class="h-3.5 w-3.5"></i>
            ${escapeHtml(dateLabel)}
          </span>
        </div>

        ${trip.notes ? `
          <p class="mb-3 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">${escapeHtml(trip.notes)}</p>
        ` : ''}

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