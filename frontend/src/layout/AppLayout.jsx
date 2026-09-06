import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import UserTour from '../components/UserTour';
import { usePWA } from '../context/PWAContext';
import SalesmanApp from '../pages/SalesmanApp';
import { useToast } from '../context/ToastContext';
import { menuStructure } from './menuConfig';

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (user?.role === 'Salesman') {
    return <SalesmanApp />;
  }

  const { settings } = useSettings();
  const { isInstallable, isInstalled, installApp } = usePWA();

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

  const hasAccess = (item) => {
    if (isSuperAdmin) return true;
    return item.roles.includes(userRole);
  };

  return (
    <div className="app-shell">
      <div className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} onClick={() => setSidebarOpen(false)} />
      <Sidebar collapsed={collapsed} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className={`main-area ${collapsed ? 'collapsed' : ''}`}>
        <Header onMenuToggle={handleMenuToggle} />
        <main style={{ flex: 1, overflowX: 'hidden', position: 'relative' }}>
          <div style={{ width: '100%', height: '100%' }}>
            <Outlet />
          </div>
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
          {menuStructure
            .filter(item => item.showOnMobileDrawer && hasAccess(item))
            .map((item) => (
              <div 
                key={item.id} 
                className="drawer-item" 
                onClick={() => handleDrawerNavigate(item.to)}
              >
                <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{item.emoji}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{item.label}</span>
              </div>
            ))
          }
          <div className="drawer-item" onClick={handleLogout} style={{ border: '1px solid rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
            <span style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🚪</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Logout</span>
          </div>
        </div>
      </div>

      {user && !user.tourCompleted && <UserTour />}
      {user && user.mustChangePassword && <ForceChangePasswordModal />}
    </div>
  );
}

function ForceChangePasswordModal() {
  const { changePassword, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(password);
      toast('✓ Password updated successfully!', 'success');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '2rem',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '24px',
        padding: '2.5rem 2rem',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: '#fff',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 10px rgba(245, 158, 11, 0.5))' }}>🔒</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#f59e0b', textAlign: 'center' }}>Secure Your Account</h2>
        <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', lineHeight: '1.5', margin: '0 0 1.5rem 0' }}>
          Your account was initialized with a temporary password. As a security measure, you are required to set a new password to continue.
        </p>

        <form onSubmit={handleSubmit} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {error && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '0.75rem', color: '#f87171', fontSize: '0.8rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>New Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter at least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>Confirm Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Re-enter new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{ backgroundColor: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff',
              border: 'none',
              borderRadius: '12px',
              padding: '0.85rem',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)',
              transition: 'all 0.2s',
              marginTop: '0.5rem'
            }}
          >
            {loading ? 'Updating Password...' : '💾 Update Password'}
          </button>

          <button
            type="button"
            onClick={logout}
            style={{
              backgroundColor: 'transparent',
              color: '#94a3b8',
              border: 'none',
              fontSize: '0.85rem',
              cursor: 'pointer',
              textDecoration: 'underline',
              marginTop: '0.25rem'
            }}
          >
            Cancel & Logout
          </button>
        </form>
      </div>
    </div>
  );
}
