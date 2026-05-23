import { generateId } from './date.js';

const USERS_KEY = 'party_up_users';
const EVENTS_KEY = 'party_up_events';
const CURRENT_USER_KEY = 'party_up_current_user';

export function getLocalData(key, defaultValue) {
  try {
    const data = wx.getStorageSync(key);
    return data ? data : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

export function saveLocalData(key, data) {
  try {
    wx.setStorageSync(key, data);
  } catch (e) {
    console.error('Error saving data', e);
  }
}

// -----------------------------------------------------------------------------
// USER API
// -----------------------------------------------------------------------------

export function getCurrentUser() {
  return getLocalData(CURRENT_USER_KEY, null);
}

export function login(nickname, avatarColor) {
  const users = getLocalData(USERS_KEY, []);
  let user = users.find(u => u.nickname === nickname);
  
  if (!user) {
    user = {
      id: generateId(),
      nickname,
      avatarColor,
      role: 'user', // Default role
    };
    users.push(user);
    saveLocalData(USERS_KEY, users);
  }
  
  saveLocalData(CURRENT_USER_KEY, user);
  return user;
}

export function logout() {
  wx.removeStorageSync(CURRENT_USER_KEY);
}

// -----------------------------------------------------------------------------
// EVENT API
// -----------------------------------------------------------------------------

export function getEvents() {
  return getLocalData(EVENTS_KEY, []);
}

export function createEvent(eventData) {
  const events = getEvents();
  const currentUser = getCurrentUser();
  
  const newEvent = {
    ...eventData,
    id: generateId(),
    creatorId: currentUser ? currentUser.id : 'anonymous',
    participants: currentUser ? [currentUser.id] : [],
    createdAt: new Date().toISOString(),
  };
  
  events.push(newEvent);
  saveLocalData(EVENTS_KEY, events);
  return newEvent;
}

export function joinEvent(eventId) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('需登录');
  
  const events = getEvents();
  const event = events.find(e => e.id === eventId);
  if (event) {
    if (!event.participants.includes(currentUser.id)) {
      event.participants.push(currentUser.id);
      saveLocalData(EVENTS_KEY, events);
    }
  }
}

export function leaveEvent(eventId) {
  const currentUser = getCurrentUser();
  if (!currentUser) throw new Error('需登录');
  
  const events = getEvents();
  const event = events.find(e => e.id === eventId);
  if (event) {
    event.participants = event.participants.filter(id => id !== currentUser.id);
    saveLocalData(EVENTS_KEY, events);
  }
}

export function deleteEvent(eventId) {
  const events = getEvents();
  const filtered = events.filter(e => e.id !== eventId);
  saveLocalData(EVENTS_KEY, filtered);
}

export function getEventById(id) {
  return getEvents().find(e => e.id === id);
}

export function getUserById(id) {
  const users = getLocalData(USERS_KEY, []);
  return users.find(u => u.id === id);
}
