const API_GET_TRIPS = '/getTrips';
const API_GET_TRIP = '/getTrip';
const API_SAVE_TRIP = '/saveTrip';

let trips = [];
let currentTrip = null;
let editingActivityId = null;

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('trip-list')) loadTrips();
  if (document.getElementById('trip-title')) loadTripPage();
  if (document.getElementById('timeline')) loadTimeline();
  if (document.getElementById('cost-table')) loadCosts();
});

// ---------- STORAGE ----------
function getTripPinKey(tripId) {
  return `trip_pin_${tripId}`;
}

function getStoredTripPin(tripId) {
  return localStorage.getItem(getTripPinKey(tripId)) || '';
}

function setStoredTripPin(tripId, pin) {
  localStorage.setItem(getTripPinKey(tripId), pin);
}

function clearStoredTripPin(tripId) {
  localStorage.removeItem(getTripPinKey(tripId));
}

function promptTripPin(tripId) {
  const pin = prompt('Enter PIN for this trip:')?.trim() || '';
  if (pin) {
    setStoredTripPin(tripId, pin);
  }
  return pin;
}

function getTripPin(tripId, promptIfMissing = true) {
  let pin = getStoredTripPin(tripId);
  if (!pin && promptIfMissing) {
    pin = promptTripPin(tripId);
  }
  return pin;
}

// ---------- HTTP ----------
async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);

  if (!res.ok) {
    const error = new Error(`Request failed: ${res.status}`);
    error.status = res.status;
    throw error;
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response from ${url}, received ${contentType}`);
  }

  return res.json();
}

async function fetchProtectedTrip(tripId) {
  let pin = getTripPin(tripId, false);

  if (!pin) {
    pin = promptTripPin(tripId);
  }

  if (!pin) {
    throw new Error('PIN required');
  }

  try {
    return await fetchJson(`${API_GET_TRIP}?trip=${encodeURIComponent(tripId)}`, {
      headers: {
        'x-pin': pin
      }
    });
  } catch (error) {
    if (error.status === 401) {
      clearStoredTripPin(tripId);
      const retryPin = promptTripPin(tripId);

      if (!retryPin) {
        throw error;
      }

      return fetchJson(`${API_GET_TRIP}?trip=${encodeURIComponent(tripId)}`, {
        headers: {
          'x-pin': retryPin
        }
      });
    }

    throw error;
  }
}

async function saveExistingTrip(trip) {
  const pin = getTripPin(trip.id, false);
  if (!pin) {
    throw new Error('Missing stored PIN for trip');
  }

  return fetchJson(`${API_SAVE_TRIP}?trip=${encodeURIComponent(trip.id)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pin': pin
    },
    body: JSON.stringify(trip)
  });
}

async function createNewTrip(trip, pin) {
  return fetchJson(API_SAVE_TRIP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...trip,
      pin
    })
  });
}

