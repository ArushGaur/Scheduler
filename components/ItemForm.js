'use client';
import { useState } from 'react';
import { DAY_SHORT, WEEK_ORDER } from '@/lib/time';

// Routines only. The class schedule is fixed (see lib/curriculum.js) and cannot be edited here.
export default function ItemForm({ item, defaultDay, onSave, onCancel }) {
  const editing = Boolean(item);
  const [name, setName] = useState(item?.title ?? '');
  const [days, setDays] = useState(item ? [item.day_of_week] : [defaultDay]);
  const [start, setStart] = useState(item?.start_time ?? '09:00');
  const [end, setEnd] = useState(item?.end_time ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleDay = (d) => {
    if (editing) return setDays([d]);
    setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]));
  };

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Add a title');
    if (!days.length) return setError('Pick at least one day');
    if (!start) return setError('Set a start time');
    if (end && end <= start) return setError('End time must be after the start time');

    setSaving(true);
    try {
      await onSave({ title: name, days, start_time: start, end_time: end || null }, item?.id);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">
        <span>Title</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Gym" autoFocus />
      </label>

      <fieldset className="field">
        <legend>{editing ? 'Day' : 'Repeats on'}</legend>
        <div className="chips">
          {WEEK_ORDER.map((d) => (
            <button
              type="button"
              key={d}
              className={`chip ${days.includes(d) ? 'on' : ''}`}
              aria-pressed={days.includes(d)}
              onClick={() => toggleDay(d)}
            >
              {DAY_SHORT[d]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="row2">
        <label className="field">
          <span>Starts</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field">
          <span>Ends (optional)</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="form-actions">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary" disabled={saving}>
          {saving ? 'Saving' : editing ? 'Save changes' : 'Add routine'}
        </button>
      </div>
    </form>
  );
}
