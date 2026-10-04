'use client';
import { useEffect } from 'react';

// Registers the service worker in production builds only, so dev reloads are never served from a cache.
export default function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  return null;
}
