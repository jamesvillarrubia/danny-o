import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { registerServiceWorker, setupInstallPrompt } from './lib/service-worker';

// Register service worker for PWA functionality
if (import.meta.env.PROD) {
  registerServiceWorker();
  setupInstallPrompt();
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

