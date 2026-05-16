/* =========================
 * activities.js
 * Trip page activity logic — load, add, edit, delete.
 * Depends on: state.js, helpers.js, ui.js, api.js
 * ========================= */

async function loadTripPage() {
  const tripId = getTripIdFromUrl();
  if (!tripId) {
    showToast('Trip ID is missing.', 'error');
    return;
  }

  try {
    state.currentTrip = await fetchTrip(tripId);
    setText('trip-title', state.currentTrip.name || 'Trip');
    setText('trip-title-hero', state.currentTrip.name || 'Trip');

    // Populate notes and country
    const notesEl = document.getElementById('trip-notes');
    if (notesEl) notesEl.value = state.currentTrip.notes || '';
    const countryEl = document.getElementById('trip-country');
    if (countryEl) countryEl.value = state.currentTrip.country || '';

    applySharedViewUi('trip-title', 'trip-title-hero');

    if (isGuestView()) {
      const shareBtn = document.querySelector('button[onclick="openShareModal()"]');
      if (shareBtn) shareBtn.style.display = 'none';
      const logoutBtn = document.getElementById('logout-button');
      if (logoutBtn) logoutBtn.style.display = 'none';
      const notesSection = document.getElementById('trip-notes-section');
      if (notesSection) notesSection.style.display = 'none';
    }

    renderActivities();

    // Cmd/Ctrl+Enter to save activity form from any field
    const form = document.getElementById('activity-form');
    if (form) {
      form.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          saveActivity();
        }
      });
    }
  } catch (error) {
    console.error(error);
    const container = document.getElementById('activities');

    if (container) {
      container.innerHTML = emptyState(
        'Failed to load trip',
        error?.message || 'Check whether the trip exists.',
        'triangle-alert'
      );
      refreshIcons();
    }
  }
}

function getActivityFormData() {
  const $ = (id) => document.getElementById(id);

  function combineDateTime(dateId, timeId) {
    const date = $(dateId)?.value || '';
    const time = $(timeId)?.value || '';
    if (!date) return '';
    return time ? `${date}T${time}` : `${date}T00:00`;
  }

  return {
    name: $('activityName')?.value.trim() || '',
    location: $('activityLocation')?.value.trim() || '',
    type: $('activityType')?.value || 'other',
    startDate: combineDateTime('activityStartDate', 'activityStartTime'),
    endDate: combineDateTime('activityEndDate', 'activityEndTime'),
    cost: Number($('activityCost')?.value || 0),
    currency: $('activityCurrency')?.value || 'EUR',
    notes: $('activityNotes')?.value.trim() || '',
    km: Number($('activityDistance')?.value || 0),
    distance: Number($('activityDistance')?.value || 0)
  };
}

function setActivityFormData(activity) {
  const $ = (id) => document.getElementById(id);
  const data = activity || {
    name: '', location: '', type: 'other',
    startDate: '', endDate: '', cost: '',
    currency: 'EUR', notes: '', km: '', distance: ''
  };

  function splitDate(iso) {
    if (!iso) return '';
    return iso.includes('T') ? iso.split('T')[0] : iso;
  }

  function splitTime(iso) {
    if (!iso) return '';
    return iso.includes('T') ? iso.split('T')[1].slice(0, 5) : '';
  }

  if ($('activityName')) $('activityName').value = data.name || '';
  if ($('activityLocation')) $('activityLocation').value = data.location || '';
  if ($('activityType')) $('activityType').value = data.type || 'other';
  if ($('activityStartDate')) $('activityStartDate').value = splitDate(data.startDate);
  if ($('activityStartTime')) $('activityStartTime').value = splitTime(data.startDate);
  if ($('activityEndDate')) $('activityEndDate').value = splitDate(data.endDate);
  if ($('activityEndTime')) $('activityEndTime').value = splitTime(data.endDate);
  if ($('activityCost')) $('activityCost').value = data.cost || '';
  if ($('activityCurrency')) $('activityCurrency').value = data.currency || 'EUR';
  if ($('activityNotes')) $('activityNotes').value = data.notes || '';
  if ($('activityDistance')) $('activityDistance').value = data.distance || data.km || '';
}

