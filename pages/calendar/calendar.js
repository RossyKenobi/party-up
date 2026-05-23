import { 
  getWeekDates, getMonthGrid, getMonthName, isToday, isSameDay, 
  DAY_NAMES_SHORT, formatTime, getTimelinePosition, getNowLinePosition,
  eventOnDate, addDays, addWeeks, addMonths
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
    
    isMonthView: false,
    
    currentMonthGridIndex: 1,
    monthGridList: [null, null, null],
    
    currentWeekIndex: 1,
    weeksList: [null, null, null],
    
    currentDayIndex: 1,
    daysList: [null, null, null],
    
    allEvents: [],
    hours: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')),
    hourHeight: 60,
    scrollTop: 0,
    nowLineTop: 0,
    timer: null,
    
    _syncingFromDaySwiper: false
  },

  onLoad() {
    const now = new Date();
    this.setData({
      scrollTop: Math.max((now.getHours() - 2) * this.data.hourHeight, 0)
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.refreshData();
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
      this.setData({ allEvents }, () => {
        this.fullResetView(this.data.selectedDate);
      });
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  fullResetView(baseDateStr) {
    const d = new Date(baseDateStr);
    
    this.data.currentDate = d.toISOString();
    this.data.selectedDate = d.toISOString();
    
    this.setData({
      currentWeekIndex: 1,
      currentDayIndex: 1,
      currentMonthGridIndex: 1,
      monthName: getMonthName(d.getMonth()),
      displayYear: d.getFullYear()
    });
    
    this.refreshWeekData();
    this.refreshDayData();
    if (this.data.isMonthView) {
      this.refreshMonthGridData();
    }
  },

  getCircularIndices(current) {
    if (current === 0) return { prev: 2, current: 0, next: 1 };
    if (current === 1) return { prev: 0, current: 1, next: 2 };
    return { prev: 1, current: 2, next: 0 };
  },

  refreshWeekData() {
    const { currentDate, currentWeekIndex } = this.data;
    const base = new Date(currentDate);
    const indices = this.getCircularIndices(currentWeekIndex);
    
    const weeksList = [...this.data.weeksList];
    weeksList[indices.prev] = this.buildWeekData(addWeeks(base, -1));
    weeksList[indices.current] = this.buildWeekData(base);
    weeksList[indices.next] = this.buildWeekData(addWeeks(base, 1));
    
    const d = new Date(this.data.selectedDate);
    this.setData({ 
      weeksList,
      monthName: getMonthName(d.getMonth()),
      displayYear: d.getFullYear()
    });
  },

  buildWeekData(dateObj) {
    const dates = getWeekDates(dateObj);
    const sel = new Date(this.data.selectedDate);
    const allEvents = this.data.allEvents || [];
    
    const days = dates.map(d => {
      const dayEvents = allEvents.filter(e => eventOnDate(e, d));
      const dots = dayEvents.slice(0, 3).map(e => {
        if (e.categoryId === 'fitness') return '#9CAF88';
        if (e.categoryId === 'drinks') return '#C8A882';
        if (e.categoryId === 'outdoor') return '#8FA3B0';
        return '#bba0a0';
      });
      return {
        dateStr: d.toISOString(),
        dateNum: d.getDate(),
        isToday: isToday(d),
        isSelected: isSameDay(d, sel),
        dots
      };
    });
    return { id: dateObj.getTime(), days };
  },

  refreshDayData() {
    const { selectedDate, currentDayIndex } = this.data;
    const base = new Date(selectedDate);
    const indices = this.getCircularIndices(currentDayIndex);
    
    const daysList = [...this.data.daysList];
    daysList[indices.prev] = this.buildDayData(addDays(base, -1));
    daysList[indices.current] = this.buildDayData(base);
    daysList[indices.next] = this.buildDayData(addDays(base, 1));
    
    this.setData({ daysList });
    this.updateNowLine();
  },

  buildDayData(dateObj) {
    const allEvents = this.data.allEvents || [];
    const dayEvents = allEvents.filter(e => eventOnDate(e, dateObj));
    
    const events = dayEvents.map(e => {
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
        color, bgColor, emoji,
        timeStr: `${formatTime(start)} - ${formatTime(end)}`
      };
    });
    
    return {
      id: dateObj.getTime(),
      isToday: isToday(dateObj),
      events
    };
  },

  updateNowLine() {
    this.setData({
      nowLineTop: getNowLinePosition(this.data.hourHeight)
    });
  },

  onWeekSwiperChange(e) {
    if (e.detail.source !== 'touch' && !this.data._syncingFromDaySwiper) return;
    
    const isFromDaySync = this.data._syncingFromDaySwiper;
    this.data._syncingFromDaySwiper = false;
    
    const current = e.detail.current;
    const oldCurrent = this.data.currentWeekIndex;
    let direction = 1;
    if ((oldCurrent === 1 && current === 0) || (oldCurrent === 0 && current === 2) || (oldCurrent === 2 && current === 1)) {
      direction = -1;
    }
    
    this.data.currentWeekIndex = current;
    
    if (!isFromDaySync) {
      const newBaseDate = addWeeks(this.data.currentDate, direction);
      const newSelectedDate = addWeeks(this.data.selectedDate, direction);
      this.data.currentDate = newBaseDate.toISOString();
      this.data.selectedDate = newSelectedDate.toISOString();
      
      this.refreshWeekData();
      
      this.setData({ currentDayIndex: 1 });
      this.refreshDayData();
    } else {
      this.refreshWeekData();
    }
  },

  onDaySwiperChange(e) {
    if (e.detail.source !== 'touch') return;
    const current = e.detail.current;
    const oldCurrent = this.data.currentDayIndex;
    
    let direction = 1;
    if ((oldCurrent === 1 && current === 0) || (oldCurrent === 0 && current === 2) || (oldCurrent === 2 && current === 1)) {
      direction = -1;
    }
    
    this.data.currentDayIndex = current;
    const oldSelected = new Date(this.data.selectedDate);
    const newSelected = addDays(oldSelected, direction);
    
    this.data.selectedDate = newSelected.toISOString();
    this.data.currentDate = newSelected.toISOString();
    
    this.refreshDayData();
    
    if ((oldSelected.getDay() === 0 && direction === 1) || (oldSelected.getDay() === 1 && direction === -1)) {
      const nextWeekIndex = (this.data.currentWeekIndex + direction + 3) % 3;
      this.data._syncingFromDaySwiper = true;
      this.setData({ currentWeekIndex: nextWeekIndex }); // triggers onWeekSwiperChange
    } else {
      this.refreshWeekData(); // update selected state
    }
  },

  selectDate(e) {
    const { date } = e.currentTarget.dataset;
    const d = new Date(date);
    this.data.selectedDate = d.toISOString();
    this.data.currentDate = d.toISOString();
    
    this.setData({ currentDayIndex: 1 });
    this.refreshDayData();
    this.refreshWeekData();
    
    if (this.data.isMonthView) {
      // User picked a date from month view, let's close it and center the week
      this.setData({ isMonthView: false, currentWeekIndex: 1 }); 
      this.refreshWeekData();
    }
  },

  toggleMonthView() {
    const willShow = !this.data.isMonthView;
    this.setData({ isMonthView: willShow });
    if (willShow) {
      // Sync month view to currently selected month
      this.setData({ currentMonthGridIndex: 1 });
      this.refreshMonthGridData();
    }
  },

  refreshMonthGridData() {
    const { currentDate, currentMonthGridIndex } = this.data;
    const base = new Date(currentDate);
    // Use the 1st of the month to safely add/subtract months
    const baseFirstDay = new Date(base.getFullYear(), base.getMonth(), 1);

    const indices = this.getCircularIndices(currentMonthGridIndex);
    
    const monthGridList = [...this.data.monthGridList];
    monthGridList[indices.prev] = this.buildMonthGridData(addMonths(baseFirstDay, -1));
    monthGridList[indices.current] = this.buildMonthGridData(baseFirstDay);
    monthGridList[indices.next] = this.buildMonthGridData(addMonths(baseFirstDay, 1));
    
    this.setData({ monthGridList });
  },

  buildMonthGridData(dateObj) {
    const days = getMonthGrid(dateObj.getFullYear(), dateObj.getMonth());
    const sel = new Date(this.data.selectedDate);
    const allEvents = this.data.allEvents || [];
    
    const monthGrid = days.map(item => {
      const dayEvents = allEvents.filter(e => eventOnDate(e, item.date));
      const dots = dayEvents.slice(0, 3).map(e => {
        if (e.categoryId === 'fitness') return '#9CAF88';
        if (e.categoryId === 'drinks') return '#C8A882';
        if (e.categoryId === 'outdoor') return '#8FA3B0';
        return '#bba0a0';
      });
      return {
        dateStr: item.date.toISOString(),
        dateNum: item.date.getDate(),
        currentMonth: item.currentMonth,
        isToday: isToday(item.date),
        isSelected: isSameDay(item.date, sel),
        dots
      };
    });
    return { id: dateObj.getTime(), grid: monthGrid };
  },

  onMonthSwiperChange(e) {
    if (e.detail.source !== 'touch') return;
    const current = e.detail.current;
    const oldCurrent = this.data.currentMonthGridIndex;
    let direction = 1;
    if ((oldCurrent === 1 && current === 0) || (oldCurrent === 0 && current === 2) || (oldCurrent === 2 && current === 1)) {
      direction = -1;
    }
    
    this.data.currentMonthGridIndex = current;
    
    const base = new Date(this.data.currentDate);
    const baseFirstDay = new Date(base.getFullYear(), base.getMonth(), 1);
    const newBase = addMonths(baseFirstDay, direction);
    
    this.setData({
      currentDate: newBase.toISOString(),
      monthName: getMonthName(newBase.getMonth()),
      displayYear: newBase.getFullYear()
    });
    
    this.refreshMonthGridData();
  },

  goToday() {
    this.fullResetView(new Date().toISOString());
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/create/create' });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/detail/detail?id=${id}` });
  }
});
