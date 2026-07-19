import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';
import { resolveAssetUrl } from '../utils/url';
import { useCompanyBrand } from '../context/CompanyBrandContext';
import './Login.css';

export default function Login() {
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
  const { logoUrl } = useCompanyBrand();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleRoleChange = (role) => {
    setSelectedRole(role);
    if (!role) return;

    // Default seeded roles prefill credentials
    const credentials = {
      'Super Admin': { email: 'admin@aocore.com', pass: 'Admin@123' },
      'Developer': { email: 'developer@aocore.com', pass: 'Developer@123' },
      'Manufacturing': { email: 'mfg@aocore.com', pass: 'Mfg@123' },
      'Sales': { email: 'sales@aocore.com', pass: 'Sales@123' },
      'Inventory': { email: 'store@aocore.com', pass: 'Store@123' },
      'Accounts': { email: 'billing@aocore.com', pass: 'Billing@123' },
      'Dispatch': { email: 'dispatch@aocore.com', pass: 'Dispatch@123' },
      'Manager': { email: 'admin@aocore.com', pass: 'Admin@123' },
      'Supplier Portal': { email: 'store@aocore.com', pass: 'Store@123' }
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
      await login(email, password);
      toast('Welcome back!', 'success');
      navigate('/');
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
            <span className="brand-logo-text-top">AO AURUM</span>
          </div>

          {/* Hero Typography with Spotlight */}
          <div className="left-panel-hero">
            <h1 className="giant-brand-title">
              <span className="brand-ao-gradient">AO</span> <span className="brand-white-title">AURUM</span>
            </h1>
            <h3 className="hero-subtitle-primary">Quiet Luxury Enterprise Suite</h3>
            <p className="hero-subtitle-detail">
              Control Production, Inventory, GST, Sales, Logistics & Analytics from a single platform.
            </p>
          </div>
          
          {/* 2x2 Dark Glass Feature Grid */}
          <div className="premium-feature-grid">
            <div className="glass-feature-card">
              <span className="feature-icon">🏭</span>
              <h4>Manufacturing</h4>
              <p>Formulas, batches, repacking & costing</p>
            </div>
            <div className="glass-feature-card">
              <span className="feature-icon">📦</span>
              <h4>Inventory</h4>
              <p>Multi-unit pack sizes, stock counts & tracking</p>
            </div>
            <div className="glass-feature-card">
              <span className="feature-icon">🧾</span>
              <h4>GST & Accounts</h4>
              <p>Invoicing, payments & outstanding reports</p>
            </div>
            <div className="glass-feature-card">
              <span className="feature-icon">🚚</span>
              <h4>Shipping</h4>
              <p>Courier routing, QR delivery & live timelines</p>
            </div>
          </div>

          {/* Bottom Highlight Strip */}
          <div className="bottom-highlight-strip">
            <div className="highlight-item">✔ Manufacturing</div>
            <div className="highlight-item">✔ Repacking</div>
            <div className="highlight-item">✔ Inventory Tracking</div>
            <div className="highlight-item">✔ GST Billing</div>
            <div className="highlight-item">✔ Supplier Management</div>
            <div className="highlight-item">✔ Delivery Tracking</div>
          </div>
        </div>
      </div>
      
      {/* 30% Right Side - Login Card */}
      <div className="login-right-panel">
        <div className="login-card-container">
          <div className="login-glass-card animate-slide-up">
            <div className="login-card-header">
              {/* Mobile Header Branding */}
              <div className="mobile-logo-header">
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="mobile-logo"
                  />
                <h3>AO AURUM</h3>
              </div>
              
              <h2>Welcome Back</h2>
              <p className="welcome-desc">Sign in to your enterprise account</p>
            </div>
            
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
                    <option value="Super Admin">Super Admin</option>
                    <option value="Developer">Developer</option>
                    <option value="Manufacturing">Manufacturing</option>
                    <option value="Sales">Sales</option>
                    <option value="Inventory">Inventory</option>
                    <option value="Accounts">Accounts</option>
                    <option value="Dispatch">Dispatch</option>
                    <option value="Manager">Manager</option>
                    <option value="Supplier Portal">Supplier Portal</option>
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
              >
                {loading ? (
                  <span className="login-spinner-container">
                    <span className="login-spinner"></span>
                    Authenticating...
                  </span>
                ) : (
                  "Login to AO Aurum"
                )}
              </button>
            </form>
          </div>
          
          {/* Footer */}
          <footer className="login-footer">
            <p className="footer-copyright">AO Aurum • Version 1.0</p>
            <p className="footer-powered">Powered by Amudhasurabiy Technologies</p>
          </footer>
        </div>
      </div>
    </div>
  );
}
