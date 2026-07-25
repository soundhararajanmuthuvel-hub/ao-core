import React, { useState, useEffect } from 'react';
import {
  Search,
  UserCheck,
  UserPlus,
  X,
  Store,
  CreditCard,
  History,
  CheckCircle2,
  AlertTriangle,
  Building,
  Phone,
  MapPin,
  FileText,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { customersApi, salesApi } from '../api';

export default function CustomerPicker({
  selectedCustomer,
  onSelectCustomer,
  onConfirmCustomer
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selected customer history state
  const [custHistory, setCustHistory] = useState(null);
  const [custHistoryLoading, setCustHistoryLoading] = useState(false);

  // Quick Create Customer Modal State
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickForm, setQuickForm] = useState({
    name: '',
    phone: '',
    customerType: 'Retail Shop',
    city: '',
    gstin: ''
  });

  // Debounced Search (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers();
    }, 300);

    return () => clearTimeout(timer);
  }, [query, typeFilter, page]);

  // Load Return History whenever selectedCustomer changes
  useEffect(() => {
    if (selectedCustomer && (selectedCustomer.id || selectedCustomer._id)) {
      loadCustomerHistory(selectedCustomer);
    } else {
      setCustHistory(null);
    }
  }, [selectedCustomer]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 12,
        search: query.trim() || undefined,
        type: typeFilter === 'All' ? undefined : typeFilter
      };
      const { data } = await customersApi.list(params);
      setCustomers(data.customers || []);
      setTotalPages(data.pages || 1);
    } catch (e) {
      console.error('Error loading customers:', e);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerHistory = async (cust) => {
    setCustHistoryLoading(true);
    try {
      const cId = cust.id || cust._id;
      const [salesRes, returnsRes] = await Promise.allSettled([
        salesApi.list({ customerId: cId, limit: 100 }),
        fetch('/api/returns')
      ]);

      let invoices = [];
      if (salesRes.status === 'fulfilled' && salesRes.value.data) {
        invoices = salesRes.value.data.invoices || [];
      }

      let allReturns = [];
      if (returnsRes.status === 'fulfilled' && returnsRes.value.ok) {
        const rData = await returnsRes.value.json();
        allReturns = rData.data || [];
      }

      const custReturns = allReturns.filter(r => r.customerId === cId || r.customerName === cust.name);
      const totalReturnedVal = custReturns.reduce((sum, r) => sum + (Number(r.totalValue) || 0), 0);

      setCustHistory({
        totalOrders: invoices.length,
        totalReturns: custReturns.length,
        returnRate: invoices.length > 0 ? ((custReturns.length / invoices.length) * 100).toFixed(1) : '0.0',
        lastReturnDate: custReturns.length > 0 ? new Date(custReturns[0].createdAt).toLocaleDateString('en-IN') : 'None',
        creditNotesCount: custReturns.filter(r => r.status === 'Closed').length,
        recoveryValue: totalReturnedVal
      });
    } catch (e) {
      console.error('Error loading customer history:', e);
      setCustHistory({
        totalOrders: 0,
        totalReturns: 0,
        returnRate: '0.0',
        lastReturnDate: 'None',
        creditNotesCount: 0,
        recoveryValue: 0
      });
    } finally {
      setCustHistoryLoading(false);
    }
  };

  const handleCardClick = (cust) => {
    if (onSelectCustomer) {
      onSelectCustomer(cust);
    }
  };

  const handleCardDoubleClick = (cust) => {
    if (onSelectCustomer) onSelectCustomer(cust);
    if (onConfirmCustomer) onConfirmCustomer(cust);
  };

  const handleSaveQuickCustomer = async (e) => {
    e.preventDefault();
    if (!quickForm.name || !quickForm.phone) {
      alert('Please enter Customer Name and Phone Number.');
      return;
    }
    try {
      const res = await customersApi.create(quickForm);
      const newCust = res.data.customer || res.data;
      alert(`Customer "${newCust.name}" created successfully!`);
      setShowQuickModal(false);
      setQuickForm({ name: '', phone: '', customerType: 'Retail Shop', city: '', gstin: '' });
      loadCustomers();
      if (onSelectCustomer) onSelectCustomer(newCust);
    } catch (e) {
      alert('Error creating customer. Please check fields.');
    }
  };

  const isSelected = (c) => {
    if (!selectedCustomer) return false;
    return (selectedCustomer.id && selectedCustomer.id === c.id) ||
           (selectedCustomer._id && selectedCustomer._id === c._id) ||
           (selectedCustomer.name && selectedCustomer.name === c.name);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      
      {/* SEARCH BOX & TYPE FILTER CHIPS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        
        {/* LIVE SEARCH BAR */}
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search customer by Name, Store, Code, Phone, GST, City, Email..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 2.2rem 0.65rem 2.4rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '0.875rem',
              fontWeight: 600,
              outline: 'none',
              backgroundColor: '#ffffff'
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* CUSTOMER TYPE FILTER CHIPS */}
        <div style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {[
            'All',
            'Retail Shop',
            'Supermarket',
            'Wholesale',
            'Distributor',
            'D2C Customer',
            'Private Label'
          ].map(type => {
            const active = typeFilter === type;
            return (
              <button
                key={type}
                type="button"
                onClick={() => { setTypeFilter(type); setPage(1); }}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: active ? 800 : 600,
                  color: active ? '#ffffff' : '#475569',
                  backgroundColor: active ? '#3f1d07' : '#e2e8f0',
                  border: 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* CUSTOMER CARDS GRID */}
      {loading ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
          Loading customers database...
        </div>
      ) : customers.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.85rem', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
          {customers.map(c => {
            const active = isSelected(c);
            const balance = Number(c.balance || c.outstandingAmount || 0);
            return (
              <div
                key={c.id || c._id}
                onClick={() => handleCardClick(c)}
                onDoubleClick={() => handleCardDoubleClick(c)}
                style={{
                  backgroundColor: active ? '#fef3c7' : '#ffffff',
                  border: active ? '2px solid #3f1d07' : '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '0.85rem 1rem',
                  cursor: 'pointer',
                  boxShadow: active ? '0 4px 6px -1px rgba(63,29,7,0.15)' : '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  justify: 'space-between'
                }}
              >
                {active && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#10b981' }}>
                    <CheckCircle2 size={18} />
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.65rem' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: active ? '#3f1d07' : '#f1f5f9',
                      color: active ? '#ffffff' : '#3f1d07',
                      fontWeight: 800,
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justify: 'center',
                      flexShrink: 0
                    }}
                  >
                    {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.875rem', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {c.name}
                    </div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                      {c.code || `CUS-${c.id}`} {c.city ? `• ${c.city}` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.725rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                  <span style={{ padding: '0.15rem 0.45rem', borderRadius: '4px', fontWeight: 700, backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                    {c.customerType || 'Retail Shop'}
                  </span>
                  <span style={{ fontWeight: 800, color: balance > 0 ? '#ef4444' : '#10b981' }}>
                    Due: ₹{balance.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px border #cbd5e1' }}>
          <Store size={36} style={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>No customers found matching "{query}"</div>
          <button
            type="button"
            onClick={() => {
              setQuickForm(prev => ({ ...prev, name: query }));
              setShowQuickModal(true);
            }}
            style={{ marginTop: '0.75rem', padding: '0.45rem 1rem', borderRadius: '6px', backgroundColor: '#3f1d07', color: '#ffffff', fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            <UserPlus size={14} style={{ display: 'inline', marginRight: '4px' }} /> Quick Create Customer
          </button>
        </div>
      )}

      {/* SELECTED CUSTOMER PROFILE & RETURN HISTORY SUMMARY PANEL */}
      {selectedCustomer && (
        <div style={{ backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserCheck size={18} style={{ color: '#10b981' }} />
              <div>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#3f1d07', textTransform: 'uppercase' }}>Selected Customer Profile</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{selectedCustomer.name}</h3>
              </div>
            </div>
            <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
              {selectedCustomer.customerType || 'Retail Shop'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', fontSize: '0.75rem', color: '#475569' }}>
            <div>Customer Code: <strong>{selectedCustomer.code || `CUS-${selectedCustomer.id}`}</strong></div>
            <div>Phone: <strong>{selectedCustomer.phone || 'N/A'}</strong></div>
            <div>GSTIN: <strong>{selectedCustomer.gstin || 'Unregistered'}</strong></div>
            <div>City: <strong>{selectedCustomer.city || 'N/A'}</strong></div>
            <div>Outstanding: <strong style={{ color: Number(selectedCustomer.balance) > 0 ? '#ef4444' : '#10b981' }}>₹{Number(selectedCustomer.balance || 0).toLocaleString('en-IN')}</strong></div>
          </div>

          {/* RETURN HISTORY PANEL */}
          {custHistoryLoading ? (
            <div style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '0.75rem', textAlign: 'center' }}>
              Calculating return history metrics...
            </div>
          ) : custHistory && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '0.85rem', borderTop: '1px solid #cbd5e1', paddingTop: '0.85rem', textAlign: 'center' }}>
              <div style={{ backgroundColor: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Total Invoices</div>
                <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{custHistory.totalOrders}</strong>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Total Returns</div>
                <strong style={{ fontSize: '0.9rem', color: '#b45309' }}>{custHistory.totalReturns}</strong>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Return Rate</div>
                <strong style={{ fontSize: '0.9rem', color: Number(custHistory.returnRate) > 10 ? '#ef4444' : '#10b981' }}>{custHistory.returnRate}%</strong>
              </div>
              <div style={{ backgroundColor: '#ffffff', padding: '0.5rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Returned Value</div>
                <strong style={{ fontSize: '0.9rem', color: '#10b981' }}>₹{custHistory.recoveryValue}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QUICK CREATE CUSTOMER MODAL */}
      {showQuickModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1100 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #cbd5e1', maxWidth: '480px', width: '100%', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <UserPlus size={18} style={{ color: '#3f1d07' }} /> Quick Create Customer
              </h3>
              <button onClick={() => setShowQuickModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveQuickCustomer} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Customer / Store Name *</label>
                <input
                  type="text"
                  required
                  value={quickForm.name}
                  onChange={e => setQuickForm({ ...quickForm, name: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={quickForm.phone}
                    onChange={e => setQuickForm({ ...quickForm, phone: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>Customer Type</label>
                  <select
                    value={quickForm.customerType}
                    onChange={e => setQuickForm({ ...quickForm, customerType: e.target.value })}
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
                    value={quickForm.city}
                    onChange={e => setQuickForm({ ...quickForm, city: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.2rem' }}>GSTIN Number</label>
                  <input
                    type="text"
                    placeholder="33ABCDE1234F1Z5"
                    value={quickForm.gstin}
                    onChange={e => setQuickForm({ ...quickForm, gstin: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.8rem' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowQuickModal(false)}
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
