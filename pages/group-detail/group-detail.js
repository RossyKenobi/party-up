import { getCurrentUser, getGroupById, joinGroup, getPlacesByGroup, addPlace, deletePlace, votePlace, reorderPlaces, getCommentsByGroup, addComment, deleteComment } from '../../utils/store.js';

Page({
  data: {
    groupId: null,
    group: null,
    places: [],
    chartPlaces: [],
    isCreator: false,
    isMember: false,
    currentUserId: null,
    newPlaceText: '',
    loading: true,
    // Vote deadline
    effectiveAllowVoting: true,
    isExpired: false,
    deadline: null,
    countdownText: '',
    // Comments
    expandedPlaceId: null,
    commentText: '',
    // Edit mode
    isEditMode: false,
  },

  _countdownTimer: null,

  onLoad(options) {
    let groupId = options.groupId;
    if (options.scene) {
      groupId = decodeURIComponent(options.scene);
    }
    if (groupId) {
      this.setData({ groupId });
      this.handleJoinFlow(groupId);
    }
  },

  onShow() {
    if (this.data.groupId) {
      this.refreshData();
    }
  },

  onHide() {
    this._clearCountdown();
  },

  onUnload() {
    this._clearCountdown();
  },

  async onPullDownRefresh() {
    await this.refreshData();
    wx.stopPullDownRefresh();
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
      const [group, rawPlaces, allComments] = await Promise.all([
        getGroupById(groupId),
        getPlacesByGroup(groupId),
        getCommentsByGroup(groupId),
      ]);

      if (!group) {
        wx.showToast({ title: '小组不存在', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      wx.setNavigationBarTitle({ title: group.name });

      const userId = user ? user.id : null;

      // Group comments by placeId
      const commentMap = {};
      allComments.forEach(c => {
        if (!commentMap[c.placeId]) commentMap[c.placeId] = [];
        commentMap[c.placeId].push(c);
      });

      // Process places with vote status, voter info, and comments
      const places = rawPlaces.map(place => {
        const voted = userId ? (place.voters || []).includes(userId) : false;
        const voteCount = (place.voters || []).length;
        const isPlaceCreator = userId ? place.creatorId === userId : false;

        // Resolve voter info
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

        const comments = commentMap[place.id] || [];

        return {
          ...place,
          voted,
          voteCount,
          isPlaceCreator,
          votersInfo,
          comments,
          commentCount: comments.length,
        };
      });

      // Vote deadline logic
      const now = new Date();
      const deadline = group.voteDeadline ? new Date(group.voteDeadline) : null;
      const isExpired = deadline && now > deadline;
      const effectiveAllowVoting = group.allowVoting && !isExpired;

      // Chart data: all places, sorted desc
      const totalMembers = (group.memberIds || []).length;
      const chartPlaces = [...places]
        .sort((a, b) => b.voteCount - a.voteCount)
        .map((p, index) => {
          const pct = totalMembers > 0 ? Math.round(p.voteCount / totalMembers * 100) : 0;
          const opacity = Math.max(0.3, 1 - index * 0.2);
          return {
            id: p.id,
            text: p.text,
            voteCount: p.voteCount,
            pct,
            barWidth: pct + '%',
            opacity,
            votersInfo: p.votersInfo,
            isWinner: isExpired && index === 0 && p.voteCount > 0,
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
        currentUserId: userId,
        loading: false,
        effectiveAllowVoting,
        isExpired,
        deadline: group.voteDeadline || null,
      });

      // Start countdown if deadline exists and not expired
      this._clearCountdown();
      if (deadline && !isExpired) {
        this._updateCountdown(deadline);
        this._countdownTimer = setInterval(() => {
          this._updateCountdown(deadline);
        }, 1000);
      }
    } catch (e) {
      console.error('refreshData error:', e);
      wx.showToast({ title: '加载失败', icon: 'none' });
      this.setData({ loading: false });
    }
  },

  _clearCountdown() {
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
  },

  _updateCountdown(deadline) {
    const now = new Date();
    const diff = deadline - now;
    if (diff <= 0) {
      this._clearCountdown();
      this.setData({ isExpired: true, effectiveAllowVoting: false, countdownText: '已截止' });
      this.refreshData();
      return;
    }
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    let text = '';
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      text = `${days}天${hours % 24}小时`;
    } else if (hours > 0) {
      text = `${hours}小时${mins}分`;
    } else {
      text = `${mins}分${secs}秒`;
    }
    this.setData({ countdownText: text });
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
    if (!this.data.effectiveAllowVoting) return;

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

  toggleEditMode() {
    this.setData({ isEditMode: !this.data.isEditMode });
  },

  async onDragEnd(e) {
    const { startIndex, targetIndex } = e;
    if (startIndex === undefined || targetIndex === undefined || startIndex === targetIndex) return;

    let places = [...this.data.places];
    const item = places.splice(startIndex, 1)[0];
    places.splice(targetIndex, 0, item);
    this.setData({ places });

    wx.showLoading({ title: '保存排序...' });
    try {
      const placeIds = places.map(p => p.id);
      await reorderPlaces(this.data.groupId, placeIds);
    } catch(err) {
      wx.showToast({ title: '排序保存失败', icon: 'none' });
      await this.refreshData();
    } finally {
      wx.hideLoading();
    }
  },

  handleDeletePlaceIcon(e) {
    const { placeId } = e.currentTarget.dataset;
    wx.showModal({
      title: '删除目的地',
      content: '确定要删除这个地点吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await deletePlace(placeId, this.data.groupId);
            await this.refreshData();
          } catch (error) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  },

  // --- Comment Methods ---
  toggleComments(e) {
    const { placeId } = e.currentTarget.dataset;
    this.setData({
      expandedPlaceId: this.data.expandedPlaceId === placeId ? null : placeId,
      commentText: '',
    });
  },

  onCommentInput(e) {
    this.setData({ commentText: e.detail.value });
  },

  async submitComment(e) {
    const text = this.data.commentText.trim();
    if (!text) return;
    const { placeId } = e.currentTarget.dataset;

    try {
      await addComment(this.data.groupId, placeId, text);
      this.setData({ commentText: '' });
      await this.refreshData();
    } catch (e) {
      wx.showToast({ title: '发送失败', icon: 'none' });
    }
  },

  async handleDeleteComment(e) {
    const { commentId } = e.currentTarget.dataset;
    try {
      await deleteComment(commentId);
      await this.refreshData();
    } catch (e) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  },

  handleGoSettings() {
    wx.navigateTo({
      url: `/pages/group-settings/group-settings?groupId=${this.data.groupId}`,
    });
  },

  async handleGeneratePoster() {
    if (this.data.posterLoading) return;
    this.setData({ posterLoading: true });
    wx.showLoading({ title: '生成入场券...', mask: true });

    try {
      const { envVersion } = wx.getAccountInfoSync().miniProgram;
      
      const res = await wx.cloud.callFunction({
        name: 'groupService',
        data: {
          action: 'getQRCode',
          groupId: this.data.groupId,
          envVersion: envVersion || 'release'
        }
      });

      if (!res.result || !res.result.success) {
        throw new Error((res.result && res.result.error) || '获取太阳码失败');
      }

      const qrFileId = res.result.fileID;

      // Swap cloud file ID to temp file path
      const fileRes = await wx.cloud.downloadFile({ fileID: qrFileId });
      const qrPath = fileRes.tempFilePath;

      // Draw poster
      await this.drawPoster(qrPath);

    } catch (e) {
      console.error('generate poster error:', e);
      wx.showToast({ title: e.message || '生成海报失败', icon: 'none' });
    } finally {
      this.setData({ posterLoading: false });
      wx.hideLoading();
    }
  },

  drawPoster(qrPath) {
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery();
      query.select('#posterCanvas')
        .fields({ node: true, size: true })
        .exec(async (res) => {
          if (!res[0] || !res[0].node) {
            reject(new Error('Canvas not found'));
            return;
          }
          
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          const dpr = wx.getSystemInfoSync().pixelRatio;

          const width = 600;
          const height = 900;
          canvas.width = width * dpr;
          canvas.height = height * dpr;
          ctx.scale(dpr, dpr);

          // Draw ticket background (Glass lower part)
          const lowerGradient = ctx.createLinearGradient(0, 400, 0, height);
          lowerGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
          lowerGradient.addColorStop(1, 'rgba(255, 255, 255, 0.2)');
          ctx.fillStyle = lowerGradient;
          this._roundRect(ctx, 0, 0, width, height, 40);
          ctx.fill();
          
          // Draw glass border
          ctx.lineWidth = 2;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.stroke();

          // Top Header Background (Glass upper part)
          const upperGradient = ctx.createLinearGradient(0, 0, 0, 400);
          upperGradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
          upperGradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
          ctx.fillStyle = upperGradient;
          this._roundRect(ctx, 0, 0, width, 400, {tl: 40, tr: 40, bl: 0, br: 0});
          ctx.fill();

          // Perforated line
          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([15, 15]);
          ctx.moveTo(30, 400);
          ctx.lineTo(width - 30, 400);
          ctx.lineWidth = 4;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.stroke();
          ctx.restore();

          // Notches (cut out using destination-out)
          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.arc(0, 400, 30, -Math.PI / 2, Math.PI / 2, false);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(width, 400, 30, Math.PI / 2, -Math.PI / 2, false);
          ctx.fill();
          
          // Reset composite operation
          ctx.globalCompositeOperation = 'source-over';

          // Texts - Group Name
          ctx.fillStyle = '#666666';
          ctx.font = 'bold 48px "Cormorant Garamond", serif';
          let groupName = this.data.group ? this.data.group.name : "Let's Go Party";
          if (groupName.length > 10) groupName = groupName.substring(0, 9) + '...';
          ctx.fillText(groupName, 60, 100);

          // Creator info
          const creator = this.data.group && this.data.group.members ? this.data.group.members.find(m => m.userId === this.data.group.creatorId) : null;
          ctx.font = '300 32px "Cormorant Garamond", serif';
          ctx.fillStyle = '#666666';
          ctx.fillText('ORGANISER', 60, 195);
          
          if (creator) {
            ctx.fillStyle = '#666666';
            ctx.font = '300 36px "Cormorant Garamond", serif';
            ctx.fillText(creator.nickname, 150, 290); // moved down more
            
            // Draw creator avatar
            const avatarImg = canvas.createImage();
            avatarImg.src = creator.avatarUrl || '/assets/default-avatar.png';
            await new Promise((imgResolve) => {
              avatarImg.onload = imgResolve;
              avatarImg.onerror = imgResolve;
            });
            ctx.save();
            ctx.beginPath();
            ctx.arc(95, 280, 35, 0, 2 * Math.PI, false); // moved down more
            ctx.clip();
            if (creator.avatarUrl) {
              ctx.drawImage(avatarImg, 60, 245, 70, 70); // moved down more
            } else {
              ctx.fillStyle = creator.avatarColor || '#ccc';
              ctx.fill();
              ctx.fillStyle = '#fff';
              ctx.font = '300 36px "Cormorant Garamond", serif';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(creator.nickname[0], 95, 280); // moved down more
            }
            ctx.restore();
          }

          // Bottom section - QR Code
          ctx.fillStyle = '#666666';
          ctx.textAlign = 'center';
          ctx.font = '300 36px "Cormorant Garamond", serif';
          ctx.fillText('SCAN TO JOIN', width / 2, 790); // moved down

          // QR Code image
          const qrImg = canvas.createImage();
          qrImg.src = qrPath;
          await new Promise((imgResolve) => {
            qrImg.onload = imgResolve;
            qrImg.onerror = imgResolve;
          });
          
          // Draw white circle background for QR code
          ctx.save();
          ctx.beginPath();
          ctx.arc(width / 2, 600, 110, 0, 2 * Math.PI); // moved down
          ctx.fillStyle = '#FFFFFF';
          ctx.fill();
          ctx.clip();
          ctx.drawImage(qrImg, width / 2 - 100, 600 - 100, 200, 200); // moved down
          ctx.restore();

          // Export image
          wx.canvasToTempFilePath({
            canvas: canvas,
            fileType: 'png', // Export as PNG to preserve transparency
            success: (res) => {
              this.setData({
                posterTempFilePath: res.tempFilePath,
                showPosterPopup: true
              });
              resolve();
            },
            fail: (err) => {
              reject(err);
            }
          });
        });
    });
  },

  _roundRect(ctx, x, y, width, height, radius) {
    if (typeof radius === 'number') {
      radius = {tl: radius, tr: radius, br: radius, bl: radius};
    } else {
      var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
      for (var side in defaultRadius) {
        radius[side] = radius[side] || defaultRadius[side];
      }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
  },

  closePosterPopup() {
    this.setData({ showPosterPopup: false });
  },

  savePosterToAlbum() {
    wx.saveImageToPhotosAlbum({
      filePath: this.data.posterTempFilePath,
      success: () => {
        wx.showToast({ title: '已保存到相册', icon: 'success' });
        // The user requested not to auto-close the popup after saving
      },
      fail: (err) => {
        // Handle denied permission gracefully
        if (err.errMsg && err.errMsg.indexOf('auth deny') > -1) {
          wx.showModal({
            title: '提示',
            content: '需要您授权保存相册的权限哦～',
            success: (res) => {
              if (res.confirm) wx.openSetting();
            }
          });
        } else {
          wx.showToast({ title: '保存失败', icon: 'none' });
        }
      }
    });
  },

  onShareAppMessage() {
    return {
      title: `来一起投票！「${this.data.group ? this.data.group.name : '小组'}」`,
      path: `/pages/group-detail/group-detail?groupId=${this.data.groupId}`,
      // If we have a generated poster, use it as the share card's thumbnail
      imageUrl: this.data.posterTempFilePath || ''
    };
  },

  onShareTimeline() {
    return {
      title: `来一起投票！「${this.data.group ? this.data.group.name : '小组'}」`,
      query: `groupId=${this.data.groupId}`,
      imageUrl: this.data.posterTempFilePath || ''
    };
  }
});
