import { getCurrentUser, getEvents, login, logout } from '../../utils/store.js';

Page({
  data: {
    currentUser: null,
    createdCount: 0,
    joinedCount: 0,
    showLoginModal: false,
    tempNickname: '',
    tempAvatarUrl: '',
    defaultAvatarUrl: 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0'
  },

  onShow() {
    this.refreshData();
  },

  async refreshData() {
    const user = getCurrentUser();
    this.setData({ currentUser: user });

    if (user) {
      wx.showLoading({ title: '加载中...' });
      try {
        const allEvents = await getEvents();
        const created = allEvents.filter(e => e.creatorId === user.id);
        const joined = allEvents.filter(e => e.participants.includes(user.id));

        this.setData({
          createdCount: created.length,
          joinedCount: joined.length
        });
      } catch (e) {
        console.error(e);
      } finally {
        wx.hideLoading();
      }
    }
  },

  handleLogin() {
    this.setData({ showLoginModal: true, tempNickname: '', tempAvatarUrl: '' });
  },

  handleLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      success: (res) => {
        if (res.confirm) {
          logout();
          this.setData({ currentUser: null, createdCount: 0, joinedCount: 0 });
          wx.showToast({ title: '已退出', icon: 'success' });
        }
      }
    });
  },

  cancelLogin() {
    this.setData({ showLoginModal: false });
  },

  onChooseAvatar(e) {
    this.setData({ tempAvatarUrl: e.detail.avatarUrl });
  },

  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  async confirmLogin() {
    const nickname = this.data.tempNickname.trim();
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    const colors = ['#9b9a97', '#8c9c9a', '#bba0a0', '#c4a381'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

        users[uIndex].role = 'admin';
        wx.setStorageSync('party_up_users', users);
      }
      wx.setStorageSync('party_up_current_user', user);
      this.setData({ currentUser: user });
    }
  },

  goToMyEvents(e) {
    const type = e.currentTarget.dataset.type;
    wx.navigateTo({
      url: `/pages/my-events/my-events?type=${type}`
    });
  },

  manageCategories() {
    wx.showToast({ title: '管理员功能开发中', icon: 'none' });
  }
});
