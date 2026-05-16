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
    state.tripsLoaded = true;

    if (!state.trips.length) {
      container.innerHTML = emptyState(
        'No trips yet',
        'Create your first trip to start planning.',
        'luggage'
      );
      refreshIcons();
      return;
    }

    // Apply any search/filter the user typed while loading, otherwise render all
    const searchEl = document.getElementById('tripSearch');
    const yearEl = document.getElementById('tripYearFilter');
    if (searchEl?.value.trim() || yearEl?.value) {
      filterTrips();
    } else {
      renderTripList();
    }

    // Render quick stats strip
    const statsEl = document.getElementById('index-stats');
    if (statsEl && state.trips.length) {
      const totalTrips = state.trips.length;
      const countries = [...new Set(state.trips.map(t => t.country).filter(Boolean))];
      const years = [...new Set(state.trips.map(t => t.startDate ? new Date(t.startDate).getFullYear() : null).filter(Boolean))];

      const stat = (icon, label, value, clickable = false) => `
        <div class="${clickable
          ? 'rounded-2xl bg-primary-600 px-4 py-3 cursor-pointer transition hover:bg-primary-500 active:scale-[0.98] shadow-sm'
          : 'rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3'}">
          <div class="mb-1 flex items-center gap-1.5 text-xs ${clickable ? 'text-primary-200' : 'text-slate-500 dark:text-slate-400'}">
            <i data-lucide="${icon}" class="h-3.5 w-3.5"></i>${escapeHtml(label)}
          </div>
          <div class="text-sm font-semibold ${clickable ? 'text-white' : 'text-slate-900 dark:text-slate-100'}">${escapeHtml(String(value))}</div>
        </div>`;

      statsEl.classList.remove('hidden');
      statsEl.innerHTML = [
        stat('map', 'Trips', totalTrips),
        stat('flag', 'Countries', countries.length || '—'),
        stat('calendar', 'Years', years.length || '—'),
        stat('bar-chart-2', 'Full stats', '→ View', true),
      ].join('');

      // Make the last card a link
      const lastCard = statsEl.lastElementChild;
      if (lastCard) {
        lastCard.onclick = () => { window.location.href = '/stats.html'; };
      }

      refreshIcons();
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
    await apiPost(API.SAVE_TRIP_META, { name });
    input.value = '';
    await loadTrips();
  } catch (error) {
    console.error(error);
    showToast(error?.message || 'Failed to create trip.', 'error');
  }
}

async function duplicateTrip(tripId) {
  const trip = state.trips.find((item) => String(item.id) === String(tripId));
  if (!trip) return;

  const confirmed = await openConfirmModal({
    title: 'Duplicate trip',
    message: `Create a copy of "${trip.name}" with all its activities?`,
    confirmText: 'Duplicate',
    cancelText: 'Cancel'
  });
  if (!confirmed) return;

  try {
    const result = await apiPost(API.DUPLICATE_TRIP, { tripId });
    await loadTrips();
    showToast(`"${result.trip.name}" created with ${result.trip.activitiesCount} activities.`, 'success');
  } catch (err) {
    console.error(err);
    showToast(err?.message || 'Failed to duplicate trip.', 'error');
  }
}

window.duplicateTrip = duplicateTrip;
window.addTrip = addTrip;
window.openTrip = openTrip;
window.renameTrip = renameTrip;
window.deleteTrip = deleteTrip;
window.loadTrips = loadTrips;
window.filterTrips = filterTrips;

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
    await apiPost(API.SAVE_TRIP_META, { id: tripId, name: trimmed, notes: trip.notes || '' });
    clearTripCache(tripId);
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
  // Trips not yet loaded — let loadTrips() render when ready
  if (!state.trips.length && !state.tripsLoaded) return;

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

  container.innerHTML = filtered.map(renderTripCard).join('');

  refreshIcons();
}