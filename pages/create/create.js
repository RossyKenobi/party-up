import { createEvent, getEventById, updateEvent, updateEventSeries } from '../../utils/store.js';
import { CATEGORIES, REMINDER_OPTIONS, RECURRENCE_OPTIONS, VISIBILITY_OPTIONS } from '../../utils/date.js';

Page({
  data: {
    isEdit: false,
    eventId: null,
    seriesId: null,
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
    reminderIndex: 3, // Default 30 min

    recurrenceLabels: RECURRENCE_OPTIONS.map(o => o.label),
    recurrenceIndex: 0,
    recurrence: 'none',
    recurrenceEndDate: '',

    visibilityLabels: VISIBILITY_OPTIONS.map(o => o.label),
    visibilityIndex: 0,
    isPrivate: false,

    groupId: null,
    groupName: ''
  },

  async onLoad(options) {
    if (options.id) {
      // Edit mode
      wx.setNavigationBarTitle({ title: '编辑活动' });
      this.setData({ isEdit: true, eventId: options.id });
      wx.showLoading({ title: '加载中...', mask: true });
      try {
        const event = await getEventById(options.id);
        if (event) {
          const sDateObj = new Date(event.startTime);
          const eDateObj = new Date(event.endTime);
          
          const reminderIndex = this.data.reminderOptions.findIndex(o => o.value === event.reminder);
          const recurrenceIndex = RECURRENCE_OPTIONS.findIndex(o => o.value === (event.recurrence || 'none'));
          const visibilityIndex = VISIBILITY_OPTIONS.findIndex(o => o.value === (event.isPrivate || false));
          
          this.setData({
            title: event.title,
            categoryId: event.categoryId,
            startDate: this.formatDate(sDateObj),
            startTime: this.formatTime(sDateObj),
            endDate: this.formatDate(eDateObj),
            endTime: this.formatTime(eDateObj),
            location: event.location || '',
            reminderIndex: reminderIndex > -1 ? reminderIndex : 3,
            recurrence: event.recurrence || 'none',
            recurrenceIndex: recurrenceIndex > -1 ? recurrenceIndex : 0,
            recurrenceEndDate: event.recurrenceEndDate || '',
            isPrivate: event.isPrivate || false,
            visibilityIndex: visibilityIndex > -1 ? visibilityIndex : 0,
            seriesId: event.seriesId || null,
            groupId: event.groupId || null
          });
        }
      } catch (e) {
        wx.showToast({ title: '加载失败', icon: 'none' });
      } finally {
        wx.hideLoading();
      }
    } else if (options.groupId) {
      // Create from group
      this.setData({
        groupId: options.groupId,
        groupName: decodeURIComponent(options.groupName || ''),
        title: decodeURIComponent(options.groupName || ''),
        isPrivate: true,
        visibilityIndex: 1
      });
      this._initDefaultTimes();
    } else {
      // Normal create
      this._initDefaultTimes();
      const defaultCat = CATEGORIES.find(c => c.id === this.data.categoryId);
      
      let isPrivate = false;
      let visibilityIndex = 0;
      if (options.isPrivate === 'true') {
        isPrivate = true;
        visibilityIndex = 1;
      }

      this.setData({ 
        title: (defaultCat && this.data.categoryId !== 'other') ? defaultCat.name : '',
        isPrivate,
        visibilityIndex
      });
    }
  },

  _initDefaultTimes() {
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    const end = new Date(now);
    end.setHours(end.getHours() + 1);

    this.setData({
      startDate: this.formatDate(now), startTime: this.formatTime(now),
      endDate: this.formatDate(end), endTime: this.formatTime(end)
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
  
  selectCategory(e) { 
    const newCategoryId = e.currentTarget.dataset.id;
    const oldCategory = CATEGORIES.find(c => c.id === this.data.categoryId);
    const newCategory = CATEGORIES.find(c => c.id === newCategoryId);
    
    let updates = { categoryId: newCategoryId };
    
    if (!this.data.isEdit) {
      if (!this.data.title || (oldCategory && this.data.title === oldCategory.name)) {
        updates.title = newCategoryId === 'other' ? '' : (newCategory ? newCategory.name : '');
      }
    }
    
    this.setData(updates); 
  },

  _updateEndTimeAutomatically(startDate, startTime) {
    if (!startDate || !startTime) return;
    try {
      const startDateTime = new Date(`${startDate}T${startTime}`);
      
      if (this.data.isEdit && this.data.endDate && this.data.endTime) {
        const endDateTime = new Date(`${this.data.endDate}T${this.data.endTime}`);
        if (startDateTime < endDateTime) {
          return;
        }
      }

      if (!isNaN(startDateTime.getTime())) {
        startDateTime.setHours(startDateTime.getHours() + 1);
        this.setData({
          endDate: this.formatDate(startDateTime),
          endTime: this.formatTime(startDateTime)
        });
      }
    } catch (e) {}
  },

  onStartDateChange(e) { 
    this.setData({ startDate: e.detail.value }); 
    this._updateEndTimeAutomatically(e.detail.value, this.data.startTime);
  },
  onStartTimeChange(e) { 
    this.setData({ startTime: e.detail.value }); 
    this._updateEndTimeAutomatically(this.data.startDate, e.detail.value);
  },
  onEndDateChange(e) { this.setData({ endDate: e.detail.value }); },
  onEndTimeChange(e) { this.setData({ endTime: e.detail.value }); },
  
  onReminderChange(e) { this.setData({ reminderIndex: e.detail.value }); },

  onRecurrenceChange(e) {
    const idx = e.detail.value;
    this.setData({
      recurrenceIndex: idx,
      recurrence: RECURRENCE_OPTIONS[idx].value
    });
  },

  onRecurrenceEndDateChange(e) {
    this.setData({ recurrenceEndDate: e.detail.value });
  },

  onVisibilityChange(e) {
    const idx = e.detail.value;
    this.setData({
      visibilityIndex: idx,
      isPrivate: VISIBILITY_OPTIONS[idx].value
    });
  },

  cancel() {
    wx.navigateBack();
  },

  async submit() {
    const { isEdit, eventId, seriesId, title, categoryId, startDate, startTime, endDate, endTime, location, reminderIndex, categories, recurrence, recurrenceEndDate, isPrivate, groupId } = this.data;

    if (!title.trim()) {
      wx.showToast({ title: '请输入活动名称', icon: 'none' });
      return;
    }

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);
    const now = new Date();

    if (startDateTime < now) {
      wx.showToast({ title: '开始时间不能早于当前时间', icon: 'none' });
      return;
    }

    if (endDateTime <= startDateTime) {
      wx.showToast({ title: '结束时间必须在开始时间之后', icon: 'none' });
      return;
    }

    if (recurrence !== 'none' && !recurrenceEndDate) {
      wx.showToast({ title: '请设置重复结束日期', icon: 'none' });
      return;
    }

    if (recurrence !== 'none') {
      const recEnd = new Date(recurrenceEndDate);
      if (recEnd <= startDateTime) {
        wx.showToast({ title: '重复结束日期必须在开始时间之后', icon: 'none' });
        return;
      }
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
      reminder: REMINDER_OPTIONS[reminderIndex].value,
      recurrence,
      isPrivate
    };

    if (recurrence !== 'none') {
      eventData.recurrenceEndDate = recurrenceEndDate;
    }
    if (groupId) {
      eventData.groupId = groupId;
    }

    // Edit mode with series - ask user for edit depth
    if (isEdit && seriesId) {
      const { tapIndex } = await wx.showActionSheet({
        itemList: ['仅此次', '此次及以后所有']
      }).catch(() => ({ tapIndex: -1 }));

      if (tapIndex === -1) return;

      if (tapIndex === 0) {
        // Edit this one only - detach from series
        eventData.seriesId = null;
        eventData.recurrence = 'none';
        delete eventData.recurrenceEndDate;
        await this._doUpdate(eventId, eventData);
      } else {
        // Edit all future
        await this._doUpdateSeries(seriesId, eventData);
      }
      return;
    }

    const doSubmit = async () => {
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
    };

    if (eventData.reminder > 0) {
      wx.requestSubscribeMessage({
        tmplIds: ['o5ZWZwaz05Rr4yZoXEcGJfFxa2hF_dc4E9fsIrhK2NU'],
        success: (res) => console.log('订阅消息成功', res),
        fail: (err) => console.error('订阅消息失败', err),
        complete: () => doSubmit()
      });
    } else {
      doSubmit();
    }
  },

  async _doUpdate(eventId, eventData) {
    wx.showLoading({ title: '保存中...', mask: true });
    try {
      await updateEvent(eventId, eventData);
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async _doUpdateSeries(seriesId, eventData) {
    wx.showLoading({ title: '保存中...', mask: true });
    try {
      await updateEventSeries(seriesId, eventData);
      wx.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (err) {
      wx.showToast({ title: err.message || '保存失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  }
});
