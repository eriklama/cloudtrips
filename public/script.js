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

function formatTime(value) {
  if (!value) return '';

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';

  return d.toLocaleTimeString([], {
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

    const activityCount = Array.isArray(t.activities) ? t.activities.length : 0;

    card.innerHTML = `
      <div class="trip-card">
        <div class="trip-card-main">
          <div class="trip-card-title">${escapeHtml(t.name || 'Untitled trip')}</div>
          <div class="trip-card-meta">${activityCount} activit${activityCount === 1 ? 'y' : 'ies'}</div>
        </div>
        <div class="trip-card-actions">
          <button type="button" class="btn">Open</button>
          <button type="button" class="btn btn-secondary">Delete</button>
        </div>
      </div>
    `;

    const buttons = card.querySelectorAll('button');
    const openBtn = buttons[0];
    const deleteBtn = buttons[1];

    openBtn.addEventListener('click', () => openTrip(t.id));
    deleteBtn.addEventListener('click', () => deleteTrip(t.id));

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

async function deleteTrip(tripId) {
  const trip = trips.find((t) => String(t.id) === String(tripId));
  if (!trip) return;

  const confirmed = confirm(`Delete trip "${trip.name}"?`);
  if (!confirmed) return;

  trips = trips.filter((t) => String(t.id) !== String(tripId));
  await saveTrips();
  renderTrips();
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
  try {
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
    renderActivities(tr);
  } catch (e) {
    console.error('Failed to load trip page:', e);

    const list = document.getElementById('activity-list');
    if (list) {
      list.innerHTML = `<div class="empty-state">Failed to load trip.</div>`;
    }
  }
}

function renderActivities(tr) {
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
  const tr = getCurrentTrip();
  if (!tr) return;

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

  const formCard = document.getElementById('save-activity-btn')?.closest('.card');
  if (formCard) {
    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }
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
          <div class="muted">${escapeHtml(timeLine || formatDateTime(a.start))}</div>
          ${a.notes ? `<div class="muted">${escapeHtml(a.notes)}</div>` : ''}
        </div>
      `;

      dayBlock.appendChild(item);
    });

    container.appendChild(dayBlock);
  });
}

async function loadTimeline() {
  try {
    trips = await fetchJson(API_GET);

    const tripId = getTripId();
    const tr = trips.find((t) => String(t.id) === String(tripId));
    if (!tr) return;

    const title = document.getElementById('timeline-title');
    if (title) title.innerText = `${tr.name} Timeline`;

    const tripLink = document.getElementById('timeline-trip-link');
    if (tripLink) {
      tripLink.href = `/trip.html?trip=${encodeURIComponent(tripId)}`;
    }

    const costsLink = document.getElementById('timeline-costs-link');
    if (costsLink) {
      costsLink.href = `/costs.html?trip=${encodeURIComponent(tripId)}`;
    }

    renderTimelineGrouped(tr.activities || []);
  } catch (e) {
    console.error('Failed to load timeline:', e);

    const c = document.getElementById('timeline');
    if (c) {
      c.innerHTML = `<div class="empty-state">Failed to load timeline.</div>`;
    }
  }
}

// ---------- COSTS ----------
async function loadCosts() {
  try {
    trips = await fetchJson(API_GET);

    const tripId = getTripId();
    const tr = trips.find((t) => String(t.id) === String(tripId));
    if (!tr) return;

    const title = document.getElementById('costs-title');
    if (title) title.innerText = `${tr.name} Costs`;

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
    const activities = [...(tr.activities || [])].sort(sortByStart);

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
      table.innerHTML = `<tr><td colspan="4">Failed to load costs.</td></tr>`;
    }
  }
}

// ---------- GLOBALS ----------
window.loadTrips = loadTrips;
window.addTrip = addTrip;
window.deleteTrip = deleteTrip;
window.openTrip = openTrip;
window.loadTripPage = loadTripPage;
window.addActivity = addActivity;
window.editActivity = editActivity;
window.deleteActivity = deleteActivity;
window.loadTimeline = loadTimeline;
window.loadCosts = loadCosts;
