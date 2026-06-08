import { getEventById, joinEvent, leaveEvent, deleteEvent, deleteEventSeries, getCurrentUser, getUsersByIds, getEventQRCode } from '../../utils/store.js';
import { CATEGORIES, formatDateFull, formatTime } from '../../utils/date.js';

Page({
  data: {
    eventId: null,
    event: null,
    category: null,
    dateStr: '',
    timeStr: '',
    participants: [],
    
    hasJoined: false,
    isCreator: false,
    isAdmin: false,
    isPast: false,
    
    showPosterPopup: false,
    posterTempFilePath: '',
    posterLoading: false
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ eventId: options.id });
    } else if (options.scene) {
      this.setData({ eventId: decodeURIComponent(options.scene) });
    }
  },

  onShow() {
    this.loadEventDetails();
  },

  async loadEventDetails() {
    const id = this.data.eventId;
    if (!id) return;

    wx.showLoading({ title: '加载中...', mask: true });
    try {
      const event = await getEventById(id);
      if (!event) {
        wx.showToast({ title: '活动已被删除', icon: 'none' });
        setTimeout(() => wx.navigateBack(), 1500);
        return;
      }

      const cat = CATEGORIES.find(c => c.id === event.categoryId) || CATEGORIES[0];
      const start = new Date(event.startTime);
      const end = new Date(event.endTime);
      
      let participants = [];
      if (event.participants && event.participants.length > 0) {
        const freshUsers = await getUsersByIds(event.participants);
        participants = event.participants.map(pid => {
          const freshUser = freshUsers.find(x => x.id === pid);
          const embeddedUser = (event.participantsInfo || []).find(x => x.userId === pid);
          const u = freshUser || embeddedUser || { nickname: '未知用户', avatarColor: '#ccc', avatarUrl: '' };
          return {
            ...u,
            id: pid, // Map userId to id for template compatibility
            initial: u.nickname ? u.nickname[0] : '?'
          };
        });
      }

      const user = getCurrentUser();
      const hasJoined = user ? event.participants.includes(user.id) : false;
      const isCreator = user ? event.creatorId === user.id : false;
      const isAdmin = user ? user.role === 'admin' : false;
      const isPast = new Date(event.endTime) < new Date();

      this.setData({
        event,
        category: cat,
        dateStr: formatDateFull(start),
        timeStr: `${formatTime(start)} - ${formatTime(end)}`,
        participants,
        hasJoined,
        isCreator,
        isAdmin,
        isPast
      });
    } catch (e) {
      console.error(e);
      wx.showToast({ title: '加载失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  async handleJoin() {
    if (!getCurrentUser()) {
      wx.showToast({ title: '请先在我的页面登录', icon: 'none' });
      return;
    }
    
    const doJoin = async () => {
      wx.showLoading({ title: '处理中...', mask: true });
      try {
        await joinEvent(this.data.eventId);
        wx.showToast({ title: '加入成功', icon: 'success' });
        await this.loadEventDetails();
      } catch (e) {
        wx.showToast({ title: '操作失败', icon: 'none' });
      } finally {
        wx.hideLoading();
      }
    };

    if (this.data.event && this.data.event.reminder > 0) {
      wx.requestSubscribeMessage({
        tmplIds: ['o5ZWZwaz05Rr4yZoXEcGJfFxa2hF_dc4E9fsIrhK2NU'],
        success: (res) => console.log('订阅消息成功', res),
        fail: (err) => console.error('订阅消息失败', err),
        complete: () => doJoin()
      });
    } else {
      doJoin();
    }
  },

  handleLeave() {
    wx.showModal({
      title: '确认退出',
      content: '确定要退出该活动吗？',
      success: async (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '处理中...', mask: true });
          try {
            await leaveEvent(this.data.eventId);
            wx.showToast({ title: '已退出', icon: 'success' });
            await this.loadEventDetails();
          } catch (e) {
            wx.showToast({ title: '操作失败', icon: 'none' });
          } finally {
            wx.hideLoading();
          }
        }
      }
    });
  },

  handleEdit() {
    wx.navigateTo({
      url: `/pages/create/create?id=${this.data.eventId}`
    });
  },

  handleDelete() {
    const { event, eventId } = this.data;
    if (event.seriesId) {
      wx.showActionSheet({
        itemList: ['删除此次活动', '删除此次及以后所有活动'],
        itemColor: '#E64340',
        success: (res) => {
          if (res.tapIndex === 0) {
            this._executeDelete('single');
          } else if (res.tapIndex === 1) {
            this._executeDelete('series');
          }
        }
      });
    } else {
      wx.showModal({
        title: '删除活动',
        content: '确定要删除此活动吗？此操作不可恢复。',
        confirmColor: '#E64340',
        success: (res) => {
          if (res.confirm) {
            this._executeDelete('single');
          }
        }
      });
    }
  },

  async _executeDelete(mode) {
    wx.showLoading({ title: '处理中...', mask: true });
    try {
      if (mode === 'series') {
        await deleteEventSeries(this.data.event.seriesId);
      } else {
        await deleteEvent(this.data.eventId);
      }
      wx.showToast({ title: '已删除', icon: 'success' });
      setTimeout(() => wx.navigateBack(), 1500);
    } catch (e) {
      wx.showToast({ title: '删除失败', icon: 'none' });
    } finally {
      wx.hideLoading();
    }
  },

  onShareAppMessage() {
    if (this.data.event) {
      return {
        title: `约起！「${this.data.event.title}」`,
        path: `/pages/detail/detail?id=${this.data.eventId}`,
        imageUrl: this.data.posterTempFilePath || ''
      };
    }
    return {
      title: 'Party-Up',
      path: '/pages/index/index'
    };
  },

  onShareTimeline() {
    if (this.data.event) {
      return {
        title: `约起！「${this.data.event.title}」`,
        query: `id=${this.data.eventId}`,
        imageUrl: this.data.posterTempFilePath || ''
      };
    }
    return { title: 'Party-Up' };
  },

  async handleGeneratePoster() {
    if (this.data.posterLoading) return;
    this.setData({ posterLoading: true });
    wx.showLoading({ title: '生成入场券...', mask: true });

    try {
      const { envVersion } = wx.getAccountInfoSync().miniProgram;
      
      const qrFileId = await getEventQRCode(this.data.eventId, envVersion || 'release');

      const fileRes = await wx.cloud.downloadFile({ fileID: qrFileId });
      const qrPath = fileRes.tempFilePath;

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

          ctx.fillStyle = '#C8B9B1';
          this._roundRect(ctx, 0, 0, width, height, 40);
          ctx.fill();

          ctx.fillStyle = '#E8E1D9';
          this._roundRect(ctx, 0, 0, width, 400, {tl: 40, tr: 40, bl: 0, br: 0});
          ctx.fill();

          ctx.save();
          ctx.font = 'bold 160px "Big Caslon"';
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
          ctx.lineWidth = 2;
          ctx.textAlign = 'right';
          
          ctx.textBaseline = 'bottom';
          const partyWidth = ctx.measureText('PARTY').width;
          ctx.strokeText('PARTY', width - 20, 390);

          ctx.textBaseline = 'top';
          ctx.font = '160px "Big Caslon"';
          const upBaseWidth = ctx.measureText('UP').width;
          const scaleRatio = partyWidth / upBaseWidth;
          const tuningFactor = 1.035; 
          const upFontSize = Math.floor(160 * scaleRatio * tuningFactor);
          
          ctx.save();
          ctx.translate(width - 20, 410);
          ctx.scale(1, 0.9);
          ctx.font = `${upFontSize}px "Big Caslon"`;
          ctx.strokeText('UP', 0, 0);
          ctx.restore();
          ctx.restore();

          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([8, 8]);
          ctx.moveTo(30, 400);
          ctx.lineTo(width - 30, 400);
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#999999';
          ctx.stroke();
          ctx.restore();

          ctx.globalCompositeOperation = 'destination-out';
          ctx.beginPath();
          ctx.arc(0, 400, 30, -Math.PI / 2, Math.PI / 2, false);
          ctx.fill();

          ctx.beginPath();
          ctx.arc(width, 400, 30, Math.PI / 2, -Math.PI / 2, false);
          ctx.fill();
          
          ctx.globalCompositeOperation = 'source-over';

          ctx.fillStyle = '#666666';
          ctx.font = 'bold 48px serif';
          let eventName = this.data.event ? this.data.event.title : "Let's Go Party";
          if (eventName.length > 10) eventName = eventName.substring(0, 9) + '...';
          ctx.fillText(eventName, 60, 100);

          const creator = this.data.participants.find(p => p.id === this.data.event.creatorId);
          ctx.font = 'bold 32px serif';
          ctx.fillStyle = '#666666';
          ctx.textAlign = 'left';
          ctx.fillText('ORGANISED BY', 60, 165);
          
          if (creator) {
            ctx.font = '36px serif';
            ctx.fillText(creator.nickname, 60, 215);
          }

          ctx.fillStyle = '#666666';
          ctx.textAlign = 'center';
          ctx.font = 'bold 36px serif';
          ctx.fillText('SCAN TO JOIN', width / 2, 790);

          const qrImg = canvas.createImage();
          qrImg.src = qrPath;
          await new Promise((imgResolve) => {
            qrImg.onload = imgResolve;
            qrImg.onerror = imgResolve;
          });
          
          ctx.save();
          ctx.beginPath();
          ctx.arc(width / 2, 600, 110, 0, 2 * Math.PI);
          ctx.fillStyle = '#E8E1D9';
          ctx.fill();
          ctx.clip();
          ctx.drawImage(qrImg, width / 2 - 100, 600 - 100, 200, 200);
          ctx.restore();

          wx.canvasToTempFilePath({
            canvas: canvas,
            fileType: 'png',
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
      },
      fail: (err) => {
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
  }
});
