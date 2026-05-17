import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { searchApi, notificationsApi } from '../api';

export default function Header({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
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
    else if (type === 'invoice') navigate(`/sales/${item._id}`);
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <button type="button" className="menu-toggle" onClick={onMenuToggle}>
          ☰
        </button>
        <div className="search-box">
          <input
            type="search"
            placeholder="Search everywhere..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {results && (
            <div className="search-dropdown">
              {results.products?.map((p) => (
                <div key={p._id} className="search-dropdown-item" onClick={() => handleSearchClick('product', p)}>
                  📦 {p.name} ({p.sku})
                </div>
              ))}
              {results.customers?.map((c) => (
                <div key={c._id} className="search-dropdown-item" onClick={() => handleSearchClick('customer', c)}>
                  👤 {c.name}
                </div>
              ))}
              {results.invoices?.map((i) => (
                <div key={i._id} className="search-dropdown-item" onClick={() => handleSearchClick('invoice', i)}>
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
        <button type="button" className="btn-icon" onClick={toggleDarkMode} title="Toggle dark mode">
          {darkMode ? '☀️' : '🌙'}
        </button>
        <div className="notifications-panel">
          <button type="button" className="btn-icon" onClick={() => setShowNotif(!showNotif)}>
            🔔{unread > 0 ? ` (${unread})` : ''}
          </button>
          {showNotif && (
            <div className="notifications-dropdown">
              {notifications.length === 0 ? (
                <div className="notification-item">No notifications</div>
              ) : (
                notifications.slice(0, 10).map((n) => (
                  <div key={n._id} className={`notification-item ${!n.isRead ? 'unread' : ''}`}>
                    <strong>{n.title}</strong>
                    <p>{n.message}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="user-menu">
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowUser(!showUser)}>
            {user?.name} ▾
          </button>
          {showUser && (
            <div className="user-dropdown">
              <div style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {user?.email} · {user?.role}
              </div>
              <button type="button" onClick={() => { logout(); navigate('/login'); }}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
