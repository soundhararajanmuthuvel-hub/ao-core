import React, { useState, useEffect, useRef } from 'react';
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
  Inbox,
  Eye,
  RefreshCw
} from 'lucide-react';
import { customersApi, salesApi } from '../api';

export default function CustomerPicker({
  selectedCustomer,
  onSelectCustomer,
  onConfirmCustomer,
  mode = 'panel', // 'panel' | 'dropdown'
  placeholder = 'Type 2+ chars to search by Name, Store, Code, Phone, GST, City...'
}) {
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const dropdownRef = useRef(null);

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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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


  const [loadCustomersError, setLoadCustomersError] = useState(null);

  const loadCustomers = async () => {
    setLoading(true);
    setLoadCustomersError(null);
    try {
      const params = {
        page,
        limit: 50,
        search: query.trim() || undefined,
        type: typeFilter === 'All' ? undefined : typeFilter
      };
      const { data } = await customersApi.list(params);
      if (data && data.success === false) {
        setLoadCustomersError(data.message || 'Failed to retrieve customers from server.');
        setCustomers([]);
        return;
      }
      const list = (data && data.customers) ? data.customers : (data && data.data) ? data.data : (Array.isArray(data) ? data : []);
      setCustomers(list);
    } catch (e) {
      console.error('Error loading customers:', e);
      setLoadCustomersError(e.response?.data?.message || 'Could not connect to customer database server.');
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

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < customers.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : customers.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < customers.length) {
        const sel = customers[highlightedIndex];
        if (onSelectCustomer) onSelectCustomer(sel);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  if (mode === 'dropdown') {
    const selCust = selectedCustomer && typeof selectedCustomer === 'object' ? selectedCustomer : customers.find(c => String(c.id || c._id) === String(selectedCustomer));
    const balance = selCust ? Number(selCust.balance || selCust.outstandingAmount || 0) : 0;
    const dueColor = balance <= 0 ? '#10b981' : balance <= 10000 ? '#f59e0b' : '#ef4444';
    const dueText = balance <= 0 ? 'No Due' : balance <= 10000 ? `Small Due (₹${balance.toLocaleString()})` : `Overdue (₹${balance.toLocaleString()})`;

    return (
      <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
        {selCust ? (
          <div style={{ backgroundColor: '#F5EFE6', border: '2px solid #C9A25D', borderRadius: '10px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 2px 8px rgba(43,29,20,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#2B1D14', color: '#E8C97A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '1rem', border: '1px solid #C9A25D' }}>
                {selCust.name ? selCust.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#2B1D14' }}>{selCust.name}</strong>
                  {selCust.customerCode && <span style={{ fontSize: '0.7rem', fontWeight: 800, fontFamily: 'monospace', color: '#8A734C', backgroundColor: '#FEF3C7', padding: '0.1rem 0.35rem', borderRadius: '4px', border: '1px solid #fde68a' }}>[{selCust.customerCode}]</span>}
                  <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '0.1rem 0.35rem', borderRadius: '4px', backgroundColor: '#eff6ff', color: '#1d4ed8' }}>{selCust.customerType || 'Retail Shop'}</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.15rem' }}>
                  {selCust.phone || selCust.mobile} {selCust.city ? `• ${selCust.city}` : ''} {selCust.gstin || selCust.gstNumber ? `• GST: ${selCust.gstin || selCust.gstNumber}` : ''}
                </div>
                <div style={{ marginTop: '0.2rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: dueColor, backgroundColor: '#ffffff', padding: '0.1rem 0.4rem', borderRadius: '4px', border: `1px solid ${dueColor}` }}>
                    ● {dueText}
                  </span>
                  {selCust.creditLimit > 0 && (
                    <span style={{ fontSize: '0.7rem', color: '#64748b' }}>Limit: ₹{Number(selCust.creditLimit).toLocaleString()}</span>
                  )}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setShowProfileDrawer(true)}
                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', backgroundColor: '#ffffff', color: '#2B1D14', border: '1px solid #C9A25D', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Eye size={14} /> 360° Profile
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onSelectCustomer) onSelectCustomer(null);
                  setIsOpen(true);
                }}
                style={{ padding: '0.35rem 0.65rem', borderRadius: '6px', backgroundColor: '#2B1D14', color: '#E8C97A', border: '1px solid #C9A25D', fontSize: '0.75rem', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <RefreshCw size={14} /> Change
              </button>
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#C9A25D' }} />
              <input
                type="text"
                placeholder={placeholder}
                value={query}
                onFocus={() => setIsOpen(true)}
                onChange={e => {
                  setQuery(e.target.value);
                  setIsOpen(true);
                }}
                onKeyDown={handleKeyDown}
                style={{
                  width: '100%',
                  padding: '0.65rem 2.2rem 0.65rem 2.4rem',
                  borderRadius: '8px',
                  border: '2px solid #C9A25D',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  outline: 'none',
                  backgroundColor: '#FEF3C7',
                  color: '#2B1D14'
                }}
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{ position: 'absolute', right: '12px', top: '12px', background: 'none', border: 'none', cursor: 'pointer', color: '#2B1D14' }}
                >
                  <X size={16} />
                </button>
              ) : (
                <span style={{ position: 'absolute', right: '12px', top: '10px', fontSize: '0.65rem', fontWeight: 800, color: '#8A734C', backgroundColor: '#ffffff', padding: '0.15rem 0.4rem', borderRadius: '4px', border: '1px solid #C9A25D' }}>
                  ⚡ Enterprise Autocomplete
                </span>
              )}
            </div>

            {/* DROPDOWN OVERLAY */}
            {isOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#ffffff', border: '2px solid #C9A25D', borderRadius: '10px', boxShadow: '0 12px 30px -5px rgba(43,29,20,0.25)', zIndex: 2000, marginTop: '4px', maxHeight: '360px', overflowY: 'auto' }}>
                <div style={{ padding: '0.5rem 0.75rem', backgroundColor: '#2B1D14', color: '#E8C97A', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #C9A25D' }}>
                  <span style={{ fontSize: '0.725rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {query.trim() ? `Search Results (${customers.length})` : `Recently Used Customers (${customers.length})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowQuickModal(true)}
                    style={{ padding: '0.2rem 0.55rem', borderRadius: '4px', backgroundColor: '#C9A25D', color: '#2B1D14', fontSize: '0.7rem', fontWeight: 900, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                  >
                    <UserPlus size={12} /> + Create Customer
                  </button>
                </div>

                {loading ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: '#8A734C', fontSize: '0.8rem', fontWeight: 600 }}>
                    Searching customer database...
                  </div>
                ) : customers.length > 0 ? (
                  <div>
                    {customers.map((c, idx) => {
                      const isHighlighted = idx === highlightedIndex;
                      const bal = Number(c.balance || c.outstandingAmount || 0);
                      const dueClr = bal <= 0 ? '#10b981' : bal <= 10000 ? '#b45309' : '#dc2626';

                      return (
                        <div
                          key={c.id || c._id}
                          onClick={() => {
                            if (onSelectCustomer) onSelectCustomer(c);
                            setIsOpen(false);
                          }}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          style={{
                            padding: '0.65rem 0.85rem',
                            borderBottom: '1px solid #f1f5f9',
                            cursor: 'pointer',
                            backgroundColor: isHighlighted ? '#FEF3C7' : '#ffffff',
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            transition: 'background-color 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div style={{ width: '34px', height: '34px', borderRadius: '50%', backgroundColor: isHighlighted ? '#2B1D14' : '#F5EFE6', color: isHighlighted ? '#E8C97A' : '#2B1D14', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '0.85rem', border: '1px solid #C9A25D' }}>
                              {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                            </div>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <strong style={{ fontSize: '0.85rem', color: '#2B1D14' }}>{c.name}</strong>
                                {c.customerCode && <span style={{ fontSize: '0.65rem', fontWeight: 800, fontFamily: 'monospace', color: '#8A734C', backgroundColor: '#F5EFE6', padding: '0.05rem 0.3rem', borderRadius: '3px' }}>[{c.customerCode}]</span>}
                                <span style={{ fontSize: '0.625rem', fontWeight: 800, padding: '0.05rem 0.3rem', borderRadius: '3px', backgroundColor: '#eff6ff', color: '#1d4ed8' }}>{c.customerType || 'Retail Shop'}</span>
                              </div>
                              <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                                {c.phone || c.mobile || 'No Phone'} {c.city ? `• ${c.city}` : ''} {c.gstin ? `• GST: ${c.gstin}` : ''}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: dueClr }}>
                              ₹{bal.toLocaleString('en-IN')}
                            </div>
                            <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                              {bal <= 0 ? 'No Due' : 'Outstanding'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.825rem', color: '#64748b', fontWeight: 600 }}>No customer found matching "{query}"</div>
                    <button
                      type="button"
                      onClick={() => setShowQuickModal(true)}
                      style={{ marginTop: '0.5rem', padding: '0.4rem 0.85rem', borderRadius: '6px', backgroundColor: '#2B1D14', color: '#E8C97A', fontSize: '0.75rem', fontWeight: 800, border: '1px solid #C9A25D', cursor: 'pointer' }}
                    >
                      + Create Customer "{query}"
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 360 PROFILE DRAWER MODAL */}
        {showProfileDrawer && selCust && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '100%', maxWidth: '520px', backgroundColor: '#ffffff', height: '100%', overflowY: 'auto', padding: '1.5rem', boxShadow: '-10px 0 30px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #C9A25D', paddingBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 900, color: '#2B1D14', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🏛️ Customer 360° Profile: {selCust.name}
                </h3>
                <button type="button" onClick={() => setShowProfileDrawer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem', backgroundColor: '#F5EFE6', padding: '1rem', borderRadius: '10px', border: '1px solid #C9A25D' }}>
                <div>
                  <div style={{ fontSize: '0.675rem', fontWeight: 800, color: '#8A734C' }}>Customer Code</div>
                  <strong style={{ fontFamily: 'monospace', color: '#2B1D14' }}>{selCust.customerCode || 'N/A'}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.675rem', fontWeight: 800, color: '#8A734C' }}>Customer Type</div>
                  <strong style={{ color: '#2B1D14' }}>{selCust.customerType || 'Retail Shop'}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.675rem', fontWeight: 800, color: '#8A734C' }}>Mobile / WhatsApp</div>
                  <strong style={{ color: '#2B1D14' }}>{selCust.phone || selCust.mobile || 'N/A'}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.675rem', fontWeight: 800, color: '#8A734C' }}>GST Number</div>
                  <strong style={{ fontFamily: 'monospace', color: '#2B1D14' }}>{selCust.gstin || selCust.gstNumber || 'Unregistered'}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.675rem', fontWeight: 800, color: '#8A734C' }}>Outstanding Balance</div>
                  <strong style={{ color: dueColor, fontSize: '0.9rem' }}>₹{balance.toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '0.675rem', fontWeight: 800, color: '#8A734C' }}>Credit Limit</div>
                  <strong style={{ color: '#2B1D14' }}>₹{Number(selCust.creditLimit || 0).toLocaleString('en-IN')}</strong>
                </div>
              </div>

              {custHistoryLoading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#8A734C' }}>Loading 360° metrics...</div>
              ) : custHistory ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
                    <div style={{ padding: '0.6rem', backgroundColor: '#FEF3C7', borderRadius: '8px', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#b45309' }}>Total Orders</div>
                      <div style={{ fontSize: '1rem', fontWeight: 900, color: '#2B1D14' }}>{custHistory.totalOrders}</div>
                    </div>
                    <div style={{ padding: '0.6rem', backgroundColor: '#FEF3C7', borderRadius: '8px', border: '1px solid #fde68a' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: '#b45309' }}>Total Sales</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 900, color: '#2B1D14' }}>₹{Number(custHistory.totalSalesValue || 0).toLocaleString('en-IN')}</div>
                    </div>
                    <div style={{ padding: '0.6rem', backgroundColor: custHistory.riskBg, borderRadius: '8px', border: `1px solid ${custHistory.riskColor}` }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 800, color: custHistory.riskColor }}>Risk Profile</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 900, color: custHistory.riskColor }}>{custHistory.riskLevel}</div>
                    </div>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setShowProfileDrawer(false)}
                style={{ padding: '0.65rem', borderRadius: '8px', backgroundColor: '#2B1D14', color: '#E8C97A', fontSize: '0.85rem', fontWeight: 800, border: 'none', cursor: 'pointer', marginTop: 'auto' }}
              >
                Close Profile
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }


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
      {loadCustomersError ? (
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
          <AlertTriangle size={36} style={{ color: '#d97706', marginBottom: '0.5rem', display: 'block', margin: '0 auto 0.5rem auto' }} />
          <div style={{ fontSize: '0.875rem', fontWeight: 800, color: '#b45309' }}>
            Unable to load customers from server
          </div>
          <div style={{ fontSize: '0.75rem', color: '#78350f', marginTop: '0.25rem', marginBottom: '0.85rem' }}>
            {loadCustomersError}
          </div>
          <button
            type="button"
            onClick={loadCustomers}
            style={{ padding: '0.45rem 1rem', borderRadius: '6px', backgroundColor: '#3f1d07', color: '#ffffff', fontSize: '0.78rem', fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            🔄 Retry Loading Customers
          </button>
        </div>
      ) : loading ? (
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
