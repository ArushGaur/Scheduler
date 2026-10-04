import { createClient } from '@libsql/client';

// Every row belongs to a person, identified by their Google email (user_email).
const SCHEMA = `
CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT,
  subject TEXT NOT NULL,
  room TEXT,
  teacher TEXT,
  code TEXT,
  type TEXT,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS routines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT,
  title TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT,
  class_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent')),
  UNIQUE (class_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance (date);

-- One row per person once they have chosen how to start (elective picked, or empty timetable).
CREATE TABLE IF NOT EXISTS profiles (
  user_email TEXT PRIMARY KEY,
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

async function addColumn(table, col) {
  const info = await db().execute(`PRAGMA table_info(${table})`);
  if (!info.rows.some((r) => r[1] === col)) await db().execute(`ALTER TABLE ${table} ADD COLUMN ${col} TEXT`);
}

// Databases made by older versions get the newer columns here.
async function migrate() {
  await addColumn('classes', 'code');
  await addColumn('classes', 'type');
  for (const t of ['classes', 'routines', 'attendance']) {
    await addColumn(t, 'user_email');
    await db().execute(`CREATE INDEX IF NOT EXISTS idx_${t}_user ON ${t} (user_email)`);
  }

  // Data saved before logins existed has no owner. Give it to OWNER_EMAIL if that is set.
  const owner = (process.env.OWNER_EMAIL || '').trim().toLowerCase();
  if (owner) {
    for (const t of ['classes', 'routines', 'attendance']) {
      await db().execute({ sql: `UPDATE ${t} SET user_email = ? WHERE user_email IS NULL`, args: [owner] });
    }
  }
}
