import { getCurrentUser, createGroup } from '../../utils/store.js';

Page({
  data: {
    name: '',
    maxMembers: 10,
    isAnonymous: false,
    hasDeadline: false,
    deadlineDate: '',
    deadlineTime: '',
    today: '',
    loading: false,
  },

  onLoad() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    this.setData({ today: `${y}-${m}-${d}` });
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },

  onSelectMax(e) {
    this.setData({ maxMembers: e.currentTarget.dataset.value });
  },

  onSelectAnonymous(e) {
    this.setData({ isAnonymous: e.currentTarget.dataset.value });
  },

  onToggleDeadline(e) {
    const hasDeadline = e.currentTarget.dataset.value;
    this.setData({ hasDeadline });
    if (!hasDeadline) {
      this.setData({ deadlineDate: '', deadlineTime: '' });
    }
  },

  onDeadlineDateChange(e) {
    this.setData({ deadlineDate: e.detail.value });
  },

  onDeadlineTimeChange(e) {
    this.setData({ deadlineTime: e.detail.value });
  },

  onCancel() {
    wx.navigateBack();
  },

  async onCreate() {
    const { name, maxMembers, isAnonymous, hasDeadline, deadlineDate, deadlineTime, loading } = this.data;
    if (loading) return;

    const trimmed = name.trim();
    if (!trimmed) {
      wx.showToast({ title: '请输入小组名称', icon: 'none' });
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    // Build deadline
    let voteDeadline = null;
    if (hasDeadline) {
      if (!deadlineDate || !deadlineTime) {
        wx.showToast({ title: '请选择截止日期和时间', icon: 'none' });
        return;
      }
      const d = new Date(`${deadlineDate}T${deadlineTime}`);
      if (d <= new Date()) {
        wx.showToast({ title: '截止时间需晚于当前时间', icon: 'none' });
        return;
      }
      voteDeadline = d.toISOString();
    }

    this.setData({ loading: true });
    try {
      const group = await createGroup({
        name: trimmed,
        maxMembers,
        isAnonymous,
        voteDeadline,
      });
      wx.showToast({ title: '创建成功', icon: 'success' });
      wx.redirectTo({ url: `/pages/group-detail/group-detail?groupId=${group.id}` });
    } catch (err) {
      console.error('createGroup failed', err);
      wx.showToast({ title: '创建失败', icon: 'none' });
    } finally {
      this.setData({ loading: false });
    }
  },
});
