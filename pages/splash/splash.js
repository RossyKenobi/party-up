Page({
  data: {
    timeLeft: 3,
    timerId: null
  },

  onLoad() {
    this.startCountdown();
  },

  onUnload() {
    if (this.data.timerId) {
      clearInterval(this.data.timerId);
    }
  },

  startCountdown() {
    const timerId = setInterval(() => {
      let current = this.data.timeLeft;
      if (current <= 1) {
        clearInterval(this.data.timerId);
        this.goToMain();
      } else {
        this.setData({
          timeLeft: current - 1
        });
      }
    }, 1000);

    this.setData({ timerId });
  },

  skip() {
    if (this.data.timerId) {
      clearInterval(this.data.timerId);
    }
    this.goToMain();
  },

  goToMain() {
    wx.switchTab({
      url: '/pages/calendar/calendar'
    });
  }
});
