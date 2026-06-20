import { useState, useEffect } from 'react';
import { usePWA } from '../context/PWAContext';

export default function PWAInstallButton({ isMobileOverride }) {
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [showMobileDialog, setShowMobileDialog] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (isMobileOverride !== undefined) return isMobileOverride;
    return window.innerWidth <= 768;
  });

  useEffect(() => {
    if (isMobileOverride !== undefined) return;
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobileOverride]);

  if (!isInstallable || isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isMobile) {
      setShowMobileDialog(true);
    } else {
      await installApp();
    }
  };

  const handleConfirmInstall = async () => {
    setShowMobileDialog(false);
    await installApp();
  };

  // -------------------------------------------------------------
  // Mobile Header Icon View
  // -------------------------------------------------------------
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '1.35rem',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            minWidth: '44px',
            borderRadius: '50%',
            transition: 'background-color 0.2s ease',
            marginLeft: '0.25rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="Install App"
        >
          📲
        </button>

        {/* Custom Mobile Install Prompt Modal */}
        {showMobileDialog && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 99999,
            animation: 'fadeIn 0.2s ease-in-out'
          }}>
            <div style={{
              width: '100%',
              maxWidth: '480px',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              backdropFilter: 'blur(20px) saturate(180%)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              border: '1px solid rgba(255, 255, 255, 0.5)',
              borderBottom: 'none',
              padding: '1.75rem',
              boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.1), 0 -8px 10px -6px rgba(0, 0, 0, 0.05)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              fontFamily: 'Inter, sans-serif',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '2rem' }}>📲</span>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#5a2d0c' }}>
                    Install AO ERP App
                  </h3>
                  <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Web App Version 1.2.0
                  </p>
                </div>
              </div>

              <div style={{
                fontSize: '0.9rem',
                color: '#475569',
                lineHeight: '1.6',
                margin: '0.5rem 0'
              }}>
                Install AO ERP on your device for faster access and offline support. Run it in fullscreen mode directly from your home screen.
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                marginTop: '0.5rem'
              }}>
                <button
                  type="button"
                  onClick={handleConfirmInstall}
                  style={{
                    width: '100%',
                    height: '46px',
                    backgroundColor: '#5a2d0c',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(90, 45, 12, 0.15)',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#401e07';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#5a2d0c';
                  }}
                >
                  Install Now
                </button>
                <button
                  type="button"
                  onClick={() => setShowMobileDialog(false)}
                  style={{
                    width: '100%',
                    height: '46px',
                    backgroundColor: 'rgba(0, 0, 0, 0.05)',
                    color: '#475569',
                    border: 'none',
                    borderRadius: '12px',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                  }}
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // -------------------------------------------------------------
  // Desktop Header Pill View
  // -------------------------------------------------------------
  return (
    <button
      type="button"
      className="pwa-install-desktop-btn"
      onClick={handleInstallClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.4rem 0.8rem',
        fontSize: '0.85rem',
        fontWeight: 600,
        borderRadius: '10px',
        backgroundColor: '#2563eb',
        color: '#ffffff',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1)',
        marginRight: '0.5rem',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        minHeight: '36px'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#1d4ed8';
        e.currentTarget.style.transform = 'translateY(-1.5px)';
        e.currentTarget.style.boxShadow = '0 10px 15px -3px rgba(37, 99, 235, 0.3), 0 4px 6px -2px rgba(37, 99, 235, 0.15)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#2563eb';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1)';
      }}
    >
      📲 <span style={{ whiteSpace: 'nowrap' }}>Install App</span>
    </button>
  );
}
