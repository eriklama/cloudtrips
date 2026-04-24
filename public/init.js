/* =========================
 * init.js
 * App entry point — timeline, costs, share, navigation, init.
 * Depends on: state.js, helpers.js, ui.js, auth.js, api.js, trips.js, activities.js
 * ========================= */

/* =========================
 * TIMELINE PAGE
 * ========================= */

function buildTimelineGroups(activities) {
  const groups = new Map();

  for (const activity of activities) {
    const key = dayKey(activity.startDate);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(activity);
  }

  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function toggleTimelineDay(day) {
  if (state.timelineCollapsedDays.has(day)) {
    state.timelineCollapsedDays.delete(day);
  } else {
    state.timelineCollapsedDays.add(day);
  }
  renderTimelinePage();
}

function switchTimelineView(view) {
  if (!state.currentTrip) return;
  state.timelineView = view === 'calendar' ? 'calendar' : 'timeline';
  saveTimelineView(state.currentTrip.id, state.timelineView);
  renderTimelinePage();
}

async function loadTimeline() {
  const tripId = getTripIdFromUrl();
  const container = document.getElementById('timeline');
  const calendar = document.getElementById('calendar-view');
  if (!tripId || !container || !calendar) return;

  container.innerHTML = loadingTimeline();
  calendar.innerHTML = '';

  try {
    state.currentTrip = await fetchTrip(tripId);
    state.timelineView = getSavedTimelineView(tripId);
    setText('timeline-title', `${state.currentTrip.name} Timeline`);
    setText('timeline-hero-title', `${state.currentTrip.name} Timeline`);
    applySharedViewUi('timeline-title', 'timeline-hero-title');
    renderTimelinePage();
  } catch (error) {
    console.error(error);
    container.innerHTML = emptyState(
      'Failed to load timeline',
      error?.message || 'The trip data could not be loaded.',
      'triangle-alert'
    );
    calendar.innerHTML = '';
    refreshIcons();
  }
}

function renderTimelinePage() {
  const tripId = state.currentTrip?.id;
  const timelineContainer = document.getElementById('timeline');
  const calendarContainer = document.getElementById('calendar-view');
  const timelineButton = document.getElementById('btnTimelineView');
  const calendarButton = document.getElementById('btnCalendarView');

  if (!timelineContainer || !calendarContainer || !state.currentTrip) return;

  if (timelineButton) {
    timelineButton.className = state.timelineView === 'timeline'
      ? 'inline-flex items-center justify-center gap-2 rounded-xl border border-primary-500 bg-primary-500 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-600'
      : 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800';
  }

  if (calendarButton) {
    calendarButton.className = state.timelineView === 'calendar'
      ? 'inline-flex items-center justify-center gap-2 rounded-xl border border-primary-500 bg-primary-500 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-600'
      : 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800';
  }

  if (tripId) {
    saveTimelineView(tripId, state.timelineView);
  }

  if (state.timelineView === 'calendar') {
    timelineContainer.classList.add('hidden');
    calendarContainer.classList.remove('hidden');
    renderCalendarView();
  } else {
    calendarContainer.classList.add('hidden');
    timelineContainer.classList.remove('hidden');
    renderTimeline();
  }

  refreshIcons();
}

function renderTimeline() {
  const container = document.getElementById('timeline');
  if (!container || !state.currentTrip) return;

  const activities = sortActivities(state.currentTrip.activities);
  if (!activities.length) {
    container.innerHTML = emptyState(
      'No activities in timeline',
      'Go back to the trip page and add some activities first.',
      'calendar-plus'
    );
    refreshIcons();
    return;
  }

  const groupEntries = buildTimelineGroups(activities);

  container.innerHTML = groupEntries.map(([key, dayActivities]) => {
    const label = key === 'undated' ? 'No date' : formatDayLabel(dayActivities[0]?.startDate);
    const isCollapsed = state.timelineCollapsedDays.has(key);
    const totalCost = dayActivities.reduce((sum, activity) => sum + Number(activity.cost || 0), 0);
    const totalKm = dayActivities.reduce((sum, activity) => sum + Number(activity.km || 0), 0);

    return `
      <section class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-soft">
        <button
          type="button"
          onclick="toggleTimelineDay('${escapeHtml(key)}')"
          class="flex w-full items-center justify-between gap-3 bg-slate-800/70 px-4 py-3 text-left transition hover:bg-slate-800"
        >
          <div class="min-w-0">
            <div class="text-sm font-semibold tracking-tight text-slate-100">${escapeHtml(label)}</div>
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-400">
              <span>${dayActivities.length} item${dayActivities.length === 1 ? '' : 's'}</span>
              <span>${escapeHtml(formatCurrency(totalCost))}</span>
              ${totalKm ? `<span>${escapeHtml(`${totalKm} km`)}</span>` : ''}
            </div>
          </div>
          <span class="shrink-0 text-sm text-slate-300">
            ${isCollapsed ? '▶' : '▼'}
          </span>
        </button>

        <div class="${isCollapsed ? 'hidden' : 'block'} p-3">
          <div class="space-y-2">
            ${dayActivities.map(renderTimelineActivity).join('')}
          </div>
        </div>
      </section>
    `;
  }).join('');

  refreshIcons();
}

function renderCalendarView() {
  const container = document.getElementById('calendar-view');
  if (!container || !state.currentTrip) return;

  const activities = sortActivities(state.currentTrip.activities);
  if (!activities.length) {
    container.innerHTML = emptyState(
      'No activities in calendar view',
      'Go back to the trip page and add some activities first.',
      'calendar-plus'
    );
    refreshIcons();
    return;
  }

  const dayGroups = buildTimelineGroups(activities);
  const monthBuckets = new Map();

  for (const [key, dayActivities] of dayGroups) {
    const bucketKey = key === 'undated' ? 'undated' : monthKey(dayActivities[0]?.startDate);
    if (!monthBuckets.has(bucketKey)) {
      monthBuckets.set(bucketKey, []);
    }
    monthBuckets.get(bucketKey).push([key, dayActivities]);
  }

  container.innerHTML = [...monthBuckets.entries()].map(([bucketKey, entries]) => {
    const monthLabel = bucketKey === 'undated'
      ? 'Undated activities'
      : formatMonthLabel(entries[0]?.[1]?.[0]?.startDate);

    return `
      <section class="rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:p-5 shadow-soft">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold tracking-tight text-slate-100">${escapeHtml(monthLabel)}</h3>
            <p class="mt-1 text-xs text-slate-400">${entries.length} day${entries.length === 1 ? '' : 's'}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          ${entries.map(([key, dayActivities]) => renderCalendarTile(key, dayActivities)).join('')}
        </div>
      </section>
    `;
  }).join('');

  refreshIcons();
}

/* =========================
 * COSTS PAGE
 * ========================= */

async function loadCosts() {
  const tripId = getTripIdFromUrl();
  const table = document.getElementById('cost-table');
  if (!tripId || !table) return;

  table.innerHTML = `
    <tr>
      <td colspan="5" class="px-3 py-8 text-center text-slate-500 dark:text-slate-400">Loading costs…</td>
    </tr>
  `;

  try {
    state.currentTrip = await fetchTrip(tripId);
    setText('costs-title', `${state.currentTrip.name} Costs`);
    setText('costs-hero-title', `${state.currentTrip.name} Costs`);
    applySharedViewUi('costs-title', 'costs-hero-title');
    renderCosts();
  } catch (error) {
    console.error(error);
    table.innerHTML = `
      <tr>
        <td colspan="5" class="px-3 py-8 text-center text-red-600 dark:text-red-400">${escapeHtml(error?.message || 'Failed to load costs.')}</td>
      </tr>
    `;
  }
}

/* =========================
 * SHARE
 * ========================= */

async function openShareModal() {
  if (!state.currentTrip?.id) {
    alert('Trip not loaded.');
    return;
  }

  if (isGuestView()) {
    alert('Shared viewers cannot create links.');
    return;
  }

  const modal = document.getElementById('share-modal');
  const input = document.getElementById('share-link');

  if (!modal || !input) {
    alert('Share modal missing.');
    return;
  }

  try {
    input.value = 'Creating link...';

    const data = await apiPost(API.SHARE_TRIP, {
      tripId: state.currentTrip.id
    });

    const shareUrl = data?.shareUrl
      ? `${window.location.origin}${data.shareUrl}`
      : '';

    if (!shareUrl) throw new Error('No share link returned');

    input.value = shareUrl;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } catch (err) {
    console.error(err);
    alert('Failed to create share link');
  }
}

function closeShareModal() {
  const modal = document.getElementById('share-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

async function copyShareLink() {
  const input = document.getElementById('share-link');
  if (!input || !input.value) return;

  try {
    await navigator.clipboard.writeText(input.value);
    alert('Copied!');
  } catch {
    input.select();
    document.execCommand('copy');
    alert('Copied!');
  }
}

/* =========================
 * NAVIGATION
 * ========================= */

function goToTrip() {
  const tripId = getTripIdFromUrl();
  if (!tripId) return;
  window.location.href = buildTripPageUrl('trip.html', tripId);
}

function goToTimeline() {
  const tripId = getTripIdFromUrl();
  if (!tripId) return;
  window.location.href = buildTripPageUrl('timeline.html', tripId);
}

function goToCosts() {
  const tripId = getTripIdFromUrl();
  if (!tripId) return;
  window.location.href = buildTripPageUrl('costs.html', tripId);
}

function goBack() {
  window.location.href = '/';
}

function openPrintView() {
  if (!state.currentTrip) {
    alert('Trip not loaded');
    return;
  }
  sessionStorage.setItem('print_trip', JSON.stringify(state.currentTrip));
  window.open('/print.html', '_blank');
}

/* =========================
 * HEADER NAVIGATION
 * ========================= */

function renderHeaderNav(current) {
  const nav = document.getElementById('nav-actions');
  if (!nav) return;

  nav.innerHTML = '';

  function createBtn(label, icon, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-slate-200 hover:border-slate-600 hover:bg-slate-800 transition';
    btn.onclick = onClick;
    btn.innerHTML = `<i data-lucide="${icon}" class="h-4 w-4"></i>${label}`;
    return btn;
  }

  nav.appendChild(createBtn('Home', 'home', () => { window.location.href = '/'; }));
  if (current !== 'trip') nav.appendChild(createBtn('Trip', 'notebook-pen', goToTrip));
  if (current !== 'timeline') nav.appendChild(createBtn('Timeline', 'list-tree', goToTimeline));
  if (current !== 'costs') nav.appendChild(createBtn('Costs', 'badge-euro', goToCosts));
  nav.appendChild(createBtn('Export', 'printer', openPrintView));

  refreshIcons();
}

/* =========================
 * APP INIT
 * ========================= */

async function init() {
  try {
    const onSharedPage = isGuestView();

    if (!onSharedPage && typeof requireAuth === 'function') {
      try {
        const user = await requireAuth();
        console.log('AUTH USER:', user);
      } catch (e) {
        console.warn('AUTH FAILED → redirecting to login', e);
        try {
          localStorage.removeItem('cloudtrips_auth_token');
          localStorage.removeItem('cloudtrips_auth_user');
        } catch {}
        window.location.href = '/login.html';
        return;
      }
    }

    const hasEl = (id) => Boolean(document.getElementById(id));

    if (hasEl('trip-list')) await loadTrips();
    if (hasEl('activities')) await loadTripPage(); renderHeaderNav('trip'); }
    if (hasEl('timeline')) { await loadTimeline(); renderHeaderNav('timeline'); }
    if (hasEl('cost-table')) { await loadCosts(); renderHeaderNav('costs'); }

  } catch (error) {
    console.error('INIT ERROR:', error);
  }

  refreshIcons();
}

document.addEventListener('DOMContentLoaded', init);

/* =========================
 * GLOBAL EXPORTS
 * ========================= */

window.addTrip = addTrip;
window.openTrip = openTrip;
window.renameTrip = renameTrip;
window.deleteTrip = deleteTrip;
window.editActivity = editActivity;
window.deleteActivity = deleteActivity;
window.saveActivity = saveActivity;
window.addActivity = addActivity;
window.cancelEditActivity = cancelEditActivity;
window.goBack = goBack;
window.goToTrip = goToTrip;
window.goToTimeline = goToTimeline;
window.goToCosts = goToCosts;
window.toggleTimelineDay = toggleTimelineDay;
window.switchTimelineView = switchTimelineView;
window.openPrintView = openPrintView;
window.renderHeaderNav = renderHeaderNav;
window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;
window.copyShareLink = copyShareLink;
/* window.logout = logout; */
