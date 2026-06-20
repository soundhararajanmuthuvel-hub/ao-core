import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useToast } from './ToastContext';

const PWAContext = createContext();

export function PWAProvider({ children }) {
  const { toast } = useToast();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  
  // Initialize installation status from localStorage or display mode
  const [isInstalled, setIsInstalled] = useState(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    
    if (isStandalone) {
      localStorage.setItem('pwa_installed', 'true');
      return true;
    }
    return localStorage.getItem('pwa_installed') === 'true';
  });

  // Track if PWA is installable (either natural browser prompt is ready or we are debugging)
  const [isInstallable, setIsInstallable] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const debug = params.get('pwa-debug') === 'true' || localStorage.getItem('pwa_debug') === 'true';
    return debug && localStorage.getItem('pwa_installed') !== 'true';
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent browser's default prompt banner
      e.preventDefault();
      // Store event
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('PWA: captured beforeinstallprompt event');
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstallable(false);
      setIsInstalled(true);
      localStorage.setItem('pwa_installed', 'true');
      toast('✅ AO ERP installed successfully', 'success');
      console.log('PWA: appinstalled event fired');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [toast]);

  // Keep checking debug status in case search queries change
  useEffect(() => {
    const checkDebug = () => {
      const params = new URLSearchParams(window.location.search);
      const debugActive = params.get('pwa-debug') === 'true' || localStorage.getItem('pwa_debug') === 'true';
      if (debugActive && !isInstalled) {
        setIsInstallable(true);
      }
    };
    checkDebug();
    window.addEventListener('popstate', checkDebug);
    return () => window.removeEventListener('popstate', checkDebug);
  }, [isInstalled]);

  const installApp = useCallback(async () => {
    // If not natural prompt but debug active, simulate the installation flow
    if (!deferredPrompt) {
      const params = new URLSearchParams(window.location.search);
      const debug = params.get('pwa-debug') === 'true' || localStorage.getItem('pwa_debug') === 'true';
      
      if (debug) {
        console.log('PWA: Simulating installation in debug mode');
        setIsInstallable(false);
        setIsInstalled(true);
        localStorage.setItem('pwa_installed', 'true');
        toast('✅ AO ERP installed successfully', 'success');
        return true;
      }
      console.log('PWA: Install requested but no deferred prompt or debug bypass active');
      return false;
    }

    try {
      // Trigger prompt
      deferredPrompt.prompt();
      // Wait for user choice
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA: User choice outcome: ${outcome}`);
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setIsInstallable(false);
        return true;
      }
    } catch (err) {
      console.error('PWA: Error triggering installation prompt:', err);
    }
    return false;
  }, [deferredPrompt, toast]);

  return (
    <PWAContext.Provider value={{ isInstallable, isInstalled, installApp }}>
      {children}
    </PWAContext.Provider>
  );
}

export function usePWA() {
  return useContext(PWAContext);
}
