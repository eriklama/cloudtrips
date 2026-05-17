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
    if (isGuestView()) {
      const logoutBtn = document.getElementById('logout-button');
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
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
      : 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800';
  }

  if (calendarButton) {
    calendarButton.className = state.timelineView === 'calendar'
      ? 'inline-flex items-center justify-center gap-2 rounded-xl border border-primary-500 bg-primary-500 px-3 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-primary-600'
      : 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-100 dark:hover:bg-slate-800';
  }

  const jumpBtn = document.getElementById('btnJumpToday');
  if (jumpBtn) jumpBtn.classList.toggle('hidden', state.timelineView === 'calendar');

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
    const costsByCurrency = dayActivities.reduce((acc, activity) => {
      const currency = activity.currency || 'EUR';
      acc[currency] = (acc[currency] || 0) + Number(activity.cost || 0);
      return acc;
    }, {});
    const totalKm = dayActivities.reduce((sum, activity) => sum + Number(activity.km || 0), 0);

    return `
      <section id="day-${escapeHtml(key)}" class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-soft">
        <button
          type="button"
          onclick="toggleTimelineDay('${escapeHtml(key)}')"
          class="flex w-full items-center justify-between gap-3 bg-slate-200 dark:bg-slate-800/70 px-4 py-3 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <div class="min-w-0">
            <div class="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">${escapeHtml(label)}</div>
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-500 dark:text-slate-400">
              <span>${dayActivities.length} item${dayActivities.length === 1 ? '' : 's'}</span>
              ${Object.entries(costsByCurrency).filter(([, amount]) => amount > 0).map(([currency, amount]) =>
                `<span>${escapeHtml(formatCurrency(amount, currency))}</span>`
              ).join('')}
              ${totalKm ? `<span>${escapeHtml(`${totalKm} km`)}</span>` : ''}
            </div>
          </div>
          <span class="shrink-0 text-sm text-slate-600 dark:text-slate-300">
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

function jumpToToday() {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // Try exact match first, then find the nearest past day
  let target = document.getElementById(`day-${todayKey}`);

  if (!target) {
    // Find all day sections and pick the last one before today
    const sections = [...document.querySelectorAll('[id^="day-"]')]
      .map(el => ({ el, key: el.id.replace('day-', '') }))
      .filter(({ key }) => key !== 'undated')
      .sort((a, b) => a.key.localeCompare(b.key));

    const past = sections.filter(({ key }) => key <= todayKey);
    const future = sections.filter(({ key }) => key > todayKey);

    if (past.length) {
      target = past[past.length - 1].el;
    } else if (future.length) {
      target = future[0].el;
    }
  }

  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Flash highlight
    target.classList.add('ring-2', 'ring-primary-500');
    setTimeout(() => target.classList.remove('ring-2', 'ring-primary-500'), 1500);
  } else {
    showToast('No dated activities found.', 'info');
  }
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
      <section class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-4 sm:p-5 shadow-soft">
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 class="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">${escapeHtml(monthLabel)}</h3>
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-500 dark:text-slate-400">${entries.length} day${entries.length === 1 ? '' : 's'}</p>
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
      <td colspan="5" class="px-3 py-8 text-center text-slate-500 dark:text-slate-500 dark:text-slate-400">Loading costs…</td>
    </tr>
  `;

  try {
    state.currentTrip = await fetchTrip(tripId);
    setText('costs-title', `${state.currentTrip.name} Costs`);
    setText('costs-hero-title', `${state.currentTrip.name} Costs`);
    applySharedViewUi('costs-title', 'costs-hero-title');
    if (isGuestView()) {
      const logoutBtn = document.getElementById('logout-button');
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
    renderCosts();

    // Restore saved currency preference
    const savedCurrency = localStorage.getItem('cloudtrips_convert_currency');
    const select = document.getElementById('convertCurrency');
    if (savedCurrency && select) {
      select.value = savedCurrency;
      applyConversion();
    }
  } catch (error) {
    console.error(error);
    table.innerHTML = `
      <tr>
        <td colspan="5" class="px-3 py-8 text-center text-red-600 dark:text-red-400">${escapeHtml(error?.message || 'Failed to load costs.')}</td>
      </tr>
    `;
  }
}

