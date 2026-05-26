const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { groupId, callerId } = event;

  try {
    // 1. Verify group exists
    const groupRes = await db.collection('groups').where({ id: groupId }).get();
    if (groupRes.data.length === 0) {
      return { success: false, error: '小组不存在' };
    }
    const group = groupRes.data[0];

    // 2. Creator cannot leave (must dissolve)
    if (group.creatorId === callerId) {
      return { success: false, error: '组长不能退出小组，请使用解散功能' };
    }

    // 3. Verify caller is a member
    if (!group.memberIds.includes(callerId)) {
      return { success: false, error: '你不在该小组中' };
    }

    // 4. Remove from group
    await db.collection('groups').where({ id: groupId }).update({
      data: {
        memberIds: _.pull(callerId),
        members: _.pull({ userId: callerId })
      }
    });

    // 5. Remove votes from all places in this group
    const placesRes = await db.collection('places').where({ groupId }).get();
    for (const place of placesRes.data) {
      if (place.voters && place.voters.includes(callerId)) {
        await db.collection('places').doc(place._id).update({
          data: {
            voters: _.pull(callerId)
          }
        });
      }
    }

    // 6. Delete user's comments in this group
    const commentsRes = await db.collection('comments').where({ groupId, userId: callerId }).get();
    for (const comment of commentsRes.data) {
      await db.collection('comments').doc(comment._id).remove();
    }

    return { success: true };
  } catch (err) {
    console.error('leaveGroup error:', err);
    return { success: false, error: err.message || '操作失败' };
  }
};
