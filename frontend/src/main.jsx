import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { PWAProvider } from './context/PWAContext';
import ErrorBoundary from './components/ErrorBoundary';
import './styles/variables.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/dark.css';
import './styles/invoice-template.css';
import './styles/tour.css';
import { startOfflineSync } from './utils/OfflineSync';

// Initialize background SFA offline data synchronizer
startOfflineSync();

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('Service worker registered:', reg);
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('New service worker installed; auto-reloading page.');
                    window.location.reload();
                  }
                }
              };
            }
          };
        })
        .catch((err) => console.error('Service worker registration failed:', err));
    });
  } else {
    // Unregister service worker in development mode to avoid caching/WebSocket conflicts
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      let unregisteredAny = false;
      for (const registration of registrations) {
        registration.unregister().then((success) => {
          if (success) {
            console.log('Stale dev service worker unregistered.');
            unregisteredAny = true;
          }
        });
      }
      if (unregisteredAny) {
        window.location.reload();
      }
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <SettingsProvider>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <PWAProvider>
                  <App />
                </PWAProvider>
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </SettingsProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
