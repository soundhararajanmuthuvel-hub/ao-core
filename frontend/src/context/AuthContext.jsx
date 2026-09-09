import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authApi } from '../api';
import { API_BASE_URL } from '../utils/url';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error('Failed to parse saved user from localStorage:', e);
      return null;
    }
  });

  // Loading represents local session resolution (instant from localStorage)
  // Health checks run strictly in the background and do NOT block application rendering
  const [loading, setLoading] = useState(false);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [connectionError, setConnectionError] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('INITIALIZING'); // 'INITIALIZING' | 'CONNECTED' | 'DEGRADED' | 'OFFLINE'
  const [retryCount, setRetryCount] = useState(0);
  const [errorDetails, setErrorDetails] = useState(null); // { type, message, details }
  const [offlineMode, setOfflineMode] = useState(() => {
    try {
      return sessionStorage.getItem('offline_mode') === 'true';
    } catch {
      return false;
    }
  });

  const activeControllerRef = useRef(null);
  const isMountedRef = useRef(true);
  const isCheckingRef = useRef(false);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }
    try {
      const { data } = await authApi.me();
      if (!isMountedRef.current) return;
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      setConnectionError(false);
      setErrorDetails(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      if (!err.response) {
        // Network/server unreachable - keep cached user session active
        setConnectionError(true);
        setConnectionStatus('DEGRADED');
        setErrorDetails({
          type: 'Backend Offline',
          message: 'Unable to reach the AO Core ERP server. Operating on cached session.',
          details: err.message || String(err)
        });
      } else if (err.response?.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }
    }
  }, []);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const checkSingleHealth = async (timeoutMs = 12000) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { 
        ok: false, 
        errorType: 'Internet Offline', 
        message: 'No internet connection detected.', 
        details: 'navigator.onLine is false' 
      };
    }

    const controller = new AbortController();
    activeControllerRef.current = controller;
    let didTimeout = false;

    const timeoutId = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, timeoutMs);

    const startTime = Date.now();
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
        cache: 'no-store'
      });
      clearTimeout(timeoutId);

      const responseTime = Date.now() - startTime;

      if (response.status >= 500) {
        return { 
          ok: false, 
          errorType: 'Server 500', 
          message: 'The backend server encountered an internal error.', 
          details: `HTTP status ${response.status}`,
          isDegraded: true
        };
      }

      if (response.status !== 200) {
        return { 
          ok: false, 
          errorType: 'Backend Offline', 
          message: 'Server is reachable but returned an unexpected status code.', 
          details: `HTTP status ${response.status}`,
          isDegraded: true
        };
      }

      const data = await response.json();
      const dbStatus = (data.database || '').toLowerCase();
      if (dbStatus === 'disconnected') {
        return { 
          ok: false, 
          errorType: 'Database Error', 
          message: 'The backend server is online, but its database is disconnected.', 
          details: 'Database status is disconnected',
          isDegraded: true
        };
      }

      return { ok: true, data, responseTime };
    } catch (err) {
      clearTimeout(timeoutId);

      if (!isMountedRef.current) {
        return { ok: false, aborted: true };
      }

      if (err.name === 'AbortError') {
        if (didTimeout) {
          return { 
            ok: false, 
            errorType: 'Timeout', 
            message: 'The connection to the backend server timed out (server waking up).', 
            details: `Request exceeded ${timeoutMs}ms`,
            isDegraded: true 
          };
        }
        // Intentional cancellation (e.g. unmount or subsequent check)
        return { ok: false, aborted: true };
      }

      let errorType = 'Backend Offline';
      let message = 'Could not establish connection to the backend server.';
      let details = err.message || String(err);

      if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1')) {
        message = 'Local development backend is not running or unreachable.';
      }

      return { ok: false, errorType, message, details };
    } finally {
      clearTimeout(timeoutId);
      if (activeControllerRef.current === controller) {
        activeControllerRef.current = null;
      }
    }
  };

  const checkHealthWithRetry = useCallback(async ({ silent = false } = {}) => {
    const delays = [2000, 4000];
    const maxAttempts = 3;
    let attempt = 1;

    while (attempt <= maxAttempts) {
      if (!isMountedRef.current) return false;

      if (!silent) {
        setRetryCount(attempt - 1);
        if (attempt > 1) {
          console.log(`[PWA] Retrying health check (Attempt ${attempt}/${maxAttempts})...`);
        }
      }

      const timeoutMs = attempt === 1 ? 10000 : 15000;
      const result = await checkSingleHealth(timeoutMs);

      if (!isMountedRef.current) return false;

      if (result.aborted) {
        return false;
      }

      if (result.ok) {
        setConnectionStatus('CONNECTED');
        setConnectionError(false);
        setErrorDetails(null);
        return true;
      }

      if (result.isDegraded) {
        setConnectionStatus('DEGRADED');
      }

      if (attempt < maxAttempts) {
        const delay = delays[attempt - 1];
        await wait(delay);
        attempt++;
      } else {
        setConnectionStatus(result.isDegraded ? 'DEGRADED' : 'OFFLINE');
        setConnectionError(true);
        setErrorDetails({
          type: result.errorType,
          message: result.message,
          details: result.details
        });
        return false;
      }
    }
    return false;
  }, []);

  const runHealthCheck = useCallback(async ({ force = false, silent = false } = {}) => {
    if (isCheckingRef.current && !force) return;
    isCheckingRef.current = true;

    try {
      setConnectionStatus((prev) => (prev === 'CONNECTED' ? 'CONNECTED' : 'INITIALIZING'));
      const ok = await checkHealthWithRetry({ silent });
      if (ok && isMountedRef.current) {
        loadUser();
      }
    } finally {
      isCheckingRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [checkHealthWithRetry, loadUser]);

  // StrictMode-safe initial health check on mount
  useEffect(() => {
    isMountedRef.current = true;
    runHealthCheck({ silent: true });

    return () => {
      isMountedRef.current = false;
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, [runHealthCheck]);

  // Network online/offline & connection event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      console.log('[PWA] Device went online. Checking server connection...');
      runHealthCheck({ force: true });
    };

    const handleOffline = () => {
      setIsOffline(true);
      setConnectionStatus('OFFLINE');
      console.log('[PWA] Device went offline.');
    };

    const handleConnectionError = () => {
      if (!offlineMode && isMountedRef.current) {
        // Non-blocking connection degraded notification
        setConnectionStatus((prev) => (prev === 'CONNECTED' ? 'DEGRADED' : prev));
        runHealthCheck({ silent: true });
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('ao-connection-error', handleConnectionError);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ao-connection-error', handleConnectionError);
    };
  }, [runHealthCheck, offlineMode]);

  // Background monitor: Poll health quietly every 30s if connection is degraded or offline
  useEffect(() => {
    const monitorInterval = setInterval(async () => {
      if ((connectionStatus === 'DEGRADED' || connectionStatus === 'OFFLINE' || isOffline) && !offlineMode && isMountedRef.current) {
        try {
          const controller = new AbortController();
          const tId = setTimeout(() => controller.abort(), 6000);
          const response = await fetch(`${API_BASE_URL}/health`, { 
            method: 'GET', 
            signal: controller.signal, 
            cache: 'no-store' 
          });
          clearTimeout(tId);

          if (response.status === 200 && isMountedRef.current) {
            const data = await response.json();
            if (data.database && data.database.toLowerCase() !== 'disconnected') {
              console.log('[PWA] Health Monitor: Server is back online. Auto-connected.');
              setConnectionStatus('CONNECTED');
              setConnectionError(false);
              setErrorDetails(null);
              setIsOffline(false);
              loadUser();
            }
          }
        } catch {
          // Keep current status quietly without console noise
        }
      }
    }, 30000);

    return () => clearInterval(monitorInterval);
  }, [connectionStatus, isOffline, offlineMode, loadUser]);

  const login = async (email, password) => {
    try {
      const { data } = await authApi.login({ email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setConnectionError(false);
      setErrorDetails(null);
      setConnectionStatus('CONNECTED');
      setOfflineMode(false);
      try {
        sessionStorage.removeItem('offline_mode');
      } catch (e) {}
      return data.user;
    } catch (err) {
      if (!err.response) {
        setConnectionError(true);
        setConnectionStatus('DEGRADED');
        setErrorDetails({
          type: 'Backend Offline',
          message: 'Unable to reach the server during login.',
          details: err.message || String(err)
        });
      }
      throw err;
    }
  };

  const changePassword = async (newPassword) => {
    const { data } = await authApi.changePassword(newPassword);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    try {
      sessionStorage.removeItem('offline_mode');
    } catch (e) {}
    setOfflineMode(false);
    setConnectionError(false);
    setErrorDetails(null);
    setUser(null);
  };

  const updateTourCompleted = async (completed) => {
    try {
      const { data } = await authApi.updateTour(completed);
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    } catch (err) {
      console.error('Failed to update tour completion status:', err);
    }
  };

  const handleEnableOfflineMode = () => {
    setOfflineMode(true);
    setConnectionError(false);
    setErrorDetails(null);
    try {
      sessionStorage.setItem('offline_mode', 'true');
    } catch (e) {}
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      try {
        setUser(JSON.parse(cachedUser));
      } catch (e) {}
    }
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isAdmin: user?.role === 'admin' || user?.role === 'Super Admin',
      loadUser,
      updateTourCompleted,
      changePassword,
      isOffline,
      connectionError,
      offlineMode,
      connectionStatus,
      retryConnection: () => runHealthCheck({ force: true }),
      errorDetails,
      handleEnableOfflineMode
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
