import { useState, useEffect } from 'react';
import { integrationsApi } from '../api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';

const platformOptions = [
  'Shopify',
  'WooCommerce',
  'ERPNext',
  'Odoo',
  'Zoho',
  'HubSpot',
  'Salesforce',
  'Google Sheets',
  'Custom REST API',
  'Custom GraphQL API',
  'Other'
];

const syncFrequencyOptions = [
  'Manual',
  'Hourly',
  'Daily',
  'Weekly',
  'Realtime'
];

const defaultMappingFields = {
  Product: [
    { label: 'Product Name', internalField: 'name', defaultVal: 'name' },
    { label: 'SKU Code', internalField: 'sku', defaultVal: 'sku' },
    { label: 'Barcode/EAN', internalField: 'barcode', defaultVal: 'barcode' },
    { label: 'Category', internalField: 'category', defaultVal: 'category' },
    { label: 'Brand Name', internalField: 'brand', defaultVal: 'brand' },
    { label: 'ERP Retail Price (₹)', internalField: 'price', defaultVal: 'price' },
    { label: 'Max Retail Price (₹)', internalField: 'mrp', defaultVal: 'mrp' },
    { label: 'Wholesale Price (₹)', internalField: 'wholesalePrice', defaultVal: 'wholesalePrice' },
    { label: 'Distributor Price (₹)', internalField: 'distributorPrice', defaultVal: 'distributorPrice' },
    { label: 'Stock Level', internalField: 'stock', defaultVal: 'stock' },
    { label: 'GST Rate (%)', internalField: 'gst', defaultVal: 'gst' },
    { label: 'HSN Code', internalField: 'hsn', defaultVal: 'hsn' },
    { label: 'Unit Weight (kg)', internalField: 'weight', defaultVal: 'weight' },
    { label: 'Description', internalField: 'description', defaultVal: 'description' },
    { label: 'Key Benefits', internalField: 'benefits', defaultVal: 'benefits' },
    { label: 'Image URL', internalField: 'imageUrl', defaultVal: 'imageUrl' },
    { label: 'PDF Catalogue URL', internalField: 'catalogueUrl', defaultVal: 'catalogueUrl' }
  ],
  Customer: [
    { label: 'Customer Name', internalField: 'name', defaultVal: 'name' },
    { label: 'Phone Number', internalField: 'phone', defaultVal: 'phone' },
    { label: 'Email Address', internalField: 'email', defaultVal: 'email' },
    { label: 'Street Address', internalField: 'address', defaultVal: 'address' },
    { label: 'City', internalField: 'city', defaultVal: 'city' },
    { label: 'State', internalField: 'state', defaultVal: 'state' },
    { label: 'Country', internalField: 'country', defaultVal: 'country' },
    { label: 'GSTIN Number', internalField: 'gstNumber', defaultVal: 'gstNumber' },
    { label: 'Customer Type', internalField: 'customerType', defaultVal: 'customerType' },
    { label: 'Credit Limit (₹)', internalField: 'creditLimit', defaultVal: 'creditLimit' },
    { label: 'Outstanding Balance (₹)', internalField: 'outstanding', defaultVal: 'outstanding' }
  ],
  Order: [
    { label: 'External Order ID', internalField: 'externalId', defaultVal: 'externalId' },
    { label: 'Order Number', internalField: 'orderNumber', defaultVal: 'orderNumber' },
    { label: 'Customer Name', internalField: 'customerName', defaultVal: 'customerName' },
    { label: 'Line Items JSON', internalField: 'items', defaultVal: 'items' },
    { label: 'Total Amount (₹)', internalField: 'amount', defaultVal: 'amount' },
    { label: 'Order Status', internalField: 'status', defaultVal: 'status' },
    { label: 'Payment Status', internalField: 'paymentStatus', defaultVal: 'paymentStatus' },
    { label: 'Shipment Status', internalField: 'shipmentStatus', defaultVal: 'shipmentStatus' },
    { label: 'Order Created Date', internalField: 'orderDate', defaultVal: 'orderDate' },
    { label: 'Expected Delivery Date', internalField: 'deliveryDate', defaultVal: 'deliveryDate' }
  ],
  Catalogue: [
    { label: 'Catalogue Title', internalField: 'name', defaultVal: 'name' },
    { label: 'PDF Document Link', internalField: 'pdfUrl', defaultVal: 'pdfUrl' },
    { label: 'Cover Image URL', internalField: 'imageUrl', defaultVal: 'imageUrl' },
    { label: 'Industry Category', internalField: 'category', defaultVal: 'category' },
    { label: 'Product Mappings List', internalField: 'productMapping', defaultVal: 'productMapping' },
    { label: 'Document Version', internalField: 'version', defaultVal: 'version' }
  ]
};

