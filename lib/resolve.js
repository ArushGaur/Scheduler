// Pure helpers (no server code) that combine the fixed timetable in lib/curriculum.js with the
// changes the owner saved in the database. Used by both the server and the browser.
//
// Change rows (table schedule_changes), by kind:
//   extra      a one-off class on one date                       { subject, code, type, room, teacher, date, start_time, end_time, audience }
//   added      a new weekly class                                 { subject, code, type, room, teacher, day_of_week, start_time, end_time, audience }
//   override   a permanent edit/removal of a built-in class       { class_id, removed?, room, teacher, day_of_week, start_time, end_time }
//   exception  a change/cancellation of one class on one date     { class_id, date, cancelled?, room, teacher, start_time, end_time }
// audience is 'all' or an elective key.

export const dowOf = (date) => new Date(`${date}T00:00:00Z`).getUTCDay();

const FIELDS = ['room', 'teacher', 'start_time', 'end_time'];
const forMe = (audience, elective) => !audience || audience === 'all' || audience === elective;
const orNull = (v) => (v === undefined || v === '' ? null : v);

function classFrom(id, d, extra = {}) {
  return {
    id,
    code: d.code || '',
    subject: d.subject,
    type: d.type || '',
    room: orNull(d.room),
    teacher: orNull(d.teacher),
    day_of_week: d.day_of_week,
    start_time: d.start_time,
    end_time: d.end_time,
    audience: d.audience || 'all',
    ...extra,
  };
}

const byTime = (a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time);

// base: the built-in classes for this person. changes: [{ id, kind, data }].
export function resolveSchedule(base, changes, elective) {
  const overrides = new Map();
  const exceptions = [];
  const extras = [];
  const classes = [];

  for (const ch of changes) {
    const d = ch.data || {};
    if (ch.kind === 'override' && d.class_id) overrides.set(d.class_id, d);
    else if (ch.kind === 'exception' && d.class_id && d.date) exceptions.push({ id: ch.id, ...d });
    else if (ch.kind === 'extra' && d.date && forMe(d.audience, elective)) {
      extras.push(classFrom(ch.id, { ...d, day_of_week: dowOf(d.date) }, { date: d.date, extra: true }));
    } else if (ch.kind === 'added' && forMe(d.audience, elective)) {
      classes.push(classFrom(ch.id, d, { custom: true }));
    }
  }

  for (const c of base) {
    const o = overrides.get(c.id);
    if (o?.removed) continue;
    if (!o) {
      classes.push(c);
      continue;
    }
    const next = { ...c, modified: true };
    for (const f of [...FIELDS, 'day_of_week']) if (o[f] !== undefined) next[f] = f === 'room' || f === 'teacher' ? orNull(o[f]) : o[f];
    classes.push(next);
  }

  extras.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start_time.localeCompare(b.start_time)));
  return { classes: classes.sort(byTime), extras, exceptions };
}

// Everything that happens on one date: weekly classes (with that day's cancellation/change applied)
// plus any extra classes dated that day. Cancelled classes are kept, flagged `cancelled`.
export function occurrencesOn(date, dow, classes, extras, exceptions) {
  const ex = new Map(exceptions.filter((e) => e.date === date).map((e) => [e.class_id, e]));
  const out = [];
  for (const c of classes) {
    if (c.day_of_week !== dow) continue;
    const e = ex.get(c.id);
    if (!e) out.push(c);
    else if (e.cancelled) out.push({ ...c, cancelled: true });
    else {
      const was = Object.fromEntries(FIELDS.map((f) => [f, c[f]]));
      const next = { ...c, changed: true, was };
      for (const f of FIELDS) if (e[f] !== undefined) next[f] = f === 'room' || f === 'teacher' ? orNull(e[f]) : e[f];
      out.push(next);
    }
  }
  for (const x of extras) if (x.date === date) out.push(x);
  return out;
}
