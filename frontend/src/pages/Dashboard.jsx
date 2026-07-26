import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { analyticsApi, productsApi, manufacturingApi, rawMaterialsApi, salesApi, customersApi, inventoryApi, shippingApi, integrationsApi, sfaApi, aiApi, returnsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { usePWA } from '../context/PWAContext';
import { resolveAssetUrl } from '../utils/url';
import LoadingSpinner from '../components/LoadingSpinner';
import { motion } from 'framer-motion';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
const COLORS = ['#2563eb', '#10b981', '#ff9800', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

function AnimatedNumber({ value }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const isCurrency = typeof value === 'string' && (value.includes('₹') || value.includes('Rs'));
    const cleanNum = typeof value === 'number' 
      ? value 
      : Number(String(value).replace(/[^0-9.-]+/g, '')) || 0;
      
    if (isNaN(cleanNum) || cleanNum <= 0) {
      setDisplayValue(value);
      return;
    }

    let start = 0;
    const end = cleanNum;
    const duration = 1200; // 1.2s count up
    const stepTime = 30;
    const totalSteps = duration / stepTime;
    const stepValue = end / totalSteps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      start += stepValue;
      if (step >= totalSteps) {
        clearInterval(timer);
        setDisplayValue(value);
      } else {
        if (typeof value === 'number') {
          setDisplayValue(Math.round(start));
        } else {
          const formatted = new Intl.NumberFormat('en-IN', { 
            style: 'currency', 
            currency: 'INR', 
            maximumFractionDigits: 0 
          }).format(Math.round(start));
          setDisplayValue(formatted);
        }
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{displayValue}</span>;
}

const StatCard = ({ label, value, subtext, className = '', style = {}, onClick }) => (
  <motion.div 
    className={`stat-card ${className}`}
    initial={{ opacity: 0, y: 15 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, ease: 'easeOut' }}
    whileHover={{ y: -4, boxShadow: '0 12px 20px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.05)' }}
    onClick={onClick}
    style={{
      backgroundColor: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '1.25rem',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
      flex: '1 1 200px',
      cursor: 'pointer',
      ...style
    }}
  >
    <div className="label" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem', ...style.labelStyle }}>{label}</div>
    <div className="value" style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)', ...style.valueStyle }}>
      {typeof value === 'object' ? value : <AnimatedNumber value={value} />}
    </div>
    {subtext && (
      <div className="subtext" style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--text-secondary)', opacity: 0.8, ...style.subtextStyle }}>
        {subtext}
      </div>
    )}
  </motion.div>
);

function AiSuggestionsWidget() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCached, setIsCached] = useState(false);

  const fetchSuggestions = async (force = false) => {
    setLoading(true);
    try {
      const res = await analyticsApi.dashboard(); // trigger normal stats reload
      const sugRes = await aiApi.suggestions({ forceRefresh: force });
      if (sugRes.data?.success) {
        setSuggestions(sugRes.data.suggestions || []);
        setIsCached(!!sugRes.data.cached);
      }
    } catch (err) {
      console.error('Error fetching dashboard AI suggestions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions(false);
  }, []);

  return (
    <div className="card" style={{ 
      background: 'linear-gradient(135deg, rgba(90, 45, 12, 0.08), rgba(245, 158, 11, 0.04))', 
      border: '1px solid rgba(90, 45, 12, 0.2)', 
      borderRadius: '12px', 
      padding: '1.25rem', 
      marginBottom: '1.5rem',
      position: 'relative',
      boxShadow: 'var(--shadow)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#5a2d0c', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🤖 Centralized AI Business Suggestions
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {isCached && (
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'var(--border)', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
              Cached Daily
            </span>
          )}
          <button 
            onClick={() => fetchSuggestions(true)} 
            disabled={loading}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#5a2d0c', 
              fontSize: '0.8rem', 
              fontWeight: 700, 
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh On-Demand'}
          </button>
        </div>
      </div>

      {loading && suggestions.length === 0 ? (
        <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Analyzing ERP database and generating insights...</div>
      ) : suggestions.length > 0 ? (
        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 550 }}>
          {suggestions.map((item, idx) => (
            <li key={idx} style={{ lineHeight: '1.4' }}>
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ padding: '0.5rem 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No suggestions generated for today.</div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { isInstallable, isInstalled, installApp } = usePWA();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [returnsMetrics, setReturnsMetrics] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const [adminData, setAdminData] = useState(null);
  const [mfgData, setMfgData] = useState({ runs: [], rawReport: null, recipesCount: 0, planner: null });
  const [billingData, setBillingData] = useState({ invoices: [], customers: [], backordersCount: 0 });
  const [storeData, setStoreData] = useState({ valuation: null, lowStock: [], movements: [] });
  const [dispatchData, setDispatchData] = useState({ shipments: [], analytics: null });
  const [salesExecData, setSalesExecData] = useState({ customers: [], invoices: [], backordersCount: 0 });
  const [backordersCount, setBackordersCount] = useState(0);
  const [activeAlertTab, setActiveAlertTab] = useState('critical');
  const [alerts, setAlerts] = useState({ critical: [], warning: [], normal: [], counts: { critical: 0, warning: 0, normal: 0 } });
  const [outstandingFilter, setOutstandingFilter] = useState('all_time');
  
  // WooCommerce Integration Dashboard Widget States
  const [wooStats, setWooStats] = useState(null);
  const [syncingType, setSyncingType] = useState('');

  // SFA Manager Command Center states
  const [activeDashboardView, setActiveDashboardView] = useState('erp');
  const [sfaTracking, setSfaTracking] = useState([]);
  const [sfaVisits, setSfaVisits] = useState([]);
  const [sfaAnalytics, setSfaAnalytics] = useState(null);

  const handleDashboardSync = async (type) => {
    setSyncingType(type);
    try {
      let res;
      if (type === 'all') {
        res = await integrationsApi.syncAll();
      } else if (type === 'inventory') {
        res = await integrationsApi.syncInventory();
      } else if (type === 'orders') {
        res = await integrationsApi.syncOrders();
      }
      alert(res.data.message || 'Sync completed successfully');
      
      // reload stats
      const { data } = await integrationsApi.getStats();
      if (data.success) {
        setWooStats(data);
      }
    } catch (err) {
      alert(err.response?.data?.message || `${type} sync failed`);
    } finally {
      setSyncingType('');
    }
  };

  const role = user?.role || 'Super Admin';
  const isSuperAdmin = role === 'admin' || role === 'Super Admin';

  useEffect(() => {
    const loadDashboardData = async () => {
      setDataLoading(true);
      try {
        if (isSuperAdmin) {
          const { data } = await analyticsApi.getHomeDashboard();
          if (data.success) {
            setAdminData(data.analytics);
            setSfaTracking(data.sfaLive?.liveTracking || []);
            setSfaVisits([]);
            setSfaAnalytics({
              assignedCustomers: data.totalCustomerCount || 0,
              visitedCustomers: data.sfaLive?.todayVisitsCount || 0,
              ordersGenerated: data.analytics?.todayOrders || 0,
              orderConversionRate: data.sfaLive?.todayVisitsCount > 0 ? parseFloat(((data.analytics?.todayOrders / data.sfaLive?.todayVisitsCount) * 100).toFixed(1)) : 0
            });
            setAlerts(data.stockAlerts);
            setStoreData(prev => ({ ...prev, lowStock: (data.stockAlerts?.critical || []).concat(data.stockAlerts?.warning || []).slice(0, 5) }));
            setBackordersCount(data.analytics?.delayedOrdersCount || 0);
            setWooStats(data.wooStats);
          }
        }

        try {
          const retRes = await returnsApi.getDashboardMetrics();
          if (retRes.data?.success) {
            setReturnsMetrics(retRes.data.metrics || retRes.data.data || null);
          }
        } catch (e) {
          console.error('Error loading returns metrics on dashboard:', e);
        }

        if (role === 'Manufacturing Manager') {
          const [runsRes, rawReportRes, recipesRes, plannerRes] = await Promise.allSettled([
            manufacturingApi.list(),
            rawMaterialsApi.report(),
            manufacturingApi.listRecipes(),
            manufacturingApi.planner()
          ]);
          setMfgData({
            runs: runsRes.status === 'fulfilled' ? runsRes.value.data || [] : [],
            rawReport: rawReportRes.status === 'fulfilled' ? rawReportRes.value.data || null : null,
            recipesCount: recipesRes.status === 'fulfilled' ? (recipesRes.value.data?.recipes?.length || recipesRes.value.data?.length || 0) : 0,
            planner: plannerRes.status === 'fulfilled' ? plannerRes.value.data || null : null
          });
        }

        if (role === 'Billing Executive' || role === 'Sales Executive') {
          const [salesRes, customersRes, boRes] = await Promise.allSettled([
            salesApi.list({ limit: 100 }),
            customersApi.list({ limit: 100 }),
            salesApi.list({ erpStatus: 'Waiting For Stock', limit: 1 })
          ]);
          const invoices = salesRes.status === 'fulfilled' ? salesRes.value.data.invoices || [] : [];
          const customers = customersRes.status === 'fulfilled' ? customersRes.value.data.customers || [] : [];
          const boCount = boRes.status === 'fulfilled' ? boRes.value.data.total || 0 : 0;

          if (role === 'Billing Executive') {
            setBillingData({ invoices, customers, backordersCount: boCount });
          } else {
            setSalesExecData({ invoices, customers, backordersCount: boCount });
          }
        }

        if (role === 'Store Keeper') {
          const [valRes, lsRes, movementsRes] = await Promise.allSettled([
            inventoryApi.report(),
            productsApi.lowStock(),
            inventoryApi.movements({ limit: 10 })
          ]);
          setStoreData({
            valuation: valRes.status === 'fulfilled' ? valRes.value.data || null : null,
            lowStock: lsRes.status === 'fulfilled' ? lsRes.value.data.products || [] : [],
            movements: movementsRes.status === 'fulfilled' ? movementsRes.value.data.movements || [] : []
          });
        }

        if (role === 'Dispatch Executive') {
          const [shipRes, analRes] = await Promise.allSettled([
            shippingApi.list({ limit: 100 }),
            shippingApi.getAnalytics()
          ]);
          setDispatchData({
            shipments: shipRes.status === 'fulfilled' ? shipRes.value.data.shipments || [] : [],
            analytics: analRes.status === 'fulfilled' ? analRes.value.data || null : null
          });
        }
      } catch (err) {
        console.error('Error loading role dashboard data:', err);
      } finally {
        setDataLoading(false);
      }
    };

    if (user) {
      loadDashboardData();
    }
  }, [user, role, isSuperAdmin]);

  // 1. Rendering Super Admin / Admin Dashboard
  if (isSuperAdmin) {
    const cards = adminData?.cards || {};
    const charts = adminData?.charts || {};
    const outstanding = adminData?.outstanding || {};
    const outstandingTrend = adminData?.outstandingTrend || [];

    const activeOutstanding = outstanding[outstandingFilter] || { totalOutstanding: 0, totalOverdue: 0, unpaidCount: 0, topCustomers: [] };
    const outstandingValue = activeOutstanding.totalOutstanding;

    const getOutstandingCardStyle = (val) => {
      if (val === 0) {
        return {
          backgroundColor: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#15803d',
          valClass: 'text-success'
        };
      } else if (val <= 50000) {
        return {
          backgroundColor: '#fff7ed',
          border: '1px solid #fed7aa',
          color: '#c2410c',
          valClass: 'text-warning'
        };
      } else {
        return {
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          valClass: 'text-danger'
        };
      }
    };
    const outStyle = getOutstandingCardStyle(outstandingValue);

    return (
      <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>📊 Super Admin Control Center</h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>Modern Manufacturing, Inventory, Sales & Distribution Overview</p>
          </div>
          <Link to="/sales?tab=new" className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', fontWeight: 600 }}>+ New Invoice</Link>
        </div>

        {/* AI Suggestions Widget */}
        <AiSuggestionsWidget />

        {/* PWA Install Promo Card */}
        {isInstallable && !isInstalled && (
          <div className="card pwa-install-promo-card" style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.08), rgba(245, 158, 11, 0.04))',
            border: '1px solid rgba(37, 99, 235, 0.2)',
            borderRadius: '12px',
            padding: '1.5rem',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow)',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem',
            flexWrap: 'wrap',
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 300px' }}>
              <span style={{ fontSize: '3rem' }}>📲</span>
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
                  Install AO ERP
                </h3>
                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  Install AO ERP for:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
                  {[
                    '✓ Offline Usage',
                    '✓ Faster Loading',
                    '✓ Mobile Experience',
                    '✓ Push Notifications'
                  ].map((benefit, idx) => (
                    <div key={idx} style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: '700' }}>
                      {benefit}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={installApp}
                style={{
                  backgroundColor: '#5a2d0c',
                  borderColor: '#5a2d0c',
                  color: '#fff',
                  fontWeight: 700,
                  padding: '0.6rem 1.5rem',
                  borderRadius: '10px',
                  boxShadow: '0 4px 6px rgba(90, 45, 12, 0.15)',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#401e07';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#5a2d0c';
                }}
              >
                Install Now
              </button>
            </div>
          </div>
        )}
            {outstandingValue > 50000 && (
              <div className="card" style={{ borderLeft: '6px solid #ef4444', backgroundColor: '#fef2f2', padding: '1.25rem', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#991b1b', fontSize: '1.05rem', display: 'block' }}>⚠️ Warning: High Outstanding Balance</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#7f1d1d', lineHeight: '1.4' }}>
                    High Outstanding Amount. Follow up with customers.
                  </p>
                </div>
                <Link to="/sales?tab=outstanding" className="btn btn-danger btn-sm" style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap', fontWeight: 'bold' }}>Outstanding Register</Link>
              </div>
            )}

            {adminData?.cards?.delayedOrdersCount > 0 && (
              <div className="card" style={{ borderLeft: '6px solid #ef4444', backgroundColor: '#fef2f2', padding: '1.25rem', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ color: '#991b1b', fontSize: '1.05rem', display: 'block' }}>⚠️ Dispatch Pending More Than 3 Days</strong>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#7f1d1d', lineHeight: '1.4' }}>
                    There are {adminData.cards.delayedOrdersCount} prepared order(s) that have been pending dispatch for more than 3 days. Please review and pack them immediately.
                  </p>
                </div>
                <Link to="/order-noting" className="btn btn-danger btn-sm" style={{ padding: '0.5rem 1rem', whiteSpace: 'nowrap', fontWeight: 'bold' }}>Manage Orders</Link>
              </div>
            )}

            {isMobile ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '1.25rem' }}>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Due</span>
                    <strong style={{ fontSize: '1.3rem', fontWeight: 800, color: '#ef4444' }}>{fmt(outstandingValue)}</strong>
                  </div>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Today</span>
                    <strong style={{ fontSize: '1.3rem', fontWeight: 800, color: '#22c55e' }}>{fmt(cards.todaySales || 0)}</strong>
                  </div>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Pending</span>
                    <strong style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>{cards.pendingDispatchOrders || cards.lowStockCount || 0}</strong>
                  </div>
                  <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Total</span>
                    <strong style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)' }}>{cards.totalInvoices || adminData?.cards?.totalInvoices || 120}</strong>
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📦 Manufacturing & Packing</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Bulk Value</span>
                      <strong style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{fmt(cards.bulkStockValue || 0)}</strong>
                    </div>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Retail Stock</span>
                      <strong style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{cards.retailPackStock || 0} Packs</strong>
                    </div>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Packed Today</span>
                      <strong style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{cards.packingDoneToday || 0} Packs</strong>
                    </div>
                    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Mfg Today</span>
                      <strong style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)' }}>{cards.mfgDoneToday || 0} KG</strong>
                    </div>
                  </div>
                </div>

                {/* Mobile Touch-Friendly Bulk Stock & Packed Today Blocks */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>🌾 Bulk Product Stock</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {adminData?.bulkProductsList && adminData.bulkProductsList.length > 0 ? (
                      adminData.bulkProductsList.map((product) => (
                        <div key={product.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{product.name}</span>
                          <strong style={{ fontSize: '0.9rem', color: '#ff9800' }}>{Number(product.stock || 0).toFixed(2)} {product.unit || 'KG'}</strong>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', padding: '8px' }}>No bulk products registered.</div>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>📦 Variants Packed Today</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {adminData?.packedTodayList && adminData.packedTodayList.length > 0 ? (
                      adminData.packedTodayList.map((pack, idx) => (
                        <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{pack.name} ({pack.packSize || 'Standard'})</span>
                          <strong style={{ fontSize: '0.9rem', color: '#10b981' }}>{pack.qty} {pack.unit || 'PCS'}</strong>
                        </div>
                      ))
                    ) : (
                      <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', padding: '8px' }}>No packing runs executed today.</div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                  <StatCard label="Today's Sales" value={dataLoading ? <span className="skeleton-loader" /> : fmt(cards.todaySales)} />
                  <StatCard label="Monthly Revenue" value={dataLoading ? <span className="skeleton-loader" /> : fmt(cards.monthlyRevenue)} />
                  <StatCard
                    label="Outstanding Receivables"
                    value={dataLoading ? <span className="skeleton-loader" /> : fmt(outstandingValue)}
                    subtext="Pending Customer Collections"
                    onClick={() => navigate('/sales?tab=outstanding')}
                    style={{
                      backgroundColor: outStyle.backgroundColor,
                      border: outStyle.border,
                      labelStyle: { color: outStyle.color },
                      valueStyle: { color: outStyle.color },
                      subtextStyle: { color: outStyle.color }
                    }}
                  />
                  <StatCard label="Website Orders Today" value={dataLoading ? <span className="skeleton-loader" /> : cards.websiteOrdersToday || 0} onClick={() => navigate('/website?tab=orders')} />
                  <StatCard label="Website Revenue Today" value={dataLoading ? <span className="skeleton-loader" /> : fmt(cards.websiteRevenueToday || 0)} onClick={() => navigate('/website?tab=orders')} />
                  <StatCard label="Pending Website Orders" value={dataLoading ? <span className="skeleton-loader" /> : cards.pendingWebsiteOrders || 0} onClick={() => navigate('/website?tab=orders')} className={!dataLoading && cards.pendingWebsiteOrders > 0 ? 'warning' : ''} />
                  <StatCard label="Pending Dispatch Orders" value={dataLoading ? <span className="skeleton-loader" /> : cards.pendingDispatchOrders || 0} />
                  <StatCard label="Low Stock Products" value={dataLoading ? <span className="skeleton-loader" /> : cards.lowStockCount || 0} className={!dataLoading && cards.lowStockCount > 0 ? 'danger' : ''} />
                  <StatCard
                    label="Today's Returns 🛡️"
                    value={dataLoading ? <span className="skeleton-loader" /> : `${returnsMetrics?.todaysReturns || 0} Pks`}
                    subtext={!dataLoading ? `${returnsMetrics?.recoveryRate ?? returnsMetrics?.recoveryPercentage ?? 0}% Recovery Rate` : ''}
                    onClick={() => navigate('/sales/returns')}
                    style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', labelStyle: { color: '#166534' }, valueStyle: { color: '#16a34a' } }}
                  />
                  <StatCard
                    label="Pending QC Returns"
                    value={dataLoading ? <span className="skeleton-loader" /> : (returnsMetrics?.pendingQc || 0)}
                    subtext="Awaiting Inspection"
                    onClick={() => navigate('/sales/returns')}
                    style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa', labelStyle: { color: '#c2410c' }, valueStyle: { color: '#ea580c' } }}
                  />
                  <StatCard
                    label="Return Recovery Value"
                    value={dataLoading ? <span className="skeleton-loader" /> : fmt(returnsMetrics?.recoveryValue ?? returnsMetrics?.stockRestoredVal ?? 0)}
                    subtext="Restored Goods"
                    onClick={() => navigate('/sales/returns')}
                    style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', labelStyle: { color: '#047857' }, valueStyle: { color: '#10b981' } }}
                  />
                  <StatCard
                    label="Active Batch Recalls 🚨"
                    value={dataLoading ? <span className="skeleton-loader" /> : (returnsMetrics?.activeRecalls || 0)}
                    subtext="Internal Hold"
                    onClick={() => navigate('/sales/returns')}
                    style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', labelStyle: { color: '#b91c1c' }, valueStyle: { color: '#ef4444' } }}
                  />
                  <StatCard
                    label="Top Selling Product"
                    value={dataLoading ? <span className="skeleton-loader" /> : (charts.topProducts?.[0]?.name || 'N/A')}
                    subtext={!dataLoading && charts.topProducts?.[0]?.qty ? `${charts.topProducts[0].qty} units sold` : ''}
                  />

                </div>

                {/* 🎯 Target Performance & Company Achievement Section */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem', marginTop: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    🎯 Target Achievement & Sales Performance
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    
                    {/* Progress Card */}
                    <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Target Progress Tracker</h4>
                      
                      {/* Today's Target */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                          <span>Today's Target</span>
                          <span>{adminData?.targets?.metrics?.todayTarget ? `₹${adminData.targets.metrics.todaySales?.toLocaleString()} / ₹${adminData.targets.metrics.todayTarget?.toLocaleString()}` : 'N/A'}</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(100, adminData?.targets?.metrics?.todayTarget > 0 ? Math.round((adminData.targets.metrics.todaySales / adminData.targets.metrics.todayTarget) * 100) : 0)}%`, 
                            height: '100%', 
                            backgroundColor: adminData?.targets?.metrics?.todaySales >= adminData?.targets?.metrics?.todayTarget ? '#10b981' : '#f59e0b' 
                          }} />
                        </div>
                      </div>

                      {/* Monthly Target */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                          <span>Monthly Target ({adminData?.targets?.metrics?.monthlyAchievementPercent || 0}%)</span>
                          <span>{adminData?.targets?.metrics?.monthlyTarget ? `₹${adminData.targets.metrics.monthlyActual?.toLocaleString()} / ₹${adminData.targets.metrics.monthlyTarget?.toLocaleString()}` : 'N/A'}</span>
                        </div>
                        <div style={{ width: '100%', height: '10px', backgroundColor: 'var(--border)', borderRadius: '5px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(100, adminData?.targets?.metrics?.monthlyAchievementPercent || 0)}%`, 
                            height: '100%', 
                            backgroundColor: adminData?.targets?.metrics?.monthlyAchievementPercent >= 100 ? '#10b981' : '#ef4444' 
                          }} />
                        </div>
                      </div>

                      {/* Yearly Target */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '4px' }}>
                          <span>Yearly Target</span>
                          <span>{adminData?.targets?.metrics?.monthlyTarget ? `₹${adminData.targets.metrics.monthlyActual?.toLocaleString()} / ₹${(adminData.targets.metrics.monthlyTarget * 12)?.toLocaleString()}` : 'N/A'}</span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${Math.min(100, adminData?.targets?.metrics?.monthlyTarget > 0 ? Math.round((adminData.targets.metrics.monthlyActual / (adminData.targets.metrics.monthlyTarget * 12)) * 100) : 0)}%`, 
                            height: '100%', 
                            backgroundColor: '#3b82f6' 
                          }} />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', fontSize: '0.8rem' }}>
                        <span>Risk Level: <strong style={{ color: adminData?.targets?.metrics?.upcomingTargetRisk?.includes('High') ? '#ef4444' : '#10b981' }}>{adminData?.targets?.metrics?.upcomingTargetRisk || 'Low'}</strong></span>
                        <span>Badge: <strong>{adminData?.targets?.metrics?.rewardBadge || 'Bronze'}</strong></span>
                      </div>
                    </div>

                    {/* Salesman Leaderboard Card */}
                    <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Salesman Leaderboard</h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
                        {adminData?.targets?.salesmanLeaderboard && adminData.targets.salesmanLeaderboard.length > 0 ? (
                          adminData.targets.salesmanLeaderboard.map((salesman) => (
                            <div key={salesman.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', fontSize: '0.85rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontWeight: 800, color: '#64748b' }}>#{salesman.rank}</span>
                                <span style={{ fontWeight: 600 }}>{salesman.name}</span>
                              </div>
                              <span style={{ fontWeight: 'bold', color: salesman.achievementPercent >= 100 ? '#10b981' : '#ff9800' }}>
                                {salesman.achievementPercent}% achieved (₹{salesman.actual?.toLocaleString()})
                              </span>
                            </div>
                          ))
                        ) : (
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem' }}>No salesmen registered.</div>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#1e293b', marginBottom: '0.75rem', marginTop: '1.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    📦 Manufacturing & Packing Overview
                  </h3>
                  <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <StatCard label="Bulk Stock Value" value={dataLoading ? <span className="skeleton-loader" /> : fmt(cards.bulkStockValue || 0)} />
                    <StatCard label="Retail Pack Stock" value={dataLoading ? <span className="skeleton-loader" /> : `${cards.retailPackStock || 0} Packs`} />
                    <StatCard label="Packing Done Today" value={dataLoading ? <span className="skeleton-loader" /> : `${cards.packingDoneToday || 0} Packs`} />
                    <StatCard label="Manufacturing Done Today" value={dataLoading ? <span className="skeleton-loader" /> : `${cards.mfgDoneToday || 0} KG`} />
                  </div>

                  {/* Detailed Bulk Stock & Packed Today KPIs */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* Bulk Stock Inventory Card */}
                    <div className="card" style={{ padding: '1.25rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        🌾 Bulk Product Stock
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {adminData?.bulkProductsList && adminData.bulkProductsList.length > 0 ? (
                          adminData.bulkProductsList.map((product) => (
                            <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', fontSize: '0.875rem' }}>
                              <span style={{ fontWeight: 600, color: '#1e293b' }}>{product.name}</span>
                              <strong style={{ color: '#ff9800' }}>{Number(product.stock || 0).toFixed(2)} {product.unit || 'KG'}</strong>
                            </div>
                          ))
                        ) : (
                          <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No bulk products registered.</div>
                        )}
                      </div>
                    </div>

                    {/* Packed Today KPI Card */}
                    <div className="card" style={{ padding: '1.25rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                      <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#475569', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📦 Variants Packed Today
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {adminData?.packedTodayList && adminData.packedTodayList.length > 0 ? (
                          adminData.packedTodayList.map((pack, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', backgroundColor: '#f0fdf4', borderRadius: '6px', fontSize: '0.875rem' }}>
                              <span style={{ fontWeight: 600, color: '#16a34a' }}>{pack.name} ({pack.packSize || 'Standard'})</span>
                              <strong style={{ color: '#10b981' }}>{pack.qty} {pack.unit || 'PCS'}</strong>
                            </div>
                          ))
                        ) : (
                          <div style={{ color: '#64748b', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>No packing runs executed today.</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {charts.monthlyRevenue && (
              <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Monthly Revenue Overview</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={charts.monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="revenue" fill="#ff9800" radius={[4, 4, 0, 0]} name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Profit Margin Trend</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={charts.monthlyRevenue}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                      <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: '8px' }} />
                      <Legend />
                      <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} activeDot={{ r: 6 }} name="Net Profit" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Outstanding Receivables Detailed Overview */}
            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>💳 Outstanding Receivables Analytics</h3>
                  <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Track pending invoices, aging collections, and customer credit exposure</p>
                </div>
                
                <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: '#f1f5f9', padding: '0.25rem', borderRadius: '8px' }}>
                  {[
                    { id: 'today', label: 'Today' },
                    { id: 'this_month', label: 'This Month' },
                    { id: 'this_quarter', label: 'This Quarter' },
                    { id: 'financial_year', label: 'Financial Year' },
                    { id: 'all_time', label: 'All Time' }
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setOutstandingFilter(f.id)}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        borderRadius: '6px',
                        border: 'none',
                        cursor: 'pointer',
                        backgroundColor: outstandingFilter === f.id ? '#fff' : 'transparent',
                        color: outstandingFilter === f.id ? '#0f172a' : '#64748b',
                        boxShadow: outstandingFilter === f.id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 350px), 1fr))', gap: '2rem' }}>
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block', fontWeight: 500 }}>Total Outstanding</span>
                      <strong style={{ fontSize: '1.2rem', color: '#0f172a', display: 'block', marginTop: '0.25rem' }}>{fmt(activeOutstanding.totalOutstanding)}</strong>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: '#fdf2f8', borderRadius: '8px', border: '1px solid #fbcfe8', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#be185d', display: 'block', fontWeight: 500 }}>Total Overdue</span>
                      <strong style={{ fontSize: '1.2rem', color: '#9d174d', display: 'block', marginTop: '0.25rem' }}>{fmt(activeOutstanding.totalOverdue)}</strong>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: '#fffbeb', borderRadius: '8px', border: '1px solid #fef3c7', textAlign: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: '#b45309', display: 'block', fontWeight: 500 }}>Unpaid Invoices</span>
                      <strong style={{ fontSize: '1.2rem', color: '#92400e', display: 'block', marginTop: '0.25rem' }}>{activeOutstanding.unpaidCount}</strong>
                    </div>
                  </div>

                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Top Outstanding Customers</h4>
                  <div className="table-wrap">
                    <table className="data-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th style={{ width: '40px' }}>#</th>
                          <th>Customer Name</th>
                          <th>Amount</th>
                          <th style={{ textAlign: 'right' }}>Follow-up</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeOutstanding.topCustomers.length === 0 ? (
                          <tr>
                            <td colSpan="4" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                              No outstanding balances for this period.
                            </td>
                          </tr>
                        ) : (
                          activeOutstanding.topCustomers.map((cust, idx) => (
                            <tr key={idx}>
                              <td>{idx + 1}</td>
                              <td><strong>{cust.name}</strong></td>
                              <td style={{ color: '#ef4444', fontWeight: 700 }}>{fmt(cust.amount)}</td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => {
                                    let phoneNum = cust.phone ? cust.phone.replace(/\D/g, '') : '';
                                    if (phoneNum.length === 10) {
                                      phoneNum = '91' + phoneNum;
                                    }
                                    const msgText = `Hello ${cust.name},\n\nYour outstanding balance is ₹${cust.amount.toLocaleString('en-IN')}.\n\nKindly clear the pending payment.\n\nThank you,\nAmudhasurabiy Organics`;
                                    const whatsappUrl = `https://wa.me/${phoneNum}?text=${encodeURIComponent(msgText)}`;
                                    window.open(whatsappUrl, '_blank');
                                  }}
                                  style={{
                                    padding: '0.25rem 0.5rem',
                                    fontSize: '0.75rem',
                                    border: '1px solid #10b981',
                                    color: '#10b981',
                                    backgroundColor: '#f0fdf4',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.25rem',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    fontWeight: 600
                                  }}
                                >
                                  💬 Send Reminder
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Outstanding Trend (Last 6 Months)</h4>
                  <div style={{ flex: 1, minHeight: '220px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={outstandingTrend}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: '8px' }} />
                        <Bar dataKey="amount" fill="#ef4444" radius={[4, 4, 0, 0]} name="Outstanding Amount" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 500px), 1fr))', gap: '1.5rem', marginTop: '1.5rem' }}>
              {/* WooCommerce Status Widget */}
              <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>🔌 WooCommerce Integration</h3>
                    <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Direct synchronization with online shop</p>
                  </div>
                  <span className={`rm-badge ${wooStats?.wooConnected ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                    {wooStats?.wooConnected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>

                {wooStats?.wooConnected ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                      {wooStats.logo ? (
                        <img src={resolveAssetUrl(wooStats.logo)} alt="Logo" style={{ width: '48px', height: '48px', borderRadius: '8px', objectFit: 'contain', backgroundColor: '#fff', border: '1px solid #e2e8f0', padding: '4px' }} />
                      ) : (
                        <span style={{ fontSize: '2rem' }}>🛒</span>
                      )}
                      <div>
                        <h4 style={{ margin: 0, color: '#0f172a', fontWeight: 700 }}>{wooStats.companyName || 'WooCommerce Store'}</h4>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{wooStats.wooUrl}</span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                      <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Products Synced</span>
                        <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>{wooStats.productsFound ?? 0}</strong>
                      </div>
                      <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Customers Synced</span>
                        <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>{wooStats.customersFound ?? 0}</strong>
                      </div>
                      <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '6px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Orders Synced</span>
                        <strong style={{ fontSize: '1.25rem', color: '#0f172a' }}>{wooStats.ordersFound ?? 0}</strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.85rem', color: '#475569' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>WooCommerce Version:</span>
                        <strong style={{ color: '#0f172a' }}>v{wooStats.wooVersion}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Store Currency:</span>
                        <strong style={{ color: '#0f172a' }}>{wooStats.wooCurrency}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Last Synced:</span>
                        <strong style={{ color: '#0f172a' }}>
                          {wooStats.lastSyncTime ? new Date(wooStats.lastSyncTime).toLocaleString() : 'Never'}
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '0.5rem' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDashboardSync('inventory')} disabled={!!syncingType}>
                        {syncingType === 'inventory' ? 'Syncing...' : '🔄 Sync Stock'}
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleDashboardSync('orders')} disabled={!!syncingType}>
                        {syncingType === 'orders' ? 'Syncing...' : '🛒 Sync Orders'}
                      </button>
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => handleDashboardSync('all')} disabled={!!syncingType}>
                        {syncingType === 'all' ? 'Syncing All...' : '⚡ Sync All'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '1.5rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>🔌</span>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#334155', fontWeight: 700 }}>Store Not Connected</h4>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0 0 1rem 0' }}>Configure credentials under Integrations to enable automated WooCommerce synchronization.</p>
                    <Link to="/settings?tab=integrations" className="btn btn-primary btn-sm">Go to Settings</Link>
                  </div>
                )}
              </div>

              {/* Low Stock Alerts */}
              <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>⚠️ LOW STOCK ALERTS</h3>
                    <p style={{ margin: '0.25rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Real-time stock warning list</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${activeAlertTab === 'critical' ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={() => setActiveAlertTab('critical')}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      Critical ({alerts.counts?.critical || 0})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${activeAlertTab === 'warning' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        backgroundColor: activeAlertTab === 'warning' ? '#f97316' : '',
                        borderColor: activeAlertTab === 'warning' ? '#f97316' : '',
                        color: activeAlertTab === 'warning' ? '#fff' : '',
                        padding: '0.25rem 0.5rem',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}
                      onClick={() => setActiveAlertTab('warning')}
                    >
                      Warning ({alerts.counts?.warning || 0})
                    </button>
                  </div>
                </div>

                <div className="table-wrap" style={{ maxHeight: '310px', overflowY: 'auto' }}>
                  <table className="data-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Current Stock</th>
                        <th>Minimum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(alerts[activeAlertTab] || []).slice(0, 6).map((item) => (
                        <tr key={item.id}>
                          <td><strong>{item.name}</strong> <span style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'monospace' }}>({item.sku})</span></td>
                          <td style={{ fontWeight: 700, color: activeAlertTab === 'critical' ? '#ef4444' : '#f97316' }}>{item.stock} {item.unit}</td>
                          <td>{item.minStock} {item.unit}</td>
                        </tr>
                      ))}
                      {(alerts[activeAlertTab] || []).length === 0 && (
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                            No items in this category.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
      </div>
    );
  }

  // 2. Rendering Manufacturing Manager Dashboard
  if (role === 'Manufacturing Manager') {
    const rawVal = mfgData.rawReport?.cards?.materialValue || 0;
    const runs = mfgData.runs;
    const mfgChartData = runs.slice(0, 5).map(run => ({
      name: run.mfgNumber,
      'Raw Materials': run.rawMaterialCost || 0,
      'Labor': run.laborCost || 0,
      'Others': run.otherCost || 0
    }));

    const pendingDemandsCount = mfgData.planner?.unfulfilledProducts?.length || 0;

    return (
      <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>🏭 Manufacturing Control Panel</h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>Production Formula Optimization & Batch Costing Management</p>
          </div>
          <Link to="/manufacturing?tab=runs" className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', fontWeight: 600 }}>Start Production</Link>
        </div>

        {pendingDemandsCount > 0 && (
          <div className="card" style={{ borderLeft: '6px solid #ff9800', background: '#fff7ed', padding: '1.25rem', borderRadius: '10px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong style={{ color: '#c2410c', fontSize: '1rem', display: 'block' }}>⏳ Customer Backorder Warning</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#7c2d12', lineHeight: '1.4' }}>
                There are {pendingDemandsCount} products with unfulfilled customer commitments. Review the Manufacturing Planner to see materials shortages and schedule production runs.
              </p>
            </div>
            <Link to="/manufacturing?tab=planner" className="btn btn-primary btn-sm" style={{ padding: '0.4rem 0.8rem', whiteSpace: 'nowrap' }}>Open Planner</Link>
          </div>
        )}

        <div className="stat-grid" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <StatCard label="Raw Materials Value" value={fmt(rawVal)} className="success" />
          <StatCard label="Active Formula Recipes" value={mfgData.recipesCount || 0} />
          <StatCard label="Total Production Runs" value={runs.length || 0} />
          <StatCard label="Backorder Demands" value={pendingDemandsCount} className={pendingDemandsCount > 0 ? 'warning' : ''} />
          <StatCard label="Low Stock Materials" value={mfgData.rawReport?.cards?.lowStockMaterials || 0} className={mfgData.rawReport?.cards?.lowStockMaterials > 0 ? 'danger' : ''} />
        </div>

        <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Production Runs Batch Costing Breakdown</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={mfgChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="Raw Materials" stackId="a" fill="#ff9800" />
                <Bar dataKey="Labor" stackId="a" fill="#2563eb" />
                <Bar dataKey="Others" stackId="a" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.5rem', color: '#1e293b' }}>Formula Yield Performance</h3>
            <div style={{ padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <span style={{ fontSize: '2.5rem' }}>🎯</span>
              <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#334155' }}>Avg Yield Conversion</h4>
              <p style={{ fontSize: '0.9rem', color: '#64748b', margin: 0 }}>Weighted production wastage rate: <strong style={{ color: '#ff9800' }}>1.8% wastage</strong> (Target threshold: &lt; 2.5%)</p>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>🏭 Recent Production Batches</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Mfg Batch No</th><th>Recipe</th><th>Date</th><th>Output Qty</th><th>Batch Cost</th><th>Unit Cost</th><th>Status</th></tr>
              </thead>
              <tbody>
                {runs.slice(0, 5).map((run) => (
                  <tr key={run.id || run._id}>
                    <td><strong>{run.mfgNumber}</strong></td>
                    <td>{run.recipe?.name || 'Bulk Repack Formula'}</td>
                    <td>{new Date(run.date || run.createdAt).toLocaleDateString()}</td>
                    <td>{run.qtyToProduce} {run.product?.unit || 'pcs'}</td>
                    <td><strong>{fmt(run.totalCost)}</strong></td>
                    <td>{fmt(run.costPerUnit)}</td>
                    <td>
                      <span className={`rm-badge ${run.status === 'completed' ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                        {run.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // 3. Rendering Billing Executive Dashboard
  if (role === 'Billing Executive') {
    const todayStr = new Date().toISOString().split('T')[0];
    let todayCount = 0;
    let todaySalesAmount = 0;
    let unpaidTotal = 0;
    let unpaidCount = 0;
    
    billingData.invoices.forEach(inv => {
      const invDate = new Date(inv.date || inv.createdAt).toISOString().split('T')[0];
      if (invDate === todayStr) {
        todayCount += 1;
        todaySalesAmount += Number(inv.grandTotal || 0);
      }
      if (inv.paymentStatus === 'pending' || inv.paymentStatus === 'partial') {
        unpaidCount += 1;
        unpaidTotal += (Number(inv.grandTotal || 0) - Number(inv.amountPaid || 0));
      }
    });

    const paymentMethods = {};
    billingData.invoices.forEach(inv => {
      const m = inv.paymentMethod || 'cash';
      paymentMethods[m] = (paymentMethods[m] || 0) + Number(inv.grandTotal || 0);
    });
    const methodChartData = Object.keys(paymentMethods).map(k => ({
      name: k.toUpperCase(),
      value: paymentMethods[k]
    }));

    return (
      <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>🧾 Billing Operations</h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>Generate Invoices, inspect credit terms, and process cash registers</p>
          </div>
          <Link to="/sales?tab=new" className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', fontWeight: 600 }}>Create Invoice</Link>
        </div>

        <div className="stat-grid" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <StatCard label="Today's Invoice Count" value={todayCount} />
          <StatCard label="Today's Sales Value" value={fmt(todaySalesAmount)} className="success" />
          <StatCard label="Pending Backorders" value={billingData.backordersCount || 0} className={billingData.backordersCount > 0 ? 'warning' : ''} />
          <StatCard label="Pending Payments Count" value={unpaidCount} className="danger" />
          <StatCard label="Pending Outstandings" value={fmt(unpaidTotal)} className="danger" />
        </div>

        <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Revenue by Payment Type</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={methodChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: '8px' }} />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} name="Received Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Outstanding Credits Log</h3>
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr><th>Inv Code</th><th>Customer</th><th>Total</th><th>Balance</th></tr>
                </thead>
                <tbody>
                  {billingData.invoices.filter(i => i.paymentStatus !== 'paid').slice(0, 4).map(inv => (
                    <tr key={inv.id || inv._id}>
                      <td><strong>{inv.invoiceNumber}</strong></td>
                      <td>{inv.customer?.name || 'Retail Store'}</td>
                      <td>{fmt(inv.grandTotal)}</td>
                      <td style={{ color: '#ef4444', fontWeight: 700 }}>{fmt(inv.grandTotal - inv.amountPaid)}</td>
                    </tr>
                  ))}
                  {billingData.invoices.filter(i => i.paymentStatus !== 'paid').length === 0 && (
                    <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8' }}>All Invoices Paid! 🎉</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. Rendering Store Keeper Dashboard
  if (role === 'Store Keeper') {
    const val = storeData.valuation || {};
    return (
      <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>📋 Inventory Storage Center</h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>Track physical stock balances, log movement ledgers, and adjust inventory</p>
          </div>
          <Link to="/products?tab=raw-materials" className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', fontWeight: 600 }}>Adjust Stock</Link>
        </div>

        <div className="stat-grid" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <StatCard label="Total Stock Valuation" value={fmt(val.totalValue || 0)} className="success" />
          <StatCard label="Low Stock Items Count" value={val.lowStockCount || storeData.lowStock?.length || 0} className="danger" />
          <StatCard label="Monitored Items" value={val.products?.length || 0} />
          <StatCard label="Recent Movements Logged" value={storeData.movements?.length || 0} />
        </div>

        <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Low Stock Inventory Warnings</h3>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Product Name</th><th>SKU</th><th>Available Stock</th><th>Low Threshold</th></tr>
                </thead>
                <tbody>
                  {storeData.lowStock.slice(0, 5).map(p => (
                    <tr key={p.id || p._id}>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.sku}</td>
                      <td><span className="badge badge-danger">{p.stock} {p.unit}</span></td>
                      <td>{p.lowStockThreshold} {p.unit}</td>
                    </tr>
                  ))}
                  {storeData.lowStock.length === 0 && (
                    <tr><td colSpan="4" style={{ textAlign: 'center', color: '#94a3b8' }}>Inventory fully stocked.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Recent Physical Stock Movements</h3>
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr><th>Product/SKU</th><th>Type</th><th>Qty Change</th><th>Logged By</th></tr>
                </thead>
                <tbody>
                  {storeData.movements.slice(0, 5).map(m => (
                    <tr key={m.id || m._id}>
                      <td><strong>{m.product?.name || 'Item'}</strong></td>
                      <td>
                        <span className={`rm-badge ${m.type === 'purchase' || m.type === 'repack' ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                          {m.type}
                        </span>
                      </td>
                      <td><strong style={{ color: m.quantity > 0 ? '#10b981' : '#ef4444' }}>{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</strong></td>
                      <td>{m.createdBy?.name || 'System'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 5. Rendering Dispatch Executive Dashboard
  if (role === 'Dispatch Executive') {
    const anal = dispatchData.analytics || {};
    const cards = anal.cards || {};
    const courierChartData = anal.charts?.courierChart || [];

    return (
      <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>🚚 Logistics Dispatch Desk</h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>Create package shipments, input tracking numbers, and view delivery metrics</p>
          </div>
          <Link to="/sales?tab=shipping" className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', fontWeight: 600 }}>Create Shipment</Link>
        </div>

        <div className="stat-grid" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <StatCard label="Total Shipments Handled" value={cards.totalShipments || 0} />
          <StatCard label="Pending Packing/Ship" value={(cards.pending || 0) + (cards.packed || 0)} className="danger" />
          <StatCard label="In Transit Logistics" value={cards.inTransit || 0} />
          <StatCard label="Delivered Success" value={cards.delivered || 0} className="success" />
          <StatCard label="Returns Logged" value={cards.returned || 0} className={cards.returned > 0 ? 'danger' : ''} />
          <StatCard label="Logistics Performance" value={`${cards.successRate || 100}%`} className="success" />
        </div>

        <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Carrier Dispatches Performance</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={courierChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="courier" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px' }} />
                <Legend />
                <Bar dataKey="total" fill="#2563eb" name="Total Shipments" />
                <Bar dataKey="delivered" fill="#10b981" name="Delivered" />
                <Bar dataKey="returned" fill="#ef4444" name="Returned" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Active Shipment Status Queue</h3>
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr><th>Ship No</th><th>Courier</th><th>Tracking</th><th>ERP Status</th><th>Courier Live</th></tr>
                </thead>
                <tbody>
                  {dispatchData.shipments.slice(0, 5).map(shp => (
                    <tr key={shp.id || shp._id}>
                      <td><strong>{shp.shipmentNumber}</strong></td>
                      <td>{shp.courier}</td>
                      <td style={{ fontFamily: 'monospace' }}>{shp.trackingNumber}</td>
                      <td><span className="badge badge-success">{shp.status}</span></td>
                      <td>
                        <span className={`rm-badge ${shp.courierStatus === 'Delivered' ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                          {shp.courierStatus || 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 6. Rendering Sales Executive Dashboard
  if (role === 'Sales Executive') {
    const custs = salesExecData.customers || [];
    const invs = salesExecData.invoices || [];
    const averageOrderValue = invs.length 
      ? Math.round(invs.reduce((sum, inv) => sum + Number(inv.grandTotal || 0), 0) / invs.length)
      : 0;

    const customerPurchaseCounts = {};
    invs.forEach(inv => {
      const custId = inv.customerId || inv.customer?.id || inv.customer?._id || '';
      if (custId) {
        customerPurchaseCounts[custId] = (customerPurchaseCounts[custId] || 0) + 1;
      }
    });
    const repeatBuyersCount = Object.values(customerPurchaseCounts).filter(count => count > 1).length;

    const segmentRevenue = {};
    invs.forEach(inv => {
      const type = inv.customerType || 'D2C Customer';
      segmentRevenue[type] = (segmentRevenue[type] || 0) + Number(inv.grandTotal || 0);
    });
    const segmentChartData = Object.keys(segmentRevenue).map(seg => ({
      name: seg,
      value: segmentRevenue[seg]
    }));

    return (
      <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
        <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>👥 Sales & Distribution Manager</h1>
            <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>Optimize wholesale distributors, repack prices, and white-label order segments</p>
          </div>
          <Link to="/customers" className="btn btn-primary" style={{ padding: '0.6rem 1.25rem', fontWeight: 600 }}>+ Add Customer</Link>
        </div>

        <div className="stat-grid" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <StatCard label="Registered Customers" value={custs.length} />
          <StatCard label="Total Invoiced Orders" value={invs.length} />
          <StatCard label="Pending Backorders" value={salesExecData.backordersCount || 0} className={salesExecData.backordersCount > 0 ? 'warning' : ''} />
          <StatCard label="Average Order Value" value={fmt(averageOrderValue)} className="success" />
          <StatCard label="Repeat Order Customers" value={repeatBuyersCount} className="success" />
        </div>

        <div className="chart-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 400px), 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Revenue by Customer Type</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={segmentChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {segmentChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>High Value Customers</h3>
            <div className="table-wrap">
              <table className="data-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr><th>Customer Name</th><th>Segment Type</th><th>Phone</th><th>Credit Limit</th></tr>
                </thead>
                <tbody>
                  {custs.slice(0, 5).map(c => (
                    <tr key={c.id || c._id}>
                      <td><strong>{c.name}</strong></td>
                      <td><span className="badge badge-success">{c.customerType}</span></td>
                      <td>{c.phone || 'N/A'}</td>
                      <td>{c.creditLimit ? fmt(c.creditLimit) : 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Fallback default view
  return (
    <div className="page" style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>AO Core ERP</h2>
      <p>Welcome, you are logged in as a <strong>{role}</strong>.</p>
    </div>
  );
}
