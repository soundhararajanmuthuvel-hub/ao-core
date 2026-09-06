import React, { useState, useEffect } from 'react';
import { useCompanyBrand } from '../context/CompanyBrandContext';

/**
 * AO Core Single Global Loading Screen
 *
 * ONE APP • ONE GLOBAL LOADING SCREEN • ONE LOADING COMPONENT • ONE DESIGN
 *
 * Provides a clean, modern SaaS loading screen for:
 * - Initial application boot
 * - Authentication state restoration
 * - Critical app initialization
 * - Route lazy-loading bundle fetch
 */
export default function GlobalLoader({ message = 'Loading...' }) {
  const brandContext = useCompanyBrand ? useCompanyBrand() : null;
  const logo = brandContext?.logoUrl || '/assets/default-company-logo.png';
  const company = brandContext?.companyName || 'Amudhasurabiy Organics';
  
  // Failsafe timer: If initialization hangs for > 12s, provide manual reload option
  const [showFailsafe, setShowFailsafe] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowFailsafe(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="ao-global-loader-container"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: '#0a0a0c',
        backgroundImage: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(217, 119, 6, 0.12), transparent 70%), radial-gradient(ellipse 60% 40% at 50% 110%, rgba(217, 119, 6, 0.06), transparent 70%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        color: '#ffffff',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: '1.5rem',
        boxSizing: 'border-box',
        overflow: 'hidden',
        userSelect: 'none',
        WebkitUserSelect: 'none'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '380px',
          width: '100%',
          textAlign: 'center'
        }}
      >
        {/* Brand Logo with subtle glow and breathing animation */}
        <div
          style={{
            position: 'relative',
            width: '84px',
            height: '84px',
            marginBottom: '1.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            className="ao-loader-glow"
            style={{
              position: 'absolute',
              inset: '-6px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, rgba(245, 158, 11, 0) 70%)',
              pointerEvents: 'none'
            }}
          />
          <div
            style={{
              width: '76px',
              height: '76px',
              borderRadius: '20px',
              backgroundColor: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
              position: 'relative',
              zIndex: 2
            }}
          >
            <img
              src={logo}
              alt="AO Core Logo"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-logo.png';
              }}
            />
          </div>
        </div>

        {/* Primary Platform Title */}
        <h1
          style={{
            margin: '0 0 0.35rem 0',
            fontSize: '1.5rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#ffffff',
            textTransform: 'uppercase'
          }}
        >
          AO Core
        </h1>

        {/* Company Subtitle */}
        <p
          style={{
            margin: '0 0 1.75rem 0',
            fontSize: '0.82rem',
            fontWeight: 500,
            color: '#a1a1aa',
            letterSpacing: '0.04em'
          }}
        >
          {company}
        </p>

        {/* Minimal Progress Track */}
        <div
          style={{
            width: '180px',
            height: '3px',
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '999px',
            overflow: 'hidden',
            position: 'relative',
            marginBottom: '1rem'
          }}
        >
          <div
            className="ao-loader-indeterminate-bar"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              borderRadius: '999px',
              background: 'linear-gradient(90deg, transparent, #f59e0b, #d97706, transparent)'
            }}
          />
        </div>

        {/* Status Message */}
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 500,
            color: '#71717a',
            letterSpacing: '0.03em',
            minHeight: '1.2rem'
          }}
        >
          {message}
        </span>

        {/* Failsafe Button */}
        {showFailsafe && (
          <div
            style={{
              marginTop: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              animation: 'aoFadeIn 0.3s ease-out'
            }}
          >
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#a1a1aa' }}>
              Initialization is taking longer than usual
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f4f4f5',
                padding: '0.35rem 0.85rem',
                borderRadius: '6px',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Refresh Application
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes aoIndeterminate {
          0% {
            left: -40%;
            width: 40%;
          }
          50% {
            left: 20%;
            width: 70%;
          }
          100% {
            left: 100%;
            width: 30%;
          }
        }
        @keyframes aoPulseGlow {
          0%, 100% {
            transform: scale(0.95);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.12);
            opacity: 0.6;
          }
        }
        @keyframes aoFadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ao-loader-indeterminate-bar {
          animation: aoIndeterminate 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .ao-loader-glow {
          animation: aoPulseGlow 2.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
