import { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSettings } from './SettingsContext';
import { resolveAssetUrl } from '../utils/url';
import { useCompanyBrand } from './CompanyBrandContext';

const ToastContext = createContext(null);

const isCrmError = (message) => {
  if (!message) return false;
  const msg = String(message).toLowerCase();
  return (
    msg.includes('crm') || 
    msg.includes('api key missing') || 
    msg.includes('whatsapp') ||
    msg.includes('phone missing') ||
    msg.includes('rejected request')
  );
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const { settings } = useSettings();

  const toast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    
    // Only auto-dismiss non-error alerts so user has time to view critical error logs
    if (type !== 'error') {
      setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, type === 'success' ? 4000 : 3500);
    }
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  // Separate standard slide-in toasts (info, warning) from overlay alerts (success, error)
  const slideAlerts = toasts.filter((t) => t.type === 'info' || t.type === 'warning' || t.type === 'success' || t.type === 'error');
  const overlayAlerts = toasts.filter((t) => t.type === 'success' || t.type === 'error');

  const { logoUrl } = useCompanyBrand();
  const logoSrc = logoUrl;

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* 1. Global Standard Side Slide Toasts (Info & Warnings) */}
      <div className="toast-container" role="status" style={{ pointerEvents: 'none' }}>
        <AnimatePresence>
          {slideAlerts.map((t) => {
            const borderLeftColor = {
              success: '#10b981',
              error: '#ef4444',
              warning: '#f59e0b',
              info: '#3b82f6'
            }[t.type] || '#3b82f6';

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 100, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                className={`toast toast-${t.type} glass-popup`}
                style={{
                  pointerEvents: 'auto',
                  background: 'rgba(15, 23, 42, 0.85)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  boxShadow: t.type === 'warning' 
                    ? '0 10px 30px rgba(245, 158, 11, 0.15)' 
                    : t.type === 'error'
                    ? '0 10px 30px rgba(239, 68, 68, 0.15)'
                    : t.type === 'success'
                    ? '0 10px 30px rgba(16, 185, 129, 0.15)'
                    : '0 10px 30px rgba(59, 130, 246, 0.15)',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  color: '#fff',
                  minWidth: '320px',
                  maxWidth: '420px',
                  borderLeft: `4px solid ${borderLeftColor}`,
                  position: 'relative'
                }}
              >
                {/* Brand Logo inside White Circular Container */}
                <div style={{
                  width: '32px',
                  height: '32px',
                  backgroundColor: '#ffffff',
                  borderRadius: '50%',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  flexShrink: 0
                }}>
                  <img
                    src={logoSrc}
                    alt="Logo"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = '/favicon.png';
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain'
                    }}
                  />
                </div>

                <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500 }}>
                  {t.message}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.4)',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'all 0.2s',
                    flexShrink: 0
                  }}
                  onMouseEnter={(e) => e.target.style.color = '#fff'}
                  onMouseLeave={(e) => e.target.style.color = 'rgba(255, 255, 255, 0.4)'}
                >
                  ✕
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* 2. Global Centered Overlay Alerts (Success & Error Modals) */}
      <AnimatePresence>
        {overlayAlerts.map((t) => {
          if (t.type === 'success') {
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => dismiss(t.id)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(2, 6, 23, 0.4)',
                  backdropFilter: 'blur(6px)',
                  WebkitBackdropFilter: 'blur(6px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 999999,
                  pointerEvents: 'auto'
                }}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                  onClick={(e) => e.stopPropagation()}
                  className="glass-popup"
                  style={{
                    padding: '2.5rem 3rem',
                    borderRadius: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '1.25rem',
                    maxWidth: '440px',
                    width: '90%',
                    textAlign: 'center',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(16, 185, 129, 0.25)'
                  }}
                >
                  {/* Brand Logo Dedicated Container (WCAG compliant contrast background) */}
                  <div style={{
                    width: '90px',
                    height: '90px',
                    backgroundColor: '#ffffff',
                    borderRadius: '50%',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid rgba(245, 158, 11, 0.35)',
                    boxShadow: '0 0 30px rgba(245, 158, 11, 0.25)',
                    zIndex: 2
                  }}>
                    <img
                      src={logoSrc}
                      alt="Brand Logo"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/favicon.png';
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  </div>

                  {/* SVG Success Checkmark Animation */}
                  <div style={{ marginTop: '0.25rem' }}>
                    <svg width="64" height="64" viewBox="0 0 72 72" fill="none">
                      <circle cx="36" cy="36" r="32" fill="rgba(16, 185, 129, 0.05)" />
                      <motion.circle
                        cx="36"
                        cy="36"
                        r="30"
                        stroke="#10b981"
                        strokeWidth="4"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                      <motion.path
                        d="M22 36L31 45L50 23"
                        stroke="#10b981"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.5, delay: 0.4, ease: "easeOut" }}
                      />
                    </svg>
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize: '1.45rem', fontWeight: 700, color: '#10b981', margin: 0 }}>
                    ✓ Success
                  </h3>

                  {/* Message Details */}
                  <p style={{ fontSize: '0.95rem', color: 'rgba(255, 255, 255, 0.85)', lineHeight: 1.5, margin: 0 }}>
                    {t.message}
                  </p>

                  <button
                    type="button"
                    onClick={() => dismiss(t.id)}
                    className="btn btn-success"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      backgroundColor: '#10b981',
                      color: '#fff',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    Continue
                  </button>
                </motion.div>
              </motion.div>
            );
          } else {
            // Error Modal
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(2, 6, 23, 0.55)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 999999,
                  pointerEvents: 'auto'
                }}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.9, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="glass-popup"
                  style={{
                    padding: '2.5rem',
                    borderRadius: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.25rem',
                    maxWidth: '480px',
                    width: '90%',
                    textAlign: 'center',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(239, 68, 68, 0.08)'
                  }}
                >
                  {/* Brand Logo Dedicated Container (WCAG compliant contrast background) */}
                  <div style={{
                    width: '90px',
                    height: '90px',
                    backgroundColor: '#ffffff',
                    borderRadius: '50%',
                    padding: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '2px solid rgba(245, 158, 11, 0.35)',
                    boxShadow: '0 0 30px rgba(245, 158, 11, 0.25)',
                    zIndex: 2
                  }}>
                    <img
                      src={logoSrc}
                      alt="Brand Logo"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/favicon.png';
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain'
                      }}
                    />
                  </div>

                  {/* SVG Error Cross Animation */}
                  <div>
                    <svg width="64" height="64" viewBox="0 0 72 72" fill="none">
                      <circle cx="36" cy="36" r="32" fill="rgba(239, 68, 68, 0.05)" />
                      <motion.circle
                        cx="36"
                        cy="36"
                        r="30"
                        stroke="#ef4444"
                        strokeWidth="4"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                      <motion.path
                        d="M24 24L48 48"
                        stroke="#ef4444"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
                      />
                      <motion.path
                        d="M48 24L24 48"
                        stroke="#ef4444"
                        strokeWidth="4.5"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.4, delay: 0.5, ease: "easeOut" }}
                      />
                    </svg>
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ef4444', margin: 0, letterSpacing: '0.5px' }}>
                    ✕ Action Failed
                  </h3>

                  {/* Detailed Error Message */}
                  <div 
                    style={{ 
                      width: '100%',
                      fontSize: '0.9rem', 
                      color: 'rgba(255, 255, 255, 0.85)', 
                      lineHeight: 1.6,
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '1rem 1.25rem',
                      borderRadius: '12px',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      wordBreak: 'break-word',
                      textAlign: 'left',
                      fontFamily: 'monospace'
                    }}
                  >
                    {t.message || 'An unexpected error occurred. Please try again.'}
                  </div>

                  {isCrmError(t.message) && (
                    <div style={{
                      width: '100%',
                      marginTop: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(249, 115, 22, 0.12)',
                      border: '1px solid rgba(249, 115, 22, 0.25)',
                      color: '#fdba74',
                      fontSize: '0.85rem',
                      textAlign: 'left',
                      lineHeight: 1.5
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        🔌 Cusman CRM Integration Help
                      </div>
                      <div>
                        This error was returned from the CRM gateway. Please check that your API endpoints and credentials for <strong>Cusman CRM Integration</strong> are configured correctly under Settings &gt; CRM WhatsApp.
                      </div>
                    </div>
                  )}

                  {/* Close / Dismiss Buttons */}
                  <div style={{ display: 'flex', gap: '0.75rem', width: '100%', marginTop: '0.5rem' }}>
                    <button
                      onClick={() => dismiss(t.id)}
                      className="btn btn-secondary"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        borderRadius: '12px',
                        fontWeight: 600,
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => dismiss(t.id)}
                      className="btn btn-danger"
                      style={{
                        flex: 1,
                        padding: '0.75rem',
                        borderRadius: '12px',
                        fontWeight: 600,
                        background: '#ef4444',
                        border: 'none',
                        color: '#fff',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Close
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            );
          }
        })}
      </AnimatePresence>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