async function applyConversion() {
  const select = document.getElementById('convertCurrency');
  const status = document.getElementById('conversion-status');
  const convertTo = select?.value || '';

  // Persist preference
  localStorage.setItem('cloudtrips_convert_currency', convertTo);

  if (!convertTo) {
    renderCosts();
    if (status) status.textContent = '';
    return;
  }

  if (status) status.textContent = 'Fetching rates…';

  try {
    const rates = await fetchExchangeRates(convertTo);
    renderCosts(convertTo, rates);
    if (status) {
      const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      status.textContent = `Rates as of ${date}`;
    }
  } catch (err) {
    console.error(err);
    if (status) status.textContent = 'Failed to fetch rates.';
    showToast('Could not fetch exchange rates. Try again later.', 'error');
  }
}

/* =========================
 * SHARE
 * ========================= */

/* =========================
 * NAVIGATION
 * ========================= */

function goToTrip() {
  const tripId = getTripIdFromUrl();
  if (!tripId) return;
  window.location.href = buildTripPageUrl('trip.html', tripId);
}

async function confirmNavigateAway() {
  if (!state.editingActivityId) return true;
  return await openConfirmModal({
    title: 'Unsaved changes',
    message: 'You have unsaved changes. Leave anyway?',
    confirmText: 'Leave',
    cancelText: 'Stay',
    danger: true
  });
}

async function goToTimeline() {
  const tripId = getTripIdFromUrl();
  if (!tripId) return;
  if (!await confirmNavigateAway()) return;
  window.location.href = buildTripPageUrl('timeline.html', tripId);
}

async function goToCosts() {
  const tripId = getTripIdFromUrl();
  if (!tripId) return;
  if (!await confirmNavigateAway()) return;
  window.location.href = buildTripPageUrl('costs.html', tripId);
}

async function goBack() {
  if (!await confirmNavigateAway()) return;
  window.location.href = '/';
}

