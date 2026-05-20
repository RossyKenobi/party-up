/* ============================================
   Event Detail Sheet
   ============================================ */

import { store, getInitial, getAvatarColor } from '../utils/store.js';
import { formatDateFull, formatTime, REMINDER_OPTIONS } from '../utils/date.js';
import { showCreateEvent } from './create-event.js';

export function showEventDetail(eventId) {
  const overlay = document.getElementById('overlay-root');
  const ev = store.getEventById(eventId);
  if (!ev) return;

  const user = store.getUser();
  const isCreator = user && ev.creator.id === user.id;
  const isParticipant = store.isParticipant(eventId);
  const isAdmin = user && user.isAdmin;
  const reminderLabel = REMINDER_OPTIONS.find(r => r.value === ev.reminder)?.label || '无';

  overlay.innerHTML = `
    <div class="overlay modal-backdrop" id="event-detail-modal" style="position:fixed; inset:0; z-index:1000;">
      <div class="modal-sheet" style="max-height: 88%;">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="icon-btn" id="close-detail">✕</button>
          <h2>事件详情</h2>
          <div style="width: 36px;">
            ${isCreator ? `<button class="icon-btn" id="edit-event-btn" title="编辑">✎</button>` : ''}
          </div>
        </div>
        <div class="sheet-body">
          <!-- Category badge + Title -->
          <div style="margin-bottom: var(--space-lg);">
            <div class="badge" style="background: ${ev.category.color}20; color: ${ev.category.color}; margin-bottom: var(--space-sm);">
              ${ev.category.emoji} ${ev.category.name}
            </div>
            <h2 style="font-size: var(--font-xl); font-weight: 700; line-height: 1.3;">${ev.title}</h2>
          </div>

          <!-- Time -->
          <div class="detail-row" style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md) 0; border-top: 1px solid var(--divider);">
            <span style="font-size: 20px; width: 28px; text-align: center;">🕐</span>
            <div>
              <div style="font-weight: 500;">${formatDateFull(new Date(ev.startTime))}</div>
              <div style="color: var(--text-secondary); font-size: var(--font-sm); margin-top: 2px;">
                ${formatTime(ev.startTime)} — ${formatTime(ev.endTime)}
              </div>
            </div>
          </div>

          <!-- Location -->
          ${ev.location ? `
            <div class="detail-row" style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md) 0; border-top: 1px solid var(--divider);">
              <span style="font-size: 20px; width: 28px; text-align: center;">📍</span>
              <div style="font-weight: 500;">${ev.location}</div>
            </div>
          ` : ''}

          <!-- Reminder -->
          <div class="detail-row" style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md) 0; border-top: 1px solid var(--divider);">
            <span style="font-size: 20px; width: 28px; text-align: center;">🔔</span>
            <div style="font-weight: 500;">${reminderLabel}</div>
          </div>

          <!-- Participants -->
          <div style="padding: var(--space-md) 0; border-top: 1px solid var(--divider);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-md);">
              <span style="font-weight: 600;">参与者 (${ev.participantCount})</span>
            </div>
            <div class="participant-list" style="display: flex; flex-direction: column; gap: var(--space-sm);">
              ${ev.participants.map(p => `
                <div style="display: flex; align-items: center; gap: var(--space-md); padding: var(--space-sm) 0;">
                  <div class="avatar" style="background: ${p.avatarColor || 'var(--accent-bg)'}; color: #fff;">
                    ${p.initial || getInitial(p.nickName)}
                  </div>
                  <div style="flex: 1;">
                    <div style="font-weight: 500; font-size: var(--font-sm);">${p.nickName}</div>
                    ${p.id === ev.creator.id ? '<span style="font-size: var(--font-xs); color: var(--accent); font-weight: 500;">发起者</span>' : ''}
                  </div>
                  ${user && p.id === user.id && p.id !== ev.creator.id ? `
                    <button class="btn btn-ghost leave-btn" data-user-id="${p.id}" style="font-size: var(--font-xs); color: var(--danger); padding: 4px 8px;">退出</button>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Action -->
          <div style="padding: var(--space-md) 0; border-top: 1px solid var(--divider);">
            ${!user ? `
              <button class="btn btn-primary btn-lg btn-block" id="login-to-join">登录后加入</button>
            ` : isParticipant ? `
              <div style="text-align: center; color: var(--text-secondary); font-size: var(--font-sm); padding: var(--space-sm);">
                ✓ 已参与此活动
              </div>
            ` : `
              <button class="btn btn-primary btn-lg btn-block" id="join-event-btn">
                🙋 我要加入
              </button>
            `}

            ${(isAdmin && !isCreator) ? `
              <button class="btn btn-danger btn-block" id="admin-delete-btn" style="margin-top: var(--space-sm);">
                管理员删除
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  // Close
  overlay.querySelector('#close-detail').addEventListener('click', () => {
    overlay.innerHTML = '';
  });

  overlay.querySelector('#event-detail-modal').addEventListener('click', (e) => {
    if (e.target.id === 'event-detail-modal') overlay.innerHTML = '';
  });

  // Edit
  if (isCreator) {
    overlay.querySelector('#edit-event-btn')?.addEventListener('click', () => {
      overlay.innerHTML = '';
      showCreateEvent(ev);
    });
  }

  // Join
  overlay.querySelector('#join-event-btn')?.addEventListener('click', () => {
    store.joinEvent(eventId);
    showEventDetail(eventId); // Re-render
  });

  // Leave
  overlay.querySelectorAll('.leave-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      store.leaveEvent(eventId);
      showEventDetail(eventId); // Re-render
    });
  });

  // Admin delete
  overlay.querySelector('#admin-delete-btn')?.addEventListener('click', () => {
    if (confirm('管理员权限：确定要删除此事件吗？')) {
      store.deleteEvent(eventId);
      overlay.innerHTML = '';
    }
  });

  // Login to join
  overlay.querySelector('#login-to-join')?.addEventListener('click', () => {
    overlay.innerHTML = '';
    // Import dynamically to avoid circular dep
    import('./calendar.js').then(m => m.showNicknameInput());
  });
}
