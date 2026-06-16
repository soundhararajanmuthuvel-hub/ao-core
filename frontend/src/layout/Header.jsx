import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { resolveAssetUrl } from '../utils/url';
import { searchApi, notificationsApi, salesApi } from '../api';

export default function Header({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [results, setResults] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [showNotif, setShowNotif] = useState(false);
  const [showUser, setShowUser] = useState(false);

  useEffect(() => {
    notificationsApi.list().then(({ data }) => {
      setNotifications(data.notifications);
      setUnread(data.unreadCount);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (search.length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      searchApi.global(search).then(({ data }) => setResults(data)).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const handleSearchClick = (type, item) => {
    setSearch('');
    setResults(null);
    if (type === 'product') navigate('/products');
    else if (type === 'customer') navigate('/customers');
    else if (type === 'invoice') navigate(`/sales/${item._id || item.id}`);
  };

  return (
    <header className="app-header">
      {searchExpanded ? (
        <div className="mobile-search-overlay">
          <button type="button" className="btn-icon" onClick={() => { setSearchExpanded(false); setSearch(''); }} style={{ minHeight: '44px', minWidth: '44px' }}>
            ←
          </button>
          <div className="search-box" style={{ flex: 1, maxWidth: '100%' }}>
            <input
              type="search"
              placeholder="Search everywhere..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              style={{ width: '100%', minHeight: '44px' }}
            />
            {results && (
              <div className="search-dropdown" style={{ left: 0, right: 0 }}>
                {results.products?.map((p) => (
                  <div key={p._id || p.id} className="search-dropdown-item" onClick={() => { handleSearchClick('product', p); setSearchExpanded(false); }}>
                    📦 {p.name} ({p.sku})
                  </div>
                ))}
                {results.customers?.map((c) => (
                  <div key={c._id || c.id} className="search-dropdown-item" onClick={() => { handleSearchClick('customer', c); setSearchExpanded(false); }}>
                    👤 {c.name}
                  </div>
                ))}
                {results.invoices?.map((i) => (
                  <div key={i._id || i.id} className="search-dropdown-item" onClick={() => { handleSearchClick('invoice', i); setSearchExpanded(false); }}>
                    🧾 {i.invoiceNumber}
                  </div>
                ))}
                {!results.products?.length && !results.customers?.length && !results.invoices?.length && (
                  <div className="search-dropdown-item">No results</div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button type="button" className="menu-toggle" onClick={onMenuToggle} style={{ minHeight: '44px', minWidth: '44px' }}>
              ☰
            </button>
            
            <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.75rem' }}>
              {settings?.logo ? (
                <img 
                  src={resolveAssetUrl(settings.logo)} 
                  alt="Logo" 
                  style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'contain' }} 
                />
              ) : (
                <img 
                  src="/favicon.png" 
                  alt="Logo" 
                  style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'contain' }} 
                />
              )}
              <span className="company-name-text" style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', letterSpacing: '0.2px' }}>
                {settings?.companyName || 'AO Core'}
              </span>
            </div>

            <div className="search-box desktop-search-only">
              <input
                type="search"
                placeholder="Search everywhere..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {results && (
                <div className="search-dropdown">
                  {results.products?.map((p) => (
                    <div key={p._id || p.id} className="search-dropdown-item" onClick={() => handleSearchClick('product', p)}>
                      📦 {p.name} ({p.sku})
                    </div>
                  ))}
                  {results.customers?.map((c) => (
                    <div key={c._id || c.id} className="search-dropdown-item" onClick={() => handleSearchClick('customer', c)}>
                      👤 {c.name}
                    </div>
                  ))}
                  {results.invoices?.map((i) => (
                    <div key={i._id || i.id} className="search-dropdown-item" onClick={() => handleSearchClick('invoice', i)}>
                      🧾 {i.invoiceNumber}
                    </div>
                  ))}
                  {!results.products?.length && !results.customers?.length && !results.invoices?.length && (
                    <div className="search-dropdown-item">No results</div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="header-right">
            <button 
              type="button" 
              className="btn-icon mobile-search-trigger" 
              onClick={() => setSearchExpanded(true)}
              title="Search"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              🔍
            </button>
            <button type="button" className="btn-icon" onClick={toggleDarkMode} title="Toggle dark mode" style={{ minHeight: '44px', minWidth: '44px' }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <div className="notifications-panel">
              <button type="button" className="btn-icon" onClick={() => setShowNotif(!showNotif)} style={{ minHeight: '44px', minWidth: '44px' }}>
                🔔{unread > 0 ? ` (${unread})` : ''}
              </button>
              {showNotif && (
                <div className="notifications-dropdown" style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '0.5rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                  minWidth: '280px',
                  maxWidth: '320px',
                  maxHeight: '400px',
                  overflowY: 'auto',
                  zIndex: 1000,
                  padding: '0.5rem'
                }}>
                  {notifications.length === 0 ? (
                    <div className="notification-item" style={{ padding: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No notifications</div>
                  ) : (
                    notifications.slice(0, 10).map((n) => {
                      const notificationId = n._id || n.id;
                      const hasInvoiceLink = n.link && n.link.includes('/sales/');
                      const invoiceIdMatch = n.link ? n.link.match(/\/sales\/(\d+)/) : null;
                      const invoiceId = invoiceIdMatch ? invoiceIdMatch[1] : null;

                      return (
                        <div 
                          key={notificationId} 
                          className={`notification-item ${!n.isRead ? 'unread' : ''}`}
                          style={{
                            padding: '0.75rem',
                            borderBottom: '1px solid var(--border)',
                            fontSize: '0.85rem',
                            backgroundColor: !n.isRead ? 'var(--bg-active)' : 'transparent',
                            borderRadius: '6px',
                            marginBottom: '0.25rem'
                          }}
                        >
                          <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{n.title}</strong>
                          <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{n.message}</p>
                          {hasInvoiceLink && invoiceId && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                marginTop: '0.5rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.15rem 0.5rem',
                                fontSize: '0.75rem',
                                borderColor: '#ff9800',
                                color: '#ff9800',
                                fontWeight: 700
                              }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const { data } = await salesApi.getWhatsAppReminder(invoiceId);
                                  if (data.whatsappUrl) {
                                    window.open(data.whatsappUrl, '_blank');
                                  }
                                } catch (err) {
                                  console.error('Failed to open WhatsApp reminder:', err);
                                }
                              }}
                            >
                              💬 WhatsApp Reminder
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <div className="user-menu" style={{ position: 'relative' }}>
              <button 
                type="button" 
                className="btn btn-secondary btn-sm" 
                onClick={() => setShowUser(!showUser)}
                style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', minHeight: '44px' }}
              >
                👤 <span className="user-name-text">{user?.name}</span> ▾
              </button>
              {showUser && (
                <div className="user-dropdown" style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '0.5rem',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                  minWidth: '220px',
                  overflow: 'hidden',
                  zIndex: 1000,
                  padding: '0.75rem'
                }}>
                  <div style={{ padding: '0.5rem', borderBottom: '1px solid var(--border)', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{user?.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{user?.email}</div>
                    <div style={{
                      display: 'inline-block',
                      backgroundColor: 'rgba(255, 152, 0, 0.15)',
                      color: '#ff9800',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      padding: '0.15rem 0.4rem',
                      borderRadius: '4px',
                      marginTop: '0.4rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      {user?.role}
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => { logout(); navigate('/login'); }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      padding: '0.5rem',
                      color: '#ef4444',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      transition: 'background-color 0.15s ease',
                      minHeight: '36px'
                    }}
                    onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(239, 68, 68, 0.08)'}
                    onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                  >
                    🚪 Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
