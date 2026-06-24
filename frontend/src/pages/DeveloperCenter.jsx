import { useState, useEffect } from 'react';
import { developerApi, integrationsApi } from '../api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { 
  Key, Webhook, Cpu, ShieldAlert, BookOpen, History, 
  BarChart3, Sliders, CheckCircle2, AlertTriangle, Play, 
  Copy, RefreshCw, Trash2, Globe, Terminal, Code2, Download,
  Check, X
} from 'lucide-react';

const modulesList = [
  'Products', 'Customers', 'Orders', 'Invoices', 'Inventory', 
  'Purchases', 'Manufacturing', 'Suppliers', 'Reports', 'CRM', 
  'Analytics', 'Settings', 'Admin'
];

const permissionLevels = ['Read', 'Create', 'Update', 'Delete', 'Export', 'Full Access'];

const webhookEventsList = [
  'product.created', 'product.updated', 'product.deleted',
  'customer.created', 'customer.updated', 'order.created',
  'invoice.created', 'invoice.paid', 'payment.received',
  'stock.updated', 'purchase.created', 'production.completed',
  'shipment.created', 'delivery.completed', 'CRM.followup.created'
];

const platformOptions = [
  'Shopify', 'WooCommerce', 'ERPNext', 'Odoo', 'Zoho', 
  'HubSpot', 'Salesforce', 'Google Sheets', 'Custom REST API', 
  'Custom GraphQL API', 'Other'
];

