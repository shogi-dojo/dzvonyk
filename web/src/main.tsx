import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './i18n';
import App from './App.tsx';
import { registerSW } from 'virtual:pwa-register';

// Auto-update Service Worker on new deploy & refresh when ready
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Force SW update immediately
      updateSW(true);
    },
    onRegisteredSW(_swUrl, r) {
      if (r) {
        // Check for SW updates periodically
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
