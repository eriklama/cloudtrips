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

async function addTrip() {
  const input = document.getElementById('newTripName');
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

  const previousName = trip.name;
  trip.name = trimmed;
  renderTripList();

  try {
    const fullTrip = await fetchTrip(tripId);
    fullTrip.name = trimmed;
    await saveTrip(fullTrip);
  } catch (error) {
    trip.name = previousName;
    renderTripList();
    console.error(error);
    alert(`Failed to rename trip.${error?.message ? `\n${error.message}` : ''}`);
  }
}

async function deleteTrip(tripId) {
  const trip = state.trips.find((item) => String(item.id) === String(tripId));
  const confirmed = confirm(`Delete trip "${trip?.name || 'this trip'}"?`);
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
