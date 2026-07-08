import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi, customersApi, salesApi } from '../api';
import { useSettings } from '../context/SettingsContext';
import { useToast } from '../context/ToastContext';

const getLocalDateString = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function SaleCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { settings } = useSettings();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [amountPaid, setAmountPaid] = useState(0);
  const [expectedDispatchDate, setExpectedDispatchDate] = useState('');
  const [commitment, setCommitment] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(getLocalDateString());

  const [customerOutstanding, setCustomerOutstanding] = useState([]);
  const [loadingOutstanding, setLoadingOutstanding] = useState(false);

  useEffect(() => {
    if (!customerId) {
      setCustomerOutstanding([]);
      return;
    }
    setLoadingOutstanding(true);
    salesApi.outstanding({ customerId })
      .then(({ data }) => {
        setCustomerOutstanding(data || []);
      })
      .catch(err => console.error('Failed to fetch customer outstanding', err))
      .finally(() => setLoadingOutstanding(false));
  }, [customerId]);

  // Enhanced charges and GST modes
  const [gstBillingMode, setGstBillingMode] = useState('default');
  const [shippingOverride, setShippingOverride] = useState('');
  const [packingCharge, setPackingCharge] = useState(0);
  const [handlingCharge, setHandlingCharge] = useState(0);
  const [courierCharge, setCourierCharge] = useState(0);
  const [otherCharge, setOtherCharge] = useState(0);

  useEffect(() => {
    productsApi.list({ limit: 200 }).then(({ data }) => setProducts(data.products));
    customersApi.list({ limit: 200 }).then(({ data }) => setCustomers(data.customers));
  }, []);

  useEffect(() => {
    if (!customerId) return;
    const selectedCustomer = customers.find(c => String(c.id || c._id) === String(customerId));
    if (!selectedCustomer) return;
    
    const specialPricing = selectedCustomer.specialPricing || {};
    
    setCart(prevCart => prevCart.map(item => {
      const override = specialPricing[item.product] || null;
      let unitPrice = item.unitPrice;
      let discountPercent = 0;
      let schemeApplied = 'None';
      
      if (override) {
        if (typeof override === 'object') {
          if (override.price !== undefined && override.price !== null && override.price !== '') {
            unitPrice = Number(override.price);
          }
          if (override.discount !== undefined && override.discount !== null && override.discount !== '') {
            discountPercent = Number(override.discount);
          }
          if (override.scheme !== undefined && override.scheme !== null && override.scheme !== '') {
            schemeApplied = override.scheme;
          }
        } else if (typeof override === 'number') {
          unitPrice = override;
        }
      } else {
        const prod = products.find(p => String(p.id || p._id) === String(item.product));
        if (prod) {
          unitPrice = prod.sellingPrice;
        }
      }
      
      let freeQty = 0;
      const schemeRegex = /^(\d+)\+(\d+)$/;
      const matchScheme = schemeApplied.match(schemeRegex);
      if (matchScheme) {
        const buyQty = Number(matchScheme[1]);
        const getQty = Number(matchScheme[2]);
        freeQty = Math.floor(item.qty / buyQty) * getQty;
      }
      
      return {
        ...item,
        unitPrice,
        discountPercent,
        schemeApplied,
        freeQty
      };
    }));
  }, [customerId, customers, products]);


  const addToCart = (productId) => {
    const p = products.find((x) => String(x.id || x._id) === String(productId));
    if (!p) return;
    const existing = cart.find((c) => c.product === (p.id || p._id));
    
    // Look up customer special price
    const selectedCustomer = customers.find(c => String(c.id || c._id) === String(customerId));
    const specialPricing = selectedCustomer ? (selectedCustomer.specialPricing || {}) : {};
    const override = specialPricing[p.id] || specialPricing[p.sku] || null;
    
    let basePrice = p.sellingPrice;
    let itemDiscountPercent = 0;
    let schemeApplied = 'None';
    
    if (override) {
      if (typeof override === 'object') {
        if (override.price !== undefined && override.price !== null && override.price !== '') {
          basePrice = Number(override.price);
        }
        if (override.discount !== undefined && override.discount !== null && override.discount !== '') {
          itemDiscountPercent = Number(override.discount);
        }
        if (override.scheme !== undefined && override.scheme !== null && override.scheme !== '') {
          schemeApplied = override.scheme;
        }
      } else if (typeof override === 'number') {
        basePrice = override;
      }
    }

    if (existing) {
      const newQty = existing.qty + 1;
      let newFreeQty = 0;
      const schemeRegex = /^(\d+)\+(\d+)$/;
      const matchScheme = schemeApplied.match(schemeRegex);
      if (matchScheme) {
        const buyQty = Number(matchScheme[1]);
        const getQty = Number(matchScheme[2]);
        newFreeQty = Math.floor(newQty / buyQty) * getQty;
      }
      setCart(cart.map((c) => c.product === (p.id || p._id) ? { ...c, qty: newQty, freeQty: newFreeQty } : c));
    } else {
      let freeQty = 0;
      const schemeRegex = /^(\d+)\+(\d+)$/;
      const matchScheme = schemeApplied.match(schemeRegex);
      if (matchScheme) {
        const buyQty = Number(matchScheme[1]);
        const getQty = Number(matchScheme[2]);
        freeQty = Math.floor(1 / buyQty) * getQty;
      }

      setCart([
        ...cart,
        {
          product: p.id || p._id,
          name: p.name,
          qty: 1,
          unitPrice: basePrice,
          discountPercent: itemDiscountPercent,
          gstPercent: p.gstPercent,
          stock: p.stock,
          weight: p.weight || 0.200,
          schemeApplied: schemeApplied,
          freeQty: freeQty,
        },
      ]);
    }
  };

  const updateQty = (productId, qty) => {
    if (qty < 1) { setCart(cart.filter((c) => c.product !== productId)); return; }
    setCart(cart.map((c) => {
      if (c.product !== productId) return c;
      const updated = { ...c, qty };
      
      let freeQty = 0;
      const schemeRegex = /^(\d+)\+(\d+)$/;
      const matchScheme = (c.schemeApplied || 'None').match(schemeRegex);
      if (matchScheme) {
        const buyQty = Number(matchScheme[1]);
        const getQty = Number(matchScheme[2]);
        freeQty = Math.floor(qty / buyQty) * getQty;
      }
      updated.freeQty = freeQty;
      return updated;
    }));
  };

  const updateCartItem = (productId, field, value) => {
    setCart(cart.map((c) => {
      if (c.product !== productId) return c;
      const updated = { ...c, [field]: value };
      
      if (field === 'schemeApplied') {
        const qty = Number(c.qty || 0);
        let freeQty = 0;
        const schemeRegex = /^(\d+)\+(\d+)$/;
        const matchScheme = value.match(schemeRegex);
        if (matchScheme) {
          const buyQty = Number(matchScheme[1]);
          const getQty = Number(matchScheme[2]);
          freeQty = Math.floor(qty / buyQty) * getQty;
        }
        updated.freeQty = freeQty;
      }
      return updated;
    }));
  };

  // 1. Resolve Customer and GST Mode
  const cust = customers.find((c) => String(c.id || c._id) === String(customerId));
  let activeGstMode = 'exclusive';
  if (cust) {
    activeGstMode = cust.gstBillingMode || 'default';
    if (activeGstMode === 'default') {
      if (cust.customerType === 'White Label') activeGstMode = 'exclusive';
      else if (cust.customerType === 'D2C Customer') activeGstMode = 'inclusive';
      else if (cust.customerType === 'Export Customer') activeGstMode = 'no_gst';
      else activeGstMode = settings?.defaultGstMode || 'exclusive';
    }
  } else {
    activeGstMode = settings?.defaultGstMode || 'exclusive';
  }

  if (gstBillingMode !== 'default') {
    activeGstMode = gstBillingMode;
  }

  // 2. Calculate weight & auto shipping
  const totalWeight = cart.reduce((sum, item) => sum + Number(item.qty) * Number(item.weight || 0.200), 0);
  
  let calculatedShipping = 0;
  if (settings) {
    const mode = settings.shippingMode || 'free';
    if (mode === 'fixed') {
      calculatedShipping = Number(settings.shippingFixedCharge || 0);
    } else if (mode === 'weight') {
      const weightInGrams = totalWeight * 1000;
      try {
        const rules = JSON.parse(settings.shippingWeightRules || '[]');
        const matched = rules.find((r) => weightInGrams > Number(r.min) && weightInGrams <= Number(r.max));
        calculatedShipping = matched ? Number(matched.charge) : 0;
      } catch (e) {
        calculatedShipping = 0;
      }
    } else if (mode === 'value') {
      const tempSubtotal = cart.reduce((sum, item) => sum + Number(item.qty) * Number(item.unitPrice), 0);
      if (tempSubtotal >= Number(settings.shippingValueThreshold || 999)) {
        calculatedShipping = Number(settings.shippingValueAboveCharge || 0);
      } else {
        calculatedShipping = Number(settings.shippingValueBelowCharge || 80);
      }
    } else if (mode === 'customer_type' && cust) {
      try {
        const rates = JSON.parse(settings.shippingCustomerTypeRates || '{}');
        calculatedShipping = Number(rates[cust.customerType] || 0);
      } catch (e) {
        calculatedShipping = 0;
      }
    }
  }

  const shippingCharge = shippingOverride !== '' ? Number(shippingOverride) : calculatedShipping;

  // 3. Subtotal & GST logic based on active mode
  let subtotal = 0;
  let gstTotal = 0;
  cart.forEach((item) => {
    const qty = Number(item.qty || 0);
    const basePrice = Number(item.unitPrice || 0);
    const disc = Number(item.discountPercent || 0);
    const price = basePrice * (1 - disc / 100);
    const gst = Number(item.gstPercent || 0);

    if (activeGstMode === 'inclusive') {
      const lineTotal = qty * price;
      const taxable = lineTotal / (1 + gst / 100);
      subtotal += taxable;
      gstTotal += (lineTotal - taxable);
    } else if (activeGstMode === 'no_gst') {
      subtotal += qty * price;
      gstTotal += 0;
    } else { // exclusive
      const taxable = qty * price;
      subtotal += taxable;
      gstTotal += (taxable * gst) / 100;
    }
  });

  const totalCharges = shippingCharge + Number(packingCharge) + Number(handlingCharge) + Number(courierCharge) + Number(otherCharge);
  const grandTotalBeforeRound = subtotal + gstTotal + totalCharges - Number(discount);
  const grandTotal = Math.max(0, Math.round(grandTotalBeforeRound));
  const roundOff = Number((grandTotal - grandTotalBeforeRound).toFixed(2));

  const isBackordered = cart.some(item => Number(item.qty) + Number(item.freeQty || 0) > Number(item.stock || 0));

  useEffect(() => {
    if (isBackordered) {
      if (!expectedDispatchDate) {
        const d = new Date();
        d.setDate(d.getDate() + 3);
        setExpectedDispatchDate(d.toISOString().substring(0, 10));
      }
      if (!commitment) {
        setCommitment('Within 3 Days');
      }
    } else {
      setExpectedDispatchDate('');
      setCommitment('');
    }
  }, [isBackordered]);

  useEffect(() => {
    if (paymentStatus === 'paid') setAmountPaid(grandTotal);
  }, [grandTotal, paymentStatus]);

  const submit = async () => {
    if (!customerId || !cart.length) return toast('Select customer and items', 'error');
    try {
      const { data } = await salesApi.create({
        customer: customerId,
        date: invoiceDate,
        items: cart.map(({ product, qty, unitPrice, discountPercent, gstPercent, schemeApplied, freeQty }) => ({
          product,
          qty,
          unitPrice,
          discountPercent: Number(discountPercent || 0),
          gstPercent,
          schemeApplied: schemeApplied || 'None',
          freeQty: Number(freeQty || 0)
        })),
        discount,
        paymentMethod,
        paymentStatus,
        amountPaid,
        expectedDispatchDate: isBackordered ? expectedDispatchDate : null,
        commitment: isBackordered ? commitment : null,
        gstBillingMode: activeGstMode,
        shippingCharge,
        packingCharge,
        handlingCharge,
        courierCharge,
        otherCharge,
      });
      toast('Invoice created successfully', 'success');
      navigate(`/sales/${data.sale.id || data.sale._id}`);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to create invoice', 'error');
    }
  };

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          ✍️ Create New Sales Invoice
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.5rem' }}>
        {/* Left Column: Product Selection */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: '#fff' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Select Finished Goods</h3>
          <select className="form-control" onChange={(e) => { addToCart(e.target.value); e.target.value = ''; }}>
            <option value="">Choose item...</option>
            {products.filter(p => !p.productType || ['manufactured', 'repacking', 'trading'].includes(p.productType)).map((p) => (
              <option key={p.id || p._id} value={p.id || p._id}>
                {p.name} — Stock: {p.stock} {p.unit} — ₹{p.sellingPrice}
              </option>
            ))}
          </select>

          {cart.length > 0 && (
            <div style={{ marginTop: '1.5rem', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
              <strong>Shipment Statistics:</strong>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                <span>Total Package Weight:</span>
                <strong>{totalWeight.toFixed(3)} Kg</strong>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Customer & Financial configs */}
        <div className="card" style={{ padding: '1.5rem', borderRadius: '12px', backgroundColor: '#fff' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Customer & Charges Info</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Select Customer</label>
              <select className="form-control" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                <option value="">Choose customer...</option>
                {customers.map((c) => <option key={c.id || c._id} value={c.id || c._id}>{c.name} ({c.customerType})</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Invoice Date</label>
              <input
                type="date"
                className="form-control"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>
          </div>

          {cust && (
            <div style={{ marginBottom: '1rem', padding: '1rem', border: '1px solid #fed7aa', backgroundColor: '#fff7ed', borderRadius: '8px' }}>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 700, color: '#c2410c', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                🛡️ Financial Profiling: {cust.paymentCycle || 'Bill to Bill'}
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: '#7c2d12' }}>
                <div>Outstanding Amount: <strong>₹{Number(cust.balance || customerOutstanding.reduce((sum, inv) => sum + Number(inv.balance || 0), 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                <div>Outstanding Invoices: <strong>{customerOutstanding.length}</strong></div>
                {customerOutstanding.length > 0 && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    <span className="badge" style={{ color: '#fff', backgroundColor: '#f97316', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>⚠️ Previous Bill Unpaid</span>
                    {customerOutstanding.some(inv => inv.daysOverdue > 15) && <span className="badge" style={{ color: '#fff', backgroundColor: '#ef4444', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem' }}>⚠️ Overdue &gt; 15 Days</span>}
                    {customerOutstanding.some(inv => inv.daysOverdue > 30) && <span className="badge" style={{ color: '#fff', backgroundColor: '#dc2626', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>🚨 Overdue &gt; 30 Days</span>}
                    {customerOutstanding.some(inv => inv.daysOverdue > 45) && <span className="badge" style={{ color: '#fff', backgroundColor: '#991b1b', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold' }}>⛔ Overdue &gt; 45 Days</span>}
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>Payment Method</label>
              <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {['cash', 'card', 'upi', 'bank', 'credit'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Payment Status</label>
              <select className="form-control" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                {['paid', 'partial', 'pending'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label>GST Billing Mode</label>
              <select className="form-control" value={gstBillingMode} onChange={(e) => setGstBillingMode(e.target.value)}>
                <option value="default">Auto (Use customer type rules)</option>
                <option value="exclusive">GST Exclusive (Add tax)</option>
                <option value="inclusive">GST Inclusive (Extract tax)</option>
                <option value="no_gst">No GST / Zero Tax</option>
              </select>
              <div style={{ marginTop: '0.25rem' }}>
                <span className={`status-badge`} style={{ fontSize: '0.75rem', padding: '0.15rem 0.4rem', backgroundColor: '#f1f5f9', color: '#475569' }}>
                  Active Tax Mode: {activeGstMode.toUpperCase()}
                </span>
              </div>
            </div>
            <div className="form-group">
              <label>Discount Amount (₹)</label>
              <input type="number" className="form-control" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '1rem', marginTop: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: '#475569' }}>Additional Logistics Charges</h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
              <div className="form-group">
                <label>Shipping Charge (₹)</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder={`Auto: ₹${calculatedShipping}`}
                  value={shippingOverride}
                  onChange={(e) => setShippingOverride(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Packing Charge (₹)</label>
                <input type="number" className="form-control" value={packingCharge} onChange={(e) => setPackingCharge(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Handling Charge (₹)</label>
                <input type="number" className="form-control" value={handlingCharge} onChange={(e) => setHandlingCharge(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Courier Charge (₹)</label>
                <input type="number" className="form-control" value={courierCharge} onChange={(e) => setCourierCharge(Number(e.target.value))} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Other Charge (₹)</label>
                <input type="number" className="form-control" value={otherCharge} onChange={(e) => setOtherCharge(Number(e.target.value))} />
              </div>
            </div>
          </div>

          {paymentStatus !== 'paid' && (
            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label>Amount Paid (₹)</label>
              <input type="number" className="form-control" value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value))} />
            </div>
          )}

          {isBackordered && (
            <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ffedd5', backgroundColor: '#fff7ed', borderRadius: '10px' }}>
              <h4 style={{ color: '#c2410c', margin: '0 0 0.75rem 0', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.9rem' }}>
                ⚠️ Backorder Details
              </h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Expected Dispatch Date</label>
                  <input 
                    type="date" 
                    className="form-control" 
                    value={expectedDispatchDate} 
                    onChange={(e) => setExpectedDispatchDate(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>Customer Commitment</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    placeholder="e.g. Within 3 Days" 
                    value={commitment} 
                    onChange={(e) => setCommitment(e.target.value)} 
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Cart Grid list */}
      <div className="card" style={{ marginTop: '1.5rem', padding: '1.5rem', borderRadius: '12px', backgroundColor: '#fff' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Order Lines / Cart</h3>
        <div className="table-wrap">
          <table className="data-table cart-table">
          <thead>
            <tr>
              <th>Item</th>
              <th style={{ width: '120px' }}>Qty</th>
              <th style={{ width: '120px' }}>Scheme</th>
              <th style={{ width: '100px' }}>Free Qty</th>
              <th>Price</th>
              <th>GST%</th>
              <th>Tax Mode</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cart.map((i) => {
              const qty = Number(i.qty || 0);
              const price = Number(i.unitPrice || 0);
              const gst = Number(i.gstPercent || 0);
              let itemTotal = 0;

              if (activeGstMode === 'inclusive') {
                itemTotal = qty * price;
              } else if (activeGstMode === 'no_gst') {
                itemTotal = qty * price;
              } else { // exclusive
                itemTotal = qty * price * (1 + gst / 100);
              }

              return (
                <tr key={i.product}>
                  <td><strong>{i.name}</strong></td>
                  <td>
                    <input type="number" className="form-control" style={{ width: '80px', display: 'inline-block' }} value={i.qty} min={1} onChange={(e) => updateQty(i.product, Number(e.target.value))} />
                    {Number(i.qty) + Number(i.freeQty || 0) > Number(i.stock || 0) && (
                      <div style={{ fontSize: '0.75rem', color: '#c2410c', marginTop: '0.25rem', fontWeight: 600 }}>
                        ⚠️ Backordering {Number(i.qty) + Number(i.freeQty || 0) - Number(i.stock || 0)} units
                      </div>
                    )}
                  </td>
                  <td>
                    <select
                      className="form-control form-control-sm"
                      value={i.schemeApplied || 'None'}
                      onChange={(e) => updateCartItem(i.product, 'schemeApplied', e.target.value)}
                    >
                      <option value="None">None</option>
                      <option value="10+1">10+1</option>
                      <option value="20+2">20+2</option>
                      <option value="50+5">50+5</option>
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="form-control form-control-sm"
                      min={0}
                      value={i.freeQty || 0}
                      onChange={(e) => updateCartItem(i.product, 'freeQty', Number(e.target.value))}
                    />
                  </td>
                  <td>₹{price.toFixed(2)}</td>
                  <td>{gst}%</td>
                  <td>
                    <span className="badge" style={{ textTransform: 'uppercase', backgroundColor: '#f1f5f9', color: '#475569' }}>
                      {activeGstMode}
                    </span>
                  </td>
                  <td><strong>₹{itemTotal.toFixed(2)}</strong></td>
                  <td>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => updateQty(i.product, 0)}>×</button>
                  </td>
                </tr>
              );
            })}
            {cart.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                  No items added to cart. Choose finished products from the left section.
                </td>
              </tr>
            )}
          </tbody>
          </table>
        </div>

        {cart.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
            <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.925rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Taxable Value (Subtotal):</span>
                <span>₹{subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>GST Total:</span>
                <span>₹{gstTotal.toFixed(2)}</span>
              </div>
              {totalCharges > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2563eb' }}>
                  <span>Logistics Charges:</span>
                  <span>+₹{totalCharges.toFixed(2)}</span>
                </div>
              )}
              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
                  <span>Discount:</span>
                  <span>-₹{Number(discount).toFixed(2)}</span>
                </div>
              )}
              {roundOff !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  <span>Round Off Adjustment:</span>
                  <span>{roundOff > 0 ? `+₹${roundOff}` : `-₹${Math.abs(roundOff)}`}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 800, borderTop: '2px solid #e2e8f0', paddingTop: '0.5rem', marginTop: '0.25rem', color: '#0f172a' }}>
                <span>Grand Total:</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
              
              <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', fontSize: '1rem', fontWeight: 700 }} onClick={submit}>
                💾 Save & Generate Invoice
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
