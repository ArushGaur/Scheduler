'use client';
import { useState } from 'react';
import { DAY_SHORT, WEEK_ORDER } from '@/lib/time';
import { CORE_CLASSES, ELECTIVE_LIST } from '@/lib/curriculum';

// Subjects that already exist, so typing one fills in its course code and who it is for.
const KNOWN = [
  ...new Map([
    ...CORE_CLASSES.map((r) => [r[1], { subject: r[1], code: r[0], audience: 'all' }]),
    ...ELECTIVE_LIST.map((e) => [e.name, { subject: e.name, code: e.code, audience: e.key }]),
  ]).values(),
];
const TYPES = ['Lecture', 'Tutorial', 'Lab', 'HSS', 'Other'];

// Owner-only form. mode:
//   extra-new     one-off class on a date            extra         edit a one-off class
//   weekly-new    new class every week               weekly-edit   edit a class for every week
//   occurrence    change one class on one date only
export default function ClassForm({ mode, item, date, defaultDay, defaultDate, onSave, onCancel }) {
  const identity = mode === 'extra-new' || mode === 'extra' || mode === 'weekly-new' || (mode === 'weekly-edit' && item?.custom);
  const isExtra = mode === 'extra-new' || mode === 'extra';

  const [subject, setSubject] = useState(item?.subject ?? '');
  const [code, setCode] = useState(item?.code ?? '');
  const [type, setType] = useState(item?.type || 'Lecture');
  const [audience, setAudience] = useState(item?.audience ?? 'all');
  const [room, setRoom] = useState(item?.room ?? '');
  const [teacher, setTeacher] = useState(item?.teacher ?? '');
  const [dateVal, setDateVal] = useState(item?.date ?? defaultDate ?? '');
  const [days, setDays] = useState([item?.day_of_week ?? defaultDay ?? 1]);
  const [start, setStart] = useState(item?.start_time ?? '09:00');
  const [end, setEnd] = useState(item?.end_time ?? '09:55');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const types = [...new Set([...TYPES, item?.type].filter(Boolean))];

  function pickSubject(v) {
    setSubject(v);
    const hit = KNOWN.find((k) => k.subject.toLowerCase() === v.trim().toLowerCase());
    if (hit && identity) {
      setCode(hit.code);
      setAudience(hit.audience);
    }
  }

  const toggleDay = (d) => {
    if (mode !== 'weekly-new') return setDays([d]);
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  };

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (identity && !subject.trim()) return setError('Add the subject name');
    if (isExtra && !dateVal) return setError('Pick a date');
    if (!days.length) return setError('Pick at least one day');
    if (!start || !end) return setError('Set a start and end time');
    if (end <= start) return setError('End time must be after the start time');
    setSaving(true);
    try {
      await onSave({
        subject, code, type, audience, room, teacher,
        date: dateVal, days, day_of_week: days[0], start_time: start, end_time: end,
      });
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  const label = {
    'extra-new': 'Add extra class',
    extra: 'Save changes',
    'weekly-new': 'Add weekly class',
    'weekly-edit': 'Save for every week',
    occurrence: 'Save for this date',
  }[mode];

  return (
    <form className="form" onSubmit={submit} noValidate>
      {mode === 'occurrence' && <p className="form-note">Only changes this one date. Other weeks stay as they are.</p>}
      {mode === 'weekly-edit' && <p className="form-note">Changes this class in every week, for everyone.</p>}
      {isExtra && <p className="form-note">An extra class shows for everyone on that date, and attendance can be marked for it.</p>}

      {identity ? (
        <>
          <label className="field">
            <span>Subject</span>
            <input value={subject} onChange={(e) => pickSubject(e.target.value)} list="known-subjects" placeholder="Fluid Mechanics" autoFocus />
            <datalist id="known-subjects">
              {KNOWN.map((k) => <option key={k.subject} value={k.subject} />)}
            </datalist>
          </label>
          <div className="row2">
            <label className="field">
              <span>Course code (optional)</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CE2103" />
            </label>
            <fieldset className="field">
              <legend>For</legend>
              <select value={audience} onChange={(e) => setAudience(e.target.value)} aria-label="Who is this class for">
                <option value="all">Everyone</option>
                {ELECTIVE_LIST.map((el) => <option key={el.key} value={el.key}>{el.name} students</option>)}
              </select>
            </fieldset>
          </div>
          <fieldset className="field">
            <legend>Type</legend>
            <div className="type-chips">
              {types.map((t) => (
                <button type="button" key={t} className={`chip ${type === t ? 'on' : ''}`} aria-pressed={type === t} onClick={() => setType(t)}>{t}</button>
              ))}
            </div>
          </fieldset>
        </>
      ) : (
        <p className="form-class">{item.subject}{item.type ? `, ${item.type}` : ''}</p>
      )}

      {isExtra && (
        <label className="field">
          <span>Date</span>
          <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
        </label>
      )}

      {(mode === 'weekly-new' || mode === 'weekly-edit') && (
        <fieldset className="field">
          <legend>{mode === 'weekly-new' ? 'Repeats on' : 'Day'}</legend>
          <div className="chips">
            {WEEK_ORDER.map((d) => (
              <button type="button" key={d} className={`chip ${days.includes(d) ? 'on' : ''}`} aria-pressed={days.includes(d)} onClick={() => toggleDay(d)}>
                {DAY_SHORT[d]}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="row2">
        <label className="field">
          <span>Starts</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span>Ends</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      <div className="row2">
        <label className="field">
          <span>Room</span>
          <input value={room} onChange={(e) => setRoom(e.target.value)} placeholder="R-104" />
        </label>
        <label className="field">
          <span>Teacher</span>
          <input value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="AKV" />
        </label>
      </div>

      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn primary" disabled={saving}>{saving ? 'Saving' : label}</button>
      </div>
    </form>
  );
}
