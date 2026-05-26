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
    // ---------- CREATE ----------
    if (action === 'create') {
      const user = await getCallerUser();
      const { eventData } = event;

      const newEvent = {
        ...eventData,
        id: 'e_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        creatorId: user.id,
        participants: [user.id],
        participantsInfo: [{
          userId: user.id,
          nickname: user.nickname,
          avatarColor: user.avatarColor,
          avatarUrl: user.avatarUrl || ''
        }],
        createdAt: new Date().toISOString()
      };

      await db.collection('events').add({ data: newEvent });
      return { success: true, event: newEvent };

    // ---------- UPDATE ----------
    } else if (action === 'update') {
      const user = await getCallerUser();
      const { eventId, eventData } = event;

      const res = await db.collection('events').where({ id: eventId }).get();
      if (res.data.length === 0) return { success: false, error: '活动不存在' };
      if (res.data[0].creatorId !== user.id) return { success: false, error: '仅创建者可编辑' };

      await db.collection('events').doc(res.data[0]._id).update({ data: eventData });
      return { success: true };

    // ---------- DELETE ----------
    } else if (action === 'delete') {
      const user = await getCallerUser();
      const { eventId } = event;

      const res = await db.collection('events').where({ id: eventId }).get();
      if (res.data.length === 0) return { success: false, error: '活动不存在' };

      const evt = res.data[0];
      if (evt.creatorId !== user.id && user.role !== 'admin') {
        return { success: false, error: '无权删除此活动' };
      }

      await db.collection('events').doc(evt._id).remove();
      return { success: true };

    // ---------- JOIN ----------
    } else if (action === 'join') {
      const user = await getCallerUser();
      const { eventId } = event;

      await db.collection('events').where({ id: eventId }).update({
        data: {
          participants: _.addToSet(user.id),
          participantsInfo: _.push({
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
      const { eventId } = event;

      await db.collection('events').where({ id: eventId }).update({
        data: {
          participants: _.pull(user.id),
          participantsInfo: _.pull({ userId: user.id })
        }
      });
      return { success: true };

    // ---------- LIST BY DATE RANGE ----------
    } else if (action === 'listByDateRange') {
      const { startDate, endDate } = event;

      const res = await db.collection('events')
        .where({
          startTime: _.lt(endDate),
          endTime: _.gt(startDate)
        })
        .orderBy('startTime', 'asc')
        .limit(1000)
        .get();
      return { success: true, events: res.data };

    // ---------- LIST BY USER ----------
    } else if (action === 'listByUser') {
      const user = await getCallerUser();
      const { type, page = 0, pageSize = 20 } = event;

      let query;
      if (type === 'created') {
        query = db.collection('events').where({ creatorId: user.id });
      } else {
        query = db.collection('events').where({ participants: user.id });
      }

      const res = await query
        .orderBy('startTime', 'desc')
        .skip(page * pageSize)
        .limit(pageSize + 1)
        .get();

      const hasMore = res.data.length > pageSize;
      const events = hasMore ? res.data.slice(0, pageSize) : res.data;
      return { success: true, events, hasMore };

    // ---------- COUNT BY USER ----------
    } else if (action === 'countByUser') {
      const user = await getCallerUser();

      const [created, joined] = await Promise.all([
        db.collection('events').where({ creatorId: user.id }).count(),
        db.collection('events').where({ participants: user.id }).count()
      ]);

      return { success: true, createdCount: created.total, joinedCount: joined.total };

    } else {
      return { success: false, error: '未知操作' };
    }
  } catch (err) {
    console.error('eventService error:', err);
    return { success: false, error: err.message || '操作失败' };
  }
};
