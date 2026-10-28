'use client';
import { DAY_LONG, DAY_SHORT, MONTHS, fmtRange, parseKey } from '@/lib/time';
import { colorFor } from '@/lib/colors';
import { SESSIONS } from '@/lib/exams';
import { IconClock, IconPin } from '@/components/Icons';

const DAY_MS = 86400000;

function daysLeft(date, todayKey) {
  if (!date) return null;
  return Math.round((parseKey(date) - parseKey(todayKey)) / DAY_MS);
}

function countdown(diff) {
  if (diff === null) return { text: 'Date TBA', state: 'tba' };
  if (diff < 0) return { text: 'Done', state: 'done' };
  if (diff === 0) return { text: 'Today', state: 'today' };
  if (diff === 1) return { text: 'Tomorrow', state: 'soon' };
  return { text: `In ${diff} days`, state: diff <= 7 ? 'soon' : 'later' };
}

function Details({ x }) {
  return (
    <div className="exam-info">
      <p className="exam-row">
        <IconClock size={16} />
        <span>{x.session ? `${SESSIONS[x.session].label}, ${fmtRange(x.start_time, x.end_time)}` : 'Time to be announced'}</span>
      </p>
      <p className={`exam-row exam-loc ${x.location ? '' : 'tba'}`}>
        <IconPin size={16} />
        <span>{x.location || 'Location to be announced'}</span>
      </p>
    </div>
  );
}

export default function ExamList({ exams, todayKey }) {
  if (exams.length === 0) {
    return (
      <div className="empty">
        <h2>No exams yet</h2>
        <p>Exam dates for your courses will show up here.</p>
      </div>
    );
  }

  const withDiff = exams.map((x) => ({ ...x, diff: daysLeft(x.date, todayKey) }));
  const next = withDiff.find((x) => x.diff !== null && x.diff >= 0) || null;
  const rest = withDiff;
  const ordered = [
    ...rest.filter((x) => x.diff !== null && x.diff >= 0),
    ...rest.filter((x) => x.diff === null),
    ...rest.filter((x) => x.diff !== null && x.diff < 0),
  ];
  const nameOf = (x) => (x.type === 'Lab' ? `${x.subject} Lab` : x.subject);
  const nd = next ? parseKey(next.date) : null;

  return (
    <div className="exams">
      {next && (
        <section className="exam-hero" aria-label="Next exam">
          <div className="exam-hero-top">
            <span className="exam-hero-tag">Next exam</span>
            <span className="exam-hero-date">{DAY_LONG[nd.getDay()]}, {nd.getDate()} {MONTHS[nd.getMonth()]}</span>
          </div>
          <div className="exam-hero-count">
            <b>{next.diff === 0 ? 'Today' : next.diff}</b>
            {next.diff > 0 && <span>{next.diff === 1 ? 'day to go' : 'days to go'}</span>}
          </div>
          <h2>{nameOf(next)}</h2>
          <p className="exam-hero-code">{next.code}{next.type === 'Lab' ? ' · LAB EXAM' : ''}</p>
          <Details x={next} />
        </section>
      )}

      {ordered.length > 0 && (
        <>
          <h2 className="exam-section">All exams</h2>
          <ul className="exam-list">
            {ordered.map((x) => {
              const d = x.date ? parseKey(x.date) : null;
              const c = colorFor(x.subject);
              const left = countdown(x.diff);
              return (
                <li key={x.id} className={`exam ${left.state === 'done' ? 'past' : ''}`} style={{ '--tint': c.bg, '--fg': c.fg, '--bar': c.bar }}>
                  <div className={`exam-date ${d ? '' : 'tba'}`} aria-hidden="true">
                    {d ? (
                      <>
                        <span>{DAY_SHORT[d.getDay()]}</span>
                        <b>{d.getDate()}</b>
                        <span>{MONTHS[d.getMonth()].slice(0, 3)}</span>
                      </>
                    ) : (
                      <>
                        <span>Date</span>
                        <b>TBA</b>
                      </>
                    )}
                  </div>
                  <div className="exam-body">
                    <div className="exam-top">
                      <span className="exam-chip">{x.code}{x.type === 'Lab' ? ' · Lab' : ''}</span>
                      <span className="exam-when" data-state={left.state}>{left.text}</span>
                    </div>
                    <h3>{nameOf(x)}</h3>
                    <Details x={x} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
