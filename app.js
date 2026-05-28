import { refreshUserSession } from './utils/store.js';

App({
  onLaunch: function () {
    // 偷偷在后台加载自定义楷体字体
    wx.loadFontFace({
      family: 'KaiTi-Custom',
      // 请将下面的 url 替换为你上传到云存储后的字体文件真实 HTTPS 下载链接
      source: 'url("https://636c-cloud1-d5g42sztr4cbc5dea-1436156475.tcb.qcloud.la/kaiti.ttf")',
      scopes: ['webview', 'native'],
      success: (res) => {
        console.log('字体加载成功', res)
      },
      fail: (err) => {
        console.error('字体加载失败', err)
      }
    });

    wx.cloud.init({ env: 'cloud1-d5g42sztr4cbc5dea' });
    this.globalData = { userInfo: null, theme: 'light' };

    // Silent re-auth: sync local cache with cloud on app startup
    refreshUserSession().catch(err => {
      console.warn('Silent re-auth failed on launch:', err);
    });
  }
});
