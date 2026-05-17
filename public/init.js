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
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
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

  let target = document.getElementById(`day-${todayKey}`);

  if (!target) {
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
            <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">${entries.length} day${entries.length === 1 ? '' : 's'}</p>
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
    if (isGuestView()) {
      const logoutBtn = document.getElementById('logout-button');
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
    renderCosts();

    // Restore currency: explicit localStorage choice wins, then user's default, then blank
    const savedCostsCurrency =
      localStorage.getItem('cloudtrips_convert_currency') ||
      state.settings.defaultCurrency ||
      '';
    const costsSelect = document.getElementById('convertCurrency');
    if (savedCostsCurrency && costsSelect) {
      costsSelect.value = savedCostsCurrency;
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
 * SETTINGS
 * ========================= */

async function loadUserSettings() {
  if (isGuestView()) return;
  try {
    const data = await apiGet(API.GET_USER_SETTINGS);
    if (data?.settings) {
      state.settings = { ...state.settings, ...data.settings };
    }
  } catch {
    // non-fatal — defaults remain
  }
}

async function openSettingsModal() {
  const current = state.settings.defaultCurrency || '';

  const currencies = [
    { value: '',    label: 'None (show original)' },
    { value: 'EUR', label: 'EUR €' },
    { value: 'USD', label: 'USD $' },
    { value: 'GBP', label: 'GBP £' },
    { value: 'CZK', label: 'CZK Kč' },
    { value: 'CHF', label: 'CHF Fr' },
    { value: 'PLN', label: 'PLN zł' },
    { value: 'HUF', label: 'HUF Ft' },
    { value: 'SEK', label: 'SEK kr' },
    { value: 'NOK', label: 'NOK kr' },
    { value: 'DKK', label: 'DKK kr' },
  ];

  const options = currencies
    .map(c => `<option value="${c.value}" ${c.value === current ? 'selected' : ''}>${escapeHtml(c.label)}</option>`)
    .join('');

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 dark:bg-slate-950/60 p-4';

  overlay.innerHTML = `
    <div class="w-full max-w-sm rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Settings</h2>
        <button id="settings-close" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>

      <div class="space-y-4">
        <div>
          <label for="settings-currency" class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Default display currency
          </label>
          <p class="text-xs text-slate-500 dark:text-slate-400 mb-2">
            Pre-selects the currency on the Costs and Stats pages. You can still change it per-session.
          </p>
          <select id="settings-currency"
            class="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500">
            ${options}
          </select>
        </div>
      </div>

      <div class="mt-5 flex justify-end gap-2">
        <button id="settings-cancel"
          class="inline-flex items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
          Cancel
        </button>
        <button id="settings-save"
          class="inline-flex items-center justify-center rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
          Save
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  refreshIcons();

  function close() { overlay.remove(); }

  overlay.querySelector('#settings-close').addEventListener('click', close);
  overlay.querySelector('#settings-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#settings-save').addEventListener('click', async () => {
    const select = overlay.querySelector('#settings-currency');
    const defaultCurrency = select?.value || '';
    const saveBtn = overlay.querySelector('#settings-save');

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    try {
      await apiPost(API.SAVE_USER_SETTINGS, { defaultCurrency });
      state.settings.defaultCurrency = defaultCurrency;
      showToast('Settings saved.', 'success');
      close();
    } catch (err) {
      console.error(err);
      showToast(err?.message || 'Failed to save settings.', 'error');
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save';
    }
  });
}

/* =========================
 * HEADER NAVIGATION
 * ========================= */

function renderHeaderNav(current) {
  const nav = document.getElementById('nav-actions');
  if (!nav) return;

  nav.innerHTML = '';

  const items = [];
  items.push({ label: 'Home', icon: 'home', onClick: () => { window.location.href = '/'; } });

  if (current === 'stats') {
    // Stats page — no trip-specific links
  } else {
    if (current !== 'trip') items.push({ label: 'Trip', icon: 'notebook-pen', onClick: goToTrip });
    if (current !== 'timeline') items.push({ label: 'Timeline', icon: 'list-tree', onClick: goToTimeline });
    if (current !== 'costs') items.push({ label: 'Costs', icon: 'badge-euro', onClick: goToCosts });
    // Export dropdown only on trip page
  }

  const btnClass = 'inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition';

  // ── DESKTOP ──
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

  // Export dropdown button — trip page only, desktop
  if (current === 'trip') {
    const exportWrapper = document.createElement('div');
    exportWrapper.className = 'export-btn-wrapper relative';
    const exportBtn = document.createElement('button');
    exportBtn.type = 'button';
    exportBtn.className = btnClass;
    exportBtn.innerHTML = '<i data-lucide="download" class="h-4 w-4"></i>Export<i data-lucide="chevron-down" class="h-3 w-3 ml-0.5"></i>';
    exportBtn.onclick = (e) => { e.stopPropagation(); window.openExportDropdown(exportBtn); };
    exportWrapper.appendChild(exportBtn);
    desktopRow.appendChild(exportWrapper);
  }

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

  // ── MOBILE ──
  const mobileWrapper = document.createElement('div');
  mobileWrapper.className = 'relative sm:hidden';

  const hamburger = document.createElement('button');
  hamburger.type = 'button';
  hamburger.className = btnClass + ' px-2.5';
  hamburger.innerHTML = '<i data-lucide="menu" class="h-5 w-5"></i>';
  hamburger.setAttribute('aria-label', 'Navigation menu');

  const dropdown = document.createElement('div');
  dropdown.className = 'hidden fixed top-auto mt-2 w-56 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-xl z-[200] overflow-hidden';

  items.forEach(({ label, icon, onClick }) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
    item.innerHTML = `<i data-lucide="${icon}" class="h-4 w-4 text-slate-500 dark:text-slate-400"></i>${label}`;
    item.onclick = () => { closeDropdown(); onClick(); };
    dropdown.appendChild(item);
  });

  // Export items in mobile menu — trip page only
  if (current === 'trip') {
    const csvItem = document.createElement('button');
    csvItem.type = 'button';
    csvItem.className = 'flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
    csvItem.innerHTML = '<i data-lucide="file-spreadsheet" class="h-4 w-4 text-slate-500 dark:text-slate-400"></i>Export CSV';
    csvItem.onclick = () => { closeDropdown(); window.exportCsv(); };
    dropdown.appendChild(csvItem);

    const printItem = document.createElement('button');
    printItem.type = 'button';
    printItem.className = 'flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
    printItem.innerHTML = '<i data-lucide="printer" class="h-4 w-4 text-slate-500 dark:text-slate-400"></i>Print / Save as PDF';
    printItem.onclick = () => { closeDropdown(); window.openPrintView(); };
    dropdown.appendChild(printItem);
  }

  const themeItem = document.createElement('button');
  themeItem.type = 'button';
  themeItem.className = 'flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
  themeItem.setAttribute('data-theme-toggle', '');
  themeItem.innerHTML = getTheme() === 'dark'
    ? '<i data-lucide="sun" class="h-4 w-4 text-slate-500 dark:text-slate-400"></i>Light mode'
    : '<i data-lucide="moon" class="h-4 w-4 text-slate-500 dark:text-slate-400"></i>Dark mode';
  themeItem.onclick = () => { closeDropdown(); toggleTheme(); };
  dropdown.appendChild(themeItem);

  function openDropdown() {
    dropdown.classList.remove('hidden');
    hamburger.innerHTML = '<i data-lucide="x" class="h-5 w-5"></i>';
    // Position relative to hamburger button
    const rect = hamburger.getBoundingClientRect();
    dropdown.style.top = (rect.bottom + window.scrollY + 4) + 'px';
    dropdown.style.right = (window.innerWidth - rect.right) + 'px';
    refreshIcons();
    setTimeout(() => { document.addEventListener('click', outsideClickHandler); }, 0);
  }

  function closeDropdown() {
    dropdown.classList.add('hidden');
    hamburger.innerHTML = '<i data-lucide="menu" class="h-5 w-5"></i>';
    refreshIcons();
    document.removeEventListener('click', outsideClickHandler);
  }

  function outsideClickHandler(e) {
    if (!mobileWrapper.contains(e.target)) closeDropdown();
  }

  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.contains('hidden') ? openDropdown() : closeDropdown();
  });

  mobileWrapper.appendChild(hamburger);
  document.body.appendChild(dropdown);

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
let _visitedCountries = [];

async function loadVisitedCountries() {
  try {
    const data = await apiGet(API.GET_VISITED_COUNTRIES);
    _visitedCountries = data.countries || [];
  } catch (err) {
    console.error('Failed to load visited countries:', err);
    _visitedCountries = [];
  }
}

async function addVisitedCountry(country) {
  if (!country || _visitedCountries.includes(country)) return;
  _visitedCountries = [..._visitedCountries, country].sort();
  await saveVisitedCountries();
  renderVisitedPills();
  renderWorldMap();
}

async function removeVisitedCountry(country) {
  _visitedCountries = _visitedCountries.filter(c => c !== country);
  await saveVisitedCountries();
  renderVisitedPills();
  renderWorldMap();
}

async function saveVisitedCountries() {
  try {
    await apiPost(API.SAVE_VISITED_COUNTRIES, { countries: _visitedCountries });
  } catch (err) {
    console.error('Failed to save visited countries:', err);
    showToast('Failed to save visited countries.', 'error');
  }
}

function renderVisitedPills() {
  const tripCountries = new Set(_statsData?.allTime?.countries || []);
  const all = [...new Set([...tripCountries, ..._visitedCountries])].sort();

  const countLink = document.getElementById('visited-count-link');
  if (countLink) {
    countLink.textContent = all.length
      ? `${all.length} countr${all.length === 1 ? 'y' : 'ies'} visited — manage list`
      : 'No countries yet — add from the selector above';
    countLink.onclick = all.length ? openVisitedCountriesModal : null;
  }
}

function openVisitedCountriesModal() {
  const tripCountries = new Set(_statsData?.allTime?.countries || []);
  const all = [...new Set([...tripCountries, ..._visitedCountries])].sort();

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4';
  overlay.innerHTML = `
    <div class="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl max-h-[80vh] flex flex-col">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold">Countries visited (${all.length})</h2>
        <button id="close-visited-modal" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div class="overflow-y-auto flex-1 space-y-1.5" id="visited-modal-list"></div>
    </div>
  `;

  document.body.appendChild(overlay);
  refreshIcons();

  overlay.querySelector('#close-visited-modal').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  const renderList = () => {
    const tripCountries = new Set(_statsData?.allTime?.countries || []);
    const all = [...new Set([...tripCountries, ..._visitedCountries])].sort();
    const list = overlay.querySelector('#visited-modal-list');
    list.innerHTML = all.map(c => {
      const isFromTrip = tripCountries.has(c);
      const isManual = _visitedCountries.includes(c);
      return `
        <div class="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">${escapeHtml(c)}</span>
            ${isFromTrip ? `<span class="text-xs text-slate-400 dark:text-slate-500">trip</span>` : ''}
          </div>
          ${isManual && !isFromTrip ? `
            <button onclick="removeVisitedCountryFromModal('${escapeHtml(c)}')" class="text-slate-400 hover:text-red-400 transition">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          ` : `<span class="text-slate-200 dark:text-slate-700"><i data-lucide="lock" class="w-3.5 h-3.5"></i></span>`}
        </div>
      `;
    }).join('') || '<p class="text-center text-slate-400 py-4 text-sm">No countries yet.</p>';
    refreshIcons();
  };

  renderList();
  window._visitedModalRender = renderList;
}

async function removeVisitedCountryFromModal(country) {
  await removeVisitedCountry(country);
  if (window._visitedModalRender) window._visitedModalRender();
}

window.openVisitedCountriesModal = openVisitedCountriesModal;
window.removeVisitedCountryFromModal = removeVisitedCountryFromModal;

function populateCountrySelector() {
  const select = document.getElementById('add-country-select');
  if (!select) return;

  const countries = [
    'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria',
    'Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia',
    'Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia',
    'Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica',
    'Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt',
    'El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon',
    'Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti',
    'Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan',
    'Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia',
    'Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta',
    'Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro',
    'Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger',
    'Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama',
    'Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda',
    'Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino',
    'Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia',
    'Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan',
    'Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo',
    'Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine',
    'United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City',
    'Venezuela','Vietnam','Yemen','Zambia','Zimbabwe'
  ];

  const all = [...new Set([...countries, ...(_statsData?.allTime?.countries || [])])].sort();
  select.innerHTML = '<option value="">+ Add country visited</option>' +
    all.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  select.onchange = () => {
    if (select.value) {
      addVisitedCountry(select.value);
      select.value = '';
    }
  };
}

const COUNTRY_NAME_TO_ID = {
  'Afghanistan':4,'Albania':8,'Algeria':12,'Andorra':20,'Angola':24,'Antigua and Barbuda':28,
  'Argentina':32,'Armenia':51,'Australia':36,'Austria':40,'Azerbaijan':31,'Bahamas':44,'Bahrain':48,
  'Bangladesh':50,'Barbados':52,'Belarus':112,'Belgium':56,'Belize':84,'Benin':204,'Bhutan':64,
  'Bolivia':68,'Bosnia and Herzegovina':70,'Botswana':72,'Brazil':76,'Brunei':96,'Bulgaria':100,
  'Burkina Faso':854,'Burundi':108,'Cabo Verde':132,'Cambodia':116,'Cameroon':120,'Canada':124,
  'Central African Republic':140,'Chad':148,'Chile':152,'China':156,'Colombia':170,'Comoros':174,
  'Congo':180,'Costa Rica':188,'Croatia':191,'Cuba':192,'Cyprus':196,'Czech Republic':203,
  'Denmark':208,'Djibouti':262,'Dominica':212,'Dominican Republic':214,'Ecuador':218,'Egypt':818,
  'El Salvador':222,'Equatorial Guinea':226,'Eritrea':232,'Estonia':233,'Eswatini':748,'Ethiopia':231,
  'Fiji':242,'Finland':246,'France':250,'Gabon':266,'Gambia':270,'Georgia':268,'Germany':276,
  'Ghana':288,'Greece':300,'Grenada':308,'Guatemala':320,'Guinea':324,'Guinea-Bissau':624,
  'Guyana':328,'Haiti':332,'Honduras':340,'Hungary':348,'Iceland':352,'India':356,'Indonesia':360,
  'Iran':364,'Iraq':368,'Ireland':372,'Israel':376,'Italy':380,'Jamaica':388,'Japan':392,
  'Jordan':400,'Kazakhstan':398,'Kenya':404,'Kiribati':296,'Kuwait':414,'Kyrgyzstan':417,'Laos':418,
  'Latvia':428,'Lebanon':422,'Lesotho':426,'Liberia':430,'Libya':434,'Liechtenstein':438,
  'Lithuania':440,'Luxembourg':442,'Madagascar':450,'Malawi':454,'Malaysia':458,'Maldives':462,
  'Mali':466,'Malta':470,'Marshall Islands':584,'Mauritania':478,'Mauritius':480,'Mexico':484,
  'Micronesia':583,'Moldova':498,'Monaco':492,'Mongolia':496,'Montenegro':499,'Morocco':504,
  'Mozambique':508,'Myanmar':104,'Namibia':516,'Nauru':520,'Nepal':524,'Netherlands':528,
  'New Zealand':554,'Nicaragua':558,'Niger':562,'Nigeria':566,'North Korea':408,'North Macedonia':807,
  'Norway':578,'Oman':512,'Pakistan':586,'Palau':585,'Palestine':275,'Panama':591,
  'Papua New Guinea':598,'Paraguay':600,'Peru':604,'Philippines':608,'Poland':616,'Portugal':620,
  'Qatar':634,'Romania':642,'Russia':643,'Rwanda':646,'Saint Kitts and Nevis':659,'Saint Lucia':662,
  'Saint Vincent and the Grenadines':670,'Samoa':882,'San Marino':674,'Sao Tome and Principe':678,
  'Saudi Arabia':682,'Senegal':686,'Serbia':688,'Seychelles':690,'Sierra Leone':694,'Singapore':702,
  'Slovakia':703,'Slovenia':705,'Solomon Islands':90,'Somalia':706,'South Africa':710,
  'South Korea':410,'South Sudan':728,'Spain':724,'Sri Lanka':144,'Sudan':729,'Suriname':740,
  'Sweden':752,'Switzerland':756,'Syria':760,'Taiwan':158,'Tajikistan':762,'Tanzania':834,
  'Thailand':764,'Timor-Leste':626,'Togo':768,'Tonga':776,'Trinidad and Tobago':780,'Tunisia':788,
  'Turkey':792,'Turkmenistan':795,'Tuvalu':798,'Uganda':800,'Ukraine':804,
  'United Arab Emirates':784,'United Kingdom':826,'United States':840,'Uruguay':858,
  'Uzbekistan':860,'Vanuatu':548,'Vatican City':336,'Venezuela':862,'Vietnam':704,'Yemen':887,
  'Zambia':894,'Zimbabwe':716
};

async function renderWorldMap() {
  const container = document.getElementById('world-map');
  if (!container) return;

  const tripCountries = new Set(_statsData?.allTime?.countries || []);
  const manualCountries = new Set(_visitedCountries);
  const allVisited = new Set([...tripCountries, ...manualCountries]);

  const visitedIds = new Set(
    [...allVisited].map(c => COUNTRY_NAME_TO_ID[c]).filter(Boolean)
  );

  container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-400 text-sm">Loading map…</div>';

  try {
    const world = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json').then(r => r.json());

    const isDark = document.documentElement.classList.contains('dark');
    const width = container.clientWidth;
    const height = 380;

    container.innerHTML = '';
    const svg = d3.select(container)
      .append('svg')
      .attr('width', '100%')
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    const projection = d3.geoNaturalEarth1()
      .scale(width / 7.2)
      .translate([width / 2, height / 2 + 30]);

    const path = d3.geoPath().projection(projection);
    const countries = topojson.feature(world, world.objects.countries);

    svg.append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('fill', isDark ? '#1e293b' : '#e2e8f0');

    svg.selectAll('path')
      .data(countries.features)
      .enter()
      .append('path')
      .attr('d', path)
      .attr('fill', d => visitedIds.has(Number(d.id)) ? '#6366f1' : (isDark ? '#334155' : '#cbd5e1'))
      .attr('stroke', isDark ? '#1e293b' : '#f8fafc')
      .attr('stroke-width', 0.5);

  } catch (err) {
    console.error('Map error:', err);
    container.innerHTML = '<div class="flex items-center justify-center h-full text-slate-400 text-sm">Failed to load map.</div>';
  }
}

window.addVisitedCountry = addVisitedCountry;
window.removeVisitedCountry = removeVisitedCountry;
window.populateCountrySelector = populateCountrySelector;
window.renderVisitedPills = renderVisitedPills;
window.renderWorldMap = renderWorldMap;

async function loadStats() {
  const table = document.getElementById('stats-table');
  if (!table) return;

  table.innerHTML = `<tr><td colspan="7" class="px-3 py-8 text-center text-slate-500 dark:text-slate-400">Loading stats…</td></tr>`;

  try {
    const data = await apiGet(API.GET_STATS);
    _statsData = data;
    await loadVisitedCountries();

    renderStats();
    populateCountrySelector();
    renderVisitedPills();
    renderWorldMap();

    // Restore currency: explicit localStorage choice wins, then user's default, then blank
    const savedStatsCurrency =
      localStorage.getItem('cloudtrips_stats_currency') ||
      state.settings.defaultCurrency ||
      '';
    const statsSelect = document.getElementById('statsCurrency');
    if (savedStatsCurrency && statsSelect) {
      statsSelect.value = savedStatsCurrency;
      applyStatsCurrency(); // fire and forget — don't await
    }

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

  const allCosts = trips.reduce((acc, t) => {
    Object.entries(t.costsByCurrency).forEach(([c, v]) => {
      acc[c] = (acc[c] || 0) + v;
    });
    return acc;
  }, {});
  const totalCostStr = getConvertedTotal(allCosts);

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

  const years = [...new Set(trips.map(t => t.startDate ? new Date(t.startDate).getFullYear() : null).filter(Boolean))].sort((a, b) => b - a);
  const yearPillsEl = document.getElementById('year-pills');
  if (yearPillsEl) {
    const pillClass = (active) => `stats-year-pill rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-primary-400'}`;
    yearPillsEl.innerHTML = `
      <button onclick="setStatsYear('')" class="${pillClass(!_statsYear)}">All</button>
      ${years.map(y => `<button onclick="setStatsYear('${y}')" class="${pillClass(_statsYear === String(y))}">${y}</button>`).join('')}
    `;
  }

  const countries = [...new Set(trips.map(t => t.country).filter(Boolean))].sort();
  const countryPillsEl = document.getElementById('country-pills');
  if (countryPillsEl) {
    const pillClass = (active) => `rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-primary-400'}`;
    countryPillsEl.innerHTML = countries.length ? `
      <button onclick="setStatsCountry('')" class="${pillClass(!_statsCountry)}">All</button>
      ${countries.map(c => `<button onclick="setStatsCountry('${escapeHtml(c)}')" class="${pillClass(_statsCountry === c)}">${escapeHtml(c)}</button>`).join('')}
    ` : '<span class="text-xs text-slate-400">No countries set on trips yet</span>';
  }

  let filtered = trips;
  if (_statsYear) filtered = filtered.filter(t => t.startDate && new Date(t.startDate).getFullYear() === Number(_statsYear));
  if (_statsCountry) filtered = filtered.filter(t => t.country === _statsCountry);

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

  ['days', 'activities', 'km', 'cost'].forEach(key => {
    const el = document.getElementById(`sort-${key}`);
    if (el) el.textContent = _statsSort.key === key ? (_statsSort.dir === 'asc' ? '↑' : '↓') : '';
  });

  const table = document.getElementById('stats-table');
  if (!table) return;

  table.innerHTML = filtered.length
    ? filtered.map(t => {
        const dateRange = t.startDate
          ? `${formatDayLabel(t.startDate)}${t.endDate && t.endDate !== t.startDate ? ' → ' + formatDayLabel(t.endDate) : ''}`
          : '—';
        const costStr = getConvertedTotal(t.costsByCurrency);

        return `
          <tr class="rounded-2xl bg-white dark:bg-slate-950/60 cursor-pointer transition hover:-translate-y-0.5 hover:border-primary-200 dark:hover:border-primary-500/30" onclick="openTrip('${escapeHtml(t.id)}')">
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

/* =========================
 * INIT
 * ========================= */

async function init() {
  try {
    const onSharedPage = isGuestView();

    if (!onSharedPage && typeof requireAuth === 'function') {
      try {
        await requireAuth();
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

    // Load user settings before page dispatch so currency preference is ready
    await loadUserSettings();

    const hasEl = (id) => Boolean(document.getElementById(id));

    if (hasEl('trip-list')) await loadTrips();
    if (hasEl('activities')) { await loadTripPage(); renderHeaderNav('trip'); }
    if (hasEl('timeline')) { await loadTimeline(); renderHeaderNav('timeline'); }
    if (hasEl('cost-table')) { await loadCosts(); renderHeaderNav('costs'); }
    if (hasEl('stats-table')) {
      await loadStats();
      renderHeaderNav('stats');
      requestAnimationFrame(() => {
        const header = document.querySelector('header');
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
window.openSettingsModal = openSettingsModal;
window.renderHeaderNav = renderHeaderNav;
window.applyConversion = applyConversion;
window.moveActivity = moveActivity;
window.saveTripNotes = saveTripNotes;
window.saveTripCountry = saveTripCountry;
window.saveTripCountryNow = saveTripCountryNow;
window.logout = logout;