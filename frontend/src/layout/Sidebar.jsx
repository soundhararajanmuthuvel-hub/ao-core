import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { resolveAssetUrl, getActiveLogoUrl } from '../utils/url';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { sfaApi, ordersApi, shippingApi, productsApi, customersApi } from '../api';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  MapPinned, 
  Factory, 
  Wallet, 
  BarChart3, 
  Settings as SettingsIcon, 
  Users as UsersIcon,
  Sparkles
} from 'lucide-react';

const menuStructure = [
  {
    type: 'link',
    to: '/',
    icon: LayoutDashboard,
    label: 'Dashboard',
    end: true,
    roles: ['Super Admin', 'admin', 'Manufacturing Manager', 'Billing Executive', 'Store Keeper', 'Dispatch Executive', 'Sales Executive', 'Sales Manager', 'Salesman', 'Delivery Staff']
  },
  {
    type: 'link',
    to: '/ai-assistant',
    icon: Sparkles,
    label: 'AI Assistant',
    roles: ['Super Admin', 'admin', 'Manufacturing Manager', 'Billing Executive', 'Store Keeper', 'Sales Executive', 'Sales Manager', 'Salesman']
  },
  {
    type: 'group',
    id: 'crm',
    icon: UsersIcon,
    label: 'CRM',
    roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'],
    children: [
      { to: '/crm/leads', label: 'Leads', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/crm/ai-lead-importer', label: 'AI Lead Importer', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/customers', label: 'Customers', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/crm/customer-map', label: 'Customer Map', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/crm/followups', label: 'Follow Ups', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/crm/re-engagement', label: 'Re-Engagement', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/crm/whatsapp-logs', label: 'Communication Center', roles: ['Super Admin', 'admin', 'Sales Manager'] }
    ]
  },
  {
    type: 'group',
    id: 'inventory',
    icon: Package,
    label: 'Inventory',
    roles: ['Super Admin', 'admin', 'Store Keeper', 'Manufacturing Manager', 'Sales Manager', 'Salesman', 'Sales Executive'],
    children: [
      { to: '/products', label: 'Products', roles: ['Super Admin', 'admin', 'Store Keeper'] },
      { to: '/products/catalog-center', label: 'Catalog Center', roles: ['Super Admin', 'admin', 'Sales Manager', 'Salesman', 'Sales Executive'] },
      { to: '/products?tab=raw-materials', label: 'Raw Materials', roles: ['Super Admin', 'admin', 'Manufacturing Manager', 'Store Keeper'] },
      { to: '/inventory', label: 'Stock', roles: ['Super Admin', 'admin', 'Store Keeper', 'Manufacturing Manager'] },
      { to: '/suppliers', label: 'Suppliers', roles: ['Super Admin', 'admin', 'Manufacturing Manager', 'Store Keeper'] }
    ]
  },
  {
    type: 'group',
    id: 'sales',
    icon: ShoppingCart,
    label: 'Sales',
    roles: ['Super Admin', 'admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive', 'Sales Manager', 'Salesman'],
    children: [
      { to: '/order-noting', label: 'Orders', roles: ['Super Admin', 'admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive', 'Store Keeper'] },
      { to: '/sales', label: 'Invoices', roles: ['Super Admin', 'admin', 'Billing Executive', 'Sales Executive', 'Dispatch Executive', 'Sales Manager', 'Salesman'] },
      { to: '/customers', label: 'Customers', roles: ['Super Admin', 'admin', 'Sales Executive', 'Billing Executive', 'Sales Manager', 'Salesman'] }
    ]
  },
  {
    type: 'group',
    id: 'manufacturing',
    icon: Factory,
    label: 'Manufacturing',
    roles: ['Super Admin', 'admin', 'Manufacturing Manager'],
    children: [
      { to: '/manufacturing?tab=production', label: 'Production', roles: ['Super Admin', 'admin', 'Manufacturing Manager'] },
      { to: '/manufacturing?tab=recipes', label: 'Recipes', roles: ['Super Admin', 'admin', 'Manufacturing Manager'] },
      { to: '/manufacturing?tab=packing-conversion', label: 'Packing Conversion', roles: ['Super Admin', 'admin', 'Manufacturing Manager'] }
    ]
  },
  {
    type: 'link',
    to: '/sales?tab=payments',
    icon: Wallet,
    label: 'Accounts',
    roles: ['Super Admin', 'admin', 'Billing Executive']
  },
  {
    type: 'link',
    to: '/reports',
    icon: BarChart3,
    label: 'Reports',
    roles: ['Super Admin', 'admin', 'Sales Manager']
  },
  {
    type: 'group',
    id: 'settings',
    icon: SettingsIcon,
    label: 'Settings',
    roles: ['Super Admin', 'admin'],
    children: [
      { to: '/settings', label: 'General Settings', roles: ['Super Admin', 'admin'] },
      { to: '/settings/integrations-marketplace', label: 'Integrations Marketplace', roles: ['Super Admin', 'admin'] },
      { to: '/settings/developer-center', label: 'Developer Center', roles: ['Super Admin', 'admin'] }
    ]
  },
  {
    type: 'link',
    to: '/users',
    icon: UsersIcon,
    label: 'Users',
    roles: ['Super Admin', 'admin']
  }
];

