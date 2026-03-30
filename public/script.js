const API_GET_TRIPS = '/getTrips';
const API_GET_TRIP = '/getTrip';
const API_SAVE_TRIP = '/saveTrip';
const API_DELETE_TRIP = '/deleteTrip';

let trips = [];
let currentTrip = null;
let editingActivityId = null;

/* ---------- INIT ---------- */

document.addEventListener('DOMContentLoaded', async () => {
  try {
    if (document.getElementById('trip-list')) await loadTrips();
    if (document.getElementById('activities')) await loadTripPage();
    if (document.getElementById('timeline')) await loadTimeline();
    if (document.getElementById('cost-table')) await loadCosts();
  } catch (e) {
    console.error(e);
  }

  refreshIcons();
});

/* ---------- PIN MODAL ---------- */

function openPinModal(message = 'Enter PIN') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';

    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 p-6 rounded-2xl w-80 shadow-xl">
        <h2 class="text-lg font-semibold mb-3">${message}</h2>
        <input id="pin-input" type="password" class="w-full border rounded-lg px-3 py-2 mb-3" placeholder="••••" />
        <div class="flex justify-end gap-2">
          <button id="pin-cancel" class="px-4 py-2 bg-gray-200 rounded-lg">Cancel</button>
          <button id="pin-ok" class="px-4 py-2 bg-primary-600 text-white rounded-lg">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#pin-input');
    const ok = modal.querySelector('#pin-ok');
    const cancel = modal.querySelector('#pin-cancel');

    input.focus();

    function close(value) {
      modal.remove();
      resolve(value);
    }

    ok.onclick = () => close(input.value.trim());
    cancel.onclick = () => close(null);

    input.onkeydown = (e) => {
      if (e.key === 'Enter') ok.onclick();
    };
  });
}

/* ---------- PIN STORAGE ---------- */

function getTripPinKey(id) {
  return `trip_pin_${id}`;
}

function getStoredTripPin(id) {
  return localStorage.getItem(getTripPinKey(id)) || '';
}

function storeTripPin(id, pin) {
  localStorage.setItem(getTripPinKey(id), pin);
}

function removeStoredTripPin(id) {
  localStorage.removeItem(getTripPinKey(id));
}

async function ensureTripPin(id, msg = 'Enter trip PIN:') {
  let pin = getStoredTripPin(id);
  if (pin) return pin;

  pin = await openPinModal(msg);
  if (!pin) return '';

  storeTripPin(id, pin);
  return pin;
}

/* ---------- HELPERS ---------- */

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function uuid() {
  return crypto.randomUUID();
}

function formatDayLabel(v) {
  if (!v) return 'No date';
  return new Date(v).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(v) {
  if (!v) return '—';
  return new Date(v).toLocaleString('en-GB');
}

function formatCurrency(v) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'EUR'
  }).format(v || 0);
}

function getTripIdFromUrl() {
  return new URLSearchParams(location.search).get('id');
}

/* ---------- API ---------- */

async function apiGet(url) {
  const u = new URL(url, location.origin);
  const tripId = u.searchParams.get('trip');

  let pin = tripId ? await ensureTripPin(tripId) : '';

  const res = await fetch(u, {
    headers: pin ? { 'x-pin': pin } : {}
  });

  if (res.status === 401 && tripId) {
    removeStoredTripPin(tripId);
    pin = await ensureTripPin(tripId, 'Wrong PIN, try again:');
    if (!pin) throw new Error('PIN required');
    return apiGet(url);
  }

  if (!res.ok) throw new Error('API error');

  return res.json();
}

async function apiPost(url, payload) {
  const pin = getStoredTripPin(payload.id);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(pin ? { 'x-pin': pin } : {})
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) throw new Error('POST failed');
}

async function apiDelete(url, payload) {
  const pin = getStoredTripPin(payload.id);

  const res = await fetch(`${url}?trip=${payload.id}`, {
    method: 'POST',
    headers: pin ? { 'x-pin': pin } : {}
  });

  if (!res.ok) throw new Error('DELETE failed');
}

/* ---------- TRIPS ---------- */

async function loadTrips() {
  const container = document.getElementById('trip-list');

  const data = await apiGet(API_GET_TRIPS);
  trips = safeArray(data).map(normalizeTrip);

  renderTrips();
}

function normalizeTrip(raw) {
  const activities = safeArray(raw.activities);

  let dates = activities
    .map(a => new Date(a.start || a.startDate))
    .filter(d => !isNaN(d));

  return {
    id: raw.id,
    name: raw.name,
    startDate: dates.length ? new Date(Math.min(...dates)) : null,
    endDate: dates.length ? new Date(Math.max(...dates)) : null
  };
}

function renderTrips() {
  const container = document.getElementById('trip-list');

  container.innerHTML = trips.map(t => `
    <article class="rounded-3xl border p-5">
      <h3 class="text-lg font-semibold">${t.name}</h3>

      <p class="text-sm text-slate-500">
        ${
          t.startDate
            ? formatDayLabel(t.startDate) +
              (t.endDate ? ' → ' + formatDayLabel(t.endDate) : '')
            : 'Add activities to see timeline'
        }
      </p>

      <div class="mt-4 flex gap-2">
        <button onclick="openTrip('${t.id}')" class="bg-primary-600 text-white px-4 py-2 rounded-xl">Open</button>
        <button onclick="renameTrip('${t.id}')" class="border px-4 py-2 rounded-xl">Rename</button>
        <button onclick="deleteTrip('${t.id}')" class="border text-red-600 px-4 py-2 rounded-xl">Delete</button>
      </div>
    </article>
  `).join('');
}

/* ---------- ACTIONS ---------- */

async function addTrip() {
  const name = document.getElementById('newTripName').value.trim();
  if (!name) return alert('Enter name');

  const pin = await openPinModal('Set PIN');
  if (!pin) return;

  const trip = { id: uuid(), name, pin, activities: [] };

  await apiPost(API_SAVE_TRIP, trip);
  storeTripPin(trip.id, pin);

  loadTrips();
}

async function openTrip(id) {
  const pin = await ensureTripPin(id);
  if (!pin) return;

  location.href = `/trip.html?id=${id}`;
}

async function renameTrip(id) {
  const name = prompt('New name'); // optional to upgrade later
  if (!name) return;

  const trip = await apiGet(`${API_GET_TRIP}?trip=${id}`);
  trip.name = name;

  await apiPost(API_SAVE_TRIP, trip);
  loadTrips();
}

async function deleteTrip(id) {
  const ok = confirm('Delete trip?');
  if (!ok) return;

  await apiDelete(API_DELETE_TRIP, { id });
  removeStoredTripPin(id);
  loadTrips();
}

/* ---------- TRIP PAGE ---------- */

async function loadTripPage() {
  const id = getTripIdFromUrl();
  if (!id) return;

  await ensureTripPin(id);

  currentTrip = await apiGet(`${API_GET_TRIP}?trip=${id}`);

  document.getElementById('trip-title').textContent = currentTrip.name;

  renderActivities();
}

function renderActivities() {
  const container = document.getElementById('activities');

  container.innerHTML = currentTrip.activities.map(a => `
    <div class="border p-4 rounded-xl">
      <h3>${a.location}</h3>
      <p>${formatDateTime(a.startDate)}</p>
    </div>
  `).join('');
}

/* ---------- UI ---------- */

function refreshIcons() {
  if (window.lucide) lucide.createIcons();
}
