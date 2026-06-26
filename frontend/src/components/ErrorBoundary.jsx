import React from 'react';
import { API_BASE_URL } from '../utils/url';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    // Log to API server
    fetch(`${API_BASE_URL}/client-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: error?.message || String(error),
        stack: error?.stack || null,
        componentStack: errorInfo?.componentStack || null,
        type: 'boundary-crash'
      })
    }).catch(err => console.error('Failed to log error boundary crash to server:', err));
  }

  handleReload = () => {
    window.location.reload(true);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#fef2f2',
          color: '#b91c1c',
          fontFamily: 'Inter, system-ui, sans-serif',
          padding: '2rem',
          boxSizing: 'border-box',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>⚠️</span>
          <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#991b1b' }}>
            Oops! Something went wrong.
          </h1>
          <p style={{
            margin: '0.75rem 0 1.5rem 0',
            fontSize: '0.95rem',
            color: '#7f1d1d',
            maxWidth: '500px',
            lineHeight: '1.6',
            wordBreak: 'break-word'
          }}>
            {this.state.error?.message || 'An unexpected rendering error occurred inside the application components.'}
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="button"
              onClick={this.handleReload}
              style={{
                backgroundColor: '#b91c1c',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.65rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(185, 28, 28, 0.15)',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#991b1b'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
            >
              Reload App
            </button>
            <button
              type="button"
              onClick={() => {
                localStorage.clear();
                sessionStorage.clear();
                window.location.href = '/';
              }}
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                color: '#4b5563',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                padding: '0.65rem 1.5rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'}
            >
              Clear Cache & Reset
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
