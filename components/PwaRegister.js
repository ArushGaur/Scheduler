'use client';
import { useEffect } from 'react';

// Runs for the whole app (it lives in the root layout).
//  1. Registers the service worker in production builds only, so dev reloads are never served from a cache.
//  2. Catches the browser's "install" offer. Browsers announce it once, early, so it is kept on `window`
//     for the install buttons (see useInstall) to use whenever they appear.
export default function PwaRegister() {
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      window.__ttInstall = e;
      window.dispatchEvent(new Event('tt-install'));
    };
    const onInstalled = () => {
      window.__ttInstall = null;
      window.__ttInstalled = true;
      window.dispatchEvent(new Event('tt-install'));
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return null;
}
