/* =========================
 * ui.js
 * Pure rendering functions — UI partials, loading states, modals.
 * Depends on: state.js, helpers.js
 * ========================= */

/* =========================
 * LOADING STATES
 * ========================= */

function emptyState(title, message, icon) {
  return `
    <div class="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-soft dark:border-slate-700 dark:bg-slate-900">
      <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <i data-lucide="${icon}" class="h-6 w-6"></i>
      </div>
      <h3 class="text-lg font-semibold tracking-tight">${escapeHtml(title)}</h3>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">${escapeHtml(message)}</p>
    </div>
  `;
}

function loadingCardGrid() {
  return `
    <div class="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-soft dark:border-slate-800 dark:bg-slate-900 md:col-span-2 xl:col-span-3">
      <div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600 dark:border-slate-700 dark:border-t-primary-400"></div>
      <p class="text-sm text-slate-500 dark:text-slate-400">Loading trips…</p>
    </div>
  `;
}

function loadingTimeline() {
  return `
    <div class="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-soft dark:border-slate-800 dark:bg-slate-900">
      <div class="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary-600 dark:border-slate-700 dark:border-t-primary-400"></div>
      <p class="text-sm text-slate-500 dark:text-slate-400">Loading timeline…</p>
    </div>
  `;
}

/* =========================
 * MODALS
 * ========================= */

