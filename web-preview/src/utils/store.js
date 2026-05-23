/* ============================================
   State Management (localStorage-backed)
   ============================================ */

import { generateId, CATEGORIES } from './date.js';

const STORAGE_KEY = 'partyup_data';

// Random avatar colors for mock users
const AVATAR_COLORS = ['#9CAF88', '#C8A882', '#8FA3B0', '#B8907E', '#A89CC8', '#C49090'];

function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '?';
}

function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Default state */
function defaultState() {
  return {
    user: null,
    events: [],
    theme: 'light',
  };
}

/** Load state from localStorage */
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
  return defaultState();
}

/** Save state to localStorage */
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

// ── Reactive store ──
const listeners = new Set();
let state = loadState();

export const store = {
  get state() { return state; },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  _notify() {
    saveState(state);
    listeners.forEach(fn => fn(state));
  },

  // ── Auth ──
  login(nickName) {
    const id = 'user_' + generateId();
    state.user = {
      id,
      nickName,
      avatarUrl: null,
      initial: getInitial(nickName),
      avatarColor: getAvatarColor(nickName),
      isAdmin: false,
    };
    // First user = admin
    if (state.events.length === 0 || !state.events.some(e => e.creator)) {
      state.user.isAdmin = true;
    }
    this._notify();
    return state.user;
  },

  logout() {
    state.user = null;
    this._notify();
  },

  getUser() {
    return state.user;
  },

  isLoggedIn() {
    return !!state.user;
  },

  // ── Theme ──
  setTheme(theme) {
    state.theme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    this._notify();
  },

  getTheme() {
    return state.theme;
  },

  toggleTheme() {
    this.setTheme(state.theme === 'light' ? 'dark' : 'light');
  },

  // ── Events ──
  getEvents() {
    return state.events;
  },

  getEventsForDate(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const dEnd = new Date(d);
    dEnd.setHours(23, 59, 59, 999);

    return state.events.filter(ev => {
      const start = new Date(ev.startTime);
      const end = new Date(ev.endTime);
      return start <= dEnd && end >= d;
    });
  },

  getEventsForMonth(year, month) {
    return state.events.filter(ev => {
      const start = new Date(ev.startTime);
      return start.getFullYear() === year && start.getMonth() === month;
    });
  },

  getEventById(id) {
    return state.events.find(e => e.id === id);
  },

  createEvent(data) {
    if (!state.user) return null;
    const event = {
      id: generateId(),
      title: data.title,
      startTime: data.startTime,
      endTime: data.endTime,
      location: data.location || '',
      category: data.category || CATEGORIES[0],
      reminder: data.reminder ?? 15,
      creator: { ...state.user },
      participants: [{ ...state.user, joinedAt: new Date().toISOString() }],
      participantCount: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.events.push(event);
    this._notify();
    return event;
  },

  updateEvent(id, data) {
    const idx = state.events.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const ev = state.events[idx];
    if (!state.user) return null;
    if (ev.creator.id !== state.user.id && !state.user.isAdmin) return null;

    Object.assign(ev, data, { updatedAt: new Date().toISOString() });
    this._notify();
    return ev;
  },

  deleteEvent(id) {
    const idx = state.events.findIndex(e => e.id === id);
    if (idx === -1) return false;
    const ev = state.events[idx];
    if (!state.user) return false;
    if (ev.creator.id !== state.user.id && !state.user.isAdmin) return false;

    state.events.splice(idx, 1);
    this._notify();
    return true;
  },

  joinEvent(id) {
    if (!state.user) return false;
    const ev = state.events.find(e => e.id === id);
    if (!ev) return false;
    if (ev.participants.some(p => p.id === state.user.id)) return false;

    ev.participants.push({ ...state.user, joinedAt: new Date().toISOString() });
    ev.participantCount = ev.participants.length;
    ev.updatedAt = new Date().toISOString();
    this._notify();
    return true;
  },

  leaveEvent(id) {
    if (!state.user) return false;
    const ev = state.events.find(e => e.id === id);
    if (!ev) return false;
    // Creator cannot leave
    if (ev.creator.id === state.user.id) return false;

    const idx = ev.participants.findIndex(p => p.id === state.user.id);
    if (idx === -1) return false;

    ev.participants.splice(idx, 1);
    ev.participantCount = ev.participants.length;
    ev.updatedAt = new Date().toISOString();
    this._notify();
    return true;
  },

  getMyEvents() {
    if (!state.user) return { upcoming: [], past: [] };
    const now = new Date();
    const myEvents = state.events.filter(ev =>
      ev.participants.some(p => p.id === state.user.id)
    );
    const upcoming = myEvents
      .filter(ev => new Date(ev.endTime) >= now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));
    const past = myEvents
      .filter(ev => new Date(ev.endTime) < now)
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
    return { upcoming, past };
  },

  isParticipant(eventId) {
    if (!state.user) return false;
    const ev = state.events.find(e => e.id === eventId);
    if (!ev) return false;
    return ev.participants.some(p => p.id === state.user.id);
  },

  isCreator(eventId) {
    if (!state.user) return false;
    const ev = state.events.find(e => e.id === eventId);
    if (!ev) return false;
    return ev.creator.id === state.user.id;
  },

  // ── Seed demo data ──
  seedDemoData() {
    if (state.events.length > 0) return;

    const today = new Date();
    const mockCreator = {
      id: 'demo_creator',
      nickName: '派对达人',
      avatarUrl: null,
      initial: '派',
      avatarColor: '#B8907E',
      isAdmin: true,
    };
    const mockUser2 = {
      id: 'demo_user2',
      nickName: '运动小王',
      avatarUrl: null,
      initial: '运',
      avatarColor: '#9CAF88',
    };
    const mockUser3 = {
      id: 'demo_user3',
      nickName: '吃货小李',
      avatarUrl: null,
      initial: '吃',
      avatarColor: '#C8A882',
    };

    const demoEvents = [
      {
        title: '周三晨跑',
        dayOffset: (3 - today.getDay() + 7) % 7 || 7,
        startHour: 7, startMin: 0, endHour: 8, endMin: 30,
        category: CATEGORIES[0], location: '奥林匹克森林公园',
        participants: [mockCreator, mockUser2],
      },
      {
        title: '周五精酿之夜',
        dayOffset: (5 - today.getDay() + 7) % 7 || 7,
        startHour: 19, startMin: 30, endHour: 22, endMin: 0,
        category: CATEGORIES[1], location: 'Craft Beer Bar · 三里屯',
        participants: [mockCreator, mockUser2, mockUser3],
      },
      {
        title: '周末香山徒步',
        dayOffset: (6 - today.getDay() + 7) % 7 || 7,
        startHour: 8, startMin: 0, endHour: 16, endMin: 0,
        category: CATEGORIES[2], location: '香山公园北门',
        participants: [mockCreator, mockUser3],
      },
      {
        title: '今日瑜伽',
        dayOffset: 0,
        startHour: 18, startMin: 0, endHour: 19, endMin: 30,
        category: CATEGORIES[0], location: 'Y+ Yoga · 国贸',
        participants: [mockCreator],
      },
      {
        title: '明日下午茶',
        dayOffset: 1,
        startHour: 14, startMin: 30, endHour: 16, endMin: 0,
        category: CATEGORIES[1], location: '% Arabica · 前门',
        participants: [mockCreator, mockUser2],
      },
    ];

    demoEvents.forEach(de => {
      const d = new Date(today);
      d.setDate(d.getDate() + de.dayOffset);
      const startTime = new Date(d);
      startTime.setHours(de.startHour, de.startMin, 0, 0);
      const endTime = new Date(d);
      endTime.setHours(de.endHour, de.endMin, 0, 0);

      state.events.push({
        id: generateId(),
        title: de.title,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        location: de.location,
        category: de.category,
        reminder: 30,
        creator: mockCreator,
        participants: de.participants.map(p => ({ ...p, joinedAt: new Date().toISOString() })),
        participantCount: de.participants.length,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    this._notify();
  },
};

export { getInitial, getAvatarColor };
