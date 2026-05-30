import { generateId } from './date.js';

const CURRENT_USER_KEY = 'party_up_current_user';

let db = null;
function getDB() {
  if (!db) {
    db = wx.cloud.database();
  }
  return db;
}

// =============================================================================
// USER API
// =============================================================================

export async function getUsersByIds(userIds) {
  if (!userIds || userIds.length === 0) return [];
  const database = getDB();
  const _ = database.command;
  try {
    const res = await database.collection('users').where({
      id: _.in(userIds)
    }).get();
    return res.data;
  } catch (e) {
    console.error('getUsersByIds failed:', e);
    return [];
  }
}

export function getCurrentUser() {
  try {
    return wx.getStorageSync(CURRENT_USER_KEY) || null;
  } catch (e) {
    return null;
  }
}

export async function login(nickname, avatarColor, avatarUrl = '') {
  const res = await wx.cloud.callFunction({
    name: 'auth',
    data: { action: 'login', nickname, avatarColor, avatarUrl }
  });

  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '登录失败');
  }

  const user = res.result.user;
  wx.setStorageSync(CURRENT_USER_KEY, user);
  return user;
}

export async function refreshUserSession() {
  const cached = getCurrentUser();
  if (!cached) {
    try {
      const res = await wx.cloud.callFunction({
        name: 'auth',
        data: { action: 'silentLogin' }
      });
      if (res.result && res.result.success) {
        wx.setStorageSync(CURRENT_USER_KEY, res.result.user);
        return res.result.user;
      }
    } catch (e) {
      console.warn('Silent login failed:', e);
    }
    return null;
  }

  try {
    const res = await wx.cloud.callFunction({
      name: 'auth',
      data: { action: 'login', nickname: cached.nickname, avatarColor: cached.avatarColor, avatarUrl: cached.avatarUrl }
    });
    if (res.result && res.result.success) {
      wx.setStorageSync(CURRENT_USER_KEY, res.result.user);
      return res.result.user;
    }
  } catch (e) {
    console.warn('Silent re-auth failed:', e);
  }
  return cached;
}

export function logout() {
  wx.removeStorageSync(CURRENT_USER_KEY);
}

// =============================================================================
// EVENT API — All writes go through eventService cloud function
// =============================================================================

export async function createEvent(eventData) {
  const res = await wx.cloud.callFunction({
    name: 'eventService',
    data: { action: 'create', eventData }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '创建失败');
  }
  return res.result.event;
}

export async function updateEvent(eventId, eventData) {
  const res = await wx.cloud.callFunction({
    name: 'eventService',
    data: { action: 'update', eventId, eventData }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '更新失败');
  }
}

export async function deleteEvent(eventId) {
  const res = await wx.cloud.callFunction({
    name: 'eventService',
    data: { action: 'delete', eventId }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '删除失败');
  }
  return res.result;
}

export async function deleteEventSeries(seriesId) {
  const res = await wx.cloud.callFunction({
    name: 'eventService',
    data: { action: 'deleteSeries', seriesId }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '删除系列失败');
  }
  return res.result;
}

export async function joinEvent(eventId) {
  const res = await wx.cloud.callFunction({
    name: 'eventService',
    data: { action: 'join', eventId }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '加入失败');
  }
}

export async function leaveEvent(eventId) {
  const res = await wx.cloud.callFunction({
    name: 'eventService',
    data: { action: 'leave', eventId }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '退出失败');
  }
}

// --- Event Read Operations (still client-side for now, optimized in Phase 3) ---

export async function getEvents() {
  const database = getDB();
  const res = await database.collection('events').limit(100).get();
  return res.data;
}

export async function getEventsByDateRange(startDate, endDate, userId) {
  const res = await wx.cloud.callFunction({
    name: 'eventService',
    data: { action: 'listByDateRange', startDate, endDate, userId }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '查询失败');
  }
  return res.result.events;
}

export async function getMyEventsList(type, page = 0, pageSize = 20) {
  const res = await wx.cloud.callFunction({
    name: 'eventService',
    data: { action: 'listByUser', type, page, pageSize }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '查询失败');
  }
  return res.result;
}

export async function getMyEventCounts() {
  const res = await wx.cloud.callFunction({
    name: 'eventService',
    data: { action: 'countByUser' }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '查询失败');
  }
  return res.result;
}

export async function getEventById(id) {
  const database = getDB();
  const res = await database.collection('events').where({ id }).get();
  return res.data.length > 0 ? res.data[0] : null;
}

export async function updateEventSeries(seriesId, eventData) {
  const res = await wx.cloud.callFunction({
    name: 'eventService',
    data: { action: 'updateSeries', seriesId, eventData }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '更新失败');
  }
}

