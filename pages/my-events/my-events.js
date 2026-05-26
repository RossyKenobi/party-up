import { getCurrentUser, getMyEventsList } from '../../utils/store.js';
import { formatDate, formatTime, CATEGORIES } from '../../utils/date.js';

Page({
  data: {
    activeTab: 'upcoming',
    allMyEvents: [],
    filteredEvents: [],
    currentUserId: null,
    eventType: 'joined',
    page: 0,
    hasMore: false,
    loadingMore: false
  },

  onLoad(options) {
    if (options.type) {
      this.setData({ eventType: options.type });
      wx.setNavigationBarTitle({
        title: options.type === 'created' ? '我发起的' : '我参与的'
      });
    }
    if (options.tab) {
      this.setData({ activeTab: options.tab });
    }
  },

  onShow() {
    this.refreshData();
  },

  async refreshData() {
    const user = getCurrentUser();
    if (!user) {
      this.setData({ allMyEvents: [], filteredEvents: [], currentUserId: null });
      return;
    }

    this.setData({ currentUserId: user.id, page: 0 });

    wx.showLoading({ title: '加载中...', mask: true });
    try {
      const { events, hasMore } = await getMyEventsList(this.data.eventType, 0, 50);

      const formatted = events.map(e => {
        const start = new Date(e.startTime);
        const end = new Date(e.endTime);
        const cat = CATEGORIES.find(c => c.id === e.categoryId) || CATEGORIES[0];

        return {
          ...e,
          dateStr: formatDate(start),
          timeStr: `${formatTime(start)} - ${formatTime(end)}`,
          emoji: cat.emoji
        };
      });

      formatted.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

      this.setData({ allMyEvents: formatted, hasMore }, () => {
        this.filterEvents();
      });
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  filterEvents() {
    const now = new Date();
    let filtered = [];
    const { activeTab, allMyEvents } = this.data;

    if (activeTab === 'all') {
      filtered = [...allMyEvents];
    } else if (activeTab === 'upcoming') {
      filtered = allMyEvents.filter(e => new Date(e.endTime) >= now);
    } else if (activeTab === 'past') {
      filtered = allMyEvents.filter(e => new Date(e.endTime) < now);
      filtered.reverse();
    }

    this.setData({ filteredEvents: filtered });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
    this.filterEvents();
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  }
});
