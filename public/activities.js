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

    applySharedViewUi('trip-title', 'trip-title-hero');

    if (isGuestView()) {
      const shareBtn = document.querySelector('button[onclick="openShareModal()"]');
      if (shareBtn) shareBtn.style.display = 'none';
      const logoutBtn = document.getElementById('logout-button');
      if (logoutBtn) logoutBtn.style.display = 'none';
    }

    renderActivities();
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

  if (title) title.textContent = 'Add activity';
  if (cancelButton) cancelButton.classList.add('hidden');
  if (addButton) addButton.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i>Add Activity';

  refreshIcons();
}

function cancelEditActivity() {
  resetActivityForm();
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

  try {
    await saveTrip(state.currentTrip);
    resetActivityForm();
    renderActivities();
    showToast('Activity saved.', 'success');
  } catch (error) {
    console.error(error);
    showToast(error?.message || 'Failed to save activity.', 'error');
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

  state.currentTrip.activities = state.currentTrip.activities.filter(
    (item) => String(item.id) !== String(activityId)
  );

  try {
    await saveTrip(state.currentTrip);
    if (state.editingActivityId === activityId) resetActivityForm();
    renderActivities();
    showToast('Activity deleted.', 'success');
  } catch (error) {
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

  // Assign sortOrder to all activities if not set
  activities.forEach((a, i) => {
    if (a.sortOrder === undefined) a.sortOrder = i;
  });

  // Swap sortOrder values
  const temp = activities[index].sortOrder;
  activities[index].sortOrder = activities[newIndex].sortOrder;
  activities[newIndex].sortOrder = temp;

  // Re-sort and save
  state.currentTrip.activities = sortActivities(activities);
  renderActivities();

  saveTrip(state.currentTrip).catch(err => {
    console.error(err);
    showToast('Failed to save order.', 'error');
  });
}