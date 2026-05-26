import { generateId } from './date.js';

const CURRENT_USER_KEY = 'party_up_current_user';

let db = null;
function getDB() {
  if (!db) {
    db = wx.cloud.database();
  }
  return db;
}

// -----------------------------------------------------------------------------
// USER API
// -----------------------------------------------------------------------------

export function getCurrentUser() {
  try {
    return wx.getStorageSync(CURRENT_USER_KEY) || null;
  } catch (e) {
    return null;
  }
}

export async function login(nickname, avatarColor, avatarUrl = '') {
  const database = getDB();
  const res = await database.collection('users').where({ nickname }).get();
  
  let user;
  if (res.data.length > 0) {
    user = res.data[0];
    if (avatarUrl && user.avatarUrl !== avatarUrl) {
      await database.collection('users').doc(user._id).update({
        data: { avatarUrl }
      });
      user.avatarUrl = avatarUrl;
    }
  } else {
    user = {
      id: 'u_' + Date.now().toString(36),
      nickname,
      avatarColor,
      avatarUrl,
      role: 'user'
    };
    await database.collection('users').add({ data: user });
  }
  
  wx.setStorageSync(CURRENT_USER_KEY, user);
  return user;
}

export function logout() {
  wx.removeStorageSync(CURRENT_USER_KEY);
}

// -----------------------------------------------------------------------------
// EVENT API
// -----------------------------------------------------------------------------

export async function getEvents() {
  const database = getDB();
  // Note: By default, get() returns up to 20 records. For a production app, pagination is needed.
  const res = await database.collection('events').get();
  return res.data;
}

export async function createEvent(eventData) {
  const database = getDB();
  const currentUser = getCurrentUser();
  
  const newEvent = {
    ...eventData,
    id: generateId(),
    creatorId: currentUser ? currentUser.id : 'anonymous',
    participants: currentUser ? [currentUser.id] : [],
    createdAt: new Date().toISOString(),
  };
  
  await database.collection('events').add({ data: newEvent });
  return newEvent;
}

export async function joinEvent(eventId) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('需登录');
  
  const database = getDB();
  const _ = database.command;
  
  await database.collection('events').where({ id: eventId }).update({
    data: {
      participants: _.addToSet(currentUser.id)
    }
  });
}

export async function leaveEvent(eventId) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('需登录');
  
  const database = getDB();
  const _ = database.command;
  
  await database.collection('events').where({ id: eventId }).update({
    data: {
      participants: _.pull(currentUser.id)
    }
  });
}

export async function deleteEvent(eventId) {
  const database = getDB();
  await database.collection('events').where({ id: eventId }).remove();
}

export async function updateEvent(eventId, eventData) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('需登录');
  
  const database = getDB();
  await database.collection('events').where({ id: eventId, creatorId: currentUser.id }).update({
    data: eventData
  });
}

export async function getEventById(id) {
  const database = getDB();
  const res = await database.collection('events').where({ id }).get();
  return res.data.length > 0 ? res.data[0] : null;
}

export async function getUserById(id) {
  const database = getDB();
  const res = await database.collection('users').where({ id }).get();
  return res.data.length > 0 ? res.data[0] : null;
}

// -----------------------------------------------------------------------------
// GROUP API
// -----------------------------------------------------------------------------

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
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('需登录');
  const database = getDB();

  const group = {
    id: 'g_' + generateId(),
    name,
    creatorId: currentUser.id,
    memberIds: [currentUser.id],
    members: [{
      userId: currentUser.id,
      nickname: currentUser.nickname,
      avatarColor: currentUser.avatarColor,
      avatarUrl: currentUser.avatarUrl || ''
    }],
    maxMembers,
    isAnonymous,
    allowNewMembers: true,
    allowVoting: true,
    voteDeadline,
    createdAt: new Date().toISOString()
  };

  await database.collection('groups').add({ data: group });
  return group;
}

export async function joinGroup(groupId) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('需登录');
  const database = getDB();
  const _ = database.command;

  const group = await getGroupById(groupId);
  if (!group) throw new Error('小组不存在');
  if (!group.allowNewMembers) throw new Error('该小组已关闭加入');
  if (group.memberIds.includes(currentUser.id)) throw new Error('你已在小组中');
  if (group.memberIds.length >= group.maxMembers) throw new Error('小组人数已满');

  await database.collection('groups').where({ id: groupId }).update({
    data: {
      memberIds: _.addToSet(currentUser.id),
      members: _.push({
        userId: currentUser.id,
        nickname: currentUser.nickname,
        avatarColor: currentUser.avatarColor,
        avatarUrl: currentUser.avatarUrl || ''
      })
    }
  });
}

export async function leaveGroup(groupId) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('需登录');
  const database = getDB();
  const _ = database.command;

  await database.collection('groups').where({ id: groupId }).update({
    data: {
      memberIds: _.pull(currentUser.id),
      members: _.pull({ userId: currentUser.id })
    }
  });
}

export async function updateGroupSettings(groupId, settings) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('需登录');
  const database = getDB();
  await database.collection('groups').where({ id: groupId, creatorId: currentUser.id }).update({
    data: settings
  });
}

// -----------------------------------------------------------------------------
// PLACE API
// -----------------------------------------------------------------------------

export async function getPlacesByGroup(groupId) {
  const database = getDB();
  const res = await database.collection('places').where({ groupId }).orderBy('createdAt', 'asc').get();
  return res.data;
}

export async function addPlace(groupId, text) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('需登录');
  const database = getDB();

  // Check limit
  const existing = await database.collection('places').where({ groupId }).count();
  if (existing.total >= 50) throw new Error('地点数量已达上限');

  const place = {
    id: 'p_' + generateId(),
    groupId,
    text: text.trim(),
    creatorId: currentUser.id,
    voters: [],
    createdAt: new Date().toISOString()
  };

  await database.collection('places').add({ data: place });
  return place;
}

export async function deletePlace(placeId, groupId) {
  const database = getDB();
  await database.collection('places').where({ id: placeId, groupId }).remove();
}

export async function votePlace(placeId) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('需登录');
  const database = getDB();
  const _ = database.command;

  // Check current vote status
  const res = await database.collection('places').where({ id: placeId }).get();
  if (res.data.length === 0) throw new Error('地点不存在');

  const place = res.data[0];
  const hasVoted = place.voters.includes(currentUser.id);

  await database.collection('places').where({ id: placeId }).update({
    data: {
      voters: hasVoted ? _.pull(currentUser.id) : _.addToSet(currentUser.id)
    }
  });

  return !hasVoted; // returns new vote state
}

// -----------------------------------------------------------------------------
// COMMENT API
// -----------------------------------------------------------------------------

export async function getCommentsByGroup(groupId) {
  const database = getDB();
  const res = await database.collection('comments')
    .where({ groupId })
    .orderBy('createdAt', 'asc')
    .limit(200)
    .get();
  return res.data;
}

export async function addComment(groupId, placeId, text) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('需登录');
  const database = getDB();

  const comment = {
    id: 'c_' + generateId(),
    groupId,
    placeId,
    userId: currentUser.id,
    nickname: currentUser.nickname,
    avatarColor: currentUser.avatarColor,
    avatarUrl: currentUser.avatarUrl || '',
    text: text.trim().slice(0, 50),
    createdAt: new Date().toISOString()
  };

  await database.collection('comments').add({ data: comment });
  return comment;
}

export async function deleteComment(commentId) {
  const database = getDB();
  await database.collection('comments').where({ id: commentId }).remove();
}

// -----------------------------------------------------------------------------
// NOTIFICATION API
// -----------------------------------------------------------------------------

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
