export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// The week is shown Monday first.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n) => String(n).padStart(2, '0');

export const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export function fmt(t) {
  const h = Number(t.slice(0, 2));
  const m = t.slice(3, 5);
  const hh = h % 12 || 12;
  const ap = h >= 12 ? 'pm' : 'am';
  return m === '00' ? `${hh} ${ap}` : `${hh}:${m} ${ap}`;
}

// "11 to 11:55 am" when both ends share am/pm, otherwise "11 am to 1 pm".
export function fmtRange(a, b) {
  const sameHalf = (Number(a.slice(0, 2)) >= 12) === (Number(b.slice(0, 2)) >= 12);
  if (!sameHalf) return `${fmt(a)} to ${fmt(b)}`;
  const strip = (t) => fmt(t).replace(/ (am|pm)$/, '');
  return `${strip(a)} to ${fmt(b)}`;
}

export const fmtMin = (min) => fmt(`${pad(Math.floor(min / 60))}:${pad(min % 60)}`);

export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function weekStartOf(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return addDays(x, -((x.getDay() + 6) % 7));
}

export const clockString = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
