'use client';
import { useMemo } from 'react';
import { colorFor } from '@/lib/colors';

export function computeStats(classes, attendance) {
  const subjectOf = new Map(classes.map((c) => [c.id, c.subject]));
  const map = new Map();
  const keyOf = (s) => s.toLowerCase().trim();

  classes.forEach((c) => {
    const k = keyOf(c.subject);
    if (!map.has(k)) map.set(k, { name: c.subject, present: 0, absent: 0, total: 0, history: [] });
  });

  attendance.forEach((a) => {
    const subject = subjectOf.get(a.class_id);
    if (!subject) return;
    const s = map.get(keyOf(subject));
    s[a.status] += 1;
    s.total += 1;
    s.history.push({ date: a.date, status: a.status });
  });

  const list = [...map.values()].map((s) => ({
    ...s,
    history: s.history.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 14).reverse(),
  }));
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

function advice(s, min) {
  if (s.total === 0) return 'Nothing marked yet';
  const pct = (100 * s.present) / s.total;
  if (pct >= min) {
    const spare = Math.floor((s.present * 100) / min - s.total + 1e-9);
    if (spare > 0) return `You can miss ${spare} more ${spare === 1 ? 'class' : 'classes'}`;
    return 'Right on the line, so attend the next one';
  }
  const need = Math.ceil((min * s.total - 100 * s.present) / (100 - min));
  return `Attend the next ${need} ${need === 1 ? 'class' : 'classes'} to reach ${min}%`;
}

export default function Attendance({ classes, attendance, min, compact }) {
  const stats = useMemo(() => computeStats(classes, attendance), [classes, attendance]);
  const totals = stats.reduce((t, s) => ({ p: t.p + s.present, n: t.n + s.total }), { p: 0, n: 0 });
  const overall = totals.n ? Math.round((100 * totals.p) / totals.n) : null;

  if (stats.length === 0) {
    return <p className="muted">Add a class and its attendance will show up here.</p>;
  }

  if (compact) {
    return (
      <ul className="att-compact">
        {stats.map((s) => {
          const pct = s.total ? Math.round((100 * s.present) / s.total) : null;
          const c = colorFor(s.name);
          return (
            <li key={s.name}>
              <div className="ac-top">
                <span>{s.name}</span>
                <b className={pct !== null && pct < min ? 'low' : ''}>{pct === null ? 'No data' : `${pct}%`}</b>
              </div>
              <div className="bar" style={{ '--bar': c.bar }}>
                <i style={{ width: `${pct ?? 0}%` }} />
                <u style={{ left: `${min}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="att">
      {totals.n ? (
        <div className="att-overall">
          <span className="att-big">{overall}%</span>
          <p>{totals.p} of {totals.n} classes attended</p>
        </div>
      ) : (
        <div className="att-overall empty-state">
          <strong>Nothing tracked yet</strong>
          <p>Open the Day view on a class day and tap the tick or cross on the class. Attendance can be marked for today or any past class day.</p>
        </div>
      )}

      <ul className="att-list">
        {stats.map((s) => {
          const pct = s.total ? Math.round((100 * s.present) / s.total) : null;
          const c = colorFor(s.name);
          return (
            <li key={s.name} className="att-row" style={{ '--bar': c.bar, '--tint': c.bg, '--fg': c.fg }}>
              <div className="att-row-top">
                <h3>{s.name}</h3>
                {pct === null ? <span className="att-nodata">No data</span> : <span className={`att-pct ${pct < min ? 'low' : ''}`}>{pct}%</span>}
              </div>
              <div className="bar">
                <i style={{ width: `${pct ?? 0}%` }} />
                <u style={{ left: `${min}%` }} title={`${min}% minimum`} />
              </div>
              {s.total > 0 ? (
                <div className="att-row-meta">
                  <span>{s.present} present</span>
                  <span>{s.absent} absent</span>
                  <span className="att-advice">{advice(s, min)}</span>
                </div>
              ) : (
                <div className="att-row-meta"><span>Not marked yet</span></div>
              )}
              {s.history.length > 0 && (
                <div className="dots" aria-label="Recent classes">
                  {s.history.map((h) => (
                    <i key={h.date} className={h.status} title={`${h.date}: ${h.status}`} />
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
