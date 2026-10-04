import { db, ensureSchema } from './db.js';
import { ELECTIVES, classesFor } from './curriculum.js';

export class ValidationError extends Error {}
export class AuthError extends Error {
  constructor() {
    super('Please sign in');
  }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9_]+$/;
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// "Today" for attendance is decided here on the server, in this time zone (set APP_TIMEZONE to change it).
const TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Kolkata';
export const todayKey = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const fail = (msg) => {
  throw new ValidationError(msg);
};

const rowsOf = (rs) => rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));

function text(v, label) {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) fail(`${label} is required`);
  return s;
}

const cleanEmail = (e) => {
  const s = typeof e === 'string' ? e.trim().toLowerCase() : '';
  if (!s) throw new AuthError();
  return s;
};

function time(v, label) {
  if (typeof v !== 'string' || !TIME_RE.test(v)) fail(`${label} must be a 24-hour time like 09:30`);
  return v;
}

function dayList(v) {
  if (!Array.isArray(v) || !v.length || v.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    fail('Pick at least one day');
  }
  return [...new Set(v)];
}

const dayName = (d) => DAY_NAMES[d];
const parse = (s, fallback) => {
  try {
    const v = JSON.parse(s);
    return v && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
};

/* ---------- profile ---------- */

async function profileOf(u) {
  const rs = await db().execute({ sql: 'SELECT elective FROM profiles WHERE user_email = ?', args: [u] });
  if (!rs.rows.length) return { setup: false, elective: null };
  const key = rs.rows[0][0];
  return { setup: true, elective: ELECTIVES[key] ? key : null };
}

/* ---------- reads ---------- */

export async function getSchedule(email) {
  const u = cleanEmail(email);
  await ensureSchema();
  const c = db();
  const [profile, ro, at] = await Promise.all([
    profileOf(u),
    c.execute({ sql: 'SELECT items FROM user_routines WHERE user_email = ?', args: [u] }),
    c.execute({ sql: 'SELECT date, records FROM user_attendance WHERE user_email = ? ORDER BY date', args: [u] }),
  ]);

  // The classes come from code, not from the database.
  const classes = classesFor(profile.elective);
  const known = new Set(classes.map((k) => k.id));

  const routines = (ro.rows.length ? parse(ro.rows[0][0], []) : [])
    .filter((r) => r && typeof r === 'object')
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  const attendance = [];
  for (const [date, records] of at.rows) {
    for (const [class_id, status] of Object.entries(parse(records, {}))) {
      if (known.has(class_id) && (status === 'present' || status === 'absent')) attendance.push({ class_id, date, status });
    }
  }

  return { classes, routines, attendance, profile };
}

/* ---------- routines (one row per person, all routines inside) ---------- */

async function readRoutines(u) {
  const rs = await db().execute({ sql: 'SELECT items FROM user_routines WHERE user_email = ?', args: [u] });
  return rs.rows.length ? parse(rs.rows[0][0], []) : [];
}

async function writeRoutines(u, items) {
  await db().execute({
    sql: 'INSERT INTO user_routines (user_email, items) VALUES (?, ?) ON CONFLICT (user_email) DO UPDATE SET items = excluded.items',
    args: [u, JSON.stringify(items)],
  });
}

const newId = () => `r${crypto.randomUUID().slice(0, 8)}`;

function routineInput(input) {
  const start = time(input.start_time, 'Start time');
  const end = input.end_time ? time(input.end_time, 'End time') : null;
  if (end && end <= start) fail('End time must be after start time');
  return { title: text(input.title, 'Title'), days: dayList(input.days), start, end };
}

export async function addRoutine(email, input) {
  const u = cleanEmail(email);
  await ensureSchema();
  const { title, days, start, end } = routineInput(input);
  const items = await readRoutines(u);
  days.forEach((d) => items.push({ id: newId(), title, day_of_week: d, start_time: start, end_time: end }));
  await writeRoutines(u, items);
  return { ok: true, added: title, days: days.map(dayName), start_time: start, end_time: end };
}

export async function updateRoutine(email, id, input) {
  const u = cleanEmail(email);
  await ensureSchema();
  const { title, days, start, end } = routineInput(input);
  const items = await readRoutines(u);
  const i = items.findIndex((r) => r.id === id);
  if (i === -1) fail('That routine was not found');
  items[i] = { id, title, day_of_week: days[0], start_time: start, end_time: end };
  await writeRoutines(u, items);
  return { ok: true };
}

export async function deleteRoutine(email, id) {
  const u = cleanEmail(email);
  await ensureSchema();
  const items = await readRoutines(u);
  await writeRoutines(u, items.filter((r) => r.id !== id));
  return { ok: true };
}

/* ---------- attendance (one row per person per date, all classes of that day inside) ---------- */

// Attendance can only be marked, changed or cleared for today. Earlier days are read only.
function checkMarkable(date) {
  if (typeof date !== 'string' || !DATE_RE.test(date)) fail('date must look like 2026-10-01');
  if (date !== todayKey()) fail('Attendance can only be marked for today');
}

export async function setAttendance(email, { class_id, date, status }) {
  const u = cleanEmail(email);
  await ensureSchema();
  if (typeof class_id !== 'string' || !ID_RE.test(class_id)) fail('class_id is required');
  if (status !== 'present' && status !== 'absent') fail('status must be present or absent');
  checkMarkable(date);

  // The class must be one of this person's own classes, and it must run on that weekday.
  const { elective } = await profileOf(u);
  const cls = classesFor(elective).find((k) => k.id === class_id);
  if (!cls) fail('That class was not found');
  if (new Date(`${date}T00:00:00Z`).getUTCDay() !== cls.day_of_week) fail('That class does not run on this day');

  await db().execute({
    sql: `INSERT INTO user_attendance (user_email, date, records) VALUES (?, ?, json_object(?, ?))
          ON CONFLICT (user_email, date) DO UPDATE SET records = json_set(user_attendance.records, '$.' || ?, ?)`,
    args: [u, date, class_id, status, class_id, status],
  });
  return { ok: true };
}

export async function clearAttendance(email, class_id, date) {
  const u = cleanEmail(email);
  await ensureSchema();
  if (typeof class_id !== 'string' || !ID_RE.test(class_id)) fail('class_id is required');
  checkMarkable(date);
  await db().batch(
    [
      { sql: "UPDATE user_attendance SET records = json_remove(records, '$.' || ?) WHERE user_email = ? AND date = ?", args: [class_id, u, date] },
      { sql: "DELETE FROM user_attendance WHERE user_email = ? AND date = ? AND records = '{}'", args: [u, date] },
    ],
    'write'
  );
  return { ok: true };
}

/* ---------- electives ---------- */

// Saves the elective. If they had a different one before, its attendance is removed from every date.
async function applyElective(u, key) {
  const el = ELECTIVES[key];
  if (!el) fail('Pick one of the listed electives');
  const { elective: previous } = await profileOf(u);

  const statements = [
    {
      sql: 'INSERT INTO profiles (user_email, elective) VALUES (?, ?) ON CONFLICT (user_email) DO UPDATE SET elective = excluded.elective',
      args: [u, key],
    },
  ];

  if (previous && previous !== key) {
    const prefix = `${ELECTIVES[previous].code}_`;
    const rs = await db().execute({ sql: 'SELECT date, records FROM user_attendance WHERE user_email = ?', args: [u] });
    for (const [date, records] of rs.rows) {
      const kept = Object.fromEntries(Object.entries(parse(records, {})).filter(([id]) => !id.startsWith(prefix)));
      if (Object.keys(kept).length === Object.keys(parse(records, {})).length) continue;
      statements.push(
        Object.keys(kept).length
          ? { sql: 'UPDATE user_attendance SET records = ? WHERE user_email = ? AND date = ?', args: [JSON.stringify(kept), u, date] }
          : { sql: 'DELETE FROM user_attendance WHERE user_email = ? AND date = ?', args: [u, date] }
      );
    }
  }
  await db().batch(statements, 'write');
}

// First sign-in: picking the elective is all it takes, the classes themselves come from code.
export async function startTimetable(email, key) {
  const u = cleanEmail(email);
  await ensureSchema();
  await applyElective(u, key);
  return { ok: true };
}

// Switch elective later. The old elective's attendance is removed with it.
export async function changeElective(email, key) {
  const u = cleanEmail(email);
  await ensureSchema();
  await applyElective(u, key);
  return { ok: true };
}
