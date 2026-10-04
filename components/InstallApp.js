'use client';
import useInstall from './useInstall';

// The install card shown in the Account sheet. Always explains how to install, whatever the browser.
export default function InstallApp() {
  const { mode, install } = useInstall();
  if (mode === 'hidden') return null;

  return (
    <div className="install">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={48} height={48} className="install-icon" />
      <div className="install-copy">
        <strong>{mode === 'installed' ? 'Installed on this device' : 'Install Timetable as an app'}</strong>
        {mode === 'prompt' && <p>Open it from your home screen or desktop, full screen and ready in one tap.</p>}
        {mode === 'ios' && <p>Open this page in Safari, tap the Share button, then choose Add to Home Screen.</p>}
        {mode === 'manual' && <p>Open your browser menu (the three dots) and choose Install app or Add to Home screen.</p>}
        {mode === 'installed' && <p>You are using the installed app.</p>}
      </div>
      {mode === 'prompt' && (
        <button className="btn primary install-btn" onClick={install}>
          Install
        </button>
      )}
    </div>
  );
}
