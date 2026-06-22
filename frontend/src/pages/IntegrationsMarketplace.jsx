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
    notes: ''
  });
  
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
  }, []);

  useEffect(() => {
    loadLogs();
  }, [logsPage, selectedConnectionFilter]);

  // Form handlers
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
      notes: ''
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
      oauthClientId: conn.oauthClientId ? '********' : '',
      oauthClientSecret: conn.oauthClientSecret ? '********' : '',
      webhookUrl: conn.webhookUrl || '',
      webhookSecret: conn.webhookSecret ? '********' : '',
      syncFrequency: conn.syncFrequency || 'Manual',
      notes: conn.notes || ''
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

  const deleteConnection = async (id) => {
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
      // Gather all active mappings from mapping list, filter empty mappings out if desired
      // or send empty to clear
      const filtered = mappingsList.map(m => ({
        entityType: mappingEntity,
        internalField: m.internalField,
        externalField: m.externalField
      }));

      // In order to preserve mappings for other entities, we should first retrieve all of them,
      // overwrite current entity mappings, and save the merged list.
      const { data: currentData } = await integrationsApi.getMappings({ connectionId: mappingConnection.id });
      let finalMappings = [];
      if (currentData.success) {
        // Filter out other entity types to keep
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

  return (
    <div className="page animate-fade-in" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color, #e2e8f0)', paddingBottom: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 850, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🔌 Integrations Marketplace
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.25rem', marginBottom: 0 }}>
            Connect external Shopify, WooCommerce, Zoho, HubSpot, ERPNext, Salesforce, or custom endpoints to AO Core CRM.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={openCreateModal}
          style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 700 }}
        >
          ➕ Add Integration
        </button>
      </div>

      {/* 1. Dashboard Metrics Summary Grid */}
      {statsLoading ? <LoadingSpinner /> : stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          {[
            { label: 'Total Connections', value: stats.totalIntegrations, icon: '🔗', color: '#3b82f6' },
            { label: 'Connected SaaS', value: stats.connectedIntegrations, icon: '🟢', color: '#10b981' },
            { label: 'Failed Handshakes', value: stats.failedIntegrations, icon: '🔴', color: '#ef4444' },
            { label: 'Imported Products', value: stats.totalProducts, icon: '📦', color: '#f59e0b' },
            { label: 'Imported Customers', value: stats.totalCustomers, icon: '👥', color: '#8b5cf6' },
            { label: 'Imported Orders', value: stats.totalOrders, icon: '🛒', color: '#06b6d4' },
            { label: 'Imported Catalogues', value: stats.totalCatalogues, icon: '📑', color: '#ec4899' },
          ].map((card, idx) => (
            <div key={idx} style={{
              background: 'var(--card-bg, #fff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: card.color }} />
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 650, display: 'block', letterSpacing: '0.5px' }}>{card.label}</span>
                <strong style={{ fontSize: '1.5rem', color: 'var(--text-primary)', marginTop: '0.25rem', display: 'block' }}>{card.value}</strong>
              </div>
              <span style={{ fontSize: '1.75rem', opacity: 0.85 }}>{card.icon}</span>
            </div>
          ))}
        </div>
      )}

      {/* 2. Connected Integrations Grid */}
      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>📡 Active Connections</h3>
      {connectionsLoading ? <LoadingSpinner /> : connections.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '3rem',
          background: 'var(--card-bg, #fff)',
          borderRadius: '12px',
          border: '1px solid var(--border-color, #e2e8f0)',
          color: 'var(--text-secondary)',
          marginBottom: '2rem'
        }}>
          🔌 No connections set up yet. Click "Add Integration" to link your first SaaS system.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
          {connections.map((conn) => (
            <div key={conn.id} className="card animate-fade-in" style={{
              background: 'var(--card-bg, #fff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: '14px',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
              position: 'relative'
            }}>
              <div>
                {/* Platform Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{conn.name}</h4>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: 'rgba(90, 45, 12, 0.08)',
                      color: '#5a2d0c',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      marginTop: '0.25rem',
                      display: 'inline-block'
                    }}>
                      {conn.platformType}
                    </span>
                  </div>
                  
                  {/* Status Indicator */}
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    backgroundColor: conn.connectionStatus === 'Connected' ? '#dcfce7' : '#fee2e2',
                    color: conn.connectionStatus === 'Connected' ? '#16a34a' : '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem'
                  }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: conn.connectionStatus === 'Connected' ? '#16a34a' : '#dc2626', display: 'inline-block' }}></span>
                    {conn.connectionStatus}
                  </span>
                </div>

                {/* Connection details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                  <div><strong>API Base URL:</strong> <code style={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>{conn.baseUrl}</code></div>
                  <div><strong>Sync Frequency:</strong> {conn.syncFrequency}</div>
                  {conn.lastSyncTime && (
                    <div><strong>Last Synced:</strong> {new Date(conn.lastSyncTime).toLocaleString()}</div>
                  )}
                  {conn.notes && (
                    <div style={{ fontStyle: 'italic', borderLeft: '3px solid #cbd5e1', paddingLeft: '0.5rem', marginTop: '0.25rem' }}>
                      {conn.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions strip */}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-color, #f1f5f9)', paddingTop: '1rem', marginTop: 'auto' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => runSyncNow(conn.id)}
                  disabled={syncingConnectionId !== null}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 700 }}
                >
                  ⚡ {syncingConnectionId === conn.id ? 'Syncing...' : 'Sync Now'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => openMappingModal(conn)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  🗺️ Map Fields
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
                  onClick={() => deleteConnection(conn.id)}
                >
                  🗑️ Delete
                </button>
              </div>

              {/* Sync Loader Overlay */}
              {syncingConnectionId === conn.id && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 5,
                  padding: '1rem',
                  textAlign: 'center'
                }}>
                  <LoadingSpinner />
                  <span style={{ fontWeight: 700, marginTop: '0.5rem', color: '#1e293b' }}>Sync in progress...</span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{syncStatusDetails}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 3. Log History Center */}
      <div className="card" style={{ padding: '1.5rem', backgroundColor: 'var(--card-bg, #fff)', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)' }}>
        <h3 style={{ fontSize: '1.20rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>📋 Synchronization Log History</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
          Monitor manual triggers and background cron synchronization jobs.
        </p>

        {/* Filters */}
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

        {/* Logs Table */}
        {logsLoading ? <LoadingSpinner /> : logs.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>No sync log history found for selected filters.</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
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
              <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.15rem', display: 'block' }}>
                For WooCommerce: Root wordpress URL (https://myshop.com). For Custom REST: Base endpoints URL.
              </small>
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
                  placeholder="Enter Password / CS"
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">API Key / WooCommerce Consumer Key</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter API Key / CK"
                  value={form.apiKey}
                  onChange={e => setForm({ ...form, apiKey: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">API Secret / WooCommerce Consumer Secret</label>
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
                <label className="form-label">OAuth Client ID</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.oauthClientId}
                  onChange={e => setForm({ ...form, oauthClientId: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">OAuth Client Secret</label>
                <input
                  type="password"
                  className="form-control"
                  value={form.oauthClientSecret}
                  onChange={e => setForm({ ...form, oauthClientSecret: e.target.value })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Incoming Webhook Endpoint</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Self endpoint URL"
                  value={form.webhookUrl}
                  onChange={e => setForm({ ...form, webhookUrl: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Webhook Verify Secret</label>
                <input
                  type="password"
                  className="form-control"
                  value={form.webhookSecret}
                  onChange={e => setForm({ ...form, webhookSecret: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Sync Frequency (Cron)</label>
              <select
                className="form-control"
                value={form.syncFrequency}
                onChange={e => setForm({ ...form, syncFrequency: e.target.value })}
              >
                {syncFrequencyOptions.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Configuration Notes</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Developer logs or specific instructions"
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {/* Test results inside form */}
            {(testing || testResult) && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                borderRadius: '8px',
                backgroundColor: '#f8fafc',
                border: '1px solid #cbd5e1'
              }}>
                <strong style={{ fontSize: '0.85rem', color: '#1e293b', display: 'block', marginBottom: '0.5rem' }}>Connection Test Handshake:</strong>
                
                {testing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                      <span>{scanningMessage}</span>
                      <span>{scanningProgress}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${scanningProgress}%`, height: '100%', backgroundColor: '#5a2d0c', transition: 'width 0.2s' }} />
                    </div>
                  </div>
                )}

                {testResult && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem' }}>
                    <div style={{ color: testResult.success ? '#16a34a' : '#dc2626', fontWeight: 'bold' }}>
                      {testResult.success ? '✓ Verified Connected Successfully' : '✗ Verification Handshake Failed'}
                    </div>
                    <div>{testResult.message}</div>
                    {testResult.success && testResult.scanResults && (
                      <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                        <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 'bold', display: 'block', marginBottom: '0.25rem' }}>Scanned Available Pathways:</span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {testResult.scanResults.map((r, idx) => (
                            <span key={idx} style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.4rem',
                              borderRadius: '4px',
                              backgroundColor: r.available ? '#dcfce7' : '#fee2e2',
                              color: r.available ? '#16a34a' : '#dc2626',
                              border: r.available ? '1px solid #bcf0da' : '1px solid #fecaca'
                            }}>
                              {r.type} ({r.path})
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
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
            <div style={{ backgroundColor: '#eff6ff', border: '1px solid #dbeafe', padding: '0.85rem 1rem', borderRadius: '8px', color: '#1e40af', fontSize: '0.85rem', lineHeight: '1.4' }}>
              Select an Entity Type and map its internal fields to custom keys in your external source payload.
            </div>

            {/* Entity Types tabs inside Modal */}
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
                  {entity} Mappings
                </button>
              ))}
            </div>

            {/* Presets template loaders */}
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

            {/* Mappings fields visual grid */}
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
