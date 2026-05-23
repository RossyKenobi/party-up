/* ============================================
   Calendar Page — Week / Month / Year Views
   ============================================ */

import {
  getWeekDates, getWeekStart, isSameDay, isToday, formatTime,
  getMonthGrid, getMonthName, getTimelinePosition, getNowLinePosition,
  DAY_NAMES_SHORT, MONTH_NAMES, eventOnDate,
} from '../utils/date.js';
import { store } from '../utils/store.js';

let selectedDate = new Date();
let currentView = 'week'; // 'week' | 'month' | 'year'
let displayYear = new Date().getFullYear();
let displayMonth = new Date().getMonth();

// Touch tracking
let touchStartX = 0;
let touchStartY = 0;
let touchMoved = false;

export function renderCalendarPage() {
  const header = document.getElementById('app-header');
  const content = document.getElementById('app-content');

  if (currentView === 'week') {
    renderWeekView(header, content);
  } else if (currentView === 'month') {
    renderMonthView(header, content);
  } else if (currentView === 'year') {
    renderYearView(header, content);
  }
}

// ── Switch view ──
function switchView(view, opts = {}) {
  currentView = view;
  if (opts.year !== undefined) displayYear = opts.year;
  if (opts.month !== undefined) displayMonth = opts.month;
  if (opts.date) selectedDate = new Date(opts.date);
  renderCalendarPage();
}

// ═══════════════════════════════════════════
//  WEEK VIEW
// ═══════════════════════════════════════════
function renderWeekView(header, content) {
  const weekDates = getWeekDates(selectedDate);
  const monthIdx = selectedDate.getMonth();
  const year = selectedDate.getFullYear();

  // Header
  header.innerHTML = `
    <div class="header-left">
      <span class="month-label" id="week-month-btn">${getMonthName(monthIdx)} ${year}</span>
    </div>
    <div class="header-right">
      <button class="icon-btn" id="today-btn" title="回到今天">⊙</button>
      <button class="icon-btn" id="create-btn" title="创建事件">＋</button>
    </div>
  `;

  // Week dates strip + day timeline
  content.innerHTML = `
    <div class="week-view" id="week-view-container">
      <div class="week-days-row">
        ${DAY_NAMES_SHORT.map((name, i) => {
          const dayIdx = (i + 1) % 7; // Mon=1..Sun=0
          return `<div class="week-day-label">${DAY_NAMES_SHORT[dayIdx]}</div>`;
        }).join('')}
      </div>
      <div class="week-dates-row" id="week-dates-row">
        ${weekDates.map(d => {
          const events = store.getEventsForDate(d);
          const dots = events.slice(0, 3).map(e =>
            `<span class="event-dot" style="background:${e.category.color}"></span>`
          ).join('');
          return `
            <div class="week-date-cell ${isToday(d) ? 'today' : ''} ${isSameDay(d, selectedDate) ? 'selected' : ''}"
                 data-date="${d.toISOString()}">
              <div class="week-date-num">${d.getDate()}</div>
              <div class="event-dots">${dots}</div>
            </div>
          `;
        }).join('')}
      </div>
      <div class="day-timeline" id="day-timeline" style="height: calc(100vh - 250px);">
        ${renderTimeline(selectedDate)}
      </div>
    </div>
  `;

  // ── Event listeners ──
  header.querySelector('#week-month-btn').addEventListener('click', () => {
    displayMonth = selectedDate.getMonth();
    displayYear = selectedDate.getFullYear();
    switchView('month');
  });

  header.querySelector('#today-btn').addEventListener('click', () => {
    selectedDate = new Date();
    renderCalendarPage();
  });

  header.querySelector('#create-btn').addEventListener('click', () => {
    if (!store.isLoggedIn()) {
      showLoginPrompt();
      return;
    }
    window.__app.showCreateEvent();
  });

  // Date cell clicks
  content.querySelectorAll('.week-date-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      selectedDate = new Date(cell.dataset.date);
      renderCalendarPage();
    });
  });

  // Timeline event clicks
  content.querySelectorAll('.timeline-event').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const eventId = el.dataset.eventId;
      if (!store.isLoggedIn()) {
        showLoginPrompt();
        return;
      }
      window.__app.showEventDetail(eventId);
    });
  });

  // Swipe on week dates row
  const weekRow = content.querySelector('#week-dates-row');
  setupSwipe(weekRow, {
    onSwipeLeft: () => {
      selectedDate.setDate(selectedDate.getDate() + 7);
      renderCalendarPage();
    },
    onSwipeRight: () => {
      selectedDate.setDate(selectedDate.getDate() - 7);
      renderCalendarPage();
    },
  });

  // Swipe on timeline for day change
  const timeline = content.querySelector('#day-timeline');
  setupSwipe(timeline, {
    onSwipeLeft: () => {
      selectedDate.setDate(selectedDate.getDate() + 1);
      renderCalendarPage();
    },
    onSwipeRight: () => {
      selectedDate.setDate(selectedDate.getDate() - 1);
      renderCalendarPage();
    },
  });

  // Scroll timeline to current time or 8am
  requestAnimationFrame(() => {
    const tl = document.getElementById('day-timeline');
    if (tl) {
      if (isToday(selectedDate)) {
        const nowPos = getNowLinePosition(60);
        tl.scrollTop = Math.max(0, nowPos - 100);
      } else {
        tl.scrollTop = 8 * 60; // 8am
      }
    }
  });
}

