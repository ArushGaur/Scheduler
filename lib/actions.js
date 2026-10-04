import { db, ensureSchema } from './db.js';
import { CORE_CLASSES, CORE_ROUTINES, ELECTIVES, ELECTIVE_CODES, electiveOf } from './curriculum.js';

export class ValidationError extends Error {}
export class AuthError extends Error {
  constructor() {
    super('Please sign in');
  }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

const optional = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

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
/* ---------- reads ---------- */

export async function getSchedule(email) {
  const u = cleanEmail(email);
  await ensureSchema();
  const c = db();
  const [cl, ro, at, pr] = await Promise.all([
    c.execute({ sql: 'SELECT * FROM classes WHERE user_email = ? ORDER BY day_of_week, start_time', args: [u] }),
    c.execute({ sql: 'SELECT * FROM routines WHERE user_email = ? ORDER BY day_of_week, start_time', args: [u] }),
    c.execute({ sql: 'SELECT class_id, date, status FROM attendance WHERE user_email = ?', args: [u] }),
    c.execute({ sql: 'SELECT 1 FROM profiles WHERE user_email = ?', args: [u] }),
  ]);
  const classes = rowsOf(cl);
  const routines = rowsOf(ro);
  return {
    classes,
    routines,
    attendance: rowsOf(at),
    // setup is false only for brand new people, who then get the elective picker.
    // Anyone who already has data (saved before this existed) skips it.
    profile: { setup: pr.rows.length > 0 || classes.length > 0 || routines.length > 0, elective: electiveOf(classes) },
  };
}

/* ---------- routines ---------- */

export async function addRoutine(email, input) {
  const u = cleanEmail(email);
  await ensureSchema();
  const title = text(input.title, 'Title');
  const days = dayList(input.days);
  const start = time(input.start_time, 'Start time');
  const end = input.end_time ? time(input.end_time, 'End time') : null;
  if (end && end <= start) fail('End time must be after start time');
  await db().batch(
    days.map((d) => ({
      sql: 'INSERT INTO routines (user_email, title, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
      args: [u, title, d, start, end],
    })),
    'write'
  );
  return { ok: true, added: title, days: days.map(dayName), start_time: start, end_time: end };
}

export async function updateRoutine(email, id, input) {
  const u = cleanEmail(email);
  await ensureSchema();
  const days = dayList(input.days);
  const start = time(input.start_time, 'Start time');
  const end = input.end_time ? time(input.end_time, 'End time') : null;
  if (end && end <= start) fail('End time must be after start time');
  await db().execute({
    sql: 'UPDATE routines SET title = ?, day_of_week = ?, start_time = ?, end_time = ? WHERE id = ? AND user_email = ?',
    args: [text(input.title, 'Title'), days[0], start, end, id, u],
  });
  return { ok: true };
}

export async function deleteRoutine(email, id) {
  const u = cleanEmail(email);
  await ensureSchema();
  await db().execute({ sql: 'DELETE FROM routines WHERE id = ? AND user_email = ?', args: [id, u] });
  return { ok: true };
}

/* ---------- attendance ---------- */

export async function setAttendance(email, { class_id, date, status }) {
  const u = cleanEmail(email);
  await ensureSchema();
  if (!Number.isInteger(class_id)) fail('class_id is required');
  if (typeof date !== 'string' || !DATE_RE.test(date)) fail('date must look like 2026-10-01');
  if (status !== 'present' && status !== 'absent') fail('status must be present or absent');
  // Only the owner of a class can mark attendance for it.
  const own = await db().execute({ sql: 'SELECT 1 FROM classes WHERE id = ? AND user_email = ?', args: [class_id, u] });
  if (!own.rows.length) fail('That class was not found');
  await db().execute({
    sql: `INSERT INTO attendance (user_email, class_id, date, status) VALUES (?, ?, ?, ?)
          ON CONFLICT (class_id, date) DO UPDATE SET status = excluded.status`,
    args: [u, class_id, date, status],
  });
  return { ok: true };
}

export async function clearAttendance(email, class_id, date) {
  const u = cleanEmail(email);
  await ensureSchema();
  await db().execute({ sql: 'DELETE FROM attendance WHERE class_id = ? AND date = ? AND user_email = ?', args: [class_id, date, u] });
  return { ok: true };
}

/* ---------- starting timetable and electives ---------- */

const classKey = (subject, type, day, start) => [subject, type || '', day, start].join('|').toLowerCase();

async function markSetup(u) {
  await db().execute({ sql: 'INSERT OR IGNORE INTO profiles (user_email) VALUES (?)', args: [u] });
}

// Gives this person the elective, and removes any other elective they had (with its attendance).
async function applyElective(u, key) {
  const el = ELECTIVES[key];
  if (!el) fail('Pick one of the listed electives');
  const mine = rowsOf(await db().execute({ sql: 'SELECT * FROM classes WHERE user_email = ?', args: [u] }));
  const stale = mine.filter((c) => ELECTIVE_CODES.has(c.code) && c.code !== el.code).map((c) => c.id);
  const have = new Set(mine.filter((c) => c.code === el.code).map((c) => classKey(c.subject, c.type, c.day_of_week, c.start_time)));

  const statements = [];
  if (stale.length) {
    const marks = stale.map(() => '?').join(',');
    statements.push({ sql: `DELETE FROM attendance WHERE user_email = ? AND class_id IN (${marks})`, args: [u, ...stale] });
    statements.push({ sql: `DELETE FROM classes WHERE user_email = ? AND id IN (${marks})`, args: [u, ...stale] });
  }
  for (const [code, subject, type, room, teacher, day, start, end] of el.classes) {
    if (have.has(classKey(subject, type, day, start))) continue;
    statements.push({
      sql: 'INSERT INTO classes (user_email, subject, code, type, room, teacher, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [u, subject, code, type, room || null, teacher || null, day, start, end],
    });
  }
  if (statements.length) await db().batch(statements, 'write');
}

// First sign-in: the shared timetable (skipping anything they already have) plus their elective.
export async function startTimetable(email, key) {
  const u = cleanEmail(email);
  await ensureSchema();
  if (!ELECTIVES[key]) fail('Pick one of the listed electives');
  const mine = rowsOf(await db().execute({ sql: 'SELECT * FROM classes WHERE user_email = ?', args: [u] }));
  const haveClass = new Set(mine.map((c) => classKey(c.subject, c.type, c.day_of_week, c.start_time)));
  const myRoutines = rowsOf(await db().execute({ sql: 'SELECT * FROM routines WHERE user_email = ?', args: [u] }));
  const haveRoutine = new Set(myRoutines.map((r) => [r.title, r.day_of_week, r.start_time].join('|').toLowerCase()));

  const statements = [];
  for (const [code, subject, type, room, teacher, day, start, end] of CORE_CLASSES) {
    if (haveClass.has(classKey(subject, type, day, start))) continue;
    statements.push({
      sql: 'INSERT INTO classes (user_email, subject, code, type, room, teacher, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [u, subject, code, type, room || null, teacher || null, day, start, end],
    });
  }
  for (const r of CORE_ROUTINES) {
    for (const d of r.days) {
      if (haveRoutine.has([r.title, d, r.start_time].join('|').toLowerCase())) continue;
      statements.push({
        sql: 'INSERT INTO routines (user_email, title, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?)',
        args: [u, r.title, d, r.start_time, r.end_time],
      });
    }
  }
  if (statements.length) await db().batch(statements, 'write');
  await applyElective(u, key);
  await markSetup(u);
  return { ok: true };
}

// Switch elective later. The old elective's attendance is removed with its classes.
export async function changeElective(email, key) {
  const u = cleanEmail(email);
  await ensureSchema();
  await applyElective(u, key);
  await markSetup(u);
  return { ok: true };
}
