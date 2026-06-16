import { useEffect, useState, useCallback } from 'react';
import { ordersApi, productsApi, customersApi, settingsApi } from '../api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { resolveAssetUrl } from '../utils/url';

export default function OrderNoting() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ledger'); // 'ledger', 'new', 'slip'
  
  // Lists
  const [orders, setOrders] = useState([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  
  // Pagination & Search
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected details
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({
    todayOrders: 0,
    preparedOrders: 0,
    packedOrders: 0,
    dispatchedOrders: 0,
    deliveredOrders: 0,
    delayedOrders: 0
  });

  // Modals
  const [showDispatchModal, setShowDispatchModal] = useState(false);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({ courierPartner: 'Professional Couriers', trackingNumber: '', dispatchDate: '' });
  const [deliverForm, setDeliverForm] = useState({ deliveryDate: '', deliveredBy: 'Courier Partner Agent', remarks: '' });

  // Fast Order Entry Form State
  const [newOrderForm, setNewOrderForm] = useState({
    customerId: '',
    customerName: '',
    phoneNumber: '',
    area: '',
    address: '',
    notes: '',
    orderDate: new Date().toISOString().substring(0, 10),
    expectedDispatchDate: '',
    logisticsCharge: 16.00,
    cart: []
  });

  const [selectedCustOutstanding, setSelectedCustOutstanding] = useState([]);

  // Product Selection Form State
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQty, setSelectedQty] = useState(1);

  // Expected dispatch calculation helper
  useEffect(() => {
    if (newOrderForm.orderDate) {
      const d = new Date(newOrderForm.orderDate);
      d.setDate(d.getDate() + 3);
      setNewOrderForm(prev => ({
        ...prev,
        expectedDispatchDate: d.toISOString().substring(0, 10)
      }));
    }
  }, [newOrderForm.orderDate]);

  // Load essential records
  const loadEssentialData = useCallback(async () => {
    try {
      const [prodRes, custRes, settingsRes] = await Promise.all([
        productsApi.list({ limit: 300 }),
        customersApi.list({ limit: 300 }),
        settingsApi.get()
      ]);
      setProducts(prodRes.data.products || []);
      setCustomers(custRes.data.customers || []);
      setSettings(settingsRes.data.settings || null);
      
      if (settingsRes.data.settings) {
        setNewOrderForm(prev => ({
          ...prev,
          logisticsCharge: Number(settingsRes.data.settings.logisticsCharge || 16.00)
        }));
      }
    } catch {
      toast('Failed to load products/customers', 'error');
    }
  }, [toast]);

  // Load orders ledger
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await ordersApi.list({
        page,
        limit: 10,
        search,
        status: statusFilter
      });
      setOrders(data.orders || []);
      setTotalOrders(data.total || 0);
      setPages(data.pages || 1);
    } catch {
      toast('Failed to load orders ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, toast]);

  // Load Dashboard stats
  const loadDashboardStats = useCallback(async () => {
    try {
      const { data } = await ordersApi.dashboard();
      setDashboardStats(data);
    } catch {
      console.error('Failed to load orders dashboard metrics');
    }
  }, []);

  useEffect(() => {
    loadEssentialData();
  }, [loadEssentialData]);

  useEffect(() => {
    loadOrders();
    loadDashboardStats();
  }, [loadOrders, loadDashboardStats]);

  // Customer dropdown select resolver (auto-fills details & resolves pricing)
  const handleCustomerSelect = async (id) => {
    if (!id) {
      setNewOrderForm(prev => ({
        ...prev,
        customerId: '',
        customerName: '',
        phoneNumber: '',
        area: '',
        address: ''
      }));
      setSelectedCustOutstanding([]);
      return;
    }

    const customer = customers.find(c => String(c.id || c._id) === String(id));
    if (customer) {
      setNewOrderForm(prev => ({
        ...prev,
        customerId: id,
        customerName: customer.name || '',
        phoneNumber: customer.phone || '',
        area: customer.state || '',
        address: customer.address || ''
      }));

      try {
        const { data } = await salesApi.outstanding({ customerId: id });
        setSelectedCustOutstanding(data || []);
      } catch (err) {
        console.error(err);
      }

      // Re-calculate cart prices using custom pricing overrides if cart is populated
      setNewOrderForm(prev => {
        const specialPricing = customer.specialPricing || {};
        const updatedCart = prev.cart.map(item => {
          const product = products.find(p => String(p.id) === String(item.productId));
          let resolvedPrice = item.unitPrice;
          if (product) {
            const override = specialPricing[product.id] || specialPricing[product.sku] || null;
            if (override) {
              resolvedPrice = typeof override === 'object' 
                ? Number(override.price || product.sellingPrice) 
                : Number(override);
            } else {
              resolvedPrice = Number(product.sellingPrice);
            }
          }
          return {
            ...item,
            unitPrice: resolvedPrice,
            lineTotal: Number((item.qty * resolvedPrice).toFixed(2))
          };
        });
        return {
          ...prev,
          cart: updatedCart
        };
      });
    }
  };

  // Add Product to Cart
  const handleAddProduct = () => {
    if (!selectedProductId) return toast('Select a product to add', 'warning');
    const product = products.find(p => String(p.id) === String(selectedProductId));
    if (!product) return;

    const qty = Number(selectedQty || 1);
    const existing = newOrderForm.cart.find(item => String(item.productId) === String(product.id));

    // Resolve Customer Special Price
    let unitPrice = Number(product.sellingPrice);
    if (newOrderForm.customerId) {
      const customer = customers.find(c => String(c.id || c._id) === String(newOrderForm.customerId));
      const specialPricing = customer?.specialPricing || {};
      const override = specialPricing[product.id] || specialPricing[product.sku] || null;
      if (override) {
        unitPrice = typeof override === 'object' 
          ? Number(override.price || product.sellingPrice) 
          : Number(override);
      }
    }

    if (existing) {
      const updatedQty = existing.qty + qty;
      const updatedCart = newOrderForm.cart.map(item => 
        String(item.productId) === String(product.id)
          ? { ...item, qty: updatedQty, lineTotal: Number((updatedQty * unitPrice).toFixed(2)) }
          : item
      );
      setNewOrderForm(prev => ({ ...prev, cart: updatedCart }));
    } else {
      const newCartItem = {
        productId: product.id,
        name: product.name,
        qty,
        unitPrice,
        lineTotal: Number((qty * unitPrice).toFixed(2))
      };
      setNewOrderForm(prev => ({ ...prev, cart: [...prev.cart, newCartItem] }));
    }

    setSelectedProductId('');
    setSelectedQty(1);
  };

  // Remove from Cart
  const handleRemoveCartItem = (productId) => {
    setNewOrderForm(prev => ({
      ...prev,
      cart: prev.cart.filter(item => String(item.productId) !== String(productId))
    }));
  };

  // Create Order Submission (Prepared stage)
  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrderForm.customerName) return toast('Customer Name is required', 'error');
    if (!newOrderForm.cart.length) return toast('At least one item is required', 'error');

    try {
      const payload = {
        customerName: newOrderForm.customerName,
        customerId: newOrderForm.customerId || null,
        phoneNumber: newOrderForm.phoneNumber,
        area: newOrderForm.area,
        address: newOrderForm.address,
        notes: newOrderForm.notes,
        orderDate: newOrderForm.orderDate,
        expectedDispatchDate: newOrderForm.expectedDispatchDate,
        logisticsCharge: Number(newOrderForm.logisticsCharge),
        items: newOrderForm.cart
      };
      
      await ordersApi.create(payload);
      toast('Order saved in Prepared stage successfully', 'success');
      
      // Reset Form
      setNewOrderForm({
        customerId: '',
        customerName: '',
        phoneNumber: '',
        area: '',
        address: '',
        notes: '',
        orderDate: new Date().toISOString().substring(0, 10),
        expectedDispatchDate: '',
        logisticsCharge: settings?.logisticsCharge || 16.00,
        cart: []
      });
      
      setActiveTab('ledger');
      loadOrders();
      loadDashboardStats();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save order', 'error');
    }
  };

  // Mark Order as Packed (Deducts stock, creates invoice & shipment)
  const handleMarkPacked = async (id) => {
    const order = orders.find(o => o.id === id);
    if (order && order.customer) {
      const balance = Number(order.customer.balance || 0);
      const unpaidCount = Number(order.customer.invoiceOutstandingCount || 0);
      if (balance > 0) {
        const proceed = window.confirm(
          `⚠️ WARNING: Customer ${order.customer.name} has outstanding dues!\n` +
          `- Payment Cycle: ${order.customer.paymentCycle || 'N/A'}\n` +
          `- Outstanding Balance: ₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
          `- Outstanding Invoices: ${unpaidCount}\n\n` +
          `Are you sure you want to proceed with packing this order?`
        );
        if (!proceed) return;
      }
    }
    try {
      const { data } = await ordersApi.markPacked(id);
      toast(`Order packed! Sales Invoice ${data.invoice?.invoiceNumber} and Shipment ${data.shipment?.shipmentNumber} generated.`, 'success');
      loadOrders();
      loadDashboardStats();
    } catch (err) {
      toast(err.response?.data?.message || 'Stock verification or invoice generation failed', 'error');
    }
  };

  // Open Dispatch Modal
  const openDispatch = (order) => {
    if (order && order.customer) {
      const balance = Number(order.customer.balance || 0);
      const unpaidCount = Number(order.customer.invoiceOutstandingCount || 0);
      if (balance > 0) {
        const proceed = window.confirm(
          `⚠️ WARNING: Customer ${order.customer.name} has outstanding dues!\n` +
          `- Payment Cycle: ${order.customer.paymentCycle || 'N/A'}\n` +
          `- Outstanding Balance: ₹${balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n` +
          `- Outstanding Invoices: ${unpaidCount}\n\n` +
          `Are you sure you want to proceed with dispatching this order?`
        );
        if (!proceed) return;
      }
    }
    setSelectedOrder(order);
    setDispatchForm({
      courierPartner: 'Professional Couriers',
      trackingNumber: '',
      dispatchDate: new Date().toISOString().substring(0, 10)
    });
    setShowDispatchModal(true);
  };

  // Submit Dispatch
  const handleMarkDispatched = async () => {
    if (!dispatchForm.trackingNumber) return toast('Please enter Courier Tracking Code', 'warning');
    try {
      await ordersApi.markDispatched(selectedOrder.id, dispatchForm);
      toast('Order marked as Dispatched! Customer notified via WhatsApp (Simulated).', 'success');
      setShowDispatchModal(false);
      loadOrders();
      loadDashboardStats();
    } catch {
      toast('Dispatch update failed', 'error');
    }
  };

  // Open Deliver Modal
  const openDeliver = (order) => {
    setSelectedOrder(order);
    setDeliverForm({
      deliveryDate: new Date().toISOString().substring(0, 10),
      deliveredBy: 'Courier Agent',
      remarks: ''
    });
    setShowDeliverModal(true);
  };

  // Submit Deliver
  const handleMarkDelivered = async () => {
    try {
      await ordersApi.markDelivered(selectedOrder.id, deliverForm);
      toast('Order delivered successfully! Customer notified (Simulated).', 'success');
      setShowDeliverModal(false);
      loadOrders();
      loadDashboardStats();
    } catch {
      toast('Delivery completion failed', 'error');
    }
  };

  // View slip/copy
  const viewDeliverySlip = (order) => {
    setSelectedOrder(order);
    setActiveTab('slip');
  };

  // Print slip
  const handlePrint = () => {
    window.print();
  };

  // Calculations for Order Entry Cart Summary
  const cartSubtotal = newOrderForm.cart.reduce((sum, i) => sum + i.lineTotal, 0);
  const cartGrandTotal = cartSubtotal + Number(newOrderForm.logisticsCharge || 0);

  // Status colors helper
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Prepared': return 'status-badge status-warning'; // Yellow
      case 'Packed': return 'status-badge status-primary'; // Blue
      case 'Dispatched': return 'status-badge status-in-progress'; // Orange
      case 'Delivered': return 'status-badge status-success'; // Green
      default: return 'status-badge';
    }
  };

  // Check if order date is delayed (>3 days in Prepared status)
  const isOrderDelayed = (order) => {
    if (order.status !== 'Prepared') return false;
    const diffTime = Math.abs(new Date() - new Date(order.orderDate));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 3;
  };

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            📦 Order Noting & Delivery Management
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>
            Replace manual notebooks with dedicated order workflow, billing, and packaging checks
          </p>
        </div>
      </div>

      {activeTab !== 'slip' && (
        <>
          {/* Dashboard Summary Cards */}
          <div className="stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="stat-card" style={{ padding: '1rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Today's Orders</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>{dashboardStats.todayOrders}</div>
            </div>
            <div className="stat-card" style={{ padding: '1rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: '4px solid #eab308' }}>
              <span style={{ fontSize: '0.75rem', color: '#854d0e', fontWeight: 700, textTransform: 'uppercase' }}>Prepared Orders</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#854d0e', marginTop: '0.25rem' }}>{dashboardStats.preparedOrders}</div>
            </div>
            <div className="stat-card" style={{ padding: '1rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: '4px solid #2563eb' }}>
              <span style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 700, textTransform: 'uppercase' }}>Packed Orders</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1d4ed8', marginTop: '0.25rem' }}>{dashboardStats.packedOrders}</div>
            </div>
            <div className="stat-card" style={{ padding: '1rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: '4px solid #f97316' }}>
              <span style={{ fontSize: '0.75rem', color: '#c2410c', fontWeight: 700, textTransform: 'uppercase' }}>Dispatched Orders</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c2410c', marginTop: '0.25rem' }}>{dashboardStats.dispatchedOrders}</div>
            </div>
            <div className="stat-card" style={{ padding: '1rem', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: '4px solid #10b981' }}>
              <span style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 700, textTransform: 'uppercase' }}>Delivered Orders</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#047857', marginTop: '0.25rem' }}>{dashboardStats.deliveredOrders}</div>
            </div>
            <div className="stat-card" style={{ padding: '1rem', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', borderLeft: '4px solid #ef4444' }}>
              <span style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 700, textTransform: 'uppercase' }}>Delayed Orders</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#991b1b', marginTop: '0.25rem' }}>{dashboardStats.delayedOrders}</div>
            </div>
          </div>

          {/* Sub Navigation Bar */}
          <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem', marginBottom: '1.5rem', paddingBottom: '2px' }}>
            <button
              type="button"
              className={`rm-tab-btn ${activeTab === 'ledger' ? 'active' : ''}`}
              onClick={() => setActiveTab('ledger')}
              style={{
                padding: '0.5rem 1rem',
                fontWeight: 600,
                fontSize: '0.9rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'ledger' ? '#ff9800' : 'transparent',
                color: activeTab === 'ledger' ? '#fff' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              📋 Noted Orders Ledger
            </button>
            <button
              type="button"
              className={`rm-tab-btn ${activeTab === 'new' ? 'active' : ''}`}
              onClick={() => setActiveTab('new')}
              style={{
                padding: '0.5rem 1rem',
                fontWeight: 600,
                fontSize: '0.9rem',
                borderRadius: '6px',
                border: 'none',
                backgroundColor: activeTab === 'new' ? '#ff9800' : 'transparent',
                color: activeTab === 'new' ? '#fff' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              ➕ Fast Order Entry Form
            </button>
          </div>
        </>
      )}

      {/* Tab content 1: Ledger */}
      {activeTab === 'ledger' && (
        <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
          
          {/* Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flex: 1, maxWidth: '400px' }}>
              <input
                type="text"
                className="form-control"
                placeholder="Search order number, customer, phone, area..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select className="form-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">All Statuses</option>
                <option value="Prepared">Prepared</option>
                <option value="Packed">Packed</option>
                <option value="Dispatched">Dispatched</option>
                <option value="Delivered">Delivered</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <LoadingSpinner />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Date</th>
                    <th>Customer Details</th>
                    <th>Items count</th>
                    <th>Grand Total</th>
                    <th>Status</th>
                    <th>Dispatch / Delivery Info</th>
                    <th style={{ width: '220px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const delayed = isOrderDelayed(order);
                    return (
                      <tr key={order.id || order._id}>
                        <td>
                          <strong>{order.orderNumber}</strong>
                          {delayed && (
                            <div style={{ display: 'inline-block', marginLeft: '0.5rem' }} title="Dispatch Pending More Than 3 Days">
                              <span style={{ backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', padding: '2px 6px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>
                                ⚠️ OVERDUE 3+ DAYS
                              </span>
                            </div>
                          )}
                        </td>
                        <td>{new Date(order.orderDate).toLocaleDateString('en-IN')}</td>
                        <td>
                          <div><strong>{order.customerName}</strong></div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {order.phoneNumber && <span>📞 {order.phoneNumber}</span>}
                            {order.area && <span style={{ marginLeft: '0.5rem' }}>📍 {order.area}</span>}
                          </div>
                        </td>
                        <td>{order.items?.length || 0} unique SKU(s)</td>
                        <td><strong>₹{Number(order.totalAmount).toFixed(2)}</strong></td>
                        <td>
                          <span className={getStatusBadgeClass(order.status)}>
                            {order.status}
                          </span>
                        </td>
                        <td>
                          {order.status === 'Prepared' && (
                            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Expected: {new Date(order.expectedDispatchDate).toLocaleDateString('en-IN')}</span>
                          )}
                          {order.status === 'Packed' && (
                            <div style={{ fontSize: '0.8rem', color: '#2563eb' }}>
                              <div>
                                Invoice:{' '}
                                <a
                                  href={`/sales/${order.invoiceId}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ fontWeight: 'bold', color: '#2563eb', textDecoration: 'underline' }}
                                >
                                  {order.invoice?.invoiceNumber}
                                </a>
                              </div>
                              <div>Awaiting Dispatch</div>
                            </div>
                          )}
                          {order.status === 'Dispatched' && (
                            <div style={{ fontSize: '0.8rem', color: '#ea580c' }}>
                              {order.invoice && (
                                <div style={{ marginBottom: '2px' }}>
                                  Invoice:{' '}
                                  <a
                                    href={`/sales/${order.invoiceId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontWeight: 'bold', color: '#ea580c', textDecoration: 'underline' }}
                                  >
                                    {order.invoice?.invoiceNumber}
                                  </a>
                                </div>
                              )}
                              <div>Courier: {order.courierPartner}</div>
                              <div>AWB: {order.trackingNumber}</div>
                            </div>
                          )}
                          {order.status === 'Delivered' && (
                            <div style={{ fontSize: '0.8rem', color: '#16a34a' }}>
                              {order.invoice && (
                                <div style={{ marginBottom: '2px' }}>
                                  Invoice:{' '}
                                  <a
                                    href={`/sales/${order.invoiceId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ fontWeight: 'bold', color: '#16a34a', textDecoration: 'underline' }}
                                  >
                                    {order.invoice?.invoiceNumber}
                                  </a>
                                </div>
                              )}
                              <div>Delivered: {new Date(order.deliveryDate).toLocaleDateString('en-IN')}</div>
                              <div>By: {order.deliveredBy}</div>
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => viewDeliverySlip(order)}
                            >
                              📄 Delivery Slip
                            </button>

                            {order.invoiceId && (
                              <a
                                href={`/sales/${order.invoiceId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', gap: '0.2rem' }}
                              >
                                🧾 Bill / Invoice
                              </a>
                            )}

                            {order.status === 'Prepared' && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ backgroundColor: '#2563eb', borderColor: '#2563eb' }}
                                onClick={() => handleMarkPacked(order.id)}
                              >
                                Mark Packed
                              </button>
                            )}

                            {order.status === 'Packed' && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ backgroundColor: '#f97316', borderColor: '#f97316' }}
                                onClick={() => openDispatch(order)}
                              >
                                Dispatch
                              </button>
                            )}

                            {order.status === 'Dispatched' && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ backgroundColor: '#10b981', borderColor: '#10b981' }}
                                onClick={() => openDeliver(order)}
                              >
                                Complete Delivery
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', color: '#64748b', padding: '3rem' }}>
                        No orders recorded. Select "Fast Order Entry Form" to add a customer order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
              <span style={{ alignSelf: 'center', fontSize: '0.85rem' }}>Page {page} of {pages}</span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page === pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </div>
      )}

      {/* Tab content 2: New Order Form */}
      {activeTab === 'new' && (
        <form onSubmit={handleCreateOrder} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          
          {/* Customer Details */}
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              👤 Customer Details
            </h3>

            <div className="form-group">
              <label>Select Existing Customer (Optional)</label>
              <select 
                className="form-control" 
                value={newOrderForm.customerId} 
                onChange={(e) => handleCustomerSelect(e.target.value)}
              >
                <option value="">-- Select Existing Customer (or enter new details below) --</option>
                {customers.map((c) => (
                  <option key={c.id || c._id} value={c.id || c._id}>
                    {c.name} ({c.customerType}) — Phone: {c.phone || 'N/A'}
                  </option>
                ))}
              </select>
              {selectedCustOutstanding.length > 0 && (() => {
                const totalOut = selectedCustOutstanding.reduce((sum, inv) => sum + Number(inv.balance || 0), 0);
                const maxDaysOverdue = Math.max(...selectedCustOutstanding.map(inv => inv.daysOverdue || 0));
                return (
                  <div style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '0.85rem' }}>
                    ⚠️ <strong>Outstanding: ₹{totalOut.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</strong>
                    {maxDaysOverdue > 0 && <span> | Last Invoice Pending: <strong>{maxDaysOverdue} Days</strong></span>}
                  </div>
                );
              })()}
            </div>

            <div className="form-group">
              <label>Customer Name *</label>
              <input
                type="text"
                className="form-control"
                placeholder="Enter customer name"
                required
                value={newOrderForm.customerName}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, customerName: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Phone Number</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. 9876543210"
                  value={newOrderForm.phoneNumber}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, phoneNumber: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Area / Location</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Tamil Nadu"
                  value={newOrderForm.area}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, area: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Shipping Address</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Detailed delivery address"
                value={newOrderForm.address}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, address: e.target.value })}
              ></textarea>
            </div>

            <div className="form-group">
              <label>Order / Packing Notes</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="Custom packing or route notes"
                value={newOrderForm.notes}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, notes: e.target.value })}
              ></textarea>
            </div>
          </div>

          {/* Product Selection & Logistics */}
          <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1.25rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
              🛍️ Product & Logistics Setup
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Choose Product</label>
                <select
                  className="form-control"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="">-- Choose Product --</option>
                  {products.filter(p => !p.productType || ['manufactured', 'repacking', 'trading'].includes(p.productType)).map(p => (
                    <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock} | Price: ₹{p.sellingPrice})</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Quantity</label>
                <input
                  type="number"
                  className="form-control"
                  min="1"
                  value={selectedQty}
                  onChange={(e) => setSelectedQty(Number(e.target.value))}
                />
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', padding: '0.5rem', fontWeight: 'bold', border: '1px dashed #cbd5e1' }}
              onClick={handleAddProduct}
            >
              ➕ Add Product to Order
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.25rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
              <div className="form-group">
                <label>Order Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={newOrderForm.orderDate}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, orderDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Expected Dispatch Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={newOrderForm.expectedDispatchDate}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, expectedDispatchDate: e.target.value })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Logistics Charge (₹) - Single Charge Mode</label>
              <input
                type="number"
                className="form-control"
                value={newOrderForm.logisticsCharge}
                onChange={(e) => setNewOrderForm({ ...newOrderForm, logisticsCharge: Number(e.target.value) })}
              />
            </div>

            {/* Cart list summary */}
            {newOrderForm.cart.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.85rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Added Items</h4>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table className="data-table" style={{ fontSize: '0.8rem', marginBottom: 0 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc' }}>
                        <th>Product</th>
                        <th style={{ width: '60px' }}>Qty</th>
                        <th>Price</th>
                        <th>Total</th>
                        <th style={{ width: '40px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {newOrderForm.cart.map(item => (
                        <tr key={item.productId}>
                          <td><strong>{item.name}</strong></td>
                          <td>{item.qty}</td>
                          <td>₹{Number(item.unitPrice).toFixed(2)}</td>
                          <td><strong>₹{item.lineTotal.toFixed(2)}</strong></td>
                          <td>
                            <button
                              type="button"
                              style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                              onClick={() => handleRemoveCartItem(item.productId)}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '1rem', borderTop: '2px solid #e2e8f0', paddingTop: '0.75rem', alignItems: 'flex-end', fontSize: '0.875rem' }}>
                  <div style={{ width: '220px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Items Subtotal:</span>
                    <span>₹{cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div style={{ width: '220px', display: 'flex', justifyContent: 'space-between', color: '#2563eb' }}>
                    <span>Logistics Charge:</span>
                    <span>+₹{Number(newOrderForm.logisticsCharge).toFixed(2)}</span>
                  </div>
                  <div style={{ width: '220px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '1px solid #cbd5e1', paddingTop: '0.25rem', fontSize: '1rem' }}>
                    <span>Grand Total:</span>
                    <span>₹{cartGrandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1.5rem', padding: '0.75rem', fontSize: '1rem', fontWeight: 700 }}
            >
              💾 Save Order (Prepared Stage)
            </button>
          </div>
        </form>
      )}

      {/* Tab content 3: Delivery Slip Print Page */}
      {activeTab === 'slip' && selectedOrder && (() => {
        const itemsCount = selectedOrder.items?.length || 0;
        const isCompact = itemsCount > 10;
        const fontSizeBase = isCompact ? '11px' : '13px';
        const marginSection = isCompact ? '10px' : '20px';

        return (
          <div>
            {/* Slip Actions */}
            <div className="btn-group" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setActiveTab('ledger')}
              >
                ← Back to Ledger
              </button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }}
                  onClick={handlePrint}
                >
                  🖨️ Print Packing Slip Copy
                </button>
                {selectedOrder.invoiceId && (
                  <a
                    href={`/sales/${selectedOrder.invoiceId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', gap: '0.25rem' }}
                  >
                    🧾 View Bill / Invoice
                  </a>
                )}
              </div>
            </div>

            {/* Style injection for A5 page print constraints */}
            <style>{`
              @media print {
                /* Hide all browser-level layout elements */
                .sidebar, 
                .app-header, 
                .sidebar-overlay, 
                .fab-container, 
                .btn-group, 
                .rm-tabs-bar, 
                .page-header, 
                .stat-grid,
                button,
                a {
                  display: none !important;
                }

                /* Reset root containers for zero margins and borderless layouts */
                html, body, #root, .app-shell, .main-area, .page {
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #fff !important;
                  width: 148mm !important;
                  height: 210mm !important;
                  overflow: hidden !important;
                }

                /* Configure true A5 Portrait printing with 8mm margins */
                @page {
                  size: A5 portrait;
                  margin: 8mm;
                }

                /* Zero margin/padding on print sheet */
                .delivery-slip-paper {
                  border: none !important;
                  box-shadow: none !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  width: 100% !important;
                  max-width: 100% !important;
                  height: 100% !important;
                  background: #fff !important;
                  box-sizing: border-box !important;
                }
              }

              /* Screen rendering style wrapper to mimic A5 sizing */
              .delivery-slip-paper {
                width: 148mm;
                height: 210mm;
                margin: 0 auto 2rem auto;
                padding: 8mm;
                background-color: #fff;
                border: 1px solid #cbd5e1;
                border-radius: 8px;
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
                box-sizing: border-box;
              }
            `}</style>

            {/* Delivery Slip Packing Copy Container */}
            <div className="delivery-slip-paper" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif' }}>
              <div>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'stretch', borderBottom: '3px solid #ff9800', paddingBottom: '10px', marginBottom: marginSection }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                    {settings?.logo && (
                      <img
                        src={resolveAssetUrl(settings.logo)}
                        alt="Logo"
                        style={{
                          height: isCompact ? '38px' : '52px',
                          maxHeight: isCompact ? '38px' : '52px',
                          width: 'auto',
                          objectFit: 'contain'
                        }}
                      />
                    )}
                    <div>
                      <span style={{ fontSize: isCompact ? '18px' : '22px', fontWeight: 800, color: '#0F172A', display: 'block', margin: 0, lineHeight: 1.1 }}>
                        {settings?.companyName || 'Amudhasurabiy Organics'}
                      </span>
                      <span style={{ fontSize: isCompact ? '9px' : '11px', color: '#4B5563', display: 'block', marginTop: '4px', lineHeight: 1.3 }}>
                        {settings?.address || '11C, Dr. Besent Road, Kumbakonam, Tamil Nadu - 612001'}<br />
                        <strong>GSTIN:</strong> {settings?.gstDetails || '29AAAAA1111A1Z1'} | <strong>Ph:</strong> {settings?.phone || '+91 98765 43210'}<br />
                        <strong>Email:</strong> info@amudhasurabiy.com | <strong>Web:</strong> www.amudhasurabiy.com
                      </span>
                    </div>
                  </div>
                  
                  {/* Vertical Divider */}
                  <div style={{ width: '1px', backgroundColor: '#E5E7EB', margin: '0 16px' }}></div>
                  
                  {/* Document metadata (Right) */}
                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', justifyContent: 'center', flexShrink: 0, minWidth: '160px' }}>
                    <span style={{ fontSize: isCompact ? '16px' : '20px', fontWeight: 900, color: '#0F172A', display: 'block', margin: 0, lineHeight: 1.1, letterSpacing: '0.5px' }}>DELIVERY SLIP</span>
                    <div style={{ fontSize: fontSizeBase, color: '#1F2937', marginTop: '6px', lineHeight: 1.4 }}>
                      <div>📄 <strong>Slip #:</strong> {selectedOrder.orderNumber}</div>
                      <div style={{ marginTop: '2px' }}>🧾 <strong>Invoice #:</strong> {selectedOrder.invoice?.invoiceNumber || 'Awaiting Packing'}</div>
                      <div style={{ marginTop: '2px' }}>📅 <strong>Date:</strong> {new Date(selectedOrder.orderDate).toLocaleDateString('en-IN')}</div>
                    </div>
                  </div>
                </div>

                {/* Customer & From Information Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: marginSection }}>
                  {/* From Card */}
                  <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ backgroundColor: '#0F172A', color: '#FFFFFF', padding: '6px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      📍 From
                    </div>
                    <div style={{ padding: '10px 12px', fontSize: isCompact ? '11px' : '13px', lineHeight: 1.4, color: '#1F2937', flex: 1 }}>
                      <strong style={{ fontSize: isCompact ? '12px' : '14px', color: '#0F172A', display: 'block', marginBottom: '4px' }}>
                        {settings?.companyName || 'Amudhasurabiy Organics'}
                      </strong>
                      <span style={{ display: 'block', whiteSpace: 'pre-line', marginBottom: '6px' }}>
                        {settings?.address || '11C, Dr. Besent Road\nKumbakonam\nTamil Nadu - 612001'}
                      </span>
                      <strong>GSTIN:</strong> {settings?.gstDetails || '29AAAAA1111A1Z1'}<br />
                      <strong>Phone:</strong> {settings?.phone || '+91 98765 43210'}
                    </div>
                  </div>

                  {/* Ship To Card */}
                  <div style={{ border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'hidden', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ backgroundColor: '#0F172A', color: '#FFFFFF', padding: '6px 12px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🚚 Ship To
                    </div>
                    <div style={{ padding: '10px 12px', fontSize: isCompact ? '12px' : '14px', lineHeight: 1.4, color: '#1F2937', flex: 1 }}>
                      <strong style={{ fontSize: isCompact ? '13px' : '16px', color: '#0F172A', display: 'block', marginBottom: '4px' }}>
                        {selectedOrder.customerName}
                      </strong>
                      <span style={{ display: 'block', whiteSpace: 'pre-line', marginBottom: '6px' }}>
                        {selectedOrder.address || 'Walk-in'}
                      </span>
                      {selectedOrder.phoneNumber && (
                        <div><strong>Phone:</strong> {selectedOrder.phoneNumber}</div>
                      )}
                      {selectedOrder.area && (
                        <div><strong>Area:</strong> {selectedOrder.area}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Product Table */}
                <table className="enterprise-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: marginSection, border: '1px solid #E5E7EB', borderRadius: '6px', overflow: 'hidden' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A', color: '#FFFFFF', borderBottom: '3px solid #ff9800', textAlign: 'left' }}>
                      <th style={{ padding: '10px 14px', fontSize: fontSizeBase, width: '60px', fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' }}>Item #</th>
                      <th style={{ padding: '10px 14px', fontSize: fontSizeBase, fontWeight: 'bold', color: '#FFFFFF' }}>Product Name / Description</th>
                      <th style={{ padding: '10px 14px', fontSize: fontSizeBase, textAlign: 'right', width: '100px', fontWeight: 'bold', color: '#FFFFFF' }}>Quantity</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((item, idx) => (
                      <tr key={item.productId} style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                        <td style={{ padding: '14px 14px', fontSize: fontSizeBase, color: '#4B5563', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                        <td style={{ padding: '14px 14px', fontSize: fontSizeBase, color: '#1F2937', fontWeight: 600, wordBreak: 'break-word' }}>
                          {item.name}
                        </td>
                        <td style={{ padding: '14px 14px', fontSize: '14px', textAlign: 'right', fontWeight: 800, color: '#0F172A' }}>{item.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Premium Summary Card at the Bottom */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr', 
                backgroundColor: '#FFF7ED', 
                border: '2px solid #ff9800', 
                borderRadius: '8px', 
                padding: '12px 16px', 
                marginTop: 'auto'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '20px' }}>📦</span>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Total Unique Items
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 800, color: '#0F172A' }}>
                      {selectedOrder.items?.length || 0} <span style={{ color: '#ff9800' }}>SKU(s)</span>
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderLeft: '1px solid #E5E7EB', paddingLeft: '16px' }}>
                  <span style={{ fontSize: '20px' }}>🔢</span>
                  <div>
                    <span style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Total Quantity
                    </span>
                    <span style={{ fontSize: '18px', fontWeight: 900, color: '#0F172A' }}>
                      {selectedOrder.items?.reduce((sum, item) => sum + item.qty, 0) || 0} <span style={{ color: '#ff9800' }}>Units</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal - Dispatch Order */}
      {showDispatchModal && selectedOrder && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>🚚 Dispatch Parcel - {selectedOrder.orderNumber}</h3>
            
            <div className="form-group">
              <label>Courier Partner *</label>
              <select
                className="form-control"
                value={dispatchForm.courierPartner}
                onChange={(e) => setDispatchForm({ ...dispatchForm, courierPartner: e.target.value })}
              >
                <option value="Professional Couriers">Professional Couriers</option>
                <option value="DTDC Courier">DTDC Courier</option>
                <option value="Delhivery Logistics">Delhivery Logistics</option>
                <option value="Blue Dart">Blue Dart</option>
                <option value="Speed Post">Speed Post</option>
              </select>
            </div>

            <div className="form-group">
              <label>Tracking Number (AWB Code) *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. KMU3903521"
                value={dispatchForm.trackingNumber}
                onChange={(e) => setDispatchForm({ ...dispatchForm, trackingNumber: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Dispatch Date</label>
              <input
                type="date"
                className="form-control"
                value={dispatchForm.dispatchDate}
                onChange={(e) => setDispatchForm({ ...dispatchForm, dispatchDate: e.target.value })}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDispatchModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" style={{ backgroundColor: '#f97316', borderColor: '#f97316' }} onClick={handleMarkDispatched}>Dispatch Package</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Complete Delivery */}
      {showDeliverModal && selectedOrder && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '400px', padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>✅ Complete Order Delivery</h3>
            
            <div className="form-group">
              <label>Delivery Date</label>
              <input
                type="date"
                className="form-control"
                value={deliverForm.deliveryDate}
                onChange={(e) => setDeliverForm({ ...deliverForm, deliveryDate: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Delivered By (Courier Agent name)</label>
              <input
                type="text"
                className="form-control"
                value={deliverForm.deliveredBy}
                onChange={(e) => setDeliverForm({ ...deliverForm, deliveredBy: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Remarks / Notes</label>
              <textarea
                className="form-control"
                rows="2"
                placeholder="e.g. Delivered to reception / signed"
                value={deliverForm.remarks}
                onChange={(e) => setDeliverForm({ ...deliverForm, remarks: e.target.value })}
              ></textarea>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeliverModal(false)}>Cancel</button>
              <button type="button" className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }} onClick={handleMarkDelivered}>Mark Delivered</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
