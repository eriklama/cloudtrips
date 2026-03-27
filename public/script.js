const API_GET_TRIPS = '/getTrips';
const API_GET_TRIP = '/getTrip';
const API_SAVE_TRIP = '/saveTrip';
const API_DELETE_TRIP = '/deleteTrip';

let trips = [];
let currentTrip = null;
let editingActivityId = null;

/* ---------- INIT ---------- */

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('trip-list')) loadTrips();
  if (document.getElementById('trip-title')) loadTripPage();
  if (document.getElementById('timeline')) loadTimeline();
  if (document.getElementById('cost-table')) loadCosts();
});

/* ---------- PIN STORAGE ---------- */

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
  if (pin) setStoredTripPin(tripId, pin);
  return pin;
}

function getTripPin(tripId, ask = true) {
  let pin = getStoredTripPin(tripId);
  if (!pin && ask) pin = promptTripPin(tripId);
  return pin;
}

/* ---------- HTTP ---------- */

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }

  return res.json();
}

/* ---------- HELPERS ---------- */

function escapeHtml(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDateTime(v) {
  if (!v) return '';
  const d = new Date(v);
  return d.toLocaleString([], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDayLabel(v) {
  const d = new Date(v);
  return d.toLocaleDateString([], {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function getDayKey(v) {
  const d = new Date(v);
  return d.toISOString().split('T')[0];
}

function sortByStart(a, b) {
  return new Date(a.start) - new Date(b.start);
}

function getTripId() {
  return new URLSearchParams(location.search).get('trip');
}

function openTrip(id) {
  location.href = `/trip.html?trip=${id}`;
}

/* ---------- TRIPS ---------- */

async function loadTrips() {
  trips = await fetchJson(API_GET_TRIPS);
  renderTrips();
}

function renderTrips() {
  const list = document.getElementById('trip-list');
  list.innerHTML = '';

  if (!trips.length) {
    list.innerHTML = `<div class="empty-state">No trips</div>`;
    return;
  }

  trips.forEach(t => {
    const hasPin = !!getStoredTripPin(t.id);

    const div = document.createElement('div');
    div.className = 'card';

    div.innerHTML = `
      <div class="trip-card">
        <div>
          <div class="trip-card-title">${escapeHtml(t.name)}</div>
          <div class="muted">${hasPin ? '🔓 PIN saved' : '🔒 Locked'}</div>
        </div>
        <div>
          <button onclick="openTrip('${t.id}')">Open</button>
          <button onclick="deleteTrip('${t.id}')" class="btn-secondary">Delete</button>
        </div>
      </div>
    `;

    list.appendChild(div);
  });
}

async function addTrip() {
  const name = document.getElementById('newTripName').value.trim();
  const pin = document.getElementById('newTripPin').value.trim();

  if (!name || !pin) {
    alert("Name + PIN required");
    return;
  }

  const trip = {
    id: Date.now().toString(),
    name,
    activities: []
  };

  await fetchJson(API_SAVE_TRIP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...trip, pin })
  });

  setStoredTripPin(trip.id, pin);

  document.getElementById('newTripName').value = '';
  document.getElementById('newTripPin').value = '';

  loadTrips();
}

/* ---------- DELETE TRIP ---------- */

async function deleteTrip(tripId) {
  if (!confirm("Delete this trip?")) return;

  let pin = getTripPin(tripId);
  if (!pin) return;

  try {
    await fetchJson(`${API_DELETE_TRIP}?trip=${tripId}`, {
      method: 'POST',
      headers: { 'x-pin': pin }
    });

    clearStoredTripPin(tripId);
    loadTrips();

  } catch (err) {
    if (err.status === 401) {
      clearStoredTripPin(tripId);
      alert("Wrong PIN");
    } else {
      alert("Delete failed");
    }
  }
}

/* ---------- FETCH SINGLE TRIP ---------- */

async function fetchTrip(tripId) {
  let pin = getTripPin(tripId);
  if (!pin) return null;

  try {
    return await fetchJson(`${API_GET_TRIP}?trip=${tripId}`, {
      headers: { 'x-pin': pin }
    });
  } catch (err) {
    if (err.status === 401) {
      clearStoredTripPin(tripId);
      pin = promptTripPin(tripId);
      if (!pin) return null;

      return fetchJson(`${API_GET_TRIP}?trip=${tripId}`, {
        headers: { 'x-pin': pin }
      });
    }
    throw err;
  }
}

/* ---------- TRIP PAGE ---------- */

async function loadTripPage() {
  const id = getTripId();
  if (!id) return;

  currentTrip = await fetchTrip(id);
  if (!currentTrip) return;

  document.getElementById('trip-title').innerText = currentTrip.name;

  renderActivities();
}

/* ---------- ACTIVITIES ---------- */

function renderActivities() {
  const list = document.getElementById('activity-list');
  list.innerHTML = '';

  if (!currentTrip.activities.length) {
    list.innerHTML = `<div class="empty-state">No activities</div>`;
    return;
  }

  currentTrip.activities.sort(sortByStart).forEach(a => {
    const div = document.createElement('div');
    div.className = 'card activity-card';

    div.innerHTML = `
      <div class="activity-actions-top">
        <button onclick="editActivity('${a.id}')">Edit</button>
        <button onclick="deleteActivity('${a.id}')" class="btn-secondary">Delete</button>
      </div>

      <div class="tag ${a.type}">${a.type}</div>
      <div class="location-line">${escapeHtml(a.location)}</div>
      <div class="muted">
        ${formatDateTime(a.start)} → ${formatDateTime(a.end)}
      </div>
    `;

    list.appendChild(div);
  });
}

async function addActivity() {
  const a = {
    id: editingActivityId || Date.now().toString(),
    type: document.getElementById('type').value,
    location: document.getElementById('location').value,
    start: document.getElementById('start').value,
    end: document.getElementById('end').value,
    cost: Number(document.getElementById('cost').value || 0),
    notes: document.getElementById('notes').value
  };

  if (editingActivityId) {
    const i = currentTrip.activities.findIndex(x => x.id === editingActivityId);
    currentTrip.activities[i] = a;
  } else {
    currentTrip.activities.push(a);
  }

  editingActivityId = null;

  await saveTrip();
  loadTripPage();
}

function editActivity(id) {
  const a = currentTrip.activities.find(x => x.id === id);
  if (!a) return;

  document.getElementById('type').value = a.type;
  document.getElementById('location').value = a.location;
  document.getElementById('start').value = a.start;
  document.getElementById('end').value = a.end;
  document.getElementById('cost').value = a.cost;
  document.getElementById('notes').value = a.notes;

  editingActivityId = id;
}

async function deleteActivity(id) {
  currentTrip.activities = currentTrip.activities.filter(a => a.id !== id);
  await saveTrip();
  loadTripPage();
}

/* ---------- SAVE ---------- */

async function saveTrip() {
  const pin = getTripPin(currentTrip.id, false);

  await fetchJson(`${API_SAVE_TRIP}?trip=${currentTrip.id}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-pin': pin
    },
    body: JSON.stringify(currentTrip)
  });
}

/* ---------- TIMELINE ---------- */

async function loadTimeline() {
  const id = getTripId();
  currentTrip = await fetchTrip(id);
  if (!currentTrip) return;

  renderTimelineGrouped(currentTrip.activities);
}

function renderTimelineGrouped(activities) {
  const container = document.getElementById('timeline');
  container.innerHTML = '';

  const groups = {};

  activities.forEach(a => {
    const key = getDayKey(a.start);
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  });

  Object.keys(groups).forEach((day, i) => {
    const div = document.createElement('div');
    div.className = `timeline-day ${i % 2 ? 'alt' : ''}`;

    div.innerHTML = `<div class="timeline-day-header">${formatDayLabel(day)}</div>`;

    groups[day].forEach(a => {
      div.innerHTML += `
        <div class="timeline-item">
          <div class="circle"></div>
          <div class="timeline-content">
            <div class="location-line">${escapeHtml(a.location)}</div>
            <div class="muted">
              ${formatDateTime(a.start)} → ${formatDateTime(a.end)}
            </div>
          </div>
        </div>
      `;
    });

    container.appendChild(div);
  });
}

/* ---------- COSTS ---------- */

async function loadCosts() {
  const id = getTripId();
  currentTrip = await fetchTrip(id);
  if (!currentTrip) return;

  const table = document.getElementById('cost-table');
  table.innerHTML = '';

  let total = 0;

  currentTrip.activities.forEach(a => {
    total += a.cost || 0;

    table.innerHTML += `
      <tr>
        <td>${a.type}</td>
        <td>${escapeHtml(a.location)}</td>
        <td>${formatDateTime(a.start)}</td>
        <td>${a.cost.toFixed(2)} €</td>
      </tr>
    `;
  });

  document.getElementById('total').innerText = total.toFixed(2);
}

function openTimeline() {
  const id = getTripId();
  if (!id) return;
  location.href = `/timeline.html?trip=${id}`;
}

function openCosts() {
  const id = getTripId();
  if (!id) return;
  location.href = `/costs.html?trip=${id}`;
}

/* ---------- GLOBALS ---------- */

window.loadTrips = loadTrips;
window.addTrip = addTrip;
window.openTrip = openTrip;
window.deleteTrip = deleteTrip;

window.loadTripPage = loadTripPage;
window.addActivity = addActivity;
window.editActivity = editActivity;
window.deleteActivity = deleteActivity;

window.loadTimeline = loadTimeline;
window.loadCosts = loadCosts;

window.openTimeline = openTimeline;
window.openCosts = openCosts;
