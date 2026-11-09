'use client';
import { useState } from 'react';
import ElectivePicker from './ElectivePicker';

export default function Onboarding({ user, onStart }) {
  const [pick, setPick] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = (user.name || '').split(' ')[0];

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="onboard">
      <div className="onboard-card">
        <img className="onboard-mark" src="/mark.png" alt="" width="56" height="56" />
        <h1>{first ? `Welcome, ${first}` : 'Welcome'}</h1>
        <p className="onboard-lead">Choose your HSS elective. We will set up your class timetable with it, and you can change it later from your account.</p>

        <ElectivePicker value={pick} onChange={setPick} />

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="btn primary onboard-go" disabled={!pick || busy} onClick={() => run(() => onStart(pick))}>
          {busy ? 'Setting up' : 'Load my timetable'}
        </button>
      </div>
    </div>
  );
}
