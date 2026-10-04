'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';
import { api } from '@/lib/api';
import { DAY_LONG, DAY_SHORT, MONTHS, addDays, dateKey, fmt, fmtRange, parseKey, toMin, weekStartOf } from '@/lib/time';
import Timeline from '@/components/Timeline';
import WeekGrid from '@/components/WeekGrid';
import Attendance, { computeStats } from '@/components/Attendance';
import Sheet from '@/components/Sheet';
import ItemForm from '@/components/ItemForm';
import Detail from '@/components/Detail';
import Account, { Avatar } from '@/components/Account';
import ElectivePicker from '@/components/ElectivePicker';
import Onboarding from '@/components/Onboarding';
import { colorFor } from '@/lib/colors';
import { ELECTIVES } from '@/lib/curriculum';
import { Brand, IconChart, IconDay, IconLeft, IconPlus, IconRight, IconWeek } from '@/components/Icons';

// Most colleges require 75%. Change it here if yours is different.
const MIN_ATTENDANCE = 75;

const NAV = [
  { id: 'day', label: 'Day', Icon: IconDay },
  { id: 'week', label: 'Week', Icon: IconWeek },
  { id: 'attendance', label: 'Attendance', Icon: IconChart },
];


const spell = (m) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`);

export default function TimetableApp({ user }) {
  const [data, setData] = useState({ classes: [], routines: [], attendance: [], profile: null });
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [view, setView] = useState('day');
  const [selected, setSelected] = useState(null);
  const [now, setNow] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState('');

  /* ----- clock ----- */
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    setSelected((s) => s ?? dateKey(new Date()));
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);

  /* ----- data ----- */
  const load = useCallback(async () => {
    try {
      setData(await api('/api/schedule'));
      setStatus('ready');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  const marks = useMemo(() => {
    const m = {};
    data.attendance.forEach((a) => (m[`${a.class_id}|${a.date}`] = a.status));
    return m;
  }, [data.attendance]);

  const mark = useCallback(
    async (classId, date, next) => {
      const current = marks[`${classId}|${date}`];
      const clearing = current === next;
      setData((d) => ({
        ...d,
        attendance: clearing
          ? d.attendance.filter((a) => !(a.class_id === classId && a.date === date))
          : [...d.attendance.filter((a) => !(a.class_id === classId && a.date === date)), { class_id: classId, date, status: next }],
      }));
      try {
        if (clearing) await api(`/api/attendance?class_id=${classId}&date=${date}`, 'DELETE');
        else await api('/api/attendance', 'POST', { class_id: classId, date, status: next });
      } catch (err) {
        setToast(`Could not save attendance. ${err.message}`);
        load();
      }
    },
    [marks, load]
  );

  async function save(payload, id) {
    if (id) await api('/api/routines', 'PUT', { ...payload, id });
    else await api('/api/routines', 'POST', payload);
    await load();
    setSheet(null);
    setToast(id ? `Saved changes to ${payload.title}` : `Added ${payload.title}`);
  }

  async function remove(item) {
    try {
      await api(`/api/routines?id=${item.id}`, 'DELETE');
      await load();
      setSheet(null);
      setToast(`Deleted ${item.title}`);
    } catch (err) {
      setToast(err.message);
    }
  }

  async function startWith(key) {
    await api('/api/profile', 'POST', { action: 'start', elective: key });
    await load();
  }
  async function switchElective(key) {
    await api('/api/profile', 'POST', { action: 'change', elective: key });
    await load();
    setSheet(null);
    setToast(`Elective set to ${ELECTIVES[key].name}`);
  }

  /* ----- derived ----- */
  const todayKey = now ? dateKey(now) : null;
  const nowMin = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const selectedDate = selected ? parseKey(selected) : null;
  const dow = selectedDate?.getDay();
  const isToday = selected === todayKey;
  const canMark = selected ? selected <= todayKey : false;

  const items = useMemo(() => {
    if (dow === undefined) return [];
    const withTimes = (i) => ({ ...i, s: toMin(i.start_time), e: i.end_time ? toMin(i.end_time) : toMin(i.start_time) + 30 });
    return [
      ...data.classes.filter((c) => c.day_of_week === dow).map((c) => withTimes({ kind: 'class', ...c })),
      ...data.routines.filter((r) => r.day_of_week === dow).map((r) => withTimes({ kind: 'routine', ...r })),
    ].sort((a, b) => a.s - b.s);
  }, [data, dow]);

  const subline = useMemo(() => {
    const cls = items.filter((i) => i.kind === 'class');
    if (isToday) {
      const current = cls.find((i) => i.s <= nowMin && nowMin < i.e);
      const next = cls.find((i) => i.s > nowMin);
      if (current) return `${current.subject} is on until ${fmt(current.end_time)}`;
      if (next) return `Next class is ${next.subject} at ${fmt(next.start_time)}`;
      return cls.length ? 'Classes are done for today' : 'No classes today';
    }
    const r = items.length - cls.length;
    return `${cls.length} ${cls.length === 1 ? 'class' : 'classes'} and ${r} ${r === 1 ? 'routine' : 'routines'}`;
  }, [items, isToday, nowMin]);

  const swipe = useRef({ x: 0, y: 0 });
  const onTouchStart = (e) => { swipe.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }; };
  const onTouchEnd = (e) => {
    const dx = e.changedTouches[0].clientX - swipe.current.x;
    const dy = e.changedTouches[0].clientY - swipe.current.y;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6 && selectedDate) setSelected(dateKey(addDays(selectedDate, dx < 0 ? 1 : -1)));
  };
  const live = isToday && items.some((i) => i.kind === 'class' && i.s <= nowMin && nowMin < i.e);
  const focus = useMemo(() => {
    if (!isToday) return null;
    const cls = items.filter((i) => i.kind === 'class');
    const current = cls.find((i) => i.s <= nowMin && nowMin < i.e);
    if (current) return { kind: 'now', item: current, left: current.e - nowMin, pct: Math.round(((nowMin - current.s) / (current.e - current.s)) * 100) };
    const next = cls.find((i) => i.s > nowMin);
    if (next) return { kind: 'next', item: next, left: next.s - nowMin, pct: 0 };
    return null;
  }, [items, isToday, nowMin]);

  if (status === 'error') {
    return (
      <div className="boot">
        <div className="boot-card">
          <h1>Can’t reach the database</h1>
          <p>{error}</p>
          <p className="muted">Check TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local, then restart the server.</p>
          <button className="btn primary" onClick={() => { setStatus('loading'); load(); }}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (status === 'loading' || !selectedDate) {
    return (
      <div className="boot" aria-busy="true">
        <div className="skeleton" />
      </div>
    );
  }

  if (data.profile && !data.profile.setup) {
    return <Onboarding user={user} onStart={startWith} />;
  }

  const weekStart = weekStartOf(selectedDate);
  const weekEnd = addDays(weekStart, 6);
  const rangeLabel = `${weekStart.getDate()} ${MONTHS[weekStart.getMonth()].slice(0, 3)} to ${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()].slice(0, 3)}`;
  const shiftWeek = (n) => setSelected(dateKey(addDays(selectedDate, n * 7)));
  const openAdd = () => setSheet({ type: 'form', defaultDay: dow });
  const openItem = (item, date = selected) => setSheet({ type: 'detail', item, date });
  const openAccount = () => setSheet({ type: 'account' });
  const accountBtn = (
    <button className="avatar-btn" onClick={openAccount} aria-label={`Account, ${user.email}`}>
      <Avatar user={user} />
    </button>
  );

  const stats = computeStats(data.classes, data.attendance);

  return (
    <div className="app">
      <aside className="rail">
        <div className="rail-brand"><Brand /></div>
        <nav aria-label="Main">
          {NAV.map(({ id, label, Icon }) => (
            <button key={id} className={`rail-btn ${view === id ? 'on' : ''}`} onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined}>
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="rail-btn rail-account" onClick={openAccount} aria-label={`Account, ${user.email}`}>
          <Avatar user={user} />
          <span>Account</span>
        </button>
      </aside>

      <main className="main">
        {view === 'day' && (
          <>
            <header className="head">
              <div>
                <h1>{DAY_LONG[dow]}</h1>
                <p className="date">{selectedDate.getDate()} {MONTHS[selectedDate.getMonth()]} {selectedDate.getFullYear()}</p>
              </div>
              {!isToday && (
                <div className="head-lead">
                  <button className="btn secondary" onClick={() => setSelected(todayKey)}>Today</button>
                </div>
              )}
              <div className="head-actions">
                {accountBtn}
                <button className="btn primary add-desktop" onClick={openAdd}>
                  <IconPlus size={18} /> Add
                </button>
              </div>
            </header>
            <p className="sub" data-live={live} data-focus={!!focus}>{subline}</p>
            {focus && (
              <section className="focus" aria-label={focus.kind === 'now' ? 'Class in session' : 'Next class'} style={{ '--bar': colorFor(focus.item.subject).bar }}>
                <div className="focus-top">
                  <span className="focus-state" data-kind={focus.kind}>{focus.kind === 'now' ? 'In session' : 'Up next'}</span>
                  <span className="focus-left">{focus.kind === 'now' ? `${spell(focus.left)} left` : `Starts in ${spell(focus.left)}`}</span>
                </div>
                <h2>{focus.item.subject}</h2>
                <p className="focus-meta">
                  {[focus.item.type, fmtRange(focus.item.start_time, focus.item.end_time), focus.item.code || focus.item.room].filter(Boolean).join(', ')}
                </p>
                {focus.kind === 'now' && (
                  <div className="focus-bar" role="progressbar" aria-valuenow={focus.pct} aria-valuemin={0} aria-valuemax={100}>
                    <i style={{ width: `${Math.max(focus.pct, 4)}%` }} />
                  </div>
                )}
              </section>
            )}

            <div className="strip-wrap">
              <button className="icon-btn" onClick={() => shiftWeek(-1)} aria-label="Previous week"><IconLeft size={20} /></button>
              <div className="strip" role="tablist" aria-label="Days of this week">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = addDays(weekStart, i);
                  const k = dateKey(d);
                  return (
                    <button key={k} role="tab" aria-selected={k === selected} className={`daychip ${k === selected ? 'on' : ''} ${k === todayKey ? 'today' : ''}`} onClick={() => setSelected(k)}>
                      <span>{DAY_SHORT[d.getDay()]}</span>
                      <b>{d.getDate()}</b>
                    </button>
                  );
                })}
              </div>
              <button className="icon-btn" onClick={() => shiftWeek(1)} aria-label="Next week"><IconRight size={20} /></button>
            </div>

            <div className="day-grid">
              <section aria-label="Schedule" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                {items.length === 0 ? (
                  <div className="empty">
                    <h2>Nothing on {DAY_LONG[dow]}</h2>
                    <p>No classes on this day. You can add a routine like gym or study time.</p>
                    <div className="empty-actions">
                      <button className="btn primary" onClick={openAdd}>Add a routine</button>
                    </div>
                  </div>
                ) : (
                  <Timeline
                    items={items}
                    dateStr={selected}
                    isToday={isToday}
                    nowMin={nowMin}
                    marks={marks}
                    canMark={canMark}
                    onMark={(id, st) => mark(id, selected, st)}
                    onOpen={(it) => openItem(it)}
                  />
                )}
              </section>

              <aside className="side" aria-label="Attendance summary">
                <h2>Attendance</h2>
                <Attendance classes={data.classes} attendance={data.attendance} min={MIN_ATTENDANCE} compact />
                <button className="link" onClick={() => setView('attendance')}>See details</button>
              </aside>
            </div>
          </>
        )}

        {view === 'week' && (
          <>
            <header className="head">
              <div>
                <h1>Week</h1>
                <p className="date">{rangeLabel}</p>
              </div>
              <div className="head-lead">
                <button className="icon-btn boxed" onClick={() => shiftWeek(-1)} aria-label="Previous week"><IconLeft size={20} /></button>
                <button className="icon-btn boxed" onClick={() => shiftWeek(1)} aria-label="Next week"><IconRight size={20} /></button>
              </div>
              <div className="head-actions">
                {accountBtn}
                <button className="btn primary add-desktop" onClick={openAdd}><IconPlus size={18} /> Add</button>
              </div>
            </header>
            <WeekGrid
              classes={data.classes}
              routines={data.routines}
              weekStart={weekStart}
              todayKey={todayKey}
              marks={marks}
              onPickDay={(k) => { setSelected(k); setView('day'); }}
              onOpen={(it, k) => { setSelected(k); openItem(it, k); }}
            />
          </>
        )}

        {view === 'attendance' && (
          <>
            <header className="head">
              <div>
                <h1>Attendance</h1>
                <p className="date">Minimum required is {MIN_ATTENDANCE}%</p>
              </div>
              <div className="head-actions">{accountBtn}</div>
            </header>
            <Attendance classes={data.classes} attendance={data.attendance} min={MIN_ATTENDANCE} />
          </>
        )}
      </main>

      <nav className="tabbar" aria-label="Main">
        {[...NAV].map(({ id, label, Icon }) => (
          <button key={id} className={`tab ${view === id ? 'on' : ''}`} onClick={() => setView(id)} aria-current={view === id ? 'page' : undefined}>
            <span className="tab-ic"><Icon size={22} /></span>
            <span className="tab-label">{label}</span>
          </button>
        ))}
        <button className="tab tab-add" onClick={openAdd}>
          <span className="tab-ic"><IconPlus size={22} /></span>
          <span className="tab-label">Add</span>
        </button>
      </nav>

      <Sheet
        open={sheet?.type === 'form'}
        onClose={() => setSheet(null)}
        title={sheet?.item ? 'Edit routine' : 'Add routine'}
      >
        {sheet?.type === 'form' && (
          <ItemForm
            item={sheet.item}
            defaultDay={sheet.defaultDay}
            onSave={save}
            onCancel={() => setSheet(null)}
          />
        )}
      </Sheet>

      <Sheet open={sheet?.type === 'detail'} onClose={() => setSheet(null)} title={sheet?.item?.kind === 'class' ? 'Class' : 'Routine'}>
        {sheet?.type === 'detail' && (
          <Detail
            item={sheet.item}
            dateStr={sheet.date}
            status={marks[`${sheet.item.id}|${sheet.date}`]}
            canMark={sheet.date <= todayKey}
            stat={sheet.item.kind === 'class' ? stats.find((s) => s.name.toLowerCase() === sheet.item.subject.toLowerCase()) : null}
            onMark={(st) => mark(sheet.item.id, sheet.date, st)}
            onEdit={() => setSheet({ type: 'form', item: sheet.item, defaultDay: sheet.item.day_of_week })}
            onDelete={() => remove(sheet.item)}
          />
        )}
      </Sheet>

      <Sheet open={sheet?.type === 'account'} onClose={() => setSheet(null)} title="Account">
        {sheet?.type === 'account' && (
          <Account
            user={user}
            elective={data.profile?.elective ? ELECTIVES[data.profile.elective] : null}
            onChangeElective={() => setSheet({ type: 'elective' })}
            onSignOut={() => signOut({ callbackUrl: '/' })}
          />
        )}
      </Sheet>

      <Sheet open={sheet?.type === 'elective'} onClose={() => setSheet(null)} title="Choose elective">
        {sheet?.type === 'elective' && (
          <ElectiveChange current={data.profile?.elective} onSave={switchElective} onBack={() => setSheet({ type: 'account' })} />
        )}
      </Sheet>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function ElectiveChange({ current, onSave, onBack }) {
  const [pick, setPick] = useState(current || null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changing = current && pick && pick !== current;

  async function save() {
    setBusy(true);
    setError('');
    try {
      await onSave(pick);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="form">
      <ElectivePicker value={pick} onChange={setPick} current={current} />
      {changing && (
        <p className="elective-warn">Switching removes {ELECTIVES[current].name} from your timetable, including any attendance you marked for it.</p>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onBack}>Back</button>
        <button type="button" className="btn primary" disabled={!pick || pick === current || busy} onClick={save}>
          {busy ? 'Saving' : 'Save elective'}
        </button>
      </div>
    </div>
  );
}
