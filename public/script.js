const API_GET = '/getTrips';
const API_SAVE = '/saveTrips';

let trips = [];
let editingActivityId = null;

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

function getCurrentTrip() {
  const id = getTripId();
  return trips.find((t) => String(t.id) === String(id));
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

  ensureActivityFormActions();
  updateActivityFormButtons();
  renderAct(tr);
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
    container.className = 'trip-nav';
    saveBtn.parentNode.insertBefore(container, saveBtn);
    container.appendChild(saveBtn);
  }
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

    const actions = document.createElement('div');
    actions.className = 'trip-nav';
    actions.style.margin = '12px 0 0';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => editActivity(a.id));

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-secondary';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', () => deleteActivity(a.id));

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    d.innerHTML = `
      <span class="tag ${escapeHtml(a.type)}">${escapeHtml(a.type)}</span><br>
      <div class="location-line">${escapeHtml(a.location || '')}</div>
      ${formatDateTime(a.start)} → ${formatDateTime(a.end)}<br>
      Cost: ${Number(a.cost || 0).toFixed(2)} €<br>
      ${escapeHtml(a.notes || '')}
    `;

    d.appendChild(actions);
    list.appendChild(d);
  });
}

async function addActivity() {
  const tr = getCurrentTrip();
  if (!tr) return;

  const activity = {
    id: editingActivityId || ('a' + Date.now()),
    type: document.getElementById('type').value,
    location: document.getElementById('location').value.trim(),
    start: document.getElementById('start').value,
    end: document.getElementById('end').value,
    cost: Number(document.getElementById('cost').value || 0),
    notes: document.getElementById('notes').value.trim()
  };

  if (!tr.activities) tr.activities = [];

  if (editingActivityId) {
    const index = tr.activities.findIndex((a) => String(a.id) === String(editingActivityId));
    if (index !== -1) {
      tr.activities[index] = activity;
    }
  } else {
    tr.activities.push(activity);
  }

  await saveTrips();
  resetActivityForm();
  await loadTripPage();
}

function editActivity(activityId) {
  const tr = getCurrentTrip();
  if (!tr || !Array.isArray(tr.activities)) return;

  const activity = tr.activities.find((a) => String(a.id) === String(activityId));
  if (!activity) return;

  document.getElementById('type').value = activity.type || 'plane';
  document.getElementById('location').value = activity.location || '';
  document.getElementById('start').value = activity.start || '';
  document.getElementById('end').value = activity.end || '';
  document.getElementById('cost').value = activity.cost ?? '';
  document.getElementById('notes').value = activity.notes || '';

  editingActivityId = activity.id;
  updateActivityFormButtons();
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

async function deleteActivity(activityId) {
  const tr = getCurrentTrip();
  if (!tr || !Array.isArray(tr.activities)) return;

  tr.activities = tr.activities.filter((a) => String(a.id) !== String(activityId));

  if (String(editingActivityId) === String(activityId)) {
    resetActivityForm();
  }

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
window.editActivity = editActivity;
window.deleteActivity = deleteActivity;
