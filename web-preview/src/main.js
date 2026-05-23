/* ============================================
   PARTY-UP — Main Application Entry
   ============================================ */

import './styles/base.css';
import './styles/calendar.css';
import { store } from './utils/store.js';
import { renderCalendarPage } from './views/calendar.js';
import { renderMyPage } from './views/my-page.js';
import { showCreateEvent } from './views/create-event.js';
import { showEventDetail } from './views/event-detail.js';

// ── Global state ──
let currentTab = 'calendar';

// ── Init ──
function init() {
  // Apply saved theme
  document.documentElement.setAttribute('data-theme', store.getTheme());

  // Seed demo data on first load
  store.seedDemoData();

  // Render initial UI
  renderTabBar();
  navigateTo('calendar');

  // Listen for store changes
  store.subscribe(() => {
    if (currentTab === 'calendar') renderCalendarPage();
    if (currentTab === 'my') renderMyPage();
  });
}

// ── Tab Bar ──
function renderTabBar() {
  const tabBar = document.getElementById('tab-bar');
  tabBar.innerHTML = `
    <button class="tab-item ${currentTab === 'calendar' ? 'active' : ''}" data-tab="calendar">
      <span class="tab-icon">📅</span>
      <span class="tab-label">日历</span>
    </button>
    <button class="tab-item ${currentTab === 'my' ? 'active' : ''}" data-tab="my">
      <span class="tab-icon">👤</span>
      <span class="tab-label">我的</span>
    </button>
  `;

  tabBar.querySelectorAll('.tab-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab !== currentTab) {
        currentTab = tab;
        renderTabBar();
        navigateTo(tab);
      }
    });
  });
}

// ── Navigation ──
function navigateTo(page) {
  const content = document.getElementById('app-content');
  const header = document.getElementById('app-header');
  content.innerHTML = '';
  header.innerHTML = '';

  switch (page) {
    case 'calendar':
      renderCalendarPage();
      break;
    case 'my':
      renderMyPage();
      break;
  }
}

// ── Expose global navigation helpers ──
window.__app = {
  showCreateEvent: (editEvent) => showCreateEvent(editEvent),
  showEventDetail: (eventId) => showEventDetail(eventId),
  navigateTo,
  switchTab(tab) {
    currentTab = tab;
    renderTabBar();
    navigateTo(tab);
  },
};

// ── Start ──
document.addEventListener('DOMContentLoaded', init);