function resetActivityForm() {
  setActivityFormData(null);
  state.editingActivityId = null;

  const title = document.getElementById('activity-form-title');
  const cancelButton = document.getElementById('cancel-edit-btn');
  const addButton = document.querySelector('button[onclick="addActivity()"]');
  const searchEl = document.getElementById('activity-search');
  const clearBtn = document.getElementById('activity-search-clear');

  if (title) title.textContent = 'Add activity';
  if (cancelButton) cancelButton.classList.add('hidden');
  if (addButton) addButton.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i>Add Activity';
  if (searchEl) searchEl.value = '';
  if (clearBtn) clearBtn.classList.add('hidden');
  _activeTypeFilter = '';
  document.querySelectorAll('.type-filter-pill').forEach(btn => {
    const isAll = btn.dataset.type === '';
    btn.classList.toggle('border-primary-500', isAll);
    btn.classList.toggle('bg-primary-50', isAll);
    btn.classList.toggle('text-primary-700', isAll);
    btn.classList.toggle('dark:bg-primary-500/10', isAll);
    btn.classList.toggle('dark:text-primary-300', isAll);
    btn.classList.toggle('border-slate-200', !isAll);
    btn.classList.toggle('dark:border-slate-700', !isAll);
    btn.classList.toggle('bg-white', !isAll);
    btn.classList.toggle('dark:bg-slate-900', !isAll);
    btn.classList.toggle('text-slate-600', !isAll);
    btn.classList.toggle('dark:text-slate-300', !isAll);
  });

  refreshIcons();
}

function cancelEditActivity() {
  resetActivityForm();
}

let _notesSaveTimeout = null;
function saveTripNotes() {
  const notesEl = document.getElementById('trip-notes');
  if (!notesEl || !state.currentTrip) return;
  state.currentTrip.notes = notesEl.value;
  clearTimeout(_notesSaveTimeout);
  _notesSaveTimeout = setTimeout(async () => {
    try {
      await saveTripMeta(state.currentTrip);
      saveTripToCache(state.currentTrip);
    } catch (err) {
      console.error(err);
      showToast('Failed to save notes.', 'error');
    }
  }, 1000);
}

let _countrySaveTimeout = null;
function saveTripCountry() {
  const countryEl = document.getElementById('trip-country');
  if (!countryEl || !state.currentTrip) return;
  state.currentTrip.country = countryEl.value;
  clearTimeout(_countrySaveTimeout);
  _countrySaveTimeout = setTimeout(async () => {
    try {
      await saveTripMeta(state.currentTrip);
      saveTripToCache(state.currentTrip);
    } catch (err) {
      console.error(err);
      showToast('Failed to save country.', 'error');
    }
  }, 1000);
}

async function saveActivity() {
  if (isGuestView()) {
    showToast('This trip is shared (view-only).', 'info');
    return;
  }

  if (!state.currentTrip) return;

  const data = getActivityFormData();
  if (!data.location && !data.name) {
    showToast('Activity name or location is required.', 'info');
    return;
  }

  const activity = normalizeActivity({
    id: state.editingActivityId || uuid(),
    name: data.name,
    location: data.location,
    type: data.type,
    startDate: data.startDate,
    endDate: data.endDate,
    start: data.startDate,
    end: data.endDate,
    cost: data.cost,
    currency: data.currency,
    distance: data.distance,
    km: data.km,
    notes: data.notes
  });

  const previousActivities = [...state.currentTrip.activities];

  if (state.editingActivityId) {
    const index = state.currentTrip.activities.findIndex(
      (item) => String(item.id) === String(state.editingActivityId)
    );
    if (index >= 0) {
      state.currentTrip.activities[index] = activity;
    }
  } else {
    state.currentTrip.activities.push(activity);
  }

  state.currentTrip.activities = sortActivities(state.currentTrip.activities);

  const btn = document.getElementById('activity-submit-btn');
  const originalHtml = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-circle" class="w-4 h-4 animate-spin"></i> Saving...';
    refreshIcons();
  }

  try {
    await upsertActivity(state.currentTrip.id, activity);
    saveTripToCache(state.currentTrip);
    resetActivityForm();
    renderActivities();
    showToast('Activity saved.', 'success');
  } catch (error) {
    state.currentTrip.activities = previousActivities;
    renderActivities();
    console.error(error);
    showToast(error?.message || 'Failed to save activity.', 'error');
  } finally {
    if (btn && originalHtml) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
      refreshIcons();
    }
  }
}

function addActivity() {
  return saveActivity();
}

