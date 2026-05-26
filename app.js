import { refreshUserSession } from './utils/store.js';

App({
  onLaunch: function () {
    wx.cloud.init({ env: 'cloud1-d5g42sztr4cbc5dea' });
    this.globalData = { userInfo: null, theme: 'light' };

    // Silent re-auth: sync local cache with cloud on app startup
    refreshUserSession().catch(err => {
      console.warn('Silent re-auth failed on launch:', err);
    });
  }
});
