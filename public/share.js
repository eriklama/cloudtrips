/* =========================
 * share.js
 * Share link creation, copying, and management.
 * Depends on: state.js, helpers.js, ui.js, api.js
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
        <div class="flex items-center gap-2">
          <button id="revoke-all-btn" class="hidden inline-flex items-center gap-1 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 transition">
            Revoke all
          </button>
          <button id="manage-shares-close" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
            <i data-lucide="x" class="w-5 h-5"></i>
          </button>
        </div>
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

    if (data.shares.length > 1) {
      overlay.querySelector('#revoke-all-btn').classList.remove('hidden');
    }

    overlay.querySelector('#revoke-all-btn').addEventListener('click', () => {
      disableAllShares(state.currentTrip.id, overlay);
    });

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

async function disableAllShares(tripId, modalOverlay) {
  const confirmed = await openConfirmModal({
    title: 'Revoke all share links',
    message: 'All active share links for this trip will stop working immediately.',
    confirmText: 'Revoke all',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    await apiPost(API.DISABLE_SHARE, { tripId });
    modalOverlay.remove();
    showToast('All share links revoked.', 'success');
  } catch (err) {
    showToast(err?.message || 'Failed to revoke all links.', 'error');
  }
}

/* =========================
 * GLOBAL EXPORTS
 * ========================= */

window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;
window.copyShareLink = copyShareLink;
window.openManageSharesModal = openManageSharesModal;
window.revokeShare = revokeShare;
window.disableAllShares = disableAllShares;
