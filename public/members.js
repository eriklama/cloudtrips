/* =========================
 * members.js
 * Trip member management — invite, list, remove.
 * Depends on: state.js, helpers.js, api.js
 * ========================= */

async function openMembersModal() {
  if (!state.currentTrip) {
    showToast('Trip not loaded.', 'error');
    return;
  }

  const tripId = state.currentTrip.id;

  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 dark:bg-slate-950/60 p-4';
  overlay.innerHTML = `
    <div class="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl flex flex-col max-h-[85vh]">
      <div class="flex items-center justify-between mb-5">
        <h2 class="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">Members</h2>
        <button id="members-close" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
          <i data-lucide="x" class="w-5 h-5"></i>
        </button>
      </div>
      <div id="members-body" class="flex-1 overflow-y-auto">
        <div class="flex items-center justify-center py-8 text-slate-400">
          <i data-lucide="loader" class="h-5 w-5 animate-spin"></i>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  refreshIcons();

  function close() {
    overlay.remove();
    document.removeEventListener('click', outsideClick);
  }

  function outsideClick(e) {
    if (e.target === overlay) close();
  }

  overlay.querySelector('#members-close').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  async function render() {
    const body = overlay.querySelector('#members-body');
    try {
      const data = await apiGet(`/api/getTripMembers?tripId=${encodeURIComponent(tripId)}`);
      const { isOwner, owner, members, pendingInvites } = data;

      body.innerHTML = `
        <!-- Owner -->
        <div class="mb-4">
          <div class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">Owner</div>
          <div class="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
            <div class="flex items-center gap-2">
              <i data-lucide="crown" class="h-4 w-4 text-amber-400"></i>
              <span class="text-sm font-medium text-slate-900 dark:text-slate-100">${escapeHtml(owner?.email || '—')}</span>
            </div>
            <span class="text-xs text-slate-400">Owner</span>
          </div>
        </div>

        <!-- Members -->
        ${members.length ? `
          <div class="mb-4">
            <div class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">Members</div>
            <div class="space-y-1.5" id="members-list">
              ${members.map(m => `
                <div class="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <i data-lucide="user" class="h-4 w-4 text-slate-400"></i>
                    <span class="text-sm text-slate-900 dark:text-slate-100">${escapeHtml(m.email)}</span>
                  </div>
                  ${isOwner ? `
                    <button onclick="removeMemberFromModal('${escapeHtml(m.user_id)}', '${escapeHtml(tripId)}')"
                      class="text-slate-400 hover:text-red-400 transition" title="Remove member">
                      <i data-lucide="user-x" class="h-4 w-4"></i>
                    </button>
                  ` : `<span class="text-xs text-slate-400">Editor</span>`}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Pending invites -->
        ${pendingInvites.length ? `
          <div class="mb-4">
            <div class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">Pending invites</div>
            <div class="space-y-1.5">
              ${pendingInvites.map(inv => `
                <div class="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-2.5">
                  <div class="flex items-center gap-2">
                    <i data-lucide="mail" class="h-4 w-4 text-slate-400"></i>
                    <span class="text-sm text-slate-500 dark:text-slate-400">${escapeHtml(inv.email)}</span>
                  </div>
                  ${isOwner ? `
                    <button onclick="cancelInviteFromModal('${escapeHtml(inv.id)}', '${escapeHtml(tripId)}')"
                      class="text-slate-400 hover:text-red-400 transition" title="Cancel invite">
                      <i data-lucide="x" class="h-4 w-4"></i>
                    </button>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Invite form — owner only -->
        ${isOwner ? `
          <div class="pt-2 border-t border-slate-200 dark:border-slate-700">
            <div class="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2 mt-3">Invite by email</div>
            <div class="flex gap-2">
              <input id="invite-email" type="email" placeholder="colleague@example.com"
                class="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 placeholder-slate-400" />
              <button id="invite-send-btn" onclick="sendInviteFromModal('${escapeHtml(tripId)}')"
                class="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 transition whitespace-nowrap">
                <i data-lucide="send" class="h-3.5 w-3.5"></i>
                Invite
              </button>
            </div>
            <p class="text-xs text-slate-400 dark:text-slate-500 mt-2">They'll receive an email to accept the invite. They need a CloudTrips account.</p>
          </div>
        ` : `
          <div class="pt-4 border-t border-slate-200 dark:border-slate-700 text-center">
            <button onclick="leaveTrip('${escapeHtml(tripId)}')"
              class="inline-flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-500/20 transition">
              <i data-lucide="log-out" class="h-4 w-4"></i>
              Leave this trip
            </button>
          </div>
        `}
      `;
      refreshIcons();
    } catch (err) {
      body.innerHTML = `<div class="py-6 text-center text-red-400 text-sm">${escapeHtml(err?.message || 'Failed to load members.')}</div>`;
    }
  }

  // Expose modal actions globally so onclick handlers work
  window._membersModalRender = render;
  window._membersModalTripId = tripId;

  await render();
}

async function sendInviteFromModal(tripId) {
  const input = document.getElementById('invite-email');
  const btn = document.getElementById('invite-send-btn');
  const email = input?.value?.trim();

  if (!email) {
    showToast('Please enter an email address.', 'info');
    input?.focus();
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  try {
    await apiPost('/api/inviteMember', { tripId, email });
    showToast(`Invite sent to ${email}.`, 'success');
    if (input) input.value = '';
    if (window._membersModalRender) await window._membersModalRender();
  } catch (err) {
    showToast(err?.message || 'Failed to send invite.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<i data-lucide="send" class="h-3.5 w-3.5"></i>Invite'; refreshIcons(); }
  }
}

async function removeMemberFromModal(userId, tripId) {
  const confirmed = await openConfirmModal({
    title: 'Remove member',
    message: 'This person will lose access to the trip.',
    confirmText: 'Remove',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    await apiPost('/api/removeMember', { tripId, memberId: userId });
    showToast('Member removed.', 'success');
    if (window._membersModalRender) await window._membersModalRender();
  } catch (err) {
    showToast(err?.message || 'Failed to remove member.', 'error');
  }
}

async function cancelInviteFromModal(inviteId, tripId) {
  try {
    await apiPost('/api/removeMember', { tripId, inviteId });
    showToast('Invite cancelled.', 'success');
    if (window._membersModalRender) await window._membersModalRender();
  } catch (err) {
    showToast(err?.message || 'Failed to cancel invite.', 'error');
  }
}

async function leaveTrip(tripId) {
  const confirmed = await openConfirmModal({
    title: 'Leave trip',
    message: 'You will lose access to this trip.',
    confirmText: 'Leave',
    cancelText: 'Cancel',
    danger: true
  });
  if (!confirmed) return;

  try {
    const user = JSON.parse(localStorage.getItem('cloudtrips_auth_user') || '{}');
    await apiPost('/api/removeMember', { tripId, memberId: user.id });
    showToast('You have left the trip.', 'success');
    window.location.href = '/';
  } catch (err) {
    showToast(err?.message || 'Failed to leave trip.', 'error');
  }
}

window.openMembersModal = openMembersModal;
window.sendInviteFromModal = sendInviteFromModal;
window.removeMemberFromModal = removeMemberFromModal;
window.cancelInviteFromModal = cancelInviteFromModal;
window.leaveTrip = leaveTrip;
