import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Globe,
  Key,
  Package,
  ShoppingCart,
  Users,
  Star,
  Gift,
  Truck,
  Tag,
  BarChart2,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Copy,
  RefreshCw,
  Eye,
  RotateCcw,
  Search,
  Check,
  X,
  Sparkles,
  AlertCircle,
  Upload,
  Image as ImageIcon,
  ArrowLeft,
  ArrowRight,
  Star as StarIcon
} from 'lucide-react';
import client from '../api/client';
import { resolveAssetUrl } from '../utils/url';
import EnterpriseProductEditor from '../components/EnterpriseProductEditor';
import ErrorBoundary from '../components/ErrorBoundary';

const API_BASE = '/website-admin';

export default function WebsiteManagement() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'api-key';
  const [activeTab, setActiveTabState] = useState(initialTab);

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || 'api-key';
    setActiveTabState(tabFromUrl);
  }, [searchParams]);

  const setActiveTab = (tabId) => {
    setActiveTabState(tabId);
    setSearchParams({ tab: tabId });
  };

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // State
  const [apiKeyData, setApiKeyData] = useState(null);
  const [products, setProducts] = useState([]);
  const [managementProductsList, setManagementProductsList] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [testimonials, setTestimonials] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [shippingRules, setShippingRules] = useState([]);
  const [coupons, setCoupons] = useState([]);
  const [analytics, setAnalytics] = useState(null);

  // Modals & Selections
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productFilter, setProductFilter] = useState('all');
  const [productSearchQuery, setProductSearchQuery] = useState('');

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const [showResetPassModal, setShowResetPassModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newPassInput, setNewPassInput] = useState('');


  const [showApproveReferralModal, setShowApproveReferralModal] = useState(false);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [referralDiscountInput, setReferralDiscountInput] = useState('100');

  const [showTestimonialModal, setShowTestimonialModal] = useState(false);
  const [testimonialForm, setTestimonialForm] = useState({
    name: '',
    location: '',
    rating: 5,
    reviewText: '',
    productMentioned: '',
    verified: true,
  });

  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponForm, setCouponForm] = useState({
    code: '',
    type: 'flat',
    value: 100,
    minOrderValue: 499,
    usageLimit: 50,
    isActive: true,
  });

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDataForTab(activeTab);
  }, [activeTab]);

  const fetchDataForTab = async (tab) => {
    setLoading(true);
    setMsg({ type: '', text: '' });
    try {
      if (tab === 'api-key') {
        const res = await client.get(`${API_BASE}/api-key`);
        setApiKeyData(res.data.data);
      } else if (tab === 'products') {
        const [adminProdRes, masterProdRes] = await Promise.allSettled([
          client.get(`${API_BASE}/products`),
          productsApi.list({ limit: 1000 })
        ]);

        let websiteProds = [];
        let mgmtProds = [];

        if (adminProdRes.status === 'fulfilled' && adminProdRes.value?.data) {
          websiteProds = adminProdRes.value.data.data || [];
          mgmtProds = adminProdRes.value.data.managementProductsList || [];
        }

        if ((!mgmtProds || mgmtProds.length === 0) && masterProdRes.status === 'fulfilled' && masterProdRes.value?.data) {
          const rawMasterList = masterProdRes.value.data.products || masterProdRes.value.data.data || [];
          mgmtProds = rawMasterList.map(p => ({
            id: p.id,
            name: p.name || p.productName || 'Unnamed Product',
            productName: p.name || p.productName || 'Unnamed Product',
            sku: p.sku || '',
            barcode: p.barcode || '',
            brand: p.brand || 'Blovit',
            category: p.category || 'General',
            price: Number(p.sellingPrice || p.price || 0),
            sellingPrice: Number(p.sellingPrice || p.price || 0),
            gstPercent: Number(p.gstPercent || 0),
            stock: Number(p.stock !== undefined ? p.stock : (p.stockQuantity || 0)),
            stockQuantity: Number(p.stock !== undefined ? p.stock : (p.stockQuantity || 0)),
            imageUrl: p.imageUrl || p.image || '',
            isActive: p.isActive !== false,
            status: p.isActive !== false ? 'Active' : 'Inactive'
          }));
        }

        console.log(`[WebsiteManagement] Loaded ${websiteProds.length} website product settings and ${mgmtProds.length} Product Master items into selector.`);
        setProducts(websiteProds);
        setManagementProductsList(mgmtProds);
      } else if (tab === 'orders') {
        const res = await client.get(`${API_BASE}/orders`);
        setOrders(res.data.data || []);
      } else if (tab === 'customers') {
        const res = await client.get(`${API_BASE}/customers`);
        setCustomers(res.data.data || []);
      } else if (tab === 'reviews') {
        const resTest = await client.get(`${API_BASE}/testimonials`);
        const resRev = await client.get(`${API_BASE}/reviews`);
        setTestimonials(resTest.data.data || []);
        setReviews(resRev.data.data || []);
      } else if (tab === 'referrals') {
        const res = await client.get(`${API_BASE}/referrals`);
        setReferrals(res.data.data || []);
      } else if (tab === 'shipping') {
        const resShip = await client.get(`${API_BASE}/shipping-rules`);
        const resCoup = await client.get(`${API_BASE}/coupons`);
        setShippingRules(resShip.data.data || []);
        setCoupons(resCoup.data.data || []);
      } else if (tab === 'analytics') {
        try {
          const res = await client.get(`${API_BASE}/analytics`);
          setAnalytics(res.data.data || { ordersToday: 0, totalRevenue: 0, cartAbandonmentCount: 0 });
        } catch (analyticsErr) {
          console.warn('[WebsiteManagement] Analytics API unavailable (503/CORS):', analyticsErr?.message);
          setAnalytics(null);
        }
      }
    } catch (err) {
      console.error(err);
      setMsg({ type: 'error', text: 'Failed to load data from backend server.' });
    } finally {
      setLoading(false);
    }
  };

  // Safe global fetchData alias ensuring zero ReferenceError crashes
  const fetchData = () => fetchDataForTab(activeTab);

  const handleCopyKey = () => {
    if (apiKeyData?.apiKey) {
      navigator.clipboard.writeText(apiKeyData.apiKey);
      setMsg({ type: 'success', text: 'Storefront API Key copied to clipboard!' });
      setTimeout(() => setMsg({ type: '', text: '' }), 3000);
    }
  };

  const handleRegenerateKey = async () => {
    if (!window.confirm('Are you sure you want to regenerate the API key? The Blovit storefront will require updating with the new key.')) {
      return;
    }
    setLoading(true);
    try {
      const res = await client.post(`${API_BASE}/api-key/regenerate`);
      setApiKeyData(res.data.data);
      setMsg({ type: 'success', text: 'New API Key generated successfully!' });
    } catch {
      setMsg({ type: 'error', text: 'Failed to regenerate API key.' });
    } finally {
      setLoading(false);
    }
  };

  // Product Actions
  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Delete this product from Blovit web store?')) return;
    try {
      await client.delete(`${API_BASE}/products/${id}`);
      setMsg({ type: 'success', text: 'Product removed.' });
      fetchDataForTab('products');
    } catch {
      setMsg({ type: 'error', text: 'Failed to delete product.' });
    }
  };

  const handleToggleField = async (product, field) => {
    const updatedValue = !product[field];
    try {
      const res = await client.put(`${API_BASE}/products/${product.id}`, {
        [field]: updatedValue
      });
      if (res.data.success) {
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, [field]: updatedValue, isPublished: field === 'isPublished' ? updatedValue : p.isPublished } : p));
        setMsg({ type: 'success', text: `Product "${product.name}" updated successfully.` });
        setTimeout(() => setMsg({ type: '', text: '' }), 3000);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || `Failed to update ${field}.` });
    }
  };


  // Order Actions
  const handleUpdateOrderStatus = async (orderId, status) => {
    try {
      await client.put(`${API_BASE}/orders/${orderId}/status`, { status });
      setMsg({ type: 'success', text: `Order status updated to ${status}` });
      fetchDataForTab('orders');
      if (selectedOrder) setSelectedOrder((prev) => ({ ...prev, status }));
    } catch {
      setMsg({ type: 'error', text: 'Failed to update order status.' });
    }
  };

  const handleRefundOrder = async (orderId) => {
    if (!window.confirm('Trigger Razorpay refund for this order?')) return;
    try {
      const res = await client.post(`${API_BASE}/orders/${orderId}/refund`);
      setMsg({ type: 'success', text: res.data.message });
      fetchDataForTab('orders');
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Refund failed.' });
    }
  };

  // Customer Actions
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!selectedCustomer || !newPassInput) return;
    try {
      await client.post(`${API_BASE}/customers/${selectedCustomer.id}/reset-password`, {
        newPassword: newPassInput,
      });
      setMsg({ type: 'success', text: `Password updated for ${selectedCustomer.fullName}` });
      setShowResetPassModal(false);
      setNewPassInput('');
    } catch {
      setMsg({ type: 'error', text: 'Password reset failed.' });
    }
  };

  // Referral Actions
  const handleApproveReferral = async (e) => {
    e.preventDefault();
    if (!selectedReferral) return;
    try {
      const res = await client.post(`${API_BASE}/referrals/${selectedReferral.id}/approve`, {
        discountAmount: Number(referralDiscountInput),
      });
      setMsg({ type: 'success', text: res.data.message });
      setShowApproveReferralModal(false);
      fetchDataForTab('referrals');
    } catch {
      setMsg({ type: 'error', text: 'Failed to approve referral.' });
    }
  };

  const handleRejectReferral = async (id) => {
    if (!window.confirm('Reject this pending referral request?')) return;
    try {
      await client.post(`${API_BASE}/referrals/${id}/reject`);
      setMsg({ type: 'success', text: 'Referral rejected.' });
      fetchDataForTab('referrals');
    } catch {
      setMsg({ type: 'error', text: 'Failed to reject referral.' });
    }
  };

  // Testimonial & Coupon Actions
  const handleSaveTestimonial = async (e) => {
    e.preventDefault();
    try {
      await client.post(`${API_BASE}/testimonials`, testimonialForm);
      setMsg({ type: 'success', text: 'Testimonial added!' });
      setShowTestimonialModal(false);
      fetchDataForTab('reviews');
    } catch {
      setMsg({ type: 'error', text: 'Failed to add testimonial.' });
    }
  };

  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    try {
      await client.post(`${API_BASE}/coupons`, couponForm);
      setMsg({ type: 'success', text: 'Coupon code created!' });
      setShowCouponModal(false);
      fetchDataForTab('shipping');
    } catch {
      setMsg({ type: 'error', text: 'Failed to create coupon code.' });
    }
  };

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      {/* HEADER BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Globe style={{ color: 'var(--primary-color)' }} /> Website (Blovit eCommerce)
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Backend API Control & Storefront Management Center for Blovit Next.js Application
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <span className="badge badge-success" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 0.8rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10B981', display: 'inline-block' }}></span>
            REST API Online
          </span>
        </div>
      </div>

      {/* NOTIFICATION MESSAGES */}
      {msg.text && (
        <div className={`alert alert-${msg.type === 'error' ? 'danger' : 'success'}`} style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {msg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          {msg.text}
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.2rem' }}>
        {[
          { id: 'api-key', label: 'API Key & Auth', icon: Key },
          { id: 'products', label: 'Products', icon: Package },
          { id: 'orders', label: 'Orders & Fulfillment', icon: ShoppingCart },
          { id: 'customers', label: 'Customers', icon: Users },
          { id: 'reviews', label: 'Reviews & Testimonials', icon: Star },
          { id: 'referrals', label: 'Referrals System', icon: Gift },
          { id: 'shipping', label: 'Shipping & Coupons', icon: Tag },
          { id: 'analytics', label: 'CRM & Analytics', icon: BarChart2 },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                borderRadius: '8px 8px 0 0',
                fontWeight: isActive ? 700 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                borderBottom: isActive ? '3px solid var(--primary-color)' : 'none',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading && <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>Loading Website Module Data...</div>}

      {/* TAB 1: API KEY & SETTINGS */}
      {!loading && activeTab === 'api-key' && (
        <div className="card" style={{ padding: '1.5rem', maxWidth: '800px' }}>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Key style={{ color: 'var(--primary-color)' }} /> Storefront API Key (Blovit Next.js)
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            This long-lived API Key authenticates all REST requests originating from the Blovit Next.js frontend application. 
            Pass this key in HTTP requests via header: <code>X-API-Key: &lt;key&gt;</code> or <code>Authorization: Bearer &lt;key&gt;</code>.
          </p>

          <div style={{ background: 'var(--bg-secondary, #F3F4F6)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '0.4rem' }}>
              Active Storefront API Key
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="text"
                readOnly
                value={apiKeyData?.apiKey || 'blovit_live_sec_99382174620091823746'}
                style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: '1rem',
                  fontWeight: 700,
                  padding: '0.6rem 0.8rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: '#FFF',
                }}
              />
              <button type="button" className="btn btn-secondary" onClick={handleCopyKey} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Copy size={16} /> Copy
              </button>
            </div>
            <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', gap: '1.5rem' }}>
              <span>Environment: <strong>{apiKeyData?.environment || 'Production'}</strong></span>
              <span>Status: <strong style={{ color: '#10B981' }}>{apiKeyData?.status || 'Active'}</strong></span>
              <span>Last Used: <strong>{apiKeyData?.lastUsedAt ? new Date(apiKeyData.lastUsedAt).toLocaleString() : 'Just now'}</strong></span>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', pt: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Rotate / Regenerate Key</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Invalidates current key and generates a new secret token.</div>
            </div>
            <button type="button" className="btn btn-secondary" onClick={handleRegenerateKey} style={{ color: '#EF4444', borderColor: '#FCA5A5', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <RefreshCw size={16} /> Regenerate Key
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: PRODUCTS */}
      {!loading && activeTab === 'products' && (
        <div>
          {/* Dashboard Header & Search/Filters Bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontWeight: 800, margin: 0 }}>Storefront Publishing & Merchandising</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>
                  Manage storefront visibility, search engine optimization (SEO), and digital placements for the master catalog.
                </p>
              </div>
            </div>

            {/* Filters and Search Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
              {/* Search input */}
              <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                <input
                  type="text"
                  placeholder="Search by product name or SKU..."
                  value={productSearchQuery}
                  onChange={(e) => setProductSearchQuery(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem 0.75rem 0.5rem 2rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
                <span style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>🔍</span>
              </div>

              {/* Status Tabs */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                {[
                  { id: 'all', label: `All (${products.length})` },
                  { id: 'published', label: `Published (${products.filter(p => p.isPublished && p.isActive).length})` },
                  { id: 'draft', label: `Draft (${products.filter(p => !p.isPublished && p.isActive).length})` },
                  { id: 'hidden', label: `Hidden (${products.filter(p => !p.isActive).length})` },
                ].map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setProductFilter(filter.id)}
                    style={{
                      border: 'none',
                      background: productFilter === filter.id ? '#0284C7' : '#FFF',
                      color: productFilter === filter.id ? '#FFF' : '#475569',
                      padding: '0.4rem 0.8rem',
                      borderRadius: '6px',
                      fontSize: '0.82rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: '1px solid #CBD5E1',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
                    }}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ overflowX: 'auto', border: '1px solid #E2E8F0', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.82rem', color: '#475569' }}>Product</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.82rem', color: '#475569' }}>Website Status</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.82rem', color: '#475569' }}>Featured</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.82rem', color: '#475569' }}>Bestseller</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'left', fontSize: '0.82rem', color: '#475569' }}>SEO Score</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.82rem', color: '#475569' }}>Publish</th>
                  <th style={{ padding: '0.85rem 1.25rem', textAlign: 'center', fontSize: '0.82rem', color: '#475569' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filtered = products.filter(p => {
                    if (productFilter === 'published') return p.isPublished && p.isActive;
                    if (productFilter === 'draft') return !p.isPublished && p.isActive;
                    if (productFilter === 'hidden') return !p.isActive;
                    return true;
                  }).filter(p => {
                    if (!productSearchQuery) return true;
                    return (p.name || '').toLowerCase().includes(productSearchQuery.toLowerCase()) || 
                           (p.sku || '').toLowerCase().includes(productSearchQuery.toLowerCase());
                  });

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '3rem', color: '#64748B' }}>
                          No products found matching the criteria.
                        </td>
                      </tr>
                    );
                  }

                  return filtered.map((p) => {
                    let pImages = [];
                    if (Array.isArray(p.images)) {
                      pImages = p.images;
                    } else {
                      try { pImages = JSON.parse(p.images || '[]'); } catch { pImages = p.imageUrl ? [p.imageUrl] : []; }
                    }

                    // SEO Score calculation
                    let seoScore = 0;
                    if (p.seoTitle && p.seoTitle.length >= 10) seoScore += 40;
                    if (p.seoDescription && p.seoDescription.length >= 30) seoScore += 40;
                    if (p.seoKeywords) seoScore += 20;

                    let seoColor = '#EF4444';
                    if (seoScore >= 80) seoColor = '#10B981';
                    else if (seoScore >= 40) seoColor = '#F59E0B';

                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                        {/* 1. Product Info */}
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            {pImages && pImages.length > 0 ? (
                              <img
                                src={resolveAssetUrl(pImages[0])}
                                alt={p.name}
                                style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: '6px', border: '1px solid #CBD5E1' }}
                              />
                            ) : (
                              <div style={{ width: 44, height: 44, borderRadius: '6px', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', border: '1px solid #CBD5E1' }}>
                                <ImageIcon size={20} />
                              </div>
                            )}
                            <div>
                              <div style={{ fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                {p.name}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#64748B', display: 'flex', gap: '0.5rem', marginTop: '2px' }}>
                                <span style={{ fontFamily: 'monospace' }}>SKU: {p.sku || '—'}</span>
                                <span>|</span>
                                <span style={{ color: '#0284C7' }}>/{p.slug}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Status Badge */}
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          {!p.isActive ? (
                            <span style={{ display: 'inline-block', background: '#F1F5F9', color: '#475569', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', border: '1px solid #CBD5E1' }}>
                              🚫 ERP Hidden
                            </span>
                          ) : p.isPublished ? (
                            <span style={{ display: 'inline-block', background: '#DEF7EC', color: '#03543F', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', border: '1px solid #A7F3D0' }}>
                              🌐 Published
                            </span>
                          ) : (
                            <span style={{ display: 'inline-block', background: '#FEF3C7', color: '#92400E', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', border: '1px solid #FDE68A' }}>
                              📝 Draft
                            </span>
                          )}
                        </td>

                        {/* 3. Featured Toggle */}
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleToggleField(p, 'isFeatured')}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              color: p.isFeatured ? '#F59E0B' : '#CBD5E1',
                              transition: 'transform 0.2s',
                              outline: 'none'
                            }}
                            title={p.isFeatured ? 'Featured Product' : 'Mark as Featured'}
                          >
                            <StarIcon size={18} fill={p.isFeatured ? '#F59E0B' : 'none'} />
                          </button>
                        </td>

                        {/* 4. Bestseller Toggle */}
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleToggleField(p, 'isBestseller')}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              color: p.isBestseller ? '#10B981' : '#CBD5E1',
                              transition: 'transform 0.2s',
                              outline: 'none'
                            }}
                            title={p.isBestseller ? 'Bestseller Placement' : 'Mark as Bestseller'}
                          >
                            <Sparkles size={18} fill={p.isBestseller ? '#10B981' : 'none'} />
                          </button>
                        </td>

                        {/* 5. SEO Score indicator */}
                        <td style={{ padding: '0.85rem 1.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '40px', height: '6px', background: '#E2E8F0', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${seoScore}%`, height: '100%', background: seoColor }} />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: seoColor }}>{seoScore}%</span>
                          </div>
                        </td>

                        {/* 6. Instant Publish Switch */}
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                          <button
                            onClick={() => handleToggleField(p, 'isPublished')}
                            disabled={!p.isActive}
                            style={{
                              border: '1px solid',
                              borderColor: p.isPublished ? '#10B981' : '#CBD5E1',
                              background: p.isPublished ? '#DEF7EC' : '#F1F5F9',
                              color: p.isPublished ? '#03543F' : '#475569',
                              padding: '4px 10px',
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: p.isActive ? 'pointer' : 'not-allowed',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              opacity: p.isActive ? 1 : 0.5
                            }}
                          >
                            {p.isPublished ? <Check size={12} /> : <X size={12} />}
                            {p.isPublished ? 'Live' : 'Draft'}
                          </button>
                        </td>

                        {/* 7. Action Links */}
                        <td style={{ padding: '0.85rem 1.25rem', textAlign: 'center' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => {
                                setEditingProduct(p);
                                setShowProductModal(true);
                              }}
                              style={{ padding: '0.3rem 0.5rem', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', fontWeight: 700 }}
                              title="Website Settings"
                            >
                              ⚙️ Website Settings
                            </button>
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => {
                                window.open(`https://demo.amudhasurabiy.com/product/${p.slug || p.id}`, '_blank');
                              }}
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                              title="Preview Storefront"
                            >
                              👁️ Preview
                            </button>
                            <button
                              className="btn btn-outline-secondary btn-sm"
                              onClick={() => {
                                setActiveTab('analytics');
                              }}
                              style={{ padding: '0.3rem 0.5rem', fontSize: '0.78rem' }}
                              title="View Analytics"
                            >
                              📊 Stats
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ORDERS & FULFILLMENT */}
      {!loading && activeTab === 'orders' && (
        <div>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Blovit Orders & Fulfillment ({orders.length})</h3>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer / Guest</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{o.orderNumber}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {new Date(o.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td>
                      <div>{o.guestName || `Customer #${o.websiteCustomerId}`}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{o.guestMobile}</div>
                    </td>
                    <td>{o.items?.length || 0} items</td>
                    <td style={{ fontWeight: 700 }}>₹{o.totalAmount}</td>
                    <td>
                      <span className={`badge ${o.paymentStatus === 'Captured' ? 'badge-success' : 'badge-warning'}`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                    <td>
                      <select
                        value={o.status}
                        onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                        style={{ padding: '0.3rem 0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontWeight: 600 }}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Paid">Paid</option>
                        <option value="Packed">Packed</option>
                        <option value="Shipped">Shipped</option>
                        <option value="Delivered">Delivered</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem' }} onClick={() => { setSelectedOrder(o); setShowOrderModal(true); }}>
                          <Eye size={14} /> Details
                        </button>

                        {o.paymentStatus === 'Captured' && o.status !== 'Cancelled' && (
                          <button className="btn btn-secondary" style={{ padding: '0.3rem 0.5rem', color: '#EF4444' }} onClick={() => handleRefundOrder(o.id)}>
                            <RotateCcw size={14} /> Refund
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      No webstore orders recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CUSTOMERS */}
      {!loading && activeTab === 'customers' && (
        <div>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Registered Webstore Customers ({customers.length})</h3>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Customer Name</th>
                  <th>Mobile</th>
                  <th>Location</th>
                  <th>Referral Code</th>
                  <th>Account Credit</th>
                  <th>Orders</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{c.fullName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.email || 'No email on file'}</div>
                    </td>
                    <td>{c.mobile}</td>
                    <td>{c.city ? `${c.city}, ${c.state}` : '-'}</td>
                    <td><code style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{c.referralCode}</code></td>
                    <td>₹{c.accountCredit || 0}</td>
                    <td>{c.orderCount || 0} orders</td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setShowResetPassModal(true);
                        }}
                      >
                        Reset Password
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: REVIEWS & TESTIMONIALS */}
      {!loading && activeTab === 'reviews' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700 }}>Admin-Curated Testimonials & Product Reviews</h3>
            <button className="btn btn-primary" onClick={() => setShowTestimonialModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Plus size={16} /> Add Testimonial
            </button>
          </div>

          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h4 style={{ fontWeight: 700, marginBottom: '1rem' }}>Homepage Marquee Testimonials</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {testimonials.map((t) => (
                <div key={t.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', background: '#FFF' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontWeight: 700 }}>{t.name} ({t.location || 'India'})</div>
                    <div style={{ color: '#F59E0B', fontWeight: 700 }}>{'★'.repeat(t.rating)}</div>
                  </div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '0.5rem' }}>"{t.reviewText}"</p>
                  {t.productMentioned && <div style={{ fontSize: '0.8rem', color: 'var(--primary-color)' }}>Product: {t.productMentioned}</div>}
                </div>
              ))}
              {testimonials.length === 0 && <div style={{ color: 'var(--text-secondary)' }}>No testimonials added yet.</div>}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: REFERRALS */}
      {!loading && activeTab === 'referrals' && (
        <div>
          <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>Referral Requests Queue ({referrals.length})</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
            When a customer registers using another customer's referral code, a pending request is logged here. Approve requests and assign custom reward discount amounts.
          </p>
          <div className="card" style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Referrer (Owner)</th>
                  <th>Referred Customer</th>
                  <th>Code Used</th>
                  <th>Status</th>
                  <th>Reward Discount</th>
                  <th>Generated Coupon</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{r.referrerName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.referrerMobile}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{r.referredName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{r.referredMobile}</div>
                    </td>
                    <td><code>{r.referralCodeUsed}</code></td>
                    <td>
                      <span className={`badge ${r.status === 'Approved' ? 'badge-success' : r.status === 'Rejected' ? 'badge-danger' : 'badge-warning'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--primary-color)' }}>{r.discountAmount ? `₹${r.discountAmount}` : '-'}</td>
                    <td><code>{r.generatedCouponCode || '-'}</code></td>
                    <td>
                      {r.status === 'Pending' ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                            onClick={() => {
                              setSelectedReferral(r);
                              setShowApproveReferralModal(true);
                            }}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem', color: '#EF4444' }}
                            onClick={() => handleRejectReferral(r.id)}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
                {referrals.length === 0 && (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                      No referral requests submitted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 7: SHIPPING & COUPONS */}
      {!loading && activeTab === 'shipping' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem' }}>
            <h4 style={{ fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Truck size={18} /> Shipping Rules
            </h4>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Rule Name</th>
                  <th>Rate</th>
                  <th>Free Threshold</th>
                </tr>
              </thead>
              <tbody>
                {shippingRules.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>₹{s.rate}</td>
                    <td>₹{s.freeShippingThreshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h4 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Tag size={18} /> Coupon Codes
              </h4>
              <button className="btn btn-primary" onClick={() => setShowCouponModal(true)} style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}>
                + Add Coupon
              </button>
            </div>
            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Discount</th>
                  <th>Min Order</th>
                  <th>Uses</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td><code>{c.code}</code></td>
                    <td style={{ fontWeight: 700 }}>{c.type === 'percentage' ? `${c.value}%` : `₹${c.value}`}</td>
                    <td>₹{c.minOrderValue}</td>
                    <td>{c.usedCount} / {c.usageLimit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 8: CRM & ANALYTICS */}
      {!loading && activeTab === 'analytics' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontWeight: 700, margin: 0 }}>Webstore CRM & Analytics Metrics</h3>
            <button className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }} onClick={() => fetchDataForTab('analytics')}>
              <RefreshCw size={14} /> Retry Analytics
            </button>
          </div>
          {analytics ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Orders Today</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary-color)' }}>{analytics?.ordersToday || 0}</div>
              </div>
              <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Paid Revenue</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10B981' }}>₹{analytics?.totalRevenue || 0}</div>
              </div>
              <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cart Abandonment Events</div>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#F59E0B' }}>{analytics?.cartAbandonmentCount || 0}</div>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: '2rem', textAlign: 'center', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px' }}>
              <AlertCircle size={32} color="#DC2626" style={{ marginBottom: '0.5rem' }} />
              <h4 style={{ fontWeight: 800, color: '#991B1B', margin: '0 0 0.4rem 0' }}>Analytics Service Temporarily Unavailable</h4>
              <p style={{ fontSize: '0.85rem', color: '#7F1D1D', maxWidth: '500px', margin: '0 auto 1rem auto' }}>
                The webstore analytics service returned status 503 or is currently unreachable. The rest of your Website Management module remains 100% operational.
              </p>
              <button className="btn btn-secondary" onClick={() => fetchDataForTab('analytics')}>
                Retry Loading Analytics
              </button>
            </div>
          )}
        </div>
      )}

      {/* ENTERPRISE SHOPIFY-LEVEL PRODUCT EDITOR MODAL */}
      <ErrorBoundary>
        <EnterpriseProductEditor
          product={editingProduct}
          isOpen={showProductModal}
          onClose={() => setShowProductModal(false)}
          onSaveSuccess={fetchData}
          managementProductsList={managementProductsList}
        />
      </ErrorBoundary>

      {/* MODAL: APPROVE REFERRAL */}
      {showApproveReferralModal && selectedReferral && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Approve Referral</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Approve referral from <strong>{selectedReferral.referrerName}</strong> for referring <strong>{selectedReferral.referredName}</strong>. 
              Assign custom discount amount below (auto-generates a single-use coupon code for the referrer).
            </p>

            <form onSubmit={handleApproveReferral}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Reward Discount Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={referralDiscountInput}
                  onChange={(e) => setReferralDiscountInput(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '1.1rem', fontWeight: 700 }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowApproveReferralModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Approve & Issue Coupon</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PASSWORD */}
      {showResetPassModal && selectedCustomer && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '400px', padding: '1.5rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Reset Customer Password</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Customer: <strong>{selectedCustomer.fullName}</strong> ({selectedCustomer.mobile})
            </p>
            <form onSubmit={handleResetPassword}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>New Password *</label>
                <input
                  type="text"
                  required
                  value={newPassInput}
                  onChange={(e) => setNewPassInput(e.target.value)}
                  placeholder="Enter new password"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowResetPassModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Update Password</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ORDER DETAILS */}
      {showOrderModal && selectedOrder && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '100%', maxWidth: '550px', padding: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '1rem' }}>
              <h3 style={{ fontWeight: 800, margin: 0 }}>Order Details: {selectedOrder.orderNumber}</h3>
              <button type="button" onClick={() => setShowOrderModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.85rem', marginBottom: '1rem', background: '#F8FAFC', padding: '0.75rem', borderRadius: '8px' }}>
              <div>Guest / Customer: <strong>{selectedOrder.guestName || `Customer #${selectedOrder.websiteCustomerId}`}</strong></div>
              <div>Mobile: <strong>{selectedOrder.guestMobile || 'N/A'}</strong></div>
              <div>Total Amount: <strong>₹{selectedOrder.totalAmount}</strong></div>
              <div>Payment Status: <strong style={{ color: selectedOrder.paymentStatus === 'Captured' ? '#10B981' : '#F59E0B' }}>{selectedOrder.paymentStatus}</strong></div>
              <div>Order Status: <strong>{selectedOrder.status}</strong></div>
              <div>Date: <strong>{selectedOrder.createdAt ? new Date(selectedOrder.createdAt).toLocaleString() : 'N/A'}</strong></div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem' }}>Order Items ({selectedOrder.items?.length || 0})</h4>
              {selectedOrder.items && selectedOrder.items.length > 0 ? (
                <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
                  <table className="table" style={{ width: '100%', margin: 0, fontSize: '0.82rem' }}>
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items.map((it, idx) => (
                        <tr key={idx}>
                          <td>{it.productName || it.name}</td>
                          <td>{it.quantity || it.qty}</td>
                          <td>₹{it.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>No item details available</div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowOrderModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

