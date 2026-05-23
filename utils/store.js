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
