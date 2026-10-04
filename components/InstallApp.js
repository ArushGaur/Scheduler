'use client';
import { useEffect, useState } from 'react';

// Shows an install button where the browser supports it, and Add to Home Screen steps on iPhone.
export default function InstallApp() {
  const [evt, setEvt] = useState(null);
  const [mode, setMode] = useState('hidden'); // hidden | prompt | ios | installed

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone) {
      setMode('installed');
      return;
    }
    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1);
    if (ios) setMode('ios');

    const onPrompt = (e) => {
      e.preventDefault();
      setEvt(e);
      setMode('prompt');
    };
    const onInstalled = () => {
      setEvt(null);
      setMode('installed');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!evt) return;
    evt.prompt();
    await evt.userChoice.catch(() => {});
    setEvt(null);
    setMode('hidden');
  }

  if (mode === 'hidden') return null;

  return (
    <div className="install">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon-192.png" alt="" width={48} height={48} className="install-icon" />
      <div className="install-copy">
        <strong>{mode === 'installed' ? 'Installed on this device' : 'Install Timetable'}</strong>
        {mode === 'prompt' && <p>Open it from your home screen, full screen and ready in one tap.</p>}
        {mode === 'ios' && <p>Tap Share in Safari, then choose Add to Home Screen.</p>}
        {mode === 'installed' && <p>You are using the installed app.</p>}
      </div>
      {mode === 'prompt' && <button className="btn primary install-btn" onClick={install}>Install</button>}
    </div>
  );
}
