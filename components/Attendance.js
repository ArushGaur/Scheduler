'use client';
import { useMemo } from 'react';
import { colorFor } from '@/lib/colors';

// Lab attendance is tracked on its own. Lecture, tutorial and every other type count together as "class".
export const isLab = (type) => String(type || '').toLowerCase().trim() === 'lab';
export const statKey = (subject, type) => `${subject.toLowerCase().trim()}|${isLab(type) ? 'lab' : 'class'}`;

export function computeStats(classes, attendance) {
  const byId = new Map(classes.map((c) => [c.id, c]));
  const map = new Map();

  classes.forEach((c) => {
    const k = statKey(c.subject, c.type);
    if (!map.has(k)) {
      const lab = isLab(c.type);
      map.set(k, { key: k, kind: lab ? 'lab' : 'class', subject: c.subject, name: lab ? `${c.subject} Lab` : c.subject, present: 0, absent: 0, total: 0, history: [] });
    }
  });

  attendance.forEach((a) => {
    const c = byId.get(a.class_id);
    if (!c) return;
    const s = map.get(statKey(c.subject, c.type));
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

const pctOf = (x) => (x.total ? Math.round((100 * x.present) / x.total) : null);

export default function Attendance({ classes, attendance, min, compact }) {
  const stats = useMemo(() => computeStats(classes, attendance), [classes, attendance]);
  const sum = (kind) => stats.filter((s) => s.kind === kind).reduce((t, s) => ({ present: t.present + s.present, total: t.total + s.total }), { present: 0, total: 0 });
  const classTotals = sum('class');
  const labTotals = sum('lab');
  const hasLabs = stats.some((s) => s.kind === 'lab');

  if (stats.length === 0) {
    return <p className="muted">Add a class and its attendance will show up here.</p>;
  }

  if (compact) {
    return (
      <ul className="att-compact">
        {stats.map((s) => {
          const pct = pctOf(s);
          const c = colorFor(s.subject);
          return (
            <li key={s.key}>
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

  const row = (s) => {
    const pct = pctOf(s);
    const c = colorFor(s.subject);
    return (
      <li key={s.key} className="att-row" style={{ '--bar': c.bar, '--tint': c.bg, '--fg': c.fg }}>
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
  };

  const stat = (title, t, noun) => (
    <div className="att-stat">
      <span className="att-big">{pctOf(t)}%</span>
      <p>{title}: {t.present} of {t.total} {noun} attended</p>
    </div>
  );

  return (
    <div className="att">
      {!classTotals.total && !labTotals.total ? (
        <div className="att-overall empty-state">
          <strong>Nothing tracked yet</strong>
          <p>Open the Day view on a class day and tap the tick or cross on the class. Attendance can be marked for today or any past class day.</p>
        </div>
      ) : (
        <div className="att-overall att-overall-combo">
          {classTotals.total > 0 && stat('Lectures and tutorials', classTotals, 'classes')}
          {labTotals.total > 0 && stat('Labs', labTotals, 'labs')}
        </div>
      )}

      <h2 className="att-group">Lectures and tutorials</h2>
      <ul className="att-list">{stats.filter((s) => s.kind === 'class').map(row)}</ul>

      {hasLabs && (
        <>
          <h2 className="att-group">Labs</h2>
          <ul className="att-list">{stats.filter((s) => s.kind === 'lab').map(row)}</ul>
        </>
      )}
    </div>
  );
}
