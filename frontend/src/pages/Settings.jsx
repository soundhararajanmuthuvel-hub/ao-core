import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { settingsApi, usersApi, integrationsApi, migrationApi, customersApi, salesApi } from '../api';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import { useSearchParams } from 'react-router-dom';

const emptyUser = { name: '', email: '', password: '', role: 'Super Admin', isActive: true };

const roleOptions = [
  'Super Admin',
  'Manufacturing Manager',
  'Billing Executive',
  'Store Keeper',
  'Dispatch Executive',
  'Sales Executive',
  'admin',
  'staff'
];

export default function SettingsPage() {
  const { settings, updateSettings, loadSettings } = useSettings();
  const { darkMode, setDarkMode } = useTheme();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'profile');

  useEffect(() => {
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const [form, setForm] = useState({});
  const [logo, setLogo] = useState(null);
  const [wpUploading, setWpUploading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingType, setSyncingType] = useState('');

  // WooCommerce Integration stats & diagnostics states
  const [stats, setStats] = useState(null);
  const [diagnostics, setDiagnostics] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [connectingWebsite, setConnectingWebsite] = useState(false);

  // Sync Logs states
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPages, setLogsPages] = useState(1);
  const [logsModule, setLogsModule] = useState('All');
  const [logsAction, setLogsAction] = useState('All');

  // User management state
  const [users, setUsers] = useState([]);
  const [userLoading, setUserLoading] = useState(false);
  const [userPage, setUserPage] = useState(1);
  const [userPages, setUserPages] = useState(1);
  const [userModal, setUserModal] = useState(null);
  const [userForm, setUserForm] = useState(emptyUser);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await integrationsApi.getStats();
      if (data.success) {
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load integration stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadSyncLogs = async () => {
    setLogsLoading(true);
    try {
      const params = {
        page: logsPage,
        limit: 10
      };
      if (logsModule !== 'All') params.module = logsModule;
      if (logsAction !== 'All') params.action = logsAction;

      const { data } = await integrationsApi.getSyncLogs(params);
      if (data.success) {
        setLogs(data.logs || []);
        setLogsPages(data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to load sync logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'integrations') {
      loadStats();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'integrations') {
      loadSyncLogs();
    }
  }, [activeTab, logsPage, logsModule, logsAction]);

  const loadUsers = () => {
    setUserLoading(true);
    usersApi.list({ page: userPage, limit: 10 }).then(({ data }) => {
      setUsers(data.users);
      setUserPages(data.pages);
    }).finally(() => setUserLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'users') {
      loadUsers();
    }
  }, [activeTab, userPage]);

  const saveSettings = async () => {
    try {
      await updateSettings(form);
      toast('Settings saved successfully', 'success');
      loadSettings();
    } catch {
      toast('Save failed', 'error');
    }
  };

  const uploadLogo = async () => {
    if (!logo) return;
    const fd = new FormData();
    fd.append('logo', logo);
    try {
      await settingsApi.uploadLogo(fd);
      await loadSettings();
      toast('Logo uploaded successfully', 'success');
    } catch (err) {
      toast(err.response?.data?.message || 'Upload failed', 'error');
    }
  };

  const uploadLogoToWP = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('logo', file);
    setWpUploading(true);
    try {
      const { data } = await settingsApi.uploadWpLogo(fd);
      if (data && data.url) {
        setForm(prev => ({ ...prev, logo: data.url }));
        toast('Logo uploaded to WordPress successfully', 'success');
      } else {
        toast('Upload failed: No URL returned from server', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'WordPress upload failed', 'error');
    } finally {
      setWpUploading(false);
    }
  };

  // User Management Save
  const saveUser = async () => {
    try {
      if (userModal === 'edit') {
        await usersApi.update(userForm._id || userForm.id, userForm);
      } else {
        await usersApi.create(userForm);
      }
      toast('User profile saved successfully', 'success');
      setUserModal(null);
      loadUsers();
    } catch (err) {
      toast(err.response?.data?.message || 'Save failed', 'error');
    }
  };

  // User Delete
  const removeUser = async (id) => {
    if (!confirm('Are you sure you want to deactivate/delete this user?')) return;
    try {
      await usersApi.remove(id);
      toast('User removed', 'success');
      loadUsers();
    } catch {
      toast('Delete failed', 'error');
    }
  };

  // WooCommerce Integration Handlers
  const handleTestConnection = async () => {
    if (!form.wooUrl || !form.wooConsumerKey || !form.wooConsumerSecret) {
      toast('Website URL, Consumer Key, and Consumer Secret are required', 'error');
      return;
    }
    setTestingConnection(true);
    setDiagnostics(null);
    try {
      // First save the settings form so credentials on server are up to date
      await updateSettings(form);
      const { data } = await integrationsApi.testConnection();
      if (data.success) {
        toast('✓ Connected Successfully', 'success');
        if (data.diagnostics) {
          setDiagnostics(data.diagnostics);
        }
      } else {
        toast(data.message || 'Connection failed', 'error');
        if (data.diagnostics) {
          setDiagnostics(data.diagnostics);
        }
      }
      loadSettings();
      loadStats();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Connection test failed';
      toast(errMsg, 'error');
      if (err.response?.data?.diagnostics) {
        setDiagnostics(err.response.data.diagnostics);
      }
    } finally {
      setTestingConnection(false);
    }
  };

  const handleConnectWebsite = async () => {
    if (!form.wooUrl || !form.wooConsumerKey || !form.wooConsumerSecret) {
      toast('Website URL, Consumer Key, and Consumer Secret are required', 'error');
      return;
    }
    setConnectingWebsite(true);
    setDiagnostics(null);
    try {
      const { data } = await integrationsApi.connect(form);
      if (data.success) {
        toast('✓ Connected Successfully & Profile Synced', 'success');
        setForm(data.settings);
        loadSettings();
        loadStats();
        loadSyncLogs();
      } else {
        toast(data.message || 'Connection failed', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Connection failed', 'error');
    } finally {
      setConnectingWebsite(false);
    }
  };

  const handleDisconnectWebsite = async () => {
    if (!confirm('Are you sure you want to disconnect this WooCommerce integration? All credentials and connection states will be cleared.')) return;
    try {
      const { data } = await integrationsApi.disconnect();
      if (data.success) {
        toast('✓ Website Disconnected successfully', 'success');
        setForm(data.settings);
        loadSettings();
        loadStats();
        loadSyncLogs();
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to disconnect website', 'error');
    }
  };

  const handleSync = async (type) => {
    setSyncingType(type);
    try {
      let res;
      if (type === 'products') {
        res = await integrationsApi.syncProducts();
      } else if (type === 'products-import') {
        res = await integrationsApi.importProducts();
      } else if (type === 'customers') {
        res = await integrationsApi.syncCustomers();
      } else if (type === 'orders') {
        res = await integrationsApi.syncOrders();
      } else if (type === 'inventory') {
        res = await integrationsApi.syncInventory();
      } else if (type === 'all') {
        res = await integrationsApi.syncAll();
      }
      toast(res.data.message || 'Sync successful', 'success');
      loadStats();
      loadSyncLogs();
    } catch (err) {
      toast(`${type.charAt(0).toUpperCase() + type.slice(1)} sync failed`, 'error');
    } finally {
      setSyncingType('');
    }
  };

  if (!settings) return null;

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            ⚙️ Control Settings
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Manage System Properties, WooCommerce Integrations, Shipping Charges, and GST Billing Rules.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', gap: '0.5rem', overflowX: 'auto' }}>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => handleTabChange('profile')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'profile' ? '3px solid #ff9800' : '3px solid transparent',
            color: activeTab === 'profile' ? '#ff9800' : '#64748b',
          }}
        >
          🏢 Company Profile
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'billing' ? 'active' : ''}`}
          onClick={() => handleTabChange('billing')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'billing' ? '3px solid #ff9800' : '3px solid transparent',
            color: activeTab === 'billing' ? '#ff9800' : '#64748b',
          }}
        >
          🧾 Billing & GST Mode
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'shipping' ? 'active' : ''}`}
          onClick={() => handleTabChange('shipping')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'shipping' ? '3px solid #ff9800' : '3px solid transparent',
            color: activeTab === 'shipping' ? '#ff9800' : '#64748b',
          }}
        >
          🚚 Shipping Settings
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'integrations' ? 'active' : ''}`}
          onClick={() => handleTabChange('integrations')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'integrations' ? '3px solid #ff9800' : '3px solid transparent',
            color: activeTab === 'integrations' ? '#ff9800' : '#64748b',
          }}
        >
          🔌 Integrations (Woo)
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => handleTabChange('users')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'users' ? '3px solid #ff9800' : '3px solid transparent',
            color: activeTab === 'users' ? '#ff9800' : '#64748b',
          }}
        >
          🔐 User Management
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'migration' ? 'active' : ''}`}
          onClick={() => handleTabChange('migration')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'migration' ? '3px solid #ff9800' : '3px solid transparent',
            color: activeTab === 'migration' ? '#ff9800' : '#64748b',
          }}
        >
          💾 Data Migration
        </button>
      </div>

      <div className="tab-content" style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
        {/* Company Profile Tab */}
        {activeTab === 'profile' && (
          <div className="card" style={{ maxWidth: 600, padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Company & Brand Profile</h3>
            
            <div className="form-group">
              <label>Company Name</label>
              <input className="form-control" value={form.companyName || ''} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </div>
            
            <div className="form-group">
              <label>Billing / Warehouse Address</label>
              <input className="form-control" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Phone Number</label>
              <input className="form-control" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Company Email Address</label>
              <input type="email" className="form-control" placeholder="e.g. accounts@company.com" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Company GST Number (reminders branding)</label>
              <input className="form-control" placeholder="e.g. 33AAAAA0000A1Z1" value={form.gstNumber || ''} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Brand Theme Color</label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input type="color" style={{ width: '40px', height: '40px', border: 'none', borderRadius: '6px', cursor: 'pointer' }} value={form.brandColor || '#ff9800'} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} />
                <span style={{ fontSize: '0.9rem', color: '#4b5563', fontFamily: 'monospace' }}>{form.brandColor || '#ff9800'}</span>
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <input type="checkbox" checked={form.defaultDarkMode || false} onChange={(e) => setForm({ ...form, defaultDarkMode: e.target.checked })} />
                <span>Default Dark Mode</span>
              </label>
            </div>

            <div className="form-group" style={{ marginTop: '1.25rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                <input type="checkbox" checked={form.roleBasedLogin || false} onChange={(e) => setForm({ ...form, roleBasedLogin: e.target.checked })} />
                <span>Enable Role-Based Fast Login Selector</span>
              </label>
            </div>

            <div className="form-group">
              <label>Dark Mode (current session)</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDarkMode(!darkMode)}>Toggle ({darkMode ? 'On' : 'Off'})</button>
            </div>

            <div className="form-group" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>
                💳 UPI Payment Details
              </h4>
              <div className="form-group">
                <label>UPI ID for Pay QR</label>
                <input className="form-control" placeholder="e.g. 7010602115@iob" value={form.upiId || ''} onChange={(e) => setForm({ ...form, upiId: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Payee Name for UPI</label>
                <input className="form-control" placeholder="e.g. AMUDHASURABIY ORGANICS" value={form.payeeName || ''} onChange={(e) => setForm({ ...form, payeeName: e.target.value })} />
              </div>
            </div>

            <div className="form-group" style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <label>Upload Company Brand Logo</label>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
                <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files[0])} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={uploadLogo}>Upload</button>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-primary" onClick={saveSettings}>Save Company Profile</button>
            </div>
          </div>
        )}

        {/* Billing & GST Rules Tab */}
        {activeTab === 'billing' && (
          <div className="card" style={{ maxWidth: 600, padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Billing & GST Rules</h3>
            
            <div className="form-group">
              <label>Company GSTIN / Tax ID</label>
              <input className="form-control" placeholder="e.g. 29AAAAA1111A1Z1" value={form.gstDetails || ''} onChange={(e) => setForm({ ...form, gstDetails: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Default GST Billing Mode</label>
              <select className="form-control" value={form.defaultGstMode || 'exclusive'} onChange={(e) => setForm({ ...form, defaultGstMode: e.target.value })}>
                <option value="exclusive">GST Exclusive (Add tax on top of prices)</option>
                <option value="inclusive">GST Inclusive (Extract tax from prices)</option>
                <option value="no_gst">No GST (Billed with zero tax)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Invoice Theme Colour/Layout</label>
              <select className="form-control" value={form.invoiceTheme || 'default'} onChange={(e) => setForm({ ...form, invoiceTheme: e.target.value })}>
                <option value="default">Default Blue Accent</option>
                <option value="premium">Premium Glass/SaaS Design</option>
                <option value="modern">Modern Orange Accent</option>
              </select>
            </div>

            <div className="form-group">
              <label>Invoice Format Size</label>
              <select className="form-control" value={form.invoiceFormat || 'Standard'} onChange={(e) => setForm({ ...form, invoiceFormat: e.target.value })}>
                <option value="Standard">Standard A4/A5 Size</option>
                <option value="Compact">Compact Letterhead</option>
                <option value="Thermal">Thermal 80mm Roll</option>
              </select>
            </div>

            <div className="form-group">
              <label>Invoice Counter Prefix</label>
              <input className="form-control" value={form.invoicePrefix || ''} onChange={(e) => setForm({ ...form, invoicePrefix: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Current Financial Year</label>
              <input className="form-control" value={form.financialYear || ''} onChange={(e) => setForm({ ...form, financialYear: e.target.value })} />
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '1rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🚚 Logistics Settings</h4>
              <div className="form-group">
                <label>Default Logistics Charge (₹)</label>
                <input type="number" className="form-control" value={form.logisticsCharge || 0} onChange={(e) => setForm({ ...form, logisticsCharge: Number(e.target.value) })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>Box Weight (kg)</label>
                  <input type="number" step="0.001" className="form-control" value={form.boxWeight || 0} onChange={(e) => setForm({ ...form, boxWeight: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Packing Material Weight (kg)</label>
                  <input type="number" step="0.001" className="form-control" value={form.packingMaterialWeight || 0} onChange={(e) => setForm({ ...form, packingMaterialWeight: Number(e.target.value) })} />
                </div>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-primary" onClick={saveSettings}>Save Billing Rules</button>
            </div>
          </div>
        )}        {/* Shipping Settings Tab */}
        {activeTab === 'shipping' && (
          <div className="card" style={{ maxWidth: 600, padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Shipping Charge Configurations</h3>
            
            <div className="form-group">
              <label>Shipping Charge Method</label>
              <select className="form-control" value={form.shippingMode || 'free'} onChange={(e) => setForm({ ...form, shippingMode: e.target.value })}>
                <option value="included">Shipping Included In Product Price</option>
                <option value="fixed">Flat Shipping Charge</option>
                <option value="weight">Weight Based Shipping</option>
                <option value="zone">Zone Based Shipping</option>
                <option value="value">Free Shipping Above Amount</option>
                <option value="free">Option 1: Free Shipping (Always ₹0)</option>
                <option value="customer_type">Option 5: Customer Type-Based Rates</option>
              </select>
            </div>

            {form.shippingMode === 'fixed' && (
              <div className="form-group">
                <label>Fixed Shipping Fee (₹)</label>
                <input type="number" className="form-control" value={form.shippingFixedCharge || 0} onChange={(e) => setForm({ ...form, shippingFixedCharge: Number(e.target.value) })} />
              </div>
            )}

            {form.shippingMode === 'weight' && (
              <div className="form-group">
                <label>Weight-Based Rules (JSON Array in grams)</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={form.shippingWeightRules || '[]'}
                  onChange={(e) => setForm({ ...form, shippingWeightRules: e.target.value })}
                  placeholder='e.g., [{"min":0,"max":500,"charge":50},{"min":500,"max":1000,"charge":80},{"min":1000,"max":5000,"charge":120}]'
                />
                <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Provide rules in grams. Example format: <code>{"[{\"min\":0,\"max\":500,\"charge\":50}]"}</code>
                </small>
              </div>
            )}

            {form.shippingMode === 'zone' && (
              <div className="form-group">
                <label>Zone-Based Slabs (JSON Map in ₹ per Kg)</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={form.shippingZoneRates || '{"tamil_nadu":50,"south_india":80,"rest_of_india":120}'}
                  onChange={(e) => setForm({ ...form, shippingZoneRates: e.target.value })}
                  placeholder='e.g., {"tamil_nadu":50,"south_india":80,"rest_of_india":120}'
                />
                <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Format: <code>{"{\"tamil_nadu\": 50, \"south_india\": 80, \"rest_of_india\": 120}"}</code>
                </small>
              </div>
            )}

            {form.shippingMode === 'value' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Order Value Threshold (₹)</label>
                  <input type="number" className="form-control" value={form.shippingValueThreshold || 999} onChange={(e) => setForm({ ...form, shippingValueThreshold: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Shipping Fee ABOVE Threshold (₹)</label>
                  <input type="number" className="form-control" value={form.shippingValueAboveCharge || 0} onChange={(e) => setForm({ ...form, shippingValueAboveCharge: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Shipping Fee BELOW Threshold (₹)</label>
                  <input type="number" className="form-control" value={form.shippingValueBelowCharge || 80} onChange={(e) => setForm({ ...form, shippingValueBelowCharge: Number(e.target.value) })} />
                </div>
              </div>
            )}

            {form.shippingMode === 'customer_type' && (
              <div className="form-group">
                <label>Customer Type Rules (JSON Map)</label>
                <textarea
                  className="form-control"
                  rows="4"
                  value={form.shippingCustomerTypeRates || '{}'}
                  onChange={(e) => setForm({ ...form, shippingCustomerTypeRates: e.target.value })}
                  placeholder='e.g., {"White Label":150,"Retail Shop":100,"D2C Customer":50}'
                />
                <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                  Format: <code>{"{\"White Label\": 120, \"Retail Shop\": 80}"}</code>
                </small>
              </div>
            )}

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '1.5rem' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>
                📦 ERP Internal Shipping Costs
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label>Packing Cost (₹)</label>
                  <input type="number" className="form-control" value={form.packingCost || 0} onChange={(e) => setForm({ ...form, packingCost: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Handling Cost (₹)</label>
                  <input type="number" className="form-control" value={form.handlingCost || 0} onChange={(e) => setForm({ ...form, handlingCost: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Courier Cost (₹)</label>
                  <input type="number" className="form-control" value={form.courierCost || 0} onChange={(e) => setForm({ ...form, courierCost: Number(e.target.value) })} />
                </div>
                <div className="form-group">
                  <label>Loading Cost (₹)</label>
                  <input type="number" className="form-control" value={form.loadingCost || 0} onChange={(e) => setForm({ ...form, loadingCost: Number(e.target.value) })} />
                </div>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  id="mergeShippingCharges"
                  checked={form.mergeShippingCharges || false}
                  onChange={(e) => setForm({ ...form, mergeShippingCharges: e.target.checked })}
                />
                <label htmlFor="mergeShippingCharges" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4b5563', margin: 0, cursor: 'pointer' }}>
                  Merge All Charges Into Single Shipping Charge
                </label>
              </div>
            </div>

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
              <button type="button" className="btn btn-primary" onClick={saveSettings}>Save Shipping Rules</button>
            </div>
          </div>
        )}

        {/* WooCommerce Integrations Tab */}
        {activeTab === 'integrations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
              {/* Left Column: Form Settings */}
              <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>WordPress / WooCommerce Settings</h3>
                <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                  Configure integration parameters. Only URL, Consumer Key, and Consumer Secret are required.
                </p>

                <div className="form-group">
                  <label>Website URL <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-control" placeholder="https://example.com" value={form.wooUrl || ''} onChange={(e) => setForm({ ...form, wooUrl: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Consumer Key <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-control" placeholder="ck_..." value={form.wooConsumerKey || ''} onChange={(e) => setForm({ ...form, wooConsumerKey: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Consumer Secret <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="form-control" type="password" placeholder="cs_..." value={form.wooConsumerSecret || ''} onChange={(e) => setForm({ ...form, wooConsumerSecret: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>API Key (Optional)</label>
                  <input className="form-control" placeholder="Optional API Key" value={form.wooApiKey || ''} onChange={(e) => setForm({ ...form, wooApiKey: e.target.value })} />
                </div>

                <div className="form-group">
                  <label>Webhook Secret (Optional)</label>
                  <input className="form-control" placeholder="Signature verify key" value={form.wooWebhookSecret || ''} onChange={(e) => setForm({ ...form, wooWebhookSecret: e.target.value })} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                  <div className="form-group">
                    <label>Product Sync Mode</label>
                    <select className="form-control" value={form.wooProductSyncMode || 'Two-Way Sync'} onChange={(e) => setForm({ ...form, wooProductSyncMode: e.target.value })}>
                      <option value="ERP Master">ERP Master</option>
                      <option value="Website Master">Website Master</option>
                      <option value="Two-Way Sync">Two-Way Sync</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Order Sync Mode</label>
                    <select className="form-control" value={form.wooOrderSyncMode || 'Real-Time'} onChange={(e) => setForm({ ...form, wooOrderSyncMode: e.target.value })}>
                      <option value="Manual">Manual</option>
                      <option value="Automatic">Automatic</option>
                      <option value="Real-Time">Real-Time</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Inventory Sync Mode</label>
                    <select className="form-control" value={form.wooInventorySyncMode || 'Two-Way Sync'} onChange={(e) => setForm({ ...form, wooInventorySyncMode: e.target.value })}>
                      <option value="ERP Master">ERP Master</option>
                      <option value="Website Master">Website Master</option>
                      <option value="Two-Way Sync">Two-Way Sync</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Auto Sync Interval</label>
                    <select className="form-control" value={form.wooSyncInterval || 30} onChange={(e) => setForm({ ...form, wooSyncInterval: Number(e.target.value) })}>
                      <option value={5}>Every 5 minutes</option>
                      <option value={15}>Every 15 minutes</option>
                      <option value={30}>Every 30 minutes</option>
                      <option value={60}>Every 1 hour</option>
                      <option value={1440}>Daily (24 Hours)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: form.wooConnected ? '#10b981' : '#ef4444'
                  }}></div>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4b5563' }}>
                    Status: {form.wooConnected ? 'Connected' : 'Disconnected / Unverified'}
                  </span>
                </div>

                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '1rem 0' }}>
                  <input
                    type="checkbox"
                    id="wooSyncStockERPToWoo"
                    checked={form.wooSyncStockERPToWoo ?? true}
                    onChange={(e) => setForm({ ...form, wooSyncStockERPToWoo: e.target.checked })}
                  />
                  <label htmlFor="wooSyncStockERPToWoo" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#4b5563', margin: 0, cursor: 'pointer' }}>
                    Automatically Sync Stock Changes to WooCommerce (Real-time)
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={handleTestConnection} disabled={testingConnection}>
                    {testingConnection ? 'Testing Connection...' : '🔌 Test Connection'}
                  </button>
                  <button type="button" className="btn btn-primary" onClick={handleConnectWebsite} disabled={connectingWebsite}>
                    {connectingWebsite ? 'Connecting & Syncing...' : '🔗 Connect Website'}
                  </button>
                  {form.wooConnected && (
                    <button type="button" className="btn btn-danger" onClick={handleDisconnectWebsite}>
                      ❌ Disconnect Website
                    </button>
                  )}
                  <button type="button" className="btn btn-success" onClick={saveSettings}>
                    💾 Save Settings
                  </button>
                </div>

                <div style={{ marginTop: '1.5rem', padding: '1.25rem', border: '1px solid #dbeafe', backgroundColor: '#eff6ff', borderRadius: '10px' }}>
                  <h4 style={{ color: '#1e40af', margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700 }}>Data Synchronization Triggers</h4>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', rowGap: '0.5rem' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSync('products-import')} disabled={!!syncingType || !form.wooConnected}>
                      {syncingType === 'products-import' ? 'Importing...' : '📥 Import Products'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSync('products')} disabled={!!syncingType || !form.wooConnected}>
                      {syncingType === 'products' ? 'Syncing...' : '📦 Sync Products'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSync('customers')} disabled={!!syncingType || !form.wooConnected}>
                      {syncingType === 'customers' ? 'Syncing...' : '👥 Sync Customers'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSync('orders')} disabled={!!syncingType || !form.wooConnected}>
                      {syncingType === 'orders' ? 'Syncing...' : '🛒 Sync Orders'}
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleSync('inventory')} disabled={!!syncingType || !form.wooConnected}>
                      {syncingType === 'inventory' ? 'Syncing...' : '🔄 Sync Inventory'}
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSync('all')} disabled={!!syncingType || !form.wooConnected}>
                      {syncingType === 'all' ? 'Syncing All...' : '⚡ Full Sync'}
                    </button>
                  </div>
                  {!form.wooConnected && (
                    <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.5rem', display: 'block' }}>
                      * Connect your website credentials first to enable synchronization.
                    </small>
                  )}
                </div>
              </div>

              {/* Right Column: Statistics & Diagnostics */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Statistics Panel */}
                <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>📊 WooCommerce Integration Statistics</h3>
                  {statsLoading ? (
                    <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Loading statistics...</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Products Linked</span>
                        <strong style={{ fontSize: '1.5rem', color: '#0f172a' }}>{stats?.productsFound ?? 0}</strong>
                      </div>
                      <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Customers Linked</span>
                        <strong style={{ fontSize: '1.5rem', color: '#0f172a' }}>{stats?.customersFound ?? 0}</strong>
                      </div>
                      <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Orders Linked</span>
                        <strong style={{ fontSize: '1.5rem', color: '#0f172a' }}>{stats?.ordersFound ?? 0}</strong>
                      </div>
                      <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Active Currency</span>
                        <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{stats?.wooCurrency || form.wooCurrency || 'INR'}</strong>
                      </div>

                      <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>WordPress Version</span>
                        <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{stats?.wooWordpressVersion || form.wooWordpressVersion || 'N/A'}</strong>
                      </div>
                      <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>WooCommerce Version</span>
                        <strong style={{ fontSize: '1.2rem', color: '#0f172a' }}>{stats?.wooVersion || form.wooVersion || 'N/A'}</strong>
                      </div>

                      <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9', gridColumn: 'span 2' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>API Verification Status</span>
                        <strong style={{ fontSize: '1.1rem', color: (stats?.wooApiStatus || form.wooApiStatus) === 'Connected' ? '#16a34a' : '#dc2626' }}>
                          {stats?.wooApiStatus || form.wooApiStatus || 'Disconnected'}
                        </strong>
                      </div>

                      <div style={{ padding: '1.25rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9', gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #e2e8f0', paddingBottom: '0.25rem' }}>⏰ Sync Timestamps</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                          <div>
                            <span style={{ color: '#64748b', display: 'block' }}>Last Product Sync:</span>
                            <strong style={{ color: '#334155' }}>
                              {stats?.lastProductSyncTime ? new Date(stats.lastProductSyncTime).toLocaleString() : (form.wooLastProductSyncTime ? new Date(form.wooLastProductSyncTime).toLocaleString() : 'Never')}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block' }}>Last Order Sync:</span>
                            <strong style={{ color: '#334155' }}>
                              {stats?.lastOrderSyncTime ? new Date(stats.lastOrderSyncTime).toLocaleString() : (form.wooLastOrderSyncTime ? new Date(form.wooLastOrderSyncTime).toLocaleString() : 'Never')}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block' }}>Last Customer Sync:</span>
                            <strong style={{ color: '#334155' }}>
                              {stats?.lastCustomerSyncTime ? new Date(stats.lastCustomerSyncTime).toLocaleString() : (form.wooLastCustomerSyncTime ? new Date(form.wooLastCustomerSyncTime).toLocaleString() : 'Never')}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: '#64748b', display: 'block' }}>Last Inventory Sync:</span>
                            <strong style={{ color: '#334155' }}>
                              {stats?.lastInventorySyncTime ? new Date(stats.lastInventorySyncTime).toLocaleString() : (form.wooLastInventorySyncTime ? new Date(form.wooLastInventorySyncTime).toLocaleString() : 'Never')}
                            </strong>
                          </div>
                        </div>
                      </div>

                      {stats?.wooStoreDescription && (
                        <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9', gridColumn: 'span 2' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Store Description</span>
                          <span style={{ fontSize: '0.85rem', color: '#475569', display: 'block', marginTop: '0.25rem', fontStyle: 'italic' }}>
                            {stats.wooStoreDescription}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Diagnostics Panel */}
                <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>🔍 Connection Diagnostics</h3>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1rem' }}>
                    Verify API routes status step-by-step.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      { label: 'Website Reachable', value: diagnostics?.websiteReachable },
                      { label: 'WordPress API Reachable', value: diagnostics?.wpApiReachable },
                      { label: 'WooCommerce API Reachable', value: diagnostics?.wooApiReachable },
                      { label: 'Credentials Valid', value: diagnostics?.credentialsValid },
                      { label: 'Product Access Successful', value: diagnostics?.productAccessSuccessful },
                    ].map((diag, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
                        <span style={{ fontSize: '0.9rem', color: '#475569' }}>{diag.label}</span>
                        {diag.value === undefined ? (
                          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Pending Check</span>
                        ) : diag.value ? (
                          <span style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 700 }}>✓ Reachable / Valid</span>
                        ) : (
                          <span style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 700 }}>✗ Unreachable / Invalid</span>
                        )}
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#334155' }}>Connection Status</span>
                      <strong style={{
                        fontSize: '0.9rem',
                        color: (diagnostics?.connectionStatus === 'Connected' || (!diagnostics && form.wooConnected)) ? '#16a34a' : '#dc2626'
                      }}>
                        {diagnostics?.connectionStatus || (form.wooConnected ? 'Connected' : 'Disconnected')}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sync Log Center (Full Width) */}
            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.25rem' }}>📋 Sync Log Center</h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Monitor the background sync worker operations, API logs, sync duration, and detailed error messages.
              </p>

              {/* Filters bar */}
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563' }}>Module:</span>
                  <select
                    className="form-control form-control-sm"
                    style={{ width: '150px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                    value={logsModule}
                    onChange={(e) => { setLogsModule(e.target.value); setLogsPage(1); }}
                  >
                    <option value="All">All Modules</option>
                    <option value="Products">Products</option>
                    <option value="Orders">Orders</option>
                    <option value="Customers">Customers</option>
                    <option value="Inventory">Inventory</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#4b5563' }}>Action:</span>
                  <select
                    className="form-control form-control-sm"
                    style={{ width: '150px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                    value={logsAction}
                    onChange={(e) => { setLogsAction(e.target.value); setLogsPage(1); }}
                  >
                    <option value="All">All Actions</option>
                    <option value="Import">Import</option>
                    <option value="Export">Export</option>
                    <option value="Sync">Sync</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginLeft: 'auto' }}
                  onClick={() => { setLogsPage(1); loadSyncLogs(); }}
                >
                  🔄 Refresh Logs
                </button>
              </div>

              {/* Logs Table */}
              {logsLoading ? (
                <LoadingSpinner />
              ) : logs.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '2rem' }}>No synchronization logs found for the selected filters.</p>
              ) : (
                <div className="table-wrap">
                  <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Module</th>
                        <th>Action</th>
                        <th style={{ textAlign: 'center' }}>Success Count</th>
                        <th style={{ textAlign: 'center' }}>Failed Count</th>
                        <th style={{ textAlign: 'center' }}>Duration</th>
                        <th>Status / Error Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.date}</td>
                          <td style={{ fontFamily: 'monospace' }}>{log.time}</td>
                          <td>
                            <span className="badge badge-info">{log.module}</span>
                          </td>
                          <td>
                            <span className="badge badge-secondary">{log.action}</span>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: '#16a34a' }}>{log.success}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: log.failed > 0 ? '#ef4444' : '#64748b' }}>{log.failed}</td>
                          <td style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                            {log.duration >= 1000 ? `${(log.duration / 1000).toFixed(2)}s` : `${log.duration}ms`}
                          </td>
                          <td>
                            {log.failed > 0 ? (
                              <span style={{ color: '#ef4444', fontWeight: 600, display: 'flex', flexWrap: 'wrap', gap: '0.25rem', alignItems: 'center' }}>
                                ⚠️ {log.errorMessage || 'Unknown Error'}
                              </span>
                            ) : (
                              <span style={{ color: '#16a34a', fontWeight: 600 }}>✓ Success</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination page={logsPage} pages={logsPages} onPageChange={setLogsPage} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Registered User Credentials</h3>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setUserForm(emptyUser); setUserModal('create'); }}>+ Register User</button>
            </div>

            {userLoading ? <LoadingSpinner /> : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>System Role</th>
                      <th>Account Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id || u._id}>
                        <td><strong>{u.name}</strong></td>
                        <td>{u.email}</td>
                        <td><span className="badge badge-success">{u.role}</span></td>
                        <td>
                          <span className={`rm-badge ${u.isActive ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setUserForm({ ...u, password: '' }); setUserModal('edit'); }}>Edit</button>{' '}
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => removeUser(u.id || u._id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination page={userPage} pages={userPages} onPageChange={setUserPage} />
              </div>
            )}

            {userModal && (
              <Modal title={userModal === 'edit' ? 'Edit User Profile' : 'Register User Credentials'} onClose={() => setUserModal(null)} footer={<><button type="button" className="btn btn-secondary" onClick={() => setUserModal(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={saveUser}>Save Profile</button></>}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label>Employee Name</label>
                    <input className="form-control" value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Login Email</label>
                    <input className="form-control" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required />
                  </div>
                  <div className="form-group">
                    <label>Password {userModal === 'edit' && '(leave blank to keep current)'}</label>
                    <input type="password" className="form-control" value={userForm.password || ''} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>System Role Access</label>
                    <select className="form-control" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                      {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="checkbox" checked={userForm.isActive} onChange={(e) => setUserForm({ ...userForm, isActive: e.target.checked })} />
                      <span>Account Active & Enabled</span>
                    </label>
                  </div>
                </div>
              </Modal>
            )}
          </div>
        )}

        {/* Data Migration Tab */}
        {activeTab === 'migration' && (
          <MigrationCenter />
        )}
      </div>
    </div>
  );
}

function MigrationCenter() {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState('zoho_import'); // zoho_import, export_restore, history, logs, validation

  // Zoho Import Wizard states
  const [step, setStep] = useState(1);
  const [importFile, setImportFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [tempFileId, setTempFileId] = useState('');
  const [filesFound, setFilesFound] = useState([]);
  const [summary, setSummary] = useState({});
  const [customerDuplicatePolicy, setCustomerDuplicatePolicy] = useState('merge');
  const [productDuplicatePolicy, setProductDuplicatePolicy] = useState('merge');
  const [duplicatePolicy, setDuplicatePolicy] = useState('merge');
  const [migrating, setMigrating] = useState(false);
  const [migrationReport, setMigrationReport] = useState(null);
  const [migrationTotals, setMigrationTotals] = useState(null);
  const [authorizeMigration, setAuthorizeMigration] = useState(false);

  // Backup Export/Restore states
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [scheduleInterval, setScheduleInterval] = useState('weekly');
  const [backupTarget, setBackupTarget] = useState('download');
  const [scheduleEmail, setScheduleEmail] = useState('');

  // History states
  const [historyList, setHistoryList] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Logs states
  const [selectedMigrationId, setSelectedMigrationId] = useState('');
  const [logsList, setLogsList] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [levelFilter, setLevelFilter] = useState('ALL');

  // Validation states
  const [validationLoading, setValidationLoading] = useState(false);
  const [validationReport, setValidationReport] = useState(null);

  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Fetch history
  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await migrationApi.history();
      if (data.success) {
        setHistoryList(data.history || []);
      }
    } catch (err) {
      toast('Failed to load migration history', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  // Fetch logs for selected migration
  const fetchLogs = async (id) => {
    if (!id) {
      setLogsList([]);
      return;
    }
    setLogsLoading(true);
    try {
      const { data } = await migrationApi.logs(id);
      if (data.success) {
        setLogsList(data.logs || []);
      }
    } catch (err) {
      toast('Failed to fetch migration logs', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (subTab === 'history') {
      fetchHistory();
    }
  }, [subTab]);

  useEffect(() => {
    if (subTab === 'logs') {
      if (selectedMigrationId) {
        fetchLogs(selectedMigrationId);
      } else {
        // Find latest migration in history and auto select it
        migrationApi.history().then(({ data }) => {
          if (data.success && data.history && data.history.length > 0) {
            const latest = data.history[0].id;
            setSelectedMigrationId(latest);
            fetchLogs(latest);
          }
        });
      }
    }
  }, [subTab, selectedMigrationId]);

  // Zoho Import functions
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImportFile(file);

    const fd = new FormData();
    fd.append('file', file);

    setUploading(true);
    try {
      const { data } = await migrationApi.upload(fd);
      if (data.success) {
        setTempFileId(data.tempFileId);
        setFilesFound(data.filesFound || []);
        setSummary(data.summary || {});
        setStep(2);
        toast('File analyzed successfully', 'success');
      } else {
        toast(data.message || 'File upload failed', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Upload & Analysis failed', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleStartIngestion = async () => {
    setMigrating(true);
    try {
      const { data } = await migrationApi.execute({
        tempFileId,
        duplicatePolicy,
        customerDuplicatePolicy,
        productDuplicatePolicy
      });
      if (data.success) {
        setMigrationReport(data.report || {});
        setMigrationTotals(data.totals || null);
        setSelectedMigrationId(data.migrationId);
        setStep(5);
        toast('Data migration successful', 'success');
      } else {
        toast(data.message || 'Data ingestion failed', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Ingestion failed', 'error');
    } finally {
      setMigrating(false);
    }
  };

  const handleRollback = async (id) => {
    if (!confirm('⚠️ WARNING: Are you sure you want to rollback this migration? This will delete all imported records in this session and recompute ledger outstandings. This operation cannot be undone.')) return;
    try {
      const { data } = await migrationApi.rollback(id);
      if (data.success) {
        toast('Migration snapshot rolled back successfully', 'success');
        fetchHistory();
      } else {
        toast(data.message || 'Rollback failed', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Rollback failed', 'error');
    }
  };

  // Full backup export
  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const { data } = await migrationApi.exportBackup();
      download(data, `AO_Core_Backup_${new Date().toISOString().split('T')[0]}.zip`);
      toast('Backup exported successfully', 'success');
    } catch (err) {
      toast('Backup export failed', 'error');
    } finally {
      setExporting(false);
    }
  };

  // Restore backup
  const handleRestoreBackup = async (e) => {
    e.preventDefault();
    if (!restoreFile) {
      toast('Please select a backup zip file first', 'error');
      return;
    }

    if (!confirm('🚨 CRITICAL WARNING: You are about to perform a full system database restore. This will completely overwrite all existing customer records, products, invoices, payments, repack entries, and raw materials with the data inside the backup archive. We recommend backing up your current database first. Do you want to proceed?')) {
      return;
    }

    const fd = new FormData();
    fd.append('file', restoreFile);

    setRestoring(true);
    try {
      const { data } = await migrationApi.restore(fd);
      if (data.success) {
        toast('✓ Database successfully restored. Page will reload.', 'success');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast(data.message || 'Database restore failed', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Database restore failed', 'error');
    } finally {
      setRestoring(false);
    }
  };

  // Client side validation audit
  const runValidationAudit = async () => {
    setValidationLoading(true);
    setValidationReport(null);
    try {
      // Fetch data
      const [custRes, salesRes, payRes] = await Promise.all([
        customersApi.list({ limit: 10000 }),
        salesApi.list({ limit: 10000 }),
        salesApi.listPayments({ limit: 10000 })
      ]);

      const customers = custRes.data.customers || [];
      const invoices = salesRes.data.sales || [];
      const payments = payRes.data.payments || [];

      const customerMap = {};
      customers.forEach(c => {
        customerMap[c.id] = c;
      });

      const invoiceMap = {};
      invoices.forEach(inv => {
        invoiceMap[inv.id] = inv;
      });

      const anomalies = [];
      let checkedInvoicesCount = invoices.length;
      let checkedPaymentsCount = payments.length;
      let checkedCustomersCount = customers.length;
      let passedCount = 0;

      // 1. Check invoice payment allocation integrity
      invoices.forEach(inv => {
        let calculatedPaidAmount = 0;
        payments.forEach(p => {
          if (p.allocations && p.status === 'Success') {
            p.allocations.forEach(alloc => {
              if (String(alloc.invoiceId) === String(inv.id)) {
                calculatedPaidAmount += parseFloat(alloc.amount || 0);
              }
            });
          }
        });

        // Tolerable floating point difference
        const currentAmountPaid = parseFloat(inv.amountPaid || 0);
        
        let hasAnomaly = false;
        if (Math.abs(currentAmountPaid - calculatedPaidAmount) > 0.01) {
          anomalies.push({
            type: 'Invoice Payment Allocation Mismatch',
            severity: 'WARNING',
            message: `Invoice #${inv.invoiceNumber}: Registered paid amount is ₹${currentAmountPaid}, but sum of allocations is ₹${calculatedPaidAmount.toFixed(2)}.`
          });
          hasAnomaly = true;
        }

        if (!hasAnomaly) passedCount++;
      });

      // 2. Check Customer Balance integrity
      customers.forEach(c => {
        let sumOutstanding = 0;
        invoices.forEach(inv => {
          if (String(inv.customerId) === String(c.id) && inv.status !== 'Cancelled') {
            let amountPaid = 0;
            payments.forEach(p => {
              if (p.allocations && p.status === 'Success') {
                p.allocations.forEach(alloc => {
                  if (String(alloc.invoiceId) === String(inv.id)) {
                    amountPaid += parseFloat(alloc.amount || 0);
                  }
                });
              }
            });
            const outstanding = Number((inv.grandTotal - amountPaid).toFixed(2));
            if (outstanding > 0) {
              sumOutstanding += outstanding;
            }
          }
        });

        const currentBalance = parseFloat(c.balance || 0);
        if (Math.abs(currentBalance - sumOutstanding) > 0.05) {
          anomalies.push({
            type: 'Customer Balance Mismatch',
            severity: 'ERROR',
            message: `Customer "${c.name}": Registered outstanding balance is ₹${currentBalance.toFixed(2)}, but calculated summation of unpaid invoices is ₹${sumOutstanding.toFixed(2)}.`
          });
        }
      });

      // 3. Check orphaned invoices or payments
      invoices.forEach(inv => {
        if (!customerMap[inv.customerId]) {
          anomalies.push({
            type: 'Orphaned Invoice',
            severity: 'ERROR',
            message: `Invoice #${inv.invoiceNumber} is linked to customerId "${inv.customerId}" which does not exist.`
          });
        }
      });

      payments.forEach(p => {
        if (!customerMap[p.customerId]) {
          anomalies.push({
            type: 'Orphaned Payment',
            severity: 'ERROR',
            message: `Payment #${p.paymentNumber} is linked to customerId "${p.customerId}" which does not exist.`
          });
        }
      });

      setValidationReport({
        checkedCustomersCount,
        checkedInvoicesCount,
        checkedPaymentsCount,
        anomaliesCount: anomalies.length,
        anomalies,
        auditTimestamp: new Date().toLocaleTimeString()
      });

      if (anomalies.length === 0) {
        toast('✓ Data integrity validation audit completed. All records synchronized perfectly!', 'success');
      } else {
        toast(`Validation finished with ${anomalies.length} anomaly flags.`, 'warning');
      }
    } catch (err) {
      toast('Failed to run data validation audit', 'error');
    } finally {
      setValidationLoading(false);
    }
  };

  // Filter logs list on client side
  const filteredLogs = logsList.filter(log => {
    if (levelFilter === 'ALL') return true;
    return log.level === levelFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
      {/* Sub Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '1rem', paddingBottom: '0.25rem' }}>
        {[
          { id: 'zoho_import', label: '📥 Zoho Import Wizard' },
          { id: 'export_restore', label: '💾 Backup & Restore Center' },
          { id: 'history', label: '📂 Import History' },
          { id: 'logs', label: '🖥️ Migration Logs Console' },
          { id: 'validation', label: '⚖️ Data Integrity Validation' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            style={{
              padding: '0.5rem 1rem',
              border: 'none',
              background: 'transparent',
              fontSize: '0.9rem',
              fontWeight: subTab === tab.id ? 700 : 500,
              borderBottom: subTab === tab.id ? '2px solid #ff9800' : '2px solid transparent',
              color: subTab === tab.id ? '#ff9800' : '#4b5563',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all 0.2s ease-in-out'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ minHeight: '300px', animation: 'fadeIn 0.2s ease-in-out' }}>
        {/* Zoho Import Tab */}
        {subTab === 'zoho_import' && (
          <div className="card" style={{ padding: '2rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
              Zoho Books / Data Migration & Backup Center
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 1.5rem 0' }}>
              Seamlessly migrate historical data (Customers, Contact Persons, Products, Invoices, Payments, Credit Notes, Credit Note Links, Quotes, Sales Receipts, Refunds, Recurring Invoices, Expenses, Activity Logs) from Zoho exports into AO Core ERP.
            </p>

            {/* Stepper */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', padding: '0 1rem' }}>
              {[
                { number: 1, label: 'Upload Archive' },
                { number: 2, label: 'Smart Scan' },
                { number: 3, label: 'Validation' },
                { number: 4, label: 'Policies' },
                { number: 5, label: 'Summary' }
              ].map(s => (
                <div key={s.number} style={{ display: 'flex', alignItems: 'center', flex: s.number < 5 ? 1 : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: step === s.number ? '#ff9800' : (step > s.number ? '#10b981' : '#f1f5f9'),
                      color: step >= s.number ? '#ffffff' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '0.9rem'
                    }}>
                      {step > s.number ? '✓' : s.number}
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: step === s.number ? 700 : 500, color: step === s.number ? '#0f172a' : '#64748b' }}>
                      {s.label}
                    </span>
                  </div>
                  {s.number < 5 && (
                    <div style={{
                      flex: 1,
                      height: '2px',
                      backgroundColor: step > s.number ? '#10b981' : '#e2e8f0',
                      margin: '0 1rem'
                    }}></div>
                  )}
                </div>
              ))}
            </div>

            {/* Wizard Step 1: Upload */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '3rem 2rem', backgroundColor: '#f8fafc', textAlign: 'center' }}>
                <span style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</span>
                <h4 style={{ fontWeight: 700, color: '#0f172a', margin: '0 0 0.5rem 0' }}>Select Zoho Backup File</h4>
                <p style={{ color: '#64748b', fontSize: '0.85rem', maxWidth: '450px', margin: '0 0 1.5rem 0' }}>
                  Upload a standard Zoho Books exported ZIP archive, or individual CSV/Excel spreadsheet files matching standard module names (e.g. <code>Contacts.csv</code>, <code>Invoice.csv</code>, <code>Credit_Note.csv</code>).
                </p>

                <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
                  <button type="button" className="btn btn-primary" disabled={uploading} style={{ padding: '0.6rem 1.5rem', fontWeight: 600 }}>
                    {uploading ? 'Analyzing Upload...' : 'Choose File to Import'}
                  </button>
                  <input
                    type="file"
                    accept=".zip,.csv,.xlsx"
                    onChange={handleFileUpload}
                    style={{ position: 'absolute', top: 0, left: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                    disabled={uploading}
                  />
                </div>
                {uploading && (
                  <div style={{ marginTop: '1rem' }}>
                    <LoadingSpinner />
                  </div>
                )}
              </div>
            )}

            {/* Wizard Step 2: Smart Scan Results */}
            {step === 2 && (
              <div>
                <h4 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>✓ Smart Detection Scan Complete</h4>
                <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1rem' }}>
                  We scanned all files in the backup archive. Here is the mapped module registry list:
                </p>
                <div style={{ marginBottom: '1.5rem', overflowX: 'auto', maxHeight: '400px' }}>
                  <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Records</th>
                        <th>Module Detected</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filesFound.map((f, idx) => (
                        <tr key={idx}>
                          <td><strong>{f.fileName}</strong></td>
                          <td>{f.recordCount}</td>
                          <td>
                            {f.module && f.module !== 'unmapped' ? (
                              <span style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                backgroundColor: '#fff7ed',
                                color: '#c2410c',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                fontSize: '0.75rem'
                              }}>{f.module.replace('_', ' ')}</span>
                            ) : (
                              <span style={{
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                backgroundColor: '#f1f5f9',
                                color: '#64748b',
                                fontWeight: 600,
                                fontSize: '0.75rem'
                              }}>Unmapped</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setStep(1); setImportFile(null); }}>
                    Back / Re-Upload
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setStep(3)} style={{ marginLeft: 'auto' }}>
                    Proceed to Validation Summary →
                  </button>
                </div>
              </div>
            )}

            {/* Wizard Step 3: Pre-Migration Validation */}
            {step === 3 && (
              <div>
                <h4 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>Pre-Migration Data Validation Summary</h4>
                <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1.5rem' }}>
                  Review the total records found in the backup before applying the policies and starting ingestion.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  {Object.entries(summary).map(([key, count]) => {
                    if (count === 0 || key === 'unmapped') return null;
                    return (
                      <div key={key} style={{
                        padding: '1rem',
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>{key.replace('_', ' ')}</span>
                          <strong style={{ display: 'block', fontSize: '1.25rem', color: '#0f172a' }}>{count} Found</strong>
                        </div>
                        <span style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '6px',
                          backgroundColor: '#dcfce7',
                          color: '#166534',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}>Ready</span>
                      </div>
                    );
                  })}
                </div>

                {/* Invoice Preview Section */}
                {(() => {
                  const invoicesFile = filesFound.find(f => f.module === 'invoices');
                  if (!invoicesFile) return null;
                  return (
                    <div style={{
                      marginBottom: '2rem',
                      padding: '1.5rem',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      backgroundColor: '#f8fafc'
                    }}>
                      <h5 style={{ fontWeight: 800, color: '#334155', fontSize: '1rem', margin: '0 0 0.5rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>📄 {invoicesFile.fileName}</span>
                        <span style={{ fontSize: '0.85rem', color: '#ff9800', fontWeight: 700 }}>Invoices Found: {invoicesFile.recordCount}</span>
                      </h5>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0 0 1rem 0' }}>
                        Sample mapping verification preview parsed from the uploaded Zoho Books document.
                      </p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <strong style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sample Preview:</strong>
                        {invoicesFile.preview && invoicesFile.preview.length > 0 ? (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                            {invoicesFile.preview.map((p, idx) => (
                              <div key={idx} style={{
                                padding: '1rem',
                                backgroundColor: '#ffffff',
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                fontSize: '0.85rem',
                                boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)'
                              }}>
                                <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '0.9rem', marginBottom: '0.4rem' }}>{p.docNumber}</div>
                                <div style={{ color: '#475569', marginBottom: '0.25rem' }}>
                                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Customer</span>
                                  <strong>{p.customer}</strong>
                                </div>
                                <div style={{ color: '#1e293b' }}>
                                  <span style={{ color: '#94a3b8', fontSize: '0.75rem', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Total</span>
                                  <strong style={{ color: '#16a34a', fontSize: '0.95rem' }}>₹{p.total?.toLocaleString('en-IN')}</strong>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.85rem' }}>No preview data available. Check document mapping.</div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer', margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={authorizeMigration}
                      onChange={(e) => setAuthorizeMigration(e.target.checked)}
                      style={{ marginTop: '0.2rem', accentColor: '#ff9800' }}
                    />
                    <span style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 600 }}>
                      I have reviewed the record counts and authorize migration to start.
                    </span>
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                    ← Back to Scan
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setStep(4)}
                    disabled={!authorizeMigration}
                    style={{ marginLeft: 'auto' }}
                  >
                    Configure Policies →
                  </button>
                </div>
              </div>
            )}

            {/* Wizard Step 4: Duplicate Policy Configuration */}
            {step === 4 && (
              <div>
                <h4 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>Configure Deduplication Policies</h4>
                <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1.5rem' }}>
                  Define individual conflict resolution rules for Customers and Products if matching records are detected in the database.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                  {/* Customer Policy */}
                  <div>
                    <h5 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155', marginBottom: '0.75rem' }}>👥 Customers Duplicate Policy</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                      {[
                        { id: 'merge', title: 'Merge (Recommended)', desc: 'Populate empty fields, retain existing properties.' },
                        { id: 'skip', title: 'Skip', desc: 'Do not import or update existing customer accounts.' },
                        { id: 'replace', title: 'Update (Overwrite)', desc: 'Overwrite and replace database fields with Zoho export properties.' }
                      ].map(opt => (
                        <label
                          key={opt.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '1rem',
                            border: customerDuplicatePolicy === opt.id ? '2px solid #ff9800' : '1px solid #cbd5e1',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: customerDuplicatePolicy === opt.id ? '#fffbeb' : '#ffffff',
                            transition: 'all 0.15s ease-in-out'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <input
                              type="radio"
                              name="customerDuplicatePolicy"
                              value={opt.id}
                              checked={customerDuplicatePolicy === opt.id}
                              onChange={() => setCustomerDuplicatePolicy(opt.id)}
                              style={{ marginRight: '0.5rem', accentColor: '#ff9800' }}
                            />
                            <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{opt.title}</strong>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.3' }}>{opt.desc}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Product Policy */}
                  <div>
                    <h5 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155', marginBottom: '0.75rem' }}>📦 Products Duplicate Policy</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                      {[
                        { id: 'merge', title: 'Merge (Recommended)', desc: 'Populate empty attributes, retain stock and price.' },
                        { id: 'skip', title: 'Skip', desc: 'Do not import or update existing item SKUs.' },
                        { id: 'replace', title: 'Update (Overwrite)', desc: 'Overwrite database product properties with imported fields.' }
                      ].map(opt => (
                        <label
                          key={opt.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '1rem',
                            border: productDuplicatePolicy === opt.id ? '2px solid #ff9800' : '1px solid #cbd5e1',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: productDuplicatePolicy === opt.id ? '#fffbeb' : '#ffffff',
                            transition: 'all 0.15s ease-in-out'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <input
                              type="radio"
                              name="productDuplicatePolicy"
                              value={opt.id}
                              checked={productDuplicatePolicy === opt.id}
                              onChange={() => setProductDuplicatePolicy(opt.id)}
                              style={{ marginRight: '0.5rem', accentColor: '#ff9800' }}
                            />
                            <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{opt.title}</strong>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.3' }}>{opt.desc}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setStep(3)}>
                    ← Back to Validation
                  </button>
                  <button
                    type="button"
                    className="btn btn-success"
                    onClick={handleStartIngestion}
                    disabled={migrating}
                    style={{ marginLeft: 'auto', padding: '0.6rem 2rem', fontWeight: 700 }}
                  >
                    {migrating ? 'Running Ingestion...' : '⚡ Start Ingestion & Rebuild Ledgers'}
                  </button>
                </div>
                {migrating && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '1.5rem', gap: '0.5rem' }}>
                    <LoadingSpinner />
                    <span style={{ color: '#4b5563', fontSize: '0.85rem', fontWeight: 600 }}>Analyzing CSVs, creating transactions, linking credit notes and updating activity timeline feeds...</span>
                  </div>
                )}
              </div>
            )}

            {/* Wizard Step 5: Finish Summary */}
            {step === 5 && (
              <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                <span style={{ fontSize: '4rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
                <h4 style={{ fontWeight: 800, color: '#10b981', margin: '0 0 0.5rem 0' }}>Data Migration Completed Successfully!</h4>
                <p style={{ color: '#64748b', fontSize: '0.9rem', maxWidth: '500px', margin: '0 auto 1.5rem auto' }}>
                  The Zoho Books transaction history has been loaded. Outstanding invoice balances, credit notes, sales receipts, quotes and running customer ledgers have been recomputed sequentially.
                </p>

                {migrationReport && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', maxWidth: '800px', margin: '0 auto 2rem auto' }}>
                    {[
                      { label: 'Customers Created', count: migrationReport.customers, icon: '👥' },
                      { label: 'Contact Persons', count: migrationReport.contact_persons, icon: '👤' },
                      { label: 'Products Created', count: migrationReport.products, icon: '📦' },
                      { label: 'Invoices Created', count: migrationReport.invoices, icon: '🧾' },
                      { label: 'Payments Recorded', count: migrationReport.payments, icon: '💰' },
                      { label: 'Credit Notes Mapped', count: migrationReport.credit_notes, icon: '🪙' },
                      { label: 'Credit Note Links', count: migrationReport.credit_note_links, icon: '🔗' },
                      { label: 'Quotes Created', count: migrationReport.quotations, icon: '📝' },
                      { label: 'Sales Receipts', count: migrationReport.sales_receipts, icon: '🧾' },
                      { label: 'Refunds Processed', count: migrationReport.refunds, icon: '💸' },
                      { label: 'Recurring Invoices', count: migrationReport.recurring_invoices, icon: '🔄' },
                      { label: 'Expenses Ingested', count: migrationReport.expenses, icon: '📉' },
                      { label: 'Activity Logs Created', count: migrationReport.activity_logs, icon: '📌' }
                    ].map((m, idx) => {
                      if (m.count === undefined || m.count === 0) return null;
                      return (
                        <div key={idx} style={{ padding: '1rem 0.5rem', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '8px' }}>
                          <span style={{ fontSize: '1.5rem', display: 'block', marginBottom: '0.25rem' }}>{m.icon}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>{m.label}</span>
                          <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>{m.count}</strong>
                        </div>
                      );
                    })}
                  </div>
                )}

                {migrationTotals && (
                  <div style={{
                    maxWidth: '600px',
                    margin: '0 auto 2rem auto',
                    padding: '1.5rem',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    backgroundColor: '#f8fafc',
                    textAlign: 'left',
                    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.02)'
                  }}>
                    <h5 style={{ fontWeight: 800, color: '#1e293b', fontSize: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      📊 Migration Verification Screen (Compare with Zoho Totals)
                    </h5>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.85rem', color: '#475569' }}>Invoices Imported</strong>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Value of Sales Invoices</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ display: 'block', fontSize: '1.1rem', color: '#0f172a' }}>{migrationReport?.invoices || 0}</strong>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
                            ₹{migrationTotals.invoiceValue?.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.85rem', color: '#475569' }}>Payments Imported</strong>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Total Payments Received</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ display: 'block', fontSize: '1.1rem', color: '#0f172a' }}>{migrationReport?.payments || 0}</strong>
                          <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#10b981' }}>
                            ₹{migrationTotals.paymentValue?.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', backgroundColor: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                        <div>
                          <strong style={{ display: 'block', fontSize: '0.85rem', color: '#1e40af' }}>Net Customer Outstanding</strong>
                          <span style={{ fontSize: '0.75rem', color: '#3b82f6' }}>Rebuilt Ledger Balance (Invoices - Payments)</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <strong style={{ fontSize: '1.15rem', color: '#1e3a8a', fontWeight: 800 }}>
                            ₹{migrationTotals.outstanding?.toLocaleString('en-IN')}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => { setStep(1); setImportFile(null); setMigrationReport(null); setMigrationTotals(null); setAuthorizeMigration(false); }}>
                    Import Another File
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setSubTab('history')}>
                    View Migration Logs & History
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Backup Export/Restore Tab */}
        {subTab === 'export_restore' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Full Backup Export */}
            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                💾 Package Backup Export
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>
                Download a fully packaged snapshot of all databases (Customers, Products, Invoices, Payments, manufacturing logs, and raw materials) in standard JSON format wrapped with raw CSVs in a single ZIP container.
              </p>

              <div className="form-group">
                <label>Export Format</label>
                <select className="form-control" defaultValue="zip">
                  <option value="zip">ZIP Archive (JSON database mapping + Module CSV tables)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Storage / Backup Destination Target</label>
                <select className="form-control" value={backupTarget} onChange={(e) => setBackupTarget(e.target.value)}>
                  <option value="download">Direct Browser Download (Standard File)</option>
                  <option value="local">Local Server Storage Folder (Backup Directory)</option>
                  <option value="email">Send Archive to Registered Owner Email</option>
                </select>
              </div>

              {backupTarget === 'email' && (
                <div className="form-group">
                  <label>Receiver Email Address</label>
                  <input type="email" className="form-control" placeholder="e.g. accounting@company.com" value={scheduleEmail} onChange={(e) => setScheduleEmail(e.target.value)} />
                </div>
              )}

              {/* Automated scheduler */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', backgroundColor: '#f8fafc' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, cursor: 'pointer', margin: 0 }}>
                  <input type="checkbox" checked={enableSchedule} onChange={(e) => setEnableSchedule(e.target.checked)} />
                  <span>⏰ Configure Automated Backup Schedule</span>
                </label>
                {enableSchedule && (
                  <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: '#4b5563', display: 'block', marginBottom: '0.25rem' }}>Interval:</span>
                      <select className="form-control form-control-sm" value={scheduleInterval} onChange={(e) => setScheduleInterval(e.target.value)}>
                        <option value="daily">Daily Midnight Snapshot</option>
                        <option value="weekly">Weekly Sunday Backup</option>
                        <option value="monthly">Monthly 1st Day Archive</option>
                      </select>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: '#4b5563', display: 'block', marginBottom: '0.25rem' }}>Target:</span>
                      <select className="form-control form-control-sm">
                        <option value="server">Local Server Store</option>
                        <option value="email">Email Notification</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <button type="button" className="btn btn-primary" onClick={handleExportBackup} disabled={exporting} style={{ padding: '0.6rem 1.5rem', width: '100%', fontWeight: 700 }}>
                {exporting ? 'Compiling Database & Creating ZIP...' : '⚡ Generate & Package Backup'}
              </button>
            </div>

            {/* Database Restore from Backup ZIP */}
            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #fee2e2' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#b91c1c', margin: '0 0 0.5rem 0' }}>
                ⚠️ Restore Database Snapshot
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>
                Restore the database tables from an AO Core ZIP Backup. This will truncate the current tables and overwrite the database. Restoring from unverified files can cause data corruption.
              </p>

              <form onSubmit={handleRestoreBackup}>
                <div className="form-group">
                  <label>Select AO Core Backup ZIP File</label>
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => setRestoreFile(e.target.files[0])}
                    className="form-control"
                    required
                  />
                </div>

                <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fecaca', padding: '1rem', borderRadius: '8px', fontSize: '0.825rem', color: '#b91c1c', marginBottom: '1.5rem' }}>
                  <strong>🚨 CRITICAL ACTION REQUIRED:</strong> Restoring database will replace all current tables. Make sure you have exported a backup of your current work.
                </div>

                <button type="submit" className="btn btn-danger" disabled={restoring || !restoreFile} style={{ padding: '0.6rem 1.5rem', width: '100%', fontWeight: 700 }}>
                  {restoring ? 'Truncating Tables & Ingesting SQL...' : '⚠️ Upload & Restore Database Snapshot'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Import History Tab */}
        {subTab === 'history' && (
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1rem', color: '#0f172a' }}>Data Migration Sessions Audit History</h3>

            {historyLoading ? (
              <LoadingSpinner />
            ) : historyList.length === 0 ? (
              <p style={{ color: '#64748b', fontSize: '0.9rem', textAlign: 'center', padding: '2rem' }}>No data import sessions have been run yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table" style={{ width: '100%', fontSize: '0.875rem' }}>
                  <thead>
                    <tr>
                      <th>Date & Time</th>
                      <th>Operator</th>
                      <th>Source Module</th>
                      <th>Status</th>
                      <th>Import Report Summary</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map(h => {
                      const counts = typeof h.recordCount === 'string' ? JSON.parse(h.recordCount) : h.recordCount;
                      let countsSummary = 'None';
                      if (counts) {
                        const parts = [];
                        if (counts.customers) parts.push(`Cust:${counts.customers}`);
                        if (counts.products) parts.push(`Prod:${counts.products}`);
                        if (counts.invoices) parts.push(`Inv:${counts.invoices}`);
                        if (counts.payments) parts.push(`Pay:${counts.payments}`);
                        if (counts.credit_notes) parts.push(`CN:${counts.credit_notes}`);
                        if (counts.quotations) parts.push(`Quote:${counts.quotations}`);
                        if (counts.sales_receipts) parts.push(`Receipt:${counts.sales_receipts}`);
                        if (counts.expenses) parts.push(`Exp:${counts.expenses}`);
                        countsSummary = parts.length > 0 ? parts.join(' ') : '0 records';
                      }
                      return (
                        <tr key={h.id}>
                          <td>{new Date(h.importDate).toLocaleString()}</td>
                          <td><strong>{h.user}</strong></td>
                          <td>{h.source}</td>
                          <td>
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: '6px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: h.status === 'Completed' ? '#d1fae5' : (h.status === 'Rolled Back' ? '#f3f4f6' : '#fee2e2'),
                              color: h.status === 'Completed' ? '#065f46' : (h.status === 'Rolled Back' ? '#374151' : '#991b1b')
                            }}>
                              {h.status}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{countsSummary}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => {
                                  setSelectedMigrationId(h.id);
                                  setSubTab('logs');
                                }}
                              >
                                🔍 Inspect Logs
                              </button>
                              {h.status === 'Completed' && (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleRollback(h.id)}
                                >
                                  ↩️ Rollback
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Migration Logs Tab */}
        {subTab === 'logs' && (
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>Granular Ingestion Log Terminal</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Select an import session to inspect the system terminal logs in real-time.</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Import Session:</span>
                <select
                  className="form-control"
                  style={{ width: '220px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
                  value={selectedMigrationId}
                  onChange={(e) => setSelectedMigrationId(e.target.value)}
                >
                  <option value="">-- Choose Import Session --</option>
                  {historyList.map(h => (
                    <option key={h.id} value={h.id}>
                      {new Date(h.importDate).toLocaleDateString()} - {h.source} ({h.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Level Filter */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
              {[
                { id: 'ALL', label: 'All Levels' },
                { id: 'INFO', label: 'Information ℹ️' },
                { id: 'DUPLICATE', label: 'Duplicates 🟡' },
                { id: 'WARNING', label: 'Warnings ⚠️' },
                { id: 'ERROR', label: 'Errors ❌' }
              ].map(lvl => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setLevelFilter(lvl.id)}
                  style={{
                    padding: '0.35rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.8rem',
                    fontWeight: levelFilter === lvl.id ? 700 : 500,
                    backgroundColor: levelFilter === lvl.id ? '#0f172a' : '#f8fafc',
                    color: levelFilter === lvl.id ? '#ffffff' : '#475569',
                    cursor: 'pointer'
                  }}
                >
                  {lvl.label}
                </button>
              ))}
            </div>

            {/* Terminal Window */}
            <div style={{
              backgroundColor: '#0f172a',
              color: '#f8fafc',
              borderRadius: '8px',
              fontFamily: '"Fira Code", Monaco, Consolas, "Ubuntu Mono", monospace',
              fontSize: '0.85rem',
              padding: '1.25rem',
              height: '420px',
              overflowY: 'auto',
              border: '1px solid #1e293b',
              boxShadow: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.5)'
            }}>
              {logsLoading ? (
                <div style={{ color: '#38bdf8', padding: '1rem 0' }}>Loading session detail logs...</div>
              ) : !selectedMigrationId ? (
                <div style={{ color: '#94a3b8', padding: '1rem 0', fontStyle: 'italic', textAlign: 'center' }}>
                  Please select a migration session from the dropdown to inspect logs.
                </div>
              ) : filteredLogs.length === 0 ? (
                <div style={{ color: '#94a3b8', padding: '1rem 0', fontStyle: 'italic', textAlign: 'center' }}>
                  No logs found matching the selected filter level.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {filteredLogs.map((log, idx) => {
                    let logColor = '#ffffff';
                    if (log.level === 'INFO') logColor = '#38bdf8'; // light blue
                    else if (log.level === 'WARNING') logColor = '#fbbf24'; // orange-yellow
                    else if (log.level === 'ERROR') logColor = '#f87171'; // red
                    else if (log.level === 'DUPLICATE') logColor = '#f472b6'; // pink

                    return (
                      <div key={log.id || idx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '0.2rem' }}>
                        <span style={{ color: '#64748b', flexShrink: 0, select: 'none', userSelect: 'none' }}>
                          [{new Date(log.timestamp || log.createdAt).toLocaleTimeString()}]
                        </span>
                        <span style={{ color: logColor, fontWeight: 700, flexShrink: 0, width: '90px' }}>
                          {`[${log.level}]`}
                        </span>
                        <span style={{ color: '#e2e8f0', wordBreak: 'break-all' }}>
                          {log.message}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data Validation Tab */}
        {subTab === 'validation' && (
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
              ⚖️ Post-Import Ledger & Invoice Validation Center
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 1.5rem 0' }}>
              Verify system integrity by running database audit validation. This diagnostics tool matches invoice grand totals against registered allocations, double-checks running customer balances, and reports orphans.
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={runValidationAudit}
              disabled={validationLoading}
              style={{ padding: '0.6rem 2rem', fontWeight: 700, marginBottom: '1.5rem' }}
            >
              {validationLoading ? 'Running Integrity Diagnostics Audit...' : '⚡ Run Data Integrity Audit'}
            </button>

            {validationLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 0', gap: '0.5rem' }}>
                <LoadingSpinner />
                <span style={{ color: '#4b5563', fontSize: '0.85rem' }}>Scanning ledger lines, invoice records, and allocating payments...</span>
              </div>
            )}

            {validationReport && (
              <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Checked Customers</span>
                    <strong style={{ fontSize: '1.5rem', color: '#0f172a' }}>{validationReport.checkedCustomersCount}</strong>
                  </div>
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Checked Invoices</span>
                    <strong style={{ fontSize: '1.5rem', color: '#0f172a' }}>{validationReport.checkedInvoicesCount}</strong>
                  </div>
                  <div style={{ padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Checked Payments</span>
                    <strong style={{ fontSize: '1.5rem', color: '#0f172a' }}>{validationReport.checkedPaymentsCount}</strong>
                  </div>
                </div>

                <h4 style={{ fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  Audit Diagnostics Results ({validationReport.anomaliesCount} flag alerts found)
                </h4>

                {validationReport.anomaliesCount === 0 ? (
                  <div style={{ padding: '2rem', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', display: 'flex', alignItems: 'center', gap: '0.75rem', fontWeight: 600 }}>
                    <span>✓</span> All database records passed integrity audits! Ledger totals and payments allocation checks match exactly.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {validationReport.anomalies.map((anom, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '1rem',
                          backgroundColor: anom.severity === 'ERROR' ? '#fef2f2' : '#fffbeb',
                          borderLeft: `4px solid ${anom.severity === 'ERROR' ? '#ef4444' : '#f59e0b'}`,
                          borderRadius: '6px',
                          fontSize: '0.85rem'
                        }}
                      >
                        <strong style={{ display: 'block', color: anom.severity === 'ERROR' ? '#991b1b' : '#92400e', marginBottom: '0.25rem' }}>
                          {anom.severity === 'ERROR' ? '🔴' : '🟡'} {anom.type}
                        </strong>
                        <span style={{ color: '#475569' }}>{anom.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

