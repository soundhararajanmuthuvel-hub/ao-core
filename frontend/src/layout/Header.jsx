import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { resolveAssetUrl, getActiveLogoUrl } from '../utils/url';
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
  const [activeFilter, setActiveFilter] = useState('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchNotifications = () => {
    notificationsApi.list({ status: activeFilter }).then(({ data }) => {
      setNotifications(data.notifications);
      setUnread(data.unreadCount);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchNotifications();
  }, [activeFilter]);

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

  const handleClearAll = async () => {
    setShowClearConfirm(false);
    setNotifications([]);
    setUnread(0);
    try {
      await notificationsApi.clearAll();
      fetchNotifications();
    } catch (err) {
      fetchNotifications();
    }
  };

  const renderNotificationsDropdownContent = () => {
    const handleToggleRead = async (e, id, currentIsRead) => {
      e.stopPropagation();
      const newIsRead = !currentIsRead;
      // Optimistic update
      setNotifications(prev => prev.map(n => (n.id === id || n._id === id) ? { ...n, isRead: newIsRead } : n));
      setUnread(prev => newIsRead ? Math.max(0, prev - 1) : prev + 1);
      
      try {
        await notificationsApi.markRead(id, newIsRead);
        fetchNotifications();
      } catch (err) {
        fetchNotifications();
      }
    };

    const handleDelete = async (e, id, isRead) => {
      e.stopPropagation();
      // Optimistic update
      setNotifications(prev => prev.filter(n => n.id !== id && n._id !== id));
      if (!isRead) {
        setUnread(prev => Math.max(0, prev - 1));
      }
      try {
        await notificationsApi.remove(id);
        fetchNotifications();
      } catch (err) {
        fetchNotifications();
      }
    };

    const handleMarkAllRead = async (e) => {
      e.stopPropagation();
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnread(0);
      try {
        await notificationsApi.markAllRead();
        fetchNotifications();
      } catch (err) {
        fetchNotifications();
      }
    };

    const handleClearAllClick = (e) => {
      e.stopPropagation();
      setShowClearConfirm(true);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 'inherit' }}>
        {/* Header Actions Row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '0.5rem',
          borderBottom: '1px solid var(--border)',
          marginBottom: '0.5rem',
          gap: '0.5rem'
        }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Notifications</span>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleMarkAllRead}
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', fontWeight: 600 }}
            >
              Mark All Read
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm"
              onClick={handleClearAllClick}
              style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', fontWeight: 600 }}
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{
          display: 'flex',
          gap: '0.25rem',
          marginBottom: '0.5rem',
          backgroundColor: 'var(--bg-page)',
          padding: '0.2rem',
          borderRadius: '6px'
        }}>
          {['all', 'unread', 'read'].map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilter(filter);
              }}
              style={{
                flex: 1,
                border: 'none',
                background: activeFilter === filter ? 'var(--bg-card)' : 'transparent',
                color: activeFilter === filter ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize: '0.75rem',
                fontWeight: activeFilter === filter ? 700 : 500,
                padding: '0.3rem',
                borderRadius: '4px',
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: activeFilter === filter ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>

        {/* List or Empty State */}
        <div style={{ overflowY: 'auto', flex: 1, maxHeight: '300px' }}>
          {notifications.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem 1rem',
              textAlign: 'center',
              color: 'var(--text-secondary)'
            }}>
              <span style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔔</span>
              <strong style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                No Notifications Available
              </strong>
              <span style={{ fontSize: '0.75rem' }}>You are all caught up.</span>
            </div>
          ) : (
            notifications.map((n) => {
              const notificationId = n._id || n.id;
              const hasInvoiceLink = n.link && n.link.includes('/sales/');
              const invoiceIdMatch = n.link ? n.link.match(/\/sales\/(\d+)/) : null;
              const invoiceId = invoiceIdMatch ? invoiceIdMatch[1] : null;

              return (
                <div
                  key={notificationId}
                  className={`notification-item ${!n.isRead ? 'unread' : ''}`}
                  onClick={(e) => handleToggleRead(e, notificationId, n.isRead)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '0.75rem',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.85rem',
                    backgroundColor: !n.isRead ? 'var(--bg-active)' : 'transparent',
                    borderRadius: '6px',
                    marginBottom: '0.25rem',
                    cursor: 'pointer',
                    position: 'relative',
                    transition: 'background-color 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1, minWidth: 0 }}>
                      {/* Unread indicator dot */}
                      {!n.isRead && (
                        <span style={{
                          display: 'inline-block',
                          width: '6px',
                          height: '6px',
                          backgroundColor: 'var(--color-primary, #5a2d0c)',
                          borderRadius: '50%',
                          flexShrink: 0
                        }} />
                      )}
                      <strong style={{
                        color: 'var(--text-primary)',
                        fontSize: '0.8rem',
                        fontWeight: !n.isRead ? 700 : 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {n.title}
                      </strong>
                    </div>
                    {/* Toggle and Delete Buttons */}
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={(e) => handleToggleRead(e, notificationId, n.isRead)}
                        title={n.isRead ? "Mark as unread" : "Mark as read"}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {n.isRead ? '📖' : '✉️'}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, notificationId, n.isRead)}
                        title="Delete notification"
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          color: '#ef4444',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center',
                          fontWeight: 700
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p style={{
                    margin: '0.25rem 0 0 0',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    whiteSpace: 'pre-wrap',
                    paddingLeft: !n.isRead ? '0.65rem' : '0'
                  }}>
                    {n.message}
                  </p>
                  {hasInvoiceLink && invoiceId && (
                    <div style={{ paddingLeft: !n.isRead ? '0.65rem' : '0', marginTop: '0.5rem' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          padding: '0.15rem 0.5rem',
                          fontSize: '0.7rem',
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
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  if (isMobile) {
    return (
      <header className="app-header mobile-header-layout" style={{ position: 'sticky', top: 0, zIndex: 999, display: 'flex', flexDirection: 'column', padding: '0.5rem 1rem', height: 'auto', gap: '0.5rem' }}>
        {/* Row 1 */}
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button type="button" className="menu-toggle" onClick={onMenuToggle} style={{ display: 'block', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-primary)', minHeight: '44px', minWidth: '44px' }}>
              ☰
            </button>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary)' }}>AO Core ERP</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="notifications-panel" style={{ position: 'relative' }}>
              <button type="button" className="btn-icon" onClick={() => setShowNotif(!showNotif)} style={{ minHeight: '44px', minWidth: '44px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🔔{unread > 0 && <span className="badge badge-danger" style={{ marginLeft: '4px', padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}>{unread}</span>}
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
                  width: '300px',
                  maxHeight: '400px',
                  zIndex: 1000,
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {renderNotificationsDropdownContent()}
                </div>
              )}
            </div>
            
            <button 
              type="button" 
              className="btn-icon" 
              onClick={() => navigate('/ai-assistant')} 
              title="AI Assistant Chat" 
              style={{ minHeight: '44px', minWidth: '44px', background: 'none', border: 'none', fontSize: '1.25rem' }}
            >
              🧠
            </button>
            <button type="button" className="btn-icon" onClick={toggleDarkMode} style={{ minHeight: '44px', minWidth: '44px', background: 'none', border: 'none', fontSize: '1.25rem' }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
          </div>
        </div>

        {/* Row 2: Search */}
        <div style={{ width: '100%', position: 'relative' }}>
          <div className="search-box" style={{ width: '100%', maxWidth: '100%' }}>
            <input
              type="search"
              placeholder="🔍 Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', minHeight: '40px', paddingLeft: '2.2rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-page)', color: 'var(--text-primary)' }}
            />
            {results && (
              <div className="search-dropdown" style={{ left: 0, right: 0, width: '100%' }}>
                {results.products?.map((p) => (
                  <div key={p._id || p.id} className="search-dropdown-item" onClick={() => handleSearchClick('product', p)}>
                    📦 {p.name}
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
              </div>
            )}
          </div>
        </div>
        {showClearConfirm && (
          <div className="modal-overlay" style={{ zIndex: 1100 }}>
            <div className="modal" style={{ maxWidth: '400px', margin: 'auto' }}>
              <div className="modal-header">
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Clear Notifications</h3>
                <button 
                  type="button" 
                  className="btn-icon" 
                  onClick={() => setShowClearConfirm(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                >
                  ✕
                </button>
              </div>
              <div className="modal-body" style={{ padding: '1.5rem 1.25rem' }}>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Are you sure you want to clear all notifications?
                </p>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-danger" 
                  onClick={handleClearAll}
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    );
  }

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
              <img 
                src={getActiveLogoUrl(settings)} 
                alt="Logo" 
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = '/favicon.png';
                }}
                style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'contain' }} 
              />
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
            <button 
              type="button" 
              className="btn-icon" 
              onClick={() => navigate('/ai-assistant')} 
              title="AI Assistant Chat" 
              style={{ minHeight: '44px', minWidth: '44px', fontSize: '1.2rem' }}
            >
              🧠
            </button>
            <button type="button" className="btn-icon" onClick={toggleDarkMode} title="Toggle dark mode" style={{ minHeight: '44px', minWidth: '44px' }}>
              {darkMode ? '☀️' : '🌙'}
            </button>
            <div className="notifications-panel" style={{ position: 'relative' }}>
              <button type="button" className="btn-icon" onClick={() => setShowNotif(!showNotif)} style={{ minHeight: '44px', minWidth: '44px', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🔔{unread > 0 && <span className="badge badge-danger" style={{ marginLeft: '4px', padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}>{unread}</span>}
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
                  width: '320px',
                  maxHeight: '400px',
                  zIndex: 1000,
                  padding: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  {renderNotificationsDropdownContent()}
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
      {showClearConfirm && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: '400px', margin: 'auto' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Clear Notifications</h3>
              <button 
                type="button" 
                className="btn-icon" 
                onClick={() => setShowClearConfirm(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem 1.25rem' }}>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Are you sure you want to clear all notifications?
              </p>
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setShowClearConfirm(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleClearAll}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
