/* ============================================
   "My Events" Page
   ============================================ */

import { store, getInitial } from '../utils/store.js';
import { formatDate, formatTime } from '../utils/date.js';

export function renderMyEvents(initialTab = 'upcoming') {
  const header = document.getElementById('app-header');
  const content = document.getElementById('app-content');
  const { upcoming, past } = store.getMyEvents();

  header.innerHTML = `
    <div class="header-left">
      <button class="icon-btn" id="back-to-my">‹</button>
    </div>
    <div class="header-title">我的活动</div>
    <div class="header-right"></div>
  `;

  let activeTab = initialTab;

  function renderList() {
    const events = activeTab === 'all' 
      ? [...upcoming, ...past].sort((a, b) => a.startTime - b.startTime) 
      : activeTab === 'upcoming' ? upcoming : past;

    content.innerHTML = `
      <div class="fade-in" style="padding: var(--space-md);">
        <!-- Tabs -->
        <div style="display: flex; gap: var(--space-xs); margin-bottom: var(--space-md); background: var(--bg-secondary); border-radius: var(--radius-full); padding: 3px;">
          <button class="events-tab ${activeTab === 'all' ? 'active' : ''}" data-tab="all"
                  style="flex: 1; padding: 8px; border-radius: var(--radius-full); border: none; font-family: var(--font-family); font-size: var(--font-sm); font-weight: 500; cursor: pointer; transition: all 0.15s;
                  background: ${activeTab === 'all' ? 'var(--bg-card)' : 'transparent'};
                  color: ${activeTab === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)'};
                  box-shadow: ${activeTab === 'all' ? 'var(--shadow-sm)' : 'none'};">
            全部 (${upcoming.length + past.length})
          </button>
          <button class="events-tab ${activeTab === 'upcoming' ? 'active' : ''}" data-tab="upcoming"
                  style="flex: 1; padding: 8px; border-radius: var(--radius-full); border: none; font-family: var(--font-family); font-size: var(--font-sm); font-weight: 500; cursor: pointer; transition: all 0.15s;
                  background: ${activeTab === 'upcoming' ? 'var(--bg-card)' : 'transparent'};
                  color: ${activeTab === 'upcoming' ? 'var(--text-primary)' : 'var(--text-secondary)'};
                  box-shadow: ${activeTab === 'upcoming' ? 'var(--shadow-sm)' : 'none'};">
            即将到来 (${upcoming.length})
          </button>
          <button class="events-tab ${activeTab === 'past' ? 'active' : ''}" data-tab="past"
                  style="flex: 1; padding: 8px; border-radius: var(--radius-full); border: none; font-family: var(--font-family); font-size: var(--font-sm); font-weight: 500; cursor: pointer; transition: all 0.15s;
                  background: ${activeTab === 'past' ? 'var(--bg-card)' : 'transparent'};
                  color: ${activeTab === 'past' ? 'var(--text-primary)' : 'var(--text-secondary)'};
                  box-shadow: ${activeTab === 'past' ? 'var(--shadow-sm)' : 'none'};">
            已结束 (${past.length})
          </button>
        </div>

        <!-- Event List -->
        ${events.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">${activeTab === 'upcoming' ? '📭' : activeTab === 'past' ? '📦' : '📭'}</div>
            <div class="empty-text">${activeTab === 'upcoming' ? '暂无即将到来的活动\n去日历看看有什么好玩的吧' : activeTab === 'past' ? '还没有已结束的活动' : '暂无活动'}</div>
          </div>
        ` : `
          <div style="display: flex; flex-direction: column; gap: var(--space-sm);">
            ${events.map(ev => `
              <div class="card event-list-item" data-event-id="${ev.id}"
                   style="cursor: pointer; transition: transform 0.15s; padding: var(--space-md);">
                <div style="display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm);">
                  <span class="badge" style="background: ${ev.category.color}20; color: ${ev.category.color}; font-size: var(--font-xs);">
                    ${ev.category.emoji} ${ev.category.name}
                  </span>
                  <span style="font-size: var(--font-xs); color: var(--text-tertiary);">
                    ${formatDate(new Date(ev.startTime))}
                  </span>
                </div>
                <div style="font-weight: 600; font-size: var(--font-base); margin-bottom: var(--space-xs);">
                  ${ev.title}
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-size: var(--font-xs); color: var(--text-secondary);">
                    ${formatTime(ev.startTime)} - ${formatTime(ev.endTime)}
                  </span>
                  <span style="font-size: var(--font-xs); color: var(--text-secondary);">
                    ${ev.participantCount}人参与
                  </span>
                </div>
                ${ev.location ? `
                  <div style="font-size: var(--font-xs); color: var(--text-tertiary); margin-top: var(--space-xs);">
                    📍 ${ev.location}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        `}
      </div>
    `;

    // Tab switching
    content.querySelectorAll('.events-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        renderList();
      });
    });

    // Event clicks
    content.querySelectorAll('.event-list-item').forEach(item => {
      item.addEventListener('click', () => {
        window.__app.showEventDetail(item.dataset.eventId);
      });
    });
  }

  renderList();

  // Back button
  header.querySelector('#back-to-my').addEventListener('click', () => {
    import('./my-page.js').then(m => m.renderMyPage());
  });
}