const badgeStyle = {
  fontSize: '0.7rem',
  fontWeight: '700',
  padding: '2px 6px',
  borderRadius: '10px',
  marginLeft: 'auto',
  color: '#fff',
  display: 'inline-block',
  minWidth: '18px',
  textAlign: 'center'
};

export default function Sidebar({ collapsed, open, onClose }) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const location = useLocation();

  const userRole = user?.role || '';
  const isUserAdmin = userRole === 'admin' || userRole === 'Super Admin';

  const [expandedMenus, setExpandedMenus] = useState(() => {
    const saved = localStorage.getItem('sidebar_expanded_menus');
    return saved ? JSON.parse(saved) : { inventory: true, sales: true, fieldSales: true };
  });

  const [counts, setCounts] = useState({
    routes: 0,
    visits: 0,
    orders: 0,
    deliveries: 0
  });

  const [stats, setStats] = useState({
    products: 0,
    customers: 0,
    ordersToday: 0
  });

  useEffect(() => {
    if (!user) return;
    const fetchCounts = async () => {
      try {
        const [
          productsRes,
          customersRes,
          ordersDashboardRes
        ] = await Promise.allSettled([
          productsApi.list({ limit: 1 }),
          customersApi.list({ limit: 1 }),
          ordersApi.dashboard()
        ]);
        
        setStats({
          products: productsRes.status === 'fulfilled' ? productsRes.value.data?.total || 0 : 0,
          customers: customersRes.status === 'fulfilled' ? customersRes.value.data?.total || 0 : 0,
          ordersToday: ordersDashboardRes.status === 'fulfilled' ? ordersDashboardRes.value.data?.todayOrders || 0 : 0
        });
      } catch (e) {
        console.error('Error fetching sidebar counts:', e);
      }
    };
    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const toggleMenu = (menuId) => {
    setExpandedMenus(prev => {
      const updated = { ...prev, [menuId]: !prev[menuId] };
      localStorage.setItem('sidebar_expanded_menus', JSON.stringify(updated));
      return updated;
    });
  };

  const hasAccess = (item) => {
    if (isUserAdmin) return true;
    return item.roles.includes(userRole);
  };

  const isChildActive = (group) => {
    return group.children.some(child => {
      const path = child.to.split('?')[0];
      return location.pathname === path;
    });
  };

  const getSubmenuBadge = (label) => {
    if (label === 'Route Planner' || label === 'Daily Beat Plan') {
      return counts.routes > 0 ? <span style={{ ...badgeStyle, backgroundColor: '#3b82f6' }}>{counts.routes}</span> : null;
    }
    if (label === 'Customer Visits' || label === 'Visit History') {
      return counts.visits > 0 ? <span style={{ ...badgeStyle, backgroundColor: '#10b981' }}>{counts.visits}</span> : null;
    }
    if (label === 'Field Orders' || label === 'Order History') {
      return counts.orders > 0 ? <span style={{ ...badgeStyle, backgroundColor: '#f97316' }}>{counts.orders}</span> : null;
    }
    if (label === 'Delivery Tracking') {
      return counts.deliveries > 0 ? <span style={{ ...badgeStyle, backgroundColor: '#ef4444' }}>{counts.deliveries}</span> : null;
    }
    return null;
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <motion.aside 
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'open' : ''}`}
      animate={{ width: isMobile ? 280 : (collapsed ? 72 : 260) }}
      transition={{ type: 'spring', stiffness: 220, damping: 26 }}
      style={{ overflowX: 'hidden' }}
    >
      <Link 
        to="/" 
        className={`sidebar-brand-card ${collapsed ? 'collapsed' : ''}`}
        onClick={onClose}
        style={{
          background: settings?.brandColor ? `linear-gradient(135deg, ${settings.brandColor}, #401e07)` : 'linear-gradient(135deg, #5a2d0c, #401e07)',
          boxShadow: 'none',
          borderLeft: '4px solid #ffffff'
        }}
      >
        <div className="brand-header-flex">
          <div className="brand-logo-container">
            <img
              src={getActiveLogoUrl(settings)}
              alt="Logo"
              className="brand-logo-img"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-logo.png';
              }}
            />
          </div>
          {!collapsed && (
            <div className="brand-info">
              <h1 className="brand-name">{settings?.companyName || 'Amudhasurabiy Organics'}</h1>
              <div className="brand-subtitle">Manufacturing ERP</div>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="brand-meta-row">
            <span className="brand-fy">{settings?.financialYear || '2026-27'}</span>
            <span className="brand-meta-divider">|</span>
            <span className="brand-role-text">{user?.role || 'SUPER ADMIN'}</span>
          </div>
        )}
      </Link>

      {!collapsed && (
        <div className="sidebar-quick-stats">
          <div className="stat-card">
            <span className="stat-value">{stats.products}</span>
            <span className="stat-label">Products</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.customers}</span>
            <span className="stat-label">Customers</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.ordersToday}</span>
            <span className="stat-label">Orders Today</span>
          </div>
        </div>
      )}

      <nav className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {menuStructure.filter(hasAccess).map((item) => {
          const IconComponent = item.icon;
          if (item.type === 'link') {
            const isLinkActive = location.pathname === item.to.split('?')[0];
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                id={`tour-${item.label.toLowerCase()}`}
                className={() => `nav-item ${isLinkActive ? 'active' : ''}`}
                onClick={onClose}
                data-tooltip={item.label}
              >
                <span className="nav-icon">
                  <IconComponent size={18} />
                </span>
                {!collapsed && <span className="nav-label">{item.label}</span>}
              </NavLink>
            );
          }

          if (item.type === 'group') {
            const visibleChildren = item.children.filter(hasAccess);
            if (visibleChildren.length === 0) return null;

            const isExpanded = expandedMenus[item.id] && !collapsed;
            const parentActive = isChildActive(item);

            return (
              <div key={item.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <button
                  type="button"
                  id={`tour-${item.id.toLowerCase()}`}
                  className={`nav-group-header ${parentActive ? 'parent-active' : ''}`}
                  onClick={() => toggleMenu(item.id)}
                  data-tooltip={item.label}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    color: parentActive ? '#ffffff' : '#94a3b8',
                    background: parentActive ? 'rgba(90, 45, 12, 0.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    marginBottom: '0.25rem',
                    borderLeft: parentActive ? '4px solid #5a2d0c' : '4px solid transparent'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span className="nav-icon">
                      <IconComponent size={18} />
                    </span>
                    {!collapsed && <span>{item.label}</span>}
                  </span>
                  {!collapsed && (
                    <span style={{
                      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      fontSize: '0.6rem',
                      color: '#94a3b8'
                    }}>
                      ▶
                    </span>
                  )}
                </button>

                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: 'easeInOut' }}
                      className="nav-group-children"
                      style={{
                        overflow: 'hidden',
                        paddingLeft: '0.5rem',
                        borderLeft: '1.5px solid rgba(255, 255, 255, 0.1)',
                        marginLeft: '1.5rem',
                        marginBottom: '0.5rem',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {visibleChildren.map((child) => {
                        const childActive = location.pathname + location.search === child.to || location.pathname === child.to.split('?')[0];
                        return (
                          <Link
                            key={child.to + '-' + child.label}
                            to={child.to}
                            className={`nav-sub-item ${childActive ? 'active' : ''}`}
                            onClick={onClose}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '6px',
                              color: childActive ? '#ffffff' : '#94a3b8',
                              background: childActive ? '#5a2d0c' : 'transparent',
                              fontSize: '0.85rem',
                              textDecoration: 'none',
                              transition: 'all 0.2s',
                              gap: '0.75rem',
                              marginTop: '2px'
                            }}
                          >
                            <span>{child.label}</span>
                            {getSubmenuBadge(child.label)}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }
          return null;
        })}
      </nav>
    </motion.aside>
  );
}