export default function DeveloperCenter() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('keys');

  // --- API KEYS STATE ---
  const [keys, setKeys] = useState([]);
  const [keysLoading, setKeysLoading] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState(null);
  const [keyForm, setKeyForm] = useState({
    name: '',
    description: '',
    environment: 'Live',
    allowedIps: '',
    rateLimitCount: 60,
    expiryDate: '',
    permissions: {}
  });

  // --- WEBHOOKS STATE ---
  const [endpoints, setEndpoints] = useState([]);
  const [endpointsLoading, setEndpointsLoading] = useState(false);
  const [endpointModalOpen, setEndpointModalOpen] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState(null);
  const [epForm, setEpForm] = useState({
    name: '',
    url: '',
    description: '',
    events: []
  });

  const [webhookLogs, setWebhookLogs] = useState([]);
  const [webhookLogsLoading, setWebhookLogsLoading] = useState(false);
  const [webhookLogsPage, setWebhookLogsPage] = useState(1);
  const [webhookLogsPages, setWebhookLogsPages] = useState(1);

  // --- INTEGRATIONS STATE ---
  const [connections, setConnections] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [connForm, setConnForm] = useState({
    name: '',
    platformType: 'Custom REST API',
    baseUrl: '',
    username: '',
    password: '',
    apiKey: '',
    apiSecret: '',
    bearerToken: '',
    syncFrequency: 'Manual',
    syncDirection: 'Import',
    conflictStrategy: 'Latest',
    notes: ''
  });

  // --- ANALYTICS STATE ---
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // --- AUDIT LOGS STATE ---
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPages, setAuditPages] = useState(1);
  const [auditSearch, setAuditSearch] = useState('');

  // --- PLAYGROUND STATE ---
  const [playgroundMethod, setPlaygroundMethod] = useState('GET');
  const [playgroundPath, setPlaygroundPath] = useState('/products');
  const [playgroundApiKey, setPlaygroundApiKey] = useState('');
  const [playgroundPayload, setPlaygroundPayload] = useState('{\n  "name": "Organic Honey Malt 500g",\n  "sku": "ORG-MALT-500",\n  "price": 320\n}');
  const [playgroundResponse, setPlaygroundResponse] = useState(null);
  const [playgroundLoading, setPlaygroundLoading] = useState(false);

  const developerBaseUrl = window.location.origin + '/api/external';

  // --- ACTIONS & DATA LOADERS ---
  
  const loadKeys = async () => {
    setKeysLoading(true);
    try {
      const { data } = await integrationsApi.getCredentials();
      if (data.success) {
        setKeys(data.credentials || []);
      }
    } catch {
      toast('Failed to load Developer API keys.', 'error');
    } finally {
      setKeysLoading(false);
    }
  };

  const loadEndpoints = async () => {
    setEndpointsLoading(true);
    try {
      const { data } = await developerApi.listWebhookEndpoints();
      if (data.success) {
        setEndpoints(data.endpoints || []);
      }
    } catch {
      toast('Failed to load webhook endpoints.', 'error');
    } finally {
      setEndpointsLoading(false);
    }
  };

  const loadWebhookLogs = async () => {
    setWebhookLogsLoading(true);
    try {
      const { data } = await developerApi.listWebhookLogs({ page: webhookLogsPage, limit: 10 });
      if (data.success) {
        setWebhookLogs(data.data || []);
        setWebhookLogsPages(data.pagination?.pages || 1);
      }
    } catch {
      toast('Failed to load webhook logs.', 'error');
    } finally {
      setWebhookLogsLoading(false);
    }
  };

  const loadConnections = async () => {
    setConnectionsLoading(true);
    try {
      const { data } = await integrationsApi.list();
      if (data.success) {
        setConnections(data.connections || []);
      }
    } catch {
      toast('Failed to load marketplace connections.', 'error');
    } finally {
      setConnectionsLoading(false);
    }
  };

  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      const { data } = await developerApi.getAnalytics();
      if (data.success) {
        setAnalytics(data.stats);
      }
    } catch {
      toast('Failed to load traffic analytics.', 'error');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    setAuditLoading(true);
    try {
      const params = { page: auditPage, limit: 10 };
      if (auditSearch) params.search = auditSearch;
      const { data } = await developerApi.getAuditLogs(params);
      if (data.success) {
        setAuditLogs(data.data || []);
        setAuditPages(data.pagination?.pages || 1);
      }
    } catch {
      toast('Failed to load audit logs.', 'error');
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'keys') loadKeys();
    if (activeTab === 'webhooks') {
      loadEndpoints();
      loadWebhookLogs();
    }
    if (activeTab === 'sync') loadConnections();
    if (activeTab === 'analytics') loadAnalytics();
    if (activeTab === 'audits') loadAuditLogs();
    if (activeTab === 'docs' && keys.length > 0 && !playgroundApiKey) {
      setPlaygroundApiKey(keys[0].apiKey);
    }
  }, [activeTab, webhookLogsPage, auditPage, auditSearch]);

  // --- HANDLERS ---

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!keyForm.name) {
      toast('Client Name is required.', 'error');
      return;
    }
    try {
      const { data } = await integrationsApi.createCredential(keyForm);
      if (data.success) {
        toast('✓ API key generated successfully.', 'success');
        setNewlyCreatedKey(data.credential);
        setKeyForm({
          name: '',
          description: '',
          environment: 'Live',
          allowedIps: '',
          rateLimitCount: 60,
          expiryDate: '',
          permissions: {}
        });
        loadKeys();
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to generate key.', 'error');
    }
  };

  const handleRevokeKey = async (id) => {
    if (!confirm('Are you sure you want to revoke this developer API key? External systems using it will be blocked immediately.')) return;
    try {
      const { data } = await integrationsApi.deleteCredential(id);
      if (data.success) {
        toast('✓ API Key revoked successfully.', 'success');
        loadKeys();
      }
    } catch {
      toast('Failed to revoke key.', 'error');
    }
  };

  const handleRegenerateKey = async (id) => {
    if (!confirm('Are you sure you want to rotate credentials? Old API and webhook secret keys will cease to function.')) return;
    try {
      const { data } = await integrationsApi.regenerateCredential(id);
      if (data.success) {
        toast('✓ API credentials rotated successfully.', 'success');
        setNewlyCreatedKey(data.credential);
        loadKeys();
      }
    } catch {
      toast('Failed to rotate credentials.', 'error');
    }
  };

  const handleToggleKeyPermission = (moduleName, level) => {
    setKeyForm(prev => {
      const permissions = { ...prev.permissions };
      const current = permissions[moduleName] || [];
      if (current.includes(level)) {
        permissions[moduleName] = current.filter(x => x !== level);
      } else {
        permissions[moduleName] = [...current, level];
      }
      return { ...prev, permissions };
    });
  };

  const handleSaveEndpoint = async (e) => {
    e.preventDefault();
    if (!epForm.name || !epForm.url) {
      toast('Name and Endpoint URL are required.', 'error');
      return;
    }
    try {
      if (editingEndpoint) {
        const { data } = await developerApi.updateWebhookEndpoint(editingEndpoint.id, epForm);
        if (data.success) {
          toast('✓ Webhook Endpoint updated successfully.', 'success');
          setEndpointModalOpen(false);
          loadEndpoints();
        }
      } else {
        const { data } = await developerApi.createWebhookEndpoint(epForm);
        if (data.success) {
          toast('✓ Webhook Endpoint registered successfully.', 'success');
          setEndpointModalOpen(false);
          loadEndpoints();
        }
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save endpoint.', 'error');
    }
  };

  const handleDeleteEndpoint = async (id) => {
    if (!confirm('Are you sure you want to delete this webhook endpoint registration?')) return;
    try {
      const { data } = await developerApi.deleteWebhookEndpoint(id);
      if (data.success) {
        toast('✓ Webhook endpoint deleted.', 'success');
        loadEndpoints();
      }
    } catch {
      toast('Failed to delete webhook endpoint.', 'error');
    }
  };

  const handleRetryWebhook = async (id) => {
    toast('Scheduling delivery retry...', 'info');
    try {
      const { data } = await developerApi.retryWebhookLog(id);
      if (data.success) {
        toast('✓ Webhook delivery retry completed.', 'success');
        loadWebhookLogs();
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to dispatch webhook retry.', 'error');
    }
  };

  const handleSaveConnection = async (e) => {
    e.preventDefault();
    if (!connForm.name || !connForm.baseUrl) {
      toast('Connection Name and Base URL are required.', 'error');
      return;
    }
    try {
      if (editingConnection) {
        const { data } = await integrationsApi.update(editingConnection.id, connForm);
        if (data.success) {
          toast('✓ Connectors configurations saved.', 'success');
          setConnectionModalOpen(false);
          loadConnections();
        }
      } else {
        const { data } = await integrationsApi.create(connForm);
        if (data.success) {
          toast('✓ Connector registered successfully.', 'success');
          setConnectionModalOpen(false);
          loadConnections();
        }
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save connector.', 'error');
    }
  };

  const handleSyncConnection = async (id) => {
    toast('Sync job enqueued to background...', 'info');
    try {
      const { data } = await integrationsApi.sync({ id, entityTypes: ['Product', 'Customer', 'Order'] });
      if (data.success) {
        toast('⚡ Sync cycle completed successfully.', 'success');
        loadConnections();
      }
    } catch {
      toast('Sync failed or rejected by platform.', 'error');
    }
  };

  const handlePlaygroundSend = async () => {
    setPlaygroundLoading(true);
    setPlaygroundResponse(null);
    try {
      const url = developerBaseUrl + playgroundPath;
      const headers = { 'X-API-KEY': playgroundApiKey };
      
      let res;
      if (playgroundMethod === 'GET') {
        const fullUrl = new URL(url);
        res = await fetch(fullUrl, { headers });
      } else {
        res = await fetch(url, {
          method: playgroundMethod,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: playgroundPayload
        });
      }

      const status = res.status;
      const data = await res.json();
      setPlaygroundResponse({ status, body: data });
    } catch (err) {
      setPlaygroundResponse({ status: 500, body: { success: false, error: err.message } });
    } finally {
      setPlaygroundLoading(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast('Copied to clipboard!', 'success');
  };

  return (
    <div className="page animate-fade-in" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif', backgroundColor: '#f8fafc' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem' }}>
        <div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            🛠️ Developer Center
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#64748b', marginTop: '0.35rem', margin: 0 }}>
            Establish client gateways, configure secure webhook receivers, and view logs for connected applications.
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* SIDE MENU */}
        <div style={{ 
          flex: '0 0 240px', 
          backgroundColor: '#fff', 
          borderRadius: '12px', 
          border: '1px solid #e2e8f0', 
          padding: '0.75rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem'
        }}>
          {[
            { id: 'keys', label: 'API Credentials', icon: Key },
            { id: 'webhooks', label: 'Webhooks Receiver', icon: Webhook },
            { id: 'sync', label: 'Sync Marketplace', icon: Sliders },
            { id: 'analytics', label: 'Gateway Analytics', icon: BarChart3 },
            { id: 'docs', label: 'Interactive Portal & Docs', icon: BookOpen },
            { id: 'audits', label: 'Gateway Access Logs', icon: History }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  border: 'none',
                  background: activeTab === tab.id ? 'linear-gradient(135deg, #5a2d0c, #401e07)' : 'transparent',
                  color: activeTab === tab.id ? '#fff' : '#475569',
                  textAlign: 'left',
                  padding: '0.75rem 1rem',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* DETAILS SECTION */}
        <div style={{ flex: '1', minWidth: '320px' }}>
          
          {/* ==================== 1. API CREDENTIALS TABS ==================== */}
          {activeTab === 'keys' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Creator Widget */}
              <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>🔑 Generate API Developer Credentials</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
                  Create environment-scoped tokens with granular module level permissions.
                </p>

                <form onSubmit={handleCreateKey} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Client App / System Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Android SFA Logistics"
                        value={keyForm.name}
                        onChange={e => setKeyForm({ ...keyForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Description</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Purpose of this credential"
                        value={keyForm.description}
                        onChange={e => setKeyForm({ ...keyForm, description: e.target.value })}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Environment Scope</label>
                      <select
                        className="form-control"
                        value={keyForm.environment}
                        onChange={e => setKeyForm({ ...keyForm, environment: e.target.value })}
                      >
                        <option value="Live">🟢 Live (ao_live_...)</option>
                        <option value="Test">🟡 Test Sandbox (ao_test_...)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Allowed Client IPs (comma separated)</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 192.168.1.100 or *"
                        value={keyForm.allowedIps}
                        onChange={e => setKeyForm({ ...keyForm, allowedIps: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>Global Rate Limit (req/min)</label>
                      <input
                        type="number"
                        className="form-control"
                        value={keyForm.rateLimitCount}
                        onChange={e => setKeyForm({ ...keyForm, rateLimitCount: Number(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* Permissions Selection Grid */}
                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginTop: '0.5rem' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155' }}>🔒 Set Granular Access Permissions Matrix</span>
                    </div>
                    <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {modulesList.map(mod => (
                        <div key={mod} style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '1rem', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>{mod}</span>
                          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {permissionLevels.map(lvl => {
                              const active = (keyForm.permissions[mod] || []).includes(lvl);
                              return (
                                <button
                                  key={lvl}
                                  type="button"
                                  onClick={() => handleToggleKeyPermission(mod, lvl)}
                                  style={{
                                    border: 'none',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.75rem',
                                    fontWeight: 650,
                                    cursor: 'pointer',
                                    backgroundColor: active ? '#5a2d0c' : '#f1f5f9',
                                    color: active ? '#fff' : '#64748b',
                                    transition: 'all 0.1s'
                                  }}
                                >
                                  {lvl}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', alignSelf: 'flex-end', fontWeight: 750, height: '42px', minWidth: '160px', background: 'linear-gradient(135deg, #5a2d0c, #401e07)' }}>
                    <Key size={16} />
                    <span>Generate API Key</span>
                  </button>
                </form>

                {/* Secure key generation display */}
                {newlyCreatedKey && (
                  <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: '#fff9db', border: '1px solid #ffd8a8', borderRadius: '8px', color: '#854000' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <AlertTriangle size={18} style={{ color: '#e28743' }} />
                      <strong style={{ fontSize: '0.9rem' }}>Copy and save these keys immediately. For security, they will not be shown again.</strong>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                        <span style={{ wordBreak: 'break-all' }}><strong>X-API-KEY / Token:</strong> <code style={{ color: '#0f172a' }}>{newlyCreatedKey.apiKey}</code></span>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(newlyCreatedKey.apiKey)} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Copy size={12} />
                          <span>Copy</span>
                        </button>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                        <span style={{ wordBreak: 'break-all' }}><strong>Webhook Secret:</strong> <code style={{ color: '#0f172a' }}>{newlyCreatedKey.webhookSecret || newlyCreatedKey.apiSecret}</code></span>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyToClipboard(newlyCreatedKey.webhookSecret || newlyCreatedKey.apiSecret)} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                          <Copy size={12} />
                          <span>Copy</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* API Keys List */}
              <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.25rem' }}>🗝️ Active Client API Credentials</h3>
                
                {keysLoading ? <LoadingSpinner /> : keys.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>No credentials found. Generate one above.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Client App / Creator</th>
                          <th>Scope</th>
                          <th>Key Identifier</th>
                          <th>Permissions</th>
                          <th>Allowed IPs</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {keys.map(k => (
                          <tr key={k.id}>
                            <td>
                              <div><strong>{k.name}</strong></div>
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Created by: {k.createdBy || 'Admin'}</span>
                            </td>
                            <td>
                              <span style={{
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                backgroundColor: k.environment === 'Live' ? '#dcfce7' : '#fef9c3',
                                color: k.environment === 'Live' ? '#16a34a' : '#a16207'
                              }}>{k.environment}</span>
                            </td>
                            <td><code style={{ fontSize: '0.75rem' }}>{k.apiKey?.substring(0, 15)}...</code></td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', maxWidth: '200px' }}>
                                {Object.keys(k.permissions || {}).length === 0 ? (
                                  <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Full Access</span>
                                ) : (
                                  Object.keys(k.permissions).slice(0, 3).map(mod => (
                                    <span key={mod} style={{ backgroundColor: '#f1f5f9', color: '#475569', padding: '0.1rem 0.3rem', borderRadius: '3px', fontSize: '0.7rem' }}>
                                      {mod}
                                    </span>
                                  ))
                                )}
                                {Object.keys(k.permissions || {}).length > 3 && (
                                  <span style={{ color: '#64748b', fontSize: '0.7rem' }}>+{Object.keys(k.permissions).length - 3} more</span>
                                )}
                              </div>
                            </td>
                            <td><code>{k.allowedIps || '*'}</code></td>
                            <td>
                              <span style={{
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                backgroundColor: k.status === 'Active' ? '#dcfce7' : '#fee2e2',
                                color: k.status === 'Active' ? '#16a34a' : '#dc2626'
                              }}>{k.status}</span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRegenerateKey(k.id)} title="Rotate secret tokens">
                                  <RefreshCw size={12} />
                                </button>
                                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRevokeKey(k.id)} title="Revoke access immediately">
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 2. WEBHOOK RECEIVER TABS ==================== */}
          {activeTab === 'webhooks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Registered Receivers */}
              <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>🔌 Webhook Subscriptions</h3>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Register external endpoints to listen to system events.</p>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEditingEndpoint(null);
                      setEpForm({ name: '', url: '', description: '', events: [] });
                      setEndpointModalOpen(true);
                    }}
                  >
                    ➕ Register URL
                  </button>
                </div>

                {endpointsLoading ? <LoadingSpinner /> : endpoints.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>No webhook receiver endpoints configured.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                    {endpoints.map(ep => (
                      <div key={ep.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', position: 'relative', display: 'flex', flexDirection: 'column', justifyBetween: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <strong style={{ fontSize: '1rem', color: '#334155' }}>{ep.name}</strong>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              backgroundColor: ep.status === 'Active' ? '#dcfce7' : '#fee2e2',
                              color: ep.status === 'Active' ? '#16a34a' : '#dc2626'
                            }}>{ep.status}</span>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0', wordBreak: 'break-all' }}>
                            <strong>URL:</strong> <code>{ep.url}</code>
                          </p>
                          {ep.description && (
                            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '0.25rem 0' }}>{ep.description}</p>
                          )}
                          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
                            {ep.events.slice(0, 4).map(ev => (
                              <span key={ev} style={{ fontSize: '0.7rem', backgroundColor: '#eff6ff', color: '#1e40af', padding: '0.15rem 0.35rem', borderRadius: '4px', fontWeight: 650 }}>
                                {ev}
                              </span>
                            ))}
                            {ep.events.length > 4 && (
                              <span style={{ fontSize: '0.7rem', backgroundColor: '#f1f5f9', color: '#475569', padding: '0.15rem 0.35rem', borderRadius: '4px' }}>
                                +{ep.events.length - 4} more
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', marginTop: '1rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingEndpoint(ep);
                              setEpForm({
                                name: ep.name,
                                url: ep.url,
                                description: ep.description || '',
                                events: ep.events
                              });
                              setEndpointModalOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            style={{ marginLeft: 'auto' }}
                            onClick={() => handleDeleteEndpoint(ep.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery logs */}
              <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.25rem' }}>📋 Webhook Queue & Deliveries</h3>
                
                {webhookLogsLoading ? <LoadingSpinner /> : webhookLogs.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>No webhook events triggered yet.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Event</th>
                          <th>Receiver ID</th>
                          <th>Response Status</th>
                          <th>Attempt</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {webhookLogs.map(l => (
                          <tr key={l.id}>
                            <td>{new Date(l.createdAt).toLocaleString()}</td>
                            <td><strong>{l.event}</strong></td>
                            <td>Endpoint #{l.endpointId}</td>
                            <td>
                              <span style={{ fontWeight: 'bold', color: l.responseStatus >= 200 && l.responseStatus < 300 ? '#16a34a' : '#dc2626' }}>
                                {l.responseStatus || '—'}
                              </span>
                            </td>
                            <td>{l.attempt}</td>
                            <td>
                              <span style={{
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                backgroundColor: l.status === 'Success' ? '#dcfce7' : l.status === 'Retrying' ? '#fef9c3' : '#fee2e2',
                                color: l.status === 'Success' ? '#16a34a' : l.status === 'Retrying' ? '#a16207' : '#dc2626'
                              }}>{l.status}</span>
                            </td>
                            <td>
                              {l.status !== 'Success' && (
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRetryWebhook(l.id)} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <RefreshCw size={12} />
                                  <span>Retry</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {webhookLogsPages > 1 && (
                      <div style={{ marginTop: '1rem' }}>
                        <Pagination
                          current={webhookLogsPage}
                          pages={webhookLogsPages}
                          onChange={setWebhookLogsPage}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 3. SYNC MARKETPLACE ==================== */}
          {activeTab === 'sync' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>🔌 Native SaaS Connectors Marketplace</h3>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>Configure integrations, bidirectional syncing frequencies, and conflict resolutions.</p>
                  </div>
                  <button 
                    type="button" 
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setEditingConnection(null);
                      setConnForm({
                        name: '',
                        platformType: 'Custom REST API',
                        baseUrl: '',
                        username: '',
                        password: '',
                        apiKey: '',
                        apiSecret: '',
                        bearerToken: '',
                        syncFrequency: 'Manual',
                        syncDirection: 'Import',
                        conflictStrategy: 'Latest',
                        notes: ''
                      });
                      setConnectionModalOpen(true);
                    }}
                  >
                    ➕ Register App
                  </button>
                </div>

                {connectionsLoading ? <LoadingSpinner /> : connections.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>No registered connectors configured yet.</p>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
                    {connections.map(conn => (
                      <div key={conn.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.01)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                          <div>
                            <strong style={{ fontSize: '1.05rem', color: '#1e293b' }}>{conn.name}</strong>
                            <div style={{ fontSize: '0.75rem', backgroundColor: '#eff6ff', color: '#1e40af', padding: '0.1rem 0.35rem', borderRadius: '4px', display: 'inline-block', marginTop: '0.25rem', fontWeight: 700 }}>
                              {conn.platformType}
                            </div>
                          </div>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            backgroundColor: conn.connectionStatus === 'Connected' ? '#dcfce7' : '#fee2e2',
                            color: conn.connectionStatus === 'Connected' ? '#16a34a' : '#dc2626'
                          }}>{conn.connectionStatus || 'Disconnected'}</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: '#475569', margin: '0.75rem 0' }}>
                          <div><strong>Base Endpoint:</strong> <code style={{ wordBreak: 'break-all', fontSize: '0.75rem' }}>{conn.baseUrl}</code></div>
                          <div><strong>Direction:</strong> {conn.syncDirection || 'Import'}</div>
                          <div><strong>Strategy:</strong> {conn.conflictStrategy || 'Latest'}</div>
                          <div><strong>Frequency:</strong> {conn.syncFrequency || 'Manual'}</div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleSyncConnection(conn.id)}
                          >
                            ⚡ Sync Now
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingConnection(conn);
                              setConnForm({ ...conn, password: '', apiKey: '', apiSecret: '', bearerToken: '' });
                              setConnectionModalOpen(true);
                            }}
                          >
                            Configure
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== 4. TRAFFIC ANALYTICS TABS ==================== */}
          {activeTab === 'analytics' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Traffic Overview Counters */}
              {analyticsLoading ? <LoadingSpinner /> : analytics && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                    {[
                      { label: 'Total Requests', value: analytics.totalRequests, icon: '🔥', color: '#3b82f6' },
                      { label: 'Success Rate', value: `${analytics.successPct}%`, icon: '🟢', color: '#10b981' },
                      { label: 'Failed %', value: `${analytics.failedPct}%`, icon: '🔴', color: '#ef4444' },
                      { label: 'Avg Latency', value: `${analytics.averageResponse}ms`, icon: '⚡', color: '#f59e0b' }
                    ].map((card, idx) => (
                      <div key={idx} style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                        <div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>{card.label}</span>
                          <strong style={{ fontSize: '1.35rem', color: '#0f172a', display: 'block', marginTop: '0.25rem' }}>{card.value}</strong>
                        </div>
                        <span style={{ fontSize: '1.75rem' }}>{card.icon}</span>
                      </div>
                    ))}
                  </div>

                  {/* Recharts graph */}
                  <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: '1.5rem' }}>📈 API Request Traffic Trends</h4>
                    <div style={{ width: '100%', height: 260 }}>
                      {analytics.dailyTraffic?.length > 0 ? (
                        <ResponsiveContainer>
                          <AreaChart data={analytics.dailyTraffic}>
                            <defs>
                              <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#5a2d0c" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#5a2d0c" stopOpacity={0.01}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="dateStr" stroke="#64748b" style={{ fontSize: '0.75rem' }} />
                            <YAxis stroke="#64748b" style={{ fontSize: '0.75rem' }} />
                            <Tooltip />
                            <Area type="monotone" dataKey="reqCount" stroke="#5a2d0c" strokeWidth={2.5} fillOpacity={1} fill="url(#colorTraffic)" name="Requests" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div style={{ textAlign: 'center', color: '#94a3b8', paddingTop: '4rem' }}>No data logged. Start hitting developer endpoints.</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                    
                    {/* Top Endpoints */}
                    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', marginBottom: '1rem' }}>🔥 Top Requested APIs</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {analytics.topApis?.map((api, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                            <span style={{ fontFamily: 'monospace' }}>
                              <span style={{
                                fontWeight: 'bold',
                                color: api.method === 'GET' ? '#2563eb' : '#10b981',
                                paddingRight: '0.4rem'
                              }}>{api.method}</span>
                              {api.endpoint.split('?')[0]}
                            </span>
                            <strong style={{ color: '#334155' }}>{api.reqCount}</strong>
                          </div>
                        ))}
                        {(!analytics.topApis || analytics.topApis.length === 0) && (
                          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No traffic logs recorded.</span>
                        )}
                      </div>
                    </div>

                    {/* Top Consumers */}
                    <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#1e293b', marginBottom: '1rem' }}>🗝️ Top API Consumers</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {analytics.topConsumers?.map((c, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                            <span style={{ fontWeight: 650, color: '#475569' }}>{c.keyName}</span>
                            <strong style={{ color: '#334155' }}>{c.reqCount} requests</strong>
                          </div>
                        ))}
                        {(!analytics.topConsumers || analytics.topConsumers.length === 0) && (
                          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>No consumer analytics.</span>
                        )}
                      </div>
                    </div>

                  </div>
                </>
              )}
            </div>
          )}

          {/* ==================== 5. DOCS & API PLAYGROUND ==================== */}
          {activeTab === 'docs' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* SDK & Libraries Download card */}
              <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b' }}>📲 Download Mobile & Web SDKs</h3>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', margin: 0 }}>
                    Quickly integrate external tools using prebuilt SDK packages.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['Flutter SDK', 'React Native', 'PHP SDK'].map(sdk => (
                    <button
                      key={sdk}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700 }}
                      onClick={() => toast(`✓ Downloader initialized for ${sdk} template package.`, 'success')}
                    >
                      <Download size={12} />
                      <span>{sdk}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Documentation registry list */}
              <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 850, color: '#1e293b', marginBottom: '0.25rem' }}>📖 Developer Endpoint Registry</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>
                  Authentication header format: <code>Authorization: Bearer &lt;API_KEY&gt;</code> or <code>X-API-KEY: &lt;API_KEY&gt;</code>
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { method: 'GET', path: '/products', desc: 'Query ERP products catalog, stock counts, and prices.' },
                    { method: 'POST', path: '/products', desc: 'Create a new catalog product.', body: '{\n  "name": "New Organic Product",\n  "sku": "ORG-SKU-99",\n  "sellingPrice": 450,\n  "stock": 100\n}' },
                    { method: 'POST', path: '/order/create', desc: 'Create sales orders inside ERP queue.', body: '{\n  "customerName": "Narpavi Store",\n  "amount": 2500,\n  "items": []\n}' },
                    { method: 'GET', path: '/outstanding', desc: 'Get customer outstanding calculations. (Params: ?customer=Customer+Name)' },
                    { method: 'POST', path: '/whatsapp/send', desc: 'Send templates or custom messages.', body: '{\n  "phone": "917010602115",\n  "message": "Custom reminder"\n}' }
                  ].map((api, idx) => (
                    <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', backgroundColor: '#f8fafc' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: 800,
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: api.method === 'GET' ? '#eff6ff' : '#ecfdf5',
                          color: api.method === 'GET' ? '#2563eb' : '#10b981'
                        }}>{api.method}</span>
                        <code style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{developerBaseUrl}{api.path}</code>
                        <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', padding: '0.15rem 0.4rem', fontSize: '0.75rem' }} onClick={() => copyToClipboard(developerBaseUrl + api.path)}>Copy Endpoint</button>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.5rem', marginBottom: api.body ? '0.5rem' : 0 }}>{api.desc}</p>
                      {api.body && (
                        <pre style={{ margin: 0, padding: '0.5rem', backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', fontFamily: 'monospace' }}>
                          {api.body}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Interactive playground */}
              <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.01)' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.25rem' }}>🎮 API Interactive Playground</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.25rem' }}>Send real requests to external endpoints and check responses.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 180px', gap: '0.75rem' }}>
                    <select
                      className="form-control"
                      value={playgroundMethod}
                      onChange={e => setPlaygroundMethod(e.target.value)}
                    >
                      <option value="GET">GET</option>
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                      <option value="DELETE">DELETE</option>
                    </select>

                    <input
                      type="text"
                      className="form-control"
                      value={playgroundPath}
                      onChange={e => setPlaygroundPath(e.target.value)}
                      placeholder="/products"
                    />

                    <select
                      className="form-control"
                      value={playgroundApiKey}
                      onChange={e => setPlaygroundApiKey(e.target.value)}
                    >
                      <option value="">Select API Key</option>
                      {keys.map(k => <option key={k.id} value={k.apiKey}>{k.name}</option>)}
                    </select>
                  </div>

                  {playgroundMethod !== 'GET' && (
                    <div className="form-group">
                      <label className="form-label" style={{ fontWeight: 700, fontSize: '0.8rem' }}>JSON Payload Body</label>
                      <textarea
                        className="form-control"
                        rows={5}
                        style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                        value={playgroundPayload}
                        onChange={e => setPlaygroundPayload(e.target.value)}
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ alignSelf: 'flex-start', fontWeight: 750 }}
                    onClick={handlePlaygroundSend}
                    disabled={playgroundLoading || !playgroundApiKey}
                  >
                    {playgroundLoading ? 'Sending Request...' : '🚀 Execute API Call'}
                  </button>

                  {playgroundResponse && (
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginTop: '0.5rem' }}>
                      <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem 1rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span>Response Body</span>
                        <span style={{ fontWeight: 'bold', color: playgroundResponse.status >= 200 && playgroundResponse.status < 300 ? '#16a34a' : '#dc2626' }}>
                          Status: {playgroundResponse.status}
                        </span>
                      </div>
                      <pre style={{ margin: 0, padding: '1rem', backgroundColor: '#0f172a', color: '#38bdf8', fontSize: '0.8rem', overflowX: 'auto', maxHeight: '300px' }}>
                        {JSON.stringify(playgroundResponse.body, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ==================== 6. ACCESS AUDIT LOGS ==================== */}
          {activeTab === 'audits' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              <div style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.5rem', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#1e293b' }}>📋 Gateway Audit Logs Center</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem', marginBottom: '1.25rem' }}>
                  Track requests, response latency, device tags, and diagnostic error codes.
                </p>

                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ margin: 0, maxWidth: '300px' }}
                    placeholder="Search logs (client name, IP, etc.)"
                    value={auditSearch}
                    onChange={e => { setAuditSearch(e.target.value); setAuditPage(1); }}
                  />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={loadAuditLogs} style={{ marginLeft: 'auto' }}>
                    🔄 Refresh Grid
                  </button>
                </div>

                {auditLoading ? <LoadingSpinner /> : auditLogs.length === 0 ? (
                  <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>No access audits recorded.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>API Key / App</th>
                          <th>Method / Route</th>
                          <th>Status</th>
                          <th>Latency</th>
                          <th>IP Address</th>
                          <th>Device</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditLogs.map(l => (
                          <tr key={l.id}>
                            <td>{new Date(l.createdAt).toLocaleString()}</td>
                            <td>
                              <div><strong>{l.keyName || 'Public/Unknown'}</strong></div>
                              <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase' }}>{l.environment}</span>
                            </td>
                            <td>
                              <span style={{
                                fontSize: '0.75rem',
                                fontWeight: 800,
                                paddingRight: '0.4rem',
                                color: l.method === 'GET' ? '#2563eb' : '#10b981'
                              }}>{l.method}</span>
                              <code style={{ fontSize: '0.75rem' }}>{l.endpoint.split('?')[0]}</code>
                            </td>
                            <td>
                              <span style={{
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                backgroundColor: l.status >= 200 && l.status < 300 ? '#dcfce7' : '#fee2e2',
                                color: l.status >= 200 && l.status < 300 ? '#16a34a' : '#dc2626'
                              }}>{l.status}</span>
                            </td>
                            <td>{l.duration}ms</td>
                            <td><code>{l.ipAddress || '—'}</code></td>
                            <td>{l.device || 'Desktop'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {auditPages > 1 && (
                      <div style={{ marginTop: '1rem' }}>
                        <Pagination
                          current={auditPage}
                          pages={auditPages}
                          onChange={setAuditPage}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* ==================== WEBHOOK MODAL (NEW/EDIT) ==================== */}
      {endpointModalOpen && (
        <Modal
          title={editingEndpoint ? '⚙️ Edit Webhook Endpoint' : '🔌 Register Webhook URL'}
          onClose={() => setEndpointModalOpen(false)}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setEndpointModalOpen(false)}>Cancel</button>
              <button type="submit" form="ep-form" className="btn btn-primary" style={{ background: 'linear-gradient(135deg, #5a2d0c, #401e07)' }}>Save Receiver</button>
            </div>
          }
        >
          <form id="ep-form" onSubmit={handleSaveEndpoint} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Webhook Client Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Aura CRM Syncer"
                value={epForm.name}
                onChange={e => setEpForm({ ...epForm, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Endpoint URL (Receives POST payloads) *</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://mycrm.com/webhooks/ao-erp"
                value={epForm.url}
                onChange={e => setEpForm({ ...epForm, url: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-control"
                placeholder="Brief purpose details"
                value={epForm.description}
                onChange={e => setEpForm({ ...epForm, description: e.target.value })}
              />
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem 1rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.8rem', fontWeight: 'bold' }}>
                Subscribe to Events
              </div>
              <div style={{ maxHeight: '180px', overflowY: 'auto', padding: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={epForm.events.includes('*')}
                    onChange={(e) => {
                      if (e.target.checked) setEpForm({ ...epForm, events: ['*'] });
                      else setEpForm({ ...epForm, events: [] });
                    }}
                  />
                  <strong>All Events (*)</strong>
                </label>
                {!epForm.events.includes('*') && webhookEventsList.map(ev => {
                  const active = epForm.events.includes(ev);
                  return (
                    <label key={ev} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={(e) => {
                          let updated = [...epForm.events];
                          if (e.target.checked) updated.push(ev);
                          else updated = updated.filter(x => x !== ev);
                          setEpForm({ ...epForm, events: updated });
                        }}
                      />
                      <span>{ev}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* ==================== CONNECTOR MODAL (NEW/EDIT) ==================== */}
      {connectionModalOpen && (
        <Modal
          title={editingConnection ? '⚙️ Edit Connection Settings' : '🔌 Add Integration Connector'}
          onClose={() => setConnectionModalOpen(false)}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setConnectionModalOpen(false)}>Cancel</button>
              <button type="submit" form="conn-form" className="btn btn-primary">Save Settings</button>
            </div>
          }
        >
          <form id="conn-form" onSubmit={handleSaveConnection} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Connection Title *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. My WooCommerce Website"
                  value={connForm.name}
                  onChange={e => setConnForm({ ...connForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Platform Type *</label>
                <select
                  className="form-control"
                  value={connForm.platformType}
                  onChange={e => setConnForm({ ...connForm, platformType: e.target.value })}
                >
                  {platformOptions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Base API URL *</label>
              <input
                type="url"
                className="form-control"
                placeholder="https://myshop.com/wp-json/wc/v3"
                value={connForm.baseUrl}
                onChange={e => setConnForm({ ...connForm, baseUrl: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">API Key / Client ID</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter API Key / consumer key"
                  value={connForm.apiKey}
                  onChange={e => setConnForm({ ...connForm, apiKey: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">API Secret / Client Secret</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter secret / consumer secret"
                  value={connForm.apiSecret}
                  onChange={e => setConnForm({ ...connForm, apiSecret: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Sync Frequency</label>
                <select
                  className="form-control"
                  value={connForm.syncFrequency}
                  onChange={e => setConnForm({ ...connForm, syncFrequency: e.target.value })}
                >
                  <option value="Manual">Manual</option>
                  <option value="Hourly">Hourly</option>
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Realtime">Realtime</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Sync Mode Direction</label>
                <select
                  className="form-control"
                  value={connForm.syncDirection}
                  onChange={e => setConnForm({ ...connForm, syncDirection: e.target.value })}
                >
                  <option value="Import">Import Only (External ➔ ERP)</option>
                  <option value="Export">Export Only (ERP ➔ External)</option>
                  <option value="Bidirectional">Bidirectional Sync</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Conflict Mode</label>
                <select
                  className="form-control"
                  value={connForm.conflictStrategy}
                  onChange={e => setConnForm({ ...connForm, conflictStrategy: e.target.value })}
                >
                  <option value="Latest">Use Latest</option>
                  <option value="ERP">Use ERP Local</option>
                  <option value="External">Use External</option>
                  <option value="Manual">Ask Before Update</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <input
                type="text"
                className="form-control"
                placeholder="Reference details"
                value={connForm.notes}
                onChange={e => setConnForm({ ...connForm, notes: e.target.value })}
              />
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
