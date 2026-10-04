'use client';
import { ELECTIVE_LIST } from '@/lib/curriculum';
import { DAY_SHORT, WEEK_ORDER, fmtRange } from '@/lib/time';

// "Wed, Thu, Fri  2 to 3 pm  LT103" lines, grouped by room and time.
function slots(el) {
  const groups = new Map();
  el.classes.forEach(([, , , room, , day, start, end]) => {
    const k = `${room}|${start}|${end}`;
    if (!groups.has(k)) groups.set(k, { room, start, end, days: [] });
    groups.get(k).days.push(day);
  });
  return [...groups.values()].map((g) => ({
    ...g,
    days: g.days.sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b)).map((d) => DAY_SHORT[d]).join(', '),
  }));
}

export default function ElectivePicker({ value, onChange, current }) {
  return (
    <div className="electives" role="radiogroup" aria-label="Elective">
      {ELECTIVE_LIST.map((el) => {
        const on = value === el.key;
        return (
          <button
            key={el.key}
            type="button"
            role="radio"
            aria-checked={on}
            className={`elective ${on ? 'on' : ''}`}
            onClick={() => onChange(el.key)}
          >
            <span className="elective-radio" aria-hidden="true" />
            <span className="elective-body">
              <span className="elective-top">
                <strong>{el.name}</strong>
                <span className="elective-code">{el.code}</span>
                {current === el.key && <span className="elective-now">Current</span>}
              </span>
              {slots(el).map((s) => (
                <span key={s.room + s.days} className="elective-slot">
                  {s.days}, {fmtRange(s.start, s.end)}, {s.room}
                </span>
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
