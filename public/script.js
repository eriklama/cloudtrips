const API_GET = '/getTrips';
const API_SAVE = '/saveTrips';

let trips = [];

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('trip-list')) loadTrips();
  if (document.getElementById('trip-title')) loadTripPage();
  if (document.getElementById('timeline')) loadTimeline();
  if (document.getElementById('cost-table')) loadCosts();
});

// ---------- HTTP ----------
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

// ---------- HELPERS ----------
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDateTime(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return escapeHtml(value);

  return d.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
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

// ---------- MAIN PAGE ----------
async function loadTrips() {
  try {
    trips = await fetchJson(API_GET);
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

    const title = document.createElement('strong');
    title.textContent = t.name || 'Untitled trip';

    const actions = document.createElement('div');
    actions.style.marginTop = '12px';

    const openBtn = document.createElement('button');
    openBtn.className = 'btn';
    openBtn.type = 'button';
    openBtn.textContent = 'Open';
    openBtn.addEventListener('click', () => openTrip(t.id));

    actions.appendChild(openBtn);
    card.appendChild(title);
    card.appendChild(actions);
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
  const tr = trips.find((t) => String(t.id) === String(id));

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

  const activities = [...tr.activities].sort(sortByStart);

  activities.forEach((a) => {
    const d = document.createElement('div');
    d.className = 'card';
    d.innerHTML = `
      <span class="tag ${escapeHtml(a.type)}">${escapeHtml(a.type)}</span><br>
      <div class="location-line">${escapeHtml(a.location || '')}</div>
      ${formatDateTime(a.start)} → ${formatDateTime(a.end)}<br>
      Cost: ${Number(a.cost || 0).toFixed(2)} €<br>
      ${escapeHtml(a.notes || '')}
    `;
    list.appendChild(d);
  });
}

async function addActivity() {
  const id = getTripId();
  const tr = trips.find((t) => String(t.id) === String(id));
  if (!tr) return;

  const a = {
    id: 'a' + Date.now(),
    type: document.getElementById('type').value,
    location: document.getElementById('location').value.trim(),
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
  const tr = trips.find((t) => String(t.id) === String(getTripId()));
  if (!tr) return;

  const c = document.getElementById('timeline');
  if (!c) return;

  c.innerHTML = '';

  const activities = [...(tr.activities || [])].sort(sortByStart);

  if (activities.length === 0) {
    c.innerHTML = `<div class="empty-state">No activities yet.</div>`;
    return;
  }

  activities.forEach((a) => {
    const d = document.createElement('div');
    d.className = 'timeline-item';
    d.innerHTML = `
      <div class="circle"></div>
      <div class="timeline-content">
        <span class="tag ${escapeHtml(a.type)}">${escapeHtml(a.type)}</span><br>
        <div class="location-line">${escapeHtml(a.location || '')}</div>
        ${formatDateTime(a.start)} → ${formatDateTime(a.end)}<br>
        ${escapeHtml(a.notes || '')}
      </div>
    `;
    c.appendChild(d);
  });
}

// ---------- COSTS ----------
async function loadCosts() {
  trips = await fetchJson(API_GET);
  const tr = trips.find((t) => String(t.id) === String(getTripId()));
  if (!tr) return;

  const table = document.getElementById('cost-table');
  if (!table) return;

  table.innerHTML = '';

  let total = 0;
  const activities = [...(tr.activities || [])].sort(sortByStart);

  if (activities.length === 0) {
    table.innerHTML = `<tr><td colspan="4">No activities yet.</td></tr>`;
  }

  activities.forEach((a) => {
    total += Number(a.cost || 0);
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><span class="tag ${escapeHtml(a.type)}">${escapeHtml(a.type)}</span></td>
      <td>${escapeHtml(a.location || '')}</td>
      <td>${formatDateTime(a.start)}</td>
      <td>${Number(a.cost || 0).toFixed(2)} €</td>
    `;
    table.appendChild(row);
  });

  const totalEl = document.getElementById('total');
  if (totalEl) totalEl.innerText = total.toFixed(2);
}

// ---------- GLOBALS ----------
window.loadTrips = loadTrips;
window.addTrip = addTrip;
window.openTrip = openTrip;
window.loadTripPage = loadTripPage;
window.addActivity = addActivity;
window.loadTimeline = loadTimeline;
window.loadCosts = loadCosts;