export async function getEventsByGroup(groupId) {
  const res = await wx.cloud.callFunction({
    name: 'eventService',
    data: { action: 'listByGroup', groupId }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '查询失败');
  }
  return res.result.events;
}

// =============================================================================
// GROUP API — All writes go through groupService cloud function
// =============================================================================

export async function getMyGroups() {
  const currentUser = getCurrentUser();
  if (!currentUser) return [];
  const database = getDB();
  const res = await database.collection('groups').where({
    memberIds: currentUser.id
  }).orderBy('createdAt', 'desc').get();
  return res.data;
}

export async function getGroupById(id) {
  const database = getDB();
  const res = await database.collection('groups').where({ id }).get();
  return res.data.length > 0 ? res.data[0] : null;
}

export async function createGroup({ name, maxMembers = 10, isAnonymous = false, voteDeadline = null }) {
  const res = await wx.cloud.callFunction({
    name: 'groupService',
    data: { action: 'create', name, maxMembers, isAnonymous, voteDeadline }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '创建失败');
  }
  return res.result.group;
}

export async function getEventQRCode(eventId, envVersion) {
  const { result } = await wx.cloud.callFunction({
    name: 'eventService',
    data: { action: 'getQRCode', eventId, envVersion }
  });
  if (!result.success) throw new Error(result.error);
  return result.fileID;
}

export async function joinGroup(groupId) {
  const res = await wx.cloud.callFunction({
    name: 'groupService',
    data: { action: 'join', groupId }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '加入失败');
  }
}

export async function updateGroupSettings(groupId, settings) {
  const res = await wx.cloud.callFunction({
    name: 'groupService',
    data: { action: 'updateSettings', groupId, settings }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '更新失败');
  }
}

// =============================================================================
// PLACE API — All writes go through placeService cloud function
// =============================================================================

export async function getPlacesByGroup(groupId) {
  const database = getDB();
  const res = await database.collection('places').where({ groupId }).orderBy('createdAt', 'asc').get();
  return res.data;
}

export async function addPlace(groupId, text) {
  const res = await wx.cloud.callFunction({
    name: 'placeService',
    data: { action: 'add', groupId, text }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '添加失败');
  }
  return res.result.place;
}

export async function deletePlace(placeId, groupId) {
  const res = await wx.cloud.callFunction({
    name: 'placeService',
    data: { action: 'delete', placeId, groupId }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '删除失败');
  }
}

export async function votePlace(placeId) {
  const res = await wx.cloud.callFunction({
    name: 'placeService',
    data: { action: 'vote', placeId }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '投票失败');
  }
  return res.result.voted;
}

export async function reorderPlaces(groupId, placeIds) {
  const res = await wx.cloud.callFunction({
    name: 'placeService',
    data: { action: 'reorder', groupId, placeIds }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '排序失败');
  }
}

// =============================================================================
// COMMENT API — All writes go through commentService cloud function
// =============================================================================

export async function getCommentsByGroup(groupId) {
  const database = getDB();
  try {
    const res = await database.collection('comments')
      .where({ groupId })
      .orderBy('createdAt', 'asc')
      .limit(200)
      .get();
    return res.data;
  } catch (e) {
    console.warn('getCommentsByGroup failed (collection may not exist yet):', e);
    return [];
  }
}

export async function addComment(groupId, placeId, text) {
  const res = await wx.cloud.callFunction({
    name: 'commentService',
    data: { action: 'add', groupId, placeId, text }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '发送失败');
  }
  return res.result.comment;
}

export async function deleteComment(commentId) {
  const res = await wx.cloud.callFunction({
    name: 'commentService',
    data: { action: 'delete', commentId }
  });
  if (!res.result || !res.result.success) {
    throw new Error((res.result && res.result.error) || '删除失败');
  }
}

// =============================================================================
// NOTIFICATION API — Read operations (client-side), writes only from cloud
// =============================================================================

export async function getUnreadNotifications() {
  const currentUser = getCurrentUser();
  if (!currentUser) return [];
  const database = getDB();
  const res = await database.collection('notifications').where({
    userId: currentUser.id,
    read: false
  }).orderBy('createdAt', 'desc').get();
  return res.data;
}

export async function markNotificationRead(notifId) {
  const database = getDB();
  await database.collection('notifications').doc(notifId).update({
    data: { read: true }
  });
}

export async function markAllNotificationsRead() {
  const currentUser = getCurrentUser();
  if (!currentUser) return;
  const database = getDB();
  await database.collection('notifications').where({
    userId: currentUser.id,
    read: false
  }).update({
    data: { read: true }
  });
}
