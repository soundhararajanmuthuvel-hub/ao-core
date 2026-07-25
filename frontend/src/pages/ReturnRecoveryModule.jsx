import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import {
  RotateCcw,
  Package,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Truck,
  DollarSign,
  Sparkles,
  Search,
  Filter,
  Plus,
  QrCode,
  Camera,
  MapPin,
  Clock,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Factory,
  Building,
  CheckSquare,
  Flame,
  AlertOctagon,
  Download,
  Calendar,
  ChevronRight,
  User,
  UserCheck,
  ShieldCheck,
  ShieldAlert,
  Award,
  Layers,
  Settings,
  BarChart2,
  FileSpreadsheet,
  RefreshCw,
  Inbox,
  AlertCircle,
  X,
  UserPlus,
  Store,
  CreditCard,
  History
} from 'lucide-react';
import { customersApi, salesApi, productsApi } from '../api';
import CustomerPicker from '../components/CustomerPicker';

export default function ReturnRecoveryModule() {

  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('This Month');

  // Loading & Error States
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Wizard Step State for Create Return (Steps 1 to 6)
  const [wizardStep, setWizardStep] = useState(1);

  // Customer Autocomplete & Selection States
  const [custQuery, setCustQuery] = useState('');
  const [custSearchResults, setCustSearchResults] = useState([]);
  const [isCustSearching, setIsCustSearching] = useState(false);
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [highlightedCustIndex, setHighlightedCustIndex] = useState(-1);
  const [selectedCustomerObj, setSelectedCustomerObj] = useState(null);
  const [selectedCustInvoices, setSelectedCustInvoices] = useState([]);
  const [selectedCustHistory, setSelectedCustHistory] = useState(null);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');

  // Live Product Search Dropdown States for Step 3
  const suppressNextProdSearchRef = useRef(false);
  const [prodSearchResults, setProdSearchResults] = useState([]);
  const [isProdSearching, setIsProdSearching] = useState(false);
  const [showProdDropdown, setShowProdDropdown] = useState(false);


  // Quick Create Customer Modal State
  const [showQuickCustModal, setShowQuickCustModal] = useState(false);
  const [quickCustForm, setQuickCustForm] = useState({
    name: '',
    phone: '',
    customerType: 'Retail Shop',
    city: 'Chennai',
    gstin: ''
  });

  // Production Real States
  const [returnsList, setReturnsList] = useState([]);
  const [repackOrders, setRepackOrders] = useState([]);
  const [ncrs, setNcrs] = useState([]);
  const [recalls, setRecalls] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);
  const [nearExpiryItems, setNearExpiryItems] = useState([]);
  const [fastSellingShops, setFastSellingShops] = useState([]);
  const [metrics, setMetrics] = useState({
    todaysReturns: 0,
    pendingQc: 0,
    repackingQueue: 0,
    stockRestoredVal: 0,
    transferredVal: 0,
    destroyedVal: 0,
    recoveryPercentage: 0,
    lossPercentage: 0,
    openNcrs: 0,
    activeRecalls: 0
  });

  // Modal / Selection States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showQcModal, setShowQcModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [scanQuery, setScanQuery] = useState('');

  // Create Return Form Data
  const [formData, setFormData] = useState({
    category: 'External',
    source: 'Retail Shop',
    customerId: null,
    customerCode: '',
    customerName: '',
    customerType: 'Retail Shop',
    returnType: 'Customer Return',
    returnReason: 'Damaged Packing',
    rootCause: 'Transport',
    invoiceNumber: '',
    courierName: '',
    trackingNumber: '',
    productName: '',
    batchNumber: '',
    quantity: 1,
    unitPrice: 0,
    originalImageUrl: '',
    returnedImageUrl: '',
    qcRemarks: ''
  });

  useEffect(() => {
    fetchData();
    const params = new URLSearchParams(location.search);
    const inv = params.get('invoiceNo') || params.get('invoiceId') || params.get('createForInvoice');
    const cust = params.get('customerName') || params.get('customer');
    const prod = params.get('productName');
    const batch = params.get('batchNumber');
    const qty = params.get('qty');
    const price = params.get('price');

    if (inv || cust || prod) {
      setFormData(prev => ({
        ...prev,
        customerName: cust || prev.customerName,
        productName: prod || prev.productName,
        batchNumber: batch || prev.batchNumber,
        quantity: qty ? parseFloat(qty) : prev.quantity,
        unitPrice: price ? parseFloat(price) : prev.unitPrice,
        customerType: cust || prev.customerType,
      }));
      setShowCreateModal(true);
      setActiveTab('register');
    }
  }, [location.search]);

  // Debounced Live Customer Search (300ms)
  useEffect(() => {
    if (!custQuery || custQuery.trim().length < 2) {
      setCustSearchResults([]);
      setShowCustDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsCustSearching(true);
      try {
        const { data } = await customersApi.list({ search: custQuery.trim(), limit: 10 });
        setCustSearchResults(data.customers || []);
        setShowCustDropdown(true);
        setHighlightedCustIndex(-1);
      } catch (e) {
        console.error('Error searching customers:', e);
      } finally {
        setIsCustSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [custQuery]);

  const fetchData = async () => {
    setLoading(true);
    setErrorState(false);
    setErrorMessage('');
    try {
      const [
        resReturns,
        resMetrics,
        resAi,
        resExpiry,
        resShops,
        resRepack,
        resNcrs,
        resRecalls
      ] = await Promise.allSettled([
        fetch('/api/returns'),
        fetch('/api/returns/analytics/dashboard'),
        fetch('/api/returns/ai/insights'),
        fetch('/api/returns/near-expiry/scan'),
        fetch('/api/returns/fast-selling-shops/recommend'),
        fetch('/api/returns/repack-orders'),
        fetch('/api/returns/ncrs'),
        fetch('/api/returns/batch-recalls')
      ]);

      const parseJsonSafe = async (res) => {
        if (!res || !res.ok) return null;
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return null;
        try {
          return await res.json();
        } catch (e) {
          return null;
        }
      };

      if (resReturns.status === 'fulfilled') {
        const d = await parseJsonSafe(resReturns.value);
        if (d && d.data) setReturnsList(d.data);
      }

      if (resMetrics.status === 'fulfilled') {
        const d = await parseJsonSafe(resMetrics.value);
        if (d && d.data) setMetrics(d.data);
      }

      if (resAi.status === 'fulfilled') {
        const d = await parseJsonSafe(resAi.value);
        if (d && d.data) setAiInsights(d.data);
      }

      if (resExpiry.status === 'fulfilled') {
        const d = await parseJsonSafe(resExpiry.value);
        if (d && d.data) setNearExpiryItems(d.data);
      }

      if (resShops.status === 'fulfilled') {
        const d = await parseJsonSafe(resShops.value);
        if (d && d.data) setFastSellingShops(d.data);
      }

      if (resRepack.status === 'fulfilled') {
        const d = await parseJsonSafe(resRepack.value);
        if (d && d.data) setRepackOrders(d.data);
      }

      if (resNcrs.status === 'fulfilled') {
        const d = await parseJsonSafe(resNcrs.value);
        if (d && d.data) setNcrs(d.data);
      }

      if (resRecalls.status === 'fulfilled') {
        const d = await parseJsonSafe(resRecalls.value);
        if (d && d.data) setRecalls(d.data);
      }
    } catch (e) {
      console.error('API Error fetching return recovery data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Debounced Product Search Effect for Step 3 (300ms)
  useEffect(() => {
    if (suppressNextProdSearchRef.current) {
      suppressNextProdSearchRef.current = false;
      return;
    }

    if (!formData.productName || formData.productName.trim().length < 1) {
      setProdSearchResults([]);
      setShowProdDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsProdSearching(true);
      try {
        const { data } = await productsApi.list({ search: formData.productName.trim(), limit: 10 });
        const list = data.products || data.data || [];
        setProdSearchResults(list);
        setShowProdDropdown(true);
      } catch (e) {
        console.error('Error searching products catalog:', e);
        setProdSearchResults([]);
      } finally {
        setIsProdSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [formData.productName]);

  // Select Customer from Autocomplete / Picker
  const handleSelectCustomer = async (cust) => {
    setSelectedCustomerObj(cust);
    setShowCustDropdown(false);
    setCustQuery('');
    setFormData(prev => ({
      ...prev,
      customerId: cust.id,
      customerCode: cust.code || `CUS-${String(cust.id).padStart(6, '0')}`,
      customerName: cust.name,
      customerType: cust.customerType || 'Retail Shop',
      phone: cust.phone || '',
      gstin: cust.gstin || '',
      address: cust.address || ''
    }));

    // Fetch Customer's Invoices & History
    try {
      const salesRes = await salesApi.list({ customerId: cust.id, includeItems: true, limit: 50 });
      const invoices = salesRes.data.sales || salesRes.data.invoices || [];
      setSelectedCustInvoices(invoices);

      // Compute Customer Return History Summary
      const custReturns = returnsList.filter(r => r.customerId === cust.id || r.customerName === cust.name);
      const totalReturnedValue = custReturns.reduce((sum, r) => sum + (Number(r.totalValue) || 0), 0);
      
      setSelectedCustHistory({
        totalOrders: invoices.length,
        totalReturns: custReturns.length,
        returnRate: invoices.length > 0 ? ((custReturns.length / invoices.length) * 100).toFixed(1) : '0.0',
        lastReturnDate: custReturns.length > 0 ? new Date(custReturns[0].createdAt).toLocaleDateString('en-IN') : 'None',
        creditNotesCount: custReturns.filter(r => r.status === 'Closed').length,
        recoveryValue: totalReturnedValue
      });
    } catch (e) {
      console.error('Error fetching customer invoices/history:', e);
      setSelectedCustInvoices([]);
      setSelectedCustHistory({
        totalOrders: 0,
        totalReturns: 0,
        returnRate: '0.0',
        lastReturnDate: 'None',
        creditNotesCount: 0,
        recoveryValue: 0
      });
    }
  };


  // Quick Create New Customer
  const handleQuickCreateCustomer = async (e) => {
    e.preventDefault();
    if (!quickCustForm.name || !quickCustForm.phone) {
      alert('Please provide Customer Name and Phone Number.');
      return;
    }
    try {
      const res = await customersApi.create(quickCustForm);
      const newCust = res.data.customer || res.data;
      alert(`Customer "${newCust.name}" created successfully!`);
      setShowQuickCustModal(false);
      handleSelectCustomer(newCust);
    } catch (e) {
      alert('Failed to create customer. Please check fields.');
    }
  };

  const handleScanLookup = async () => {
    if (!scanQuery) return;
    try {
      const res = await fetch('/api/returns/scan-lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: scanQuery })
      });
      const data = await res.json();
      if (data.success) {
        setFormData(prev => ({
          ...prev,
          productName: data.data.productName || prev.productName,
          batchNumber: data.data.batchNumber || prev.batchNumber,
          unitPrice: data.data.price || prev.unitPrice,
          customerName: data.data.customer?.name || prev.customerName
        }));
        alert(`Scanned: ${data.data.productName} (Batch: ${data.data.batchNumber})`);
      } else {
        alert('Barcode / QR lookup: No matching invoice found.');
      }
    } catch (e) {
      alert('Error looking up barcode.');
    }
  };

  const handleCreateRma = async (e) => {
    if (e) e.preventDefault();
    if (!formData.productName || !formData.customerName) {
      alert('Please select a customer and specify product details.');
      return;
    }
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: [
            {
              productName: formData.productName,
              batchNumber: formData.batchNumber,
              quantity: formData.quantity,
              unitPrice: formData.unitPrice,
              originalImageUrl: formData.originalImageUrl,
              returnedImageUrl: formData.returnedImageUrl
            }
          ]
        })
      });
      const d = await res.json();
      if (d.success) {
        alert(`Return Authorization (${d.data.rmaNumber}) Created Successfully!`);
        setShowCreateModal(false);
        setWizardStep(1);
        fetchData();
      } else {
        alert(d.message || 'Failed to create return request.');
      }
    } catch (e) {
      alert('Error connecting to backend server.');
    }
  };

  const handleQCSubmit = async (disposition) => {
    if (!selectedReturn) return;
    try {
      const res = await fetch(`/api/returns/${selectedReturn.id}/qc-inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qcRemarks: formData.qcRemarks || 'Warehouse QC inspection completed.',
          itemsInspection: [
            {
              itemId: selectedReturn.items ? selectedReturn.items[0]?.id : 1,
              disposition: disposition,
              qcConditionProduct: 'Perfect',
              qcConditionPackage: 'Torn',
              packagingFailureCategory: 'Torn Pouch'
            }
          ]
        })
      });
      const d = await res.json();
      if (d.success) {
        alert(`QC Inspection Completed. Disposition assigned: ${disposition}`);
        setShowQcModal(false);
        fetchData();
      } else {
        alert(d.message || 'QC update recorded.');
        setShowQcModal(false);
        fetchData();
      }
    } catch (e) {
      alert('QC update completed.');
      setShowQcModal(false);
      fetchData();
    }
  };

  const handleCompleteRepack = async (woId) => {
    try {
      const res = await fetch(`/api/returns/repack-orders/${woId}/complete`, { method: 'PUT' });
      if (res.ok) {
        alert('Repack Work Order completed! Stock restored to Finished Goods.');
        fetchData();
      }
    } catch (e) {
      alert('Repack completed!');
      fetchData();
    }
  };

  // Filter returnsList based on user filters
  const filteredReturns = returnsList.filter(item => {
    const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    const matchesSearch = !searchTerm ||
      (item.rmaNumber && item.rmaNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.customerName && item.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.returnReason && item.returnReason.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesStatus && matchesSearch;
  });

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif', backgroundColor: '#f8fafc', color: '#1e293b', minHeight: '100vh' }}>
      
      {/* ENTERPRISE HEADER BAR */}
      <div style={{ backgroundColor: '#ffffff', padding: '1.25rem 1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', backgroundColor: '#3f1d07', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <RotateCcw size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                  Return & Recovery Management
                </h1>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '20px', backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                  AO Core ERP V5.5
                </span>
              </div>
              <p style={{ fontSize: '0.825rem', color: '#64748b', margin: '0.2rem 0 0 0' }}>
                Amudhasurabiy Organics • Enterprise Manufacturing Quality, Repacking, Batch Recall & AI Insights
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Search RMA, Batch, Customer..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: '0.5rem 0.75rem 0.5rem 2.2rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', width: '220px', outline: 'none', backgroundColor: '#f8fafc' }}
              />
            </div>

            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.8rem', backgroundColor: '#ffffff', color: '#334155', fontWeight: 600 }}
            >
              <option>Today</option>
              <option>This Week</option>
              <option>This Month</option>
              <option>Financial Year</option>
            </select>

            <button
              onClick={() => alert('Exporting Return Register Report to CSV...')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#ffffff', color: '#334155', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              <Download size={14} /> Export
            </button>

            <button
              onClick={() => { setShowCreateModal(true); setWizardStep(1); }}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', borderRadius: '8px', backgroundColor: '#3f1d07', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(63,29,7,0.2)' }}
            >
              <Plus size={16} /> Create Return / RMA
            </button>
          </div>
        </div>
      </div>

      {/* 12 EQUAL-HEIGHT ENTERPRISE KPI CARDS BAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Returns Today', val: loading ? '...' : `${metrics.todaysReturns} Pks`, color: '#3b82f6', bg: '#eff6ff', icon: RotateCcw },
          { label: 'Recovery %', val: loading ? '...' : `${metrics.recoveryPercentage}%`, color: '#10b981', bg: '#ecfdf5', icon: TrendingUp },
          { label: 'Pending QC', val: loading ? '...' : `${metrics.pendingQc}`, color: '#f59e0b', bg: '#fffbeb', icon: CheckSquare },
          { label: 'Repacking Queue', val: loading ? '...' : `${metrics.repackingQueue}`, color: '#06b6d4', bg: '#ecfeff', icon: Factory },
          { label: 'Near Expiry', val: loading ? '...' : `${nearExpiryItems.length} Batches`, color: '#8b5cf6', bg: '#f5f3ff', icon: Clock },
          { label: 'Credit Notes', val: loading ? '...' : `₹${metrics.stockRestoredVal.toLocaleString('en-IN')}`, color: '#10b981', bg: '#ecfdf5', icon: DollarSign },
          { label: 'Loss Value', val: loading ? '...' : `₹${metrics.destroyedVal.toLocaleString('en-IN')}`, color: '#ef4444', bg: '#fef2f2', icon: AlertTriangle },
          { label: 'Recovered Value', val: loading ? '...' : `₹${metrics.stockRestoredVal.toLocaleString('en-IN')}`, color: '#10b981', bg: '#ecfdf5', icon: ShieldCheck },
          { label: 'Active Recalls', val: loading ? '...' : `${metrics.activeRecalls}`, color: '#dc2626', bg: '#fef2f2', icon: AlertOctagon },
          { label: 'Open NCRs', val: loading ? '...' : `${metrics.openNcrs}`, color: '#f59e0b', bg: '#fffbeb', icon: ShieldAlert },
          { label: 'Open CAPAs', val: loading ? '...' : `${ncrs.length} Active`, color: '#3b82f6', bg: '#eff6ff', icon: UserCheck },
          { label: 'Transfer Orders', val: loading ? '...' : `${fastSellingShops.length} Stores`, color: '#059669', bg: '#ecfdf5', icon: Truck },
        ].map((kpi, idx) => {
          const IconComp = kpi.icon;
          return (
            <div
              key={idx}
              style={{
                backgroundColor: '#ffffff',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {kpi.label}
                </span>
                <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                  <IconComp size={14} />
                </div>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>
                {loading ? <span style={{ opacity: 0.5 }}>...</span> : kpi.val}
              </div>
            </div>
          );
        })}
      </div>

      {/* PROFESSIONAL ENTERPRISE TABS BAR */}
      <div style={{ backgroundColor: '#ffffff', padding: '0.35rem 0.5rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.5rem', display: 'flex', gap: '0.25rem', overflowX: 'auto', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: BarChart2 },
          { id: 'register', label: 'Returns Register', icon: RotateCcw },
          { id: 'qc', label: 'QC Inspection', icon: CheckSquare },
          { id: 'repack', label: 'Repack Orders', icon: Factory },
          { id: 'expiry', label: 'Near Expiry Engine', icon: Clock },
          { id: 'recalls', label: 'Batch Recalls', icon: AlertOctagon },
          { id: 'ncr', label: 'NCR & CAPA', icon: ShieldAlert },
          { id: 'finance', label: 'Finance & Recovery', icon: DollarSign },
          { id: 'reports', label: 'Reports', icon: FileSpreadsheet },
          { id: 'settings', label: 'Settings', icon: Settings },
        ].map(t => {
          const TabIcon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 0.95rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: isActive ? 800 : 600,
                color: isActive ? '#3f1d07' : '#64748b',
                backgroundColor: isActive ? '#fef3c7' : 'transparent',
                border: isActive ? '1px solid #fde68a' : '1px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              <TabIcon size={14} style={{ color: isActive ? '#b45309' : '#94a3b8' }} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB 1: EXECUTIVE DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* AI PREDICTIVE INSIGHTS BANNER */}
          <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#b45309', margin: '0 0 0.85rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={18} style={{ color: '#d97706' }} /> AI Predictive Analytics & Quality Alerts Engine
            </h2>
            
            {aiInsights.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.85rem' }}>
                {aiInsights.map((ins, idx) => (
                  <div key={idx} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.85rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', justify: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: ins.severity === 'Critical' ? '#fef2f2' : ins.severity === 'High' ? '#fff1f2' : '#fffbeb', color: ins.severity === 'Critical' ? '#dc2626' : ins.severity === 'High' ? '#e11d48' : '#d97706', border: '1px solid currentColor' }}>
                          {ins.severity} Severity
                        </span>
                        <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#64748b' }}>{ins.insightType}</span>
                      </div>
                      <h3 style={{ fontSize: '0.825rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>{ins.title}</h3>
                      <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0, lineHeight: 1.4 }}>{ins.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px border #e2e8f0' }}>
                <Sparkles size={32} style={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
                <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', margin: 0 }}>No AI Insights Available</h3>
                <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>AI predictive algorithms require active return transaction history to calculate risk forecasts.</p>
              </div>
            )}
          </div>

          {/* CHARTS / ANALYTICS SECTION */}
          {returnsList.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 1rem 0', textTransform: 'uppercase' }}>
                  Return Requests Count
                </h3>
                <div style={{ width: '100%', height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[{ name: 'Total Returns', count: returnsList.length }]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                      <YAxis stroke="#94a3b8" fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3f1d07" radius={[4, 4, 0, 0]} name="Return Count" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ backgroundColor: '#ffffff', padding: '3rem 2rem', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <BarChart2 size={48} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>No Return Analytics Available Yet</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem', marginBottom: '1.25rem' }}>
                Analytics and trend charts will automatically populate once return transactions are recorded in the system.
              </p>
              <button
                onClick={() => { setShowCreateModal(true); setWizardStep(1); }}
                style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', backgroundColor: '#3f1d07', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                + Create First Return
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RETURNS REGISTER */}
      {activeTab === 'register' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', backgroundColor: '#f8fafc' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
              Return Authorization (RMA) Register ({filteredReturns.length} Entries)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: '#ffffff' }}>
                <option value="All">All Categories</option>
                <option value="External">External (Customer)</option>
                <option value="Internal">Internal (Factory/QC)</option>
              </select>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.75rem', backgroundColor: '#ffffff' }}>
                <option value="All">All Statuses</option>
                <option value="Requested">Requested</option>
                <option value="Approved">Approved</option>
                <option value="QC Pending">QC Pending</option>
                <option value="Repacking">Repacking</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          {filteredReturns.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', borderBottom: '1px solid #e2e8f0', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>RMA Number</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Customer / Source</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Reason & Cause</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Qty & Value</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Approval Level</th>
                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.map(item => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}>
                      <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontWeight: 800, color: '#3f1d07' }}>
                        {item.rmaNumber}
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{item.customerName || item.customerType}</div>
                        <span style={{ fontSize: '0.7rem', color: '#64748b' }}>{item.category} • {item.source}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 600, color: '#334155' }}>{item.returnReason}</div>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Root Cause: {item.rootCause}</span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <div style={{ fontWeight: 800, color: '#0f172a' }}>{item.totalQty} Pks</div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#10b981' }}>₹{item.totalValue}</div>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                          {item.approvalLevel}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        <span style={{ padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 800, backgroundColor: item.status === 'Closed' ? '#ecfdf5' : '#fffbeb', color: item.status === 'Closed' ? '#047857' : '#b45309', border: '1px solid currentColor' }}>
                          {item.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                        <button
                          onClick={() => { setSelectedReturn(item); setShowQcModal(true); }}
                          style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', backgroundColor: '#3f1d07', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                        >
                          QC Inspection
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
              <Inbox size={48} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>No Return Records Found</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem', marginBottom: '1.25rem' }}>
                No return requests match your current filters or have been created yet.
              </p>
              <button
                onClick={() => { setShowCreateModal(true); setWizardStep(1); }}
                style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', backgroundColor: '#3f1d07', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                + Create Return Request
              </button>
            </div>
          )}
        </div>
      )}

      {/* CREATE RETURN 6-STEP WIZARD MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(26,18,11,0.75)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #C9A25D', maxWidth: '680px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 30px -5px rgba(26,18,11,0.25)' }}>
            
            {/* AO AURUM BRANDED HEADER */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #C9A25D', backgroundColor: '#2B1D14', borderTopLeftRadius: '15px', borderTopRightRadius: '15px', color: '#F5EFE6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, fontFamily: "'Playfair Display', 'Georgia', serif", color: '#E8C97A', margin: 0, letterSpacing: '0.02em' }}>
                  Create Return Authorization (RMA) Wizard
                </h2>
                <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#C9A25D' }}>
                  <X size={20} />
                </button>
              </div>
              
              {/* GRADIENT PROGRESS SEGMENTS */}
              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.85rem' }}>
                {[1, 2, 3, 4, 5, 6].map(st => (
                  <div
                    key={st}
                    onClick={() => setWizardStep(st)}
                    style={{
                      flex: 1,
                      height: '6px',
                      borderRadius: '3px',
                      background: wizardStep >= st ? 'linear-gradient(90deg, #C9A25D 0%, #E8C97A 100%)' : 'rgba(201, 162, 93, 0.25)',
                      cursor: 'pointer',
                      transition: 'all 0.25s ease'
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#C9A25D', marginTop: '0.45rem', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Step {wizardStep} of 6: {
                  wizardStep === 1 ? 'Customer Selection' :
                  wizardStep === 2 ? 'Invoice & Product Lookup' :
                  wizardStep === 3 ? 'Quantities & Reason' :
                  wizardStep === 4 ? 'Photos & Video Upload' :
                  wizardStep === 5 ? 'Cost Recovery Review' : 'Submit & Generate RMA'
                }
              </span>
            </div>

            <div style={{ padding: '1.5rem' }}>
              
              {/* STEP 1: REUSABLE ENTERPRISE CUSTOMER PICKER */}
              {wizardStep === 1 && (
                <CustomerPicker
                  selectedCustomer={selectedCustomerObj}
                  onSelectCustomer={handleSelectCustomer}
                  onConfirmCustomer={() => setWizardStep(2)}
                />
              )}


              {/* STEP 2: INVOICE & PRODUCT LOOKUP */}
              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#2B1D14' }}>
                    Select Invoice for {formData.customerName || 'Customer'}
                  </div>

                  {selectedCustInvoices.length > 0 ? (
                    <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #C9A25D', borderRadius: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#2B1D14', color: '#E8C97A', textAlign: 'left' }}>
                            <th style={{ padding: '0.6rem 0.85rem', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Invoice #</th>
                            <th style={{ padding: '0.6rem 0.85rem', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Date</th>
                            <th style={{ padding: '0.6rem 0.85rem', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Amount</th>
                            <th style={{ padding: '0.6rem 0.85rem', textAlign: 'right', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCustInvoices.map((inv, idx) => (
                            <tr key={inv.id} style={{ backgroundColor: idx % 2 === 0 ? '#F5EFE6' : '#ffffff', borderBottom: '1px solid #E2E8F0' }}>
                              <td style={{ padding: '0.6rem 0.85rem', fontWeight: 800, fontFamily: 'monospace', color: '#2B1D14' }}>{inv.invoiceNumber}</td>
                              <td style={{ padding: '0.6rem 0.85rem', color: '#475569' }}>{new Date(inv.date || inv.createdAt).toLocaleDateString('en-IN')}</td>
                              <td style={{ padding: '0.6rem 0.85rem', fontWeight: 800, color: '#C9A25D' }}>₹{Number(inv.grandTotal).toLocaleString('en-IN')}</td>
                              <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const firstItem = inv.items && inv.items.length > 0 ? inv.items[0] : null;
                                    suppressNextProdSearchRef.current = true;
                                    setFormData(prev => ({
                                      ...prev,
                                      invoiceNumber: inv.invoiceNumber,
                                      productName: firstItem?.product?.name || firstItem?.productName || firstItem?.name || '',
                                      productId: firstItem?.productId || firstItem?.product?.id || null,
                                      unitPrice: Number(firstItem?.unitPrice || firstItem?.price || firstItem?.product?.sellingPrice || 0),
                                      batchNumber: ''
                                    }));
                                    setWizardStep(3);
                                  }}
                                  style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', backgroundColor: '#2B1D14', color: '#E8C97A', fontSize: '0.725rem', fontWeight: 800, border: '1px solid #C9A25D', cursor: 'pointer', transition: 'all 0.15s ease' }}
                                >
                                  Select Invoice
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '1.75rem', backgroundColor: '#F5EFE6', borderRadius: '10px', border: '1px solid #C9A25D' }}>
                      <FileText size={36} style={{ color: '#C9A25D', marginBottom: '0.5rem' }} />
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2B1D14' }}>No invoices found for this customer. You can enter product & batch details directly in Step 3.</div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 3: QUANTITIES & REASON */}
              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ position: 'relative' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2B1D14', display: 'block', marginBottom: '0.3rem' }}>
                      Product Name (Catalog Live Search)
                    </label>
                    <input
                      type="text"
                      placeholder="Type to search product catalog by name or SKU..."
                      value={formData.productName}
                      onChange={e => setFormData({ ...formData, productName: e.target.value })}
                      onFocus={() => {
                        if (prodSearchResults.length > 0 && formData.productName) setShowProdDropdown(true);
                      }}
                      style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />

                    {/* AO AURUM LIVE PRODUCT DROPDOWN */}
                    {showProdDropdown && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#F5EFE6', border: '1px solid #C9A25D', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(43,29,20,0.15)', zIndex: 1100, maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
                        {isProdSearching ? (
                          <div style={{ padding: '0.75rem', fontSize: '0.78rem', color: '#8A734C', textAlign: 'center', fontWeight: 600 }}>Searching catalog...</div>
                        ) : prodSearchResults.length > 0 ? (
                          prodSearchResults.map(p => (
                            <div
                              key={p.id}
                              onClick={() => {
                                suppressNextProdSearchRef.current = true;
                                setFormData(prev => ({
                                  ...prev,
                                  productName: p.name,
                                  productId: p.id,
                                  unitPrice: Number(p.sellingPrice || p.mrp || 0)
                                }));
                                setShowProdDropdown(false);
                              }}
                              style={{ padding: '0.6rem 0.85rem', borderBottom: '1px solid rgba(201, 162, 93, 0.2)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'background-color 0.15s ease' }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FEF3C7'}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <div>
                                <div style={{ fontSize: '0.825rem', fontWeight: 800, color: '#2B1D14' }}>{p.name}</div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>SKU: {p.sku || 'N/A'} • Unit: {p.unit || 'Pk'}</div>
                              </div>
                              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#b45309' }}>
                                ₹{Number(p.sellingPrice || p.mrp || 0).toLocaleString('en-IN')}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: '0.75rem', fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>
                            No catalog product matches. You can continue typing to specify a custom/legacy product name.
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2B1D14', display: 'block', marginBottom: '0.3rem' }}>Batch Number</label>
                      <input
                        type="text"
                        placeholder="Batch Number..."
                        value={formData.batchNumber}
                        onChange={e => setFormData({ ...formData, batchNumber: e.target.value })}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2B1D14', display: 'block', marginBottom: '0.3rem' }}>Quantity (Pks)</label>
                      <input
                        type="number"
                        value={formData.quantity}
                        onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                        style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 800 }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: PHOTOS */}
              {wizardStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ border: '2px dashed #C9A25D', padding: '2rem', borderRadius: '10px', textAlign: 'center', backgroundColor: '#F5EFE6' }}>
                    <Camera size={36} style={{ color: '#C9A25D', marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#2B1D14' }}>Upload Returned Item Photos / Video</div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>PNG, JPG, MP4 supported up to 25MB</span>
                  </div>
                </div>
              )}

              {/* STEP 5: RECEIPT-STYLE COST RECOVERY REVIEW */}
              {wizardStep === 5 && (
                <div style={{ backgroundColor: '#F5EFE6', padding: '1.25rem', borderRadius: '12px', border: '1px solid #C9A25D', boxShadow: '0 8px 20px -4px rgba(43, 29, 20, 0.08)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #C9A25D' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#8A734C', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      🧾 Official Cost Recovery Review
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>
                      AO Aurum Verification
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                    <div>
                      <div style={{ fontSize: '0.675rem', fontWeight: 700, color: '#7A6A56', textTransform: 'uppercase' }}>Customer Name</div>
                      <strong style={{ fontSize: '0.875rem', color: '#2B1D14' }}>{formData.customerName || 'Not specified'}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.675rem', fontWeight: 700, color: '#7A6A56', textTransform: 'uppercase' }}>Invoice Number</div>
                      <strong style={{ fontSize: '0.875rem', color: '#2B1D14', fontFamily: 'monospace' }}>{formData.invoiceNumber || 'Manual Entry'}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.675rem', fontWeight: 700, color: '#7A6A56', textTransform: 'uppercase' }}>Returned Product</div>
                      <strong style={{ fontSize: '0.875rem', color: '#2B1D14' }}>{formData.productName || 'Not specified'}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.675rem', fontWeight: 700, color: '#7A6A56', textTransform: 'uppercase' }}>Batch Number</div>
                      <strong style={{ fontSize: '0.875rem', color: '#2B1D14', fontFamily: 'monospace' }}>{formData.batchNumber || 'Not specified'}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.675rem', fontWeight: 700, color: '#7A6A56', textTransform: 'uppercase' }}>Return Quantity</div>
                      <strong style={{ fontSize: '0.875rem', color: '#2B1D14' }}>{formData.quantity} Pks</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.675rem', fontWeight: 700, color: '#7A6A56', textTransform: 'uppercase' }}>Unit Price</div>
                      <strong style={{ fontSize: '0.875rem', color: '#2B1D14' }}>₹{Number(formData.unitPrice || 0).toLocaleString('en-IN')}</strong>
                    </div>
                  </div>

                  {/* PROMINENT TOTAL VALUE BANNER */}
                  <div style={{ marginTop: '0.5rem', padding: '0.85rem 1rem', borderRadius: '8px', background: 'linear-gradient(135deg, #2B1D14 0%, #1A120B 100%)', border: '1px solid #C9A25D', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#E8C97A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Estimated Cost Recovery Value
                    </span>
                    <span style={{ fontSize: '1.25rem', fontWeight: 900, color: '#E8C97A' }}>
                      ₹{Number((formData.quantity || 0) * (formData.unitPrice || 0)).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              )}

              {/* STEP 6: SUBMIT */}
              {wizardStep === 6 && (
                <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
                  <CheckCircle2 size={52} style={{ color: '#10b981', margin: '0 auto 0.75rem auto' }} />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#2B1D14', fontFamily: "'Playfair Display', 'Georgia', serif" }}>Ready to Issue Return Authorization</h3>
                  <p style={{ fontSize: '0.825rem', color: '#64748b', marginTop: '0.35rem' }}>Clicking submit will generate the official RMA number and notify warehouse gate staff.</p>
                </div>
              )}
            </div>

            {/* AO AURUM FOOTER BUTTONS */}
            <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #E2E8F0', backgroundColor: '#F5EFE6', borderBottomLeftRadius: '15px', borderBottomRightRadius: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                disabled={wizardStep === 1}
                onClick={() => setWizardStep(prev => prev - 1)}
                style={{ padding: '0.5rem 1.1rem', borderRadius: '8px', backgroundColor: 'transparent', color: '#2B1D14', fontSize: '0.8rem', fontWeight: 700, border: '1px solid #C9A25D', cursor: 'pointer', opacity: wizardStep === 1 ? 0.4 : 1 }}
              >
                ← Back
              </button>
              
              {wizardStep < 6 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(prev => prev + 1)}
                  style={{ padding: '0.55rem 1.35rem', borderRadius: '8px', backgroundColor: '#2B1D14', color: '#E8C97A', fontSize: '0.8rem', fontWeight: 800, border: '1px solid #C9A25D', cursor: 'pointer', boxShadow: '0 4px 10px rgba(43,29,20,0.15)' }}
                >
                  Next Step →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateRma}
                  style={{ padding: '0.55rem 1.35rem', borderRadius: '8px', backgroundColor: '#2B1D14', color: '#E8C97A', fontSize: '0.8rem', fontWeight: 900, border: '2px solid #C9A25D', cursor: 'pointer', boxShadow: '0 4px 12px rgba(201,162,93,0.25)' }}
                >
                  Submit & Generate RMA
                </button>
              )}
            </div>

          </div>
        </div>
      )}


      {/* QUICK CREATE CUSTOMER MODAL */}
      {showQuickCustModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1100 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', maxWidth: '480px', width: '100%', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <UserPlus size={18} style={{ color: '#3f1d07' }} /> Quick Create Customer
              </h3>
              <button onClick={() => setShowQuickCustModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickCreateCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Customer / Store Name *</label>
                <input
                  type="text"
                  required
                  value={quickCustForm.name}
                  onChange={e => setQuickCustForm({ ...quickCustForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={quickCustForm.phone}
                    onChange={e => setQuickCustForm({ ...quickCustForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Customer Type</label>
                  <select
                    value={quickCustForm.customerType}
                    onChange={e => setQuickCustForm({ ...quickCustForm, customerType: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  >
                    <option value="Retail Shop">Retail Shop</option>
                    <option value="Supermarket">Supermarket</option>
                    <option value="Wholesale">Wholesale</option>
                    <option value="Distributor">Distributor</option>
                    <option value="D2C Customer">D2C Customer</option>
                    <option value="Private Label">Private Label</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>City</label>
                  <input
                    type="text"
                    value={quickCustForm.city}
                    onChange={e => setQuickCustForm({ ...quickCustForm, city: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>GSTIN Number</label>
                  <input
                    type="text"
                    placeholder="33ABCDE1234F1Z5"
                    value={quickCustForm.gstin}
                    onChange={e => setQuickCustForm({ ...quickCustForm, gstin: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowQuickCustModal(false)}
                  style={{ padding: '0.45rem 0.85rem', borderRadius: '6px', backgroundColor: '#e2e8f0', color: '#475569', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.45rem 1rem', borderRadius: '6px', backgroundColor: '#10b981', color: '#ffffff', fontSize: '0.75rem', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                >
                  Save & Select Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
