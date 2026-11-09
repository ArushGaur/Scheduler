'use client';
import { DAY_LONG, DAY_SHORT, addDays, dateKey, fmt, toMin } from '@/lib/time';
import { colorFor } from '@/lib/colors';

export default function WeekGrid({ occurrences, routines, weekStart, todayKey, marks, onPickDay, onOpen }) {
  return (
    <div className="week">
      {Array.from({ length: 7 }, (_, i) => {
        const date = addDays(weekStart, i);
        const key = dateKey(date);
        const dow = date.getDay();
        const items = [
          ...occurrences(key, dow).map((c) => ({ kind: 'class', ...c })),
          ...routines.filter((r) => r.day_of_week === dow).map((r) => ({ kind: 'routine', ...r })),
        ].sort((a, b) => toMin(a.start_time) - toMin(b.start_time));

        return (
          <section key={key} className={`week-day ${key === todayKey ? 'today' : ''}`}>
            <button className="week-head" onClick={() => onPickDay(key)}>
              <strong>
                <span className="d-long">{DAY_LONG[dow]}</span>
                <span className="d-short">{DAY_SHORT[dow]}</span>
              </strong>
              <span>{date.getDate()}</span>
            </button>

            {items.length === 0 && <p className="week-empty">Free day</p>}

            <ul>
              {items.map((it) => {
                const isClass = it.kind === 'class';
                const c = isClass ? colorFor(it.subject) : null;
                const status = isClass && !it.cancelled ? marks[`${it.id}|${key}`] : null;
                return (
                  <li key={`${it.kind}${it.id}`}>
                    <button
                      className={`week-item ${isClass ? 'class' : 'routine'} ${it.cancelled ? 'cancelled' : ''}`}
                      style={c ? { '--tint': c.bg, '--fg': c.fg, '--bar': c.bar } : undefined}
                      onClick={() => onOpen(it, key)}
                    >
                      <span className="wi-time">{fmt(it.start_time)}</span>
                      <span className="wi-name">{isClass ? it.subject : it.title}</span>
                      {isClass && (it.cancelled || it.extra || it.changed) && (
                        <span className="b-tag" data-kind={it.cancelled ? 'cancelled' : it.extra ? 'extra' : 'changed'}>
                          {it.cancelled ? 'Cancelled' : it.extra ? 'Extra' : 'Changed'}
                        </span>
                      )}
                      {isClass && it.type && <span className="wi-type">{it.type}</span>}
                      {isClass && it.room && <span className="wi-type wi-room">{it.room}</span>}
                      {status && <span className={`wi-dot ${status}`} title={status} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
