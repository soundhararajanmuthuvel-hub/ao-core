import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api';

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
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [connectionError, setConnectionError] = useState(false);
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
    } catch (err) {
      // If it is a network/connection error (no response)
      if (!err.response) {
        setConnectionError(true);
      } else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
    };
    const handleOffline = () => {
      setIsOffline(true);
    };
    const handleConnectionError = () => {
      setConnectionError(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('ao-connection-error', handleConnectionError);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('ao-connection-error', handleConnectionError);
    };
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await authApi.login({ email, password });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      setConnectionError(false);
      setOfflineMode(false);
      try {
        sessionStorage.removeItem('offline_mode');
      } catch (e) {}
      return data.user;
    } catch (err) {
      if (!err.response) {
        setConnectionError(true);
      }
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

  const handleRetryOffline = () => {
    if (navigator.onLine) {
      setIsOffline(false);
      loadUser();
    }
  };

  const handleRetryConnection = async () => {
    setConnectionError(false);
    setLoading(true);
    try {
      await loadUser();
    } catch (e) {
      setConnectionError(true);
    }
  };

  const handleEnableOfflineMode = () => {
    setOfflineMode(true);
    setConnectionError(false);
    try {
      sessionStorage.setItem('offline_mode', 'true');
    } catch (e) {}
  };

  const renderOverlay = (title, message, icon, onRetry, showOfflineOption) => {
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
        background: 'linear-gradient(135deg, #1c0f07 0%, #3a1c09 50%, #0c0603 100%)', // Brand primary theme colors
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
            fontSize: '4.5rem',
            marginBottom: '1.25rem',
            animation: 'ao-overlay-pulse 2s infinite ease-in-out',
            filter: 'drop-shadow(0 0 20px rgba(255, 152, 0, 0.25))',
            lineHeight: 1
          }}>
            {icon}
          </div>
          
          <h2 style={{
            margin: '0 0 0.75rem 0',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: '#ff9800', // vibrant brand secondary
            letterSpacing: '-0.01em',
            lineHeight: '1.2'
          }}>
            {title}
          </h2>
          
          <p style={{
            margin: '0 0 2rem 0',
            fontSize: '0.95rem',
            color: '#e2e8f0',
            lineHeight: '1.6',
            maxWidth: '320px'
          }}>
            {message}
          </p>
          
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            width: '100%'
          }}>
            <button
              type="button"
              onClick={onRetry}
              style={{
                backgroundColor: '#ff9800', // vibrant brand secondary
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '0.85rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(255, 152, 0, 0.3)',
                transition: 'background-color 0.2s, transform 0.1s',
                width: '100%'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e68900'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff9800'}
            >
              Retry Connection
            </button>
            
            {showOfflineOption && (
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
                  transition: 'background-color 0.2s, border-color 0.2s',
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
                Offline Mode
              </button>
            )}
          </div>
        </div>
        <style>{`
          @keyframes ao-overlay-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.06); opacity: 0.85; }
          }
        `}</style>
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
      isOffline,
      connectionError,
      offlineMode
    }}>
      {children}
      {isOffline && !offlineMode && renderOverlay('No Internet Connection', 'Check your device network connection and try again.', '📶', handleRetryOffline, true)}
      {connectionError && !offlineMode && !isOffline && renderOverlay('Unable to connect to server', 'We couldn\'t reach the AO Core ERP server. Please verify if the backend is running.', '🔌', handleRetryConnection, true)}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
