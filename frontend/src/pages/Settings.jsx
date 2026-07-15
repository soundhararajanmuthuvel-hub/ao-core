import { useState, useEffect } from 'react';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { settingsApi, usersApi, integrationsApi, migrationApi, customersApi, salesApi, databaseApi, whatsappApi } from '../api';
import { resolveAssetUrl, getActiveLogoUrl } from '../utils/url';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePWA } from '../context/PWAContext';

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
  const { user, logout, updateTourCompleted } = useAuth();
  const isSuperAdmin = user?.role === 'Super Admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState(tabParam || 'profile');
  const { isInstallable, isInstalled, installApp } = usePWA();

  // Database Management states
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [dbActionType, setDbActionType] = useState(''); // 'reset-demo', 'clear-transactions', 'factory-reset'
  const [confirmationStep, setConfirmationStep] = useState(1);
  const [alsoDeleteUsers, setAlsoDeleteUsers] = useState(false);
  const [seededCredentials, setSeededCredentials] = useState(null);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [dbCounts, setDbCounts] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(false);
  const [backupFileName, setBackupFileName] = useState('');

  useEffect(() => {
    if (activeTab === 'database' && user?.role !== 'Super Admin') {
      handleTabChange('profile');
    }
  }, [activeTab, user]);


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
  const [logoMethod, setLogoMethod] = useState('file');
  const [filePreview, setFilePreview] = useState('');
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

  // WhatsApp Integration states
  const [waForm, setWaForm] = useState({
    provider: 'WAHA',
    apiUrl: 'http://localhost:3000',
    apiKey: '',
    instanceId: 'default',
    webhookUrl: '',
    status: 'Disconnected'
  });
  const [waLoading, setWaLoading] = useState(false);
  const [waSaving, setWaSaving] = useState(false);
  const [waTesting, setWaTesting] = useState(false);
  const [showWaErrorModal, setShowWaErrorModal] = useState(false);
  const [waLastTestResult, setWaLastTestResult] = useState(null);
  const [waErrorDetails, setWaErrorDetails] = useState('');

  const [showWaSuccessModal, setShowWaSuccessModal] = useState(false);
  const [waSuccessData, setWaSuccessData] = useState(null);
  const [waTestingMsg, setWaTestingMsg] = useState(false);
  const [waTestingCat, setWaTestingCat] = useState(false);
  const [waTestingInv, setWaTestingInv] = useState(false);
  const [waRetrying, setWaRetrying] = useState(false);

  const handleSendTestMessage = async () => {
    setWaTestingMsg(true);
    try {
      const { data } = await whatsappApi.sendTestMessage();
      if (data.success) {
        toast('✓ Test message sent successfully!', 'success');
        setWaSuccessData(data.data || {
          customerName: 'Test Contact',
          phone: waForm.crmBaseUrl ? 'Gateway Config' : '917010602115',
          messageType: 'Test Message',
          timestamp: new Date().toISOString(),
          referenceId: data.messageId || 'test-ref-id'
        });
        setShowWaSuccessModal(true);
      } else {
        toast(data.message || 'Failed to send test message', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to send test message', 'error');
    } finally {
      setWaTestingMsg(false);
    }
  };

  const handleSendTestCatalogue = async () => {
    setWaTestingCat(true);
    try {
      const { data } = await whatsappApi.sendTestCatalogue();
      if (data.success) {
        toast('✓ Test catalogue sent successfully!', 'success');
        setWaSuccessData(data.data || {
          customerName: 'Test Contact',
          phone: waForm.crmBaseUrl ? 'Gateway Config' : '917010602115',
          messageType: 'Catalogue PDF',
          timestamp: new Date().toISOString(),
          referenceId: data.messageId || 'test-ref-id'
        });
        setShowWaSuccessModal(true);
      } else {
        toast(data.message || 'Failed to send test catalogue', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to send test catalogue', 'error');
    } finally {
      setWaTestingCat(false);
    }
  };

  const handleSendTestInvoice = async () => {
    setWaTestingInv(true);
    try {
      const { data } = await whatsappApi.sendTestInvoice();
      if (data.success) {
        toast('✓ Test invoice sent successfully!', 'success');
        setWaSuccessData(data.data || {
          customerName: 'Test Contact',
          phone: waForm.crmBaseUrl ? 'Gateway Config' : '917010602115',
          messageType: 'Invoice PDF',
          timestamp: new Date().toISOString(),
          referenceId: data.messageId || 'test-ref-id'
        });
        setShowWaSuccessModal(true);
      } else {
        toast(data.message || 'Failed to send test invoice', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to send test invoice', 'error');
    } finally {
      setWaTestingInv(false);
    }
  };

  const handleRetryFailedLogs = async () => {
    setWaRetrying(true);
    try {
      const { data } = await whatsappApi.retryFailedLogs();
      if (data.success) {
        toast(data.message || 'Retried failed logs successfully!', 'success');
      } else {
        toast(data.message || 'Failed to retry logs', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to retry logs', 'error');
    } finally {
      setWaRetrying(false);
    }
  };

  const loadWhatsAppSettings = async () => {
    setWaLoading(true);
    try {
      const { data } = await whatsappApi.getSettings();
      if (data.success && data.settings) {
        setWaForm(data.settings);
      }
    } catch (err) {
      console.error('Failed to load WhatsApp settings:', err);
      toast('Failed to load WhatsApp settings', 'error');
    } finally {
      setWaLoading(false);
    }
  };

  const saveWhatsAppSettings = async () => {
    setWaSaving(true);
    try {
      const { data } = await whatsappApi.updateSettings(waForm);
      if (data.success) {
        toast('WhatsApp Integration configurations saved successfully', 'success');
        if (data.settings) {
          setWaForm(prev => ({ ...prev, ...data.settings }));
        }
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save WhatsApp settings', 'error');
    } finally {
      setWaSaving(false);
    }
  };

  const testWhatsAppConnection = async () => {
    setWaTesting(true);
    setWaLastTestResult(null);
    setWaErrorDetails('');
    try {
      await whatsappApi.updateSettings(waForm);
      const { data } = await whatsappApi.testConnection();
      if (data.success) {
        toast('✓ WhatsApp Connection Connected Successfully', 'success');
        setWaLastTestResult({ success: true, message: 'Connected successfully to WhatsApp session.' });
      } else {
        toast(data.message || 'WhatsApp Connection failed', 'error');
        setWaLastTestResult({ success: false, message: data.message || 'Verification failed. WhatsApp session not initialized.' });
        setWaErrorDetails(data.details || data.message || 'Verification failed. Make sure your WhatsApp session in WAHA is active and QR code is scanned.');
        setShowWaErrorModal(true);
      }
      loadWhatsAppSettings();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'WhatsApp Connection test failed';
      toast(errMsg, 'error');
      setWaLastTestResult({ success: false, message: errMsg });
      setWaErrorDetails(
        err.response?.data?.details || 
        err.response?.data?.error || 
        JSON.stringify(err.response?.data) || 
        err.message || 
        'Could not reach self-hosted WAHA server. Make sure docker is running and url is correct.'
      );
      setShowWaErrorModal(true);
    } finally {
      setWaTesting(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'whatsapp') {
      loadWhatsAppSettings();
    }
  }, [activeTab]);

  useEffect(() => {
    if (settings) {
      setForm(settings);
      if (settings.logo) {
        setLogoMethod('file');
      } else if (settings.logoUrl) {
        setLogoMethod('url');
      } else {
        setLogoMethod('file');
      }
    }
  }, [settings]);

  useEffect(() => {
    if (!logo) {
      setFilePreview('');
      return;
    }
    const objectUrl = URL.createObjectURL(logo);
    setFilePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [logo]);

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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast('Maximum logo file size is 5 MB', 'error');
      e.target.value = '';
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast('Supported logo formats: PNG, JPG, JPEG, SVG, WEBP', 'error');
      e.target.value = '';
      return;
    }

    setLogo(file);
  };

  const saveSettings = async () => {
    try {
      let currentForm = { ...form };

      // Priority Logic check: If using uploaded logo, we upload it first
      if (logoMethod === 'file' && logo) {
        const fd = new FormData();
        fd.append('logo', logo);
        const { data } = await settingsApi.uploadLogo(fd);
        if (data?.settings) {
          currentForm.logo = data.settings.logo;
        }
      }

      await updateSettings(currentForm);
      toast('Company Profile saved successfully', 'success');
      setLogo(null);
      loadSettings();
    } catch (err) {
      toast(err.response?.data?.message || 'Save failed', 'error');
    }
  };

  const removeLogo = () => {
    setForm(prev => ({ ...prev, logo: '', logoUrl: '' }));
    setLogo(null);
    setFilePreview('');
    toast('Logo marked for removal. Save profile to apply.', 'info');
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

  // Database Management Handlers
  const handleDownloadBackup = async () => {
    try {
      toast('Generating database backup zip...', 'info');
      const response = await databaseApi.backup();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      
      const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
      link.setAttribute('download', `backup_${timestamp}_${user?.name?.replace(/\s+/g, '_') || 'Admin'}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast('✓ Database backup downloaded successfully', 'success');
    } catch (err) {
      toast('Backup download failed', 'error');
    }
  };

  const openConfirmationModal = (actionType) => {
    setDbActionType(actionType);
    setConfirmationStep(1);
    setTypedConfirmation('');
    setAdminPassword('');
    setDbCounts(null);
    setBackupFileName('');
    setSeededCredentials(null);
    setAlsoDeleteUsers(false);
    setActionSuccess(false);
    setDbModalOpen(true);
  };

  const handleStep1Submit = (e) => {
    e.preventDefault();
    if (typedConfirmation !== 'DELETE MY ERP') {
      toast('Please type the exact phrase to continue', 'error');
      return;
    }
    setConfirmationStep(2);
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    if (!adminPassword) {
      toast('Password is required', 'error');
      return;
    }
    setModalLoading(true);
    try {
      await databaseApi.verifyPassword(adminPassword);
      // Fetch DB counts for step 3
      const { data } = await databaseApi.getCounts();
      if (data.success) {
        setDbCounts(data.counts);
        setConfirmationStep(3);
      } else {
        toast('Failed to load database stats', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Password verification failed', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleExecution = async () => {
    setModalLoading(true);
    try {
      let res;
      if (dbActionType === 'reset-demo') {
        res = await databaseApi.resetDemoData(adminPassword, alsoDeleteUsers);
      } else if (dbActionType === 'clear-transactions') {
        res = await databaseApi.clearTransactions(adminPassword, alsoDeleteUsers);
      } else if (dbActionType === 'factory-reset') {
        res = await databaseApi.factoryReset(adminPassword);
      }

      if (res?.data?.success) {
        setBackupFileName(res.data.backupFileName || '');
        setSeededCredentials(res.data.credentials || null);
        setActionSuccess(true);
        setConfirmationStep(4);
      } else {
        toast('Action failed', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Database execution failed', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  const handleCompleteRedirect = () => {
    setDbModalOpen(false);
    toast('✅ Database Reset Completed. Logging out...', 'success');
    logout();
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
          className={`rm-tab-btn ${activeTab === 'whatsapp' ? 'active' : ''}`}
          onClick={() => handleTabChange('whatsapp')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'whatsapp' ? '3px solid #ff9800' : '3px solid transparent',
            color: activeTab === 'whatsapp' ? '#ff9800' : '#64748b',
          }}
        >
          💬 CRM WhatsApp
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
        {user?.role === 'Super Admin' && (
          <button
            type="button"
            className={`rm-tab-btn ${activeTab === 'database' ? 'active' : ''}`}
            onClick={() => handleTabChange('database')}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.9rem',
              borderBottom: activeTab === 'database' ? '3px solid #ff9800' : '3px solid transparent',
              color: activeTab === 'database' ? '#ff9800' : '#64748b',
            }}
          >
            ⚙️ Database Management
          </button>
        )}
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'pwa_install' ? 'active' : ''}`}
          onClick={() => handleTabChange('pwa_install')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'pwa_install' ? '3px solid #ff9800' : '3px solid transparent',
            color: activeTab === 'pwa_install' ? '#ff9800' : '#64748b',
          }}
        >
          📲 App Installation
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'help' ? 'active' : ''}`}
          onClick={() => handleTabChange('help')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'help' ? '3px solid #ff9800' : '3px solid transparent',
            color: activeTab === 'help' ? '#ff9800' : '#64748b',
          }}
        >
          ❓ Help & Support
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
              <label>Company Website URL</label>
              <input type="url" className="form-control" placeholder="e.g. https://mycompany.com" value={form.websiteUrl || ''} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} />
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
              <label>Invoice Paper Size</label>
              <select className="form-control" value={form.paperSize || 'A4'} onChange={(e) => setForm({ ...form, paperSize: e.target.value })}>
                <option value="A4">A4 Portrait</option>
                <option value="A5">A5 Portrait (Billing Printer)</option>
                <option value="Thermal 80mm">Thermal 80mm</option>
                <option value="Thermal 58mm">Thermal 58mm</option>
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
              <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '1rem', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📍 SFA & CRM Beat Configurations</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label>GPS Check-In Radius Limit (meters)</label>
                  <input
                    type="number"
                    className="form-control"
                    value={form.checkInRadius ?? 100}
                    onChange={(e) => setForm({ ...form, checkInRadius: Number(e.target.value) })}
                  />
                </div>
                <div className="form-group">
                  <label>Same-Day Order Cutoff Hour (24h format)</label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    className="form-control"
                    value={form.sameDayCutoffHour ?? 13}
                    onChange={(e) => setForm({ ...form, sameDayCutoffHour: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label>Default Customer Map Engine</label>
                  <select
                    className="form-control"
                    value={form.mapProvider || 'osm'}
                    onChange={(e) => setForm({ ...form, mapProvider: e.target.value })}
                  >
                    <option value="osm">OpenStreetMap (OSM) / Leaflet (Default Free)</option>
                    <option value="google">Google Maps Web Integration</option>
                    <option value="mapbox">Mapbox Professional Maps</option>
                    <option value="here">HERE Enterprise Location Suite</option>
                  </select>
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

        {/* PWA App Installation Tab */}
        {activeTab === 'pwa_install' && (
          <div className="card" style={{ maxWidth: 650, padding: '2rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: 'var(--shadow)', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '2.5rem' }}>📲</span>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#5a2d0c' }}>App Installation</h3>
                <p style={{ margin: '0.15rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>Configure and track Progressive Web App (PWA) status.</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Glassmorphic Diagnostics Status Block */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.6), rgba(241, 245, 249, 0.4))',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                borderRadius: '12px',
                padding: '1.25rem',
                backdropFilter: 'blur(8px)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#475569' }}>PWA Status:</span>
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    backgroundColor: isInstalled ? '#dcfce7' : '#fee2e2',
                    color: isInstalled ? '#16a34a' : '#dc2626'
                  }}>
                    {isInstalled ? 'Installed ✅' : 'Not Installed ❌'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#475569' }}>App Version:</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                    1.2.0 (PWA-Enabled)
                  </span>
                </div>

                {isInstallable && !isInstalled && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={installApp}
                      style={{
                        backgroundColor: '#5a2d0c',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '0.6rem 1.5rem',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        boxShadow: '0 4px 6px rgba(90, 45, 12, 0.15)',
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#401e07';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#5a2d0c';
                      }}
                    >
                      Install AO ERP App
                    </button>
                  </div>
                )}
              </div>

              {/* Advantages List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#334155' }}>
                  PWA Key Advantages & Capabilities:
                </h4>
                {[
                  { label: 'Offline Support', desc: 'Access product catalog, local cached dashboards, and record customer visits without internet.' },
                  { label: 'Push Notifications', desc: 'Receive real-time alerts for low stock levels, new sales leads, and dispatch approvals.' },
                  { label: 'Home Screen Icon', desc: 'Launches immediately from your home screen just like a native mobile application.' },
                  { label: 'Full Screen App', desc: 'No browser tabs or URL address bars to clutter your viewing experience.' },
                  { label: 'Auto Updates', desc: 'Updates automatically in the background to ensure you are always running version 1.2.0.' }
                ].map((item, index) => (
                  <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.85rem', lineHeight: '1.4' }}>
                    <span style={{ color: '#10b981', fontWeight: 'bold' }}>✓</span>
                    <div>
                      <strong style={{ color: '#1e293b' }}>{item.label}:</strong>{' '}
                      <span style={{ color: '#64748b' }}>{item.desc}</span>
                    </div>
                  </div>
                ))}
              </div>

            </div>
          </div>
        )}

        {/* Help & Support Tab */}
        {activeTab === 'help' && (
          <div className="card" style={{ maxWidth: 600, padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Help & Support</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              Welcome to AO ERP. If you need a refresher on how to navigate the platform, you can restart the guided user onboarding tour.
            </p>
            <div style={{ padding: '1.25rem', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>User Onboarding Tour</span>
              <span style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: '1.5' }}>
                Restart the guided tour of the ERP application. This will take you through the core modules and dashboard metrics.
              </span>
              <div style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={async () => {
                    if (confirm("Would you like to restart the onboarding tour?")) {
                      await updateTourCompleted(false);
                      toast("Tour status reset! Redirecting to dashboard to start...", "success");
                      window.location.href = "/";
                    }
                  }}
                  style={{
                    backgroundColor: '#5a2d0c',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none'
                  }}
                >
                  🔄 Restart User Tour
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Database Management Tab */}
        {activeTab === 'database' && user?.role === 'Super Admin' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
            <div className="card" style={{ padding: '2rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                ⚙️ Database Management Control Panel
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.875rem', margin: '0 0 2rem 0' }}>
                Restricted operations for system administration. All modifications below will trigger an automatic backup, but should be handled with extreme care.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                {/* Action 1: Backup Database */}
                <div style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease-in-out'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>📥</span>
                      <strong style={{ fontSize: '1rem', color: '#1e293b' }}>Backup Database</strong>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '1.5rem' }}>
                      Download a full ZIP archive containing the SQLite database file and a complete JSON export of all database tables.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleDownloadBackup}
                    style={{ width: '100%', fontWeight: 700 }}
                  >
                    📥 Download Backup
                  </button>
                </div>

                {/* Action 2: Reset Demo Data */}
                <div style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease-in-out'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>🔄</span>
                      <strong style={{ fontSize: '1rem', color: '#1e293b' }}>Reset Demo Data</strong>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '1.5rem' }}>
                      Deletes all sample Customer, Product, Order, Invoice, and Payment records. <strong>Keeps Company Settings and Users.</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={() => openConfirmationModal('reset-demo')}
                    style={{ width: '100%', fontWeight: 700, backgroundColor: '#f97316', borderColor: '#f97316', color: '#fff' }}
                  >
                    🔄 Reset Demo Data
                  </button>
                </div>

                {/* Action 3: Clear Transactions */}
                <div style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease-in-out'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>🧹</span>
                      <strong style={{ fontSize: '1rem', color: '#1e293b' }}>Clear Transactions</strong>
                    </div>
                    <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '1.5rem' }}>
                      Deletes all Invoices, Payments, Sales Orders, Shipments, and Production logs. <strong>Keeps Customers, Products, and Users.</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-warning"
                    onClick={() => openConfirmationModal('clear-transactions')}
                    style={{ width: '100%', fontWeight: 700, backgroundColor: '#ea580c', borderColor: '#ea580c', color: '#fff' }}
                  >
                    🧹 Clear Transactions
                  </button>
                </div>

                {/* Action 4: Factory Reset */}
                <div style={{
                  border: '1px solid #fee2e2',
                  borderRadius: '10px',
                  padding: '1.5rem',
                  backgroundColor: '#fef2f2',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  transition: 'all 0.2s ease-in-out'
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>🚨</span>
                      <strong style={{ fontSize: '1rem', color: '#991b1b' }}>Factory Reset ERP</strong>
                    </div>
                    <p style={{ color: '#991b1b', fontSize: '0.85rem', lineHeight: '1.4', marginBottom: '1.5rem' }}>
                      Completely drops and syncs all database tables. Re-seeds only default role users and first-install settings. <strong>Wipes everything.</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => openConfirmationModal('factory-reset')}
                    style={{ width: '100%', fontWeight: 700 }}
                  >
                    🚨 Factory Reset ERP
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* WhatsApp Integration Tab */}
        {activeTab === 'whatsapp' && (
          <div className="card" style={{ maxWidth: 600, padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              💬 CRM WhatsApp Configurations
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              Configure your Custom CRM WhatsApp gateway credentials. 
              Only Super Admin users can modify these settings.
            </p>

            {waLoading ? <LoadingSpinner /> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>CRM Base URL</label>
                  <input 
                    type="url"
                    className="form-control" 
                    placeholder="e.g. http://localhost:5000/api/whatsapp/mock-crm"
                    value={waForm.crmBaseUrl || waForm.apiUrl || ''} 
                    onChange={(e) => setWaForm({ ...waForm, crmBaseUrl: e.target.value, apiUrl: e.target.value })}
                    disabled={!isSuperAdmin || waSaving}
                  />
                  <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    Enter the URL of your Custom CRM integration endpoint.
                  </small>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>CRM API Key</label>
                  <input 
                    type="password"
                    className="form-control" 
                    placeholder={waForm.crmApiKey || waForm.apiKey ? '********' : 'Enter CRM API Key'}
                    value={waForm.crmApiKey || waForm.apiKey || ''} 
                    onChange={(e) => setWaForm({ ...waForm, crmApiKey: e.target.value, apiKey: e.target.value })}
                    disabled={!isSuperAdmin || waSaving}
                  />
                  <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    API Key for authenticating with the Custom CRM gateway.
                  </small>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>CRM Secret Key</label>
                  <input 
                    type="password"
                    className="form-control" 
                    placeholder={waForm.crmSecret || waForm.instanceId ? '********' : 'Enter CRM Secret Key'}
                    value={waForm.crmSecret || waForm.instanceId || ''} 
                    onChange={(e) => setWaForm({ ...waForm, crmSecret: e.target.value, instanceId: e.target.value })}
                    disabled={!isSuperAdmin || waSaving}
                  />
                  <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    Secret Key used for secure gateway validation.
                  </small>
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>Webhook URL / Secret (Optional)</label>
                  <input 
                    type="text"
                    className="form-control" 
                    placeholder="Enter webhook secret or endpoint"
                    value={waForm.webhookUrl || ''} 
                    onChange={(e) => setWaForm({ ...waForm, webhookUrl: e.target.value })}
                    disabled={!isSuperAdmin || waSaving}
                  />
                  <small style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    Used for incoming status confirmations (Sent, Delivered, Read).
                  </small>
                </div>

                {/* Premium WhatsApp Connection Status Card */}
                <div style={{
                  background: waForm.status === 'Connected' 
                    ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))' 
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.05))',
                  border: waForm.status === 'Connected' 
                    ? '1px solid rgba(16, 185, 129, 0.2)' 
                    : '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  marginTop: '0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '1.5rem' }}>{waForm.status === 'Connected' ? '✅' : '❌'}</span>
                      <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                        WhatsApp Gateway: {waForm.status === 'Connected' ? 'Connected & Active' : 'Disconnected'}
                      </strong>
                    </div>
                    {waForm.status !== 'Connected' && (
                      <button
                        type="button"
                        onClick={() => setShowWaErrorModal(true)}
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.1)',
                          color: '#ef4444',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        ⚠️ View Details
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#475569' }}>
                    <strong>Gateway Address:</strong> {waForm.crmBaseUrl || waForm.apiUrl || 'N/A'}
                  </div>
                  {waLastTestResult && (
                    <div style={{ 
                      fontSize: '0.8rem', 
                      backgroundColor: 'rgba(255, 255, 255, 0.5)', 
                      padding: '0.5rem', 
                      borderRadius: '6px', 
                      border: '1px solid rgba(0,0,0,0.05)',
                      color: waLastTestResult.success ? '#16a34a' : '#dc2626'
                    }}>
                      <strong>Last Connection Attempt Result:</strong> {waLastTestResult.message || (waLastTestResult.success ? 'Success' : 'Failed')}
                    </div>
                  )}
                </div>

                {isSuperAdmin && (
                  <div style={{ display: 'flex', gap: '0.75rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={testWhatsAppConnection}
                      disabled={waTesting || waSaving}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      {waTesting ? 'Testing...' : '🔌 Test Connection'}
                    </button>
                    <button 
                      type="button" 
                      className="btn btn-primary" 
                      onClick={saveWhatsAppSettings}
                      disabled={waSaving || waTesting}
                    >
                      {waSaving ? 'Saving...' : '💾 Save Settings'}
                    </button>
                  </div>
                )}

                {/* CRM WhatsApp Test Center */}
                <div style={{
                  borderTop: '1px solid #e2e8f0',
                  paddingTop: '1.5rem',
                  marginTop: '1.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
                    🛠️ CRM WhatsApp Test Center
                  </h4>
                  <p style={{ color: '#64748b', fontSize: '0.8rem', margin: 0 }}>
                    Perform diagnostic triggers to test message formats, check delivery logs, and retry failed transmissions.
                  </p>
                  
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.75rem',
                    marginTop: '0.5rem'
                  }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleSendTestMessage}
                      disabled={waTestingMsg || waForm.status !== 'Connected'}
                      style={{ fontSize: '0.8rem', padding: '0.5rem', fontWeight: 600 }}
                    >
                      {waTestingMsg ? 'Sending...' : '💬 Send Test Message'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleSendTestCatalogue}
                      disabled={waTestingCat || waForm.status !== 'Connected'}
                      style={{ fontSize: '0.8rem', padding: '0.5rem', fontWeight: 600 }}
                    >
                      {waTestingCat ? 'Sending...' : '📁 Test Catalogue'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleSendTestInvoice}
                      disabled={waTestingInv || waForm.status !== 'Connected'}
                      style={{ fontSize: '0.8rem', padding: '0.5rem', fontWeight: 600 }}
                    >
                      {waTestingInv ? 'Sending...' : '📄 Test Invoice'}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => navigate('/crm/whatsapp-logs')}
                      style={{ fontSize: '0.8rem', padding: '0.5rem', fontWeight: 600, backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', color: '#475569' }}
                    >
                      📊 View Logs
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleRetryFailedLogs}
                      disabled={waRetrying}
                      style={{ fontSize: '0.8rem', padding: '0.5rem', fontWeight: 600, backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#ef4444' }}
                    >
                      {waRetrying ? 'Retrying...' : '🔄 Retry Failed'}
                    </button>
                  </div>
                  {waForm.status !== 'Connected' && (
                    <small style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 500 }}>
                      ⚠️ Connect the gateway to enable test message, catalogue, and invoice dispatch features.
                    </small>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Database Confirmation Modal */}
      {dbModalOpen && (
        <Modal
          title={
            dbActionType === 'reset-demo'
              ? '🔄 Reset Demo Data Warning'
              : dbActionType === 'clear-transactions'
              ? '🧹 Clear Transactions Warning'
              : '🚨 Factory Reset ERP Warning'
          }
          onClose={confirmationStep === 4 ? undefined : () => setDbModalOpen(false)}
          footer={
            confirmationStep === 4 ? null : (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDbModalOpen(false)}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                {confirmationStep === 1 && (
                  <button
                    type="submit"
                    form="db-confirm-step1-form"
                    className="btn btn-primary"
                    disabled={typedConfirmation !== 'DELETE MY ERP'}
                  >
                    Next Step
                  </button>
                )}
                {confirmationStep === 2 && (
                  <button
                    type="submit"
                    form="db-confirm-step2-form"
                    className="btn btn-primary"
                    disabled={modalLoading || !adminPassword}
                  >
                    Verify Password
                  </button>
                )}
                {confirmationStep === 3 && (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleExecution}
                    disabled={modalLoading}
                    style={{ backgroundColor: '#dc2626', borderColor: '#dc2626', color: '#fff' }}
                  >
                    {modalLoading ? 'Executing reset...' : 'Delete Forever'}
                  </button>
                )}
              </>
            )
          }
        >
          {modalLoading && confirmationStep !== 4 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem 0', gap: '1rem' }}>
              <LoadingSpinner />
              <span style={{ fontSize: '0.9rem', color: '#4b5563', fontWeight: 600 }}>
                {confirmationStep === 2 ? 'Verifying Super Admin status...' : 'Generating auto-backup archive and clearing records...'}
              </span>
            </div>
          ) : (
            <>
              {confirmationStep === 1 && (
                <form id="db-confirm-step1-form" onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fee2e2', borderRadius: '8px', padding: '1rem', color: '#b91c1c' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '0.95rem' }}>⚠️ CRITICAL DESTRUCTIVE ACTION</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
                      You are about to execute a destructive database operation. This action cannot be undone. 
                      Although an automatic system backup ZIP will be saved on the server, all active transactions/master-records specified will be wiped out.
                    </p>
                  </div>
                  {(dbActionType === 'reset-demo' || dbActionType === 'clear-transactions') && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer', margin: '0.5rem 0', color: '#374151' }}>
                      <input 
                        type="checkbox" 
                        checked={alsoDeleteUsers} 
                        onChange={(e) => setAlsoDeleteUsers(e.target.checked)} 
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span>Also delete all user accounts except mine</span>
                    </label>
                  )}
                  <div className="form-group">
                    <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
                      To proceed, please type <code style={{ backgroundColor: '#f3f4f6', padding: '0.15rem 0.4rem', borderRadius: '4px', color: '#dc2626', fontWeight: 700 }}>DELETE MY ERP</code> below:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      style={{ marginTop: '0.5rem', textTransform: 'uppercase' }}
                      placeholder="DELETE MY ERP"
                      value={typedConfirmation}
                      onChange={(e) => setTypedConfirmation(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </form>
              )}

              {confirmationStep === 2 && (
                <form id="db-confirm-step2-form" onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '8px', padding: '1rem', color: '#1e40af' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '0.95rem' }}>🔒 IDENTITY VERIFICATION</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
                      This is a Super Admin only operation. Please enter your account password to verify your authorization level.
                    </p>
                  </div>
                  <div className="form-group">
                    <label style={{ fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>Super Admin Password</label>
                    <input
                      type="password"
                      className="form-control"
                      style={{ marginTop: '0.5rem' }}
                      placeholder="Enter password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </form>
              )}

              {confirmationStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '1rem', color: '#92400e' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '0.95rem' }}>📊 SYSTEM RECORD COUNTS IMPACT</h4>
                    <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
                      Please review the counts of active data rows that will be deleted or impacted by this reset:
                    </p>
                  </div>

                  {dbCounts && (
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                      gap: '0.75rem',
                      backgroundColor: '#f8fafc',
                      padding: '1rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0'
                    }}>
                      {[
                        { label: 'Customers', count: dbCounts.customers, key: 'customers' },
                        { label: 'Products', count: dbCounts.products, key: 'products' },
                        { label: 'Orders', count: dbCounts.orders, key: 'orders' },
                        { label: 'Invoices', count: dbCounts.invoices, key: 'invoices' },
                        { label: 'Payments', count: dbCounts.payments, key: 'payments' },
                        { label: 'Production Entries', count: dbCounts.productionEntries, key: 'productionEntries' },
                        { label: 'Raw Materials', count: dbCounts.rawMaterials, key: 'rawMaterials' },
                        { label: 'CRM Leads', count: dbCounts.leads, key: 'leads' },
                        { label: 'Visits', count: dbCounts.visits, key: 'visits' },
                      ].map((item) => (
                        <div key={item.key} style={{ padding: '0.5rem', backgroundColor: '#fff', border: '1px solid #f1f5f9', borderRadius: '6px', textAlign: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>{item.label}</span>
                          <strong style={{ fontSize: '1.1rem', color: '#0f172a' }}>{item.count}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#dc2626' }}>Are you absolutely sure? This cannot be undone.</span>
                  </div>
                </div>
              )}

              {confirmationStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '1.5rem 0', gap: '1rem' }}>
                  <span style={{ fontSize: '3rem' }}>✅</span>
                  <h4 style={{ fontWeight: 800, color: '#16a34a', margin: 0 }}>Database Operation Successful!</h4>
                  <p style={{ color: '#4b5563', fontSize: '0.9rem', maxWidth: '400px', margin: 0 }}>
                    The database has been cleared/reset as requested.
                  </p>
                  {backupFileName && (
                    <div style={{ backgroundColor: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', fontFamily: 'monospace', color: '#334155', wordBreak: 'break-all' }}>
                      <strong>Server Auto-Backup Archive:</strong><br />
                      {backupFileName}
                    </div>
                  )}
                  {seededCredentials && seededCredentials.length > 0 && (
                    <div style={{ width: '100%', textAlign: 'left', marginTop: '1rem', backgroundColor: '#fff7ed', border: '1px solid #ffedd5', padding: '1rem', borderRadius: '8px' }}>
                      <h5 style={{ margin: '0 0 0.5rem 0', color: '#ea580c', fontWeight: 700, fontSize: '0.9rem' }}>🔑 Generated Admin & Staff Credentials:</h5>
                      <p style={{ margin: '0 0 1rem 0', fontSize: '0.75rem', color: '#7c2d12', lineHeight: '1.4' }}>
                        Please copy these temporary credentials. You will be forced to set a new password on your first login.
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                        {seededCredentials.map((c, i) => (
                          <div key={i} style={{ fontSize: '0.75rem', fontFamily: 'monospace', borderBottom: '1px solid #fed7aa', paddingBottom: '0.25rem' }}>
                            <strong>{c.name} ({c.role}):</strong><br />
                            Email: <span style={{ color: '#0f172a' }}>{c.email}</span><br />
                            Password: <span style={{ color: '#dc2626', fontWeight: 'bold' }}>{c.password}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleCompleteRedirect}
                    style={{ padding: '0.6rem 2rem', fontWeight: 700, width: '100%', marginTop: '1rem' }}
                  >
                    Acknowledge & Logout
                  </button>
                </div>
              )}
            </>
          )}
        </Modal>
      )}

      {/* WhatsApp Connection Error Modal */}
      {showWaErrorModal && (
        <Modal
          title="💬 WhatsApp Connection Diagnostic Details"
          onClose={() => setShowWaErrorModal(false)}
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowWaErrorModal(false)}
            >
              Close
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', color: '#991b1b' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 700, fontSize: '0.95rem' }}>⚠️ GATEWAY CONNECTION FAILURE</h4>
              <p style={{ margin: 0, fontSize: '0.85rem', lineHeight: '1.4' }}>
                AO Core ERP tried to communicate with the Custom CRM WhatsApp API server but the request was unsuccessful or returned an error state.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <strong style={{ fontSize: '0.9rem', color: '#334155' }}>Diagnostic Steps to Resolve:</strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem', color: '#4b5563' }}>
                <div>1. 🔑 <strong>Verify API Key & Secret:</strong> Make sure your API Key and Secret are entered correctly in the settings.</div>
                <div>2. 🔗 <strong>Verify URL:</strong> Confirm that the CRM Base URL `{waForm.crmBaseUrl || waForm.apiUrl}` is correct and accessible from the server host.</div>
                <div>3. 🔌 <strong>Check CRM Status:</strong> Verify that the Custom CRM service is active and hasn't rate-limited or blocked your key.</div>
              </div>
            </div>

            {waErrorDetails && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <strong style={{ fontSize: '0.9rem', color: '#334155' }}>Error Message / Stack Trace:</strong>
                <pre style={{
                  backgroundColor: '#0f172a',
                  color: '#38bdf8',
                  padding: '1rem',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  margin: 0,
                  maxHeight: '200px',
                  overflowY: 'auto'
                }}>
                  {waErrorDetails}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* WhatsApp Dispatch Success Modal */}
      {showWaSuccessModal && waSuccessData && (
        <Modal
          title="🎉 WhatsApp Sent Successfully"
          onClose={() => setShowWaSuccessModal(false)}
          footer={
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowWaSuccessModal(false)}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                border: 'none',
                padding: '0.5rem 1.5rem',
                borderRadius: '8px',
                color: '#fff',
                fontWeight: 600,
                boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)',
                cursor: 'pointer'
              }}
            >
              Okay
            </button>
          }
        >
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            padding: '0.5rem'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '12px',
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5)'
            }}>
              <span style={{ fontSize: '2.5rem' }}>📱</span>
              <div>
                <h4 style={{ margin: 0, color: '#065f46', fontWeight: 700, fontSize: '1.1rem' }}>Message Dispatched</h4>
                <p style={{ margin: '0.25rem 0 0 0', color: '#047857', fontSize: '0.85rem' }}>
                  The message has been successfully routed via the CRM WhatsApp gateway.
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '1rem',
              display: 'grid',
              gridTemplateColumns: '1fr',
              gap: '0.75rem',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.02)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Customer Name:</span>
                <span style={{ color: '#1e293b', fontSize: '0.85rem', fontWeight: 600 }}>{waSuccessData.customerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Phone Number:</span>
                <span style={{ color: '#1e293b', fontSize: '0.85rem', fontWeight: 600 }}>+{waSuccessData.phone}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Message Type:</span>
                <span style={{ 
                  color: '#2563eb', 
                  fontSize: '0.8rem', 
                  fontWeight: 700,
                  backgroundColor: '#eff6ff',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid #bfdbfe'
                }}>{waSuccessData.messageType}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Timestamp:</span>
                <span style={{ color: '#1e293b', fontSize: '0.85rem', fontWeight: 600 }}>
                  {new Date(waSuccessData.timestamp).toLocaleString()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 500 }}>Reference ID:</span>
                <span style={{ 
                  color: '#475569', 
                  fontSize: '0.8rem', 
                  fontFamily: 'monospace',
                  backgroundColor: '#f1f5f9',
                  padding: '0.2rem 0.4rem',
                  borderRadius: '4px',
                  border: '1px solid #e2e8f0'
                }}>{waSuccessData.referenceId}</span>
              </div>
            </div>
          </div>
        </Modal>
      )}
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
  const [importType, setImportType] = useState('live_transaction'); // live_transaction or historical_import

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
        productDuplicatePolicy,
        is_historical_data: importType === 'historical_import'
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

    if (!confirm('🚨 CRITICAL WARNING: You are about to perform a full system database restore. This will completely overwrite all database tables including user accounts, permissions, and company settings. Your session may be re-authenticated or reloaded. We recommend backing up your current database first. Do you want to proceed?')) {
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
                <h4 style={{ fontWeight: 700, color: '#1e293b', marginBottom: '1rem' }}>Configure Deduplication Policies & Import Type</h4>
                <p style={{ fontSize: '0.9rem', color: '#475569', marginBottom: '1.5rem' }}>
                  Define individual conflict resolution rules and identify record classification types before executing data imports.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
                  {/* Import Settings */}
                  <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '1.5rem', marginBottom: '0.5rem' }}>
                    <h5 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#334155', marginBottom: '0.75rem' }}>⚙️ Import Type</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                      {[
                        { id: 'live_transaction', title: 'Business Transaction (GST Applicable)', desc: 'Standard business sales that will be included in statutory GST reports, GSTR sheets, and tax summaries.' },
                        { id: 'historical_import', title: 'Historical Analytics Data (GST Excluded)', desc: 'Historical ERP migration records that will populate analytics charts but will be excluded from GST returns.' }
                      ].map(opt => (
                        <label
                          key={opt.id}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '1rem',
                            border: importType === opt.id ? '2px solid #ff9800' : '1px solid #cbd5e1',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            backgroundColor: importType === opt.id ? '#fffbeb' : '#ffffff',
                            transition: 'all 0.15s ease-in-out'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <input
                              type="radio"
                              name="importType"
                              value={opt.id}
                              checked={importType === opt.id}
                              onChange={() => setImportType(opt.id)}
                              style={{ marginRight: '0.5rem', accentColor: '#ff9800' }}
                            />
                            <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>{opt.title}</strong>
                          </div>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: '1.3' }}>{opt.desc}</span>
                        </label>
                      ))}
                    </div>
                  </div>

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


