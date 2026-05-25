import { getCurrentUser, getGroupById, joinGroup, getPlacesByGroup, addPlace, deletePlace, votePlace } from '../../utils/store.js';

Page({
  data: {
    groupId: null,
    group: null,
    places: [],
    chartPlaces: [],
    isCreator: false,
    isMember: false,
    newPlaceText: '',
    loading: true,
  },

  onLoad(options) {
    if (options.groupId) {
      this.setData({ groupId: options.groupId });
      this.handleJoinFlow(options.groupId);
    }
  },

  onShow() {
    if (this.data.groupId) {
      this.refreshData();
    }
  },

  async handleJoinFlow(groupId) {
    const user = getCurrentUser();

    if (!user) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再加入小组',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/my/my' });
          } else {
            wx.navigateBack();
          }
        },
      });
      return;
    }

    const group = await getGroupById(groupId);
    if (!group) return;

    const alreadyMember = group.memberIds && group.memberIds.includes(user.id);
    if (alreadyMember) return;

    // Not a member — try to auto join
    if (!group.allowNewMembers) {
      wx.showToast({ title: '该小组已关闭新成员加入', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    if (group.memberIds && group.memberIds.length >= group.maxMembers) {
      wx.showToast({ title: '小组人数已满', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 1500);
      return;
    }

    try {
      await joinGroup(groupId);
      wx.showToast({ title: '已加入小组', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '加入失败', icon: 'none' });
    }
  },

  async refreshData() {
    const { groupId } = this.data;
    const user = getCurrentUser();

    try {
      const group = await getGroupById(groupId);
      if (!group) {
        wx.showToast({ title: '小组不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      wx.setNavigationBarTitle({ title: group.name });

      const rawPlaces = await getPlacesByGroup(groupId);
      const userId = user ? user.id : null;

      // Process places with vote status and voter info
      const places = await Promise.all(rawPlaces.map(async (place) => {
        const voted = userId ? (place.voters || []).includes(userId) : false;
        const voteCount = (place.voters || []).length;
        const isPlaceCreator = userId ? place.creatorId === userId : false;

        // Resolve voter info from group members (already loaded)
        let votersInfo = [];
        if (!group.isAnonymous && place.voters && place.voters.length > 0) {
          votersInfo = place.voters
            .map(vid => {
              const member = (group.members || []).find(m => m.userId === vid);
              return member ? {
                userId: member.userId,
                nickname: member.nickname || '?',
                avatarUrl: member.avatarUrl,
                avatarColor: member.avatarColor
              } : null;
            })
            .filter(Boolean);
        }

        return {
          ...place,
          voted,
          voteCount,
          isPlaceCreator,
          votersInfo,
        };
      }));

      // Chart data: all places, sorted desc
      const totalMembers = (group.memberIds || []).length;
      const chartPlaces = [...places]
        .sort((a, b) => b.voteCount - a.voteCount)
        .map((p, index) => {
          const pct = totalMembers > 0 ? Math.round(p.voteCount / totalMembers * 100) : 0;
          const opacity = Math.max(0.3, 1 - index * 0.2); // Fading opacity
          return {
            id: p.id,
            text: p.text,
            voteCount: p.voteCount,
            pct,
            barWidth: pct + '%',
            opacity,
            votersInfo: p.votersInfo,
          };
        });

      const isCreator = user ? group.creatorId === user.id : false;
      const isMember = user ? (group.memberIds || []).includes(user.id) : false;

      this.setData({
        group,
        places,
        chartPlaces,
        isCreator,
        isMember,
        loading: false,
      });
    } catch (e) {
      console.error('refreshData error:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  onNewPlaceInput(e) {
    this.setData({ newPlaceText: e.detail.value });
  },

  async handleAddPlace() {
    const text = this.data.newPlaceText.trim();
    if (!text) return;

    try {
      await addPlace(this.data.groupId, text);
      this.setData({ newPlaceText: '' });
      await this.refreshData();
    } catch (e) {
      const msg = e.message || '添加失败';
      wx.showToast({ title: msg, icon: 'none' });
    }
  },

  async handleVote(e) {
    if (!this.data.group.allowVoting) return;

    const { placeId, index } = e.currentTarget.dataset;

    // Optimistic toggle
    const places = [...this.data.places];
    const place = { ...places[index] };
    place.voted = !place.voted;
    place.voteCount += place.voted ? 1 : -1;
    places[index] = place;
    this.setData({ places });

    try {
      await votePlace(placeId);
      await this.refreshData();
    } catch (e) {
      // Revert on error
      await this.refreshData();
      wx.showToast({ title: '投票失败', icon: 'none' });
    }
  },

  handlePlaceLongPress(e) {
    const { placeId, index } = e.currentTarget.dataset;
    const place = this.data.places[index];
    const user = getCurrentUser();

    if (!user) return;
    const canDelete = place.isPlaceCreator || this.data.isCreator;
    if (!canDelete) return;

    wx.showActionSheet({
      itemList: ['删除此地点'],
      success: async (res) => {
        if (res.tapIndex === 0) {
          try {
            await deletePlace(placeId, this.data.groupId);
            wx.showToast({ title: '已删除', icon: 'success' });
            await this.refreshData();
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      },
    });
  },

  handleGoSettings() {
    wx.navigateTo({
      url: `/pages/group-settings/group-settings?groupId=${this.data.groupId}`,
    });
  },

  onShareAppMessage() {
    return {
      title: `来一起投票！「${this.data.group ? this.data.group.name : '小组'}」`,
      path: `/pages/group-detail/group-detail?groupId=${this.data.groupId}`,
    };
  },
});