function openPrintView() {
  if (!state.currentTrip) {
    showToast('Trip not loaded.', 'error');
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

  // Build nav items list
  const items = [];
  items.push({ label: 'Home', icon: 'home', onClick: () => { window.location.href = '/'; } });

  if (current === 'stats') {
    // Stats page — no trip-specific links
  } else {
    // Trip pages — show trip navigation
    if (current !== 'trip') items.push({ label: 'Trip', icon: 'notebook-pen', onClick: goToTrip });
    if (current !== 'timeline') items.push({ label: 'Timeline', icon: 'list-tree', onClick: goToTimeline });
    if (current !== 'costs') items.push({ label: 'Costs', icon: 'badge-euro', onClick: goToCosts });
    items.push({ label: 'Export', icon: 'printer', onClick: openPrintView });
  }

  const btnClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition';

  // ── DESKTOP: regular button row (hidden on mobile) ──
  const desktopRow = document.createElement('div');
  desktopRow.className = 'hidden sm:flex gap-2';

  items.forEach(({ label, icon, onClick }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = btnClass;
    btn.onclick = onClick;
    btn.innerHTML = `<i data-lucide="${icon}" class="h-4 w-4"></i>${label}`;
    desktopRow.appendChild(btn);
  });

  // Theme toggle — desktop
  const themeBtn = document.createElement('button');
  themeBtn.type = 'button';
  themeBtn.className = btnClass + ' px-2.5';
  themeBtn.setAttribute('data-theme-toggle', '');
  themeBtn.setAttribute('aria-label', 'Toggle theme');
  themeBtn.innerHTML = getTheme() === 'dark'
    ? '<i data-lucide="sun" class="h-4 w-4"></i>'
    : '<i data-lucide="moon" class="h-4 w-4"></i>';
  themeBtn.onclick = toggleTheme;
  desktopRow.appendChild(themeBtn);

  // ── MOBILE: hamburger + dropdown (hidden on desktop) ──
  const mobileWrapper = document.createElement('div');
  mobileWrapper.className = 'relative sm:hidden';

  const hamburger = document.createElement('button');
  hamburger.type = 'button';
  hamburger.className = btnClass + ' px-2.5';
  hamburger.innerHTML = '<i data-lucide="menu" class="h-5 w-5"></i>';
  hamburger.setAttribute('aria-label', 'Navigation menu');

  const dropdown = document.createElement('div');
  dropdown.className = 'hidden absolute right-0 top-full mt-2 w-48 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-xl z-50 overflow-hidden';

  items.forEach(({ label, icon, onClick }) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
    item.innerHTML = `<i data-lucide="${icon}" class="h-4 w-4 text-slate-500 dark:text-slate-500 dark:text-slate-400"></i>${label}`;
    item.onclick = () => {
      closeDropdown();
      onClick();
    };
    dropdown.appendChild(item);
  });

  // Theme toggle — mobile dropdown
  const themeItem = document.createElement('button');
  themeItem.type = 'button';
  themeItem.className = 'flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
  themeItem.setAttribute('data-theme-toggle', '');
  themeItem.innerHTML = getTheme() === 'dark'
    ? '<i data-lucide="sun" class="h-4 w-4 text-slate-500 dark:text-slate-500 dark:text-slate-400"></i>Light mode'
    : '<i data-lucide="moon" class="h-4 w-4 text-slate-500 dark:text-slate-500 dark:text-slate-400"></i>Dark mode';
  themeItem.onclick = () => { closeDropdown(); toggleTheme(); };
  dropdown.appendChild(themeItem);

  function openDropdown() {
    dropdown.classList.remove('hidden');
    hamburger.innerHTML = '<i data-lucide="x" class="h-5 w-5"></i>';
    refreshIcons();
    setTimeout(() => {
      document.addEventListener('click', outsideClickHandler);
    }, 0);
  }

  function closeDropdown() {
    dropdown.classList.add('hidden');
    hamburger.innerHTML = '<i data-lucide="menu" class="h-5 w-5"></i>';
    refreshIcons();
    document.removeEventListener('click', outsideClickHandler);
  }

  function outsideClickHandler(e) {
    if (!mobileWrapper.contains(e.target)) {
      closeDropdown();
    }
  }

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.contains('hidden') ? openDropdown() : closeDropdown();
  });

  mobileWrapper.appendChild(hamburger);
  mobileWrapper.appendChild(dropdown);

  nav.appendChild(desktopRow);
  nav.appendChild(mobileWrapper);

  refreshIcons();
}

/* =========================
 * STATS PAGE
 * ========================= */

let _statsData = null;
let _statsRates = null;
let _statsYear = '';
let _statsCountry = '';
let _statsSort = { key: '', dir: 'desc' };

async function loadStats() {
  const table = document.getElementById('stats-table');
  if (!table) return;

  table.innerHTML = `<tr><td colspan="7" class="px-3 py-8 text-center text-slate-500 dark:text-slate-400">Loading stats…</td></tr>`;

  try {
    const data = await apiGet(API.GET_STATS);
    _statsData = data;

    // Restore saved currency preference
    const savedCurrency = localStorage.getItem('cloudtrips_stats_currency');
    const select = document.getElementById('statsCurrency');
    if (savedCurrency && select) {
      select.value = savedCurrency;
      if (savedCurrency) {
        await applyStatsCurrency();
        return;
      }
    }

    renderStats();

    // Load error log — will silently hide if user is not admin
    loadErrors();
  } catch (err) {
    console.error(err);
    const table = document.getElementById('stats-table');
    if (table) table.innerHTML = `<tr><td colspan="7" class="px-3 py-8 text-center text-red-500">${escapeHtml(err?.message || 'Failed to load stats.')}</td></tr>`;
  }
}

