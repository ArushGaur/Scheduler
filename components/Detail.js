'use client';
import { useState } from 'react';
import { DAY_LONG, fmt, parseKey } from '@/lib/time';
import { colorFor } from '@/lib/colors';
import { IconCheck, IconX, IconPencil, IconTrash } from './Icons';

export default function Detail({ item, dateStr, status, canMark, isPast, stat, onMark, onEdit, onDelete }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const isClass = item.kind === 'class';
  const c = isClass ? colorFor(item.subject) : null;
  const name = isClass ? item.subject : item.title;

  async function remove() {
    setBusy(true);
    await onDelete();
  }

  return (
    <div className="detail">
      <div className="detail-top" style={c ? { '--bar': c.bar } : undefined}>
        <span className={`swatch ${isClass ? '' : 'dashed'}`} />
        <div>
          <h3>{name}</h3>
          <p>
            {DAY_LONG[item.day_of_week]}, {fmt(item.start_time)}
            {item.end_time ? ` to ${fmt(item.end_time)}` : ''}
          </p>
          {isClass && (item.type || item.code) && <p>{[item.type, item.code].filter(Boolean).join(', ')}</p>}
          {isClass && <p>Room: {item.room || 'not assigned'}</p>}
          {isClass && item.teacher && <p>Teacher: {item.teacher}</p>}
        </div>
      </div>

      {isClass && (
        <div className="detail-attendance">
          <p className="detail-label">
            {canMark
              ? `Attendance for ${isPast ? '' : 'today, '}${parseKey(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}`
              : isPast
              ? `${parseKey(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}: ${status === 'present' ? 'Present' : status === 'absent' ? 'Absent' : 'Not marked'}`
              : 'Attendance opens on the day of the class'}
          </p>
          {canMark && (
            <div className="mark-row">
              <button className={`mark-big present ${status === 'present' ? 'on' : ''}`} onClick={() => onMark('present')}>
                <IconCheck size={20} /> Present
              </button>
              <button className={`mark-big absent ${status === 'absent' ? 'on' : ''}`} onClick={() => onMark('absent')}>
                <IconX size={20} /> Absent
              </button>
            </div>
          )}
          {stat && stat.total > 0 && (
            <p className="detail-stat">
              {stat.present} of {stat.total} classes attended so far, {Math.round((100 * stat.present) / stat.total)}%
            </p>
          )}
        </div>
      )}

      {!isClass && (
      <div className="form-actions split">
        {confirm ? (
          <>
            <button className="btn ghost" onClick={() => setConfirm(false)} disabled={busy}>
              Keep it
            </button>
            <button className="btn danger" onClick={remove} disabled={busy}>
              {isClass ? 'Delete class and its attendance' : 'Delete routine'}
            </button>
          </>
        ) : (
          <>
            <button className="btn ghost" onClick={() => setConfirm(true)}>
              <IconTrash size={18} /> Delete
            </button>
            <button className="btn secondary" onClick={onEdit}>
              <IconPencil size={18} /> Edit
            </button>
          </>
        )}
      </div>
      )}
    </div>
  );
}
