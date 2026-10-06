'use client';
import { useState } from 'react';
import { DAY_LONG, fmt, parseKey } from '@/lib/time';
import { ELECTIVES } from '@/lib/curriculum';

const dateLabel = (d) => parseKey(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const who = (a) => (a && a !== 'all' && ELECTIVES[a] ? ` (${ELECTIVES[a].name} only)` : '');

// Owner-only overview of every change, with a way to undo each one.
export default function ManagePanel({ admin, onAction, onEditExtra, onNewExtra, onNewWeekly }) {
  const [busy, setBusy] = useState('');
  const run = async (key, ...args) => {
    setBusy(key);
    try {
      await onAction(...args);
    } finally {
      setBusy('');
    }
  };

  const removed = admin.overrides.filter((o) => o.removed);
  const edited = admin.overrides.filter((o) => !o.removed);
  const empty = !admin.extras.length && !admin.added.length && !admin.overrides.length && !admin.exceptions.length;

  return (
    <div className="manage">
      <div className="manage-add">
        <button className="btn primary" onClick={onNewExtra}>Add extra class</button>
        <button className="btn secondary" onClick={onNewWeekly}>Add weekly class</button>
      </div>

      {empty && <p className="muted">No changes yet. Anything you add, cancel or edit will be listed here.</p>}

      {admin.extras.length > 0 && (
        <section>
          <h3>Extra classes</h3>
          <ul>
            {admin.extras.map((x) => (
              <li key={x.id}>
                <div>
                  <strong>{x.subject}{x.type ? `, ${x.type}` : ''}</strong>
                  <span>{dateLabel(x.date)}, {fmt(x.start_time)} to {fmt(x.end_time)}{x.room ? `, ${x.room}` : ''}{who(x.audience)}</span>
                </div>
                <div className="manage-btns">
                  <button className="btn ghost" onClick={() => onEditExtra(x)}>Edit</button>
                  <button className="btn ghost" disabled={busy === x.id} onClick={() => run(x.id, 'deleteExtra', { id: x.id }, `Deleted extra ${x.subject}`)}>Delete</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {admin.exceptions.length > 0 && (
        <section>
          <h3>Cancelled or changed on one date</h3>
          <ul>
            {admin.exceptions.map((e) => {
              const k = `${e.class_id}|${e.date}`;
              return (
                <li key={k}>
                  <div>
                    <strong>{e.subject}{e.type ? `, ${e.type}` : ''}</strong>
                    <span>{dateLabel(e.date)}: {e.cancelled ? 'Cancelled' : `Moved to ${fmt(e.start_time)} to ${fmt(e.end_time)}${e.room ? `, ${e.room}` : ''}`}</span>
                  </div>
                  <div className="manage-btns">
                    <button className="btn ghost" disabled={busy === k} onClick={() => run(k, 'restoreOccurrence', { class_id: e.class_id, date: e.date }, `Restored ${e.subject}`)}>Undo</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(admin.added.length > 0 || edited.length > 0 || removed.length > 0) && (
        <section>
          <h3>Weekly timetable changes</h3>
          <ul>
            {admin.added.map((c) => (
              <li key={c.id}>
                <div>
                  <strong>{c.subject}{c.type ? `, ${c.type}` : ''}</strong>
                  <span>Added: {DAY_LONG[c.day_of_week]}, {fmt(c.start_time)} to {fmt(c.end_time)}{c.room ? `, ${c.room}` : ''}{who(c.audience)}</span>
                </div>
                <div className="manage-btns">
                  <button className="btn ghost" disabled={busy === c.id} onClick={() => run(c.id, 'removeClass', { id: c.id }, `Removed ${c.subject}`)}>Delete</button>
                </div>
              </li>
            ))}
            {edited.map((o) => (
              <li key={o.class_id}>
                <div>
                  <strong>{o.subject}{o.type ? `, ${o.type}` : ''}</strong>
                  <span>Edited: now {DAY_LONG[o.day_of_week]}, {fmt(o.start_time)} to {fmt(o.end_time)}{o.room ? `, ${o.room}` : ''}</span>
                </div>
                <div className="manage-btns">
                  <button className="btn ghost" disabled={busy === o.class_id} onClick={() => run(o.class_id, 'resetClass', { id: o.class_id }, `Reset ${o.subject}`)}>Reset</button>
                </div>
              </li>
            ))}
            {removed.map((o) => (
              <li key={o.class_id}>
                <div>
                  <strong>{o.subject}{o.type ? `, ${o.type}` : ''}</strong>
                  <span>Removed: {DAY_LONG[o.day_of_week]}, {fmt(o.start_time)}</span>
                </div>
                <div className="manage-btns">
                  <button className="btn ghost" disabled={busy === o.class_id} onClick={() => run(o.class_id, 'resetClass', { id: o.class_id }, `Restored ${o.subject}`)}>Restore</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