async function applyStatsCurrency() {
  const select = document.getElementById('statsCurrency');
  const status = document.getElementById('stats-rates-status');
  const convertTo = select?.value || '';

  localStorage.setItem('cloudtrips_stats_currency', convertTo);

  if (!convertTo) {
    _statsRates = null;
    renderStats();
    if (status) status.textContent = '';
    return;
  }

  if (status) status.textContent = 'Fetching rates…';

  try {
    _statsRates = await fetchExchangeRates(convertTo);
    renderStats();
    if (status) {
      const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      status.textContent = `Rates as of ${date}`;
    }
  } catch (err) {
    console.error(err);
    if (status) status.textContent = 'Failed to fetch rates.';
    showToast('Could not fetch exchange rates.', 'error');
  }
}

function renderStats() {
  if (!_statsData) return;

  const convertTo = document.getElementById('statsCurrency')?.value || '';
  const trips = _statsData.trips || [];
  const allTime = _statsData.allTime || {};

  // Convert costs helper
  const getConvertedTotal = (costsByCurrency) => {
    if (!convertTo || !_statsRates) {
      return Object.entries(costsByCurrency)
        .filter(([, v]) => v > 0)
        .map(([c, v]) => formatCurrency(v, c))
        .join(' + ') || '—';
    }
    const total = Object.entries(costsByCurrency).reduce((sum, [currency, amount]) => {
      const converted = convertCurrency(amount, currency, convertTo, _statsRates);
      return sum + (converted ?? amount);
    }, 0);
    return total > 0 ? formatCurrency(total, convertTo) : '—';
  };

  // Total cost all-time
  const allCosts = trips.reduce((acc, t) => {
    Object.entries(t.costsByCurrency).forEach(([c, v]) => {
      acc[c] = (acc[c] || 0) + v;
    });
    return acc;
  }, {});
  const totalCostStr = getConvertedTotal(allCosts);

  // All-time stat cards
  const alltimeEl = document.getElementById('alltime-stats');
  if (alltimeEl) {
    const stat = (icon, label, value) => `
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3">
        <div class="mb-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <i data-lucide="${icon}" class="h-3.5 w-3.5"></i>${escapeHtml(label)}
        </div>
        <div class="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">${escapeHtml(String(value))}</div>
      </div>`;

    alltimeEl.innerHTML = [
      stat('map', 'Trips', allTime.totalTrips || 0),
      stat('calendar-days', 'Days travelling', allTime.totalDays || 0),
      stat('route', 'Total distance', allTime.totalKm ? `${allTime.totalKm} km` : '—'),
      stat('list', 'Activities', allTime.totalActivities || 0),
      stat('flag', 'Countries', allTime.countries?.length || 0),
      stat('wallet', 'Total spend', totalCostStr),
    ].join('');
    refreshIcons();
  }

  // Build year filter
  const years = [...new Set(trips.map(t => t.startDate ? new Date(t.startDate).getFullYear() : null).filter(Boolean))].sort((a, b) => b - a);
  const yearPillsEl = document.getElementById('year-pills');
  if (yearPillsEl) {
    const pillClass = (active) => `stats-year-pill rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-primary-400'}`;
    yearPillsEl.innerHTML = `
      <button onclick="setStatsYear('')" class="${pillClass(!_statsYear)}">All</button>
      ${years.map(y => `<button onclick="setStatsYear('${y}')" class="${pillClass(_statsYear === String(y))}">${y}</button>`).join('')}
    `;
  }

  // Build country filter
  const countries = [...new Set(trips.map(t => t.country).filter(Boolean))].sort();
  const countryPillsEl = document.getElementById('country-pills');
  if (countryPillsEl) {
    const pillClass = (active) => `rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-primary-400'}`;
    countryPillsEl.innerHTML = countries.length ? `
      <button onclick="setStatsCountry('')" class="${pillClass(!_statsCountry)}">All</button>
      ${countries.map(c => `<button onclick="setStatsCountry('${escapeHtml(c)}')" class="${pillClass(_statsCountry === c)}">${escapeHtml(c)}</button>`).join('')}
    ` : '<span class="text-xs text-slate-400">No countries set on trips yet</span>';
  }

  // Filter trips by year and country
  let filtered = trips;
  if (_statsYear) filtered = filtered.filter(t => t.startDate && new Date(t.startDate).getFullYear() === Number(_statsYear));
  if (_statsCountry) filtered = filtered.filter(t => t.country === _statsCountry);

  // Sort
  if (_statsSort.key) {
    filtered = [...filtered].sort((a, b) => {
      let va, vb;
      if (_statsSort.key === 'days') { va = a.days; vb = b.days; }
      else if (_statsSort.key === 'activities') { va = a.activitiesCount; vb = b.activitiesCount; }
      else if (_statsSort.key === 'km') { va = a.totalKm; vb = b.totalKm; }
      else if (_statsSort.key === 'cost') {
        va = Object.values(a.costsByCurrency).reduce((s, v) => s + v, 0);
        vb = Object.values(b.costsByCurrency).reduce((s, v) => s + v, 0);
      }
      return _statsSort.dir === 'asc' ? va - vb : vb - va;
    });
  }

  // Update sort indicators
  ['days', 'activities', 'km', 'cost'].forEach(key => {
    const el = document.getElementById(`sort-${key}`);
    if (el) el.textContent = _statsSort.key === key ? (_statsSort.dir === 'asc' ? '↑' : '↓') : '';
  });

  // Render table
  const table = document.getElementById('stats-table');
  if (!table) return;

  table.innerHTML = filtered.length
    ? filtered.map(t => {
        const dateRange = t.startDate
          ? `${formatDayLabel(t.startDate)}${t.endDate && t.endDate !== t.startDate ? ' → ' + formatDayLabel(t.endDate) : ''}`
          : '—';
        const costStr = getConvertedTotal(t.costsByCurrency);

        return `
          <tr class="rounded-2xl bg-white dark:bg-slate-950/60 cursor-pointer transition hover:-translate-y-0.5 hover:border-primary-200 dark:hover:border-primary-500/30" onclick="openTrip('${escapeHtml(t.id)}')" style="transform-origin: center;">
            <td class="rounded-l-2xl px-3 py-3 font-medium text-slate-900 dark:text-slate-100">${escapeHtml(t.name)}</td>
            <td class="px-3 py-3 text-slate-500 dark:text-slate-400">${escapeHtml(t.country || '—')}</td>
            <td class="px-3 py-3 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(dateRange)}</td>
            <td class="px-3 py-3 text-right text-slate-700 dark:text-slate-300">${t.days || '—'}</td>
            <td class="px-3 py-3 text-right text-slate-700 dark:text-slate-300">${t.activitiesCount}</td>
            <td class="px-3 py-3 text-right text-slate-700 dark:text-slate-300">${t.totalKm ? `${t.totalKm} km` : '—'}</td>
            <td class="rounded-r-2xl px-3 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">${escapeHtml(costStr)}</td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="7" class="px-3 py-8 text-center text-slate-500 dark:text-slate-400">No trips found.</td></tr>`;
}

function setStatsYear(year) {
  _statsYear = String(year);
  renderStats();
}

function setStatsCountry(country) {
  _statsCountry = country;
  renderStats();
}

function sortStatsBy(key) {
  if (_statsSort.key === key) {
    _statsSort.dir = _statsSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    _statsSort = { key, dir: 'desc' };
  }
  renderStats();
}

async function loadErrors() {
  const container = document.getElementById('error-log');
  if (!container) return;

  try {
    const data = await apiGet('/api/getErrors?limit=50');
    const errors = data.errors || [];

    if (!errors.length) {
      container.innerHTML = '<div class="text-center py-4 text-slate-400">No errors logged. 🎉</div>';
      return;
    }

    container.innerHTML = `
      <div class="overflow-x-auto">
        <table class="min-w-full border-separate border-spacing-y-1 text-xs">
          <thead>
            <tr class="text-left text-slate-400 dark:text-slate-500">
              <th class="px-3 py-1 font-medium">Time</th>
              <th class="px-3 py-1 font-medium">Endpoint</th>
              <th class="px-3 py-1 font-medium">Method</th>
              <th class="px-3 py-1 font-medium text-center">Status</th>
              <th class="px-3 py-1 font-medium">Message</th>
              <th class="px-3 py-1 font-medium">User</th>
            </tr>
          </thead>
          <tbody>
            ${errors.map(e => `
              <tr class="bg-white dark:bg-slate-950/60 rounded-xl">
                <td class="rounded-l-xl px-3 py-2 text-slate-400 whitespace-nowrap">${escapeHtml(e.created_at?.slice(0, 19).replace('T', ' ') || '—')}</td>
                <td class="px-3 py-2 font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">${escapeHtml(e.endpoint || '—')}</td>
                <td class="px-3 py-2 text-slate-500">${escapeHtml(e.method || '—')}</td>
                <td class="px-3 py-2 text-center">
                  <span class="inline-flex items-center rounded-full px-2 py-0.5 font-medium ${e.status >= 500 ? 'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'}">
                    ${escapeHtml(String(e.status))}
                  </span>
                </td>
                <td class="px-3 py-2 text-slate-600 dark:text-slate-300 max-w-xs truncate">${escapeHtml(e.message || '—')}</td>
                <td class="rounded-r-xl px-3 py-2 text-slate-400 font-mono truncate max-w-[100px]">${escapeHtml(e.user_id?.slice(0, 8) || '—')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div class="mt-2 text-xs text-slate-400 text-right">${errors.length} most recent error${errors.length === 1 ? '' : 's'}</div>
    `;
  } catch (err) {
    // 403 = not admin — show a subtle not-authorised message
    if (err?.message?.includes('403') || err?.message?.includes('Forbidden')) {
      container.innerHTML = '<div class="text-center py-4 text-slate-400 text-xs">Error log is only visible to the admin account.</div>';
      return;
    }
    container.innerHTML = `<div class="text-center py-4 text-red-400">Failed to load errors: ${escapeHtml(err?.message || 'unknown error')}</div>`;
  }
}

window.loadErrors = loadErrors;
window.applyStatsCurrency = applyStatsCurrency;
window.setStatsYear = setStatsYear;
window.setStatsCountry = setStatsCountry;
window.sortStatsBy = sortStatsBy;

async function init() {
  try {
    const onSharedPage = isGuestView();

    if (!onSharedPage && typeof requireAuth === 'function') {
      try {
        const user = await requireAuth();

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
    if (hasEl('activities')) { await loadTripPage(); renderHeaderNav('trip'); }
    if (hasEl('timeline')) { await loadTimeline(); renderHeaderNav('timeline'); }
    if (hasEl('cost-table')) { await loadCosts(); renderHeaderNav('costs'); }
    if (hasEl('stats-table')) {
      await loadStats();
      renderHeaderNav('stats');
      // Set after renderHeaderNav so nav row is included in height
      requestAnimationFrame(() => {
        const header = document.querySelector('header');
        const nav = document.getElementById('nav-actions')?.closest('div');
        const totalHeight = (header?.offsetHeight || 0);
        document.documentElement.style.setProperty('--header-height', totalHeight + 'px');
      });
    }

  } catch (error) {
    console.error('INIT ERROR:', error);
  }

  refreshIcons();
}

document.addEventListener('DOMContentLoaded', init);

/* =========================
 * GLOBAL EXPORTS
 * ========================= */

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
window.jumpToToday = jumpToToday;
window.openPrintView = openPrintView;
window.renderHeaderNav = renderHeaderNav;
window.applyConversion = applyConversion;
window.moveActivity = moveActivity;
window.saveTripNotes = saveTripNotes;
window.saveTripCountry = saveTripCountry;
window.saveTripCountryNow = saveTripCountryNow;
window.logout = logout;