import { getCurrentUser, getEvents, login } from '../../utils/store.js';

Page({
  data: {
    currentUser: null,
    allCount: 0,
    upcomingCount: 0,
    pastCount: 0,
    showLoginModal: false,
    tempNickname: ''
  },

  onShow() {
    this.refreshData();
  },

  refreshData() {
    const user = getCurrentUser();
    this.setData({ currentUser: user });

    if (user) {
      const allEvents = getEvents();
      // Filter events where user is creator or participant
      const myEvents = allEvents.filter(e => 
        e.creatorId === user.id || e.participants.includes(user.id)
      );

      const now = new Date();
      let upcoming = 0;
      let past = 0;

      myEvents.forEach(e => {
        if (new Date(e.endTime) < now) {
          past++;
        } else {
          upcoming++;
        }
      });

      this.setData({
        allCount: myEvents.length,
        upcomingCount: upcoming,
        pastCount: past
      });
    }
  },

  handleLogin() {
    this.setData({ showLoginModal: true, tempNickname: '' });
  },

  cancelLogin() {
    this.setData({ showLoginModal: false });
  },

  onNicknameInput(e) {
    this.setData({ tempNickname: e.detail.value });
  },

  confirmLogin() {
    const nickname = this.data.tempNickname.trim();
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' });
      return;
    }

    const colors = ['#9b9a97', '#8c9c9a', '#bba0a0', '#c4a381'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    login(nickname, randomColor);
    this.setData({ showLoginModal: false });
    this.refreshData();
    
    // 如果是第一次使用，这里可以将当前用户偷偷提升为 admin 测试用
    const user = getCurrentUser();
    if (user && user.nickname === 'admin') {
      user.role = 'admin';
      const users = wx.getStorageSync('party_up_users') || [];
      const uIndex = users.findIndex(u => u.id === user.id);
      if(uIndex > -1) {
        users[uIndex].role = 'admin';
        wx.setStorageSync('party_up_users', users);
      }
      wx.setStorageSync('party_up_current_user', user);
      this.setData({ currentUser: user });
    }
  },

  goToMyEvents(e) {
    const tab = e.currentTarget.dataset.tab;
    wx.navigateTo({
      url: `/pages/my-events/my-events?tab=${tab}`
    });
  },

  manageCategories() {
    wx.showToast({ title: '管理员功能开发中', icon: 'none' });
  }
});
