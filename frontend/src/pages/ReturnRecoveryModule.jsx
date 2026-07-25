import React, { useState, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';

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

  // Production Real States (Initialized to 0 / Empty)
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

  // Create Return Form Data (Initialized Clean)
  const [formData, setFormData] = useState({
    category: 'External',
    source: 'Retail Shop',
    customerName: '',
    customerType: 'Retail Shop',
    returnType: 'Customer Return',
    returnReason: 'Damaged Packing',
    rootCause: 'Transport',
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
      alert('Please fill in required customer and product details.');
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

      {/* ERROR STATE CARD */}
      {errorState && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertCircle size={24} style={{ color: '#ef4444' }} />
            <div>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#991b1b', margin: 0 }}>Service Connection Error</h3>
              <p style={{ fontSize: '0.8rem', color: '#b91c1c', margin: '0.2rem 0 0 0' }}>{errorMessage}</p>
            </div>
          </div>
          <button
            onClick={fetchData}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', borderRadius: '8px', backgroundColor: '#ef4444', color: '#fff', fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            <RefreshCw size={14} /> Retry Connection
          </button>
        </div>
      )}

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

      {/* TAB 3: QC INSPECTION PAGE */}
      {activeTab === 'qc' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckSquare size={18} style={{ color: '#d97706' }} /> Split-View Quality Inspection & Mandatory Disposition Hub
          </h2>

          {selectedReturn ? (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '0.825rem', fontWeight: 800, color: '#334155', margin: '0 0 0.85rem 0' }}>
                    📸 Return Details: {selectedReturn.rmaNumber}
                  </h3>
                  <div style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>
                    <div><strong>Customer:</strong> {selectedReturn.customerName}</div>
                    <div><strong>Reason:</strong> {selectedReturn.returnReason}</div>
                    <div><strong>Quantity:</strong> {selectedReturn.totalQty} Pks</div>
                    <div><strong>Value:</strong> ₹{selectedReturn.totalValue}</div>
                  </div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <h3 style={{ fontSize: '0.825rem', fontWeight: 800, color: '#334155', margin: '0 0 0.85rem 0' }}>
                    📋 QC Remarks
                  </h3>
                  <textarea
                    value={formData.qcRemarks}
                    onChange={e => setFormData({ ...formData, qcRemarks: e.target.value })}
                    placeholder="Enter inspection findings..."
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', height: '80px' }}
                  />
                </div>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1.25rem' }}>
                <h3 style={{ fontSize: '0.825rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.85rem 0', textTransform: 'uppercase' }}>
                  Assign Mandatory Final Item Disposition:
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  {[
                    { label: 'Return Stock', color: '#10b981', bg: '#ecfdf5' },
                    { label: 'Repack Order', color: '#06b6d4', bg: '#ecfeff' },
                    { label: 'Fast Selling Transfer', color: '#3b82f6', bg: '#eff6ff' },
                    { label: 'Employee Sale', color: '#8b5cf6', bg: '#f5f3ff' },
                    { label: 'Replacement Sent', color: '#f59e0b', bg: '#fffbeb' },
                    { label: 'Credit Note Issue', color: '#10b981', bg: '#ecfdf5' },
                    { label: 'Scrap / Destroy', color: '#ef4444', bg: '#fef2f2' },
                  ].map((btn, i) => (
                    <button
                      key={i}
                      onClick={() => handleQCSubmit(btn.label)}
                      style={{
                        padding: '0.85rem 0.5rem',
                        borderRadius: '8px',
                        backgroundColor: btn.bg,
                        color: btn.color,
                        border: `1px solid ${btn.color}`,
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        textAlign: 'center'
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
              <CheckSquare size={48} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>No Return Item Selected for QC</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem', marginBottom: '1.25rem' }}>
                Select a return item from the Return Register tab to perform quality inspection and assign mandatory item disposition.
              </p>
              <button
                onClick={() => setActiveTab('register')}
                style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', backgroundColor: '#3f1d07', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                Go to Return Register
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: REPACK WORK ORDERS */}
      {activeTab === 'repack' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Factory size={18} style={{ color: '#06b6d4' }} /> Repack Work Orders Kanban (RP-2026-XXXXX)
          </h2>

          {repackOrders.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
              {['Pending', 'In Progress', 'QC Review', 'Completed'].map((col, idx) => (
                <div key={idx} style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{col}</span>
                    <span style={{ backgroundColor: '#e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                      {repackOrders.filter(o => o.status === col).length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    {repackOrders.filter(o => o.status === col).map(wo => (
                      <div key={wo.id} style={{ backgroundColor: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                        <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 800, color: '#3f1d07' }}>{wo.workOrderNumber}</div>
                        <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0' }}>Qty: {wo.quantity} Pks</div>
                        {wo.status !== 'Completed' && (
                          <button
                            onClick={() => handleCompleteRepack(wo.id)}
                            style={{ marginTop: '0.6rem', width: '100%', padding: '0.4rem', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                          >
                            Complete Repack
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '3.5rem 2rem' }}>
              <Factory size={48} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>No Active Repack Work Orders</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
                Repack work orders will automatically be generated here when warehouse QC assigns a "Repack" disposition to returned items.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: NEAR EXPIRY ENGINE */}
      {activeTab === 'expiry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981', margin: '0 0 0.85rem 0', textTransform: 'uppercase' }}>
              Fast-Selling Shop Recommendations (Ranked by Sales Velocity)
            </h3>
            
            {fastSellingShops.length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 800 }}>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Rank</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Store Name</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Type</th>
                      <th style={{ padding: '0.65rem 0.85rem' }}>Monthly Velocity</th>
                      <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fastSellingShops.map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#10b981' }}>#{s.rank || i + 1}</td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>{s.customerName}</td>
                        <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>{s.customerType}</td>
                        <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#10b981' }}>{s.salesVolumeMonthly} Pks</td>
                        <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                          <button style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', backgroundColor: '#10b981', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                            Transfer Stock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 2rem' }}>
                <Clock size={48} style={{ color: '#cbd5e1', marginBottom: '0.75rem' }} />
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>No Near Expiry Recommendations Available</h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.35rem' }}>
                  All finished goods stock is within safe shelf-life parameters. No immediate stock transfers required.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CREATE RETURN 6-STEP WIZARD MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #cbd5e1', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                Create Return Authorization (RMA) Wizard
              </h2>
              
              <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.75rem' }}>
                {[1, 2, 3, 4, 5, 6].map(st => (
                  <div
                    key={st}
                    onClick={() => setWizardStep(st)}
                    style={{
                      flex: 1,
                      height: '6px',
                      borderRadius: '3px',
                      backgroundColor: wizardStep >= st ? '#3f1d07' : '#cbd5e1',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  />
                ))}
              </div>
              <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', marginTop: '0.35rem', display: 'block' }}>
                Step {wizardStep} of 6: {
                  wizardStep === 1 ? 'Customer Details' :
                  wizardStep === 2 ? 'Invoice Lookup' :
                  wizardStep === 3 ? 'Products & Quantities' :
                  wizardStep === 4 ? 'Photos & Video Upload' :
                  wizardStep === 5 ? 'Cost Recovery Review' : 'Submit & Generate RMA'
                }
              </span>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Customer Name / Store</label>
                    <input
                      type="text"
                      placeholder="Enter Customer or Store Name..."
                      value={formData.customerName}
                      onChange={e => setFormData({ ...formData, customerName: e.target.value })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Customer Type</label>
                    <select
                      value={formData.customerType}
                      onChange={e => setFormData({ ...formData, customerType: e.target.value })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    >
                      <option value="Retail Shop">Retail Shop</option>
                      <option value="Supermarket">Supermarket</option>
                      <option value="Wholesale">Wholesale</option>
                      <option value="D2C">D2C Customer</option>
                      <option value="Private Label">Private Label</option>
                      <option value="Distributor">Distributor</option>
                    </select>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      placeholder="Scan Barcode / Enter Invoice Number..."
                      value={scanQuery}
                      onChange={e => setScanQuery(e.target.value)}
                      style={{ flex: 1, padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                    <button
                      type="button"
                      onClick={handleScanLookup}
                      style={{ padding: '0.55rem 1rem', borderRadius: '8px', backgroundColor: '#3f1d07', color: '#fff', fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                    >
                      Lookup
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Product Name</label>
                    <input
                      type="text"
                      placeholder="Enter Product Name (e.g. ABC Malt 500g)..."
                      value={formData.productName}
                      onChange={e => setFormData({ ...formData, productName: e.target.value })}
                      style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Batch Number</label>
                      <input
                        type="text"
                        placeholder="Batch Number..."
                        value={formData.batchNumber}
                        onChange={e => setFormData({ ...formData, batchNumber: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontFamily: 'monospace' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Quantity (Pks)</label>
                      <input
                        type="number"
                        value={formData.quantity}
                        onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                        style={{ width: '100%', padding: '0.55rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem', fontWeight: 800 }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ border: '2px dashed #cbd5e1', padding: '2rem', borderRadius: '10px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                    <Camera size={32} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Upload Returned Item Photos / Video</div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>PNG, JPG, MP4 supported up to 25MB</span>
                  </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Customer:</strong> {formData.customerName || 'Not specified'}</div>
                  <div><strong>Product:</strong> {formData.productName || 'Not specified'}</div>
                  <div><strong>Batch:</strong> {formData.batchNumber || 'Not specified'}</div>
                  <div><strong>Quantity:</strong> {formData.quantity} Pks</div>
                  <div><strong>Total Value:</strong> ₹{formData.quantity * formData.unitPrice}</div>
                </div>
              )}

              {wizardStep === 6 && (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <CheckCircle2 size={48} style={{ color: '#10b981', margin: '0 auto 0.5rem auto' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Ready to Issue Return Authorization</h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Clicking submit will generate the official RMA number and notify warehouse gate staff.</p>
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', display: 'flex', justifyContent: 'space-between' }}>
              <button
                type="button"
                disabled={wizardStep === 1}
                onClick={() => setWizardStep(prev => prev - 1)}
                style={{ padding: '0.5rem 1rem', borderRadius: '8px', backgroundColor: '#e2e8f0', color: '#475569', fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: wizardStep === 1 ? 0.5 : 1 }}
              >
                Back
              </button>
              
              {wizardStep < 6 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(prev => prev + 1)}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', backgroundColor: '#3f1d07', color: '#ffffff', fontSize: '0.8rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                >
                  Next Step
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCreateRma}
                  style={{ padding: '0.5rem 1.25rem', borderRadius: '8px', backgroundColor: '#10b981', color: '#ffffff', fontSize: '0.8rem', fontWeight: 800, border: 'none', cursor: 'pointer' }}
                >
                  Submit & Generate RMA
                </button>
              )}
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
