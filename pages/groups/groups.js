import { getCurrentUser, getMyGroups, getUnreadNotifications, markNotificationRead } from '../../utils/store.js';

Page({
  data: {
    currentUser: null,
    groups: [],
    notifications: [],
    loaded: false
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.refreshData();
  },

  async refreshData() {
    const user = getCurrentUser();
    this.setData({ currentUser: user });

    if (!user) {
      this.setData({ groups: [], notifications: [], loaded: true });
      return;
    }

    wx.showLoading({ title: '加载中...', mask: true });
    try {
      const [groups, notifications] = await Promise.all([
        getMyGroups(),
        getUnreadNotifications()
      ]);

      // Resolve creator info for each group
      const groupsWithCreator = groups.map(g => {
        const creator = (g.members || []).find(m => m.userId === g.creatorId);
        return { ...g, creator };
      });

      this.setData({
        groups: groupsWithCreator,
        notifications: notifications || [],
        loaded: true
      });
    } catch (e) {
      console.error('refreshData error:', e);
      this.setData({ loaded: true });
    } finally {
      wx.hideLoading();
    }
  },

  goToGroup(e) {
    const groupId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: '/pages/group-detail/group-detail?groupId=' + groupId });
  },

  goCreate() {
    const user = getCurrentUser();
    if (!user) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: '/pages/group-create/group-create' });
  },

  async dismissNotification(e) {
    const id = e.currentTarget.dataset.id;
    const idx = this.data.notifications.findIndex(n => n._id === id);
    if (idx === -1) return;

    // Trigger fade-out animation
    const key = `notifications[${idx}].dismissing`;
    this.setData({ [key]: true });

    // Wait for animation then remove
    setTimeout(async () => {
      try {
        await markNotificationRead(id);
      } catch (err) {
        console.error('markNotificationRead error:', err);
      }
      const updated = this.data.notifications.filter(n => n._id !== id);
      this.setData({ notifications: updated });
    }, 300);
  }
});
