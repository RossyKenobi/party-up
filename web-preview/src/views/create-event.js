/* ============================================
   Create / Edit Event Sheet
   ============================================ */

import { store } from '../utils/store.js';
import { CATEGORIES, REMINDER_OPTIONS, formatTime } from '../utils/date.js';

export function showCreateEvent(editEvent = null) {
  const overlay = document.getElementById('overlay-root');
  const isEdit = !!editEvent;

  // Default to tomorrow 10:00-11:00 for new events
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setDate(defaultStart.getDate() + (isEdit ? 0 : 1));
  defaultStart.setHours(10, 0, 0, 0);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setHours(11, 0, 0, 0);

  const ev = editEvent || {
    title: '',
    startTime: defaultStart.toISOString(),
    endTime: defaultEnd.toISOString(),
    location: '',
    category: CATEGORIES[0],
    reminder: 15,
  };

  const startDate = new Date(ev.startTime);
  const endDate = new Date(ev.endTime);

  const formatDateForInput = (d) => {
    const dt = new Date(d);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  };
  const formatTimeForInput = (d) => {
    const dt = new Date(d);
    return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
  };

  overlay.innerHTML = `
    <div class="overlay modal-backdrop" id="create-event-modal" style="position:fixed; inset:0; z-index:1000;">
      <div class="modal-sheet" style="max-height: 90%;">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <button class="btn btn-ghost" id="cancel-create">取消</button>
          <h2>${isEdit ? '编辑事件' : '创建事件'}</h2>
          <button class="btn btn-primary" id="save-event" style="padding: 6px 16px;">
            ${isEdit ? '保存' : '创建'}
          </button>
        </div>
        <div class="sheet-body">
          <!-- Title -->
          <div class="form-group">
            <input class="form-input" id="event-title" placeholder="事件名称" value="${ev.title}" style="font-size: var(--font-md); font-weight: 600;" />
          </div>

          <!-- Category -->
          <div class="form-group">
            <label class="form-label">分类</label>
            <div class="category-picker" id="category-picker" style="display: flex; gap: 8px;">
              ${CATEGORIES.map(cat => `
                <button class="cat-chip ${cat.id === ev.category.id ? 'active' : ''}"
                        data-cat-id="${cat.id}"
                        style="flex: 1; padding: 10px; border-radius: var(--radius-md); border: 2px solid ${cat.id === ev.category.id ? cat.color : 'var(--border)'}; background: ${cat.id === ev.category.id ? cat.color + '20' : 'var(--bg-card)'}; cursor: pointer; font-size: var(--font-sm); text-align: center; transition: all 0.15s; font-family: var(--font-family);">
                  <div style="font-size: 20px; margin-bottom: 4px;">${cat.emoji}</div>
                  <div style="color: ${cat.id === ev.category.id ? cat.color : 'var(--text-secondary)'}; font-weight: 500;">${cat.name}</div>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Date & Time -->
          <div class="form-group">
            <label class="form-label">开始时间</label>
            <div style="display: flex; gap: 8px;">
              <input class="form-input" type="date" id="start-date" value="${formatDateForInput(ev.startTime)}" style="flex: 1;" />
              <input class="form-input" type="time" id="start-time" value="${formatTimeForInput(ev.startTime)}" style="flex: 0 0 120px;" />
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">结束时间</label>
            <div style="display: flex; gap: 8px;">
              <input class="form-input" type="date" id="end-date" value="${formatDateForInput(ev.endTime)}" style="flex: 1;" />
              <input class="form-input" type="time" id="end-time" value="${formatTimeForInput(ev.endTime)}" style="flex: 0 0 120px;" />
            </div>
          </div>

          <!-- Location -->
          <div class="form-group">
            <label class="form-label">地点</label>
            <input class="form-input" id="event-location" placeholder="输入活动地点" value="${ev.location}" />
          </div>

          <!-- Reminder -->
          <div class="form-group">
            <label class="form-label">提醒</label>
            <select class="form-input" id="event-reminder" style="appearance: auto;">
              ${REMINDER_OPTIONS.map(opt => `
                <option value="${opt.value}" ${opt.value === ev.reminder ? 'selected' : ''}>${opt.label}</option>
              `).join('')}
            </select>
          </div>

          ${isEdit ? `
            <button class="btn btn-danger btn-block" id="delete-event-btn" style="margin-top: var(--space-lg);">
              删除事件
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  let selectedCatId = ev.category.id;

  // Category selection
  overlay.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      selectedCatId = chip.dataset.catId;
      overlay.querySelectorAll('.cat-chip').forEach(c => {
        const cat = CATEGORIES.find(x => x.id === c.dataset.catId);
        const isActive = c.dataset.catId === selectedCatId;
        c.style.borderColor = isActive ? cat.color : 'var(--border)';
        c.style.background = isActive ? cat.color + '20' : 'var(--bg-card)';
        c.querySelector('div:last-child').style.color = isActive ? cat.color : 'var(--text-secondary)';
        c.classList.toggle('active', isActive);
      });
    });
  });

  // Cancel
  overlay.querySelector('#cancel-create').addEventListener('click', () => {
    overlay.innerHTML = '';
  });

  // Close on backdrop click
  overlay.querySelector('#create-event-modal').addEventListener('click', (e) => {
    if (e.target.id === 'create-event-modal') overlay.innerHTML = '';
  });

  // Save
  overlay.querySelector('#save-event').addEventListener('click', () => {
    const title = overlay.querySelector('#event-title').value.trim();
    if (!title) {
      overlay.querySelector('#event-title').style.borderColor = 'var(--danger)';
      return;
    }

    const startDateVal = overlay.querySelector('#start-date').value;
    const startTimeVal = overlay.querySelector('#start-time').value;
    const endDateVal = overlay.querySelector('#end-date').value;
    const endTimeVal = overlay.querySelector('#end-time').value;
    const location = overlay.querySelector('#event-location').value.trim();
    const reminder = parseInt(overlay.querySelector('#event-reminder').value);
    const category = CATEGORIES.find(c => c.id === selectedCatId);

    const startTime = new Date(`${startDateVal}T${startTimeVal}:00`).toISOString();
    const endTime = new Date(`${endDateVal}T${endTimeVal}:00`).toISOString();

    if (new Date(endTime) <= new Date(startTime)) {
      alert('结束时间必须晚于开始时间');
      return;
    }

    const data = { title, startTime, endTime, location, category, reminder };

    if (isEdit) {
      store.updateEvent(editEvent.id, data);
    } else {
      store.createEvent(data);
    }

    overlay.innerHTML = '';
  });

  // Delete
  if (isEdit) {
    overlay.querySelector('#delete-event-btn').addEventListener('click', () => {
      if (confirm('确定要删除这个事件吗？所有参与者会收到通知。')) {
        store.deleteEvent(editEvent.id);
        overlay.innerHTML = '';
      }
    });
  }
}
