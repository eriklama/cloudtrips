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