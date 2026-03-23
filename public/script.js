const API_GET = '/getTrips';
const API_SAVE = '/saveTrips';

let trips = [];

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);

  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response from ${url}, received ${contentType}`);
  }

  return res.json();
}

// ---------- LOAD TRIPS ----------
async function loadTrips() {
  trips = await fetchJson(API_GET);
  renderTrips();
}

function renderTrips() {
  const list = document.getElementById('trip-list');
  if (!list) return;

  list.innerHTML = '';

  trips.forEach(t => {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `
      <strong>${escapeHtml(t.name)}</strong><br>
      <button class="btn" onclick="openTrip('${t.id}')">Open</button>
    `;
    list.appendChild(d);
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
  location.href = `/trip.html?trip=${encodeURIComponent(id)}`;
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

// ---------- TRIP PAGE ----------
async function loadTripPage() {
  trips = await fetchJson(API_GET);

  const id = getTripId();
  const tr = trips.find(t => String(t.id) === String(id));

  if (!tr) {
    const title = document.getElementById('trip-title');
    if (title) title.innerText = 'Trip not found';
    return;
  }

  const title = document.getElementById('trip-title');
  if (title) title.innerText = tr.name;

  const timelineLink = document.getElementById('timeline-link');
  if (timelineLink) {
    timelineLink.href = `/timeline.html?trip=${encodeURIComponent(id)}`;
  }

  const costsLink = document.getElementById('costs-link');
  if (costsLink) {
    costsLink.href = `/costs.html?trip=${encodeURIComponent(id)}`;
  }

  renderAct(tr);
}

function renderAct(tr) {
  const list = document.getElementById('activity-list');
  if (!list) return;

  list.innerHTML = '';

  if (!tr.activities || tr.activities.length === 0) {
    list.innerHTML = `<div class="empty-state">No activities yet.</div>`;
    return;
  }

  tr.activities.forEach(a => {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `
      <span class="tag ${escapeHtml(a.type)}">${escapeHtml(a.type)}</span><br>
      ${escapeHtml(a.start || '')} → ${escapeHtml(a.end || '')}<br>
      Cost: ${Number(a.cost || 0)} €<br>
      ${escapeHtml(a.notes || '')}
    `;
    list.appendChild(d);
  });
}

async function addActivity() {
  const id = getTripId();
  const tr = trips.find(t => String(t.id) === String(id));
  if (!tr) return;

  const a = {
    id: 'a' + Date.now(),
    type: document.getElementById('type').value,
    start: document.getElementById('start').value,
    end: document.getElementById('end').value,
    cost: Number(document.getElementById('cost').value || 0),
    notes: document.getElementById('notes').value.trim()
  };

  if (!tr.activities) tr.activities = [];
  tr.activities.push(a);

  await saveTrips();
  await loadTripPage();
}

// ---------- TIMELINE ----------
async function loadTimeline() {
  trips = await fetchJson(API_GET);
  const tr = trips.find(t => String(t.id) === String(getTripId()));
  if (!tr) return;

  const c = document.getElementById('timeline');
  if (!c) return;

  c.innerHTML = '';

  const activities = [...(tr.activities || [])].sort(
    (a, b) => new Date(a.start) - new Date(b.start)
  );

  if (activities.length === 0) {
    c.innerHTML = `<div class="empty-state">No activities yet.</div>`;
    return;
  }

  activities.forEach(a => {
    const d = document.createElement('div');
    d.className = 'timeline-item';
    d.innerHTML = `
      <div class="circle"></div>
      <div class="timeline-content">
        <span class="tag ${escapeHtml(a.type)}">${escapeHtml(a.type)}</span><br>
        ${escapeHtml(a.start || '')} → ${escapeHtml(a.end || '')}<br>
        ${escapeHtml(a.notes || '')}
      </div>
    `;
    c.appendChild(d);
  });
}

// ---------- COSTS ----------
async function loadCosts() {
  trips = await fetchJson(API_GET);
  const tr = trips.find(t => String(t.id) === String(getTripId()));
  if (!tr) return;

  const table = document.getElementById('cost-table');
  if (!table) return;

  table.innerHTML = '';

  let total = 0;

  const activities = tr.activities || [];

  if (activities.length === 0) {
    table.innerHTML = `<tr><td colspan="2">No activities yet.</td></tr>`;
  }

  activities.forEach(a => {
    total += Number(a.cost || 0);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="tag ${escapeHtml(a.type)}">${escapeHtml(a.type)}</span></td>
      <td>${Number(a.cost || 0)} €</td>
    `;
    table.appendChild(row);
  });

  const totalEl = document.getElementById('total');
  if (totalEl) totalEl.innerText = total.toFixed(2);
}

// ---------- HELPERS ----------
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ---------- GLOBALS ----------
window.loadTrips = loadTrips;
window.addTrip = addTrip;
window.openTrip = openTrip;
window.loadTripPage = loadTripPage;
window.addActivity = addActivity;
window.loadTimeline = loadTimeline;
window.loadCosts = loadCosts;
