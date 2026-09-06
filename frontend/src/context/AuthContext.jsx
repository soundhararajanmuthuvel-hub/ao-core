import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api';
import { API_BASE_URL } from '../utils/url';
import GlobalLoader from '../components/GlobalLoader';

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
  const [loading, setLoading] = useState(() => {
    try {
      const token = localStorage.getItem('token');
      const saved = localStorage.getItem('user');
      return !(token && saved);
    } catch (e) {
      return true;
    }
  });
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [connectionError, setConnectionError] = useState(false);
  const [healthStatus, setHealthStatus] = useState(null); // 'checking-internet' | 'checking-server' | 'connecting-db' | 'loading-erp' | 'retrying-X'
  const [retryCount, setRetryCount] = useState(0);
  const [errorDetails, setErrorDetails] = useState(null); // { type, message, details }
  const [offlineMode, setOfflineMode] = useState(() => {
    try {
      return sessionStorage.getItem('offline_mode') === 'true';
    } catch {
      return false;
    }
  });

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const { data } = await authApi.me();
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
      setConnectionError(false);
      setErrorDetails(null);
    } catch (err) {
      if (!err.response) {
        setConnectionError(true);
        setErrorDetails({
          type: 'Backend Offline',
          message: 'Unable to reach the AO Core ERP server. Please ensure the backend is running.',
          details: err.message || String(err)
        });
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const checkHealthWithRetry = useCallback(async () => {
    const checkHealth = async () => {
      console.log('\n[PWA] === STARTING HEALTH CHECK ===');
      console.log(`[PWA] API URL: ${API_BASE_URL}`);
      console.log(`[PWA] Health Endpoint: ${API_BASE_URL}/health`);

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log(`[PWA] Internet Status: Offline`);
        return { ok: false, errorType: 'Internet Offline', message: 'No internet connection detected. Please check your Wi-Fi or mobile data.', details: 'navigator.onLine is false' };
      }

      console.log(`[PWA] Internet Status: Online`);

      const startTime = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store'
        });
        clearTimeout(timeoutId);

        const responseTime = Date.now() - startTime;
        console.log(`[PWA] Response Time: ${responseTime}ms`);
        console.log(`[PWA] HTTP Status: ${response.status}`);

        if (response.status >= 500) {
          return { ok: false, errorType: 'Server 500', message: 'The backend server encountered an internal error.', details: `HTTP status ${response.status}` };
        }

        if (response.status !== 200) {
          return { ok: false, errorType: 'Backend Offline', message: 'Server is reachable but returned an unexpected status code.', details: `HTTP status ${response.status}` };
        }

        const data = await response.json();
        console.log(`[PWA] Health Check Response:`, data);
        console.log(`[PWA] Backend: Connected`);
        console.log(`[PWA] Health: OK`);

        const dbStatus = (data.database || '').toLowerCase();
        if (dbStatus === 'disconnected') {
          return { ok: false, errorType: 'Database Error', message: 'The backend server is online, but cannot connect to its database instance.', details: 'Database status is disconnected' };
        }

        return { ok: true, data };
      } catch (err) {
        const responseTime = Date.now() - startTime;
        console.error('[PWA] Health Check Error:', err);

        let errorType = 'Backend Offline';
        let message = 'Could not establish connection to the backend server.';
        let details = err.message || String(err);

        if (err.name === 'AbortError') {
          errorType = 'Timeout';
          message = 'The connection to the backend server timed out.';
        } else if (err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
          if (API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1')) {
            errorType = 'Backend Offline';
            message = 'Local development backend is not running or unreachable.';
          } else {
            errorType = 'DNS Failure';
            message = 'Failed to resolve the server address or access was blocked (possible CORS/SSL/DNS issue).';
          }
        }

        return { ok: false, errorType, message, details };
      }
    };

    const delays = [2000, 5000, 10000];
    let attempt = 1;

    while (attempt <= 4) {
      setRetryCount(attempt - 1);
      
      if (attempt > 1) {
        console.log(`[PWA] Retrying health check (Attempt ${attempt}/4)...`);
      }

      setHealthStatus(navigator.onLine ? 'checking-server' : 'checking-internet');
      
      const result = await checkHealth();
      
      if (result.ok) {
        setHealthStatus(null);
        setConnectionError(false);
        setErrorDetails(null);
        return true;
      }

      if (attempt < 4) {
        const delay = delays[attempt - 1];
        setHealthStatus(`retrying-${delay / 1000}s`);
        await wait(delay);
        attempt++;
      } else {
        setHealthStatus(null);
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

  const runHealthCheck = useCallback(async () => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setLoading(false);
    } else {
      setLoading(true);
    }
    const ok = await checkHealthWithRetry();
    if (ok) {
      await loadUser();
    } else {
      setLoading(false);
    }
  }, [checkHealthWithRetry, loadUser]);

  useEffect(() => {
    runHealthCheck();
  }, [runHealthCheck]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      console.log('[PWA] Device went online. Auto-reconnecting...');
      runHealthCheck();
    };
    const handleOffline = () => {
      setIsOffline(true);
      console.log('[PWA] Device went offline.');
    };
    const handleConnectionError = () => {
      if (!connectionError && !loading && !offlineMode) {
        console.warn('[PWA] Connection error event received. Triggering health verification...');
        runHealthCheck();
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
  }, [runHealthCheck, connectionError, loading, offlineMode]);

  useEffect(() => {
    const monitorInterval = setInterval(async () => {
      if ((connectionError || isOffline) && !offlineMode) {
        console.log('[PWA] Health Monitor: Background checking server health...');
        try {
          const response = await fetch(`${API_BASE_URL}/health`, { method: 'GET', cache: 'no-store' });
          if (response.status === 200) {
            const data = await response.json();
            if (data.database && data.database.toLowerCase() !== 'disconnected') {
              console.log('[PWA] Health Monitor: Server is online. Auto-connecting...');
              setConnectionError(false);
              setErrorDetails(null);
              setIsOffline(false);
              runHealthCheck();
            }
          }
        } catch (e) {
          console.log('[PWA] Health Monitor: Server still unreachable.');
        }
      }
    }, 30000);

    return () => clearInterval(monitorInterval);
  }, [connectionError, isOffline, offlineMode, runHealthCheck]);

  const login = async (email, password) => {
    try {
      const { data } = await authApi.login({ email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setConnectionError(false);
      setErrorDetails(null);
      setOfflineMode(false);
      try {
        sessionStorage.removeItem('offline_mode');
      } catch (e) {}
      return data.user;
    } catch (err) {
      if (!err.response) {
        setConnectionError(true);
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
    try {
      const { data } = await authApi.changePassword(newPassword);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data;
    } catch (err) {
      throw err;
    }
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
    setHealthStatus(null);
    try {
      sessionStorage.setItem('offline_mode', 'true');
    } catch (e) {}
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      setUser(JSON.parse(cachedUser));
    }
    setLoading(false);
  };

  const renderLoadingOverlay = () => {
    let message = 'Initializing...';
    if (healthStatus === 'checking-internet') {
      message = 'Checking Internet Connection...';
    } else if (healthStatus === 'checking-server') {
      message = 'Locating Backend Server...';
    } else if (healthStatus?.startsWith('retrying')) {
      const waitTime = healthStatus.split('-')[1];
      message = `Server busy. Retrying in ${waitTime}... (Attempt ${retryCount}/3)`;
    } else if (healthStatus === 'connecting-db') {
      message = 'Connecting to Database...';
    } else if (healthStatus === 'loading-erp') {
      message = 'Loading ERP Systems...';
    }

    return <GlobalLoader message={message} />;
  };

  const renderErrorOverlay = () => {
    if (!errorDetails) return null;

    const { type, message, details } = errorDetails;
    let icon = '🔌';
    
    if (type === 'Internet Offline') icon = '📶';
    else if (type === 'Timeout') icon = '⏱️';
    else if (type === 'Database Error') icon = '🗄️';
    else if (type === 'Server 500') icon = '💥';
    else if (type === 'CORS' || type === 'DNS Failure') icon = '🔒';

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(135deg, #1c0f07 0%, #3a1c09 50%, #0c0603 100%)',
        color: '#ffffff',
        zIndex: 999999,
        padding: '2rem',
        boxSizing: 'border-box',
        textAlign: 'center',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}>
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '2.5rem 2rem',
          maxWidth: '440px',
          width: '100%',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 40px rgba(245, 158, 11, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          <div style={{
            fontSize: '4rem',
            marginBottom: '1rem',
            filter: 'drop-shadow(0 0 15px rgba(255, 87, 34, 0.4))'
          }}>
            {icon}
          </div>

          <span style={{
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            fontWeight: 800,
            background: 'rgba(255, 87, 34, 0.15)',
            color: '#ff5722',
            padding: '0.25rem 0.75rem',
            borderRadius: '20px',
            marginBottom: '0.75rem'
          }}>
            {type}
          </span>
          
          <h2 style={{
            margin: '0 0 0.75rem 0',
            fontSize: '1.5rem',
            fontWeight: 800,
            color: '#ff9800',
            lineHeight: '1.2'
          }}>
            Connection Failed
          </h2>
          
          <p style={{
            margin: '0 0 1.5rem 0',
            fontSize: '0.95rem',
            color: '#e2e8f0',
            lineHeight: '1.5'
          }}>
            {message}
          </p>

          {details && (
            <div style={{
              width: '100%',
              fontSize: '0.75rem',
              color: '#94a3b8',
              fontFamily: 'monospace',
              background: 'rgba(0, 0, 0, 0.3)',
              padding: '0.75rem',
              borderRadius: '8px',
              textAlign: 'left',
              wordBreak: 'break-all',
              maxHeight: '100px',
              overflowY: 'auto',
              marginBottom: '1.5rem',
              border: '1px solid rgba(255, 255, 255, 0.05)'
            }}>
              {details}
            </div>
          )}
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            width: '100%'
          }}>
            <button
              type="button"
              onClick={runHealthCheck}
              style={{
                backgroundColor: '#ff9800',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '0.85rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(255, 152, 0, 0.3)',
                transition: 'background-color 0.2s',
                width: '100%'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e68900'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff9800'}
            >
              Retry Connection
            </button>
            
            <button
              type="button"
              onClick={handleEnableOfflineMode}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: '#e2e8f0',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '12px',
                padding: '0.85rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                width: '100%'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
            >
              Use Offline Mode
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      login,
      logout,
      isAdmin: user?.role === 'admin',
      loadUser,
      updateTourCompleted,
      changePassword,
      isOffline,
      connectionError,
      offlineMode
    }}>
      {children}
      {healthStatus && renderLoadingOverlay()}
      {isOffline && !offlineMode && !healthStatus && renderErrorOverlay()}
      {connectionError && !offlineMode && !isOffline && !healthStatus && renderErrorOverlay()}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
