import { 
  getWeekDates, getMonthName, isToday, isSameDay, 
  DAY_NAMES_SHORT, formatTime, getTimelinePosition, getNowLinePosition,
  eventOnDate
} from '../../utils/date.js';
import { getEvents } from '../../utils/store.js';

const app = getApp();

Page({
  data: {
    currentDate: new Date().toISOString(),
    selectedDate: new Date().toISOString(),
    monthName: '',
    displayYear: '',
    dayNamesShort: DAY_NAMES_SHORT,
    weekDates: [],
    eventsForSelected: [],
    
    hours: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
    hourHeight: 60,
    scrollTop: 0,
    isToday: true,
    nowLineTop: 0,
    
    // Auto-update timer for the now line
    timer: null
  },

  onLoad() {
    this.updateView();
    // Scroll to current hour minus 2
    const now = new Date();
    const currentHour = now.getHours();
    this.setData({
      scrollTop: Math.max((currentHour - 2) * this.data.hourHeight, 0)
    });
  },

  onShow() {
    this.updateView();
    this.startTimer();
  },

  onHide() {
    this.stopTimer();
  },

  onUnload() {
    this.stopTimer();
  },

  startTimer() {
    if (this.data.timer) clearInterval(this.data.timer);
    const timer = setInterval(() => {
      this.updateNowLine();
    }, 60000); // every minute
    this.setData({ timer });
  },

  stopTimer() {
    if (this.data.timer) {
      clearInterval(this.data.timer);
      this.setData({ timer: null });
    }
  },

  async refreshData() {
    wx.showLoading({ title: '加载中...', mask: true });
    try {
      const allEvents = await getEvents();
      this.setData({ allEvents });
      this.generateCalendar(this.data.currentDate);
      this.updateTimelineForSelectedDate();
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  updateView() {
    const d = new Date(this.data.currentDate);
    const sel = new Date(this.data.selectedDate);
    
    const weekStart = getWeekDates(d);
    const allEvents = getEvents();

    const weekDates = weekStart.map(date => {
      // Find dots for this date
      const dayEvents = allEvents.filter(e => eventOnDate(e, date));
      const dots = dayEvents.slice(0, 3).map(e => {
        // category color fallback
        if (e.categoryId === 'fitness') return '#9CAF88';
        if (e.categoryId === 'drinks') return '#C8A882';
        if (e.categoryId === 'outdoor') return '#8FA3B0';
        return '#bba0a0';
      });

      return {
        dateStr: date.toISOString(),
        dateNum: date.getDate(),
        isToday: isToday(date),
        isSelected: isSameDay(date, sel),
        dots
      };
    });

    const isTodayFlag = isToday(sel);
    
    this.setData({
      monthName: getMonthName(d.getMonth()),
      displayYear: d.getFullYear(),
      weekDates,
      isToday: isTodayFlag
    });

    this.updateNowLine();
    this.renderEventsForSelected();
  },

  updateNowLine() {
    if (this.data.isToday) {
      this.setData({
        nowLineTop: getNowLinePosition(this.data.hourHeight)
      });
    }
  },

  renderEventsForSelected() {
    const sel = new Date(this.data.selectedDate);
    const allEvents = getEvents();
    
    const dayEvents = allEvents.filter(e => eventOnDate(e, sel));
    
    const eventsForSelected = dayEvents.map(e => {
      const pos = getTimelinePosition(e.startTime, e.endTime, this.data.hourHeight);
      
      let bgColor = 'var(--bg-secondary)';
      let color = 'var(--text-secondary)';
      let emoji = '📅';

      if (e.categoryId === 'fitness') { color = '#9CAF88'; bgColor = '#f2f5f1'; emoji = '🏋️'; }
      if (e.categoryId === 'drinks') { color = '#C8A882'; bgColor = '#f8f4f0'; emoji = '🍺'; }
      if (e.categoryId === 'outdoor') { color = '#8FA3B0'; bgColor = '#f0f3f5'; emoji = '⛰️'; }

      const start = new Date(e.startTime);
      const end = new Date(e.endTime);
      
      return {
        ...e,
        top: pos.top,
        height: pos.height,
        color,
        bgColor,
        emoji,
        timeStr: `${formatTime(start)} - ${formatTime(end)}`
      };
    });
    
    this.setData({ eventsForSelected });
  },

  selectDate(e) {
    const { date } = e.currentTarget.dataset;
    this.setData({
      selectedDate: date,
      currentDate: date // also shift week view if clicked from month view later
    });
    this.updateView();
  },

  goToday() {
    const now = new Date().toISOString();
    this.setData({
      currentDate: now,
      selectedDate: now
    });
    this.updateView();
  },

  switchToMonth() {
    // To be implemented: Navigate to a month view page or toggle state
    wx.showToast({ title: '月视图即将上线', icon: 'none' });
  },
  
  goCreate() {
    wx.navigateTo({
      url: '/pages/create/create'
    });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/detail/detail?id=${id}`
    });
  }
});