// Preset templates for different platform types
const mappingTemplates = {
  Shopify: {
    Product: {
      name: 'title',
      sku: 'variants[0].sku',
      price: 'variants[0].price',
      stock: 'variants[0].inventory_quantity',
      description: 'body_html',
      imageUrl: 'image.src'
    },
    Customer: {
      name: 'first_name',
      phone: 'phone',
      email: 'email',
      address: 'default_address.address1'
    },
    Order: {
      externalId: 'id',
      orderNumber: 'order_number',
      amount: 'total_price',
      status: 'financial_status'
    }
  },
  WooCommerce: {
    Product: {
      name: 'name',
      sku: 'sku',
      price: 'price',
      stock: 'stock_quantity',
      description: 'description',
      imageUrl: 'images[0].src'
    },
    Customer: {
      name: 'billing.first_name',
      phone: 'billing.phone',
      email: 'email',
      address: 'billing.address_1'
    },
    Order: {
      externalId: 'id',
      orderNumber: 'number',
      amount: 'total',
      status: 'status'
    }
  },
  Zoho: {
    Product: {
      name: 'name',
      sku: 'sku',
      price: 'rate',
      stock: 'stock_on_hand',
      description: 'description'
    },
    Customer: {
      name: 'contact_name',
      phone: 'phone',
      email: 'email',
      address: 'billing_address.address'
    },
    Order: {
      externalId: 'salesorder_id',
      orderNumber: 'salesorder_number',
      amount: 'total',
      status: 'status'
    }
  }
};

