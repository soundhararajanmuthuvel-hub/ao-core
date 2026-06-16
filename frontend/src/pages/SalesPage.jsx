import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import SaleCreate from './SaleCreate';
import Sales from './Sales';
import Shipping from './Shipping';
import { salesApi, customersApi } from '../api';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import PaymentReminderGenerator from '../components/PaymentReminderGenerator';
import React from 'react';

function BackordersDashboard() {
  const [backorders, setBackorders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState(null);

  const fetchBackorders = async () => {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([
        salesApi.list({ erpStatus: 'Waiting For Stock', includeItems: true, limit: 100 }),
        salesApi.list({ erpStatus: 'Production Planned', includeItems: true, limit: 100 }),
        salesApi.list({ erpStatus: 'Manufacturing In Progress', includeItems: true, limit: 100 }),
      ]);
      const combined = [...(r1.data?.sales || []), ...(r2.data?.sales || []), ...(r3.data?.sales || [])];
      setBackorders(combined);
    } catch (e) {
      console.error('Failed to fetch backorders:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackorders();
  }, []);

  const getKPIs = () => {
    const pendingOrdersCount = backorders.filter(x => x.status === 'Waiting For Stock').length;
    const totalPendingQty = backorders.reduce((sum, inv) => {
      if (inv.status !== 'Waiting For Stock') return sum;
      return sum + (inv.items?.reduce((s, i) => s + Number(i.pendingQty || 0), 0) || 0);
    }, 0);

    const todayStr = new Date().toDateString();
    const dueToday = backorders.filter(x => {
      if (!x.expectedDispatchDate || x.status !== 'Waiting For Stock') return false;
      return new Date(x.expectedDispatchDate).toDateString() === todayStr;
    }).length;

    const now = new Date();
    const threeDaysLater = new Date();
    threeDaysLater.setDate(now.getDate() + 3);
    const dueIn3Days = backorders.filter(x => {
      if (!x.expectedDispatchDate || x.status !== 'Waiting For Stock') return false;
      const d = new Date(x.expectedDispatchDate);
      return d > now && d <= threeDaysLater;
    }).length;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const overdue = backorders.filter(x => {
      if (!x.expectedDispatchDate || x.status !== 'Waiting For Stock') return false;
      const d = new Date(x.expectedDispatchDate);
      return d < todayStart;
    }).length;

    return { pendingOrdersCount, totalPendingQty, dueToday, dueIn3Days, overdue };
  };

  const kpis = getKPIs();

  const filtered = backorders.filter(x => {
    const matchesSearch = x.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (x.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All' ? true : x.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateVal) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return 'N/A';
    }
  };

  const getStatusStyle = (status, expectedDispatchDate) => {
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const isDelayed = expectedDispatchDate && new Date(expectedDispatchDate) < todayStart && status === 'Waiting For Stock';
    
    if (isDelayed) {
      return { bg: '#fef2f2', text: '#ef4444', border: '1px solid #fee2e2', label: 'Delayed' };
    }

    switch (status) {
      case 'Waiting For Stock':
        return { bg: '#fff7ed', text: '#c2410c', border: '1px solid #ffedd5', label: 'Waiting For Stock' };
      case 'Production Planned':
        return { bg: '#eff6ff', text: '#1d4ed8', border: '1px solid #dbeafe', label: 'Production Planned' };
      case 'Manufacturing In Progress':
        return { bg: '#f0fdfa', text: '#0d9488', border: '1px solid #ccfbf1', label: 'In Production' };
      default:
        return { bg: '#f3f4f6', text: '#374151', border: '1px solid #e5e7eb', label: status };
    }
  };

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading Backorders Dashboard...</div>;

  return (
    <div>
      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderTop: '4px solid #ff9800', display: 'flex', flexDirection: 'column', padding: '1.25rem', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>PENDING BACKORDERS</span>
          <strong style={{ fontSize: '1.75rem', color: '#0f172a', marginTop: '0.25rem' }}>{kpis.pendingOrdersCount} Orders</strong>
        </div>
        <div className="card" style={{ borderTop: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', padding: '1.25rem', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL PENDING ITEMS</span>
          <strong style={{ fontSize: '1.75rem', color: '#0f172a', marginTop: '0.25rem' }}>{kpis.totalPendingQty} Qty</strong>
        </div>
        <div className="card" style={{ borderTop: '4px solid #eab308', display: 'flex', flexDirection: 'column', padding: '1.25rem', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>DUE TODAY</span>
          <strong style={{ fontSize: '1.75rem', color: '#eab308', marginTop: '0.25rem' }}>{kpis.dueToday} Orders</strong>
        </div>
        <div className="card" style={{ borderTop: '4px solid #3b82f6', display: 'flex', flexDirection: 'column', padding: '1.25rem', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>DUE IN 3 DAYS</span>
          <strong style={{ fontSize: '1.75rem', color: '#3b82f6', marginTop: '0.25rem' }}>{kpis.dueIn3Days} Orders</strong>
        </div>
        <div className="card" style={{ borderTop: '4px solid #ef4444', display: 'flex', flexDirection: 'column', padding: '1.25rem', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>OVERDUE / DELAYED</span>
          <strong style={{ fontSize: '1.75rem', color: '#ef4444', marginTop: '0.25rem' }}>{kpis.overdue} Orders</strong>
        </div>
      </div>

      {/* Filter and Grid */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search by invoice # or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: '#64748b', fontWeight: 600 }}>Status:</span>
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="All">All Backorders</option>
              <option value="Waiting For Stock">Waiting For Stock</option>
              <option value="Production Planned">Production Planned</option>
              <option value="Manufacturing In Progress">In Production</option>
            </select>
          </div>
        </div>

        <table className="data-table sales-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Customer</th>
              <th>Date Created</th>
              <th>Expected Dispatch</th>
              <th>Commitment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                  No active backorders found.
                </td>
              </tr>
            ) : (
              filtered.map((inv) => {
                const conf = getStatusStyle(inv.status, inv.expectedDispatchDate);
                const isExpanded = expandedInvoiceId === inv.id;
                return (
                  <React.Fragment key={inv.id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}>
                      <td style={{ fontWeight: 600 }}>
                        {isExpanded ? '▼ ' : '▶ '} {inv.invoiceNumber}
                      </td>
                      <td>{inv.customer?.name || 'Walk-in'}</td>
                      <td>{formatDate(inv.date)}</td>
                      <td>{formatDate(inv.expectedDispatchDate)}</td>
                      <td>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>{inv.commitment || 'Within 3 Days'}</span>
                      </td>
                      <td>
                        <span style={{
                          backgroundColor: conf.bg,
                          color: conf.text,
                          border: conf.border,
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          textTransform: 'uppercase'
                        }}>
                          {conf.label}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <a href={`/sales/${inv.id}`} className="btn btn-sm" style={{ marginRight: '0.5rem', padding: '0.2rem 0.5rem', fontSize: '0.8rem', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}>
                          View
                        </a>
                        <a href="/manufacturing?tab=planner" className="btn btn-primary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.8rem' }}>
                          Plan Production
                        </a>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <td colSpan="7" style={{ padding: '1.25rem 1.75rem' }}>
                          <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', color: '#475569', fontWeight: 700 }}>Backordered Item Breakdown</h4>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#64748b' }}>
                                  <th style={{ padding: '0.4rem 0.25rem', fontWeight: 600 }}>Product</th>
                                  <th style={{ padding: '0.4rem 0.25rem', fontWeight: 600, textAlign: 'center' }}>Total Ordered</th>
                                  <th style={{ padding: '0.4rem 0.25rem', fontWeight: 600, textAlign: 'center' }}>Dispatched</th>
                                  <th style={{ padding: '0.4rem 0.25rem', fontWeight: 600, textAlign: 'center' }}>Pending (Backorder)</th>
                                </tr>
                              </thead>
                              <tbody>
                                {inv.items?.map((item, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', color: '#334155' }}>
                                    <td style={{ padding: '0.5rem 0.25rem', fontWeight: 500 }}>{item.product?.name || item.name}</td>
                                    <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>{Number(item.qty).toFixed(0)} {item.product?.unit || ''}</td>
                                    <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{Number(item.dispatchedQty || 0).toFixed(0)}</td>
                                    <td style={{ padding: '0.5rem 0.25rem', textAlign: 'center' }}>
                                      <span style={{ backgroundColor: '#fff7ed', color: '#c2410c', padding: '0.15rem 0.4rem', borderRadius: '4px', fontWeight: 600 }}>
                                        {Number(item.pendingQty || 0).toFixed(0)}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OutstandingRegister() {
  const [outstanding, setOutstanding] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { settings } = useSettings();
  const [reminderModalInvoice, setReminderModalInvoice] = useState(null);

  const fetchOutstanding = async () => {
    setLoading(true);
    try {
      const { data } = await salesApi.outstanding();
      setOutstanding(data || []);
    } catch (e) {
      console.error('Failed to fetch outstanding invoices:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutstanding();
  }, []);

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

  const filtered = outstanding.filter(x => {
    return x.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (x.customer?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalOutstandingAmount = outstanding.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  const overdueCount = outstanding.filter(item => item.daysOverdue > 0).length;

  return (
    <div>
      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="card" style={{ borderTop: '4px solid #ef4444', display: 'flex', flexDirection: 'column', padding: '1.25rem', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>TOTAL OUTSTANDING DEBT</span>
          <strong style={{ fontSize: '1.75rem', color: '#ef4444', marginTop: '0.25rem' }}>
            ₹{totalOutstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </strong>
        </div>
        <div className="card" style={{ borderTop: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', padding: '1.25rem', justifyContent: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>OVERDUE INVOICES</span>
          <strong style={{ fontSize: '1.75rem', color: '#f59e0b', marginTop: '0.25rem' }}>{overdueCount} Invoices</strong>
        </div>
      </div>

      {/* Filter and Grid */}
      <div className="card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
          <input
            type="text"
            className="form-control"
            placeholder="Search by invoice # or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
        </div>

        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading Outstanding Invoices...</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Invoice Date</th>
                <th>Customer</th>
                <th>Invoice Amount</th>
                <th>Paid Amount</th>
                <th>Balance</th>
                <th>Due Days</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                    No outstanding invoices found.
                  </td>
                </tr>
              ) : (
                filtered.map((inv) => {
                  const balance = Number(inv.balance || 0);
                  const isOverdue = inv.daysOverdue > 0;
                  const age = Math.floor((new Date() - new Date(inv.date)) / (1000 * 60 * 60 * 24));
                  return (
                    <tr key={inv.id}>
                      <td><strong>{inv.invoiceNumber}</strong></td>
                      <td>{new Date(inv.date).toLocaleDateString()}</td>
                      <td>
                        <div><strong>{inv.customer?.name}</strong></div>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Terms: {inv.customer?.paymentTerms || 'COD'} | Cycle: {inv.customer?.paymentCycle || 'Bill to Bill'}</div>
                      </td>
                      <td>₹{Number(inv.grandTotal).toFixed(2)}</td>
                      <td>₹{Number(inv.amountPaid || 0).toFixed(2)}</td>
                      <td>
                        <span className="badge badge-warning" style={{ fontWeight: 700 }}>
                          ₹{balance.toFixed(2)}
                        </span>
                      </td>
                      <td><strong>{age} Days</strong></td>
                      <td>
                        {isOverdue ? (
                          <span style={{ color: '#ef4444', fontWeight: 700 }}>
                            ⚠️ OVERDUE ({inv.daysOverdue}d)
                          </span>
                        ) : (
                          <span style={{ color: '#10b981', fontWeight: 600 }}>PENDING</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ borderColor: '#2563eb', color: '#2563eb', marginRight: '0.35rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          onClick={() => handleSendWhatsApp(inv.id)}
                          title="Send text reminder"
                        >
                          💬 Text
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ borderColor: '#ff9800', color: '#ff9800', marginRight: '0.35rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          onClick={() => setReminderModalInvoice(inv)}
                          title="Branded payment reminder image"
                        >
                          🖼️ Image
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ borderColor: '#ef4444', color: '#ef4444', marginRight: '0.35rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          onClick={() => setReminderModalInvoice(inv)}
                          title="Branded reminder PDF"
                        >
                          📄 PDF
                        </button>
                        <a href={`/sales/${inv.id}`} className="btn btn-primary btn-sm" style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}>
                          View
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

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

function PaymentEntry({ customers }) {
  const { toast } = useToast();
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().substring(0, 10));
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [allocations, setAllocations] = useState({});
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    if (!selectedCustomerId) {
      setUnpaidInvoices([]);
      setAllocations({});
      return;
    }
    setLoadingInvoices(true);
    salesApi.outstanding({ customerId: selectedCustomerId })
      .then(({ data }) => {
        setUnpaidInvoices(data || []);
        const initial = {};
        (data || []).forEach(inv => {
          initial[inv.id] = 0;
        });
        setAllocations(initial);
      })
      .catch(err => console.error(err))
      .finally(() => setLoadingInvoices(false));
  }, [selectedCustomerId]);

  const handleAutoAllocate = () => {
    let remaining = Number(paymentAmount);
    const updated = {};
    const sorted = [...unpaidInvoices].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sorted.forEach(inv => {
      const bal = Number(inv.balance);
      if (remaining <= 0) {
        updated[inv.id] = 0;
      } else if (remaining >= bal) {
        updated[inv.id] = Number(bal.toFixed(2));
        remaining -= bal;
      } else {
        updated[inv.id] = Number(remaining.toFixed(2));
        remaining = 0;
      }
    });
    setAllocations(updated);
    toast('Distributed payment amount using FIFO logic across outstanding invoices', 'success');
  };

  const handleAllocationChange = (invoiceId, val) => {
    const num = Number(val) || 0;
    setAllocations(prev => ({
      ...prev,
      [invoiceId]: num
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedCustomerId) return toast('Select a customer', 'warning');
    if (paymentAmount <= 0) return toast('Enter a valid payment amount', 'warning');
    
    const allocArray = Object.entries(allocations)
      .map(([invId, amt]) => ({
        invoiceId: Number(invId),
        amount: Number(amt)
      }))
      .filter(item => item.amount > 0);

    const totalAllocated = allocArray.reduce((sum, item) => sum + item.amount, 0);
    if (Math.abs(totalAllocated - paymentAmount) > 0.01) {
      return toast(`The total allocated amount (₹${totalAllocated.toFixed(2)}) must exactly match the payment amount (₹${paymentAmount.toFixed(2)}).`, 'error');
    }

    for (const item of allocArray) {
      const inv = unpaidInvoices.find(i => i.id === item.invoiceId);
      if (inv && item.amount > Number(inv.balance)) {
        return toast(`Allocation for invoice ${inv.invoiceNumber} cannot exceed its outstanding balance of ₹${inv.balance.toFixed(2)}.`, 'error');
      }
    }

    try {
      await salesApi.recordPayment({
        customerId: selectedCustomerId,
        amount: paymentAmount,
        paymentMethod,
        referenceNumber,
        allocations: allocArray
      });
      toast('Payment recorded and allocated successfully!', 'success');
      setSelectedCustomerId('');
      setPaymentAmount(0);
      setReferenceNumber('');
      setPaymentDate(new Date().toISOString().substring(0, 10));
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to record payment', 'error');
    }
  };

  const totalAllocatedAmount = Object.values(allocations).reduce((sum, val) => sum + Number(val || 0), 0);

  return (
    <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
      <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', height: 'fit-content' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
          💳 Record Payment Receipt
        </h3>
        
        <div className="form-group">
          <label>Select Customer *</label>
          <select 
            className="form-control" 
            required 
            value={selectedCustomerId} 
            onChange={(e) => setSelectedCustomerId(e.target.value)}
          >
            <option value="">-- Choose Customer --</option>
            {customers.map(c => (
              <option key={c.id || c._id} value={c.id || c._id}>
                {c.name} ({c.customerType}) — Bal: ₹{Number(c.balance || 0).toLocaleString()}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Payment Amount Received (₹) *</label>
          <input 
            type="number" 
            className="form-control" 
            required 
            min="0.01" 
            step="0.01"
            value={paymentAmount || ''} 
            onChange={(e) => setPaymentAmount(Number(e.target.value) || 0)} 
            placeholder="e.g. 5000"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label>Payment Method *</label>
            <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="upi">UPI / GPay / PhonePe</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank Transfer / NEFT</option>
              <option value="card">Card Payment</option>
            </select>
          </div>
          <div className="form-group">
            <label>Receipt Date</label>
            <input 
              type="date" 
              className="form-control" 
              value={paymentDate} 
              onChange={(e) => setPaymentDate(e.target.value)} 
            />
          </div>
        </div>

        <div className="form-group">
          <label>Reference / Transaction No</label>
          <input 
            type="text" 
            className="form-control" 
            placeholder="e.g. UPI Txn ID, Chq No" 
            value={referenceNumber} 
            onChange={(e) => setReferenceNumber(e.target.value)}
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-primary" 
          style={{ width: '100%', padding: '0.75rem', fontWeight: 700, fontSize: '1rem', marginTop: '1rem' }}
        >
          💾 Save Payment Entry
        </button>
      </div>

      <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>
            🧾 Invoice-wise Settlement
          </h3>
          {unpaidInvoices.length > 0 && (
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              onClick={handleAutoAllocate}
              style={{ borderColor: '#ff9800', color: '#ff9800' }}
            >
              ⚡ Auto Allocate (FIFO)
            </button>
          )}
        </div>

        {loadingInvoices ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading customer invoices...</div>
        ) : unpaidInvoices.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            {selectedCustomerId ? 'No pending/unpaid invoices found for this customer.' : 'Select a customer to view and allocate pending bills.'}
          </div>
        ) : (
          <div>
            <table className="data-table" style={{ fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th>Invoice No</th>
                  <th>Date</th>
                  <th>Total Amt</th>
                  <th>Outstanding</th>
                  <th style={{ width: '150px' }}>Allocation Amt (₹)</th>
                </tr>
              </thead>
              <tbody>
                {unpaidInvoices.map(inv => {
                  const balance = Number(inv.balance || 0);
                  return (
                    <tr key={inv.id}>
                      <td><strong>{inv.invoiceNumber}</strong></td>
                      <td>{new Date(inv.date).toLocaleDateString()}</td>
                      <td>₹{inv.grandTotal.toFixed(2)}</td>
                      <td>
                        <span style={{ color: '#ef4444', fontWeight: 700 }}>
                          ₹{balance.toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <input 
                          type="number" 
                          className="form-control form-control-sm"
                          style={{ fontWeight: 'bold', border: allocations[inv.id] > 0 ? '1px solid #ff9800' : '1px solid #cbd5e1' }}
                          min="0"
                          max={balance}
                          step="0.01"
                          value={allocations[inv.id] || ''}
                          onChange={(e) => handleAllocationChange(inv.id, e.target.value)}
                          placeholder="0.00"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.95rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total Payment:</span>
                  <strong>₹{paymentAmount.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: Math.abs(totalAllocatedAmount - paymentAmount) < 0.01 ? '#10b981' : '#ef4444' }}>
                  <span>Total Allocated:</span>
                  <strong>₹{totalAllocatedAmount.toFixed(2)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#64748b' }}>
                  <span>Difference:</span>
                  <span>₹{Math.abs(paymentAmount - totalAllocatedAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </form>
  );
}

export default function SalesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'invoices';
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    customersApi.list({ limit: 500 })
      .then(({ data }) => setCustomers(data.customers || []))
      .catch(err => console.error(err));
  }, []);

  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            🧾 Sales & Distribution Hub
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Generate Invoices, track Shipping shipments, and manage payments.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', gap: '0.5rem', overflowX: 'auto' }}>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'invoices' ? 'active' : ''}`}
          onClick={() => setTab('invoices')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'invoices' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'invoices' ? '#ff9800' : '#64748b',
          }}
        >
          📄 Sales Invoices
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'outstanding' ? 'active' : ''}`}
          onClick={() => setTab('outstanding')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'outstanding' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'outstanding' ? '#ff9800' : '#64748b',
          }}
        >
          💳 Outstanding Register
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'backorders' ? 'active' : ''}`}
          onClick={() => setTab('backorders')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'backorders' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'backorders' ? '#ff9800' : '#64748b',
          }}
        >
          ⏳ Backorders & Commitments
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'new' ? 'active' : ''}`}
          onClick={() => setTab('new')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'new' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'new' ? '#ff9800' : '#64748b',
          }}
        >
          ✍️ New Invoice (New Sale)
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'shipping' ? 'active' : ''}`}
          onClick={() => setTab('shipping')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'shipping' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'shipping' ? '#ff9800' : '#64748b',
          }}
        >
          🚚 Shipping & Logistics
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'returns' ? 'active' : ''}`}
          onClick={() => setTab('returns')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'returns' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'returns' ? '#ff9800' : '#64748b',
          }}
        >
          🔄 Returns Log
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'payments' ? 'active' : ''}`}
          onClick={() => setTab('payments')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'payments' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'payments' ? '#ff9800' : '#64748b',
          }}
        >
          💳 Payments / COD
        </button>
      </div>

      <div className="tab-content" style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
        {currentTab === 'invoices' && <Sales />}
        {currentTab === 'outstanding' && <OutstandingRegister />}
        {currentTab === 'backorders' && <BackordersDashboard />}
        {currentTab === 'new' && <SaleCreate />}
        {currentTab === 'shipping' && <Shipping />}
        {currentTab === 'returns' && (
          <div className="card" style={{ padding: '2rem', backgroundColor: '#fff', borderRadius: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '2.5rem' }}>🔄</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '1rem 0 0.5rem 0', color: '#1e293b' }}>Returns Processing Center</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>All package returns and order reversals are logged and tracked via Invoices details and Shipping status flags.</p>
          </div>
        )}
        {currentTab === 'payments' && <PaymentEntry customers={customers} />}
      </div>
    </div>
  );
}
