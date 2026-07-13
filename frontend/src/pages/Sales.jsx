import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { salesApi, aiApi } from '../api';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { downloadInvoicePdf } from '../utils/invoicePdf';
import LoadingSpinner from '../components/LoadingSpinner';
import PaymentReminderGenerator from '../components/PaymentReminderGenerator';
import { Brain } from 'lucide-react';
import AIInsightsModal from '../components/AIInsightsModal';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function Sales() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useSettings();
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Filters & Tabs state
  const [selectedTab, setSelectedTab] = useState('unpaid'); // unpaid, paid, draft, all, overdue, partial
  const [dateFilter, setDateFilter] = useState('all'); // all, today, week, month
  const [customerFilter, setCustomerFilter] = useState('all');
  const [reminderModalInvoice, setReminderModalInvoice] = useState(null);

  // AI Assistant States
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTitle, setAiTitle] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiInsights, setAiInsights] = useState('');

  // Customer 360 state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomer360, setShowCustomer360] = useState(false);
  const [customer360Tab, setCustomer360Tab] = useState('overview'); // overview, transactions, analytics

  // FAB Menu state
  const [fabOpen, setFabOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);

  // Load all invoices (limit: 5000) and payments (limit: 1000) for fast client-side calculations
  useEffect(() => {
    setLoading(true);
    Promise.all([
      salesApi.list({ limit: 5000, includeItems: true }),
      salesApi.listPayments({ limit: 1000 })
    ]).then(([salesRes, paymentsRes]) => {
      setSales(salesRes.data?.sales || []);
      setPayments(paymentsRes.data || []);
    }).catch(err => {
      console.error(err);
      toast('Failed to load invoices data', 'error');
    }).finally(() => setLoading(false));
  }, [refresh]);

  const [isReconciling, setIsReconciling] = useState(false);
  const [repairReport, setRepairReport] = useState(null);

  const handleRepairStatus = async () => {
    setIsReconciling(true);
    try {
      const { data } = await salesApi.reconcile();
      if (data.success) {
        setRepairReport(data);
        toast(`Repair Complete! Scanned: ${data.scanned}, Fixed: ${data.fixed}`, 'success');
        setRefresh(prev => prev + 1);
      }
    } catch (err) {
      console.error(err);
      toast('Failed to run invoice repair tool', 'error');
    } finally {
      setIsReconciling(false);
    }
  };

  const removeSale = async (id) => {
    if (!confirm('Are you sure you want to delete this invoice? Stock will be restored.')) return;
    try {
      await salesApi.remove(id);
      toast('Invoice deleted successfully', 'success');
      setRefresh((prev) => prev + 1);
    } catch {
      toast('Failed to delete invoice', 'error');
    }
  };

  const handleSendWhatsApp = async (id) => {
    try {
      const { data } = await salesApi.getWhatsAppReminder(id);
      if (data.whatsappUrl) {
        window.open(data.whatsappUrl, '_blank');
        toast('WhatsApp reminder link opened in new tab', 'success');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to generate WhatsApp reminder link';
      toast(errorMsg, 'error');
    }
  };

  const handleCallCustomer = (phone) => {
    if (!phone) return toast('Phone number not available', 'warning');
    window.location.href = `tel:${phone}`;
  };

  // Date and Overdue Helpers
  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const getOverdueDays = (dueDateStr) => {
    if (!dueDateStr) return 0;
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const diff = todayStart - due;
    return diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0;
  };

  const getDueDaysText = (dueDateStr) => {
    if (!dueDateStr) return 'No due date';
    const due = new Date(dueDateStr);
    due.setHours(0, 0, 0, 0);
    const diff = due - todayStart;
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days < 0) {
      return `🔴 Overdue by ${Math.abs(days)} Days`;
    } else if (days === 0) {
      return '🟡 Due Today';
    } else {
      return `Due in ${days} Days`;
    }
  };

  // Memoized lists of invoices and customers
  const customersList = useMemo(() => {
    const map = {};
    sales.forEach(s => {
      if (s.customer && s.customer.id) {
        map[s.customer.id] = s.customer;
      }
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [sales]);

  // Tab count badges
  const tabCounts = useMemo(() => {
    let unpaid = 0;
    let paid = 0;
    let draft = 0;
    let all = 0;
    let overdue = 0;
    let partial = 0;

    sales.forEach(s => {
      if (s.type !== 'invoice' || s.status === 'Cancelled') return;
      all++;
      if (s.status === 'Draft') {
        draft++;
        return;
      }
      if (s.paymentStatus === 'paid') {
        paid++;
      } else if (s.paymentStatus === 'partial') {
        partial++;
        unpaid++; // Unpaid includes partial and pending outstanding
        if (s.dueDate && new Date(s.dueDate) < todayStart) {
          overdue++;
        }
      } else {
        unpaid++;
        if (s.dueDate && new Date(s.dueDate) < todayStart) {
          overdue++;
        }
      }
    });

    return { unpaid, paid, draft, all, overdue, partial };
  }, [sales, todayStart]);

  // Outstanding Dashboard calculations
  const dashboardStats = useMemo(() => {
    let totalReceivable = 0;
    let totalOverdue = 0;
    let todaysCollection = 0;
    let pendingInvoicesCount = 0;

    // Sum receivable and overdue
    sales.forEach(s => {
      if (s.type !== 'invoice' || s.status === 'Cancelled' || s.status === 'Draft') return;
      const balance = Number(s.grandTotal) - Number(s.amountPaid || 0);
      if (balance > 0) {
        totalReceivable += balance;
        pendingInvoicesCount++;
        const overdueDays = getOverdueDays(s.dueDate);
        if (overdueDays > 0) {
          totalOverdue += balance;
        }
      }
    });

    // Sum today's payments collection
    const todayStr = todayStart.toDateString();
    payments.forEach(p => {
      if (p.status === 'Success' && p.date) {
        if (new Date(p.date).toDateString() === todayStr) {
          todaysCollection += Number(p.amount || 0);
        }
      }
    });

    return { totalReceivable, totalOverdue, todaysCollection, pendingInvoicesCount };
  }, [sales, payments, todayStart]);

  // Multi-Filter & Search Engine
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      if (s.type !== 'invoice') return false;

      // 1. Tab Filter
      if (selectedTab === 'unpaid') {
        if (s.paymentStatus === 'paid' || s.status === 'Cancelled' || s.status === 'Draft') return false;
      } else if (selectedTab === 'paid') {
        if (s.paymentStatus !== 'paid' || s.status === 'Cancelled') return false;
      } else if (selectedTab === 'draft') {
        if (s.status !== 'Draft') return false;
      } else if (selectedTab === 'overdue') {
        const overdueDays = getOverdueDays(s.dueDate);
        if (s.paymentStatus === 'paid' || s.status === 'Cancelled' || s.status === 'Draft' || overdueDays <= 0) return false;
      } else if (selectedTab === 'partial') {
        if (s.paymentStatus !== 'partial' || s.status === 'Cancelled' || s.status === 'Draft') return false;
      } else if (selectedTab === 'all') {
        // Show all except Cancelled
        if (s.status === 'Cancelled') return false;
      }

      // 2. Date Filter
      if (dateFilter !== 'all') {
        const invoiceDate = new Date(s.date);
        invoiceDate.setHours(0,0,0,0);
        
        if (dateFilter === 'today') {
          if (invoiceDate.toDateString() !== todayStart.toDateString()) return false;
        } else if (dateFilter === 'week') {
          const sevenDaysAgo = new Date(todayStart);
          sevenDaysAgo.setDate(todayStart.getDate() - 7);
          if (invoiceDate < sevenDaysAgo) return false;
        } else if (dateFilter === 'month') {
          const thirtyDaysAgo = new Date(todayStart);
          thirtyDaysAgo.setDate(todayStart.getDate() - 30);
          if (invoiceDate < thirtyDaysAgo) return false;
        }
      }

      // 3. Customer Filter
      if (customerFilter !== 'all') {
        if (String(s.customerId) !== String(customerFilter)) return false;
      }

      // 4. Search Filter (Invoice #, Customer Name, Phone, GST)
      if (search) {
        const query = search.toLowerCase();
        const matchesInvoice = s.invoiceNumber.toLowerCase().includes(query);
        const matchesCustomer = s.customer?.name?.toLowerCase().includes(query) || false;
        const matchesPhone = s.customer?.phone?.includes(query) || false;
        const matchesGST = s.customer?.gstNumber?.toLowerCase().includes(query) || false;
        if (!matchesInvoice && !matchesCustomer && !matchesPhone && !matchesGST) return false;
      }

      return true;
    });
  }, [sales, selectedTab, dateFilter, customerFilter, search, todayStart]);

  // Open Customer 360 view
  const openCustomer360 = (customerObj, defaultSubTab = 'overview') => {
    setSelectedCustomer(customerObj);
    setCustomer360Tab(defaultSubTab);
    setShowCustomer360(true);
  };

  // Customer 360 Transactions Data
  const customerTransactions = useMemo(() => {
    if (!selectedCustomer) return { invoices: [], payments: [], creditNotes: [], returns: [] };
    const cid = selectedCustomer.id;
    
    const custInvoices = sales.filter(s => String(s.customerId) === String(cid) && s.type === 'invoice');
    const custPayments = payments.filter(p => String(p.customerId) === String(cid));
    const custCreditNotes = sales.filter(s => String(s.customerId) === String(cid) && s.type === 'credit_note');
    const custReturns = sales.filter(s => String(s.customerId) === String(cid) && (s.type === 'refund' || s.status === 'Returned'));

    return { invoices: custInvoices, payments: custPayments, creditNotes: custCreditNotes, returns: custReturns };
  }, [selectedCustomer, sales, payments]);

  // Customer 360 Analytics Data
  const customerAnalytics = useMemo(() => {
    if (!selectedCustomer || !customerTransactions) return null;
    const { invoices } = customerTransactions;
    const nonCancelledInvoices = invoices.filter(s => s.status !== 'Cancelled');

    const lifetimeSales = nonCancelledInvoices.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);
    const totalProfit = nonCancelledInvoices.reduce((sum, s) => {
      // Sum actual profit from items if present, else fallback to 25% of total
      if (s.items && s.items.length > 0) {
        return sum + s.items.reduce((itemSum, item) => itemSum + Number(item.actualProfit || 0), 0);
      }
      return sum + Number(s.grandTotal || 0) * 0.25;
    }, 0);

    const aov = nonCancelledInvoices.length > 0 ? lifetimeSales / nonCancelledInvoices.length : 0;
    
    let lastOrderDate = 'N/A';
    if (nonCancelledInvoices.length > 0) {
      const sorted = [...nonCancelledInvoices].sort((a,b) => new Date(b.date) - new Date(a.date));
      lastOrderDate = new Date(sorted[0].date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    // Top products purchased
    const productQuantities = {};
    nonCancelledInvoices.forEach(s => {
      if (s.items) {
        s.items.forEach(item => {
          const name = item.name;
          productQuantities[name] = (productQuantities[name] || 0) + Number(item.qty || 0);
        });
      }
    });
    const topProducts = Object.entries(productQuantities)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a,b) => b.qty - a.qty)
      .slice(0, 3);

    // Monthly purchase analytics (last 6 months)
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyBuckets = {};
    
    // Initialize last 6 months buckets
    const tempDate = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(tempDate.getFullYear(), tempDate.getMonth() - i, 1);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`;
      monthlyBuckets[key] = 0;
    }

    nonCancelledInvoices.forEach(s => {
      const d = new Date(s.date);
      const key = `${monthNames[d.getMonth()]} ${d.getFullYear().toString().substr(-2)}`;
      if (monthlyBuckets[key] !== undefined) {
        monthlyBuckets[key] += Number(s.grandTotal || 0);
      }
    });

    const monthlyChartData = Object.entries(monthlyBuckets).map(([month, total]) => ({ month, total }));

    return { lifetimeSales, totalProfit, aov, lastOrderDate, topProducts, monthlyChartData };
  }, [selectedCustomer, customerTransactions]);

  const handleSalesAssistant = async () => {
    setAiTitle('AI Sales Assistant');
    setAiModalOpen(true);
    setAiLoading(true);
    setAiInsights('');
    try {
      const res = await aiApi.salesAssistant({});
      setAiInsights(res.data.reply);
    } catch (err) {
      setAiInsights('Failed to generate sales recommendations. Please verify your backend API connection and Gemini credentials.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAccountsAssistant = async () => {
    setAiTitle('AI Accounts & Collections Auditor');
    setAiModalOpen(true);
    setAiLoading(true);
    setAiInsights('');
    try {
      const res = await aiApi.accountsAssistant();
      setAiInsights(res.data.reply);
    } catch (err) {
      setAiInsights('Failed to audit outstanding balances. Please verify your backend API connection and Gemini credentials.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="page" style={{ padding: '1.25rem', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>🧾 Invoices Ledger & Payments</h1>
          <p className="page-subtitle" style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Audit outstanding accounts, track collections, and run AI Sales recommendations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link to="/sales?tab=new" className="btn btn-primary" style={{ padding: '0.5rem 1rem', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            + Create Invoice
          </Link>
        </div>
      </div>
      
      {/* Dynamic Scoped CSS Styles for Curated Modern Look */}
      <style>{`
        .outstanding-box {
          border-radius: 12px;
          padding: 1.25rem;
          background-color: var(--bg-card, #ffffff);
          border: 1px solid var(--border, #e2e8f0);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
          display: flex;
          flex-direction: column;
          justify-content: center;
          transition: all 0.2s ease-in-out;
        }
        .outstanding-box:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.08);
        }
        .outstanding-box.receivable { border-left: 5px solid #2563eb; }
        .outstanding-box.overdue { border-left: 5px solid #ef4444; }
        .outstanding-box.collection { border-left: 5px solid #10b981; }
        .outstanding-box.pending { border-left: 5px solid #f59e0b; }

        .sticky-tab-bar {
          position: sticky;
          top: 0;
          z-index: 100;
          background-color: var(--bg-page, #f8fafc);
          padding: 0.5rem 0;
          margin-bottom: 1rem;
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
          scrollbar-width: none;
          border-bottom: 1px solid var(--border, #e2e8f0);
        }
        .sticky-tab-bar::-webkit-scrollbar {
          display: none;
        }
        .invoice-tab-btn {
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
          font-weight: 600;
          border-radius: 8px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-secondary, #64748b);
          cursor: pointer;
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          transition: all 0.2s ease;
        }
        .invoice-tab-btn.active {
          background-color: var(--bg-active, #eff6ff);
          color: #2563eb;
          border-color: rgba(37,99,235,0.15);
        }
        .tab-badge {
          background-color: rgba(100, 116, 139, 0.1);
          color: var(--text-secondary, #475569);
          padding: 0.1rem 0.4rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
        }
        .invoice-tab-btn.active .tab-badge {
          background-color: rgba(37, 99, 235, 0.15);
          color: #2563eb;
        }

        .cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 1rem;
          margin-bottom: 2.5rem;
        }
        .invoice-card {
          border-radius: 14px;
          padding: 1.25rem;
          background-color: var(--bg-card, #ffffff);
          border: 1px solid var(--border, #e2e8f0);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
          cursor: pointer;
          transition: all 0.2s ease-in-out;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
        }
        .invoice-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.08);
          border-color: rgba(37,99,235,0.25);
        }

        .status-badge-custom {
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: inline-block;
        }
        .status-badge-custom.paid { background-color: #dcfce7; color: #166534; }
        .status-badge-custom.unpaid { background-color: #fee2e2; color: #991b1b; }
        .status-badge-custom.partial { background-color: #ffedd5; color: #9a3412; }
        .status-badge-custom.overdue { background-color: #fde8e8; color: #9b1c1c; border: 1px solid #f8b4b4; }
        .status-badge-custom.draft { background-color: #f1f5f9; color: #475569; }
        .status-badge-custom.cancelled { background-color: #e2e8f0; color: #1e293b; }

        .fab-main-btn {
          position: fixed;
          bottom: 4.5rem; /* Raised slightly for mobile nav safety */
          right: 1.5rem;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(135deg, #ff9800, #ffb74d);
          color: white;
          border: none;
          box-shadow: 0 4px 14px rgba(255, 152, 0, 0.4);
          font-size: 1.5rem;
          cursor: pointer;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.25s ease-in-out;
        }
        .fab-main-btn.open {
          transform: rotate(45deg);
          background: #ef4444;
          box-shadow: 0 4px 14px rgba(239, 68, 68, 0.4);
        }
        .fab-options-drawer {
          position: fixed;
          bottom: 8.5rem;
          right: 1.5rem;
          background-color: var(--bg-card, #ffffff);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 12px;
          box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          z-index: 999;
          transform: scale(0.8);
          transform-origin: bottom right;
          opacity: 0;
          pointer-events: none;
          transition: all 0.2s ease-in-out;
        }
        .fab-options-drawer.show {
          transform: scale(1);
          opacity: 1;
          pointer-events: auto;
        }
        .fab-option-item {
          padding: 0.6rem 1rem;
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-primary, #1e293b);
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: background-color 0.15s ease;
        }
        .fab-option-item:hover {
          background-color: var(--bg-active, #f1f5f9);
        }

        .customer-360-overlay {
          position: fixed;
          inset: 0;
          background-color: rgba(15, 23, 42, 0.45);
          backdrop-filter: blur(4px);
          z-index: 2000;
          display: flex;
          justify-content: flex-end;
        }
        .customer-360-drawer {
          width: 100%;
          max-width: 560px;
          height: 100%;
          background-color: var(--bg-card, #ffffff);
          box-shadow: -10px 0 25px -5px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          animation: slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        .chart-container-mini {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          height: 140px;
          padding: 1rem 0;
          margin-top: 1rem;
          border-bottom: 1px dashed var(--border, #cbd5e1);
        }
        .chart-bar-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          flex: 1;
          gap: 0.4rem;
        }
        .chart-bar {
          width: 24px;
          background: linear-gradient(180deg, #ff9800 0%, #ffb74d 100%);
          border-radius: 4px 4px 0 0;
          min-height: 2px;
          transition: height 0.6s ease;
          position: relative;
        }
        .chart-bar:hover {
          background: linear-gradient(180deg, #2563eb 0%, #60a5fa 100%);
        }
        .chart-tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translate(-50%, -4px);
          background-color: #0f172a;
          color: #ffffff;
          font-size: 0.7rem;
          padding: 0.2rem 0.4rem;
          border-radius: 4px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
          white-space: nowrap;
          z-index: 10;
        }
        .chart-bar:hover .chart-tooltip {
          opacity: 1;
        }
      `}</style>

      {/* KPI Outstanding Dashboard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="outstanding-box receivable">
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Total Receivable</span>
          <strong style={{ fontSize: '1.5rem', color: '#1e3a8a', marginTop: '0.25rem' }}>{fmt(dashboardStats.totalReceivable)}</strong>
        </div>
        <div className="outstanding-box overdue">
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Overdue</span>
          <strong style={{ fontSize: '1.5rem', color: '#991b1b', marginTop: '0.25rem' }}>{fmt(dashboardStats.totalOverdue)}</strong>
        </div>
        <div className="outstanding-box collection">
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Today's Collection</span>
          <strong style={{ fontSize: '1.5rem', color: '#065f46', marginTop: '0.25rem' }}>{fmt(dashboardStats.todaysCollection)}</strong>
        </div>
        <div className="outstanding-box pending">
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Pending Invoices</span>
          <strong style={{ fontSize: '1.5rem', color: '#92400e', marginTop: '0.25rem' }}>{dashboardStats.pendingInvoicesCount} Invoices</strong>
        </div>
      </div>

      {/* Search and Advanced Filters */}
      <div className="card" style={{ padding: '1rem', marginBottom: '1rem', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          
          {/* Search bar */}
          <input
            type="text"
            className="form-control"
            placeholder="Search customer, invoice, phone, GST..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: '220px', padding: '0.45rem 0.75rem', fontSize: '0.875rem' }}
          />

          {/* Date Range Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Period:</span>
            <select
              className="form-control"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              style={{ width: '130px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          {/* Customer filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Customer:</span>
            <select
              className="form-control"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              style={{ width: '180px', padding: '0.35rem 0.5rem', fontSize: '0.85rem' }}
            >
              <option value="all">All Customers</option>
              {customersList.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Repair Action */}
          <button 
            type="button" 
            className="btn btn-primary btn-sm"
            onClick={handleRepairStatus}
            disabled={isReconciling}
            style={{ padding: '0.4rem 0.75rem', fontWeight: 'bold' }}
          >
            🔧 {isReconciling ? 'Repairing...' : 'Repair Invoice Status'}
          </button>

          {/* Refresh Action */}
          <button 
            type="button" 
            className="btn btn-secondary btn-sm"
            onClick={() => { setRefresh(prev => prev + 1); toast('Refreshing sales database...', 'info'); }}
            style={{ padding: '0.4rem 0.75rem' }}
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Sticky Tab Bar */}
      <div className="sticky-tab-bar">
        {[
          { id: 'unpaid', label: 'Unpaid', badge: tabCounts.unpaid },
          { id: 'paid', label: 'Paid', badge: tabCounts.paid },
          { id: 'partial', label: 'Partially Paid', badge: tabCounts.partial },
          { id: 'overdue', label: 'Overdue', badge: tabCounts.overdue },
          { id: 'draft', label: 'Draft', badge: tabCounts.draft },
          { id: 'all', label: 'All', badge: tabCounts.all }
        ].map(t => (
          <button
            key={t.id}
            type="button"
            className={`invoice-tab-btn ${selectedTab === t.id ? 'active' : ''}`}
            onClick={() => setSelectedTab(t.id)}
          >
            {t.label}
            <span className="tab-badge">{t.badge}</span>
          </button>
        ))}
      </div>

      {/* Main List Area */}
      {loading ? (
        <LoadingSpinner />
      ) : filteredSales.length === 0 ? (
        <div className="card" style={{ padding: '3rem 1.5rem', textAlign: 'center', color: '#64748b', backgroundColor: '#fff', borderRadius: '12px' }}>
          <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '0.5rem' }}>📄</span>
          <strong style={{ fontSize: '1rem', color: '#334155' }}>No Invoices Found</strong>
          <p style={{ fontSize: '0.85rem', color: '#64748b', margin: '0.25rem 0 0 0' }}>Try adjusting your search queries or category filters.</p>
        </div>
      ) : (
        <div className="cards-grid">
          {filteredSales.map((s) => {
            const saleId = s.id || s._id;
            const balance = Number(s.grandTotal || 0) - Number(s.amountPaid || 0);
            
            // Resolve payment status colors
            let statusClass = 'unpaid';
            const pStatus = String(s.paymentStatus).toLowerCase();
            if (s.status === 'Cancelled') statusClass = 'cancelled';
            else if (s.status === 'Draft') statusClass = 'draft';
            else if (pStatus === 'paid') statusClass = 'paid';
            else if (pStatus === 'partial' || pStatus === 'partially paid') statusClass = 'partial';
            else if (pStatus === 'overdue') statusClass = 'overdue';
            else statusClass = pStatus;

            let displayStatus = 'UNPAID';
            if (s.status === 'Draft') displayStatus = 'DRAFT';
            else if (s.status === 'Cancelled') displayStatus = 'CANCELLED';
            else if (statusClass === 'paid') displayStatus = 'PAID';
            else if (statusClass === 'partial') displayStatus = 'PARTIALLY PAID';
            else if (statusClass === 'overdue') displayStatus = 'OVERDUE';
            else displayStatus = statusClass.toUpperCase();

            return (
              <div 
                key={saleId} 
                className="invoice-card"
                onClick={() => navigate(`/sales/${saleId}`)}
              >
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span 
                    style={{ fontWeight: 800, fontSize: '0.95rem', color: '#2563eb', textDecoration: 'none' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (s.customer) openCustomer360(s.customer);
                    }}
                    onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                    onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                  >
                    {s.customer?.name || 'Walk-in Customer'}
                    {s.customer?.customerCode && (
                      <span style={{
                        fontSize: '0.65rem',
                        fontFamily: 'monospace',
                        backgroundColor: '#fef3c7',
                        color: '#b45309',
                        border: '1px solid #fde68a',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        marginLeft: '0.35rem',
                        fontWeight: 'bold',
                        textTransform: 'uppercase'
                      }}>
                        {s.customer.customerCode}
                      </span>
                    )}
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                    {s.is_historical_data && (
                      <span style={{
                        fontSize: '0.7rem',
                        backgroundColor: '#fffbeb',
                        color: '#d97706',
                        border: '1px solid #fef3c7',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 'bold',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        📊 Historical Data
                      </span>
                    )}
                    <span className={`status-badge-custom ${statusClass}`}>
                      {displayStatus}
                    </span>
                  </div>
                </div>

                {/* Subheader Date & Number */}
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.35rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span>{new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  <span style={{ color: '#cbd5e1' }}>•</span>
                  <strong style={{ fontFamily: 'monospace', color: '#475569' }}>{s.invoiceNumber}</strong>
                </div>

                {/* Values row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Invoice Amount</span>
                    <strong style={{ fontSize: '1.05rem', color: '#1e293b' }}>{fmt(s.grandTotal)}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, display: 'block' }}>Due Amount</span>
                    <strong style={{ fontSize: '1.05rem', color: balance > 0 ? '#b91c1c' : '#475569' }}>{fmt(balance)}</strong>
                  </div>
                </div>

                {/* Overdue alert text */}
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginTop: '0.6rem' }}>
                  {s.status !== 'Cancelled' && s.status !== 'Draft' && String(s.paymentStatus).toLowerCase() !== 'paid' ? (
                    getDueDaysText(s.dueDate)
                  ) : (
                    <span style={{ color: '#16a34a' }}>✓ Settled</span>
                  )}
                </div>

                {/* Quick actions tool row */}
                <div 
                  style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.75rem' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button 
                    type="button" 
                    className="btn btn-secondary btn-sm" 
                    style={{ flex: 1, padding: '0.25rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem' }}
                    onClick={() => downloadInvoicePdf(s, settings)}
                    title="Download invoice PDF"
                  >
                    📄 PDF
                  </button>
                  {balance > 0 && s.status !== 'Cancelled' && s.status !== 'Draft' && (
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      style={{ flex: 1.2, padding: '0.25rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.2rem', borderColor: '#ff9800', color: '#ff9800' }}
                      onClick={() => setReminderModalInvoice(s)}
                      title="Send branded payment reminder image/PDF"
                    >
                      💬 Remind
                    </button>
                  )}
                  {s.customer?.phone && (
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => handleCallCustomer(s.customer.phone)}
                      title={`Call customer phone: ${s.customer.phone}`}
                    >
                      📞
                    </button>
                  )}
                  {s.customer && (
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => openCustomer360(s.customer, 'transactions')}
                      title="View Customer Transaction Ledger"
                    >
                      📂 Ledger
                    </button>
                  )}
                  <button 
                    type="button" 
                    className="btn btn-danger btn-sm" 
                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                    onClick={() => removeSale(saleId)}
                    title="Delete invoice"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Action Button & Menu */}
      <div className="fab-container" style={{ pointerEvents: 'auto' }}>
        <div className={`fab-options-drawer ${fabOpen ? 'show' : ''}`}>
          <div className="fab-option-item" onClick={() => { setFabOpen(false); navigate('/sales?tab=new'); }}>
            <span>✍️</span> New Invoice
          </div>
          <div className="fab-option-item" onClick={() => { setFabOpen(false); navigate('/sales?tab=payments'); }}>
            <span>💰</span> Receive Payment
          </div>
          <div className="fab-option-item" onClick={() => { setFabOpen(false); navigate('/settings?tab=profile'); }}>
            <span>🪙</span> Create Credit Note
          </div>
          <div className="fab-option-item" onClick={() => { setFabOpen(false); navigate('/sales?tab=returns'); }}>
            <span>🔄</span> Create Sales Return
          </div>
        </div>
        <button 
          type="button" 
          className={`fab-main-btn ${fabOpen ? 'open' : ''}`}
          onClick={() => setFabOpen(!fabOpen)}
          title="Invoices Quick Operations"
        >
          ➕
        </button>
      </div>

      {/* Customer 360° Drawer Panel */}
      {showCustomer360 && selectedCustomer && (
        <div className="customer-360-overlay" onClick={() => setShowCustomer360(false)}>
          <div className="customer-360-drawer" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.2rem', color: 'var(--text-primary)' }}>👥 Customer 360° Profile</h3>
                <span style={{ fontSize: '0.8rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.15rem' }}>
                  {selectedCustomer.customerCode && <strong style={{ fontFamily: 'monospace', color: '#b45309', backgroundColor: '#fef3c7', padding: '0.05rem 0.2rem', borderRadius: '3px' }}>{selectedCustomer.customerCode}</strong>}
                  <span>{selectedCustomer.name} ({selectedCustomer.customerType})</span>
                </span>
              </div>
              <button 
                type="button" 
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}
                onClick={() => setShowCustomer360(false)}
              >
                ✕
              </button>
            </div>

            {/* Tab navigation inside 360 view */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', backgroundColor: '#f8fafc' }}>
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'transactions', label: 'Transactions History' },
                { id: 'analytics', label: 'Purchase Analytics' }
              ].map(sub => (
                <button
                  key={sub.id}
                  type="button"
                  style={{
                    flex: 1,
                    padding: '0.85rem',
                    border: 'none',
                    background: 'transparent',
                    fontSize: '0.85rem',
                    fontWeight: customer360Tab === sub.id ? 800 : 500,
                    borderBottom: customer360Tab === sub.id ? '3px solid #ff9800' : '3px solid transparent',
                    color: customer360Tab === sub.id ? '#ff9800' : '#475569',
                    cursor: 'pointer'
                  }}
                  onClick={() => setCustomer360Tab(sub.id)}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Drawer Body Scroll Content */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
              
              {/* SUB TAB: OVERVIEW */}
              {customer360Tab === 'overview' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div className="card" style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>Basic Details</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Display Name:</span>
                        <strong>{selectedCustomer.name}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Business Name:</span>
                        <strong>{selectedCustomer.businessName || 'N/A'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Phone:</span>
                        <strong>{selectedCustomer.phone || 'N/A'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Email:</span>
                        <strong>{selectedCustomer.email || 'N/A'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>GSTIN / Tax ID:</span>
                        <strong>{selectedCustomer.gstNumber || 'N/A'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Customer Type:</span>
                        <strong>{selectedCustomer.customerType}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="card" style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>Billing / Shipping Address</h4>
                    <div style={{ fontSize: '0.85rem', color: '#334155', lineHeight: '1.4' }}>
                      <div>{selectedCustomer.address || 'No address registered.'}</div>
                      {selectedCustomer.state && <div>State: <strong>{selectedCustomer.state}</strong></div>}
                      {selectedCustomer.pincode && <div>Pincode: <strong>{selectedCustomer.pincode}</strong></div>}
                    </div>
                  </div>

                  <div className="card" style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid var(--border)' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>Payment & Credit Profile</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Outstanding Balance:</span>
                        <strong style={{ color: '#b91c1c', fontSize: '1rem' }}>{fmt(selectedCustomer.balance)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Credit Limit:</span>
                        <strong>{fmt(selectedCustomer.creditLimit)}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Payment Terms:</span>
                        <strong>{selectedCustomer.paymentTerms || 'COD'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Payment Cycle:</span>
                        <strong>{selectedCustomer.paymentCycle || 'Bill to Bill'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Credit Days allowed:</span>
                        <strong>{selectedCustomer.creditDays || 0} Days</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b', display: 'block' }}>Credit Status:</span>
                        <strong style={{ color: Number(selectedCustomer.balance) > Number(selectedCustomer.creditLimit) ? '#ef4444' : '#16a34a' }}>
                          {Number(selectedCustomer.balance) > Number(selectedCustomer.creditLimit) ? '⚠️ OVER LIMIT' : '✓ Good'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB TAB: TRANSACTIONS */}
              {customer360Tab === 'transactions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Invoices segment */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>Invoices History ({customerTransactions.invoices.length})</h4>
                    {customerTransactions.invoices.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>No invoices loaded.</span>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: '#475569' }}>
                              <th style={{ padding: '0.5rem' }}>Invoice #</th>
                              <th style={{ padding: '0.5rem' }}>Date</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerTransactions.invoices.map(inv => (
                              <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.5rem', fontWeight: 700 }}>
                                  <Link to={`/sales/${inv.id}`} onClick={() => setShowCustomer360(false)} style={{ color: '#2563eb', textDecoration: 'none' }}>
                                    {inv.invoiceNumber}
                                  </Link>
                                </td>
                                <td style={{ padding: '0.5rem' }}>{new Date(inv.date).toLocaleDateString()}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right' }}>{fmt(inv.grandTotal)}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: '#b91c1c', fontWeight: 600 }}>
                                  {fmt(Number(inv.grandTotal) - Number(inv.amountPaid || 0))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Payments segment */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>Payments History ({customerTransactions.payments.length})</h4>
                    {customerTransactions.payments.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>No payment receipts recorded.</span>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: '#475569' }}>
                              <th style={{ padding: '0.5rem' }}>Receipt #</th>
                              <th style={{ padding: '0.5rem' }}>Date</th>
                              <th style={{ padding: '0.5rem' }}>Method</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount Received</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerTransactions.payments.map(p => (
                              <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.5rem', fontWeight: 700, fontFamily: 'monospace' }}>{p.paymentNumber}</td>
                                <td style={{ padding: '0.5rem' }}>{new Date(p.date).toLocaleDateString()}</td>
                                <td style={{ padding: '0.5rem', textTransform: 'uppercase' }}>{p.paymentMethod}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{fmt(p.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Credit Notes segment */}
                  <div>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>Credit Notes & Returns ({customerTransactions.creditNotes.length})</h4>
                    {customerTransactions.creditNotes.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>No credit notes mapped.</span>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border)', color: '#475569' }}>
                              <th style={{ padding: '0.5rem' }}>Document #</th>
                              <th style={{ padding: '0.5rem' }}>Date</th>
                              <th style={{ padding: '0.5rem', textAlign: 'right' }}>Credit Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {customerTransactions.creditNotes.map(cn => (
                              <tr key={cn.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                <td style={{ padding: '0.5rem', fontWeight: 700 }}>{cn.invoiceNumber}</td>
                                <td style={{ padding: '0.5rem' }}>{new Date(cn.date).toLocaleDateString()}</td>
                                <td style={{ padding: '0.5rem', textAlign: 'right', color: '#2563eb', fontWeight: 700 }}>{fmt(cn.grandTotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB TAB: ANALYTICS */}
              {customer360Tab === 'analytics' && customerAnalytics && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Dashboard Metrics grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Lifetime Sales</span>
                      <strong style={{ display: 'block', fontSize: '1.25rem', color: '#0f172a', marginTop: '0.25rem' }}>{fmt(customerAnalytics.lifetimeSales)}</strong>
                    </div>
                    <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Total Gross Profit</span>
                      <strong style={{ display: 'block', fontSize: '1.25rem', color: '#16a34a', marginTop: '0.25rem' }}>{fmt(customerAnalytics.totalProfit)}</strong>
                    </div>
                    <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Avg Order Value (AOV)</span>
                      <strong style={{ display: 'block', fontSize: '1.25rem', color: '#2563eb', marginTop: '0.25rem' }}>{fmt(customerAnalytics.aov)}</strong>
                    </div>
                    <div style={{ padding: '1rem', backgroundColor: '#f8fafc', border: '1px solid var(--border)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Last Order Date</span>
                      <strong style={{ display: 'block', fontSize: '1.25rem', color: '#475569', marginTop: '0.25rem' }}>{customerAnalytics.lastOrderDate}</strong>
                    </div>
                  </div>

                  {/* Top Products */}
                  <div className="card" style={{ padding: '1rem', backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>🛍️ Top Products Purchased</h4>
                    {customerAnalytics.topProducts.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic' }}>No purchase items found.</span>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {customerAnalytics.topProducts.map((p, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', paddingBottom: '0.25rem', borderBottom: '1px solid #f1f5f9' }}>
                            <span style={{ color: '#334155', fontWeight: 500 }}>{p.name}</span>
                            <strong style={{ color: '#475569' }}>{p.qty} Units</strong>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Monthly Graph */}
                  <div className="card" style={{ padding: '1.25rem 1rem 1rem 1rem', backgroundColor: '#ffffff', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#1e293b' }}>📈 Monthly Purchase Pattern</h4>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Aggregate sales volumes for the last 6 months.</span>
                    
                    <div className="chart-container-mini">
                      {customerAnalytics.monthlyChartData.map((data, idx) => {
                        // Resolve max total for scaling height percentage
                        const maxVal = Math.max(...customerAnalytics.monthlyChartData.map(d => d.total), 1);
                        const pctHeight = Math.min(100, Math.max(4, Math.round((data.total / maxVal) * 100)));

                        return (
                          <div key={idx} className="chart-bar-wrap">
                            <div className="chart-bar" style={{ height: `${pctHeight}%` }}>
                              <div className="chart-tooltip">₹{Math.round(data.total).toLocaleString()}</div>
                            </div>
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b' }}>{data.month}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {repairReport && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            width: '100%',
            maxWidth: '480px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '1.25rem 1.5rem',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: '#f8fafc'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                🔧 Invoice Repair Tool Report
              </h3>
              <button 
                type="button" 
                onClick={() => setRepairReport(null)}
                style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: '1.5' }}>
                Reconciliation complete. All invoice outstanding balances and statuses have been corrected using actual payment records.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'block', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Scanned</span>
                  <strong style={{ fontSize: '1.35rem', color: '#0f172a', fontWeight: 800 }}>{repairReport.scanned}</strong>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: '#fff5f5', borderRadius: '10px', border: '1px solid #fee2e2', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#dc2626', display: 'block', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Fixed</span>
                  <strong style={{ fontSize: '1.35rem', color: '#dc2626', fontWeight: 800 }}>{repairReport.fixed}</strong>
                </div>
                <div style={{ padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '10px', border: '1px solid #dcfce7', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.7rem', color: '#16a34a', display: 'block', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Correct</span>
                  <strong style={{ fontSize: '1.35rem', color: '#16a34a', fontWeight: 800 }}>{repairReport.correct}</strong>
                </div>
              </div>

              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setRepairReport(null)}
                style={{ width: '100%', padding: '0.6rem', fontWeight: 750, borderRadius: '8px', fontSize: '0.9rem', marginTop: '0.25rem' }}
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branded Reminder Generator Modal */}
      {reminderModalInvoice && (
        <PaymentReminderGenerator
          invoice={reminderModalInvoice}
          customer={reminderModalInvoice.customer}
          settings={settings}
          onClose={() => setReminderModalInvoice(null)}
        />
      )}

    </div>
  );
}
