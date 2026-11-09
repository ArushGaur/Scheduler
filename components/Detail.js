'use client';
import { useState } from 'react';
import { DAY_LONG, fmt, parseKey } from '@/lib/time';
import { colorFor } from '@/lib/colors';
import { IconCheck, IconX, IconPencil, IconTrash } from './Icons';

export default function Detail({ item, dateStr, status, canMark, isPast, stat, admin, onMark, onEdit, onDelete, onAdmin }) {
  const [confirm, setConfirm] = useState(false);
  const [adminConfirm, setAdminConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const isClass = item.kind === 'class';
  const c = isClass ? colorFor(item.subject) : null;
  const name = isClass ? item.subject : item.title;

  const tag = item.cancelled ? 'Cancelled' : item.extra ? 'Extra class' : item.changed ? 'Changed for today' : null;
  const was = item.changed && item.was;
  const adminDo = async (act) => {
    setBusy(true);
    try {
      await onAdmin(act);
    } finally {
      setBusy(false);
      setAdminConfirm(null);
    }
  };

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
          {tag && <span className="status-tag" data-kind={item.cancelled ? 'cancelled' : item.extra ? 'extra' : 'changed'}>{tag}</span>}
          <p>
            {item.extra && dateStr ? parseKey(dateStr).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) : DAY_LONG[item.day_of_week]}, {fmt(item.start_time)}
            {item.end_time ? ` to ${fmt(item.end_time)}` : ''}
          </p>
          {isClass && (item.type || item.code) && <p>{[item.type, item.code].filter(Boolean).join(', ')}</p>}
          {isClass && <p>Room: {item.room || 'not assigned'}</p>}
          {isClass && item.teacher && <p>Teacher: {item.teacher}</p>}
          {was && (
            <p className="detail-was">
              Usually {fmt(was.start_time)} to {fmt(was.end_time)}{was.room ? `, ${was.room}` : ''}
            </p>
          )}
        </div>
      </div>

      {isClass && item.cancelled && <p className="detail-locked">This class is cancelled on this date, so it does not count towards attendance.</p>}

      {isClass && !item.cancelled && (
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
              {stat.present} of {stat.total} {String(item.type || '').toLowerCase() === 'lab' ? 'labs' : 'classes'} attended so far, {Math.round((100 * stat.present) / stat.total)}%
            </p>
          )}
        </div>
      )}


      {isClass && admin && (
        <div className="admin-box">
          <p className="detail-label">Owner controls</p>
          {adminConfirm ? (
            <div className="form-actions split">
              <button className="btn ghost" onClick={() => setAdminConfirm(null)} disabled={busy}>Keep it</button>
              <button className="btn danger" onClick={() => adminDo(adminConfirm)} disabled={busy}>
                {adminConfirm === 'deleteExtra' ? 'Delete extra class' : 'Remove for everyone'}
              </button>
            </div>
          ) : item.extra ? (
            <div className="admin-grid">
              <button className="btn secondary" onClick={() => onAdmin('editExtra')}><IconPencil size={18} /> Edit</button>
              <button className="btn ghost" onClick={() => setAdminConfirm('deleteExtra')}><IconTrash size={18} /> Delete</button>
            </div>
          ) : item.cancelled ? (
            <div className="admin-grid">
              <button className="btn secondary" disabled={busy} onClick={() => adminDo('restore')}>Restore this class</button>
            </div>
          ) : (
            <div className="admin-grid">
              <button className="btn secondary" disabled={busy} onClick={() => adminDo('cancel')}>Cancel this date</button>
              <button className="btn secondary" onClick={() => onAdmin('editDate')}>Change this date</button>
              <button className="btn secondary" onClick={() => onAdmin('editWeekly')}>Edit every week</button>
              <button className="btn ghost" onClick={() => setAdminConfirm('remove')}><IconTrash size={18} /> Remove</button>
            </div>
          )}
          {item.changed && !adminConfirm && (
            <button className="link admin-undo" disabled={busy} onClick={() => adminDo('restore')}>Undo the change for this date</button>
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
