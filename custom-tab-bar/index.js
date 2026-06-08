Component({
  data: {
    selected: 0,
    color: "#a19c96",
    selectedColor: "#c4a381",
    list: [
      {
        pagePath: "/pages/discover/discover",
        text: "发现",
        icon: "/assets/tab-discover.svg",
        activeIcon: "/assets/tab-discover-active.svg"
      },
      {
        pagePath: "/pages/calendar/calendar",
        text: "日程",
        icon: "/assets/tab-schedule.svg",
        activeIcon: "/assets/tab-schedule-active.svg"
      },
      {
        pagePath: "/pages/groups/groups",
        text: "去哪玩",
        icon: "/assets/tab-travel.svg",
        activeIcon: "/assets/tab-travel-active.svg"
      },
      {
        pagePath: "/pages/my/my",
        text: "我的",
        icon: "/assets/tab-profile.svg",
        activeIcon: "/assets/tab-profile-active.svg"
      }
    ]
  },
  lifetimes: {
    attached() {
      const app = getApp();
      if (app && app.globalData && app.globalData.lastTabIndex !== undefined) {
        this.setData({ selected: app.globalData.lastTabIndex });
      }
    }
  },
  methods: {
    switchTab(e) {
      const url = e.currentTarget.dataset.path;
      const app = getApp();
      if (app && app.globalData) {
        app.globalData.lastTabIndex = this.data.selected;
      }
      wx.switchTab({ url });
    },
    updateIndex(index) {
      this.setData({ selected: index });
    }
  }
});
