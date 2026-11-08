import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import './index.css';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

// Register offline PWA service worker for air-gapped environments (Network-First in Dev)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const isDev = (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false;
  if (isDev) {
    // Unregister stale service workers and purge caches in local development
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const k of keys) caches.delete(k);
      });
    }
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Air-gapped fallback
      });
    });
  }
}
