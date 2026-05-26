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

exports.main = async (event) => {
  const { action } = event;

  try {
    // ---------- ADD ----------
    if (action === 'add') {
      const user = await getCallerUser();
      const { groupId, text } = event;

      if (!text || !text.trim()) return { success: false, error: '地点不能为空' };

      // Verify user is member
      const groupRes = await db.collection('groups').where({ id: groupId }).get();
      if (groupRes.data.length === 0) return { success: false, error: '小组不存在' };
      if (!groupRes.data[0].memberIds.includes(user.id)) return { success: false, error: '你不是该小组成员' };

      // Server-side limit check
      const count = await db.collection('places').where({ groupId }).count();
      if (count.total >= 50) return { success: false, error: '地点数量已达上限' };

      const place = {
        id: 'p_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        groupId,
        text: text.trim(),
        creatorId: user.id,
        voters: [],
        createdAt: new Date().toISOString()
      };

      await db.collection('places').add({ data: place });
      return { success: true, place };

    // ---------- DELETE ----------
    } else if (action === 'delete') {
      const user = await getCallerUser();
      const { placeId, groupId } = event;

      const placeRes = await db.collection('places').where({ id: placeId, groupId }).get();
      if (placeRes.data.length === 0) return { success: false, error: '地点不存在' };

      const place = placeRes.data[0];

      // Check permission: place creator or group creator
      const groupRes = await db.collection('groups').where({ id: groupId }).get();
      const isGroupCreator = groupRes.data.length > 0 && groupRes.data[0].creatorId === user.id;

      if (place.creatorId !== user.id && !isGroupCreator) {
        return { success: false, error: '无权删除此地点' };
      }

      await db.collection('places').doc(place._id).remove();
      return { success: true };

    // ---------- VOTE ----------
    } else if (action === 'vote') {
      const user = await getCallerUser();
      const { placeId } = event;

      const res = await db.collection('places').where({ id: placeId }).get();
      if (res.data.length === 0) return { success: false, error: '地点不存在' };

      const place = res.data[0];
      const hasVoted = place.voters.includes(user.id);

      await db.collection('places').doc(place._id).update({
        data: {
          voters: hasVoted ? _.pull(user.id) : _.addToSet(user.id)
        }
      });

      return { success: true, voted: !hasVoted };

    // ---------- REORDER ----------
    } else if (action === 'reorder') {
      const user = await getCallerUser();
      const { groupId, placeIds } = event;

      if (!Array.isArray(placeIds)) return { success: false, error: '参数错误' };

      // Verify caller is group creator
      const groupRes = await db.collection('groups').where({ id: groupId }).get();
      if (groupRes.data.length === 0) return { success: false, error: '小组不存在' };
      if (groupRes.data[0].creatorId !== user.id) return { success: false, error: '仅组长可排序' };

      const baseTime = Date.now();
      for (let i = 0; i < placeIds.length; i++) {
        // Query by custom id to get _id, then update
        const placeRes = await db.collection('places').where({ id: placeIds[i], groupId }).get();
        if (placeRes.data.length > 0) {
          await db.collection('places').doc(placeRes.data[0]._id).update({
            data: { createdAt: new Date(baseTime + i * 1000).toISOString() }
          });
        }
      }

      return { success: true };

    } else {
      return { success: false, error: '未知操作' };
    }
  } catch (err) {
    console.error('placeService error:', err);
    return { success: false, error: err.message || '操作失败' };
  }
};
