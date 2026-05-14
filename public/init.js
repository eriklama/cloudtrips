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
      <section class="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shadow-soft">
        <button
          type="button"
          onclick="toggleTimelineDay('${escapeHtml(key)}')"
          class="flex w-full items-center justify-between gap-3 bg-slate-200 dark:bg-slate-800/70 px-4 py-3 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <div class="min-w-0">
            <div class="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">${escapeHtml(label)}</div>
            <div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-500 dark:text-slate-400">
              <span>${dayActivities.length} item${dayActivities.length === 1 ? '' : 's'}</span>
              <span>${escapeHtml(formatCurrency(totalCost))}</span>
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
    showToast('Trip not loaded.', 'error');
    return;
  }

  if (isGuestView()) {
    showToast('Shared viewers cannot create links.', 'info');
    return;
  }

  // Step 1 — ask which mode
  const mode = await openShareModeModal();
  if (!mode) return;

  const modal = document.getElementById('share-modal');
  const input = document.getElementById('share-link');

  if (!modal || !input) {
    showToast('Share modal missing.', 'error');
    return;
  }

  try {
    input.value = 'Creating link...';
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const data = await apiPost(API.SHARE_TRIP, {
      tripId: state.currentTrip.id,
      mode
    });

    const shareUrl = data?.shareUrl
      ? `${window.location.origin}${data.shareUrl}`
      : '';

    if (!shareUrl) throw new Error('No share link returned');

    input.value = shareUrl;
  } catch (err) {
    console.error(err);
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    showToast('Failed to create share link.', 'error');
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
    showToast('Link copied!', 'success');
  } catch {
    input.select();
    document.execCommand('copy');
    showToast('Link copied!', 'success');
  }
}

/* =========================
 * MANAGE SHARES
 * ========================= */

async function openManageSharesModal() {
  if (!state.currentTrip?.id) {
    showToast('Trip not loaded.', 'error');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 dark:bg-slate-950/60 p-4';

  overlay.innerHTML = `
    <div class="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Active share links</h2>
        <button id="manage-shares-close" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div id="shares-list" class="space-y-2 text-sm">
        <div class="text-slate-400 dark:text-slate-500 text-center py-4">Loading...</div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  refreshIcons();

  overlay.querySelector('#manage-shares-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  // Load shares
  try {
    const data = await apiGet(`${API.GET_SHARES}?tripId=${encodeURIComponent(state.currentTrip.id)}`);
    const list = overlay.querySelector('#shares-list');

    if (!data.shares?.length) {
      list.innerHTML = '<div class="text-slate-400 dark:text-slate-500 text-center py-4">No active share links.</div>';
      return;
    }

    list.innerHTML = data.shares.map(share => {
      const mode = share.mode === 'public' ? 'Public' : 'Full';
      const modeColor = share.mode === 'public'
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
        : 'bg-primary-500/10 text-primary-600 dark:text-primary-300';
      const created = new Date(share.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const expires = share.expires_at
        ? new Date(share.expires_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        : 'Never';
      const lastUsed = share.last_used_at
        ? new Date(share.last_used_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
        : 'Never';

      return `
        <div class="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3" data-share-id="${escapeHtml(share.id)}">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 mb-1">
              <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${modeColor}">${mode}</span>
              <span class="text-xs text-slate-400 dark:text-slate-500">Created ${created}</span>
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400">
              Expires ${expires} · Last used ${lastUsed}
            </div>
          </div>
          <button
            onclick="revokeShare('${escapeHtml(share.id)}')"
            class="shrink-0 inline-flex items-center gap-1 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 transition">
            Revoke
          </button>
        </div>
      `;
    }).join('');

    refreshIcons();
  } catch (err) {
    console.error(err);
    overlay.querySelector('#shares-list').innerHTML =
      '<div class="text-red-400 text-center py-4">Failed to load share links.</div>';
  }
}

async function revokeShare(shareId) {
  const confirmed = await openConfirmModal({
    title: 'Revoke share link',
    message: 'This link will stop working immediately.',
    confirmText: 'Revoke',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    await apiPost(API.REVOKE_SHARE, { shareId });
    // Remove from UI
    const row = document.querySelector(`[data-share-id="${shareId}"]`);
    if (row) {
      row.style.opacity = '0';
      row.style.transition = 'opacity 0.2s';
      setTimeout(() => row.remove(), 200);
    }
    showToast('Share link revoked.', 'success');
  } catch (err) {
    showToast(err?.message || 'Failed to revoke link.', 'error');
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
  if (current !== 'trip') items.push({ label: 'Trip', icon: 'notebook-pen', onClick: goToTrip });
  if (current !== 'timeline') items.push({ label: 'Timeline', icon: 'list-tree', onClick: goToTimeline });
  if (current !== 'costs') items.push({ label: 'Costs', icon: 'badge-euro', onClick: goToCosts });
  items.push({ label: 'Export', icon: 'printer', onClick: openPrintView });

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
    if (hasEl('activities')) { await loadTripPage(); renderHeaderNav('trip'); }
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
window.revokeShare = revokeShare;
window.openManageSharesModal = openManageSharesModal;
window.moveActivity = moveActivity;
/* window.logout = logout; */