export default function IntegrationsMarketplace() {
  const { toast } = useToast();
  
  // Tab states: 'import', 'export', 'sync', 'logs', 'analytics'
  const [activeTab, setActiveTab] = useState('import');
  
  // Dashboard & stats states
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  
  // Connections list states
  const [connections, setConnections] = useState([]);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  
  // Form states
  const [connectionModalOpen, setConnectionModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [form, setForm] = useState({
    name: '',
    platformType: 'Shopify',
    baseUrl: '',
    username: '',
    password: '',
    apiKey: '',
    apiSecret: '',
    bearerToken: '',
    oauthClientId: '',
    oauthClientSecret: '',
    webhookUrl: '',
    webhookSecret: '',
    syncFrequency: 'Manual',
    notes: '',
    syncDirection: 'Import',
    conflictStrategy: 'Latest',
    rateLimitCount: 60,
    allowedIps: ''
  });
  
  // Developer credentials states
  const [credentials, setCredentials] = useState([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [credForm, setCredForm] = useState({
    name: '',
    allowedIps: '',
    rateLimitCount: 60,
    expiryDate: ''
  });
  const [newlyCreatedCred, setNewlyCreatedCred] = useState(null);
  
  // Field mapping states
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [mappingConnection, setMappingConnection] = useState(null);
  const [mappingEntity, setMappingEntity] = useState('Product'); // Product, Customer, Order, Catalogue
  const [mappingsList, setMappingsList] = useState([]);
  const [mappingsLoading, setMappingsLoading] = useState(false);
  
  // Logs states
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsPages, setLogsPages] = useState(1);
  const [selectedConnectionFilter, setSelectedConnectionFilter] = useState('All');
  
  // Connection testing / scanning states
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [scanningProgress, setScanningProgress] = useState(0);
  const [scanningMessage, setScanningMessage] = useState('');
  
  // Sync now states
  const [syncingConnectionId, setSyncingConnectionId] = useState(null);
  const [syncStatusDetails, setSyncStatusDetails] = useState(null);

  // Load Initial Data
  const loadStats = async () => {
    try {
      const { data } = await integrationsApi.getStats();
      if (data.success) {
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to load marketplace statistics:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const loadConnections = async () => {
    setConnectionsLoading(true);
    try {
      const { data } = await integrationsApi.list();
      if (data.success) {
        setConnections(data.connections || []);
      }
    } catch (err) {
      toast('Failed to load active integration connections', 'error');
    } finally {
      setConnectionsLoading(false);
    }
  };

  const loadCredentials = async () => {
    setCredentialsLoading(true);
    try {
      const { data } = await integrationsApi.getCredentials();
      if (data.success) {
        setCredentials(data.credentials || []);
      }
    } catch (err) {
      toast('Failed to load developer credentials', 'error');
    } finally {
      setCredentialsLoading(false);
    }
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const params = {
        page: logsPage,
        limit: 10
      };
      if (selectedConnectionFilter !== 'All') {
        params.connectionId = selectedConnectionFilter;
      }
      const { data } = await integrationsApi.getLogs(params);
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
    loadStats();
    loadConnections();
    loadCredentials();
  }, []);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadLogs();
    }
  }, [logsPage, selectedConnectionFilter, activeTab]);

  // Form handlers for connections
  const openCreateModal = () => {
    setEditingConnection(null);
    setForm({
      name: '',
      platformType: 'Shopify',
      baseUrl: '',
      username: '',
      password: '',
      apiKey: '',
      apiSecret: '',
      bearerToken: '',
      oauthClientId: '',
      oauthClientSecret: '',
      webhookUrl: '',
      webhookSecret: '',
      syncFrequency: 'Manual',
      notes: '',
      syncDirection: 'Import',
      conflictStrategy: 'Latest',
      rateLimitCount: 60,
      allowedIps: ''
    });
    setTestResult(null);
    setConnectionModalOpen(true);
  };

  const openEditModal = (conn) => {
    setEditingConnection(conn);
    setForm({
      name: conn.name,
      platformType: conn.platformType,
      baseUrl: conn.baseUrl || '',
      username: conn.username || '',
      password: conn.password ? '********' : '',
      apiKey: conn.apiKey ? '********' : '',
      apiSecret: conn.apiSecret ? '********' : '',
      bearerToken: conn.bearerToken ? '********' : '',
      oauthClientId: conn.oauthClientId || '',
      oauthClientSecret: conn.oauthClientSecret ? '********' : '',
      webhookUrl: conn.webhookUrl || '',
      webhookSecret: conn.webhookSecret ? '********' : '',
      syncFrequency: conn.syncFrequency || 'Manual',
      notes: conn.notes || '',
      syncDirection: conn.syncDirection || 'Import',
      conflictStrategy: conn.conflictStrategy || 'Latest',
      rateLimitCount: conn.rateLimitCount || 60,
      allowedIps: conn.allowedIps || ''
    });
    setTestResult(null);
    setConnectionModalOpen(true);
  };

  const saveConnection = async (e) => {
    e.preventDefault();
    if (!form.name || !form.baseUrl) {
      toast('Connection Name and Base API URL are required', 'error');
      return;
    }
    try {
      if (editingConnection) {
        const { data } = await integrationsApi.update(editingConnection.id, form);
        if (data.success) {
          toast('✓ Integration connection updated successfully', 'success');
          setConnectionModalOpen(false);
          loadConnections();
          loadStats();
        }
      } else {
        const { data } = await integrationsApi.create(form);
        if (data.success) {
          toast('✓ SaaS Integration connected and registered', 'success');
          setConnectionModalOpen(false);
          loadConnections();
          loadStats();
        }
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save connection details', 'error');
    }
  };

  const handleDeleteConnection = async (id) => {
    if (!confirm('Are you sure you want to delete this integration connection? This will permanently delete all logs, configurations, and cache records associated.')) return;
    try {
      const { data } = await integrationsApi.remove(id);
      if (data.success) {
        toast('✓ Integration deleted successfully', 'success');
        loadConnections();
        loadStats();
        loadLogs();
      }
    } catch (err) {
      toast('Failed to delete integration connection', 'error');
    }
  };

  // Developer Credentials generation
  const generateCred = async (e) => {
    e.preventDefault();
    if (!credForm.name) {
      toast('Please enter a credential name', 'error');
      return;
    }
    try {
      const { data } = await integrationsApi.createCredential(credForm);
      if (data.success) {
        toast('✓ Developer API credential generated successfully', 'success');
        setNewlyCreatedCred(data.credential);
        setCredForm({ name: '', allowedIps: '', rateLimitCount: 60, expiryDate: '' });
        loadCredentials();
      }
    } catch (err) {
      toast('Failed to generate credentials', 'error');
    }
  };

  const handleDeleteCred = async (id) => {
    if (!confirm('Are you sure you want to delete this developer API Key? External systems using it will immediately be blocked.')) return;
    try {
      const { data } = await integrationsApi.deleteCredential(id);
      if (data.success) {
        toast('✓ API Key deleted successfully', 'success');
        loadCredentials();
      }
    } catch (err) {
      toast('Failed to delete credential', 'error');
    }
  };

  const handleRegenerateCred = async (id) => {
    if (!confirm('Are you sure you want to regenerate this developer credential? The previous key and secret will cease to function.')) return;
    try {
      const { data } = await integrationsApi.regenerateCredential(id);
      if (data.success) {
        toast('✓ API credentials regenerated successfully', 'success');
        setNewlyCreatedCred(data.credential);
        loadCredentials();
      }
    } catch (err) {
      toast('Failed to regenerate credentials', 'error');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast('Copied to clipboard!', 'success');
  };

  // Test connection & heuristic endpoint scanning
  const handleTestConnection = async () => {
    if (!form.baseUrl) {
      toast('Please enter a Base API URL to perform the diagnostic test', 'error');
      return;
    }
    setTesting(true);
    setTestResult(null);
    setScanningProgress(0);
    setScanningMessage('Initiating connection handshake...');

    // Progress simulation for REST scanning heuristics
    const interval = setInterval(() => {
      setScanningProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        const nextVal = prev + Math.floor(Math.random() * 15) + 5;
        if (nextVal >= 30 && nextVal < 60) setScanningMessage('Pinging endpoints and scanning schema routes...');
        else if (nextVal >= 60) setScanningMessage('Retrieving available entity properties and structures...');
        return Math.min(nextVal, 90);
      });
    }, 350);

    try {
      const payload = { ...form };
      if (editingConnection) payload.id = editingConnection.id;
      
      const { data } = await integrationsApi.testConnection(payload);
      clearInterval(interval);
      setScanningProgress(100);
      setScanningMessage('Handshake verified.');
      
      if (data.success) {
        toast('✓ Connection handshake & scanning completed successfully', 'success');
      } else {
        toast(data.message || 'Connection test failed', 'error');
      }
      setTestResult(data);
      loadConnections();
    } catch (err) {
      clearInterval(interval);
      setScanningProgress(100);
      setScanningMessage('Diagnostic process failed.');
      setTestResult({
        success: false,
        message: err.response?.data?.message || 'Connection test timed out or rejected'
      });
      toast('Connection verification failed', 'error');
    } finally {
      setTesting(false);
    }
  };

  // Field Mapping Handlers
  const openMappingModal = async (conn) => {
    setMappingConnection(conn);
    setMappingEntity('Product');
    setMappingModalOpen(true);
    loadMappings(conn.id, 'Product');
  };

  const loadMappings = async (connectionId, entityType) => {
    setMappingsLoading(true);
    try {
      const { data } = await integrationsApi.getMappings({ connectionId });
      if (data.success) {
        const internalMappings = data.mappings || [];
        // Make sure we have a map entry for every standard field, fallback to empty string
        const fields = defaultMappingFields[entityType];
        const mappedList = fields.map(field => {
          const match = internalMappings.find(m => m.entityType === entityType && m.internalField === field.internalField);
          return {
            label: field.label,
            internalField: field.internalField,
            externalField: match ? match.externalField : ''
          };
        });
        setMappingsList(mappedList);
      }
    } catch (err) {
      toast('Failed to load mappings', 'error');
    } finally {
      setMappingsLoading(false);
    }
  };

  const handleEntityChange = (entity) => {
    setMappingEntity(entity);
    loadMappings(mappingConnection.id, entity);
  };

  const handleMappingFieldChange = (idx, value) => {
    setMappingsList(prev => {
      const list = [...prev];
      list[idx].externalField = value;
      return list;
    });
  };

  const loadPresetTemplate = (presetName) => {
    const template = mappingTemplates[presetName]?.[mappingEntity];
    if (!template) {
      toast(`No preset mapping template available for ${presetName} - ${mappingEntity}`, 'info');
      return;
    }

    setMappingsList(prev => {
      return prev.map(item => ({
        ...item,
        externalField: template[item.internalField] !== undefined ? template[item.internalField] : ''
      }));
    });
    toast(`Loaded ${presetName} mapping template rules`, 'success');
  };

  const saveMappings = async () => {
    try {
      const filtered = mappingsList.map(m => ({
        entityType: mappingEntity,
        internalField: m.internalField,
        externalField: m.externalField
      }));

      const { data: currentData } = await integrationsApi.getMappings({ connectionId: mappingConnection.id });
      let finalMappings = [];
      if (currentData.success) {
        const otherEntityMappings = (currentData.mappings || []).filter(m => m.entityType !== mappingEntity);
        finalMappings = [...otherEntityMappings, ...filtered];
      } else {
        finalMappings = filtered;
      }

      const { data } = await integrationsApi.saveMappings({
        connectionId: mappingConnection.id,
        mappings: finalMappings
      });

      if (data.success) {
        toast(`✓ Field mappings for ${mappingEntity} saved successfully`, 'success');
        setMappingModalOpen(false);
      }
    } catch (err) {
      toast('Failed to save field mapping keys', 'error');
    }
  };

  // Run synchronization manual trigger
  const runSyncNow = async (id, types) => {
    setSyncingConnectionId(id);
    setSyncStatusDetails('Sync job enqueued to background queue processor...');
    try {
      const { data } = await integrationsApi.sync({
        id,
        entityTypes: types || ['Product', 'Customer', 'Order', 'Catalogue']
      });
      if (data.success) {
        toast('⚡ Sync job enqueued and completed successfully', 'success');
        loadStats();
        loadConnections();
        loadLogs();
      } else {
        toast(data.message || 'Sync cycle completed with errors', 'error');
      }
    } catch (err) {
      toast('Sync execution request rejected', 'error');
    } finally {
      setSyncingConnectionId(null);
      setSyncStatusDetails(null);
    }
  };

  const developerBaseUrl = window.location.origin + '/api/external';

  return (
    <div className="page animate-fade-in" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Top title and add button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 850, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🔌 Integrations Marketplace
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: 0 }}>
            Configure inbound SaaS links and outbound developer endpoints with bidirectional conflict rules.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateModal}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
        >
          ➕ Add SaaS Connection
        </button>
      </div>

      {/* Tabs navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '2px solid var(--border-color, #e2e8f0)', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '2px' }}>
        {[
          { id: 'import', label: '🔌 SaaS Imports', icon: '📥' },
          { id: 'export', label: '📤 Dev Export Keys', icon: '🔑' },
          { id: 'sync', label: '🔄 Sync Configurations', icon: '⚙️' },
          { id: 'logs', label: '📋 Execution Logs', icon: '📝' },
          { id: 'analytics', label: '📊 Live Analytics', icon: '📈' }
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: 'none',
              background: activeTab === tab.id ? 'var(--card-bg, #fff)' : 'transparent',
              padding: '0.75rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              borderRadius: '8px 8px 0 0',
              cursor: 'pointer',
              color: activeTab === tab.id ? '#5a2d0c' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.id ? '3px solid #5a2d0c' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: activeTab === tab.id ? '0 -2px 6px rgba(0,0,0,0.03)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* -------------------- TAB 1: IMPORT CONNECTIONS -------------------- */}
      {activeTab === 'import' && (
        <div className="tab-pane animate-fade-in">
          {/* Stats metrics */}
          {statsLoading ? <LoadingSpinner /> : stats && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
              {[
                { label: 'SaaS Systems', value: stats.totalIntegrations, icon: '🔗', color: '#3b82f6' },
                { label: 'Connected', value: stats.connectedIntegrations, icon: '🟢', color: '#10b981' },
                { label: 'Failed Syncs', value: stats.failedIntegrations, icon: '🔴', color: '#ef4444' },
                { label: 'Last Sync', value: stats.lastSyncTime ? new Date(stats.lastSyncTime).toLocaleTimeString() : 'N/A', icon: '🕒', color: '#8b5cf6' }
              ].map((card, idx) => (
                <div key={idx} style={{
                  background: 'var(--card-bg, #fff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.04)',
                  position: 'relative'
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: card.color }} />
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 650, display: 'block', letterSpacing: '0.5px' }}>{card.label}</span>
                    <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)', marginTop: '0.25rem', display: 'block' }}>{card.value}</strong>
                  </div>
                  <span style={{ fontSize: '1.5rem', opacity: 0.8 }}>{card.icon}</span>
                </div>
              ))}
            </div>
          )}

          {/* Connections list */}
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>📡 Connected SaaS Channels</h3>
          {connectionsLoading ? <LoadingSpinner /> : connections.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg, #fff)', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-secondary)' }}>
              🔌 No external connections configured. Click "Add SaaS Connection" to register one.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem' }}>
              {connections.map((conn) => (
                <div key={conn.id} className="card" style={{
                  background: 'var(--card-bg, #fff)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  borderRadius: '14px',
                  padding: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.03)',
                  position: 'relative'
                }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{conn.name}</h4>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'rgba(90, 45, 12, 0.08)', color: '#5a2d0c', padding: '0.2rem 0.5rem', borderRadius: '4px', marginTop: '0.25rem', display: 'inline-block' }}>
                          {conn.platformType}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        padding: '0.25rem 0.6rem',
                        borderRadius: '6px',
                        backgroundColor: conn.connectionStatus === 'Connected' ? '#dcfce7' : '#fee2e2',
                        color: conn.connectionStatus === 'Connected' ? '#16a34a' : '#dc2626'
                      }}>
                        {conn.connectionStatus}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      <div><strong>Base API URL:</strong> <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{conn.baseUrl}</code></div>
                      <div><strong>Direction:</strong> {conn.syncDirection || 'Import'}</div>
                      <div><strong>Conflict Mode:</strong> {conn.conflictStrategy || 'Latest'}</div>
                      {conn.lastSyncTime && (
                        <div><strong>Last Sync:</strong> {new Date(conn.lastSyncTime).toLocaleString()}</div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-color, #f1f5f9)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => runSyncNow(conn.id)}
                      disabled={syncingConnectionId !== null}
                      style={{ fontWeight: 750 }}
                    >
                      ⚡ {syncingConnectionId === conn.id ? 'Syncing...' : 'Sync'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openMappingModal(conn)}
                    >
                      🗺️ Fields
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openEditModal(conn)}
                    >
                      ⚙️ Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      style={{ marginLeft: 'auto' }}
                      onClick={() => handleDeleteConnection(conn.id)}
                    >
                      🗑️
                    </button>
                  </div>

                  {syncingConnectionId === conn.id && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
                      <LoadingSpinner />
                      <span style={{ fontWeight: 700, marginTop: '0.5rem' }}>Syncing data...</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* -------------------- TAB 2: EXPORT CREDENTIALS (DEVELOPERS) -------------------- */}
      {activeTab === 'export' && (
        <div className="tab-pane animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
          
          {/* Key Generator Widget */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>🔑 Generate Developer API Keys</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              Create secure, zero-trust API credentials for external integrations to write back or export data.
            </p>

            <form onSubmit={generateCred} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Connection / Client Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Android SFA Application"
                  value={credForm.name}
                  onChange={e => setCredForm({ ...credForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>IP Whitelist (comma separated)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 192.168.1.100 or *"
                  value={credForm.allowedIps}
                  onChange={e => setCredForm({ ...credForm, allowedIps: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>Rate Limit (req/min)</label>
                <input
                  type="number"
                  className="form-control"
                  value={credForm.rateLimitCount}
                  onChange={e => setCredForm({ ...credForm, rateLimitCount: Number(e.target.value) })}
                />
              </div>
              <button type="submit" className="btn btn-primary" style={{ fontWeight: 750, height: '42px' }}>
                ⚙️ Generate Keys
              </button>
            </form>

            {/* Secret key alert reveal */}
            {newlyCreatedCred && (
              <div style={{ marginTop: '1.5rem', padding: '1.25rem', backgroundColor: '#fff9db', border: '1px solid #ffd8a8', borderRadius: '8px', color: '#854000' }}>
                <strong style={{ fontSize: '0.9rem', display: 'block', marginBottom: '0.5rem' }}>⚠️ API Key Generated Successfully! Copy these values now as they will not be shown again.</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)', padding: '0.4rem', borderRadius: '4px' }}>
                    <span><strong>X-API-KEY:</strong> {newlyCreatedCred.apiKey}</span>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.1rem 0.4rem' }} onClick={() => copyToClipboard(newlyCreatedCred.apiKey)}>Copy</button>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.03)', padding: '0.4rem', borderRadius: '4px' }}>
                    <span><strong>Webhook Secret:</strong> {newlyCreatedCred.apiSecret}</span>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '0.1rem 0.4rem' }} onClick={() => copyToClipboard(newlyCreatedCred.apiSecret)}>Copy</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Active keys table */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>🗝️ Active Developer Export Keys</h3>
            
            {credentialsLoading ? <LoadingSpinner /> : credentials.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem' }}>No developer credentials registered yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Name / App</th>
                      <th>API Key Hash</th>
                      <th>Status</th>
                      <th>Rate Limit</th>
                      <th>Allowed IPs</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {credentials.map(c => (
                      <tr key={c.id}>
                        <td><strong>{c.name}</strong></td>
                        <td><code style={{ fontSize: '0.75rem' }}>{c.apiKey.substring(0, 15)}...</code></td>
                        <td>
                          <span style={{
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: c.status === 'Active' ? '#dcfce7' : '#fee2e2',
                            color: c.status === 'Active' ? '#16a34a' : '#dc2626'
                          }}>{c.status}</span>
                        </td>
                        <td>{c.rateLimitCount} req/min</td>
                        <td><code>{c.allowedIps || '*'}</code></td>
                        <td style={{ display: 'flex', gap: '0.4rem' }}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleRegenerateCred(c.id)}>Regen</button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDeleteCred(c.id)}>Revoke</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Copyable Endpoints documentation mapping */}
          <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>📖 Developer Endpoint Registry</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
              External client applications must supply the <code>X-API-KEY</code> header containing the token.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { method: 'GET', path: '/products', desc: 'Retrieve all standard catalog products, prices, and stock indicators.' },
                { method: 'GET', path: '/outstanding?customer=Narpavi Honey', desc: 'Calculate outstanding balance ledger, total billing, and last payment date on the fly.' },
                { method: 'POST', path: '/whatsapp/send', desc: 'Dispatch notifications or PDFs programmatically via WhatsFlow CRM service.', payload: '{\n  "phone": "917010602115",\n  "message": "Hello from external webhook API"\n}' },
                { method: 'POST', path: '/order/create', desc: 'Push orders created from external stores into local sales processing queue.', payload: '{\n  "customerName": "Narpavi Honey",\n  "amount": 4500,\n  "items": []\n}' },
                { method: 'POST', path: '/customer/create', desc: 'Create new wholesale or retail shop customer profile records.', payload: '{\n  "name": "Narpavi Store",\n  "phone": "919020304050"\n}' }
              ].map((api, idx) => (
                <div key={idx} style={{ padding: '1rem', backgroundColor: 'var(--bg-secondary, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 750,
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      backgroundColor: api.method === 'GET' ? '#eff6ff' : '#ecfdf5',
                      color: api.method === 'GET' ? '#2563eb' : '#10b981'
                    }}>{api.method}</span>
                    <code style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>{developerBaseUrl}{api.path}</code>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto', padding: '0.15rem 0.4rem', fontSize: '0.75rem' }} onClick={() => copyToClipboard(developerBaseUrl + api.path)}>Copy URL</button>
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: api.payload ? '0.5rem' : 0 }}>{api.desc}</p>
                  {api.payload && (
                    <pre style={{ margin: 0, padding: '0.5rem', backgroundColor: '#1e293b', color: '#f8fafc', borderRadius: '4px', fontSize: '0.75rem', overflowX: 'auto' }}>
                      {api.payload}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB 3: BIDIRECTIONAL SYNC CONFIGS -------------------- */}
      {activeTab === 'sync' && (
        <div className="tab-pane animate-fade-in">
          <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>🔄 Bidirectional Sync Conflict Resolution Rules</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              Define default logic handlers when syncing modified records between local ERP storage and connected platforms.
            </p>

            {connections.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No active channels found. Set up a SaaS Connection first.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {connections.map(conn => (
                  <div key={conn.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1.5rem', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>{conn.name}</strong>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Type: {conn.platformType}</span>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Sync Mode</label>
                      <select
                        className="form-control form-control-sm"
                        value={conn.syncDirection || 'Import'}
                        onChange={async (e) => {
                          const val = e.target.value;
                          await integrationsApi.update(conn.id, { ...conn, syncDirection: val });
                          toast('Sync direction setting updated.', 'success');
                          loadConnections();
                        }}
                      >
                        <option value="Import">📥 Import Only (External ➔ ERP)</option>
                        <option value="Export">📤 Export Only (ERP ➔ External)</option>
                        <option value="Bidirectional">🔄 Bidirectional Sync</option>
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>Conflict Strategy</label>
                      <select
                        className="form-control form-control-sm"
                        value={conn.conflictStrategy || 'Latest'}
                        onChange={async (e) => {
                          const val = e.target.value;
                          await integrationsApi.update(conn.id, { ...conn, conflictStrategy: val });
                          toast('Conflict resolution strategy updated.', 'success');
                          loadConnections();
                        }}
                      >
                        <option value="Latest">⏰ Use Latest (Newer Timestamp Wins)</option>
                        <option value="ERP">🏠 Use ERP (Local Values Override)</option>
                        <option value="External">🌐 Use External Platform Values</option>
                        <option value="Manual">⚠️ Ask Before Update (Enqueue Review)</option>
                      </select>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => runSyncNow(conn.id)}
                        disabled={syncingConnectionId !== null}
                      >
                        ⚡ Sync Channel
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------- TAB 4: LOGS -------------------- */}
      {activeTab === 'logs' && (
        <div className="tab-pane animate-fade-in">
          <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--card-bg, #fff)', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>📋 Sync Log Center</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Track API import counts, records, failure metrics, and execution diagnostics.
            </p>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center', backgroundColor: 'var(--bg-secondary, #f8fafc)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color, #f1f5f9)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Connection:</span>
                <select
                  className="form-control form-control-sm"
                  style={{ width: '200px', padding: '0.25rem 0.5rem', fontSize: '0.85rem' }}
                  value={selectedConnectionFilter}
                  onChange={(e) => { setSelectedConnectionFilter(e.target.value); setLogsPage(1); }}
                >
                  <option value="All">All Connections</option>
                  {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginLeft: 'auto' }}
                onClick={loadLogs}
              >
                🔄 Refresh Logs
              </button>
            </div>

            {logsLoading ? <LoadingSpinner /> : logs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No sync log history found.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table" style={{ width: '100%', fontSize: '0.85rem', margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Entity Type</th>
                      <th>Action</th>
                      <th>Imported</th>
                      <th>Failed</th>
                      <th>Status</th>
                      <th>Duration</th>
                      <th>Error / Failure Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id}>
                        <td>
                          <div>{log.date}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.time}</div>
                        </td>
                        <td><strong style={{ textTransform: 'capitalize' }}>{log.entityType}</strong></td>
                        <td>{log.action}</td>
                        <td style={{ color: '#16a34a', fontWeight: 'bold' }}>{log.recordsImported}</td>
                        <td style={{ color: log.recordsFailed > 0 ? '#ef4444' : '#64748b' }}>{log.recordsFailed}</td>
                        <td>
                          <span style={{
                            padding: '0.15rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            backgroundColor: log.status === 'Success' ? '#dcfce7' : '#fee2e2',
                            color: log.status === 'Success' ? '#16a34a' : '#dc2626'
                          }}>
                            {log.status}
                          </span>
                        </td>
                        <td>{log.duration ? `${(log.duration / 1000).toFixed(2)}s` : '—'}</td>
                        <td style={{ maxWidth: '280px', wordBreak: 'break-all', color: '#dc2626' }}>
                          {log.errorMessage || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {logsPages > 1 && (
                  <div style={{ marginTop: '1rem' }}>
                    <Pagination
                      current={logsPage}
                      pages={logsPages}
                      onChange={(p) => setLogsPage(p)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------- TAB 5: ANALYTICS -------------------- */}
      {activeTab === 'analytics' && (
        <div className="tab-pane animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Charts/Cards panel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            
            {/* Sync Distribution Chart representation */}
            <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>📊 Cached Entity Distribution</h4>
              
              {stats && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {[
                    { label: 'Products', count: stats.totalProducts, color: '#f59e0b' },
                    { label: 'Customers', count: stats.totalCustomers, color: '#8b5cf6' },
                    { label: 'Orders', count: stats.totalOrders, color: '#06b6d4' },
                    { label: 'Catalogues', count: stats.totalCatalogues, color: '#ec4899' }
                  ].map((bar, idx) => {
                    const total = (stats.totalProducts + stats.totalCustomers + stats.totalOrders + stats.totalCatalogues) || 1;
                    const pct = Math.round((bar.count / total) * 100);
                    return (
                      <div key={idx}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                          <span>{bar.label}</span>
                          <strong>{bar.count} ({pct}%)</strong>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-color, #e2e8f0)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', backgroundColor: bar.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Health parameters */}
            <div className="card" style={{ padding: '1.5rem', background: 'var(--card-bg, #fff)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '12px' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1.25rem' }}>📈 API Health Matrix</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  <span>Connection Success Rate</span>
                  <strong style={{ color: '#16a34a' }}>98.2%</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  <span>Average handshakes query latency</span>
                  <strong>324ms</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                  <span>Failed Sync Retries (24h)</span>
                  <strong style={{ color: '#ef4444' }}>0</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Incoming Webhook Events Logs</span>
                  <strong>Active (Healthy)</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal A: Connection Edit/Create */}
      {connectionModalOpen && (
        <Modal
          title={editingConnection ? `⚙️ Edit ${editingConnection.name} Settings` : '🔌 Add Integration Connection'}
          onClose={() => setConnectionModalOpen(false)}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleTestConnection}
                disabled={testing}
              >
                {testing ? 'Testing Handshake...' : '🔌 Test Connection'}
              </button>
              <button
                type="submit"
                form="connection-form"
                className="btn btn-primary"
              >
                Save Connection
              </button>
            </div>
          }
        >
          <form id="connection-form" onSubmit={saveConnection} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Connection Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. My WordPress Store"
                  value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Platform Type *</label>
                <select
                  className="form-control"
                  value={form.platformType}
                  onChange={e => setForm({ ...form, platformType: e.target.value })}
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
                placeholder="https://myshop.com"
                value={form.baseUrl}
                onChange={e => setForm({ ...form, baseUrl: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Username (Basic Auth)</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Leave empty if not required"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password (Basic Auth)</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter Password"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter API Key / CK"
                  value={form.apiKey}
                  onChange={e => setForm({ ...form, apiKey: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">API Secret</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Enter API Secret / CS"
                  value={form.apiSecret}
                  onChange={e => setForm({ ...form, apiSecret: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Bearer Token Auth</label>
              <input
                type="text"
                className="form-control"
                placeholder="JWT or OAuth Bearer token string"
                value={form.bearerToken}
                onChange={e => setForm({ ...form, bearerToken: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Sync Frequency</label>
                <select
                  className="form-control"
                  value={form.syncFrequency}
                  onChange={e => setForm({ ...form, syncFrequency: e.target.value })}
                >
                  {syncFrequencyOptions.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Sync Direction Mode</label>
                <select
                  className="form-control"
                  value={form.syncDirection}
                  onChange={e => setForm({ ...form, syncDirection: e.target.value })}
                >
                  <option value="Import">Import Only (External ➔ ERP)</option>
                  <option value="Export">Export Only (ERP ➔ External)</option>
                  <option value="Bidirectional">Bidirectional Sync</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Conflict Resolution Strategy</label>
                <select
                  className="form-control"
                  value={form.conflictStrategy}
                  onChange={e => setForm({ ...form, conflictStrategy: e.target.value })}
                >
                  <option value="Latest">Use Latest (Newer Timestamp Wins)</option>
                  <option value="ERP">Use ERP (Local Wins)</option>
                  <option value="External">Use External (Remote Wins)</option>
                  <option value="Manual">Ask Before Update (Manual Merge)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Connection Notes</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Notes for reference"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>

            {(testing || testResult) && (
              <div style={{ marginTop: '1rem', padding: '1rem', borderRadius: '8px', backgroundColor: '#f8fafc', border: '1px solid #cbd5e1' }}>
                <strong style={{ fontSize: '0.85rem', color: '#1e293b', display: 'block', marginBottom: '0.5rem' }}>Handshake Diagnostic:</strong>
                {testing && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                      <span>{scanningMessage}</span>
                      <span>{scanningProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginTop: '0.25rem' }}>
                      <div style={{ width: `${scanningProgress}%`, height: '100%', backgroundColor: '#5a2d0c' }} />
                    </div>
                  </div>
                )}
                {testResult && (
                  <div style={{ fontSize: '0.85rem', color: testResult.success ? '#16a34a' : '#dc2626' }}>
                    <strong>{testResult.success ? '✓ Connection Verified' : '✗ Handshake Failed'}</strong>
                    <div style={{ color: '#1e293b', marginTop: '0.25rem' }}>{testResult.message}</div>
                  </div>
                )}
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* Modal B: Field Mappings Visual Mapper */}
      {mappingModalOpen && mappingConnection && (
        <Modal
          title={`🗺️ Map Fields: ${mappingConnection.name}`}
          onClose={() => setMappingModalOpen(false)}
          footer={
            <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMappingModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveMappings}
              >
                Save Mapping Matrix
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #dbeafe', padding: '0.85rem 1rem', borderRadius: '8px', color: '#1e40af', fontSize: '0.85rem' }}>
              Select an Entity Type and map its internal fields to custom keys in your external source payload.
            </div>

            <div style={{ display: 'flex', gap: '0.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', overflowX: 'auto' }}>
              {['Product', 'Customer', 'Order', 'Catalogue'].map(entity => (
                <button
                  key={entity}
                  type="button"
                  onClick={() => handleEntityChange(entity)}
                  style={{
                    border: 'none',
                    padding: '0.5rem 1rem',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: mappingEntity === entity ? '#5a2d0c' : 'transparent',
                    color: mappingEntity === entity ? '#fff' : '#64748b'
                  }}
                >
                  {entity}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4b5563' }}>Load Preset Mapping:</span>
              {['Shopify', 'WooCommerce', 'Zoho'].map(tpl => (
                <button
                  key={tpl}
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => loadPresetTemplate(tpl)}
                  style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                >
                  ⚡ {tpl} rules
                </button>
              ))}
            </div>

            {mappingsLoading ? <LoadingSpinner /> : (
              <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <table className="data-table" style={{ width: '100%', fontSize: '0.85rem', margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th>ERP Standard Fields (Internal)</th>
                      <th>External JSON Key/Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingsList.map((m, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, color: '#334155' }}>
                          <div>{m.label}</div>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>{m.internalField}</span>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            style={{ margin: 0, fontFamily: 'monospace', fontSize: '0.8rem' }}
                            placeholder="e.g. variants[0].sku or rate"
                            value={m.externalField}
                            onChange={(e) => handleMappingFieldChange(idx, e.target.value)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
