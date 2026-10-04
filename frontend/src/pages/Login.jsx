import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { resolveAssetUrl } from '../utils/url';
import { useCompanyBrand } from '../context/CompanyBrandContext';
import ConnectionBanner from '../components/ConnectionBanner';
import './Login.css';

export default function Login() {
  const [portal, setPortal] = useState(null); // null | 'management_billing' | 'website_admin'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, user } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { logoUrl, companyName } = useCompanyBrand();

  if (user) {
    const targetPath = user.activeScope === 'website_admin' ? '/website' : '/';
    return <Navigate to={targetPath} replace />;
  }

  const handleSelectPortal = (selectedPortal) => {
    setPortal(selectedPortal);
    setEmail('');
    setPassword('');
    setSelectedRole('');
  };

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    if (!role) return;

    // Pre-fill credentials based on selected portal and role
    const credentials = {
      'Super Admin': { email: 'admin@aocore.com', pass: 'Admin@123' },
      'Developer': { email: 'developer@aocore.com', pass: 'Developer@123' },
      'Manufacturing': { email: 'mfg@aocore.com', pass: 'Mfg@123' },
      'Sales': { email: 'sales@aocore.com', pass: 'Sales@123' },
      'Inventory': { email: 'store@aocore.com', pass: 'Store@123' },
      'Accounts / Billing': { email: 'billing@aocore.com', pass: 'Billing@123' },
      'Dispatch': { email: 'dispatch@aocore.com', pass: 'Dispatch@123' },
      'Manager': { email: 'admin@aocore.com', pass: 'Admin@123' },
      'Website Admin': { email: 'admin@aocore.com', pass: 'Admin@123' },
      'Storefront Manager': { email: 'admin@aocore.com', pass: 'Admin@123' }
    };

    const creds = credentials[role];
    if (creds) {
      setEmail(creds.email);
      setPassword(creds.pass);
      toast(`${role} credentials loaded`, 'info');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const activePortal = portal || 'management_billing';
      const loggedInUser = await login(email, password, activePortal);
      toast(`Welcome to ${activePortal === 'website_admin' ? 'Website Admin' : 'Management & Billing'}!`, 'success');
      if (activePortal === 'website_admin') {
        navigate('/website');
      } else {
        navigate('/');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* 70% Left Side - Hero Section */}
      <div className="login-left-panel">
        <div className="spotlight-glow"></div>
        
        <div className="left-panel-content animate-fade-in">
          {/* Top Logo Badge (Glassmorphic) */}
          <div className="brand-glass-badge">
            <img
              src={logoUrl}
              alt="AO Core Logo"
              className="brand-logo-top"
            />
            <span className="brand-logo-text-top">{companyName ? companyName.toUpperCase() : 'AO CORE ERP'}</span>
          </div>

          {/* Hero Typography with Spotlight */}
          <div className="left-panel-hero">
            <h1 className="giant-brand-title">
              <span className="brand-white-title">{companyName ? companyName.toUpperCase() : 'AO CORE ERP'}</span>
            </h1>
            <h3 className="hero-subtitle-primary">{companyName ? companyName.toUpperCase() : 'AMUDHASURABIY ORGANICS'}</h3>
            <p className="hero-subtitle-detail">
              Control Production, Inventory, GST, Sales, Logistics, Website & Analytics from a unified platform.
            </p>
          </div>
          
          {/* 2x2 Dark Glass Feature Grid */}
          <div className="premium-feature-grid">
            <div className="glass-feature-card">
              <div className="feature-icon">⚡</div>
              <h4>Manufacturing ERP</h4>
              <p>Formula batches, raw materials & cost recovery</p>
            </div>
            
            <div className="glass-feature-card">
              <div className="feature-icon">📦</div>
              <h4>Inventory Control</h4>
              <p>Live warehouse stock & QR tracking</p>
            </div>
            
            <div className="glass-feature-card">
              <div className="feature-icon">🧾</div>
              <h4>GST & E-Invoicing</h4>
              <p>Automated B2B/B2C GST tax invoices</p>
            </div>
            
            <div className="glass-feature-card">
              <div className="feature-icon">🌐</div>
              <h4>Storefront Management</h4>
              <p>Unified catalog, orders & ecommerce</p>
            </div>
          </div>
        </div>

        {/* Floating Customer Trust Badge */}
        <div className="bottom-highlight-strip">
          <span className="highlight-item">★★★★★ Enterprise ERP & Storefront Platform • Amudhasurabiy Organics</span>
        </div>
      </div>
      
      {/* 30% Right Side - Login Card */}
      <div className="login-right-panel">
        <div className="login-card-container">
          <div className="login-glass-card">
            
            {/* STEP 1: PORTAL SELECTION */}
            {portal === null ? (
              <div className="portal-selection-container animate-fade-in">
                <div className="login-card-header" style={{ marginBottom: '1.5rem' }}>
                  {/* Mobile Header Branding */}
                  <div className="mobile-logo-header">
                    <img src={logoUrl} alt="Logo" className="mobile-logo" />
                    <h3>{companyName ? companyName.toUpperCase() : 'AO CORE ERP'}</h3>
                  </div>
                  
                  <h2 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                    Select Login Portal
                  </h2>
                  <p className="welcome-desc" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Choose your workspace entry point
                  </p>
                </div>

                <ConnectionBanner />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                  {/* PORTAL OPTION 1: MANAGEMENT & BILLING */}
                  <button
                    type="button"
                    onClick={() => handleSelectPortal('management_billing')}
                    style={{
                      background: 'linear-gradient(135deg, rgba(90, 45, 12, 0.08), rgba(245, 158, 11, 0.05))',
                      border: '1.5px solid rgba(90, 45, 12, 0.25)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.04)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = '#5a2d0c';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(90, 45, 12, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'rgba(90, 45, 12, 0.25)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.04)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '2.2rem' }}>🏢</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#5a2d0c' }}>
                          Management & Billing
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          ERP, Inventory, Sales, Billing, Manufacturing & Accounts
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '1.2rem', color: '#5a2d0c', fontWeight: 800 }}>→</span>
                  </button>

                  {/* PORTAL OPTION 2: WEBSITE ADMIN */}
                  <button
                    type="button"
                    onClick={() => handleSelectPortal('website_admin')}
                    style={{
                      background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(59, 130, 246, 0.05))',
                      border: '1.5px solid rgba(37, 99, 235, 0.25)',
                      borderRadius: '12px',
                      padding: '1.25rem',
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      boxShadow: '0 4px 8px rgba(0, 0, 0, 0.04)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.borderColor = '#2563eb';
                      e.currentTarget.style.boxShadow = '0 8px 16px rgba(37, 99, 235, 0.12)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = 'rgba(37, 99, 235, 0.25)';
                      e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.04)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '2.2rem' }}>🌐</span>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#2563eb' }}>
                          Website / Storefront Admin
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                          Storefront, Orders, Customers, Products, Reviews & Coupons
                        </div>
                      </div>
                    </div>
                    <span style={{ fontSize: '1.2rem', color: '#2563eb', fontWeight: 800 }}>→</span>
                  </button>
                </div>
              </div>
            ) : (
              /* STEP 2: CREDENTIALS FORM FOR SELECTED PORTAL */
              <div className="portal-form-container animate-fade-in">
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setPortal(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: 0,
                      marginBottom: '0.75rem'
                    }}
                  >
                    ← Back to portal selection
                  </button>

                  <div className="login-card-header">
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      background: portal === 'website_admin' ? 'rgba(37, 99, 235, 0.12)' : 'rgba(90, 45, 12, 0.12)',
                      color: portal === 'website_admin' ? '#2563eb' : '#5a2d0c',
                      padding: '0.35rem 0.75rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 800,
                      marginBottom: '0.5rem'
                    }}>
                      <span>{portal === 'website_admin' ? '🌐 Website Admin' : '🏢 Management & Billing'}</span>
                    </div>

                    <h2>Sign In</h2>
                    <p className="welcome-desc">
                      {portal === 'website_admin' 
                        ? 'Enter credentials for Storefront & eCommerce Admin'
                        : 'Enter credentials for ERP, Billing & Operations'}
                    </p>
                  </div>
                </div>

                <ConnectionBanner />

                <form onSubmit={handleSubmit} className="login-form">
                  {/* Role Selection Dropdown */}
                  <div className="form-group">
                    <label className="form-label">Role Selection</label>
                    <div className="input-with-icon">
                      <span className="input-icon-left">👤</span>
                      <select 
                        className="form-control select-role" 
                        value={selectedRole} 
                        onChange={(e) => handleRoleChange(e.target.value)}
                        required
                      >
                        <option value="">-- Choose Role --</option>
                        {portal === 'website_admin' ? (
                          <>
                            <option value="Super Admin">Super Admin</option>
                            <option value="Developer">Developer</option>
                            <option value="Website Admin">Website Admin</option>
                            <option value="Storefront Manager">Storefront Manager</option>
                          </>
                        ) : (
                          <>
                            <option value="Super Admin">Super Admin</option>
                            <option value="Developer">Developer</option>
                            <option value="Accounts / Billing">Billing Executive</option>
                            <option value="Sales">Sales Executive</option>
                            <option value="Inventory">Store Keeper / Inventory</option>
                            <option value="Manufacturing">Manufacturing Manager</option>
                            <option value="Dispatch">Dispatch Executive</option>
                            <option value="Manager">Operations Manager</option>
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                  
                  {/* Email Address */}
                  <div className="form-group">
                    <label className="form-label">Email Address</label>
                    <div className="input-with-icon">
                      <span className="input-icon-left">✉️</span>
                      <input 
                        className="form-control" 
                        type="email" 
                        placeholder="Enter email address"
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required 
                      />
                    </div>
                  </div>
                  
                  {/* Password */}
                  <div className="form-group">
                    <label className="form-label">Password</label>
                    <div className="input-with-icon">
                      <span className="input-icon-left">🔒</span>
                      <input 
                        className="form-control" 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Enter password"
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                      />
                      <button 
                        type="button" 
                        className="password-toggle-btn"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                  </div>
                  
                  <div className="form-actions-row">
                    <label className="checkbox-label">
                      <input 
                        type="checkbox" 
                        checked={rememberMe} 
                        onChange={(e) => setRememberMe(e.target.checked)} 
                      />
                      <span>Remember Me</span>
                    </label>
                    <a href="#forgot" className="forgot-password-link" onClick={(e) => { e.preventDefault(); toast('Please contact your IT administrator to reset your password.', 'info'); }}>
                      Forgot Password?
                    </a>
                  </div>
                  
                  {/* Submit Button */}
                  <button 
                    type="submit" 
                    className="btn-login-gradient" 
                    disabled={loading}
                    style={{
                      background: portal === 'website_admin' ? 'linear-gradient(135deg, #2563eb, #1d4ed8)' : undefined
                    }}
                  >
                    {loading ? (
                      <span className="login-spinner-container">
                        <span className="login-spinner"></span>
                        Authenticating...
                      </span>
                    ) : (
                      `Sign In to ${portal === 'website_admin' ? 'Website Admin' : 'Management & Billing'}`
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
          
          {/* Footer */}
          <footer className="login-footer">
            <p className="footer-copyright">{companyName || 'AO Core ERP'} • Version 1.0</p>
            <p className="footer-powered">Powered by Amudhasurabiy Technologies</p>
          </footer>
        </div>
      </div>
    </div>
  );
}

