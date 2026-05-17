/* =========================
 * export.js
 * CSV export and export dropdown.
 * Depends on: state.js, helpers.js, activities.js (_activeTypeFilter)
 * ========================= */

/* =========================
 * GET VISIBLE ACTIVITIES
 * Mirrors the filter logic in filterActivities() so we export
 * exactly what the user currently sees.
 * ========================= */

function getVisibleActivities() {
  const activities = sortActivities(state.currentTrip?.activities || []);
  const query = (document.getElementById('activity-search')?.value || '').toLowerCase().trim();
  const typeFilter = typeof _activeTypeFilter !== 'undefined' ? _activeTypeFilter : '';

  return activities.filter(a => {
    const matchesQuery = !query ||
      (a.name || '').toLowerCase().includes(query) ||
      (a.location || '').toLowerCase().includes(query) ||
      (a.notes || '').toLowerCase().includes(query) ||
      (a.type || '').toLowerCase().includes(query);

    const matchesType = !typeFilter || (a.type || 'other') === typeFilter;

    return matchesQuery && matchesType;
  });
}

/* =========================
 * DETECT PUBLIC MODE
 * In public share mode the server strips costs server-side (cost: 0,
 * currency: undefined). We detect this rather than storing shareMode.
 * ========================= */

function isPublicShareMode() {
  if (!isGuestView()) return false;
  const activities = state.currentTrip?.activities || [];
  // If all activities with any data have cost 0 and no currency, it's public mode
  const withData = activities.filter(a => a.name);
  if (!withData.length) return false;
  return withData.every(a => !a.currency || a.currency === '');
}

/* =========================
 * CSV EXPORT
 * ========================= */

function exportCsv() {
  if (!state.currentTrip) {
    showToast('Trip not loaded.', 'error');
    return;
  }

  const activities = getVisibleActivities();
  if (!activities.length) {
    showToast('No activities to export.', 'info');
    return;
  }

  const publicMode = isPublicShareMode();

  // Build header row
  const headers = publicMode
    ? ['Type', 'Name', 'Location', 'Start', 'End', 'Distance (km)', 'Notes']
    : ['Type', 'Name', 'Location', 'Start', 'End', 'Cost', 'Currency', 'Distance (km)', 'Notes'];

  // Build data rows
  const rows = activities.map(a => {
    const base = [
      csvCell(a.type || ''),
      csvCell(a.name || ''),
      csvCell(a.location || ''),
      csvCell(a.startDate ? formatDateTime(a.startDate) : ''),
      csvCell(a.endDate ? formatDateTime(a.endDate) : ''),
    ];

    if (!publicMode) {
      base.push(csvCell(a.cost || 0));
      base.push(csvCell(a.currency || ''));
    }

    base.push(csvCell(a.km || a.distance || 0));
    base.push(csvCell(a.notes || ''));

    return base.join(',');
  });

  const csv = [headers.join(','), ...rows].join('\r\n');
  const tripName = (state.currentTrip.name || 'trip').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  downloadText(csv, `${tripName}_activities.csv`, 'text/csv;charset=utf-8;');
  showToast('CSV downloaded.', 'success');
}

function csvCell(value) {
  const str = String(value ?? '');
  // Wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadText(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 100);
}

/* =========================
 * EXPORT DROPDOWN
 * Replaces the single Export button in renderHeaderNav with a
 * dropdown offering CSV and PDF (print) options.
 * ========================= */

function openExportDropdown(triggerBtn) {
  // Close any existing export dropdown
  document.getElementById('export-dropdown')?.remove();

  const dropdown = document.createElement('div');
  dropdown.id = 'export-dropdown';
  dropdown.className = 'absolute right-0 top-full mt-2 w-44 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden';

  const items = [
    {
      icon: 'file-spreadsheet',
      label: 'Export CSV',
      onClick: () => { closeExportDropdown(); exportCsv(); }
    },
    {
      icon: 'printer',
      label: 'Print / Save as PDF',
      onClick: () => { closeExportDropdown(); openPrintView(); }
    }
  ];

  dropdown.innerHTML = items.map(item => `
    <button
      class="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
      data-export-action="${item.icon}">
      <i data-lucide="${item.icon}" class="h-4 w-4 text-slate-500 dark:text-slate-400"></i>
      ${item.label}
    </button>
  `).join('');

  // Wire up clicks
  items.forEach((item, i) => {
    dropdown.querySelectorAll('button')[i].addEventListener('click', item.onClick);
  });

  // Position relative to trigger button's parent
  const wrapper = triggerBtn.closest('.export-btn-wrapper') || triggerBtn.parentElement;
  wrapper.style.position = 'relative';
  wrapper.appendChild(dropdown);
  refreshIcons();

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', closeExportDropdownOutside);
  }, 0);
}

function closeExportDropdown() {
  document.getElementById('export-dropdown')?.remove();
  document.removeEventListener('click', closeExportDropdownOutside);
}

function closeExportDropdownOutside(e) {
  const dropdown = document.getElementById('export-dropdown');
  if (dropdown && !dropdown.contains(e.target)) {
    closeExportDropdown();
  }
}

window.exportCsv = exportCsv;
window.openExportDropdown = openExportDropdown;
window.closeExportDropdown = closeExportDropdown;