// ── Render timeline for a specific date ──
function renderTimeline(date) {
  const events = store.getEventsForDate(date);
  const hourHeight = 60;
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const nowLine = isToday(date)
    ? `<div class="timeline-now-line" style="top:${getNowLinePosition(hourHeight)}px"></div>`
    : '';

  const eventBlocks = events.map(ev => {
    const { top, height } = getTimelinePosition(ev.startTime, ev.endTime, hourHeight);
    const catColor = ev.category.color;
    const darkText = isDarkColor(catColor) ? '#fff' : '#3D3B38';
    return `
      <div class="timeline-event" data-event-id="${ev.id}"
           style="top:${top}px; height:${height}px; background:${catColor}20; border-left:3px solid ${catColor}; color:${ev.category.color};">
        <div class="event-title" style="color:${catColor}">${ev.category.emoji} ${ev.title}</div>
        <div class="event-time" style="color:${catColor}; opacity:0.7">${formatTime(ev.startTime)} - ${formatTime(ev.endTime)}</div>
        ${height > 50 ? `
          <div class="event-meta">
            <span class="avatar avatar-sm" style="background:${ev.creator.avatarColor}; color:#fff; width:18px; height:18px; font-size:9px;">${ev.creator.initial}</span>
            <span style="font-size:10px; opacity:0.7">${ev.participantCount}人参与</span>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="timeline-grid" style="height:${24 * hourHeight}px; margin-top: 10px; margin-bottom: 10px;">
      ${hours.map(h => `
        <div class="timeline-hour">
          <span class="timeline-hour-label">${String(h).padStart(2, '0')}:00</span>
        </div>
      `).join('')}
      <div style="position: absolute; top: ${24 * hourHeight}px; width: 100%;">
        <span class="timeline-hour-label">24:00</span>
      </div>
      ${nowLine}
      ${eventBlocks}
    </div>
  `;
}

// ═══════════════════════════════════════════
//  MONTH VIEW
// ═══════════════════════════════════════════
function renderMonthView(header, content) {
  const days = getMonthGrid(displayYear, displayMonth);

  header.innerHTML = `
    <div class="header-left">
      <button class="icon-btn" id="month-back-btn">‹</button>
    </div>
    <div class="header-title">${getMonthName(displayMonth)} ${displayYear}</div>
    <div class="header-right">
      <button class="icon-btn" id="month-fwd-btn">›</button>
      <button class="icon-btn" id="month-year-btn" title="年视图">☰</button>
    </div>
  `;

  const dayLabels = [1, 2, 3, 4, 5, 6, 0].map(i => DAY_NAMES_SHORT[i]);

  content.innerHTML = `
    <div class="month-view fade-in">
      <div class="month-grid">
        ${dayLabels.map(name => `<div class="month-day-label">${name}</div>`).join('')}
        ${days.map(({ date, currentMonth }) => {
          const events = store.getEventsForDate(date);
          const dots = events.slice(0, 3).map(e =>
            `<span class="event-dot" style="background:${e.category.color}"></span>`
          ).join('');
          return `
            <div class="month-date-cell ${currentMonth ? '' : 'other-month'} ${isToday(date) ? 'today' : ''}"
                 data-date="${date.toISOString()}">
              <div class="date-num">${date.getDate()}</div>
              <div class="month-event-dots">${dots}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Navigation
  header.querySelector('#month-back-btn').addEventListener('click', () => {
    displayMonth--;
    if (displayMonth < 0) { displayMonth = 11; displayYear--; }
    renderCalendarPage();
  });

  header.querySelector('#month-fwd-btn').addEventListener('click', () => {
    displayMonth++;
    if (displayMonth > 11) { displayMonth = 0; displayYear++; }
    renderCalendarPage();
  });

  header.querySelector('#month-year-btn').addEventListener('click', () => {
    switchView('year');
  });

  // Click date → week view
  content.querySelectorAll('.month-date-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      selectedDate = new Date(cell.dataset.date);
      switchView('week');
    });
  });

  // Swipe to change month
  setupSwipe(content.querySelector('.month-view'), {
    onSwipeLeft: () => {
      displayMonth++;
      if (displayMonth > 11) { displayMonth = 0; displayYear++; }
      renderCalendarPage();
    },
    onSwipeRight: () => {
      displayMonth--;
      if (displayMonth < 0) { displayMonth = 11; displayYear--; }
      renderCalendarPage();
    },
    onSwipeUp: () => switchView('year'),
  });
}

// ═══════════════════════════════════════════
//  YEAR VIEW
// ═══════════════════════════════════════════
function renderYearView(header, content) {
  header.innerHTML = `
    <div class="header-left">
      <button class="icon-btn" id="year-back-btn">‹</button>
    </div>
    <div class="header-title">${displayYear}</div>
    <div class="header-right">
      <button class="icon-btn" id="year-fwd-btn">›</button>
    </div>
  `;

  const today = new Date();
  const months = Array.from({ length: 12 }, (_, i) => i);

  content.innerHTML = `
    <div class="year-view fade-in">
      <div class="year-grid">
        ${months.map(m => {
          const isCurrent = displayYear === today.getFullYear() && m === today.getMonth();
          const grid = getMonthGrid(displayYear, m);
          const dayHeaders = ['一', '二', '三', '四', '五', '六', '日'];

          return `
            <div class="year-month-card ${isCurrent ? 'current-month' : ''}" data-month="${m}">
              <div class="ym-title">${MONTH_NAMES[m]}</div>
              <div class="year-mini-grid">
                ${dayHeaders.map(d => `<div class="mini-day mini-day-header">${d}</div>`).join('')}
                ${grid.slice(0, 42).map(({ date, currentMonth }) => {
                  if (!currentMonth) return '<div class="mini-day"></div>';
                  const events = store.getEventsForDate(date);
                  const isTodayDay = isToday(date);
                  return `<div class="mini-day ${isTodayDay ? 'today' : ''} ${events.length ? 'has-event' : ''}">${date.getDate()}</div>`;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  // Navigation
  header.querySelector('#year-back-btn').addEventListener('click', () => {
    displayYear--;
    renderCalendarPage();
  });

  header.querySelector('#year-fwd-btn').addEventListener('click', () => {
    displayYear++;
    renderCalendarPage();
  });

  // Click month → month view
  content.querySelectorAll('.year-month-card').forEach(card => {
    card.addEventListener('click', () => {
      displayMonth = parseInt(card.dataset.month);
      switchView('month');
    });
  });
}

// ═══════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════

function setupSwipe(el, { onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown }) {
  if (!el) return;
  let startX, startY;

  el.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchend', (e) => {
    if (!startX) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < 40 && absDy < 40) return; // too small

    if (absDx > absDy) {
      // Horizontal
      if (dx < -40 && onSwipeLeft) onSwipeLeft();
      else if (dx > 40 && onSwipeRight) onSwipeRight();
    } else {
      // Vertical
      if (dy < -40 && onSwipeUp) onSwipeUp();
      else if (dy > 40 && onSwipeDown) onSwipeDown();
    }
    startX = null;
    startY = null;
  }, { passive: true });

  // Mouse swipe support for desktop
  el.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
  });

  el.addEventListener('mouseup', (e) => {
    if (!startX) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < 40 && absDy < 40) return;

    if (absDx > absDy) {
      if (dx < -40 && onSwipeLeft) onSwipeLeft();
      else if (dx > 40 && onSwipeRight) onSwipeRight();
    } else {
      if (dy < -40 && onSwipeUp) onSwipeUp();
      else if (dy > 40 && onSwipeDown) onSwipeDown();
    }
    startX = null;
    startY = null;
  });
}

function isDarkColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function showLoginPrompt() {
  const overlay = document.getElementById('overlay-root');
  overlay.innerHTML = `
    <div class="overlay modal-backdrop" id="login-prompt" style="position:fixed; inset:0; z-index:1000;">
      <div class="modal-sheet" style="max-height: 320px;">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <h2>需要登录</h2>
          <button class="icon-btn" id="close-login-prompt">✕</button>
        </div>
        <div class="sheet-body" style="text-align:center; padding: 20px;">
          <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: var(--font-sm);">
            登录后即可查看事件详情、创建和加入活动
          </p>
          <button class="btn btn-primary btn-lg btn-block" id="go-login-btn">
            微信一键登录
          </button>
        </div>
      </div>
    </div>
  `;

  overlay.querySelector('#close-login-prompt').addEventListener('click', () => {
    overlay.innerHTML = '';
  });

  overlay.querySelector('#login-prompt').addEventListener('click', (e) => {
    if (e.target.id === 'login-prompt') overlay.innerHTML = '';
  });

  overlay.querySelector('#go-login-btn').addEventListener('click', () => {
    overlay.innerHTML = '';
    // Simulate login: ask for nickname
    showNicknameInput();
  });
}

function showNicknameInput() {
  const overlay = document.getElementById('overlay-root');
  overlay.innerHTML = `
    <div class="overlay modal-backdrop" id="nickname-modal" style="position:fixed; inset:0; z-index:1000;">
      <div class="modal-sheet" style="max-height: 320px;">
        <div class="sheet-handle"></div>
        <div class="sheet-header">
          <h2>设置昵称</h2>
          <button class="icon-btn" id="close-nick">✕</button>
        </div>
        <div class="sheet-body">
          <div class="form-group">
            <label class="form-label">你的昵称</label>
            <input class="form-input" id="nick-input" placeholder="输入昵称" maxlength="20" autofocus />
          </div>
          <button class="btn btn-primary btn-lg btn-block" id="confirm-nick-btn" style="margin-top: 12px;">确认</button>
        </div>
      </div>
    </div>
  `;

  overlay.querySelector('#close-nick').addEventListener('click', () => {
    overlay.innerHTML = '';
  });

  overlay.querySelector('#confirm-nick-btn').addEventListener('click', () => {
    const name = overlay.querySelector('#nick-input').value.trim();
    if (!name) return;
    store.login(name);
    overlay.innerHTML = '';
    renderCalendarPage();
  });

  overlay.querySelector('#nick-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      overlay.querySelector('#confirm-nick-btn').click();
    }
  });
}

// Export for login prompt access from other modules
export { showLoginPrompt, showNicknameInput };
