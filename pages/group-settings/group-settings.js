import { getCurrentUser, getGroupById, updateGroupSettings, getPlacesByGroup } from '../../utils/store.js';

Page({
  data: {
    groupId: null,
    group: null,
    currentUser: null,
    members: [],
    isCreator: false,
    places: [],
    hasDeadline: false,
    customDate: '',
    customTime: '',
    today: '',
  },

  onLoad(options) {
    if (options.groupId) {
      this.setData({ groupId: options.groupId });
    }
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    this.setData({ today: `${y}-${m}-${d}` });
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
      let hasDeadline = false;
      let customDate = this.data.customDate;
      let customTime = this.data.customTime;
      if (group.voteDeadline) {
        const d = new Date(group.voteDeadline);
        if (d > new Date()) {
          hasDeadline = true;
          customDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          customTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
      }

      // Load places for voting control
      const places = await getPlacesByGroup(groupId);

      this.setData({ group, currentUser, members, isCreator, hasDeadline, customDate, customTime, places });
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
            name: 'groupService',
            data: {
              action: 'kick',
              groupId: this.data.groupId,
              targetUserId: userid,
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

  onDeadlineSwitchChange(e) {
    const hasDeadline = e.detail.value;
    if (hasDeadline) {
      let { customDate, customTime } = this.data;
      if (customDate && customTime) {
        const d = new Date(`${customDate.replace(/-/g, '/')} ${customTime}:00`);
        if (d <= new Date()) {
          customDate = '';
          customTime = '';
        }
      }
      this.setData({ hasDeadline, customDate, customTime });
      if (customDate && customTime) {
        this._saveDeadline(new Date(`${customDate.replace(/-/g, '/')} ${customTime}:00`).toISOString());
      }
    } else {
      this.setData({ hasDeadline: false });
      this._saveDeadline(null);
    }
  },

  onCustomDate(e) {
    this.setData({ customDate: e.detail.value });
    this.checkAndSaveDeadline();
  },

  onCustomTime(e) {
    this.setData({ customTime: e.detail.value });
    this.checkAndSaveDeadline();
  },

  checkAndSaveDeadline() {
    const { customDate, customTime } = this.data;
    if (customDate && customTime) {
      const d = new Date(`${customDate.replace(/-/g, '/')} ${customTime}:00`);
      if (d <= new Date()) {
        wx.showToast({ title: '不能早于当前时间', icon: 'none' });
        return;
      }
      this._saveDeadline(d.toISOString());
    }
  },

  async _saveDeadline(deadline) {
    wx.showLoading({ title: '更新中...', mask: true });
    try {
      await updateGroupSettings(this.data.groupId, { voteDeadline: deadline });
      await this.loadData();
      if (deadline) {
        wx.showToast({ title: '已设置截止时间', icon: 'success' });
      } else {
        wx.showToast({ title: '已取消截止时间', icon: 'success' });
      }
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
            name: 'groupService',
            data: {
              action: 'leave',
              groupId: this.data.groupId,
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
            name: 'groupService',
            data: {
              action: 'dissolve',
              groupId: this.data.groupId,
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

  async handleToggleVotingClosed() {
    const { group, places, groupId } = this.data;
    const currentlyClosed = group.votingClosed;

    const confirmText = currentlyClosed ? '确定重新开启投票？' : '确定结束投票？';
    const { confirm } = await wx.showModal({ title: '提示', content: confirmText });
    if (!confirm) return;

    wx.showLoading({ title: '更新中...', mask: true });
    try {
      if (currentlyClosed) {
        await updateGroupSettings(groupId, { votingClosed: false, winnerPlaceIds: [] });
      } else {
        let maxVotes = 0;
        for (const p of places) {
          const count = p.voters ? p.voters.length : 0;
          if (count > maxVotes) maxVotes = count;
        }
        const winnerIds = maxVotes > 0
          ? places.filter(p => (p.voters ? p.voters.length : 0) === maxVotes).map(p => p.id)
          : [];
        await updateGroupSettings(groupId, { votingClosed: true, winnerPlaceIds: winnerIds });
      }
      await this.loadData();
    } catch (e) {
      console.error('toggleVotingClosed failed', e);
      wx.showToast({ title: '操作失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },
});
