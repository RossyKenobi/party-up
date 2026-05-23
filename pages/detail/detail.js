import { getEventById, getUserById, joinEvent, leaveEvent, deleteEvent, getCurrentUser } from '../../utils/store.js';
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

  loadEventDetails() {
    const id = this.data.eventId;
    if (!id) return;

    const event = getEventById(id);
    if (!event) {
      wx.showToast({ title: '活动已被删除', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    const cat = CATEGORIES.find(c => c.id === event.categoryId) || CATEGORIES[0];
    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    
    const participants = event.participants.map(pid => {
      const u = getUserById(pid) || { id: pid, nickname: '未知用户', avatarColor: '#ccc' };
      return {
        ...u,
        initial: u.nickname[0]
      };
    });

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
  },

  handleJoin() {
    if (!getCurrentUser()) {
      wx.showToast({ title: '请先在我的页面登录', icon: 'none' });
      return;
    }
    try {
      joinEvent(this.data.eventId);
      wx.showToast({ title: '加入成功', icon: 'success' });
      this.loadEventDetails();
    } catch (e) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  },

  handleLeave() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出该活动吗？',
      success: (res) => {
        if (res.confirm) {
          leaveEvent(this.data.eventId);
          wx.showToast({ title: '已退出', icon: 'success' });
          this.loadEventDetails();
        }
      }
    });
  },

  handleDelete() {
    wx.showModal({
      title: '删除活动',
      content: '确定要删除此活动吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          deleteEvent(this.data.eventId);
          wx.showToast({ title: '已删除', icon: 'success' });
          setTimeout(() => wx.navigateBack(), 1500);
        }
      }
    });
  }
});