// ---------- HELPERS ----------
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateTime(value) {
  if (!value) return '';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(value);

  return d.toLocaleString([], {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDayLabel(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(value);

  return d.toLocaleDateString([], {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function getDayKey(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'unknown';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function sortByStart(a, b) {
  const da = new Date(a.start || '');
  const db = new Date(b.start || '');
  return da - db;
}

function getTripId() {
  return new URLSearchParams(location.search).get('trip');
}

function openTrip(id) {
  location.href = `/trip.html?trip=${encodeURIComponent(id)}`;
}

function resetActivityForm() {
  const typeEl = document.getElementById('type');
  const locationEl = document.getElementById('location');
  const startEl = document.getElementById('start');
  const endEl = document.getElementById('end');
  const costEl = document.getElementById('cost');
  const notesEl = document.getElementById('notes');

  if (typeEl) typeEl.value = 'plane';
  if (locationEl) locationEl.value = '';
  if (startEl) startEl.value = '';
  if (endEl) endEl.value = '';
  if (costEl) costEl.value = '';
  if (notesEl) notesEl.value = '';

  editingActivityId = null;
  updateActivityFormButtons();
}

function updateActivityFormButtons() {
  let addBtn = document.getElementById('save-activity-btn');
  const container = document.getElementById('activity-form-actions');

  if (!addBtn) {
    addBtn = document.querySelector('button[onclick="addActivity()"]');
    if (addBtn) addBtn.id = 'save-activity-btn';
  }

  if (addBtn) {
    addBtn.textContent = editingActivityId ? 'Save Changes' : 'Add Activity';
  }

  if (!container) return;

  let cancelBtn = document.getElementById('cancel-edit-btn');

  if (editingActivityId) {
    if (!cancelBtn) {
      cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.id = 'cancel-edit-btn';
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = 'Cancel Edit';
      cancelBtn.addEventListener('click', resetActivityForm);
      container.appendChild(cancelBtn);
    }
  } else if (cancelBtn) {
    cancelBtn.remove();
  }
}

function ensureActivityFormActions() {
  let saveBtn = document.getElementById('save-activity-btn');

  if (!saveBtn) {
    saveBtn = document.querySelector('button[onclick="addActivity()"]');
    if (saveBtn) saveBtn.id = 'save-activity-btn';
  }

  if (!saveBtn) return;

  let container = document.getElementById('activity-form-actions');

  if (!container) {
    container = document.createElement('div');
    container.id = 'activity-form-actions';
    container.className = 'section-actions';
    saveBtn.parentNode.insertBefore(container, saveBtn);
    container.appendChild(saveBtn);
  }
}

// ---------- MAIN PAGE ----------
async function loadTrips() {
  try {
    trips = await fetchJson(API_GET_TRIPS);
    if (!Array.isArray(trips)) trips = [];
    renderTrips();
  } catch (e) {
    console.error('Failed to load trips:', e);
    const list = document.getElementById('trip-list');
    if (list) {
      list.innerHTML = `<div class="empty-state">Failed to load trips.</div>`;
    }
  }
}

function renderTrips() {
  const list = document.getElementById('trip-list');
  if (!list) return;

  list.innerHTML = '';

  if (!Array.isArray(trips) || trips.length === 0) {
    list.innerHTML = `<div class="empty-state">No trips yet.</div>`;
    return;
  }

  trips.forEach((t) => {
    const card = document.createElement('div');
    card.className = 'card';

    const storedPin = getStoredTripPin(t.id);

    card.innerHTML = `
      <div class="trip-card">
        <div class="trip-card-main">
          <div class="trip-card-title">${escapeHtml(t.name || 'Untitled trip')}</div>
          <div class="trip-card-meta">${storedPin ? 'PIN saved on this device' : 'PIN required to open'}</div>
        </div>
        <div class="trip-card-actions">
          <button type="button" class="btn">Open</button>
          <button type="button" class="btn btn-secondary">Forget PIN</button>
        </div>
      </div>
    `;

    const buttons = card.querySelectorAll('button');
    const openBtn = buttons[0];
    const forgetBtn = buttons[1];

    openBtn.addEventListener('click', () => openTrip(t.id));
    forgetBtn.addEventListener('click', () => {
      clearStoredTripPin(t.id);
      renderTrips();
    });

    list.appendChild(card);
  });
}

async function addTrip() {
  const nameInput = document.getElementById('newTripName');
  const pinInput = document.getElementById('newTripPin');

  if (!nameInput || !pinInput) return;

  const name = nameInput.value.trim();
  const pin = pinInput.value.trim();

  if (!name || !pin) {
    alert('Trip name and PIN are required.');
    return;
  }

  const newTrip = {
    id: String(Date.now()),
    name,
    activities: []
  };

  await createNewTrip(newTrip, pin);
  setStoredTripPin(newTrip.id, pin);

  nameInput.value = '';
  pinInput.value = '';

  await loadTrips();
}

// ---------- TRIP PAGE ----------
async function loadTripPage() {
  const tripId = getTripId();
  if (!tripId) return;

  try {
    currentTrip = await fetchProtectedTrip(tripId);

    const title = document.getElementById('trip-title');
    if (title) title.innerText = currentTrip.name;

    const timelineLink = document.getElementById('timeline-link');
    if (timelineLink) {
      timelineLink.href = `/timeline.html?trip=${encodeURIComponent(tripId)}`;
    }

    const costsLink = document.getElementById('costs-link');
    if (costsLink) {
      costsLink.href = `/costs.html?trip=${encodeURIComponent(tripId)}`;
    }

    ensureActivityFormActions();
    updateActivityFormButtons();
    renderActivities(currentTrip);
  } catch (e) {
    console.error('Failed to load trip page:', e);
    const list = document.getElementById('activity-list');
    const title = document.getElementById('trip-title');

    if (title) title.innerText = 'Trip unavailable';
    if (list) {
      list.innerHTML = `<div class="empty-state">Could not open trip. PIN may be missing or incorrect.</div>`;
    }
  }
}

function renderActivities(trip) {
  const list = document.getElementById('activity-list');
  if (!list) return;

  list.innerHTML = '';

  if (!trip.activities || trip.activities.length === 0) {
    list.innerHTML = `<div class="empty-state">No activities yet.</div>`;
    return;
  }

  const activities = [...trip.activities].sort(sortByStart);

  activities.forEach((a) => {
    const d = document.createElement('div');
    d.className = 'card activity-card';

    const notesHtml = a.notes
      ? `<div class="muted">${escapeHtml(a.notes)}</div>`
      : '';

    d.innerHTML = `
      <div class="activity-actions-top">
        <button type="button" class="btn">Edit</button>
        <button type="button" class="btn btn-secondary">Delete</button>
      </div>

      <div class="tag ${escapeHtml(a.type || 'other')}">${escapeHtml(a.type || 'other')}</div>
      <div class="location-line">${escapeHtml(a.location || '')}</div>
      <div class="muted">
        ${formatDateTime(a.start)}${a.end ? ` → ${formatDateTime(a.end)}` : ''}
      </div>
      <div class="muted">Cost: ${Number(a.cost || 0).toFixed(2)} €</div>
      ${notesHtml}
    `;

    const buttons = d.querySelectorAll('button');
    const editBtn = buttons[0];
    const deleteBtn = buttons[1];

    editBtn.addEventListener('click', () => editActivity(a.id));
    deleteBtn.addEventListener('click', () => deleteActivity(a.id));

    list.appendChild(d);
  });
}

async function addActivity() {
  if (!currentTrip) return;

  const typeEl = document.getElementById('type');
  const locationEl = document.getElementById('location');
  const startEl = document.getElementById('start');
  const endEl = document.getElementById('end');
  const costEl = document.getElementById('cost');
  const notesEl = document.getElementById('notes');

  const activity = {
    id: editingActivityId || ('a' + Date.now()),
    type: typeEl ? typeEl.value : 'plane',
    location: locationEl ? locationEl.value.trim() : '',
    start: startEl ? startEl.value : '',
    end: endEl ? endEl.value : '',
    cost: Number(costEl ? costEl.value || 0 : 0),
    notes: notesEl ? notesEl.value.trim() : ''
  };

  if (!currentTrip.activities) currentTrip.activities = [];

  if (editingActivityId) {
    const index = currentTrip.activities.findIndex((a) => String(a.id) === String(editingActivityId));
    if (index !== -1) {
      currentTrip.activities[index] = activity;
    }
  } else {
    currentTrip.activities.push(activity);
  }

  await saveExistingTrip(currentTrip);
  resetActivityForm();
  await loadTripPage();
}

function editActivity(activityId) {
  if (!currentTrip || !Array.isArray(currentTrip.activities)) return;

  const activity = currentTrip.activities.find((a) => String(a.id) === String(activityId));
  if (!activity) return;

  document.getElementById('type').value = activity.type || 'plane';
  document.getElementById('location').value = activity.location || '';
  document.getElementById('start').value = activity.start || '';
  document.getElementById('end').value = activity.end || '';
  document.getElementById('cost').value = activity.cost ?? '';
  document.getElementById('notes').value = activity.notes || '';

  editingActivityId = activity.id;
  updateActivityFormButtons();

  const formCard = document.getElementById('save-activity-btn')?.closest('.card');
  if (formCard) {
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

async function deleteActivity(activityId) {
  if (!currentTrip || !Array.isArray(currentTrip.activities)) return;

  currentTrip.activities = currentTrip.activities.filter((a) => String(a.id) !== String(activityId));

  if (String(editingActivityId) === String(activityId)) {
    resetActivityForm();
  }

  await saveExistingTrip(currentTrip);
  await loadTripPage();
}

// ---------- TIMELINE ----------
function renderTimelineGrouped(activities) {
  const container = document.getElementById('timeline');
  if (!container) return;

  container.innerHTML = '';

  if (!activities || activities.length === 0) {
    container.innerHTML = `<div class="empty-state">No activities yet.</div>`;
    return;
  }

  const sorted = [...activities].sort(sortByStart);
  const groups = {};

  sorted.forEach((a) => {
    const key = getDayKey(a.start);
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });

  const dayKeys = Object.keys(groups).sort();

  dayKeys.forEach((day, index) => {
    const dayBlock = document.createElement('div');
    dayBlock.className = `timeline-day${index % 2 === 1 ? ' alt' : ''}`;

    const label = day === 'unknown' ? 'No date' : formatDayLabel(day);
    dayBlock.innerHTML = `<div class="timeline-day-header">${escapeHtml(label)}</div>`;

    groups[day].forEach((a) => {
      const item = document.createElement('div');
      item.className = 'timeline-item';

      const timeLine = a.end
        ? `${formatDateTime(a.start)} → ${formatDateTime(a.end)}`
        : `${formatDateTime(a.start)}`;

      item.innerHTML = `
        <div class="circle"></div>
        <div class="timeline-content">
          <div class="tag ${escapeHtml(a.type || 'other')}">${escapeHtml(a.type || 'other')}</div>
          <div class="location-line">${escapeHtml(a.location || '')}</div>
          <div class="muted">${escapeHtml(timeLine)}</div>
          ${a.notes ? `<div class="muted">${escapeHtml(a.notes)}</div>` : ''}
        </div>
      `;

      dayBlock.appendChild(item);
    });

    container.appendChild(dayBlock);
  });
}

async function loadTimeline() {
  const tripId = getTripId();
  if (!tripId) return;

  try {
    currentTrip = await fetchProtectedTrip(tripId);

    const title = document.getElementById('timeline-title');
    if (title) title.innerText = `${currentTrip.name} Timeline`;

    const tripLink = document.getElementById('timeline-trip-link');
    if (tripLink) {
      tripLink.href = `/trip.html?trip=${encodeURIComponent(tripId)}`;
    }

    const costsLink = document.getElementById('timeline-costs-link');
    if (costsLink) {
      costsLink.href = `/costs.html?trip=${encodeURIComponent(tripId)}`;
    }

    renderTimelineGrouped(currentTrip.activities || []);
  } catch (e) {
    console.error('Failed to load timeline:', e);
    const c = document.getElementById('timeline');
    if (c) {
      c.innerHTML = `<div class="empty-state">Could not open timeline.</div>`;
    }
  }
}

// ---------- COSTS ----------
async function loadCosts() {
  const tripId = getTripId();
  if (!tripId) return;

  try {
    currentTrip = await fetchProtectedTrip(tripId);

    const title = document.getElementById('costs-title');
    if (title) title.innerText = `${currentTrip.name} Costs`;

    const tripLink = document.getElementById('costs-trip-link');
    if (tripLink) {
      tripLink.href = `/trip.html?trip=${encodeURIComponent(tripId)}`;
    }

    const timelineLink = document.getElementById('costs-timeline-link');
    if (timelineLink) {
      timelineLink.href = `/timeline.html?trip=${encodeURIComponent(tripId)}`;
    }

    const table = document.getElementById('cost-table');
    if (!table) return;

    table.innerHTML = '';

    let total = 0;
    const activities = [...(currentTrip.activities || [])].sort(sortByStart);

    if (activities.length === 0) {
      table.innerHTML = `<tr><td colspan="4">No activities yet.</td></tr>`;
    }

    activities.forEach((a) => {
      total += Number(a.cost || 0);

      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${escapeHtml(a.type || '')}</td>
        <td>${escapeHtml(a.location || '')}</td>
        <td>${formatDateTime(a.start)}</td>
        <td>${Number(a.cost || 0).toFixed(2)} €</td>
      `;

      table.appendChild(row);
    });

    const totalEl = document.getElementById('total');
    if (totalEl) totalEl.innerText = total.toFixed(2);
  } catch (e) {
    console.error('Failed to load costs:', e);
    const table = document.getElementById('cost-table');
    if (table) {
      table.innerHTML = `<tr><td colspan="4">Could not open costs.</td></tr>`;
    }
  }
}

// ---------- GLOBALS ----------
window.loadTrips = loadTrips;
window.addTrip = addTrip;
window.openTrip = openTrip;
window.loadTripPage = loadTripPage;
window.addActivity = addActivity;
window.editActivity = editActivity;
window.deleteActivity = deleteActivity;
window.loadTimeline = loadTimeline;
window.loadCosts = loadCosts;
