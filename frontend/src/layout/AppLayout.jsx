import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { resolveAssetUrl } from '../utils/url';
import { useCompanyBrand } from '../context/CompanyBrandContext';
import { motion, AnimatePresence } from 'framer-motion';
import UserTour from '../components/UserTour';
import { usePWA } from '../context/PWAContext';
import SalesmanApp from '../pages/SalesmanApp';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { logoUrl } = useCompanyBrand();

  if (user?.role === 'Salesman') {
    return <SalesmanApp />;
  }

  const { settings } = useSettings();
  const { isInstallable, isInstalled, installApp } = usePWA();
  const [showLaunch, setShowLaunch] = useState(false);
  const [launchProgress, setLaunchProgress] = useState(0);
  const [launchMessage, setLaunchMessage] = useState('Initializing AO Core...');

  // Handle guided tour control of the sidebar (expanded/collapsed and mobile drawer)
  useEffect(() => {
    const handleTourSidebar = (e) => {
      const { open, collapsed: isCollapsed } = e.detail;
      if (open !== undefined) setSidebarOpen(open);
      if (isCollapsed !== undefined) setCollapsed(isCollapsed);
    };
    window.addEventListener('tour-set-sidebar', handleTourSidebar);
    return () => window.removeEventListener('tour-set-sidebar', handleTourSidebar);
  }, []);

  // Global loading states from custom events
  const [activeRequests, setActiveRequests] = useState(0);
  const [apiLoadingMessage, setApiLoadingMessage] = useState('Processing request...');
  const [apiLoadingType, setApiLoadingType] = useState('general');

  // Safety timeout to prevent permanent loading states
  useEffect(() => {
    if (activeRequests > 0) {
      const timer = setTimeout(() => {
        console.warn('[PWA] Active requests hung for too long. Force clearing loading overlay.');
        setActiveRequests(0);
      }, 25000); // 25 seconds safety timeout
      return () => clearTimeout(timer);
    }
  }, [activeRequests]);

  useEffect(() => {
    const hasSeen = sessionStorage.getItem('hasSeenAppLaunch');
    if (!hasSeen && user) {
      setShowLaunch(true);
    }
  }, [user]);

  // Launch loader effect (exactly 2 seconds display)
  useEffect(() => {
    if (!showLaunch) return;
    
    const duration = 2000;
    const intervalTime = 50;
    const steps = duration / intervalTime;
    let currentStep = 0;
    
    const messages = [
      { thresh: 0, text: "Initializing AO Core..." },
      { thresh: 12, text: "Loading Products..." },
      { thresh: 24, text: "Loading Inventory..." },
      { thresh: 36, text: "Loading Customers..." },
      { thresh: 48, text: "Loading Manufacturing..." },
      { thresh: 60, text: "Loading Sales..." },
      { thresh: 72, text: "Loading Reports..." },
      { thresh: 84, text: "Syncing WooCommerce..." },
      { thresh: 95, text: "System Ready..." }
    ];

    const timer = setInterval(() => {
      currentStep++;
      const progress = Math.min(100, Math.round((currentStep / steps) * 100));
      setLaunchProgress(progress);
      
      const activeMsg = [...messages].reverse().find(m => progress >= m.thresh);
      if (activeMsg) {
        setLaunchMessage(activeMsg.text);
      }

      if (currentStep >= steps) {
        clearInterval(timer);
        setTimeout(() => {
          setShowLaunch(false);
          sessionStorage.setItem('hasSeenAppLaunch', 'true');
        }, 300);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [showLaunch]);

  // Subscribe to Axios API call events
  useEffect(() => {
    const getLoadingDetails = (url, method) => {
      if (!url) return { message: 'Processing request...', type: 'general' };
      const u = url.toLowerCase();
      const m = method?.toLowerCase() || 'get';
      
      if (u.includes('/auth/login')) {
        return { message: 'Initializing AO Core...', type: 'general' };
      }
      if (u.includes('/analytics/dashboard')) {
        return { message: 'Loading Dashboard...', type: 'general' };
      }
      if (u.includes('/customers/') && m === 'get') {
        return { message: 'Loading Customer Ledger...', type: 'customer' };
      }
      if (u.includes('/sales/') && m === 'get') {
        return { message: 'Loading Invoice...', type: 'invoice' };
      }
      if (u.includes('/reports')) {
        return { message: 'Generating Report...', type: 'general' };
      }
      if (u.includes('/integrations/sync') || u.includes('/integrations/all')) {
        return { message: 'Syncing WooCommerce...', type: 'general' };
      }
      if (u.includes('/manufacturing/entries') || u.includes('/inventory/manufacturing')) {
        if (m === 'post') {
          return { message: 'Mixing Raw Materials...', type: 'manufacturing' };
        }
        return { message: 'Loading Manufacturing...', type: 'manufacturing' };
      }
      if (u.includes('/shipping') || u.includes('/orders/')) {
        if (m === 'post' || m === 'put') {
          return { message: 'Preparing Shipment...', type: 'shipping' };
        }
        return { message: 'Loading Shipping...', type: 'shipping' };
      }
      return { message: 'Processing Request...', type: 'general' };
    };

    const handleStart = (e) => {
      const { url, method } = e.detail;
      const details = getLoadingDetails(url, method);
      setApiLoadingMessage(details.message);
      setApiLoadingType(details.type);
      setActiveRequests(prev => prev + 1);
    };

    const handleEnd = () => {
      setActiveRequests(prev => Math.max(0, prev - 1));
    };

    window.addEventListener('ao-loading-start', handleStart);
    window.addEventListener('ao-loading-end', handleEnd);

    return () => {
      window.removeEventListener('ao-loading-start', handleStart);
      window.removeEventListener('ao-loading-end', handleEnd);
    };
  }, []);

  // Cyclic message rotation logic
  useEffect(() => {
    if (activeRequests === 0 || apiLoadingType === 'general') return;

    const cycleMessages = {
      customer: [
        "Loading Customer Ledger...",
        "Loading Outstanding...",
        "Loading Transactions...",
        "Loading Payment History..."
      ],
      invoice: [
        "Loading Invoice...",
        "Calculating GST...",
        "Preparing Ledger...",
        "Fetching Customer Data..."
      ],
      manufacturing: [
        "Mixing Raw Materials...",
        "Calculating Cost...",
        "Creating Batch...",
        "Updating Inventory..."
      ],
      shipping: [
        "Preparing Shipment...",
        "Generating Delivery Slip...",
        "Updating Stock...",
        "Saving Tracking Data..."
      ]
    };

    const list = cycleMessages[apiLoadingType];
    if (!list) return;

    let index = 0;
    setApiLoadingMessage(list[0]);

    const timer = setInterval(() => {
      index = (index + 1) % list.length;
      setApiLoadingMessage(list[index]);
    }, 450);

    return () => clearInterval(timer);
  }, [activeRequests, apiLoadingType]);

  // Handle auto-collapsing on Tablet (768px - 1024px)
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && window.innerWidth <= 1024) {
        setCollapsed(true);
      } else if (window.innerWidth > 1024) {
        setCollapsed(false);
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // run initially
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMenuToggle = () => {
    if (window.innerWidth < 768) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setCollapsed(!collapsed);
    }
  };

  const handleFabAction = (path) => {
    setFabOpen(false);
    navigate(path);
  };

  const handleDrawerNavigate = (path) => {
    setDrawerOpen(false);
    navigate(path);
  };

  const handleLogout = () => {
    setDrawerOpen(false);
    logout();
    navigate('/login');
  };

  const userRole = user?.role || '';
  const isSuperAdmin = userRole === 'admin' || userRole === 'Super Admin';

  return (
    <div className="app-shell">
      <AnimatePresence>
        {showLaunch && (
          <motion.div 
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="luxury-splash-bg"
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontFamily: 'Inter, sans-serif',
              overflow: 'hidden'
            }}
          >
            {/* Background elements */}
            <div className="luxury-ray" />
            <div className="luxury-glow-ball" style={{ width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, rgba(0,0,0,0) 70%)', top: '10%', left: '10%' }} />
            <div className="luxury-glow-ball" style={{ width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(37,99,235,0.06) 0%, rgba(0,0,0,0) 70%)', bottom: '10%', right: '10%' }} />

            {/* Floating golden particles */}
            {Array.from({ length: 15 }).map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  bottom: '-20px',
                  left: `${(i * 7 + 13) % 100}%`,
                  width: `${(i * 3 + 2) % 4 + 3}px`,
                  height: `${(i * 3 + 2) % 4 + 3}px`,
                  borderRadius: '50%',
                  backgroundColor: '#fbbf24',
                  boxShadow: '0 0 8px #f59e0b',
                  animation: `floatParticles ${(i * 2 % 5) + 6}s infinite linear`,
                  animationDelay: `${(i * 1.5 % 4)}s`,
                  pointerEvents: 'none'
                }}
              />
            ))}

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1.25rem',
                marginBottom: '2rem',
                textAlign: 'center',
                zIndex: 10
              }}
            >
              <div style={{ position: 'relative' }}>
                {/* Golden Pulse Ring */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [0.2, 0.5, 0], scale: [1, 1.25, 1.4] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'easeOut', delay: 0.5 }}
                  style={{
                    position: 'absolute',
                    inset: -8,
                    borderRadius: '50%',
                    border: '2px solid #f59e0b',
                    pointerEvents: 'none'
                  }}
                />
                
                <motion.div
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  style={{
                    width: '90px',
                    height: '90px',
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '2px solid rgba(245, 158, 11, 0.35)',
                    boxShadow: '0 0 50px rgba(245, 158, 11, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px'
                  }}
                >
                  <img
                    src={logoUrl}
                    alt="Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </motion.div>
              </div>

              <div>
                <motion.h1 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.0 }}
                  style={{
                    margin: 0,
                    fontSize: '2.2rem',
                    fontWeight: 900,
                    letterSpacing: '1px',
                    color: '#ffffff',
                    textShadow: '0 2px 10px rgba(0,0,0,0.5)'
                  }}
                >
                  AMUDHASURABIY ORGANICS
                </motion.h1>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 1.5 }}
                  style={{
                    margin: '0.4rem 0 0 0',
                    fontSize: '0.9rem',
                    color: '#F59E0B',
                    fontWeight: 700,
                    letterSpacing: '4px',
                    textTransform: 'uppercase'
                  }}
                >
                  Manufacturing ERP Platform
                </motion.p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.0 }}
              style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center', zIndex: 10 }}
            >
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(8px)',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}>
                <div 
                  className="progress-bar-shine"
                  style={{
                    height: '100%',
                    width: `${launchProgress}%`,
                    transition: 'width 0.05s linear'
                  }}
                />
              </div>
              <div style={{
                fontSize: '0.85rem',
                color: '#94a3b8',
                fontWeight: 500,
                height: '20px',
                textAlign: 'center',
                letterSpacing: '0.5px'
              }}>
                {launchMessage}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Mini Loading Overlay */}
      <AnimatePresence>
        {activeRequests > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(2, 6, 23, 0.75)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              zIndex: 99998,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontFamily: 'Inter, sans-serif'
            }}
          >
            {/* Spinning Brand Logo */}
            <div style={{ position: 'relative', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  border: '3px solid transparent',
                  borderTopColor: '#f59e0b',
                  borderBottomColor: '#f59e0b',
                  position: 'absolute'
                }}
              />
              <div style={{
                width: '60px',
                height: '60px',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '50%',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 30px rgba(245, 158, 11, 0.4)',
                zIndex: 2
              }}>
                <img
                  src={logoUrl}
                  alt="Logo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain'
                  }}
                />
              </div>
            </div>
            
            <motion.div
              key={apiLoadingMessage}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                fontSize: '0.9rem',
                fontWeight: 600,
                color: '#f8fafc',
                letterSpacing: '0.5px'
              }}
            >
              {apiLoadingMessage}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <Sidebar collapsed={collapsed} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className={`main-area ${collapsed ? 'collapsed' : ''}`}>
        <Header onMenuToggle={handleMenuToggle} />
        <main style={{ flex: 1, overflowX: 'hidden', position: 'relative' }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.25, 0.8, 0.25, 1] }}
              style={{ width: '100%', height: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Floating Quick Actions (FAB) */}
      <div className="fab-container">
        <div className={`fab-menu ${fabOpen ? 'open' : ''}`}>
          <div className="fab-action-item" onClick={() => handleFabAction('/sales?tab=new')}>
            <span className="fab-action-icon">✍️</span> New Invoice
          </div>
          <div className="fab-action-item" onClick={() => handleFabAction('/customers')}>
            <span className="fab-action-icon">👥</span> New Customer
          </div>
          <div className="fab-action-item" onClick={() => handleFabAction('/products')}>
            <span className="fab-action-icon">📦</span> New Product
          </div>
          <div className="fab-action-item" onClick={() => handleFabAction('/sales?tab=payments')}>
            <span className="fab-action-icon">💰</span> Record Payment
          </div>
        </div>
        <button 
          type="button" 
          className={`fab-main-btn ${fabOpen ? 'open' : ''}`} 
          onClick={() => setFabOpen(!fabOpen)}
          title="Quick Actions"
        >
          ➕
        </button>
      </div>

      {isInstallable && !isInstalled && (
        <div className="pwa-mobile-chip-container" style={{
          position: 'fixed',
          bottom: '76px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          width: 'auto',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <button
            type="button"
            onClick={installApp}
            style={{
              backgroundColor: 'rgba(90, 45, 12, 0.95)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(12px)',
              padding: '0.65rem 1.25rem',
              borderRadius: '30px',
              fontSize: '0.85rem',
              fontWeight: 700,
              boxShadow: '0 10px 20px rgba(90, 45, 12, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#401e07';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(90, 45, 12, 0.95)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            📲 Install App
          </button>
        </div>
      )}

      <nav className="mobile-bottom-nav">
        <NavLink to="/" end className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">🏠</span>
          <span>Home</span>
        </NavLink>
        <NavLink to="/customers" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">👥</span>
          <span>Customers</span>
        </NavLink>
        <NavLink to="/sales" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">🧾</span>
          <span>Sales</span>
        </NavLink>
        <NavLink to="/crm/customer-map" className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <span className="bottom-nav-icon">🗺️</span>
          <span>Map</span>
        </NavLink>
        <button
          type="button"
          className={`bottom-nav-item ${drawerOpen ? 'active' : ''}`}
          onClick={() => setDrawerOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', outline: 'none' }}
        >
          <span className="bottom-nav-icon">☰</span>
          <span>More</span>
        </button>
      </nav>

      {/* Slide-out Drawer for "More" Mobile menus */}
      <div className={`more-drawer-overlay ${drawerOpen ? 'open' : ''}`} onClick={() => setDrawerOpen(false)} />
      <div className={`more-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3 style={{ margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>More Actions</h3>
          <button type="button" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setDrawerOpen(false)}>✕</button>
        </div>
        <div className="drawer-grid">
          <div className="drawer-item" onClick={() => handleDrawerNavigate('/crm')}>
            <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📊</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>CRM</span>
          </div>
          <div className="drawer-item" onClick={() => handleDrawerNavigate('/customer-visits')}>
            <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📍</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Visits</span>
          </div>
          <div className="drawer-item" onClick={() => handleDrawerNavigate('/sales-targets')}>
            <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🎯</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Targets</span>
          </div>
          <div className="drawer-item" onClick={() => handleDrawerNavigate('/field-ordering')}>
            <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🛒</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Orders</span>
          </div>
          <div className="drawer-item" onClick={() => handleDrawerNavigate('/delivery-tracking')}>
            <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🚚</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Delivery</span>
          </div>
          {(isSuperAdmin || userRole === 'Manufacturing Manager') && (
            <div className="drawer-item" onClick={() => handleDrawerNavigate('/manufacturing')}>
              <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🏭</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Production</span>
            </div>
          )}
          {isSuperAdmin && (
            <>
              <div className="drawer-item" onClick={() => handleDrawerNavigate('/reports')}>
                <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>📑</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Reports</span>
              </div>
              <div className="drawer-item" onClick={() => handleDrawerNavigate('/settings')}>
                <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>⚙️</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Settings</span>
              </div>
              <div className="drawer-item" onClick={() => handleDrawerNavigate('/users')}>
                <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🔐</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Users</span>
              </div>
              <div className="drawer-item" onClick={() => handleDrawerNavigate('/suppliers')}>
                <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🤝</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Suppliers</span>
              </div>
            </>
          )}
          <div className="drawer-item" onClick={handleLogout} style={{ border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
            <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🚪</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Logout</span>
          </div>
        </div>
      </div>

      {user && !user.tourCompleted && !showLaunch && <UserTour />}
    </div>
  );
}
