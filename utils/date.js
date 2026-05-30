/* ============================================
   Date Utility Functions
   ============================================ */

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const DAY_NAMES_SHORT = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_NAMES = [
  '一月', '二月', '三月', '四月', '五月', '六月',
  '七月', '八月', '九月', '十月', '十一月', '十二月'
];

/** Get the Monday of the week containing `date` */
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday = start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Get array of 7 dates for the week containing `date` */
export function getWeekDates(date) {
  const start = getWeekStart(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Check if two dates are the same day */
export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Check if date is today */
export function isToday(date) {
  return isSameDay(date, new Date());
}

/** Add days to a date */
export function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Add weeks to a date */
export function addWeeks(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

/** Add months to a date */
export function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/** Format time as HH:MM */
export function formatTime(date) {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Format date as "M月D日" */
export function formatDate(date) {
  const d = new Date(date);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** Format date as "YYYY年M月D日 周X" */
export function formatDateFull(date) {
  const d = new Date(date);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${DAY_NAMES[d.getDay()]}`;
}

/** Get days in month grid (including padding from prev/next month), starting Monday */
export function getMonthGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  let startDay = firstDay.getDay(); // 0=Sun
  startDay = startDay === 0 ? 6 : startDay - 1; // Convert to Mon=0

  const days = [];

  // Previous month padding
  for (let i = startDay - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, currentMonth: false });
  }

  // Current month
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), currentMonth: true });
  }

  // Next month padding (fill to 6 rows)
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), currentMonth: false });
  }

  return days;
}

/** Get month name */
export function getMonthName(month) {
  return MONTH_NAMES[month];
}

/** Calculate top position and height for a timeline event */
export function getTimelinePosition(startTime, endTime, hourHeight, baseDate) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  let startMinutes, endMinutes;

  if (baseDate) {
    const base = new Date(baseDate);
    base.setHours(0, 0, 0, 0);
    startMinutes = (start.getTime() - base.getTime()) / (1000 * 60);
    endMinutes = (end.getTime() - base.getTime()) / (1000 * 60);
  } else {
    startMinutes = start.getHours() * 60 + start.getMinutes();
    endMinutes = end.getHours() * 60 + end.getMinutes();
    if (end < start) {
      endMinutes += 24 * 60;
    }
  }

  const top = (startMinutes / 60) * hourHeight;
  const height = Math.max(((endMinutes - startMinutes) / 60) * hourHeight, 24);
  return { top, height };
}

/** Get "now" position for the red line on timeline */
export function getNowLinePosition(hourHeight) {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  return (minutes / 60) * hourHeight;
}

/** Generate a simple unique ID */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/** Check if an event falls on a given date */
export function eventOnDate(event, date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const start = new Date(event.startTime);
  start.setHours(0, 0, 0, 0);
  const end = new Date(event.endTime);
  end.setHours(0, 0, 0, 0);
  return d >= start && d <= end;
}

/** Reminder options */
export const REMINDER_OPTIONS = [
  { value: 0, label: '事件开始时' },
  { value: 5, label: '5分钟前' },
  { value: 15, label: '15分钟前' },
  { value: 30, label: '30分钟前' },
  { value: 60, label: '1小时前' },
  { value: 120, label: '2小时前' },
  { value: 1440, label: '1天前' },
];

/** Event categories */
export const CATEGORIES = [
  { id: 'fitness', emoji: '🏋️', name: '健身', color: '#9CAF88', bg: '#E5EBE0' },
  { id: 'drinks', emoji: '🍺', name: '小酌', color: '#C8A882', bg: '#F4EAE2' },
  { id: 'outdoor', emoji: '⛰️', name: '户外', color: '#8FA3B0', bg: '#E3E9ED' },
  { id: 'food', emoji: '🍽️', name: '聚餐', color: '#D98A6C', bg: '#F8E7E1' },
  { id: 'coffee', emoji: '☕️', name: '咖啡', color: '#A68A6D', bg: '#EFE7E1' },
  { id: 'game', emoji: '🎮', name: '游戏', color: '#769C8A', bg: '#DDE9E3' },
  { id: 'karaoke', emoji: '🎤', name: 'K歌', color: '#A084B6', bg: '#EBE3F0' },
  { id: 'party', emoji: '🎉', name: '派对', color: '#D47B85', bg: '#F6E1E3' },
  { id: 'other', emoji: '👾', name: '其他', color: '#9B9A97', bg: '#EAE9E7' }
];
/** Recurrence options */
export const RECURRENCE_OPTIONS = [
  { value: 'none', label: '不重复' },
  { value: 'weekly', label: '每周' },
  { value: 'biweekly', label: '每两周' },
  { value: 'monthly', label: '每月' },
];

/** Visibility options */
export const VISIBILITY_OPTIONS = [
  { value: false, label: '公开' },
  { value: true, label: '私人' },
];

export { DAY_NAMES, DAY_NAMES_SHORT, MONTH_NAMES };
