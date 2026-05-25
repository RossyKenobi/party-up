import { getCurrentUser, getGroupById, updateGroupSettings } from '../../utils/store.js';

Page({
  data: {
    groupId: null,
    group: null,
    currentUser: null,
    members: [],
  },

  onLoad(options) {
    if (options.groupId) {
      this.setData({ groupId: options.groupId });
    }
    this.loadData();
  },

  async loadData() {
    const groupId = this.data.groupId;
    if (!groupId) return;

    wx.showLoading({ title: '加载中...', mask: true });
    try {
      const group = await getGroupById(groupId);
      if (!group) {
        wx.showToast({ title: '小组不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      const currentUser = getCurrentUser();
      const members = (group.members || []).map(m => ({
        ...m,
        initial: m.nickname ? m.nickname[0] : '?',
        isCreator: m.userId === group.creatorId,
      }));

      this.setData({ group, currentUser, members });
    } catch (e) {
      console.error('loadData failed', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  handleKick(e) {
    const { userid, nickname } = e.currentTarget.dataset;
    wx.showModal({
      title: '移出成员',
      content: `确定要将 ${nickname} 移出小组吗？移出后该成员的投票将被清除。`,
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...', mask: true });
        try {
          await wx.cloud.callFunction({
            name: 'groupAdmin',
            data: {
              action: 'kick',
              groupId: this.data.groupId,
              targetUserId: userid,
              callerId: this.data.currentUser.id,
            },
          });
          wx.showToast({ title: '已移出', icon: 'success' });
          await this.loadData();
        } catch (e) {
          console.error('kick failed', e);
          wx.showToast({ title: '操作失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },

  async handleToggle(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;

    wx.showLoading({ title: '更新中...', mask: true });
    try {
      await updateGroupSettings(this.data.groupId, { [field]: value });
      this.setData({ [`group.${field}`]: value });
    } catch (e) {
      console.error('toggle failed', e);
      wx.showToast({ title: '更新失败', icon: 'none' });
      // revert switch
      this.setData({ [`group.${field}`]: !value });
    } finally {
      wx.hideLoading();
    }
  },

  handleDissolve() {
    const groupName = this.data.group.name;
    wx.showModal({
      title: '解散小组',
      content: `确定要解散「${groupName}」吗？所有成员将收到通知，所有数据将被删除。此操作不可恢复。`,
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...', mask: true });
        try {
          await wx.cloud.callFunction({
            name: 'groupAdmin',
            data: {
              action: 'dissolve',
              groupId: this.data.groupId,
              callerId: this.data.currentUser.id,
            },
          });
          wx.showToast({ title: '小组已解散', icon: 'success' });
          setTimeout(() => {
            wx.switchTab({ url: '/pages/groups/groups' });
          }, 1500);
        } catch (e) {
          console.error('dissolve failed', e);
          wx.showToast({ title: '操作失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
  },
});
