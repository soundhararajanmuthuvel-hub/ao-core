import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { customersApi, productsApi, ordersApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../context/AuthContext';

const primaryColor = '#5a2d0c';

export default function FieldOrdering() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  
  // Selected fields
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [cartItems, setCartItems] = useState([]);
  const [overrideLimit, setOverrideLimit] = useState(false);
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin' || user?.role === 'Super Admin';
  
  // Settings & Configuration
  const [minLimits, setMinLimits] = useState({ GREEN: 10000, YELLOW: 5000, RED: 2000 });
  const [logisticsCharge, setLogisticsCharge] = useState(16.00);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [custRes, prodRes] = await Promise.all([
          customersApi.list({ limit: 100 }),
          productsApi.list({ limit: 100 })
        ]);
        setCustomers(custRes.data.customers || []);
        setProducts(prodRes.data.products || []);

        // Retrieve initial parameters from URL (e.g. from check-in page or catalog page)
        const cId = searchParams.get('customerId');
        const pId = searchParams.get('productId');

        if (cId) setSelectedCustomerId(cId);
        else if (custRes.data.customers?.length > 0) setSelectedCustomerId(custRes.data.customers[0].id);

        if (pId) setSelectedProductId(pId);
        else if (prodRes.data.products?.length > 0) setSelectedProductId(prodRes.data.products[0].id);

      } catch (err) {
        console.error('Error fetching data for field ordering:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [searchParams]);

  const activeCustomer = customers.find(c => c.id === Number(selectedCustomerId));
  const activeCustomerTier = activeCustomer?.tier || 'RED';
  const minRequiredOrder = minLimits[activeCustomerTier] || 2000;

  const handleAddToCart = () => {
    if (!selectedProductId) return;
    const product = products.find(p => p.id === Number(selectedProductId));
    if (!product) return;

    // Check stock
    const qty = Number(quantity);
    if (qty > Number(product.stock)) {
      alert(`Insufficient stock! Available quantity: ${product.stock} ${product.unit}`);
      return;
    }

    // Resolve tier price
    let tierPrice = product.sellingPrice;
    if (activeCustomerTier === 'GREEN' && Number(product.greenPrice) > 0) tierPrice = product.greenPrice;
    else if (activeCustomerTier === 'YELLOW' && Number(product.yellowPrice) > 0) tierPrice = p.yellowPrice;
    else if (activeCustomerTier === 'RED' && Number(product.redPrice) > 0) tierPrice = p.redPrice;

    // Auto apply trade scheme logic (e.g. buy 10 get 1 free)
    let schemeText = 'None';
    let freeQty = 0;
    if (qty >= 10) {
      freeQty = Math.floor(qty / 10);
      schemeText = `${10 * freeQty}+${freeQty} Scheme`;
    }

    const existingIdx = cartItems.findIndex(item => item.productId === product.id);
    if (existingIdx !== -1) {
      const updated = [...cartItems];
      const newQty = updated[existingIdx].qty + qty;
      
      if (newQty > Number(product.stock)) {
        alert(`Insufficient stock! Total in basket would exceed ${product.stock}`);
        return;
      }
      
      let newFreeQty = 0;
      if (newQty >= 10) {
        newFreeQty = Math.floor(newQty / 10);
        schemeText = `${10 * newFreeQty}+${newFreeQty} Scheme`;
      }

      updated[existingIdx].qty = newQty;
      updated[existingIdx].freeQty = newFreeQty;
      updated[existingIdx].schemeApplied = schemeText;
      updated[existingIdx].lineTotal = newQty * Number(tierPrice);
      setCartItems(updated);
    } else {
      setCartItems(prev => [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          qty,
          freeQty,
          schemeApplied: schemeText,
          unitPrice: Number(tierPrice),
          gstPercent: Number(product.gstPercent || 0),
          lineTotal: qty * Number(tierPrice)
        }
      ]);
    }
  };

  const handleRemoveFromCart = (idx) => {
    setCartItems(prev => prev.filter((_, i) => i !== idx));
  };

  // Totals calculations
  const itemsSubtotal = cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  const gstTotal = cartItems.reduce((sum, item) => sum + (item.lineTotal * item.gstPercent) / 100, 0);
  const grandTotal = itemsSubtotal + gstTotal + logisticsCharge;

  const handleSubmitOrder = async () => {
    if (cartItems.length === 0) {
      alert('Your ordering basket is empty.');
      return;
    }

    // Minimum Order Validation
    if (grandTotal < minRequiredOrder && !(isSuperAdmin && overrideLimit)) {
      alert(`Prevent Submission: Total order amount (₹${grandTotal.toFixed(2)}) is below the required minimum (₹${minRequiredOrder.toFixed(2)}) for ${activeCustomerTier} Tier customers. Only Super Admin can override.`);
      return;
    }

    const orderData = {
      customerName: activeCustomer.name,
      customerId: activeCustomer.id,
      phoneNumber: activeCustomer.phone || '',
      area: activeCustomer.state || '',
      address: activeCustomer.address || '',
      logisticsCharge,
      items: cartItems,
      source: 'Mobile_App',
      aiMetadata: { commitment: 'Same Day' }
    };

    try {
      if (!navigator.onLine) {
        // Offline Order Queue
        const offlineOrders = JSON.parse(localStorage.getItem('offline_orders') || '[]');
        offlineOrders.push(orderData);
        localStorage.setItem('offline_orders', JSON.stringify(offlineOrders));
        setCartItems([]);
        alert('Offline Order Queued successfully! Will sync automatically when connection resumes. 📡');
        navigate('/customer-visits');
        return;
      }

      await ordersApi.create(orderData);
      setCartItems([]);
      alert(`Order submitted successfully! Synced to AO ERP Sales. 🟢`);
      navigate('/customer-visits');
    } catch (err) {
      alert(err.response?.data?.message || 'Order submission failed.');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>🛒 SFA Field Order Taking</h1>
        <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem' }}>Create orders in real-time with customer-specific pricing constraints and scheme overrides.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        
        {/* Left Card: Customer & Product Selector */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>🛍️ Add Items to Basket</h2>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Select Customer</label>
            <select 
              value={selectedCustomerId} 
              onChange={e => {
                setSelectedCustomerId(e.target.value);
                setCartItems([]); // Reset cart when customer changes due to tier pricing mapping
              }} 
              className="form-control" 
              style={{ width: '100%' }}
            >
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.tier} Tier)</option>
              ))}
            </select>
            {activeCustomer && (
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span className={`badge ${activeCustomerTier === 'GREEN' ? 'badge-success' : activeCustomerTier === 'YELLOW' ? 'badge-warning' : 'badge-danger'}`} style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {activeCustomerTier} Tier
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Min order required: <strong>₹{minRequiredOrder.toLocaleString()}</strong>
                </span>
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Select Product</label>
            <select 
              value={selectedProductId} 
              onChange={e => setSelectedProductId(e.target.value)} 
              className="form-control" 
              style={{ width: '100%' }}
            >
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Stock: {Math.round(p.stock)})</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>Quantity to Order</label>
            <input 
              type="number" 
              value={quantity} 
              min="1"
              onChange={e => setQuantity(e.target.value)} 
              className="form-control" 
              style={{ width: '100%' }}
            />
            <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
              💡 Scheme reminder: Orders of 10+ automatically receive free item schemes (10+1 free).
            </span>
          </div>

          <button 
            type="button" 
            onClick={handleAddToCart} 
            className="btn btn-primary" 
            style={{ width: '100%', backgroundColor: primaryColor, borderColor: primaryColor, fontWeight: 700 }}
          >
            ➕ Add Item to Basket
          </button>
        </div>

        {/* Right Card: Cart Summary & Totals */}
        <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>🛒 Ordering Basket</h2>

          <div style={{ flex: 1, minHeight: '150px', maxHeight: '300px', overflowY: 'auto' }}>
            {cartItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 0', color: '#94a3b8', fontSize: '0.9rem' }}>Your basket is empty. Add products from selector.</div>
            ) : (
              cartItems.map((item, idx) => (
                <div key={idx} style={{ padding: '0.6rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                  <div>
                    <strong>{item.name}</strong><br />
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {item.qty} units @ ₹{item.unitPrice} 
                      {item.freeQty > 0 && <span style={{ color: '#10b981', fontWeight: 'bold' }}> (+{item.freeQty} Free)</span>}
                    </span>
                    {item.schemeApplied !== 'None' && (
                      <span className="badge badge-success" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>{item.schemeApplied}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <strong style={{ color: '#0f172a' }}>₹{item.lineTotal.toFixed(2)}</strong>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveFromCart(idx)} 
                      style={{ border: 'none', background: 'none', color: '#ef4444', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pricing Totals Box */}
          {cartItems.length > 0 && (
            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Subtotal:</span>
                <span>₹{itemsSubtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Estimated GST:</span>
                <span>₹{gstTotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Logistics / Delivery Charges:</span>
                <span>₹{logisticsCharge.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.25rem', fontSize: '1.05rem', fontWeight: 800 }}>
                <span>Order Grand Total:</span>
                <span style={{ color: grandTotal >= minRequiredOrder ? '#10b981' : '#ef4444' }}>
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>

              {grandTotal < minRequiredOrder && (
                <div style={{ padding: '0.5rem', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#b91c1c', fontSize: '0.75rem', marginTop: '0.5rem', fontWeight: 600 }}>
                  ⚠️ Validation Error: Below minimum order limit of ₹{minRequiredOrder} for {activeCustomerTier} Tier.
                  {isSuperAdmin && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer', color: '#7f1d1d' }}>
                      <input
                        type="checkbox"
                        checked={overrideLimit}
                        onChange={(e) => setOverrideLimit(e.target.checked)}
                      />
                      <span>Override Limit Warning (Admin Bypass)</span>
                    </label>
                  )}
                </div>
              )}

              <button 
                type="button" 
                onClick={handleSubmitOrder} 
                className="btn btn-primary"
                disabled={grandTotal < minRequiredOrder && !(isSuperAdmin && overrideLimit)}
                style={{ width: '100%', marginTop: '0.75rem', backgroundColor: primaryColor, borderColor: primaryColor, fontWeight: 700 }}
              >
                🚀 Submit Order to ERP
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
