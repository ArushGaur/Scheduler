'use client';
import { useMemo } from 'react';
import { fmt, fmtRange } from '@/lib/time';
import { colorFor } from '@/lib/colors';
import { IconCheck, IconX } from './Icons';

export default function Timeline({ items, dateStr, isToday, nowMin, marks, canMark, onMark, onOpen }) {
  // Every item is listed one after another in time order, with no gaps for free time.
  const sorted = useMemo(() => [...items].sort((a, b) => a.s - b.s || a.e - b.e), [items]);

  return (
    <div className="tl">
      {sorted.map((it) => {
          const open = () => onOpen(it);
          const onKey = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              open();
            }
          };
          // Longer sessions get a bigger card: about 72px for a 55 min class, 156px for 2 hours, 234px for 3.
          const size = { minHeight: Math.max(64, Math.round((it.e - it.s) * 1.3)) };
          const short = false;

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
                                data-live={isToday && it.s <= nowMin && nowMin < it.e}
                data-past={isToday && it.e <= nowMin}
                style={{ ...size, '--tint': c.bg, '--fg': c.fg, '--bar': c.bar }}
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
              style={size}
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
    </div>
  );
}
