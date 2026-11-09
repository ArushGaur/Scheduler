import { db, ensureSchema } from './db.js';
import { ELECTIVES, classesFor, allBaseClasses } from './curriculum.js';
import { resolveSchedule, occurrencesOn, dowOf } from './resolve.js';

export class ValidationError extends Error {}
export class AuthError extends Error {
  constructor() {
    super('Please sign in');
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super('Only the owner can change the class schedule');
  }
}

// The one account allowed to add, edit, cancel and remove classes for everyone.
// Set ADMIN_EMAIL to hand this to someone else.
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'arushgaur16@gmail.com').trim().toLowerCase();
export const isAdmin = (email) => typeof email === 'string' && email.trim().toLowerCase() === ADMIN_EMAIL;

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

async function readChanges() {
  const rs = await db().execute('SELECT id, kind, data FROM schedule_changes ORDER BY created_at, id');
  return rs.rows.map((r) => ({ id: r[0], kind: r[1], data: parse(r[2], {}) }));
}

export async function getSchedule(email) {
  const u = cleanEmail(email);
  await ensureSchema();
  const c = db();
  const [profile, ro, at, changes] = await Promise.all([
    profileOf(u),
    c.execute({ sql: 'SELECT items FROM user_routines WHERE user_email = ?', args: [u] }),
    c.execute({ sql: 'SELECT date, records FROM user_attendance WHERE user_email = ? ORDER BY date', args: [u] }),
    readChanges(),
  ]);

  // The built-in classes come from code; the owner's changes (shared by everyone) come from the database.
  const { classes, extras, exceptions } = resolveSchedule(classesFor(profile.elective), changes, profile.elective);
  const known = new Set(classes.map((k) => k.id));
  const extraDate = new Map(extras.map((x) => [x.id, x.date]));
  extras.forEach((x) => known.add(x.id));
  const cancelled = new Set(exceptions.filter((e) => e.cancelled).map((e) => `${e.class_id}|${e.date}`));

  const routines = (ro.rows.length ? parse(ro.rows[0][0], []) : [])
    .filter((r) => r && typeof r === 'object')
    .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  const attendance = [];
  // Database rows are read by position (row[0], row[1]), they cannot be destructured like arrays.
  for (const row of at.rows) {
    const date = row[0];
    for (const [class_id, status] of Object.entries(parse(row[1], {}))) {
      if (!known.has(class_id) || (status !== 'present' && status !== 'absent')) continue;
      if (extraDate.has(class_id) && extraDate.get(class_id) !== date) continue;
      if (cancelled.has(`${class_id}|${date}`)) continue; // a cancelled class does not count
      attendance.push({ class_id, date, status });
    }
  }

  const out = { classes, extras, exceptions, routines, attendance, profile, isAdmin: isAdmin(u) };
  if (out.isAdmin) out.admin = adminView(changes);
  return out;
}

