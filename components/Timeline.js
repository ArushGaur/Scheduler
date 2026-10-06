'use client';
import { useEffect, useMemo, useRef } from 'react';
import { fmt, fmtMin, fmtRange } from '@/lib/time';
import { colorFor } from '@/lib/colors';
import { IconCheck, IconX } from './Icons';

const HH = 76; // pixels per hour

// Put overlapping items side by side instead of on top of each other.
function layout(items) {
  const sorted = [...items].sort((a, b) => a.s - b.s || b.e - a.e);
  const out = [];
  let cluster = [];
  let clusterEnd = -1;

  const flush = () => {
    const cols = [];
    cluster.forEach((it) => {
      let c = cols.findIndex((end) => end <= it.s);
      if (c === -1) {
        c = cols.length;
        cols.push(it.e);
      } else cols[c] = it.e;
      it.col = c;
    });
    cluster.forEach((it) => out.push({ ...it, cols: cols.length }));
    cluster = [];
    clusterEnd = -1;
  };

  sorted.forEach((it) => {
    if (cluster.length && it.s >= clusterEnd) flush();
    cluster.push(it);
    clusterEnd = Math.max(clusterEnd, it.e);
  });
  if (cluster.length) flush();
  return out;
}

export default function Timeline({ items, dateStr, isToday, nowMin, marks, canMark, onMark, onOpen }) {
  const { start, end, laid } = useMemo(() => {
    // Fit the day to its items (plus an hour of breathing room) instead of a fixed 8 to 6.
    const s = Math.min(...items.map((i) => i.s));
    const e = Math.max(...items.map((i) => i.e));
    const start = Math.max(0, Math.floor(s / 60) * 60 - 60);
    const end = Math.min(24 * 60, Math.max(Math.ceil(e / 60) * 60 + 60, start + 4 * 60));
    return { start, end, laid: layout(items) };
  }, [items]);

  const nowRef = useRef(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (isToday && nowRef.current && !scrolled.current) {
      scrolled.current = true;
      nowRef.current.scrollIntoView({ block: 'nearest' });
    }
  });

  const hours = [];
  for (let m = start; m <= end; m += 60) hours.push(m);
  const showNow = isToday && nowMin >= start && nowMin <= end;

  return (
    <div className="tl" style={{ height: ((end - start) / 60) * HH }}>
      {hours.map((m) => (
        <div key={m} className="tl-hour" style={{ top: ((m - start) / 60) * HH }}>
          <span>{fmtMin(m)}</span>
        </div>
      ))}

      <div className="tl-lane">
        {laid.map((it) => {
          const top = ((it.s - start) / 60) * HH + 1.5;
          const height = Math.max(((it.e - it.s) / 60) * HH - 3, 56);
          const style = {
            top,
            height,
            left: `${(it.col / it.cols) * 100}%`,
            width: `calc(${100 / it.cols}% - ${it.cols > 1 ? 4 : 0}px)`,
          };
          const open = () => onOpen(it);
          const onKey = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open();
            }
          };
          const short = height < 76;

          if (it.kind === 'class') {
            const c = colorFor(it.subject);
            const status = marks[`${it.id}|${dateStr}`];
            const place = [it.code, it.teacher].filter(Boolean).join(', ');
            const tag = it.cancelled ? 'Cancelled' : it.extra ? 'Extra' : it.changed ? 'Changed' : null;
            const tagKind = it.cancelled ? 'cancelled' : it.extra ? 'extra' : 'changed';
            return (
              <div
                key={`c${it.id}`}
                className={`block class ${status || ''} ${it.cancelled ? 'cancelled' : ''}`}
                data-short={short}
                data-narrow={it.cols > 1}
                data-live={isToday && it.s <= nowMin && nowMin < it.e}
                data-past={isToday && it.e <= nowMin}
                style={{ ...style, '--tint': c.bg, '--fg': c.fg, '--bar': c.bar }}
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={onKey}
                aria-label={`${it.subject}, ${fmt(it.start_time)} to ${fmt(it.end_time)}`}
              >
                <div className="b-text">
                  <strong>
                    {it.subject}
                    {tag && <em className="b-tag" data-kind={tagKind}>{tag}</em>}
                  </strong>
                  <span>
                    {it.type ? `${it.type}, ` : ''}
                    {fmtRange(it.start_time, it.end_time)}
                    {it.room ? ` \u00b7 ${it.room}` : ''}
                  </span>
                  {place && <span className="b-place">{place}</span>}
                </div>
                {!canMark && status && !it.cancelled && (
                  <span className={`b-status ${status}`}>{status === 'present' ? 'Present' : 'Absent'}</span>
                )}
                {canMark && !it.cancelled && (
                  <div className="b-marks" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`mark present ${status === 'present' ? 'on' : ''}`}
                      aria-label={`Mark ${it.subject} present`}
                      aria-pressed={status === 'present'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMark(it.id, 'present');
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <IconCheck size={16} />
                    </button>
                    <button
                      className={`mark absent ${status === 'absent' ? 'on' : ''}`}
                      aria-label={`Mark ${it.subject} absent`}
                      aria-pressed={status === 'absent'}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMark(it.id, 'absent');
                      }}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <IconX size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={`r${it.id}`}
              className="block routine"
              data-short={short}
              style={style}
              role="button"
              tabIndex={0}
              onClick={open}
              onKeyDown={onKey}
              aria-label={`${it.title}, ${fmt(it.start_time)}`}
            >
              <div className="b-text">
                <strong>{it.title}</strong>
                <span>{it.end_time ? fmtRange(it.start_time, it.end_time) : fmt(it.start_time)}</span>
              </div>
            </div>
          );
        })}

        {showNow && (
          <div ref={nowRef} className="now" style={{ top: ((nowMin - start) / 60) * HH }}>
            <span>{fmtMin(nowMin)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
