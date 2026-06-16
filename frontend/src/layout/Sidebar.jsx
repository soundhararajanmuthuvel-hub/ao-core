import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { resolveAssetUrl } from '../utils/url';

const simplifiedNav = [
  { to: '/', icon: '📊', label: 'Dashboard', end: true, roles: ['Super Admin', 'admin', 'Manufacturing Manager', 'Billing Executive', 'Store Keeper', 'Dispatch Executive', 'Sales Executive'] },
  { to: '/products', icon: '📦', label: 'Products', roles: ['Super Admin', 'admin', 'Store Keeper'] },
  { to: '/inventory', icon: '📋', label: 'Inventory', roles: ['Super Admin', 'admin', 'Store Keeper', 'Manufacturing Manager'] },
  { to: '/manufacturing', icon: '🏭', label: 'Manufacturing', roles: ['Super Admin', 'admin', 'Manufacturing Manager'] },
  { to: '/sales', icon: '🧾', label: 'Sales', roles: ['Super Admin', 'admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive'] },
  { to: '/order-noting', icon: '📦', label: 'Order Noting', roles: ['Super Admin', 'admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive', 'Store Keeper'] },
  { to: '/customers', icon: '👥', label: 'Customers', roles: ['Super Admin', 'admin', 'Sales Executive', 'Billing Executive'] },
  { to: '/suppliers', icon: '🤝', label: 'Suppliers', roles: ['Super Admin', 'admin', 'Manufacturing Manager', 'Store Keeper'] },
  { to: '/reports', icon: '📑', label: 'Reports', roles: ['Super Admin', 'admin'] },
  { to: '/settings', icon: '⚙️', label: 'Settings', roles: ['Super Admin', 'admin'] },
  { to: '/users', icon: '👥', label: 'Users', roles: ['Super Admin', 'admin'] },
];

import { motion } from 'framer-motion';

export default function Sidebar({ collapsed, open, onClose }) {
  const { user } = useAuth();
  const { settings } = useSettings();

  const userRole = user?.role || '';
  const isUserAdmin = userRole === 'admin' || userRole === 'Super Admin';

  const visibleNav = simplifiedNav.filter(item => {
    if (isUserAdmin) return true;
    return item.roles.includes(userRole);
  });

  return (
    <motion.aside 
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'open' : ''}`}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      style={{ overflow: 'hidden' }}
    >
      <Link 
        to="/" 
        className={`sidebar-brand-card ${collapsed ? 'collapsed' : ''}`}
        onClick={onClose}
      >
        <div className="brand-logo-container">
          <img src={settings?.logo ? resolveAssetUrl(settings.logo) : '/favicon.png'} alt="Logo" className="brand-logo-img" />
        </div>
        {!collapsed && (
          <div className="brand-info">
            <h1 className="brand-name">{settings?.companyName || 'Amudhasurabiy Organics'}</h1>
            <div className="brand-subtitle">Manufacturing ERP</div>
            <div className="brand-meta">
              <span className="brand-fy">{settings?.financialYear || 'FY 2026-27'}</span>
              <span className="brand-role">{user?.role || 'Super Admin'}</span>
            </div>
          </div>
        )}
      </Link>
      <nav className="sidebar-nav">
        {visibleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            onClick={onClose}
            data-tooltip={item.label}
          >
            <span className="nav-icon" style={{ fontSize: '1.15rem' }}>{item.icon}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </motion.aside>
  );
}
