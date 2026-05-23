Component({
  data: {
    selected: 0,
    color: "#8c8c8c",
    selectedColor: "#c4a381",
    list: [
      {
        pagePath: "/pages/calendar/calendar",
        text: "📅 日历"
      },
      {
        pagePath: "/pages/my/my",
        text: "👤 我的"
      }
    ]
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    }
  }
});
