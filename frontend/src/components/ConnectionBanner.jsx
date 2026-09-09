import React from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Non-blocking connection banner
 * Provides clear, persistent visibility into backend connectivity
 * without locking or freezing the ERP UI.
 */
export default function ConnectionBanner() {
  const { connectionStatus, retryConnection, isOffline, offlineMode } = useAuth();

  if (connectionStatus === 'CONNECTED' || (!connectionStatus && !isOffline && !offlineMode)) {
    return null;
  }

  const isDegraded = connectionStatus === 'DEGRADED';
  const isOfflineState = connectionStatus === 'OFFLINE' || isOffline;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        width: '100%',
        backgroundColor: isDegraded ? 'rgba(245, 158, 11, 0.12)' : 'rgba(239, 68, 68, 0.12)',
        borderBottom: `1px solid ${isDegraded ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
        color: isDegraded ? '#d97706' : '#ef4444',
        padding: '0.5rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '0.75rem',
        fontSize: '0.82rem',
        fontWeight: 600,
        zIndex: 50,
        boxSizing: 'border-box',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '1rem' }}>
          {isDegraded ? '⏳' : '⚠️'}
        </span>
        <span>
          {isDegraded
            ? 'Backend server is taking longer to respond (waking up). Retrying in background...'
            : offlineMode
            ? 'Operating in Offline Mode. Cached data is active.'
            : 'Backend connection unavailable. Some live actions may be limited.'}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {retryConnection && (
          <button
            type="button"
            onClick={() => retryConnection()}
            style={{
              backgroundColor: isDegraded ? '#f59e0b' : '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '6px',
              padding: '0.25rem 0.65rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            🔄 Retry Connection
          </button>
        )}
      </div>
    </div>
  );
}
