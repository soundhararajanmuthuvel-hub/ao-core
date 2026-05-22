import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { resolveAssetUrl } from '../utils/url';

const allNav = [
  { to: '/', icon: '📊', label: 'Dashboard', end: true },
  { to: '/products', icon: '📦', label: 'Products' },
  { to: '/sales', icon: '🧾', label: 'Sales' },
  { to: '/customers', icon: '👥', label: 'Customers' },
  { to: '/inventory', icon: '📋', label: 'Inventory', admin: true },
  { to: '/suppliers', icon: '🏭', label: 'Suppliers', admin: true },
  { to: '/purchases', icon: '🛒', label: 'Purchases', admin: true },
  { to: '/analytics', icon: '📈', label: 'Analytics', admin: true },
  { to: '/reports', icon: '📑', label: 'Reports', admin: true },
  { to: '/activity', icon: '📝', label: 'Activity', admin: true },
  { to: '/users', icon: '🔐', label: 'Users', admin: true },
  { to: '/settings', icon: '⚙️', label: 'Settings', admin: true },
];

export default function Sidebar({ collapsed, open, onClose }) {
  const { isAdmin } = useAuth();
  const { settings } = useSettings();
  const nav = allNav.filter((n) => !n.admin || isAdmin);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'open' : ''}`}>
      <div className="sidebar-brand">
        {settings?.logo ? (
          <img src={resolveAssetUrl(settings.logo)} alt="Logo" />
        ) : (
          <span style={{ fontSize: '1.5rem' }}>🌿</span>
        )}
        {!collapsed && <h1>{settings?.companyName || 'AO Core'}</h1>}
      </div>
      <nav className="sidebar-nav" onClick={onClose}>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
