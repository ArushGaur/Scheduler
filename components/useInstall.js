'use client';
import { useCallback, useEffect, useState } from 'react';

// mode:
//   hidden     not worked out yet (first render)
//   installed  already running as an installed app
//   prompt     the browser can show its install dialog right now (Chrome, Edge, Samsung Internet on Android and desktop)
//   ios        iPhone or iPad: has to be done from Safari's Share menu
//   manual     any other browser: use the browser's own menu
function detect() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (standalone || window.__ttInstalled) return 'installed';
  if (window.__ttInstall) return 'prompt';
  const ua = window.navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)) return 'ios';
  return 'manual';
}

export default function useInstall() {
  const [mode, setMode] = useState('hidden');

  useEffect(() => {
    const refresh = () => setMode(detect());
    refresh();
    window.addEventListener('tt-install', refresh);
    return () => window.removeEventListener('tt-install', refresh);
  }, []);

  // Returns true if the browser showed its install dialog.
  const install = useCallback(async () => {
    const evt = window.__ttInstall;
    if (!evt) return false;
    evt.prompt();
    await evt.userChoice.catch(() => {});
    // The offer can only be used once. If they said no, the browser may offer it again later.
    window.__ttInstall = null;
    setMode(detect());
    return true;
  }, []);

  return { mode, install };
}
