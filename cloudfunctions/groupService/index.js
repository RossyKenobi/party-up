const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

async function getCallerUser() {
  const { OPENID } = cloud.getWXContext();
  if (!OPENID) throw new Error('无法获取用户身份');
  const res = await db.collection('users').where({ _openid: OPENID }).get();
  if (res.data.length === 0) throw new Error('用户未登录');
  return res.data[0];
}

async function getGroup(groupId) {
  const res = await db.collection('groups').where({ id: groupId }).get();
  if (res.data.length === 0) return null;
  return res.data[0];
}

exports.main = async (event) => {
  const { action } = event;

  try {
    // ---------- CREATE ----------
    if (action === 'create') {
      const user = await getCallerUser();
      const { name, maxMembers = 10, isAnonymous = false, voteDeadline = null } = event;

      if (!name || !name.trim()) return { success: false, error: '小组名不能为空' };

      const group = {
        id: 'g_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        name: name.trim(),
        creatorId: user.id,
        memberIds: [user.id],
        members: [{
          userId: user.id,
          nickname: user.nickname,
          avatarColor: user.avatarColor,
          avatarUrl: user.avatarUrl || ''
        }],
        maxMembers,
        isAnonymous,
        allowNewMembers: true,
        allowVoting: true,
        voteDeadline,
        createdAt: new Date().toISOString()
      };

      await db.collection('groups').add({ data: group });
      return { success: true, group };

    // ---------- JOIN ----------
    } else if (action === 'join') {
      const user = await getCallerUser();
      const { groupId } = event;

      const group = await getGroup(groupId);
      if (!group) return { success: false, error: '小组不存在' };
      if (!group.allowNewMembers) return { success: false, error: '该小组已关闭新成员加入' };
      if (group.memberIds.includes(user.id)) return { success: false, error: '你已在小组中' };
      if (group.memberIds.length >= group.maxMembers) return { success: false, error: '小组人数已满' };

      await db.collection('groups').doc(group._id).update({
        data: {
          memberIds: _.addToSet(user.id),
          members: _.push({
            userId: user.id,
            nickname: user.nickname,
            avatarColor: user.avatarColor,
            avatarUrl: user.avatarUrl || ''
          })
        }
      });
      return { success: true };

    // ---------- LEAVE ----------
    } else if (action === 'leave') {
      const user = await getCallerUser();
      const { groupId } = event;

      const group = await getGroup(groupId);
      if (!group) return { success: false, error: '小组不存在' };
      if (group.creatorId === user.id) return { success: false, error: '组长不能退出小组，请使用解散功能' };
      if (!group.memberIds.includes(user.id)) return { success: false, error: '你不在该小组中' };

      // Remove from group
      await db.collection('groups').doc(group._id).update({
        data: {
          memberIds: _.pull(user.id),
          members: _.pull({ userId: user.id })
        }
      });

      // Remove votes from all places
      const placesRes = await db.collection('places').where({ groupId }).get();
      for (const place of placesRes.data) {
        if (place.voters && place.voters.includes(user.id)) {
          await db.collection('places').doc(place._id).update({
            data: { voters: _.pull(user.id) }
          });
        }
      }

      // Delete user's comments
      const commentsRes = await db.collection('comments').where({ groupId, userId: user.id }).get();
      for (const comment of commentsRes.data) {
        await db.collection('comments').doc(comment._id).remove();
      }

      return { success: true };

    // ---------- UPDATE SETTINGS ----------
    } else if (action === 'updateSettings') {
      const user = await getCallerUser();
      const { groupId, settings } = event;

      const group = await getGroup(groupId);
      if (!group) return { success: false, error: '小组不存在' };
      if (group.creatorId !== user.id) return { success: false, error: '仅组长可修改设置' };

      // Whitelist allowed settings
      const allowed = ['allowNewMembers', 'allowVoting', 'isAnonymous', 'voteDeadline', 'maxMembers'];
      const safeSettings = {};
      for (const key of allowed) {
        if (settings[key] !== undefined) safeSettings[key] = settings[key];
      }

      await db.collection('groups').doc(group._id).update({ data: safeSettings });
      return { success: true };

    // ---------- KICK ----------
    } else if (action === 'kick') {
      const user = await getCallerUser();
      const { groupId, targetUserId } = event;

      if (!targetUserId) return { success: false, error: '缺少目标用户' };

      const group = await getGroup(groupId);
      if (!group) return { success: false, error: '小组不存在' };
      if (group.creatorId !== user.id) return { success: false, error: '仅组长可执行此操作' };

      // Remove from group
      await db.collection('groups').doc(group._id).update({
        data: {
          memberIds: _.pull(targetUserId),
          members: _.pull({ userId: targetUserId })
        }
      });

      // Remove votes from all places
      const placesRes = await db.collection('places').where({ groupId }).get();
      for (const place of placesRes.data) {
        if (place.voters && place.voters.includes(targetUserId)) {
          await db.collection('places').doc(place._id).update({
            data: { voters: _.pull(targetUserId) }
          });
        }
      }

      // Create notification
      await db.collection('notifications').add({
        data: {
          userId: targetUserId,
          type: 'kicked',
          groupName: group.name,
          message: `你已被移出小组「${group.name}」`,
          read: false,
          createdAt: new Date().toISOString()
        }
      });

      return { success: true };

    // ---------- DISSOLVE ----------
    } else if (action === 'dissolve') {
      const user = await getCallerUser();
      const { groupId } = event;

      const group = await getGroup(groupId);
      if (!group) return { success: false, error: '小组不存在' };
      if (group.creatorId !== user.id) return { success: false, error: '仅组长可解散小组' };

      // Notify all members except creator
      const otherMembers = group.memberIds.filter(id => id !== group.creatorId);
      for (const memberId of otherMembers) {
        await db.collection('notifications').add({
          data: {
            userId: memberId,
            type: 'group_dissolved',
            groupName: group.name,
            message: `小组「${group.name}」已被组长解散`,
            read: false,
            createdAt: new Date().toISOString()
          }
        });
      }

      // Delete all places
      const allPlaces = await db.collection('places').where({ groupId }).get();
      for (const place of allPlaces.data) {
        await db.collection('places').doc(place._id).remove();
      }

      // Delete all comments
      const allComments = await db.collection('comments').where({ groupId }).get();
      for (const comment of allComments.data) {
        await db.collection('comments').doc(comment._id).remove();
      }

      // Delete the group
      await db.collection('groups').doc(group._id).remove();

      return { success: true };

    // ---------- GET QR CODE ----------
    } else if (action === 'getQRCode') {
      // NOTE: getCallerUser is NOT checked here because anyone with group ID might want the poster,
      // but usually only members generate it. Let's enforce membership just in case.
      const user = await getCallerUser();
      const { groupId, envVersion } = event;
      
      const group = await getGroup(groupId);
      if (!group) return { success: false, error: '小组不存在' };
      if (!group.memberIds.includes(user.id)) return { success: false, error: '非小组成员无法生成分享码' };
      
      try {
        const qrResult = await cloud.openapi.wxacode.getUnlimited({
          scene: groupId,
          page: 'pages/group-detail/group-detail',
          envVersion: envVersion || 'release',
          checkPath: false,
          width: 430,
          is_hyaline: true
        });

        // qrResult.buffer contains the image data
        const ext = qrResult.contentType === 'image/jpeg' ? 'jpg' : 'png';
        const cloudPath = `qrcodes/${groupId}_${envVersion || 'release'}_${Date.now()}.${ext}`;

        const uploadResult = await cloud.uploadFile({
          cloudPath: cloudPath,
          fileContent: qrResult.buffer
        });

        return { success: true, fileID: uploadResult.fileID };
      } catch (err) {
        console.error('getUnlimited error', err);
        return { success: false, error: '生成二维码失败: ' + err.message };
      }

    } else {
      return { success: false, error: '未知操作' };
    }
  } catch (err) {
    console.error('groupService error:', err);
    return { success: false, error: err.message || '操作失败' };
  }
};
