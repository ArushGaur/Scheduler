import { createClient } from '@libsql/client';
import { ELECTIVES, classId, classesFor } from './curriculum.js';

// Every row belongs to a person, identified by their Google email (user_email).
//
// The class timetable is NOT stored here, it lives in lib/curriculum.js.
//   profiles         one row per person: which elective they picked
//   user_routines    one row per person: all their routines, as a JSON list in `items`
//   user_attendance  one row per person per date: every class marked that day, as JSON in `records`
//                    e.g. {"CE2103_lecture_1_0900":"present","CE2104_lecture_1_1100":"absent"}
//   schedule_changes changes made by the owner that everyone sees (extra classes, cancellations,
//                    edited or added weekly classes). See lib/resolve.js for the kinds.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS profiles (
  user_email TEXT PRIMARY KEY,
  elective TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_routines (
  user_email TEXT PRIMARY KEY,
  items TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS user_attendance (
  user_email TEXT NOT NULL,
  date TEXT NOT NULL,
  records TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_email, date)
);

CREATE TABLE IF NOT EXISTS schedule_changes (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

// Keep one client alive across hot reloads in development.
const g = globalThis;

export function db() {
  if (!g.__ttClient) {
    g.__ttClient = createClient({
      url: process.env.TURSO_DATABASE_URL || 'file:local.db',
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
  }
  return g.__ttClient;
}

export function ensureSchema() {
  if (!g.__ttReady) {
    g.__ttReady = db()
      .executeMultiple(SCHEMA)
      .then(migrate)
      .catch((err) => {
        g.__ttReady = null;
        throw err;
      });
  }
  return g.__ttReady;
}

const rowsOf = (rs) => rs.rows.map((r) => Object.fromEntries(rs.columns.map((c, i) => [c, r[i]])));

async function hasTable(name) {
  const rs = await db().execute({ sql: "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", args: [name] });
  return rs.rows.length > 0;
}

async function hasColumn(table, col) {
  const info = await db().execute(`PRAGMA table_info(${table})`);
  return info.rows.some((r) => r[1] === col);
}

async function migrate() {
  if (!(await hasColumn('profiles', 'elective'))) await db().execute('ALTER TABLE profiles ADD COLUMN elective TEXT');
  await migrateLegacy();
}

// Older versions kept one row per class, per routine and per attendance mark in the tables
// `classes`, `routines` and `attendance`. This copies that data into the new tables one time,
// then renames the old tables to legacy_* (nothing is deleted, so you can drop them yourself later).
async function migrateLegacy() {
  if (!(await hasTable('classes')) || !(await hasColumn('classes', 'user_email'))) return;

  const read = async (table, needed) =>
    (await hasTable(table)) && (await hasColumn(table, needed)) ? rowsOf(await db().execute(`SELECT * FROM ${table} WHERE user_email IS NOT NULL`)) : [];

  const classes = await read('classes', 'user_email');
  const routines = await read('routines', 'user_email');
  const marks = await read('attendance', 'user_email');

  const users = new Map(); // email -> { classes: [], routines: [] }
  const userOf = (email) => {
    const u = String(email).trim().toLowerCase();
    if (!users.has(u)) users.set(u, { classes: [] });
    return users.get(u);
  };
  classes.forEach((c) => userOf(c.user_email).classes.push(c));
  routines.forEach((r) => userOf(r.user_email));
  marks.forEach((a) => userOf(a.user_email));

  const statements = [];

  // Which elective each person had, judged by the course codes of their old classes.
  const electiveOf = new Map();
  for (const [email, u] of users) {
    const key = Object.values(ELECTIVES).find((e) => u.classes.some((c) => c.code === e.code))?.key ?? null;
    electiveOf.set(email, key);
    statements.push({ sql: 'INSERT OR IGNORE INTO profiles (user_email, elective) VALUES (?, ?)', args: [email, key] });
    if (key) statements.push({ sql: 'UPDATE profiles SET elective = ? WHERE user_email = ? AND elective IS NULL', args: [key, email] });
  }

  // Routines: one row per person. The Lunch routine that used to be added for everyone is not carried over.
  const items = new Map();
  routines.forEach((r) => {
    if (r.title === 'Lunch' && r.start_time === '13:00' && r.end_time === '14:00') return;
    const email = String(r.user_email).trim().toLowerCase();
    if (!items.has(email)) items.set(email, []);
    items.get(email).push({ id: `m${r.id}`, title: r.title, day_of_week: r.day_of_week, start_time: r.start_time, end_time: r.end_time || null });
  });
  for (const email of users.keys()) {
    statements.push({ sql: 'INSERT OR IGNORE INTO user_routines (user_email, items) VALUES (?, ?)', args: [email, JSON.stringify(items.get(email) || [])] });
  }

  // Attendance: one row per person per date. Old class ids are mapped to the new ids from curriculum.js.
  const oldClass = new Map(classes.map((c) => [c.id, c]));
  const byDate = new Map(); // "email|date" -> records
  marks.forEach((a) => {
    const c = oldClass.get(a.class_id);
    if (!c) return;
    const email = String(a.user_email).trim().toLowerCase();
    const id = classId(c.code, c.type, c.day_of_week, c.start_time);
    if (!classesFor(electiveOf.get(email)).some((k) => k.id === id)) return;
    const key = `${email}|${a.date}`;
    byDate.set(key, { ...(byDate.get(key) || {}), [id]: a.status });
  });
  for (const [key, records] of byDate) {
    const [email, date] = key.split('|');
    statements.push({ sql: 'INSERT OR IGNORE INTO user_attendance (user_email, date, records) VALUES (?, ?, ?)', args: [email, date, JSON.stringify(records)] });
  }

  for (const t of ['classes', 'routines', 'attendance']) {
    if (await hasTable(t)) statements.push(`ALTER TABLE ${t} RENAME TO legacy_${t}`);
  }

  try {
    await db().batch(statements, 'write');
  } catch (err) {
    // Another server instance may have finished the same migration first.
    if (await hasTable('classes')) throw err;
  }
}
