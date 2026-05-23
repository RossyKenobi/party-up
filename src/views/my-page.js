/* ============================================
   "My" Page — Profile & Settings
   ============================================ */

import { store } from '../utils/store.js';
import { showNicknameInput } from './calendar.js';
import { renderMyEvents } from './my-events.js';

export function renderMyPage() {
  const header = document.getElementById('app-header');
  const content = document.getElementById('app-content');
  const user = store.getUser();

  header.innerHTML = `
    <div class="header-left"></div>
    <div class="header-title">我的</div>
    <div class="header-right">
      <button class="icon-btn" id="theme-toggle" title="切换主题">
        ${store.getTheme() === 'light' ? '🌙' : '☀️'}
      </button>
    </div>
  `;

  if (!user) {
    content.innerHTML = `
      <div style="padding: var(--space-2xl) var(--space-lg); text-align: center;" class="fade-in">
        <div style="font-size: 64px; margin-bottom: var(--space-lg);">👤</div>
        <h2 style="font-size: var(--font-lg); margin-bottom: var(--space-sm);">未登录</h2>
        <p style="color: var(--text-secondary); font-size: var(--font-sm); margin-bottom: var(--space-xl); line-height: 1.5;">
          登录后即可创建活动、加入活动<br/>管理你的参与记录
        </p>
        <button class="btn btn-primary btn-lg" id="my-login-btn" style="min-width: 200px;">
          微信一键登录
        </button>
      </div>
    `;

    content.querySelector('#my-login-btn').addEventListener('click', () => {
      showNicknameInput();
    });
  } else {
    const { upcoming, past } = store.getMyEvents();
    const totalEvents = upcoming.length + past.length;

    content.innerHTML = `
      <div class="fade-in" style="padding: var(--space-md);">
        <!-- Profile Card -->
        <div class="card" style="display: flex; align-items: center; gap: var(--space-md); margin-bottom: var(--space-md);">
          <div class="avatar avatar-xl" style="background: ${user.avatarColor}; color: #fff; font-size: var(--font-lg);">
            ${user.initial}
          </div>
          <div style="flex: 1;">
            <div style="font-size: var(--font-md); font-weight: 600;">${user.nickName}</div>
            <div style="font-size: var(--font-xs); color: var(--text-secondary); margin-top: 2px;">
              ${user.isAdmin ? '🛡️ 管理员' : '普通用户'}
            </div>
          </div>
        </div>

        <!-- My Events Module -->
        <div class="card" style="padding: var(--space-md); margin-bottom: var(--space-md);">
          <div style="display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-md);">
            <span style="font-size: 18px;">📋</span>
            <span style="font-size: var(--font-base); font-weight: 600; color: var(--text-primary);">我的活动</span>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-sm);">
            <button class="event-stat-btn" data-tab="all" style="background: none; border: none; text-align: center; cursor: pointer; padding: var(--space-sm) 0; transition: transform 0.15s; font-family: var(--font-family);">
              <div style="font-size: var(--font-xl); font-weight: 700; color: var(--accent); margin-bottom: 4px;">${totalEvents}</div>
              <div style="font-size: var(--font-xs); color: var(--text-secondary);">全部活动</div>
            </button>
            <button class="event-stat-btn" data-tab="upcoming" style="background: none; border: none; text-align: center; cursor: pointer; padding: var(--space-sm) 0; transition: transform 0.15s; font-family: var(--font-family);">
              <div style="font-size: var(--font-xl); font-weight: 700; color: var(--success); margin-bottom: 4px;">${upcoming.length}</div>
              <div style="font-size: var(--font-xs); color: var(--text-secondary);">即将到来</div>
            </button>
            <button class="event-stat-btn" data-tab="past" style="background: none; border: none; text-align: center; cursor: pointer; padding: var(--space-sm) 0; transition: transform 0.15s; font-family: var(--font-family);">
              <div style="font-size: var(--font-xl); font-weight: 700; color: var(--text-tertiary); margin-bottom: 4px;">${past.length}</div>
              <div style="font-size: var(--font-xs); color: var(--text-secondary);">已结束</div>
            </button>
          </div>
        </div>

        <!-- Other Menu Items (Admin) -->
        <div class="card" style="padding: 0; overflow: hidden; margin-bottom: var(--space-md); display: ${user.isAdmin ? 'block' : 'none'};">
          <button class="menu-item" id="admin-panel-btn" style="width: 100%; display: flex; align-items: center; gap: var(--space-md); padding: var(--space-md); background: none; border: none; cursor: pointer; font-family: var(--font-family); text-align: left;">
            <span style="font-size: 18px;">🛡️</span>
            <span style="flex: 1; font-size: var(--font-base); color: var(--text-primary); font-weight: 500;">管理面板</span>
            <span style="color: var(--text-tertiary);">›</span>
          </button>
        </div>

        <!-- Logout -->
        <button class="btn btn-secondary btn-block" id="logout-btn" style="margin-top: var(--space-md);">
          退出登录
        </button>
      </div>
    `;

    // My events
    content.querySelectorAll('.event-stat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        renderMyEvents(btn.dataset.tab);
      });
    });

    // Logout
    content.querySelector('#logout-btn').addEventListener('click', () => {
      if (confirm('确定要退出登录吗？')) {
        store.logout();
        renderMyPage();
      }
    });
  }

  // Theme toggle
  header.querySelector('#theme-toggle').addEventListener('click', () => {
    store.toggleTheme();
    renderMyPage();
  });
}
