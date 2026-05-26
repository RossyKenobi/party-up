import { getCurrentUser, getGroupById, updateGroupSettings } from '../../utils/store.js';

Page({
  data: {
    groupId: null,
    group: null,
    currentUser: null,
    members: [],
    isCreator: false,
    deadlineDisplay: '不限',
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
      const isCreator = currentUser ? group.creatorId === currentUser.id : false;
      const members = (group.members || []).map(m => ({
        ...m,
        initial: m.nickname ? m.nickname[0] : '?',
        isCreator: m.userId === group.creatorId,
      }));

      // Format deadline display
      let deadlineDisplay = '不限';
      if (group.voteDeadline) {
        const d = new Date(group.voteDeadline);
        const now = new Date();
        if (d <= now) {
          deadlineDisplay = '已截止';
        } else {
          const month = d.getMonth() + 1;
          const day = d.getDate();
          const hour = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          deadlineDisplay = `${month}月${day}日 ${hour}:${min}`;
        }
      }

      this.setData({ group, currentUser, members, isCreator, deadlineDisplay });
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

  pickDeadline() {
    wx.showActionSheet({
      itemList: ['不限', '1小时后', '今天24:00', '明天24:00', '自定义时间'],
      success: (res) => {
        const idx = res.tapIndex;
        let deadline = null;

        if (idx === 0) {
          deadline = null;
        } else if (idx === 1) {
          deadline = new Date(Date.now() + 3600000).toISOString();
        } else if (idx === 2) {
          const d = new Date();
          d.setHours(23, 59, 59, 0);
          deadline = d.toISOString();
        } else if (idx === 3) {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          d.setHours(23, 59, 59, 0);
          deadline = d.toISOString();
        } else if (idx === 4) {
          this._pickCustomDeadline();
          return;
        }

        this._saveDeadline(deadline);
      },
    });
  },

  _pickCustomDeadline() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    wx.showModal({
      title: '选择截止日期',
      editable: true,
      placeholderText: 'YYYY-MM-DD HH:MM',
      success: (res) => {
        if (!res.confirm || !res.content) return;
        const input = res.content.trim();
        const d = new Date(input.replace(' ', 'T'));
        if (isNaN(d.getTime())) {
          wx.showToast({ title: '格式错误，请输入 YYYY-MM-DD HH:MM', icon: 'none' });
          return;
        }
        if (d <= new Date()) {
          wx.showToast({ title: '截止时间需晚于当前时间', icon: 'none' });
          return;
        }
        this._saveDeadline(d.toISOString());
      },
    });
  },

  async _saveDeadline(deadline) {
    wx.showLoading({ title: '更新中...', mask: true });
    try {
      await updateGroupSettings(this.data.groupId, { voteDeadline: deadline });
      await this.loadData();
      wx.showToast({ title: '已更新', icon: 'success' });
    } catch (e) {
      console.error('save deadline failed', e);
      wx.showToast({ title: '更新失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  handleLeave() {
    wx.showModal({
      title: '确认退出',
      content: '退出后你的投票将被清除，确定退出吗？',
      success: async (res) => {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中...', mask: true });
        try {
          await wx.cloud.callFunction({
            name: 'leaveGroup',
            data: {
              groupId: this.data.groupId,
              callerId: this.data.currentUser.id,
            },
          });
          wx.showToast({ title: '已退出', icon: 'success' });
          setTimeout(() => {
            wx.switchTab({ url: '/pages/groups/groups' });
          }, 1500);
        } catch (e) {
          console.error('leave failed', e);
          wx.showToast({ title: '操作失败', icon: 'none' });
        } finally {
          wx.hideLoading();
        }
      },
    });
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
