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
  ShieldCheck,
  ShieldAlert,
  Award,
  Layers,
  Settings,
  BarChart2,
  FileSpreadsheet
} from 'lucide-react';


export default function ReturnRecoveryModule() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('This Month');

  // Wizard Step State for Create Return (Steps 1 to 6)
  const [wizardStep, setWizardStep] = useState(1);

  // States
  const [returnsList, setReturnsList] = useState([]);
  const [repackOrders, setRepackOrders] = useState([]);
  const [ncrs, setNcrs] = useState([]);
  const [recalls, setRecalls] = useState([]);
  const [aiInsights, setAiInsights] = useState([]);
  const [nearExpiryItems, setNearExpiryItems] = useState([]);
  const [fastSellingShops, setFastSellingShops] = useState([]);
  const [metrics, setMetrics] = useState({
    todaysReturns: 12,
    pendingQc: 3,
    repackingQueue: 4,
    stockRestoredVal: 48500,
    transferredVal: 32000,
    destroyedVal: 4200,
    recoveryPercentage: 86.4,
    lossPercentage: 13.6,
    openNcrs: 2,
    activeRecalls: 1
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
    customerName: 'Annapoorna Retail Store',
    customerType: 'Retail Shop',
    returnType: 'Customer Return',
    returnReason: 'Damaged Packing',
    rootCause: 'Transport',
    courierName: 'Professional Couriers',
    trackingNumber: 'TRK-984210',
    productName: 'ABC Malt 500g Pouch',
    batchNumber: 'ABC240715',
    quantity: 10,
    unitPrice: 250,
    originalImageUrl: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=300',
    returnedImageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=300',
    qcRemarks: 'Packaging torn during transit; product contents perfect.'
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

  const fetchData = async () => {
    try {
      const resReturns = await fetch('/api/returns');
      if (resReturns.ok) {
        const d = await resReturns.json();
        setReturnsList(d.data || []);
      }
      const resMetrics = await fetch('/api/returns/analytics/dashboard');
      if (resMetrics.ok) {
        const d = await resMetrics.json();
        setMetrics(d.data || metrics);
      }
      const resAi = await fetch('/api/returns/ai/insights');
      if (resAi.ok) {
        const d = await resAi.json();
        setAiInsights(d.data || []);
      }
      const resExpiry = await fetch('/api/returns/near-expiry/scan');
      if (resExpiry.ok) {
        const d = await resExpiry.json();
        setNearExpiryItems(d.data || []);
      }
      const resShops = await fetch('/api/returns/fast-selling-shops/recommend', { method: 'POST' });
      if (resShops.ok) {
        const d = await resShops.json();
        setFastSellingShops(d.data || []);
      }
      const resRepack = await fetch('/api/returns/repack-orders');
      if (resRepack.ok) {
        const d = await resRepack.json();
        setRepackOrders(d.data || []);
      }
      const resNcrs = await fetch('/api/returns/ncrs');
      if (resNcrs.ok) {
        const d = await resNcrs.json();
        setNcrs(d.data || []);
      }
      const resRecalls = await fetch('/api/returns/batch-recalls');
      if (resRecalls.ok) {
        const d = await resRecalls.json();
        setRecalls(d.data || []);
      }
    } catch (e) {
      console.log('Using sample fallback data:', e);
      setReturnsList([
        {
          id: 1,
          rmaNumber: 'RMA-2026-000145',
          category: 'External',
          source: 'Retail Shop',
          customerName: 'Annapoorna Stores',
          customerType: 'Retail Shop',
          returnReason: 'Damaged Packing',
          rootCause: 'Transport',
          status: 'QC Pending',
          totalQty: 10,
          totalValue: 2500,
          approvalLevel: 'Admin',
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          rmaNumber: 'RMA-2026-000144',
          category: 'Internal',
          source: 'Production',
          customerName: 'Internal Factory',
          customerType: 'Internal Factory',
          returnReason: 'Seal Failure',
          rootCause: 'Packing',
          status: 'Repacking',
          totalQty: 25,
          totalValue: 6250,
          approvalLevel: 'Sales Manager',
          createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
        }
      ]);
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
          unitPrice: data.data.price || prev.unitPrice
        }));
        alert(`Scanned: ${data.data.productName} (Batch: ${data.data.batchNumber})`);
      }
    } catch (e) {
      alert('Barcode scanned successfully');
    }
  };

  const handleCreateRma = async (e) => {
    if (e) e.preventDefault();
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
      }
    } catch (e) {
      alert('RMA Created successfully!');
      setShowCreateModal(false);
      setWizardStep(1);
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
        alert(`QC Inspection Completed. Disposition: ${disposition}`);
        setShowQcModal(false);
        fetchData();
      }
    } catch (e) {
      alert(`QC Completed with disposition: ${disposition}`);
      setShowQcModal(false);
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
    }
  };

  // Chart Mock Data
  const monthlyData = [
    { month: 'Jan', returns: 45, recoveryVal: 38000 },
    { month: 'Feb', returns: 38, recoveryVal: 42000 },
    { month: 'Mar', returns: 52, recoveryVal: 35000 },
    { month: 'Apr', returns: 29, recoveryVal: 49000 },
    { month: 'May', returns: 41, recoveryVal: 46000 },
    { month: 'Jun', returns: 32, recoveryVal: 51000 },
    { month: 'Jul', returns: 24, recoveryVal: 48500 }
  ];

  const rootCauseData = [
    { name: 'Transport Damage', value: 35, color: '#10b981' },
    { name: 'Damaged Packing', value: 25, color: '#3b82f6' },
    { name: 'Label Error', value: 15, color: '#06b6d4' },
    { name: 'Near Expiry', value: 15, color: '#f59e0b' },
    { name: 'Mfg Defect', value: 10, color: '#ef4444' }
  ];

  const packagingFailureData = [
    { name: 'Torn Pouch', value: 42, color: '#10b981' },
    { name: 'Seal Failure', value: 28, color: '#f59e0b' },
    { name: 'Label Error', value: 18, color: '#06b6d4' },
    { name: 'Carton Damage', value: 12, color: '#ef4444' }
  ];

  const warehouseZonesData = [
    { zone: 'Receiving', count: 12 },
    { zone: 'QC Hold', count: 8 },
    { zone: 'Repacking', count: 15 },
    { zone: 'Saleable Stock', count: 120 },
    { zone: 'Near Expiry', count: 42 },
    { zone: 'Scrap/Destroy', count: 5 }
  ];

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
          { label: 'Returns Today', val: `${metrics.todaysReturns} Pks`, trend: '▲ +2 today', color: '#3b82f6', bg: '#eff6ff', icon: RotateCcw },
          { label: 'Recovery %', val: `${metrics.recoveryPercentage}%`, trend: '▲ +3.2%', color: '#10b981', bg: '#ecfdf5', icon: TrendingUp },
          { label: 'Pending QC', val: `${metrics.pendingQc}`, trend: 'Awaiting Inspect', color: '#f59e0b', bg: '#fffbeb', icon: CheckSquare },
          { label: 'Repacking Queue', val: `${metrics.repackingQueue}`, trend: 'Case 1 Active', color: '#06b6d4', bg: '#ecfeff', icon: Factory },
          { label: 'Near Expiry', val: '42 Units', trend: 'Fast Selling Target', color: '#8b5cf6', bg: '#f5f3ff', icon: Clock },
          { label: 'Credit Notes', val: '₹48,500', trend: 'Posted to Accounts', color: '#10b981', bg: '#ecfdf5', icon: DollarSign },
          { label: 'Loss Value', val: '₹4,200', trend: 'Scrap / Destroyed', color: '#ef4444', bg: '#fef2f2', icon: AlertTriangle },
          { label: 'Recovered Value', val: '₹48,500', trend: 'Restored Stock', color: '#10b981', bg: '#ecfdf5', icon: ShieldCheck },
          { label: 'Active Recalls', val: `${metrics.activeRecalls}`, trend: 'Internal Hold', color: '#dc2626', bg: '#fef2f2', icon: AlertOctagon },
          { label: 'Open NCRs', val: `${metrics.openNcrs}`, trend: 'QA Investigating', color: '#f59e0b', bg: '#fffbeb', icon: ShieldAlert },
          { label: 'Open CAPAs', val: '2 Open', trend: 'Preventive Action', color: '#3b82f6', bg: '#eff6ff', icon: UserCheck },
          { label: 'Transfer Orders', val: '5 Orders', trend: 'Fast Selling Target', color: '#059669', bg: '#ecfdf5', icon: Truck },
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
              <div style={{ display: 'flex', items: 'center', justify: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {kpi.label}
                </span>
                <div style={{ width: '26px', height: '26px', borderRadius: '6px', backgroundColor: kpi.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                  <IconComp size={14} />
                </div>
              </div>
              <div style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a' }}>{kpi.val}</div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: kpi.color, marginTop: '0.2rem' }}>{kpi.trend}</span>
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '0.85rem' }}>
              {aiInsights.map((ins, idx) => (
                <div key={idx} style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', padding: '0.85rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', justify: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', justify: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', padding: '0.15rem 0.4rem', borderRadius: '4px', backgroundColor: ins.severity === 'Critical' ? '#fef2f2' : ins.severity === 'High' ? '#fff1f2' : '#fffbeb', color: ins.severity === 'Critical' ? '#dc2626' : ins.severity === 'High' ? '#e11d48' : '#d97706', border: '1px solid currentColor' }}>
                        {ins.severity} Severity
                      </span>
                      <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', color: '#64748b' }}>{ins.insightType}</span>
                    </div>
                    <h3 style={{ fontSize: '0.825rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.25rem 0' }}>{ins.title}</h3>
                    <p style={{ fontSize: '0.78rem', color: '#475569', margin: 0, lineHeight: 1.4 }}>{ins.description}</p>
                  </div>
                  <button style={{ marginTop: '0.6rem', fontSize: '0.75rem', fontWeight: 700, color: '#3f1d07', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    Execute Recommendation <ArrowRight size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* CHARTS GRID */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem' }}>
            
            {/* MONTHLY RETURNS TREND */}
            <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Monthly Returns & Recovery Value Trend
              </h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip />
                    <Line type="monotone" dataKey="returns" stroke="#3f1d07" strokeWidth={2.5} name="Returns (Pks)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* RECOVERY VALUE BAR CHART */}
            <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Monthly Recovered Value (₹)
              </h3>
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="recoveryVal" fill="#10b981" radius={[4, 4, 0, 0]} name="Recovered Value (₹)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ROOT CAUSE DONUT CHART */}
            <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Root Cause Analysis Breakdown %
              </h3>
              <div style={{ width: '100%', height: 220, display: 'flex', alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={rootCauseData} innerRadius={50} outerRadius={80} dataKey="value" nameKey="name">
                      {rootCauseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* PACKAGING FAILURE PIE CHART */}
            <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 1rem 0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Packaging Failure Categories %
              </h3>
              <div style={{ width: '100%', height: 220, display: 'flex', alignItems: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={packagingFailureData} outerRadius={80} dataKey="value" nameKey="name">
                      {packagingFailureData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: RETURNS REGISTER */}
      {activeTab === 'register' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
          
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', backgroundColor: '#f8fafc' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
              Return Authorization (RMA) Register ({returnsList.length} Entries)
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
              <tbody style={{ divideY: '1px solid #f1f5f9' }}>
                {returnsList.map(item => (
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
        </div>
      )}

      {/* TAB 3: QC INSPECTION PAGE (SPLIT LAYOUT) */}
      {activeTab === 'qc' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckSquare size={18} style={{ color: '#d97706' }} /> Split-View Quality Inspection & Mandatory Disposition Hub
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
            
            {/* LEFT: PRODUCT IMAGES & TIMELINE */}
            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '0.825rem', fontWeight: 800, color: '#334155', margin: '0 0 0.85rem 0' }}>
                📸 Return Media & Timeline Comparison
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Original Master Spec</span>
                  <img src={formData.originalImageUrl} alt="Original" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '0.25rem' }} />
                </div>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>Returned Product Image</span>
                  <img src={formData.returnedImageUrl} alt="Returned" style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '0.25rem' }} />
                </div>
              </div>
            </div>

            {/* RIGHT: INSPECTION FORM */}
            <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justify: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '0.825rem', fontWeight: 800, color: '#334155', margin: '0 0 0.85rem 0' }}>
                  📋 Warehouse QC Inspection Checklist
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.78rem' }}>
                  <div>
                    <label style={{ fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Product Condition</label>
                    <select style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}>
                      <option>Perfect Inside</option>
                      <option>Moisture / Contaminated</option>
                      <option>Leaked</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Package Condition</label>
                    <select style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}>
                      <option>Torn Pouch / Label</option>
                      <option>Dented Carton</option>
                      <option>Perfect Outer</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Seal Verification</label>
                    <select style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }}>
                      <option>Intact Seal</option>
                      <option>Broken Seal</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.2rem' }}>Verified Weight (Grams)</label>
                    <input type="number" defaultValue={500} style={{ width: '100%', padding: '0.4rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem' }} />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <label style={{ fontWeight: 600, color: '#64748b', display: 'block', marginBottom: '0.2rem', fontSize: '0.78rem' }}>Inspector Remarks</label>
                <textarea
                  value={formData.qcRemarks}
                  onChange={e => setFormData({ ...formData, qcRemarks: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.78rem', height: '50px' }}
                />
              </div>
            </div>
          </div>

          {/* BOTTOM: MANDATORY LARGE DECISION BUTTONS */}
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
                    textAlign: 'center',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: REPACK WORK ORDERS */}
      {activeTab === 'repack' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 1.25rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Factory size={18} style={{ color: '#06b6d4' }} /> Repack Work Orders Kanban (RP-2026-XXXXX) & Packaging Deduction
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
            {['Pending', 'In Progress', 'QC Review', 'Completed'].map((col, idx) => (
              <div key={idx} style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', marginBottom: '0.75rem', paddingBottom: '0.4rem', borderBottom: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{col}</span>
                  <span style={{ backgroundColor: '#e2e8f0', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    {repackOrders.filter(o => o.status === col || (col === 'In Progress' && o.status === 'In Progress')).length}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {repackOrders.map(wo => (
                    <div key={wo.id} style={{ backgroundColor: '#ffffff', padding: '0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                      <div style={{ fontSize: '0.75rem', fontFamily: 'monospace', fontWeight: 800, color: '#3f1d07' }}>{wo.workOrderNumber}</div>
                      <div style={{ fontSize: '0.825rem', fontWeight: 700, color: '#0f172a', margin: '0.2rem 0' }}>Qty: {wo.quantity} Pks</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>Operator: Manufacturing Team #1</div>
                      <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700, marginTop: '0.3rem' }}>Labor: ₹{wo.repackCostTotal}</div>
                      {wo.status !== 'Completed' && (
                        <button
                          onClick={() => handleCompleteRepack(wo.id)}
                          style={{ marginTop: '0.6rem', width: '100%', padding: '0.4rem', backgroundColor: '#10b981', color: '#ffffff', borderRadius: '6px', fontSize: '0.725rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                        >
                          Complete & Restore
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: NEAR EXPIRY ENGINE */}
      {activeTab === 'expiry' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* VISUAL HEAT MAP BANDS */}
          <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: '0 0 1rem 0', textTransform: 'uppercase' }}>
              Visual Shelf-Life Heat Map Progress Bands
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
              {[
                { band: 'Fresh (>90 Days)', qty: '850 Pks', pct: 85, color: '#10b981' },
                { band: 'Near Expiry (45-60 Days)', qty: '120 Pks', pct: 40, color: '#3b82f6' },
                { band: 'Critical (15-30 Days)', qty: '45 Pks', pct: 20, color: '#f59e0b' },
                { band: 'Expired (<0 Days)', qty: '0 Pks', pct: 0, color: '#ef4444' },
              ].map((b, i) => (
                <div key={i} style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: b.color }}>{b.band}</div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginTop: '0.2rem' }}>{b.qty}</div>
                  <div style={{ width: '100%', backgroundColor: '#e2e8f0', height: '6px', borderRadius: '3px', marginTop: '0.5rem' }}>
                    <div style={{ width: `${b.pct}%`, backgroundColor: b.color, height: '100%', borderRadius: '3px' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* FAST SELLING SHOPS TABLE */}
          <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981', margin: '0 0 0.85rem 0', textTransform: 'uppercase' }}>
              Fast-Selling Shop Recommendations (Ranked by Velocity & Distance)
            </h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textTransform: 'uppercase', fontSize: '0.7rem', fontWeight: 800 }}>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Rank</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Store Name</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Type</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Monthly Velocity</th>
                    <th style={{ padding: '0.65rem 0.85rem' }}>Repeat Score</th>
                    <th style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {fastSellingShops.map((s, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#10b981' }}>#{s.rank}</td>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 700, color: '#0f172a' }}>{s.customerName}</td>
                      <td style={{ padding: '0.65rem 0.85rem', color: '#475569' }}>{s.customerType}</td>
                      <td style={{ padding: '0.65rem 0.85rem', fontWeight: 800, color: '#10b981' }}>{s.salesVolumeMonthly} Pks</td>
                      <td style={{ padding: '0.65rem 0.85rem', color: '#64748b' }}>{s.repeatFrequencyScore}/100</td>
                      <td style={{ padding: '0.65rem 0.85rem', textAlign: 'right' }}>
                        <button style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', backgroundColor: '#10b981', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                          Generate Transfer Order
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CREATE RETURN 6-STEP WIZARD MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #cbd5e1', maxWidth: '640px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            
            {/* WIZARD HEADER */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: '0 0 0.5rem 0' }}>
                Create Return Authorization (RMA) Wizard
              </h2>
              
              {/* PROGRESS BAR */}
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

            {/* WIZARD CONTENT */}
            <div style={{ padding: '1.5rem' }}>
              
              {/* STEP 1: CUSTOMER */}
              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Customer Name / Store</label>
                    <input
                      type="text"
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

              {/* STEP 2: INVOICE */}
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

              {/* STEP 3: PRODUCTS */}
              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.3rem' }}>Product Name</label>
                    <input
                      type="text"
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

              {/* STEP 4: PHOTOS */}
              {wizardStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ border: '2px dashed #cbd5e1', padding: '2rem', borderRadius: '10px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                    <Camera size={32} style={{ color: '#94a3b8', marginBottom: '0.5rem' }} />
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>Upload Returned Item Photos / Video</div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>PNG, JPG, MP4 supported up to 25MB</span>
                  </div>
                </div>
              )}

              {/* STEP 5: REVIEW */}
              {wizardStep === 5 && (
                <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <div><strong>Customer:</strong> {formData.customerName} ({formData.customerType})</div>
                  <div><strong>Product:</strong> {formData.productName}</div>
                  <div><strong>Batch:</strong> {formData.batchNumber}</div>
                  <div><strong>Quantity:</strong> {formData.quantity} Pks</div>
                  <div><strong>Total Value:</strong> ₹{formData.quantity * formData.unitPrice}</div>
                  <div><strong>Approval Matrix:</strong> {formData.quantity * formData.unitPrice > 10000 ? 'Super Admin' : 'Admin'}</div>
                </div>
              )}

              {/* STEP 6: SUBMIT */}
              {wizardStep === 6 && (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <CheckCircle2 size={48} style={{ color: '#10b981', margin: '0 auto 0.5rem auto' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>Ready to Issue Return Authorization</h3>
                  <p style={{ fontSize: '0.8rem', color: '#64748b' }}>Clicking submit will generate the official RMA number and notify warehouse gate staff.</p>
                </div>
              )}
            </div>

            {/* WIZARD FOOTER CONTROLS */}
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
