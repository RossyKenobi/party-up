import { getEventById, joinEvent, leaveEvent, deleteEvent, getCurrentUser, getUsersByIds } from '../../utils/store.js';
import { CATEGORIES, formatDateFull, formatTime } from '../../utils/date.js';

Page({
  data: {
    eventId: null,
    event: null,
    category: null,
    dateStr: '',
    timeStr: '',
    participants: [],
    
    hasJoined: false,
    isCreator: false,
    isAdmin: false,
    isPast: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ eventId: options.id });
    }
  },

  onShow() {
    this.loadEventDetails();
  },

  async loadEventDetails() {
    const id = this.data.eventId;
    if (!id) return;

    wx.showLoading({ title: '加载中...', mask: true });
    try {
      const event = await getEventById(id);
      if (!event) {
        wx.showToast({ title: '活动已被删除', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      const cat = CATEGORIES.find(c => c.id === event.categoryId) || CATEGORIES[0];
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      
      let participants = (event.participantsInfo || []).map(u => ({
        ...u,
        id: u.userId, // Map userId to id so detail.wxml can match item.id === event.creatorId
        initial: u.nickname ? u.nickname[0] : '?'
      }));

      // Fallback for old events without participantsInfo
      if (participants.length === 0 && event.participants && event.participants.length > 0) {
        const users = await getUsersByIds(event.participants);
        participants = event.participants.map(pid => {
          const u = users.find(x => x.id === pid) || { id: pid, nickname: '未知用户', avatarColor: '#ccc', avatarUrl: '' };
          return {
            ...u,
            initial: u.nickname ? u.nickname[0] : '?'
          };
        });
      }

      const user = getCurrentUser();
      const hasJoined = user ? event.participants.includes(user.id) : false;
      const isCreator = user ? event.creatorId === user.id : false;
      const isAdmin = user ? user.role === 'admin' : false;
      const isPast = new Date(event.endTime) < new Date();

      this.setData({
        event,
        category: cat,
        dateStr: formatDateFull(start),
        timeStr: `${formatTime(start)} - ${formatTime(end)}`,
        participants,
        hasJoined,
        isCreator,
        isAdmin,
        isPast
      });
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async handleJoin() {
    if (!getCurrentUser()) {
      wx.showToast({ title: '请先在我的页面登录', icon: 'none' });
      return;
    }
    
    const doJoin = async () => {
      wx.showLoading({ title: '处理中...', mask: true });
      try {
        await joinEvent(this.data.eventId);
        wx.showToast({ title: '加入成功', icon: 'success' });
        await this.loadEventDetails();
      } catch (e) {
        wx.showToast({ title: '操作失败', icon: 'none' });
      } finally {
        wx.hideLoading();
      }
    };

    if (this.data.event && this.data.event.reminder > 0) {
      wx.requestSubscribeMessage({
        tmplIds: ['o5ZWZwaz05Rr4yZoXEcGJfFxa2hF_dc4E9fsIrhK2NU'],
        success: (res) => console.log('订阅消息成功', res),
        fail: (err) => console.error('订阅消息失败', err),
        complete: () => doJoin()
      });
    } else {
      doJoin();
    }
  },

  handleLeave() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出该活动吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });
          try {
            await leaveEvent(this.data.eventId);
            wx.showToast({ title: '已退出', icon: 'success' });
            await this.loadEventDetails();
          } catch (e) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  handleEdit() {
    wx.navigateTo({
      url: `/pages/create/create?id=${this.data.eventId}`
    });
  },

  handleDelete() {
    wx.showModal({
      title: '删除活动',
      content: '确定要删除此活动吗？此操作不可恢复。',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });
          try {
            await deleteEvent(this.data.eventId);
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 1500);
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  onShareAppMessage() {
    return {
      title: `邀你参加：${this.data.event ? this.data.event.title : '活动'}`,
      path: `/pages/detail/detail?id=${this.data.eventId}`
    };
  },

  onShareTimeline() {
    return {
      title: `邀你参加：${this.data.event ? this.data.event.title : '活动'}`,
      query: `id=${this.data.eventId}`
    };
  }
});
