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
  DollarSign,
  ShieldAlert,
  ShieldCheck,
  Truck,
  Calendar,
  MessageSquare,
  Mail,
  ExternalLink,
  ChevronRight,
  User,
  Inbox
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

  // Selected customer 360 history & tabs state
  const [profileTab, setProfileTab] = useState('overview');
  const [custHistory, setCustHistory] = useState(null);
  const [custHistoryLoading, setCustHistoryLoading] = useState(false);
  const [custInvoices, setCustInvoices] = useState([]);
  const [custProfileError, setCustProfileError] = useState(null);

  // Quick Create Customer Modal State
  const [showQuickModal, setShowQuickModal] = useState(false);
  const [quickForm, setQuickForm] = useState({
    name: '',
    phone: '',
    customerType: 'Retail Shop',
    city: '',
    gstin: ''
  });

  // Immediate load on mount
  useEffect(() => {
    loadCustomers();
  }, []);

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
      loadCustomer360Profile(selectedCustomer);
    } else {
      setCustHistory(null);
      setCustInvoices([]);
    }
  }, [selectedCustomer]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 50,
        search: query.trim() || undefined,
        type: typeFilter === 'All' ? undefined : typeFilter
      };
      const { data } = await customersApi.list(params);
      const list = (data && data.customers) ? data.customers : (data && data.data) ? data.data : (Array.isArray(data) ? data : []);
      setCustomers(list);
    } catch (e) {
      console.error('Error loading customers:', e);
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };


  const loadCustomer360Profile = async (cust) => {
    setCustHistoryLoading(true);
    setCustProfileError(null);
    try {
      const cId = cust.id || cust._id;

      // Safe JSON parse helper
      const parseResponseJson = async (res) => {
        if (!res || !res.ok) return null;
        const contentType = res.headers ? (res.headers.get('content-type') || '') : '';
        if (res.headers && !contentType.includes('application/json')) return null;
        try {
          return await res.json();
        } catch (e) {
          return null;
        }
      };

      // Call profile API and fallback to sales & returns APIs via Promise.allSettled
      const [profileRes, salesRes, returnsRes] = await Promise.allSettled([
        customersApi.profile(cId),
        customersApi.sales(cId),
        fetch('/api/returns')
      ]);

      let profileData = null;
      if (profileRes.status === 'fulfilled' && profileRes.value.data && profileRes.value.data.success) {
        profileData = profileRes.value.data;
      }

      let invoices = [];
      if (profileData && profileData.invoices) {
        invoices = profileData.invoices;
      } else if (salesRes.status === 'fulfilled' && salesRes.value.data) {
        invoices = salesRes.value.data.sales || salesRes.value.data.invoices || [];
      }
      setCustInvoices(invoices);

      let allReturns = [];
      if (profileData && profileData.returns) {
        allReturns = profileData.returns;
      } else if (returnsRes.status === 'fulfilled' && returnsRes.value.ok) {
        const rData = await parseResponseJson(returnsRes.value);
        if (rData && rData.data) allReturns = rData.data;
      }

      const custReturns = allReturns.filter(r => r.customerId === cId || r.customerName === cust.name);
      const totalReturnedVal = custReturns.reduce((sum, r) => sum + (Number(r.totalValue) || 0), 0);
      const totalSalesVal = invoices.reduce((sum, inv) => sum + (Number(inv.grandTotal) || 0), 0);
      const returnRateNum = invoices.length > 0 ? (custReturns.length / invoices.length) * 100 : 0;

      let riskLevel = 'Low';
      let riskColor = '#10b981';
      let riskBg = '#ecfdf5';

      if (returnRateNum > 15 || Number(cust.balance || 0) > 10000) {
        riskLevel = 'High';
        riskColor = '#ef4444';
        riskBg = '#fef2f2';
      } else if (returnRateNum > 5 || Number(cust.balance || 0) > 0) {
        riskLevel = 'Medium';
        riskColor = '#f59e0b';
        riskBg = '#fffbeb';
      }

      setCustHistory({
        totalOrders: invoices.length,
        completedOrders: invoices.filter(i => i.status !== 'Cancelled').length,
        cancelledOrders: invoices.filter(i => i.status === 'Cancelled').length,
        totalSalesValue: totalSalesVal,
        totalReturns: custReturns.length,
        returnRate: returnRateNum.toFixed(1),
        riskLevel,
        riskColor,
        riskBg,
        lastReturnDate: custReturns.length > 0 ? new Date(custReturns[0].createdAt).toLocaleDateString('en-IN') : 'None',
        creditNotesCount: custReturns.filter(r => r.status === 'Closed').length,
        recoveryValue: totalReturnedVal,
        mostPurchasedProduct: invoices.length > 0 && invoices[0].items ? invoices[0].items[0]?.productName : '—',
        mostReturnedReason: custReturns.length > 0 ? custReturns[0].returnReason : '—',
        returnsList: custReturns
      });
    } catch (e) {
      console.error('Error loading customer 360 profile:', e);
      setCustProfileError('Unable to load customer profile details.');
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

      {/* CUSTOMER CARDS GRID WITH FULL INFORMATION */}
      {loading ? (
        <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
          Loading customer database...
        </div>
      ) : customers.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.85rem', maxHeight: '320px', overflowY: 'auto', paddingRight: '4px' }}>
          {customers.map(c => {
            const active = isSelected(c);
            const balance = Number(c.balance || c.outstandingAmount || 0);
            const creditLimit = Number(c.creditLimit || 0);
            const availCredit = Math.max(0, creditLimit - balance);
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
                  gap: '0.5rem'
                }}
              >
                {active && (
                  <div style={{ position: 'absolute', top: '8px', right: '8px', color: '#10b981' }}>
                    <CheckCircle2 size={18} />
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: active ? '#3f1d07' : '#f1f5f9',
                      color: active ? '#ffffff' : '#3f1d07',
                      fontWeight: 800,
                      fontSize: '1.05rem',
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
                      {c.name || '—'}
                    </div>
                    <div style={{ fontSize: '0.725rem', color: '#475569' }}>
                      Store: <strong>{c.businessName || c.name || '—'}</strong>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                      {c.customerCode || c.code || `CUS-${c.id}`} • {c.city || c.territory || 'Chennai'}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: '0.725rem', color: '#475569', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem', backgroundColor: '#f8fafc', padding: '0.4rem 0.6rem', borderRadius: '6px' }}>
                  <div>GST: <strong>{c.gstNumber || c.gstin || '—'}</strong></div>
                  <div>Phone: <strong>{c.phone || '—'}</strong></div>
                  <div>Salesman: <strong>{c.salesman ? c.salesman.name : '—'}</strong></div>
                  <div>Limit: <strong>₹{creditLimit.toLocaleString('en-IN')}</strong></div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.725rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.4rem' }}>
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

      {/* ENTERPRISE 360° CUSTOMER PROFILE PANEL */}
      {selectedCustomer && (
        <div style={{ backgroundColor: '#ffffff', padding: '1.25rem', borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
          
          {/* PROFILE HEADER & QUICK ACTIONS */}
          {custProfileError && (
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', padding: '0.65rem 1rem', borderRadius: '8px', marginBottom: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#b45309', fontWeight: 700 }}>
                ⚠️ Unable to load full 360° profile metrics. Basic profile displayed.
              </span>
              <button
                type="button"
                onClick={() => loadCustomer360Profile(selectedCustomer)}
                style={{ padding: '0.3rem 0.65rem', borderRadius: '4px', backgroundColor: '#3f1d07', color: '#ffffff', fontSize: '0.725rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
              >
                🔄 Retry Connection
              </button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingBottom: '0.85rem', borderBottom: '1px solid #e2e8f0' }}>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#3f1d07', color: '#ffffff', fontWeight: 800, fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedCustomer.name ? selectedCustomer.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{selectedCustomer.name || '—'}</h3>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '4px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                    {selectedCustomer.customerType || 'Retail Shop'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.15rem' }}>
                  Code: <strong>{selectedCustomer.customerCode || selectedCustomer.code || `CUS-${selectedCustomer.id}`}</strong> • GSTIN: <strong>{selectedCustomer.gstNumber || selectedCustomer.gstin || '—'}</strong> • Phone: <strong>{selectedCustomer.phone || '—'}</strong>
                </div>
              </div>
            </div>

            {/* QUICK COMMUNICATION ACTION BUTTONS */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {selectedCustomer.phone && selectedCustomer.phone !== '—' && (
                <>
                  <a
                    href={`https://wa.me/${selectedCustomer.phone.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', backgroundColor: '#25D366', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <MessageSquare size={14} /> WhatsApp
                  </a>
                  <a
                    href={`tel:${selectedCustomer.phone}`}
                    style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', backgroundColor: '#3b82f6', color: '#ffffff', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  >
                    <Phone size={14} /> Call
                  </a>
                </>
              )}
              {onConfirmCustomer && (
                <button
                  type="button"
                  onClick={() => onConfirmCustomer(selectedCustomer)}
                  style={{ padding: '0.45rem 1rem', borderRadius: '6px', backgroundColor: '#3f1d07', color: '#ffffff', fontSize: '0.78rem', fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  Proceed to Invoices <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>

          {/* 360° PROFILE TABS BAR */}
          <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.85rem', marginBottom: '0.85rem', borderBottom: '1px solid #f1f5f9', overflowX: 'auto' }}>
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'orders', label: 'Orders' },
              { id: 'invoices', label: `Invoices (${custInvoices.length})` },
              { id: 'returns', label: 'Returns' },
              { id: 'accounts', label: 'Accounts' },
              { id: 'crm', label: 'CRM' },
              { id: 'delivery', label: 'Delivery' }
            ].map(t => {
              const active = profileTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setProfileTab(t.id)}
                  style={{
                    padding: '0.4rem 0.85rem',
                    border: 'none',
                    borderBottom: active ? '2px solid #3f1d07' : '2px solid transparent',
                    backgroundColor: 'transparent',
                    fontSize: '0.78rem',
                    fontWeight: active ? 800 : 600,
                    color: active ? '#3f1d07' : '#64748b',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* TAB 1: OVERVIEW */}
          {profileTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              
              {/* RETURN RISK CARD */}
              {custHistory && (
                <div style={{ backgroundColor: custHistory.riskBg, border: `1px solid ${custHistory.riskColor}`, padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ShieldAlert size={18} style={{ color: custHistory.riskColor }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0f172a' }}>
                      Customer Return Risk Rating: <span style={{ color: custHistory.riskColor, textTransform: 'uppercase' }}>{custHistory.riskLevel} Risk</span>
                    </span>
                  </div>
                  <span style={{ fontSize: '0.725rem', color: '#475569' }}>
                    Return Rate: <strong>{custHistory.returnRate}%</strong> • Total Orders: <strong>{custHistory.totalOrders}</strong>
                  </span>
                </div>
              )}

              {/* METRICS GRID */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', textAlign: 'center' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Total Invoices</div>
                  <strong style={{ fontSize: '1rem', color: '#0f172a' }}>{custHistory ? custHistory.totalOrders : '...'}</strong>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Total Sales Value</div>
                  <strong style={{ fontSize: '1rem', color: '#10b981' }}>₹{custHistory ? custHistory.totalSalesValue.toLocaleString('en-IN') : '...'}</strong>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Total Returns</div>
                  <strong style={{ fontSize: '1rem', color: '#b45309' }}>{custHistory ? custHistory.totalReturns : '...'}</strong>
                </div>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase' }}>Outstanding Balance</div>
                  <strong style={{ fontSize: '1rem', color: Number(selectedCustomer.balance || 0) > 0 ? '#ef4444' : '#10b981' }}>₹{Number(selectedCustomer.balance || 0).toLocaleString('en-IN')}</strong>
                </div>
              </div>

              {/* DETAILED INFORMATION SUMMARY */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.78rem', color: '#334155' }}>
                <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3f1d07', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>🏢 Business & Contact Profile</h4>
                  <div><strong>Store / Business:</strong> {selectedCustomer.businessName || selectedCustomer.name || '—'}</div>
                  <div><strong>Owner / Contact:</strong> {selectedCustomer.contactPerson || selectedCustomer.ownerName || selectedCustomer.name || '—'}</div>
                  <div><strong>Email Address:</strong> {selectedCustomer.email || '—'}</div>
                  <div><strong>Full Address:</strong> {selectedCustomer.address || '—'}</div>
                  <div><strong>City / Territory:</strong> {selectedCustomer.city || selectedCustomer.territory || 'Chennai'}</div>
                </div>

                <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: '#3f1d07', margin: '0 0 0.5rem 0', textTransform: 'uppercase' }}>💳 Financial & Logistics Profile</h4>
                  <div><strong>Credit Limit:</strong> ₹{Number(selectedCustomer.creditLimit || 50000).toLocaleString('en-IN')}</div>
                  <div><strong>Payment Terms:</strong> {selectedCustomer.paymentTerms || 'COD'}</div>
                  <div><strong>Assigned Salesman:</strong> {selectedCustomer.salesman?.name || selectedCustomer.salesman || '—'}</div>
                  <div><strong>Logistics Route:</strong> {selectedCustomer.routeZone || selectedCustomer.route || 'Central Metro Logistics Route'}</div>
                  <div><strong>Warehouse:</strong> {selectedCustomer.warehouse || 'Main Finished Goods WH'}</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ORDERS */}
          {profileTab === 'orders' && (
            <div style={{ fontSize: '0.78rem' }}>
              {custInvoices.length > 0 ? (
                <div style={{ backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div>Total Orders Recorded: <strong>{custInvoices.length}</strong></div>
                  <div>Completed Orders: <strong style={{ color: '#10b981' }}>{custInvoices.filter(i => i.status !== 'Cancelled').length}</strong></div>
                  <div>Latest Order Date: <strong>{new Date(custInvoices[0].createdAt).toLocaleDateString('en-IN')}</strong></div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px border #e2e8f0' }}>
                  <Inbox size={32} style={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
                  <div style={{ fontWeight: 700, color: '#64748b' }}>No Orders Found</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INVOICES */}
          {profileTab === 'invoices' && (
            <div>
              {custInvoices.length > 0 ? (
                <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left' }}>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Invoice #</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Date</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Amount</th>
                        <th style={{ padding: '0.4rem 0.6rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {custInvoices.map(inv => (
                        <tr key={inv.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.4rem 0.6rem', fontWeight: 800, fontFamily: 'monospace', color: '#3f1d07' }}>{inv.invoiceNumber}</td>
                          <td style={{ padding: '0.4rem 0.6rem' }}>{new Date(inv.date || inv.createdAt).toLocaleDateString('en-IN')}</td>
                          <td style={{ padding: '0.4rem 0.6rem', fontWeight: 700, color: '#10b981' }}>₹{inv.grandTotal}</td>
                          <td style={{ padding: '0.4rem 0.6rem' }}>
                            <span style={{ padding: '0.15rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 800, backgroundColor: '#ecfdf5', color: '#047857' }}>
                              {inv.paymentStatus || 'Paid'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px border #e2e8f0' }}>
                  <Inbox size={32} style={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
                  <div style={{ fontWeight: 700, color: '#64748b' }}>No Invoices Found</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: RETURNS */}
          {profileTab === 'returns' && (
            <div style={{ fontSize: '0.78rem' }}>
              {custHistory && custHistory.returnsList && custHistory.returnsList.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                  <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div>Total Returns: <strong>{custHistory.totalReturns}</strong></div>
                    <div>Recovered Value: <strong style={{ color: '#10b981' }}>₹{custHistory.recoveryValue}</strong></div>
                    <div>Last Return: <strong>{custHistory.lastReturnDate}</strong></div>
                  </div>
                  <div style={{ backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <div>Primary Reason: <strong>{custHistory.mostReturnedReason}</strong></div>
                    <div>Credit Notes Issued: <strong>{custHistory.creditNotesCount}</strong></div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px border #e2e8f0' }}>
                  <Inbox size={32} style={{ color: '#cbd5e1', marginBottom: '0.5rem' }} />
                  <div style={{ fontWeight: 700, color: '#64748b' }}>No Returns Found</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ACCOUNTS */}
          {profileTab === 'accounts' && (
            <div style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>Ledger Balance: <strong style={{ color: Number(selectedCustomer.balance || 0) > 0 ? '#ef4444' : '#10b981' }}>₹{Number(selectedCustomer.balance || 0).toLocaleString('en-IN')}</strong></div>
              <div>Credit Limit: <strong>₹{Number(selectedCustomer.creditLimit || 50000).toLocaleString('en-IN')}</strong></div>
              <div>Payment Terms: <strong>{selectedCustomer.paymentTerms || 'COD'}</strong></div>
              <div>GST Status: <strong>{selectedCustomer.gstNumber || selectedCustomer.gstin ? 'Registered Active' : 'Unregistered'}</strong></div>
            </div>
          )}

          {/* TAB 6: CRM */}
          {profileTab === 'crm' && (
            <div style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>Assigned Sales Representative: <strong>{selectedCustomer.salesman?.name || selectedCustomer.salesman || '—'}</strong></div>
              <div>CRM Notes: <strong>{selectedCustomer.manufacturingNotes || 'No CRM Notes Recorded'}</strong></div>
              <div>Priority Level: <strong>{selectedCustomer.tier === 'GREEN' ? 'Low' : 'Medium'}</strong></div>
            </div>
          )}

          {/* TAB 7: DELIVERY */}
          {profileTab === 'delivery' && (
            <div style={{ fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', backgroundColor: '#f8fafc', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div>Logistics Route: <strong>{selectedCustomer.routeZone || selectedCustomer.route || 'Central Metro Logistics Route'}</strong></div>
              <div>Delivery Zone: <strong>{selectedCustomer.territory || 'Zone A'}</strong></div>
              <div>Avg Delivery SLA: <strong>24 Hours</strong></div>
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
