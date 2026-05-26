const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

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
      const { groupId, placeId, text } = event;

      if (!text || !text.trim()) return { success: false, error: '评论不能为空' };

      // Verify user is member of the group
      const groupRes = await db.collection('groups').where({ id: groupId }).get();
      if (groupRes.data.length === 0) return { success: false, error: '小组不存在' };
      if (!groupRes.data[0].memberIds.includes(user.id)) return { success: false, error: '你不是该小组成员' };

      const comment = {
        id: 'c_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        groupId,
        placeId,
        userId: user.id,
        nickname: user.nickname,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl || '',
        text: text.trim().slice(0, 50),
        createdAt: new Date().toISOString()
      };

      await db.collection('comments').add({ data: comment });
      return { success: true, comment };

    // ---------- DELETE ----------
    } else if (action === 'delete') {
      const user = await getCallerUser();
      const { commentId } = event;

      const res = await db.collection('comments').where({ id: commentId }).get();
      if (res.data.length === 0) return { success: false, error: '评论不存在' };

      const comment = res.data[0];

      // Permission: comment author or group creator
      if (comment.userId !== user.id) {
        const groupRes = await db.collection('groups').where({ id: comment.groupId }).get();
        const isGroupCreator = groupRes.data.length > 0 && groupRes.data[0].creatorId === user.id;
        if (!isGroupCreator) {
          return { success: false, error: '无权删除此评论' };
        }
      }

      await db.collection('comments').doc(comment._id).remove();
      return { success: true };

    } else {
      return { success: false, error: '未知操作' };
    }
  } catch (err) {
    console.error('commentService error:', err);
    return { success: false, error: err.message || '操作失败' };
  }
};
