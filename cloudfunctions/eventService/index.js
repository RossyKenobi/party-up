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

function generateId() {
  return 'e_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/** Generate recurring event instances */
function expandRecurrence(baseEvent, recurrence, recurrenceEndDate) {
  const instances = [];
  const start = new Date(baseEvent.startTime);
  const end = new Date(baseEvent.endTime);
  const duration = end.getTime() - start.getTime();
  const endLimit = new Date(recurrenceEndDate);
  endLimit.setHours(23, 59, 59, 999);

  let current = new Date(start);
  while (current <= endLimit) {
    const instanceStart = new Date(current);
    const instanceEnd = new Date(current.getTime() + duration);
    instances.push({
      startTime: instanceStart.toISOString(),
      endTime: instanceEnd.toISOString()
    });

    if (recurrence === 'weekly') {
      current.setDate(current.getDate() + 7);
    } else if (recurrence === 'biweekly') {
      current.setDate(current.getDate() + 14);
    } else if (recurrence === 'monthly') {
      current.setMonth(current.getMonth() + 1);
    } else {
      break;
    }
  }
  return instances;
}

exports.main = async (event) => {
  const { action } = event;

  try {
    // ---------- CREATE ----------
    if (action === 'create') {
      const user = await getCallerUser();
      const { eventData } = event;

      const baseParticipants = [user.id];
      const baseParticipantsInfo = [{
        userId: user.id,
        nickname: user.nickname,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl || ''
      }];

      // If group event, add all group members
      if (eventData.groupId) {
        const groupRes = await db.collection('groups').where({ id: eventData.groupId }).get();
        if (groupRes.data.length > 0) {
          const group = groupRes.data[0];
          for (const member of group.members) {
            if (member.userId !== user.id) {
              baseParticipants.push(member.userId);
              baseParticipantsInfo.push({
                userId: member.userId,
                nickname: member.nickname,
                avatarColor: member.avatarColor,
                avatarUrl: member.avatarUrl || ''
              });
            }
          }
        }
      }

      const recurrence = eventData.recurrence || 'none';
      const recurrenceEndDate = eventData.recurrenceEndDate || null;

      // Non-recurring event
      if (recurrence === 'none') {
        const newEvent = {
          ...eventData,
          id: generateId(),
          creatorId: user.id,
          participants: baseParticipants,
          participantsInfo: baseParticipantsInfo,
          isPrivate: eventData.isPrivate || false,
          recurrence: 'none',
          seriesId: null,
          createdAt: new Date().toISOString()
        };
        delete newEvent.recurrenceEndDate;
        await db.collection('events').add({ data: newEvent });
        return { success: true, event: newEvent };
      }

      // Recurring event - batch expand
      const seriesId = 's_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
      const instances = expandRecurrence(eventData, recurrence, recurrenceEndDate);

      const createdEvents = [];
      for (const inst of instances) {
        const newEvent = {
          ...eventData,
          id: generateId(),
          startTime: inst.startTime,
          endTime: inst.endTime,
          creatorId: user.id,
          participants: [...baseParticipants],
          participantsInfo: [...baseParticipantsInfo],
          isPrivate: eventData.isPrivate || false,
          recurrence,
          recurrenceEndDate,
          seriesId,
          createdAt: new Date().toISOString()
        };
        await db.collection('events').add({ data: newEvent });
        createdEvents.push(newEvent);
      }

      return { success: true, event: createdEvents[0], count: createdEvents.length };

    // ---------- UPDATE ----------
    } else if (action === 'update') {
      const user = await getCallerUser();
      const { eventId, eventData } = event;

      const res = await db.collection('events').where({ id: eventId }).get();
      if (res.data.length === 0) return { success: false, error: '活动不存在' };
      if (res.data[0].creatorId !== user.id) return { success: false, error: '仅创建者可编辑' };

      await db.collection('events').doc(res.data[0]._id).update({ data: eventData });
      return { success: true };

    // ---------- UPDATE SERIES ----------
    } else if (action === 'updateSeries') {
      const user = await getCallerUser();
      const { seriesId, eventData } = event;

      if (!seriesId) return { success: false, error: '缺少 seriesId' };

      const now = new Date().toISOString();
      const seriesEvents = await db.collection('events').where({
        seriesId,
        startTime: _.gte(now)
      }).get();

      if (seriesEvents.data.length === 0) return { success: false, error: '没有可更新的未来事件' };
      if (seriesEvents.data[0].creatorId !== user.id) return { success: false, error: '仅创建者可编辑' };

      // Remove time fields from batch update (each instance keeps its own schedule)
      const safeData = { ...eventData };
      delete safeData.startTime;
      delete safeData.endTime;
      delete safeData.id;
      delete safeData._id;
      delete safeData.seriesId;
      delete safeData.creatorId;
      delete safeData.participants;
      delete safeData.participantsInfo;
      delete safeData.createdAt;

      // Reset reminded flag if reminder changed
      if (safeData.reminder !== undefined) {
        safeData.reminded = _.remove();
      }

      let updated = 0;
      for (const evt of seriesEvents.data) {
        await db.collection('events').doc(evt._id).update({ data: safeData });
        updated++;
      }

      return { success: true, updated };

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

    // ---------- DELETE SERIES ----------
    } else if (action === 'deleteSeries') {
      const user = await getCallerUser();
      const { seriesId } = event;

      if (!seriesId) return { success: false, error: '缺少 seriesId' };

      const now = new Date().toISOString();
      const seriesEvents = await db.collection('events').where({
        seriesId,
        startTime: _.gte(now)
      }).get();

      if (seriesEvents.data.length === 0) return { success: false, error: '没有可删除的未来事件' };
      if (seriesEvents.data[0].creatorId !== user.id && user.role !== 'admin') {
        return { success: false, error: '无权删除此系列活动' };
      }

      let deleted = 0;
      for (const evt of seriesEvents.data) {
        await db.collection('events').doc(evt._id).remove();
        deleted++;
      }

      return { success: true, deleted };

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
      const { startDate, endDate, userId } = event;

      const res = await db.collection('events')
        .where({
          startTime: _.lt(endDate),
          endTime: _.gt(startDate)
        })
        .orderBy('startTime', 'asc')
        .limit(1000)
        .get();

      // Filter out private events that don't belong to the requesting user
      const events = userId
        ? res.data.filter(e => !e.isPrivate || e.creatorId === userId || (e.participants && e.participants.includes(userId)))
        : res.data.filter(e => !e.isPrivate);

      return { success: true, events };

    // ---------- LIST BY GROUP ----------
    } else if (action === 'listByGroup') {
      const { groupId } = event;
      const now = new Date().toISOString();

      const res = await db.collection('events')
        .where({
          groupId,
          startTime: _.gte(now)
        })
        .orderBy('startTime', 'asc')
        .limit(50)
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

    // ---------- GET QR CODE ----------
    } else if (action === 'getQRCode') {
      const user = await getCallerUser();
      const { eventId, envVersion } = event;

      const res = await db.collection('events').where({ id: eventId }).get();
      if (res.data.length === 0) return { success: false, error: '活动不存在' };
      const eventDoc = res.data[0];

      try {
        const qrResult = await cloud.openapi.wxacode.getUnlimited({
          scene: eventId,
          page: 'pages/detail/detail',
          envVersion: envVersion || 'release',
          checkPath: false,
          width: 430,
          is_hyaline: true
        });

        const ext = qrResult.contentType === 'image/jpeg' ? 'jpg' : 'png';
        const cloudPath = `qrcodes/event_${eventId}_${envVersion || 'release'}_${Date.now()}.${ext}`;

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
    console.error('eventService error:', err);
    return { success: false, error: err.message || '操作失败' };
  }
};