function editActivity(activityId) {
  if (isGuestView()) {
    showToast('This trip is shared (view-only).', 'info');
    return;
  }

  if (!state.currentTrip) return;

  const activity = state.currentTrip.activities.find(
    (item) => String(item.id) === String(activityId)
  );
  if (!activity) return;

  state.editingActivityId = activity.id;
  setActivityFormData(activity);

  const title = document.getElementById('activity-form-title');
  const cancelButton = document.getElementById('cancel-edit-btn');
  const addButton = document.querySelector('button[onclick="addActivity()"]');

  if (title) title.textContent = 'Edit activity';
  if (cancelButton) cancelButton.classList.remove('hidden');
  if (addButton) addButton.innerHTML = '<i data-lucide="save" class="w-4 h-4"></i>Save Activity';

  refreshIcons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteActivity(activityId) {
  if (isGuestView()) {
    showToast('This trip is shared (view-only).', 'info');
    return;
  }

  if (!state.currentTrip) return;

  const activity = state.currentTrip.activities.find(
    (item) => String(item.id) === String(activityId)
  );

  const confirmed = await openConfirmModal({
    title: 'Delete activity',
    message: `"${activity?.name || activity?.location || 'this activity'}" will be permanently deleted.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  const previousActivities = [...state.currentTrip.activities];

  state.currentTrip.activities = state.currentTrip.activities.filter(
    (item) => String(item.id) !== String(activityId)
  );

  try {
    await deleteActivityById(activityId);
    saveTripToCache(state.currentTrip);
    if (state.editingActivityId === activityId) resetActivityForm();
    renderActivities();
    showToast('Activity deleted.', 'success');
  } catch (error) {
    state.currentTrip.activities = previousActivities;
    renderActivities();
    console.error(error);
    showToast(error?.message || 'Failed to delete activity.', 'error');
  }
}

function moveActivity(activityId, direction) {
  if (!state.currentTrip) return;

  const activities = state.currentTrip.activities;
  const index = activities.findIndex(a => String(a.id) === String(activityId));
  if (index === -1) return;

  const newIndex = direction === 'up' ? index - 1 : index + 1;
  if (newIndex < 0 || newIndex >= activities.length) return;

  // Normalize sortOrder across all activities based on current positions,
  // ensuring values are contiguous and unique before swapping.
  activities.forEach((a, i) => { a.sortOrder = i; });

  // Swap sortOrder values
  activities[index].sortOrder = newIndex;
  activities[newIndex].sortOrder = index;

  // Re-sort and save
  state.currentTrip.activities = sortActivities(activities);
  renderActivities();

  const updates = [
    { id: activities[index].id, sortOrder: activities[index].sortOrder },
    { id: activities[newIndex].id, sortOrder: activities[newIndex].sortOrder }
  ];

  reorderActivities(state.currentTrip.id, updates).then(() => {
    saveTripToCache(state.currentTrip);
  }).catch(err => {
    console.error(err);
    showToast('Failed to save order.', 'error');
  });
}

let _activeTypeFilter = '';

function toggleTypeFilter(type) {
  _activeTypeFilter = type;

  // Update pill active states
  document.querySelectorAll('.type-filter-pill').forEach(btn => {
    const isActive = btn.dataset.type === type;
    btn.classList.toggle('border-primary-500', isActive);
    btn.classList.toggle('bg-primary-50', isActive);
    btn.classList.toggle('text-primary-700', isActive);
    btn.classList.toggle('dark:bg-primary-500/10', isActive);
    btn.classList.toggle('dark:text-primary-300', isActive);
    btn.classList.toggle('border-slate-200', !isActive);
    btn.classList.toggle('dark:border-slate-700', !isActive);
    btn.classList.toggle('bg-white', !isActive);
    btn.classList.toggle('dark:bg-slate-900', !isActive);
    btn.classList.toggle('text-slate-600', !isActive);
    btn.classList.toggle('dark:text-slate-300', !isActive);
  });

  filterActivities();
}

function filterActivities() {
  const query = (document.getElementById('activity-search')?.value || '').toLowerCase().trim();
  const clearBtn = document.getElementById('activity-search-clear');
  if (clearBtn) clearBtn.classList.toggle('hidden', !query);

  const container = document.getElementById('activities');
  if (!container || !state.currentTrip) return;

  const activities = sortActivities(state.currentTrip.activities);

  const filtered = activities.filter(a => {
    const matchesQuery = !query ||
      (a.name || '').toLowerCase().includes(query) ||
      (a.location || '').toLowerCase().includes(query) ||
      (a.notes || '').toLowerCase().includes(query) ||
      (a.type || '').toLowerCase().includes(query);

    const matchesType = !_activeTypeFilter || (a.type || 'other') === _activeTypeFilter;

    return matchesQuery && matchesType;
  });

  if (!filtered.length) {
    container.innerHTML = emptyState(
      'No activities match',
      query || _activeTypeFilter ? 'Try a different search or filter.' : 'Add your first activity to build the itinerary.',
      'search-x'
    );
    refreshIcons();
    // Keep header visible
    const header = document.getElementById('activities-header');
    if (header) header.classList.remove('hidden');
    return;
  }

  // Temporarily swap activities for rendering, then restore
  const original = state.currentTrip.activities;
  state.currentTrip.activities = filtered;
  renderActivities();
  state.currentTrip.activities = original;

  // Keep header visible and restore search input after re-render
  const header = document.getElementById('activities-header');
  if (header) header.classList.remove('hidden');
  const searchEl = document.getElementById('activity-search');
  if (searchEl) searchEl.value = query;
}

function clearActivitySearch() {
  const searchEl = document.getElementById('activity-search');
  if (searchEl) searchEl.value = '';
  _activeTypeFilter = '';
  toggleTypeFilter('');
  searchEl?.focus();
}

async function loadMoreActivitiesUI() {
  if (!state.currentTrip) return;

  const btn = document.getElementById('load-more-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-circle" class="w-4 h-4 animate-spin"></i> Loading...';
    refreshIcons();
  }

  try {
    const currentPage = state.currentTrip._pagination?.page || 1;
    const { activities, pagination } = await loadMoreActivities(state.currentTrip.id, currentPage);

    // Append new activities, avoiding duplicates
    const existingIds = new Set(state.currentTrip.activities.map(a => a.id));
    const newOnes = activities.filter(a => !existingIds.has(a.id));
    state.currentTrip.activities = [...state.currentTrip.activities, ...newOnes];
    state.currentTrip._pagination = pagination;

    saveTripToCache(state.currentTrip);
    renderActivities();
    showToast(`Loaded ${newOnes.length} more activities.`, 'success');
  } catch (err) {
    console.error(err);
    showToast(err?.message || 'Failed to load more activities.', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="chevrons-down" class="w-4 h-4"></i> Load more activities';
      refreshIcons();
    }
  }
}

window.loadMoreActivitiesUI = loadMoreActivitiesUI;
window.clearActivitySearch = clearActivitySearch;
window.toggleTypeFilter = toggleTypeFilter;

function toggleActivityDay(key) {
  if (!state.collapsedActivityDays) state.collapsedActivityDays = new Set();
  if (state.collapsedActivityDays.has(key)) {
    state.collapsedActivityDays.delete(key);
  } else {
    state.collapsedActivityDays.add(key);
  }
  renderActivities();
  const query = document.getElementById('activity-search')?.value || '';
  if (query || _activeTypeFilter) filterActivities();
}

function toggleAllActivityDays() {
  if (!state.collapsedActivityDays) state.collapsedActivityDays = new Set();

  const activities = sortActivities(state.currentTrip?.activities || []);
  const keys = new Set();
  activities.forEach(a => {
    if (!a.startDate) { keys.add('undated'); return; }
    const d = new Date(a.startDate);
    keys.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
  });

  const allCollapsed = [...keys].every(k => state.collapsedActivityDays.has(k));

  if (allCollapsed) {
    // Expand all
    keys.forEach(k => state.collapsedActivityDays.delete(k));
    const btn = document.getElementById('activity-collapse-all-btn');
    if (btn) btn.title = 'Collapse all';
  } else {
    // Collapse all
    keys.forEach(k => state.collapsedActivityDays.add(k));
    const btn = document.getElementById('activity-collapse-all-btn');
    if (btn) btn.title = 'Expand all';
  }

  renderActivities();
  const query = document.getElementById('activity-search')?.value || '';
  if (query || _activeTypeFilter) filterActivities();
}

window.toggleActivityDay = toggleActivityDay;
window.toggleAllActivityDays = toggleAllActivityDays;