const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { action, groupId, targetUserId } = event;

  try {
    // Verify the caller is the group creator
    const groupRes = await db.collection('groups').where({ id: groupId }).get();
    if (groupRes.data.length === 0) {
      return { success: false, error: '小组不存在' };
    }
    const group = groupRes.data[0];

    // Get caller info from the event (passed from client)
    const callerId = event.callerId;
    if (group.creatorId !== callerId) {
      return { success: false, error: '仅组长可执行此操作' };
    }

    if (action === 'kick') {
      if (!targetUserId) {
        return { success: false, error: '缺少目标用户' };
      }

      // 1. Remove from group
      await db.collection('groups').where({ id: groupId }).update({
        data: {
          memberIds: _.pull(targetUserId),
          members: _.pull({ userId: targetUserId })
        }
      });

      // 2. Remove votes from all places in this group
      const placesRes = await db.collection('places').where({ groupId }).get();
      for (const place of placesRes.data) {
        if (place.voters.includes(targetUserId)) {
          await db.collection('places').doc(place._id).update({
            data: {
              voters: _.pull(targetUserId)
            }
          });
        }
      }

      // 3. Create notification
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

    } else if (action === 'dissolve') {
      // 1. Notify all members except creator
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

      // 2. Delete all places in the group
      const allPlaces = await db.collection('places').where({ groupId }).get();
      for (const place of allPlaces.data) {
        await db.collection('places').doc(place._id).remove();
      }

      // 3. Delete all comments in the group
      const allComments = await db.collection('comments').where({ groupId }).get();
      for (const comment of allComments.data) {
        await db.collection('comments').doc(comment._id).remove();
      }

      // 4. Delete the group
      await db.collection('groups').doc(group._id).remove();

      return { success: true };

    } else {
      return { success: false, error: '未知操作' };
    }
  } catch (err) {
    console.error('groupAdmin error:', err);
    return { success: false, error: err.message || '操作失败' };
  }
};