function openTextModal({
  title = 'Enter value',
  placeholder = '',
  value = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
  inputType = 'text'
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4';

    overlay.innerHTML = `
      <div class="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <h2 class="mb-4 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          ${escapeHtml(title)}
        </h2>

        <input
          id="app-modal-input"
          type="${escapeHtml(inputType)}"
          value="${escapeHtml(value)}"
          placeholder="${escapeHtml(placeholder)}"
          class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-primary-500/20"
        />

        <div class="mt-5 flex justify-end gap-2">
          <button
            id="app-modal-cancel"
            type="button"
            class="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            ${escapeHtml(cancelText)}
          </button>

          <button
            id="app-modal-confirm"
            type="button"
            class="inline-flex items-center justify-center rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            ${escapeHtml(confirmText)}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector('#app-modal-input');
    const confirmButton = overlay.querySelector('#app-modal-confirm');
    const cancelButton = overlay.querySelector('#app-modal-cancel');

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    confirmButton.addEventListener('click', () => close(input.value.trim()));
    cancelButton.addEventListener('click', () => close(null));

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close(null);
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') confirmButton.click();
      if (event.key === 'Escape') close(null);
    });

    requestAnimationFrame(() => {
      input.focus();
      if (inputType !== 'password') {
        input.setSelectionRange(0, input.value.length);
      }
    });
  });
}

/* =========================
 * TRIP LIST (INDEX PAGE)
 * ========================= */

function renderTripList() {
  const container = document.getElementById('trip-list');
  if (!container) return;

  container.innerHTML = state.trips.map((trip) => {
    const dateLabel = trip.startDate
      ? `${formatDayLabel(trip.startDate)}${trip.endDate ? ' → ' + formatDayLabel(trip.endDate) : ''}`
      : 'Add activities to see timeline';

    return `
      <article class="group rounded-3xl border border-slate-200 bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:border-primary-200 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary-500/30">
        <div class="mb-4 flex items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
              <i data-lucide="map" class="h-5 w-5"></i>
            </div>
            <div>
              <h3 class="text-lg font-semibold tracking-tight">${escapeHtml(trip.name)}</h3>
            </div>
          </div>
        </div>

        <div class="mb-5 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
            <i data-lucide="calendar-days" class="h-3.5 w-3.5"></i>
            ${escapeHtml(dateLabel)}
          </span>
        </div>

        <div class="flex gap-2">
          <button onclick="openTrip('${escapeHtml(trip.id)}')" class="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
            <i data-lucide="arrow-right" class="h-4 w-4"></i>
            Open
          </button>

          <button onclick="renameTrip('${escapeHtml(trip.id)}')" class="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
            <i data-lucide="pencil" class="h-4 w-4"></i>
          </button>

          <button onclick="deleteTrip('${escapeHtml(trip.id)}')" class="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20">
            <i data-lucide="trash-2" class="h-4 w-4"></i>
          </button>
        </div>
      </article>
    `;
  }).join('');

  refreshIcons();
}

/* =========================
 * ACTIVITIES (TRIP PAGE)
 * ========================= */

function renderActivities() {
  const container = document.getElementById('activities');
  if (!container || !state.currentTrip) return;

  const activities = sortActivities(state.currentTrip.activities);
  state.currentTrip.activities = activities;

  if (!activities.length) {
    container.innerHTML = emptyState(
      isGuestView() ? 'No activities available' : 'No activities yet',
      isGuestView()
        ? 'This shared trip does not contain any activities yet.'
        : 'Add your first activity to build the itinerary.',
      'calendar-plus'
    );
    refreshIcons();
    return;
  }

  container.innerHTML = activities.map((activity) => {
    const meta = getTypeMeta(activity.type);
    return `
      <article class="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft dark:border-slate-800 dark:bg-slate-900">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0 flex-1">
            <div class="mb-3 flex flex-wrap items-center gap-2">
              <span class="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                <i data-lucide="${meta.icon}" class="h-5 w-5"></i>
              </span>
              <h3 class="truncate text-lg font-semibold tracking-tight">${escapeHtml(activity.location || activity.name || 'Untitled activity')}</h3>
              <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${meta.badge}">
                ${escapeHtml(activity.type)}
              </span>
            </div>

            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Start</div>
                  <div class="text-sm font-medium">${escapeHtml(formatDateTime(activity.startDate))}</div>
                </div>

                <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">End</div>
                  <div class="text-sm font-medium">${escapeHtml(formatDateTime(activity.endDate))}</div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Cost</div>
                  <div class="text-sm font-medium">${escapeHtml(formatCurrency(activity.cost))}</div>
                </div>

                <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                  <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Distance</div>
                  <div class="text-sm font-medium">${activity.km ? escapeHtml(`${activity.km} km`) : '—'}</div>
                </div>
              </div>

              <div class="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-slate-800/70">
                <div class="mb-1 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Notes</div>
                <div class="text-sm font-medium whitespace-pre-wrap break-words">${escapeHtml(activity.notes || '—')}</div>
              </div>
            </div>
          </div>

          ${!isGuestView() ? `
            <div class="flex gap-2">
              <button onclick="editActivity('${escapeHtml(activity.id)}')" class="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800">
                <i data-lucide="pencil" class="h-4 w-4"></i>
                Edit
              </button>
              <button onclick="deleteActivity('${escapeHtml(activity.id)}')" class="inline-flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20">
                <i data-lucide="trash-2" class="h-4 w-4"></i>
                Delete
              </button>
            </div>
          ` : ''}
        </div>
      </article>
    `;
  }).join('');

  refreshIcons();
}

/* =========================
 * TIMELINE PAGE
 * ========================= */

function renderTimelineActivity(activity) {
  const meta = getTypeMeta(activity.type);

  return `
    <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
      <div class="mb-2 flex flex-wrap items-center gap-2">
        <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
          <i data-lucide="${meta.icon}" class="h-4 w-4"></i>
        </span>

        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-semibold">${escapeHtml(activity.location || activity.name || 'Activity')}</div>
        </div>

        <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ${meta.badge}">
          ${escapeHtml(activity.type)}
        </span>
      </div>

      <div class="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>⏱ ${escapeHtml(formatTimeOnly(activity.startDate))} – ${escapeHtml(formatTimeOnly(activity.endDate))}</span>
        ${activity.km ? `<span>🚗 ${escapeHtml(`${activity.km} km`)}</span>` : ''}
        <span>💶 ${escapeHtml(formatCurrency(activity.cost))}</span>
      </div>

      ${activity.notes ? `
        <div class="mt-2 text-xs text-slate-600 dark:text-slate-300">
          ${escapeHtml(activity.notes)}
        </div>
      ` : ''}
    </div>
  `;
}

/* =========================
 * CALENDAR VIEW
 * ========================= */

function renderCalendarTile(key, dayActivities) {
  const dateValue = dayActivities[0]?.startDate;
  const label = key === 'undated' ? 'No date' : formatDayLabel(dateValue);
  const weekday = key === 'undated' ? '—' : formatWeekdayShort(dateValue);
  const dayNumber = key === 'undated' ? '—' : formatDayNumber(dateValue);
  const totalCost = dayActivities.reduce((sum, activity) => sum + Number(activity.cost || 0), 0);
  const totalKm = dayActivities.reduce((sum, activity) => sum + Number(activity.km || 0), 0);

  const previewItems = dayActivities.slice(0, 4).map((activity) => {
    const meta = getTypeMeta(activity.type);
    const name = activity.location || activity.name || 'Activity';
    return `
      <div class="flex items-start gap-2 rounded-xl bg-slate-950/80 px-3 py-2">
        <span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary-500/10 text-primary-300">
          <i data-lucide="${meta.icon}" class="h-3.5 w-3.5"></i>
        </span>
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-slate-100">${escapeHtml(name)}</div>
          <div class="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-slate-400">
            <span>${escapeHtml(formatTimeOnly(activity.startDate))}–${escapeHtml(formatTimeOnly(activity.endDate))}</span>
            ${activity.km ? `<span>${escapeHtml(`${activity.km} km`)}</span>` : ''}
            <span>${escapeHtml(formatCurrency(activity.cost))}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');

  const extraCount = Math.max(dayActivities.length - 4, 0);

  return `
    <article class="flex min-h-[220px] flex-col rounded-2xl border border-slate-800 bg-slate-800/60 p-4 transition hover:border-primary-500/60 hover:bg-slate-800">
      <div class="mb-3 flex items-start justify-between gap-3">
        <div>
          <div class="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">${escapeHtml(weekday)}</div>
          <div class="mt-1 text-3xl font-semibold leading-none text-slate-100">${escapeHtml(dayNumber)}</div>
        </div>
        <div class="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-right">
          <div class="text-[11px] uppercase tracking-wide text-slate-500">Summary</div>
          <div class="mt-1 text-xs text-slate-300">${escapeHtml(formatCurrency(totalCost))}</div>
          <div class="text-xs text-slate-400">${escapeHtml(`${totalKm || 0} km`)}</div>
        </div>
      </div>

      <div class="mb-3 text-xs text-slate-400">${escapeHtml(label)}</div>

      <div class="space-y-2">
        ${previewItems}
      </div>

      ${extraCount ? `
        <div class="mt-3 rounded-xl border border-dashed border-slate-700 px-3 py-2 text-xs text-slate-400">
          +${extraCount} more item${extraCount === 1 ? '' : 's'} on this day
        </div>
      ` : ''}
    </article>
  `;
}

/* =========================
 * COSTS PAGE
 * ========================= */

function renderCosts() {
  const table = document.getElementById('cost-table');
  const totalEl = document.getElementById('totalCost');
  const summaryEl = document.getElementById('cost-summary');

  if (!table || !totalEl || !summaryEl || !state.currentTrip) return;

  const activities = sortActivities(state.currentTrip.activities);
  const total = activities.reduce((sum, activity) => sum + Number(activity.cost || 0), 0);
  const totalKm = activities.reduce((sum, activity) => sum + Number(activity.km || 0), 0);

  const byType = activities.reduce((accumulator, activity) => {
    const key = activity.type || 'other';
    accumulator[key] = (accumulator[key] || 0) + Number(activity.cost || 0);
    return accumulator;
  }, {});

  const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  totalEl.textContent = formatCurrency(total);

  const totalKmEl = document.getElementById('totalKm');
  if (totalKmEl) {
    totalKmEl.textContent = totalKm ? `${totalKm} km` : '—';
  }

  summaryEl.innerHTML = typeEntries.length
    ? typeEntries.map(([type, amount]) => {
        const meta = getTypeMeta(type);
        const percent = total > 0 ? Math.round((amount / total) * 100) : 0;

        return `
          <div class="grid grid-cols-[1fr_60px_100px] items-center rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-800">
            <div class="flex min-w-0 items-center gap-2">
              <span class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                <i data-lucide="${meta.icon}" class="h-4 w-4"></i>
              </span>
              <span class="truncate font-medium capitalize">
                ${escapeHtml(type)}
              </span>
            </div>

            <div class="text-right text-sm tabular-nums text-slate-400">
              ${percent}%
            </div>

            <div class="text-right text-sm font-medium tabular-nums">
              ${escapeHtml(formatCurrency(amount))}
            </div>
          </div>
        `;
      }).join('')
    : emptyState(
        'No costs yet',
        'Add cost values to activities to see the summary.',
        'wallet'
      );

  table.innerHTML = activities.length
    ? activities.map((activity) => {
        const meta = getTypeMeta(activity.type);

        return `
          <tr class="rounded-2xl bg-slate-50 dark:bg-slate-950/60">
            <td data-label="Activity" class="rounded-l-2xl px-3 py-3">
              <div class="flex items-center gap-3">
                <span class="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                  <i data-lucide="${meta.icon}" class="h-4 w-4"></i>
                </span>
                <span class="font-medium">${escapeHtml(activity.location || activity.name || 'Untitled')}</span>
              </div>
            </td>

            <td data-label="Type" class="px-3 py-3">
              <span class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${meta.badge}">
                ${escapeHtml(activity.type)}
              </span>
            </td>

            <td data-label="Start" class="px-3 py-3 text-sm text-slate-600 dark:text-slate-300">
              ${escapeHtml(formatDateTime(activity.startDate))}
            </td>

            <td data-label="Cost" class="px-3 py-3 text-right font-semibold">
              ${escapeHtml(formatCurrency(activity.cost))}
            </td>

            <td data-label="KM" class="rounded-r-2xl px-3 py-3 text-right text-sm text-slate-600 dark:text-slate-300">
              ${activity.km ? escapeHtml(`${activity.km} km`) : '—'}
            </td>
          </tr>
        `;
      }).join('')
    : `
        <tr>
          <td colspan="5" class="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
            No activities yet.
          </td>
        </tr>
      `;

  refreshIcons();
}