// What the owner sees in the "Schedule changes" panel: every change, for every audience.
function adminView(changes) {
  const names = new Map(allBaseClasses().map((c) => [c.id, c]));
  changes.filter((c) => c.kind === 'added').forEach((c) => names.set(c.id, { id: c.id, ...c.data }));
  const label = (id) => {
    const k = names.get(id);
    return k ? { subject: k.subject, type: k.type, day_of_week: k.day_of_week, start_time: k.start_time } : { subject: 'Unknown class' };
  };
  const pick = (kind) => changes.filter((c) => c.kind === kind);
  return {
    extras: pick('extra')
      .map((c) => ({ id: c.id, ...c.data, day_of_week: dowOf(c.data.date) }))
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
    added: pick('added').map((c) => ({ id: c.id, ...c.data })),
    overrides: pick('override').map((c) => ({ ...c.data, ...label(c.data.class_id) })),
    exceptions: pick('exception')
      .map((c) => ({ ...c.data, ...label(c.data.class_id) }))
      .sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
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

// Attendance can be marked, changed or cleared for today and earlier dates.
function checkMarkable(date) {
  if (typeof date !== 'string' || !DATE_RE.test(date)) fail('date must look like 2026-10-01');
  if (date > todayKey()) fail('Attendance cannot be marked for a future date');
}

export async function setAttendance(email, { class_id, date, status }) {
  const u = cleanEmail(email);
  await ensureSchema();
  if (typeof class_id !== 'string' || !ID_RE.test(class_id)) fail('class_id is required');
  if (status !== 'present' && status !== 'absent') fail('status must be present or absent');
  checkMarkable(date);

  // The class must be one of this person's own classes on that date (weekly class that is not cancelled, or an extra class on its date).
  const { elective } = await profileOf(u);
  const { classes, extras, exceptions } = resolveSchedule(classesFor(elective), await readChanges(), elective);
  const cls = occurrencesOn(date, dowOf(date), classes, extras, exceptions).find((k) => k.id === class_id);
  if (!cls) fail('That class was not found');
  if (cls.cancelled) fail('That class is cancelled on this day');

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
    for (const row of rs.rows) {
      const date = row[0];
      const all = parse(row[1], {});
      const kept = Object.fromEntries(Object.entries(all).filter(([id]) => !id.startsWith(prefix)));
      if (Object.keys(kept).length === Object.keys(all).length) continue;
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

/* ---------- owner tools (changes everyone sees) ---------- */

const hex = () => crypto.randomUUID().replace(/-/g, '').slice(0, 8);
const optional = (v, max = 60) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function audienceOf(v) {
  if (v === undefined || v === null || v === 'all') return 'all';
  if (!ELECTIVES[v]) fail('Pick who the class is for');
  return v;
}

function realDate(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v) || new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) fail('Pick a valid date');
  return v;
}

function timesOf(input) {
  const start = time(input.start_time, 'Start time');
  const end = time(input.end_time, 'End time');
  if (end <= start) fail('End time must be after start time');
  return { start_time: start, end_time: end };
}

function identityOf(input) {
  return {
    subject: text(input.subject, 'Subject').slice(0, 60),
    code: optional(input.code, 20),
    type: optional(input.type, 30) || 'Lecture',
    room: optional(input.room, 30),
    teacher: optional(input.teacher, 40),
    audience: audienceOf(input.audience),
  };
}

const putChange = (id, kind, data) =>
  db().execute({
    sql: 'INSERT INTO schedule_changes (id, kind, data) VALUES (?, ?, ?) ON CONFLICT (id) DO UPDATE SET data = excluded.data',
    args: [id, kind, JSON.stringify(data)],
  });

async function getChange(id, kind) {
  const rs = await db().execute({ sql: 'SELECT data FROM schedule_changes WHERE id = ? AND kind = ?', args: [id, kind] });
  return rs.rows.length ? parse(rs.rows[0][0], {}) : null;
}

const deleteChange = (id) => db().execute({ sql: 'DELETE FROM schedule_changes WHERE id = ?', args: [id] });
const deleteExceptionsOf = (class_id) =>
  db().execute({ sql: "DELETE FROM schedule_changes WHERE kind = 'exception' AND json_extract(data, '$.class_id') = ?", args: [class_id] });

// A weekly class (built-in or added by the owner) as it currently stands, or null.
async function weeklyClass(id) {
  if (typeof id !== 'string' || !ID_RE.test(id)) fail('class is required');
  const added = await getChange(id, 'added');
  if (added) return { id, ...added, builtin: false };
  const base = allBaseClasses().find((c) => c.id === id);
  if (!base) fail('That class was not found');
  const o = (await getChange(`o_${id}`, 'override')) || {};
  return { ...base, ...(o.day_of_week !== undefined ? { day_of_week: o.day_of_week } : {}), builtin: true };
}

async function checkOccurrence(input) {
  const cls = await weeklyClass(input.class_id);
  const date = realDate(input.date);
  if (dowOf(date) !== cls.day_of_week) fail(`${cls.subject} does not run on that day`);
  return { cls, date };
}

export async function adminAction(email, input) {
  const u = cleanEmail(email);
  if (!isAdmin(u)) throw new ForbiddenError();
  await ensureSchema();
  const a = input?.action;

  switch (a) {
    // One-off class on a single date.
    case 'addExtra': {
      const id = `x${hex()}`;
      await putChange(id, 'extra', { ...identityOf(input), ...timesOf(input), date: realDate(input.date) });
      return { ok: true, id };
    }
    case 'updateExtra': {
      if (!(await getChange(String(input.id), 'extra'))) fail('That extra class was not found');
      await putChange(String(input.id), 'extra', { ...identityOf(input), ...timesOf(input), date: realDate(input.date) });
      return { ok: true };
    }
    case 'deleteExtra': {
      if (!(await getChange(String(input.id), 'extra'))) fail('That extra class was not found');
      await deleteChange(String(input.id));
      return { ok: true };
    }

    // New weekly class.
    case 'addClass': {
      const fields = { ...identityOf(input), ...timesOf(input) };
      const days = dayList(input.days);
      for (const d of days) await putChange(`a${hex()}`, 'added', { ...fields, day_of_week: d });
      return { ok: true };
    }
    // Edit every week. Built-in classes can change room, teacher, day and time; added classes can change everything.
    case 'updateClass': {
      const cls = await weeklyClass(input.id);
      const day = Number.isInteger(input.day_of_week) && input.day_of_week >= 0 && input.day_of_week <= 6 ? input.day_of_week : fail('Pick a day');
      const times = timesOf(input);
      if (cls.builtin) {
        const prev = (await getChange(`o_${cls.id}`, 'override')) || {};
        await putChange(`o_${cls.id}`, 'override', {
          ...prev,
          class_id: cls.id,
          room: optional(input.room, 30),
          teacher: optional(input.teacher, 40),
          day_of_week: day,
          ...times,
        });
      } else {
        await putChange(cls.id, 'added', { ...identityOf(input), ...times, day_of_week: day });
      }
      return { ok: true };
    }
    // Remove from the timetable. Built-in classes are only hidden (they can be restored); added ones are deleted.
    case 'removeClass': {
      const cls = await weeklyClass(input.id);
      if (cls.builtin) {
        const prev = (await getChange(`o_${cls.id}`, 'override')) || {};
        await putChange(`o_${cls.id}`, 'override', { ...prev, class_id: cls.id, removed: true });
      } else {
        await deleteChange(cls.id);
        await deleteExceptionsOf(cls.id);
      }
      return { ok: true };
    }
    // Undo removal and edits of a built-in class.
    case 'resetClass': {
      const cls = await weeklyClass(input.id);
      if (!cls.builtin) fail('Only built-in classes can be reset');
      await deleteChange(`o_${cls.id}`);
      return { ok: true };
    }

    // One date only.
    case 'cancelOccurrence': {
      const { cls, date } = await checkOccurrence(input);
      await putChange(`e_${cls.id}_${date}`, 'exception', { class_id: cls.id, date, cancelled: true });
      return { ok: true };
    }
    case 'changeOccurrence': {
      const { cls, date } = await checkOccurrence(input);
      await putChange(`e_${cls.id}_${date}`, 'exception', {
        class_id: cls.id,
        date,
        room: optional(input.room, 30),
        teacher: optional(input.teacher, 40),
        ...timesOf(input),
      });
      return { ok: true };
    }
    case 'restoreOccurrence': {
      const cls = await weeklyClass(input.class_id);
      await deleteChange(`e_${cls.id}_${realDate(input.date)}`);
      return { ok: true };
    }
    default:
      return fail('Unknown action');
  }
}
