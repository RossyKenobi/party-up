import { createEvent } from '../../utils/store.js';
import { CATEGORIES, REMINDER_OPTIONS } from '../../utils/date.js';

Page({
  data: {
    title: '',
    categoryId: 'fitness',
    categories: CATEGORIES,
    
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    
    location: '',
    
    reminderOptions: REMINDER_OPTIONS,
    reminderLabels: REMINDER_OPTIONS.map(o => o.label),
    reminderIndex: 3 // Default 30 min
  },

  onLoad() {
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
  },

  formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  formatTime(d) {
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  },

  onTitleInput(e) { this.setData({ title: e.detail.value }); },
  onLocationInput(e) { this.setData({ location: e.detail.value }); },
  
  selectCategory(e) { this.setData({ categoryId: e.currentTarget.dataset.id }); },

  onStartDateChange(e) { this.setData({ startDate: e.detail.value, endDate: e.detail.value }); },
  onStartTimeChange(e) { this.setData({ startTime: e.detail.value }); },
  onEndDateChange(e) { this.setData({ endDate: e.detail.value }); },
  onEndTimeChange(e) { this.setData({ endTime: e.detail.value }); },
  
  onReminderChange(e) { this.setData({ reminderIndex: e.detail.value }); },

  cancel() {
    wx.navigateBack();
  },

  submit() {
    const { title, categoryId, startDate, startTime, endDate, endTime, location, reminderIndex, reminderOptions } = this.data;

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

    const reminderVal = reminderOptions[reminderIndex].value;

    try {
      createEvent({
        title: title.trim(),
        categoryId,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        location: location.trim(),
        reminder: reminderVal
      });

      wx.showToast({ title: '创建成功', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (err) {
      wx.showToast({ title: err.message || '创建失败', icon: 'none' });
    }
  }
});
