import { getCurrentUser, createGroup } from '../../utils/store.js';

Page({
  data: {
    name: '',
    maxMembers: 10,
    isAnonymous: false,
    loading: false,
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

  onCancel() {
    wx.navigateBack();
  },

  async onCreate() {
    const { name, maxMembers, isAnonymous, loading } = this.data;
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

    this.setData({ loading: true });
    try {
      const group = await createGroup({
        name: trimmed,
        maxMembers,
        isAnonymous,
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
