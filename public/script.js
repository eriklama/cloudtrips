const API_GET = '/functions/getTrips';
const API_SAVE = '/functions/saveTrips';

let trips = [];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response from ${url}, received ${contentType || 'unknown content type'}`);
  }

  try {
    return text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`Invalid JSON response from ${url}`);
  }
}

async function loadTrips() {
  trips = await fetchJson(API_GET);
  if (!Array.isArray(trips)) trips = [];
  renderTrips();
}

function renderTrips() {
  const list = document.getElementById('trip-list');
  if (!list) return;

  list.innerHTML = '';

  if (trips.length === 0) {
    list.innerHTML = '<div class="card">No trips yet. Add your first trip.</div>';
    return;
  }

  trips.forEach((trip) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <strong>${escapeHtml(trip.name)}</strong><br>
      <button type="button" onclick="openTrip('${escapeHtml(trip.id)}')">Open</button>
    `;
    list.appendChild(card);
  });
}

async function addTrip() {
  const input = document.getElementById('newTripName');
  if (!input) return;

  const name = input.value.trim();
  if (!name) return;

  trips.push({
    id: String(Date.now()),
    name,
    activities: []
  });

  await saveTrips();
  input.value = '';
  await loadTrips();
}

function openTrip(id) {
  location.href = `trip.html?trip=${encodeURIComponent(id)}`;
}

function getTripId() {
  return new URLSearchParams(location.search).get('trip');
}

async function saveTrips() {
  await fetchJson(API_SAVE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(trips)
  });
}

async function loadTripPage() {
  trips = await fetchJson(API_GET);
  if (!Array.isArray(trips)) trips = [];

  const id = getTripId();
  const trip = trips.find((t) => String(t.id) === String(id));

  const title = document.getElementById('trip-title');
  const list = document.getElementById('activity-list');

  if (!trip) {
    if (title) title.textContent = 'Trip not found';
    if (list) list.innerHTML = '<div class="card">This trip does not exist.</div>';
    return;
  }

  if (title) title.textContent = trip.name;
  renderActivities(trip);
}

function renderActivities(trip) {
  const list = document.getElementById('activity-list');
  if (!list) return;

  list.innerHTML = '';

  if (!Array.isArray(trip.activities) || trip.activities.length === 0) {
    list.innerHTML = '<div class="card">No activities yet.</div>';
    return;
  }

  trip.activities.forEach((activity) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <span class="tag ${escapeHtml(activity.type)}">${escapeHtml(activity.type)}</span><br>
      ${escapeHtml(activity.start || '')} → ${escapeHtml(activity.end || '')}<br>
      Cost: ${Number(activity.cost || 0)}€<br>
      ${escapeHtml(activity.notes || '')}
    `;
    list.appendChild(card);
  });
}

async function addActivity() {
  const id = getTripId();
  const trip = trips.find((t) => String(t.id) === String(id));
  if (!trip) return;

  const activity = {
    id: `a${Date.now()}`,
    type: document.getElementById('type')?.value || 'other',
    start: document.getElementById('start')?.value || '',
    end: document.getElementById('end')?.value || '',
    cost: Number(document.getElementById('cost')?.value || 0),
    notes: document.getElementById('notes')?.value || ''
  };

  trip.activities = Array.isArray(trip.activities) ? trip.activities : [];
  trip.activities.push(activity);

  await saveTrips();
  await loadTripPage();
}

async function loadTimeline() {
  trips = await fetchJson(API_GET);
  if (!Array.isArray(trips)) trips = [];

  const trip = trips.find((t) => String(t.id) === String(getTripId()));
  const container = document.getElementById('timeline');
  if (!container) return;

  if (!trip) {
    container.innerHTML = '<div class="card">Trip not found.</div>';
    return;
  }

  const activities = Array.isArray(trip.activities) ? [...trip.activities] : [];
  container.innerHTML = '';

  if (activities.length === 0) {
    container.innerHTML = '<div class="card">No activities to display.</div>';
    return;
  }

  activities
    .sort((a, b) => new Date(a.start || 0) - new Date(b.start || 0))
    .forEach((activity) => {
      const item = document.createElement('div');
      item.className = 'timeline-item';
      item.innerHTML = `
        <div class="circle"></div>
        <div>
          <span class="tag ${escapeHtml(activity.type)}">${escapeHtml(activity.type)}</span><br>
          ${escapeHtml(activity.start || '')} → ${escapeHtml(activity.end || '')}<br>
          ${escapeHtml(activity.notes || '')}
        </div>
      `;
      container.appendChild(item);
    });
}

async function loadCosts() {
  trips = await fetchJson(API_GET);
  if (!Array.isArray(trips)) trips = [];

  const trip = trips.find((t) => String(t.id) === String(getTripId()));
  const table = document.getElementById('cost-table');
  const totalEl = document.getElementById('total');

  if (!table) return;
  table.innerHTML = '';

  if (!trip) {
    table.innerHTML = '<tr><td colspan="2">Trip not found.</td></tr>';
    if (totalEl) totalEl.textContent = '0';
    return;
  }

  const activities = Array.isArray(trip.activities) ? trip.activities : [];

  if (activities.length === 0) {
    table.innerHTML = '<tr><td colspan="2">No activity costs yet.</td></tr>';
    if (totalEl) totalEl.textContent = '0';
    return;
  }

  let total = 0;

  activities.forEach((activity) => {
    const cost = Number(activity.cost || 0);
    total += cost;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="tag ${escapeHtml(activity.type)}">${escapeHtml(activity.type)}</span></td>
      <td>${cost}€</td>
    `;
    table.appendChild(row);
  });

  if (totalEl) totalEl.textContent = String(total);
}

function initPage() {
  if (document.getElementById('trip-list')) {
    loadTrips().catch(console.error);
  }
  if (document.getElementById('trip-title')) {
    loadTripPage().catch(console.error);
  }
  if (document.getElementById('timeline')) {
    loadTimeline().catch(console.error);
  }
  if (document.getElementById('cost-table')) {
    loadCosts().catch(console.error);
  }
}

document.addEventListener('DOMContentLoaded', initPage);

window.loadTrips = loadTrips;
window.addTrip = addTrip;
window.loadTripPage = loadTripPage;
window.addActivity = addActivity;
window.loadTimeline = loadTimeline;
window.loadCosts = loadCosts;
window.openTrip = openTrip;
