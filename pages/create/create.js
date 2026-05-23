import { createEvent, getEventById, updateEvent } from '../../utils/store.js';
import { CATEGORIES, REMINDER_OPTIONS } from '../../utils/date.js';

Page({
  data: {
    isEdit: false,
    eventId: null,
    title: '',
    categoryId: 'fitness',
    categories: CATEGORIES,
    
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',

    timeArray: [
      Array.from({length: 24}, (_, i) => String(i).padStart(2, '0')),
      ['00', '10', '20', '30', '40', '50']
    ],
    startTimeIdx: [0, 0],
    endTimeIdx: [0, 0],
    
    location: '',
    
    reminderOptions: REMINDER_OPTIONS,
    reminderLabels: REMINDER_OPTIONS.map(o => o.label),
    reminderIndex: 3 // Default 30 min
  },

  async onLoad(options) {
    if (options.id) {
      wx.setNavigationBarTitle({ title: '编辑活动' });
      this.setData({ isEdit: true, eventId: options.id });
      wx.showLoading({ title: '加载中...', mask: true });
      try {
        const event = await getEventById(options.id);
        if (event) {
          const sDateObj = new Date(event.startTime);
          const eDateObj = new Date(event.endTime);
          
          const reminderIndex = this.data.reminderOptions.findIndex(o => o.value === event.reminder);
          
          this.setData({
            title: event.title,
            categoryId: event.categoryId,
            startDate: this.formatDate(sDateObj),
            startTime: this.formatTime(sDateObj),
            endDate: this.formatDate(eDateObj),
            endTime: this.formatTime(eDateObj),
            location: event.location || '',
            reminderIndex: reminderIndex > -1 ? reminderIndex : 3
          });
          this.setTimeIndexes(this.data.startTime, 'startTime');
          this.setTimeIndexes(this.data.endTime, 'endTime');
        }
      } catch (e) {
        wx.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        wx.hideLoading();
      }
    } else {
      const now = new Date();
      // Default to next hour
      now.setHours(now.getHours() + 1, 0, 0, 0);
      const end = new Date(now);
      end.setHours(end.getHours() + 1);

      const sDate = this.formatDate(now);
      const sTime = this.formatTime(now);
      const eDate = this.formatDate(end);
      const eTime = this.formatTime(end);

      this.setData({
        startDate: sDate, startTime: sTime,
        endDate: eDate, endTime: eTime
      });
      this.setTimeIndexes(sTime, 'startTime');
      this.setTimeIndexes(eTime, 'endTime');
    }
  },

  formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  formatTime(d) {
    const h = String(d.getHours()).padStart(2,'0');
    let m = Math.round(d.getMinutes() / 10) * 10;
    if (m === 60) m = 50; 
    return `${h}:${String(m).padStart(2,'0')}`;
  },

  setTimeIndexes(timeStr, key) {
    const [h, m] = timeStr.split(':');
    const hIdx = parseInt(h, 10);
    let mIdx = ['00', '10', '20', '30', '40', '50'].indexOf(m);
    if (mIdx === -1) mIdx = 0;
    this.setData({ [`${key}Idx`]: [hIdx, mIdx], [key]: timeStr });
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }); },
  onLocationInput(e) { this.setData({ location: e.detail.value }); },
  
  selectCategory(e) { this.setData({ categoryId: e.currentTarget.dataset.id }); },

  onStartDateChange(e) { this.setData({ startDate: e.detail.value, endDate: e.detail.value }); },
  onStartTimeChange(e) { 
    const [hIdx, mIdx] = e.detail.value;
    const timeStr = `${this.data.timeArray[0][hIdx]}:${this.data.timeArray[1][mIdx]}`;
    this.setData({ startTimeIdx: e.detail.value, startTime: timeStr }); 
  },
  onEndDateChange(e) { this.setData({ endDate: e.detail.value }); },
  onEndTimeChange(e) { 
    const [hIdx, mIdx] = e.detail.value;
    const timeStr = `${this.data.timeArray[0][hIdx]}:${this.data.timeArray[1][mIdx]}`;
    this.setData({ endTimeIdx: e.detail.value, endTime: timeStr }); 
  },
  
  onReminderChange(e) { this.setData({ reminderIndex: e.detail.value }); },

  cancel() {
    wx.navigateBack();
  },

  async submit() {
    const { isEdit, eventId, title, categoryId, startDate, startTime, endDate, endTime, location, reminderIndex, categories } = this.data;

    if (!title.trim()) {
      wx.showToast({ title: '请输入活动名称', icon: 'none' });
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    if (endDateTime <= startDateTime) {
      wx.showToast({ title: '结束时间必须在开始时间之后', icon: 'none' });
      return;
    }

    const category = categories.find(c => c.id === categoryId);

    const eventData = {
      title: title.trim(),
      categoryId,
      emoji: category.emoji,
      color: category.color,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      location: location.trim(),
      reminder: REMINDER_OPTIONS[reminderIndex].value
    };

    wx.showLoading({ title: isEdit ? '保存中...' : '创建中...', mask: true });
    try {
      if (isEdit) {
        await updateEvent(eventId, eventData);
        wx.showToast({ title: '保存成功', icon: 'success' });
      } else {
        await createEvent(eventData);
        wx.showToast({ title: '创建成功', icon: 'success' });
      }
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.showToast({ title: err.message || (isEdit ? '保存失败' : '创建失败'), icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
