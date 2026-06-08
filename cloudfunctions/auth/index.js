const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

exports.main = async (event) => {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) return { success: false, error: '无法获取用户身份' };

  const { action } = event;

  try {
    if (action === 'silentLogin') {
      const byOpenId = await db.collection('users').where({ _openid: OPENID }).get();
      if (byOpenId.data.length > 0) {
        const user = byOpenId.data[0];
        return {
          success: true,
          user: { id: user.id, nickname: user.nickname, avatarColor: user.avatarColor, avatarUrl: user.avatarUrl, role: user.role }
        };
      }
      return { success: false, error: '未找到该 OpenID 的用户记录' };
    } else if (action === 'login') {
      const { nickname, avatarColor, avatarUrl } = event;
      if (!nickname || !nickname.trim()) {
        return { success: false, error: '昵称不能为空' };
      }

      // 1. Try find by OpenID (existing or already-migrated user)
      const byOpenId = await db.collection('users').where({ _openid: OPENID }).get();
      if (byOpenId.data.length > 0) {
        const user = byOpenId.data[0];
        // Update profile fields if provided
        const updates = {};
        if (nickname) updates.nickname = nickname.trim();
        if (avatarColor) updates.avatarColor = avatarColor;
        if (avatarUrl) updates.avatarUrl = avatarUrl;
        if (Object.keys(updates).length > 0) {
          await db.collection('users').doc(user._id).update({ data: updates });
        }
        const merged = { ...user, ...updates };
        return {
          success: true,
          user: { id: merged.id, nickname: merged.nickname, avatarColor: merged.avatarColor, avatarUrl: merged.avatarUrl, role: merged.role }
        };
      }

      // 2. Migration: try find old user by nickname (no _openid set)
      const byNickname = await db.collection('users').where({ nickname: nickname.trim() }).get();
      if (byNickname.data.length > 0) {
        const oldUser = byNickname.data[0];
        // Bind OpenID to this old record
        const updates = { _openid: OPENID };
        if (avatarColor) updates.avatarColor = avatarColor;
        if (avatarUrl) updates.avatarUrl = avatarUrl;
        await db.collection('users').doc(oldUser._id).update({ data: updates });
        const merged = { ...oldUser, ...updates };
        return {
          success: true,
          user: { id: merged.id, nickname: merged.nickname, avatarColor: merged.avatarColor, avatarUrl: merged.avatarUrl, role: merged.role }
        };
      }

      // 3. Brand new user
      const newUser = {
        id: 'u_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        nickname: nickname.trim(),
        avatarColor: avatarColor || '#9b9a97',
        avatarUrl: avatarUrl || '',
        role: 'user'
      };
      await db.collection('users').add({ data: newUser });
      return { success: true, user: newUser };

    } else if (action === 'updateProfile') {
      const { nickname, avatarUrl } = event;
      const res = await db.collection('users').where({ _openid: OPENID }).get();
      if (res.data.length === 0) return { success: false, error: '用户不存在' };

      const user = res.data[0];
      const updates = {};
      if (nickname) updates.nickname = nickname.trim();
      if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
      await db.collection('users').doc(user._id).update({ data: updates });
      const merged = { ...user, ...updates };
      return {
        success: true,
        user: { id: merged.id, nickname: merged.nickname, avatarColor: merged.avatarColor, avatarUrl: merged.avatarUrl, role: merged.role }
      };

    } else if (action === 'makeMeAdmin') {
      const res = await db.collection('users').where({ _openid: OPENID }).get();
      if (res.data.length === 0) return { success: false, error: '用户不存在' };

      const user = res.data[0];
      await db.collection('users').doc(user._id).update({ data: { role: 'admin' } });
      return { success: true, message: '已成功设置为管理员' };

    } else {
      return { success: false, error: '未知操作' };
    }
  } catch (err) {
    console.error('auth error:', err);
    return { success: false, error: err.message || '操作失败' };
  }
};
