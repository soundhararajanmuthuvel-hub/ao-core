import { useState, useEffect, useRef, useCallback } from 'react';
import client from '../api/client';
import { useToast } from '../context/ToastContext';
import '../styles/quickbilling.css';


// ─── helpers ──────────────────────────────────────────────────────────────────

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtShort = (n) =>
  Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

const phoneValid = (p) => /^\d{10}$/.test(String(p || '').trim());

const blankItem = () => ({
  id: Date.now() + Math.random(),
  product: null,
  productSearch: '',
  qty: 1,
  unitPrice: '',
  showDropdown: false,
  priceEdited: false,
});

const blankForm = () => ({
  customerName: '',
  phone: '',
  items: [blankItem()],
  discountType: 'flat',
  discountValue: '',
});

// ─── WhatsApp message builder ──────────────────────────────────────────────────
// Warm, personal template — greeting first, savings called out, invitation to return
function buildWhatsAppMessage(sale, phoneHint) {
  const customer = sale?.customer;
  // Use first name only for a personal feel; fall back gracefully to "there"
  const fullName = customer?.name || '';
  const firstName = fullName.split(' ')[0] || 'there';
  // Never show "Walk-in Customer" as a name in the message
  const greeting = (fullName && fullName.toLowerCase() !== 'walk-in customer')
    ? firstName
    : 'there';

  const invoiceNumber = sale?.invoiceNumber || '';
  const items = sale?.items || [];
  const discount = Number(sale?.discount || 0);
  const grandTotal = Number(sale?.grandTotal || 0);

  let msg = `🌿 *Amudhasurabiy Organics*\n\n`;
  msg += `Hi ${greeting}! Thank you for shopping with us today 💚\n\n`;
  msg += `🧾 Invoice: ${invoiceNumber}\n\n`;

  for (const item of items) {
    const name = item.product?.name || item.name || 'Item';
    const qty = Number(item.qty || 0);
    const lineTotal = Number(item.lineTotal || qty * Number(item.unitPrice || 0));
    msg += `• ${name} × ${qty} — ₹${fmtShort(lineTotal)}\n`;
  }

  if (discount > 0) {
    msg += `\n🎉 You saved: ₹${fmtShort(discount)}\n`;
  }

  msg += `\n*Total Paid: ₹${fmtShort(grandTotal)}*\n\n`;
  msg += `We hope you love your organic picks! For more goodness, visit us anytime:\n`;
  msg += `🌐 www.amudhasurabiy.com\n\n`;
  msg += `See you again soon! 🙏`;

  return msg;
}

function openWhatsApp(phone, sale) {
  const msg = buildWhatsAppMessage(sale);
  const encoded = encodeURIComponent(msg);
  const url = `https://wa.me/91${String(phone).trim()}?text=${encoded}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ─── Debounce hook ─────────────────────────────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return debounced;
}

// ─── ProductSearch (per line item) ────────────────────────────────────────────
function ProductSearch({ item, allProducts, onChange }) {
  const debouncedQuery = useDebounce(item.productSearch, 150);
  const wrapRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Filter products client-side — show first 8 on empty query (immediate on focus)
  const filtered = debouncedQuery.length < 1
    ? allProducts.slice(0, 8)
    : allProducts.filter((p) => {
        const q = debouncedQuery.toLowerCase();
        return (
          (p.name || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q) ||
          (p.category || '').toLowerCase().includes(q) ||
          (p.brand || '').toLowerCase().includes(q)
        );
      }).slice(0, 12);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        onChange({ showDropdown: false });
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onChange]);

  const selectProduct = (p) => {
    onChange({
      product: p,
      productSearch: p.name,
      unitPrice: Number(p.sellingPrice || 0),
      showDropdown: false,
      priceEdited: false,
    });
    setActiveIdx(0);
  };

  const handleKeyDown = (e) => {
    if (!item.showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && filtered[activeIdx]) {
      e.preventDefault();
      selectProduct(filtered[activeIdx]);
    } else if (e.key === 'Escape') {
      onChange({ showDropdown: false });
    }
  };

  return (
    <div className="qb-product-wrap" ref={wrapRef}>
      <input
        className={`qb-input${!item.product && item.productSearch ? ' error' : ''}`}
        type="text"
        placeholder="Search product by name or SKU…"
        value={item.productSearch}
        autoComplete="off"
        onChange={(e) =>
          onChange({ productSearch: e.target.value, showDropdown: true, product: null })
        }
        onFocus={() => onChange({ showDropdown: true })}
        onKeyDown={handleKeyDown}
        aria-label="Search product"
        aria-autocomplete="list"
        aria-expanded={item.showDropdown}
      />
      {item.showDropdown && filtered.length > 0 && (
        <div className="qb-product-dropdown" role="listbox">
          {filtered.map((p, i) => (
            <div
              key={p.id}
              className={`qb-product-option${i === activeIdx ? ' active' : ''}`}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={() => selectProduct(p)}
              onMouseEnter={() => setActiveIdx(i)}
            >
              <div>
                <div className="qb-product-option-name">{p.name}</div>
                <div className="qb-product-option-meta">
                  {p.sku} · {p.unit || 'pcs'} · Stock: {p.stock ?? '—'}
                </div>
              </div>
              <div className="qb-product-option-price">₹{fmtShort(p.sellingPrice)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function QuickBilling() {
  const { toast } = useToast();

  // ── Product catalog (pre-fetched, cached client-side) ─────────────────────
  const [allProducts, setAllProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      // CRITICAL: fetch with isActive + isArchived only — NOT isPublished
      // Using client directly so we can pass exact query params
      const { data } = await client.get('/products', {
        params: { limit: 500, status: 'active', showArchived: false },
      });
      // Extra client-side guard: exclude any archived that slipped through
      const products = (data.products || []).filter(
        (p) => p.isActive !== false && !p.isArchived
      );
      setAllProducts(products);
      setProductsLoaded(true);
    } catch {
      toast('Failed to load products', 'error');
    }
  }, [toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ── Dashboard stats ───────────────────────────────────────────────────────
  const [stats, setStats] = useState({ totalSales: 0, billCount: 0, totalDiscount: 0 });
  const [recentBills, setRecentBills] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statsLoading, setStatsLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const fetchStats = useCallback(async (search = '') => {
    setStatsLoading(true);
    try {
      const params = search ? { search } : {};
      const { data } = await client.get('/quick-billing/stats', { params });
      setStats({
        totalSales: data.totalSales || 0,
        billCount: data.billCount || 0,
        totalDiscount: data.totalDiscount || 0,
      });
      setRecentBills(data.recentBills || []);
    } catch {
      // silently fail — stats are non-critical
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats(debouncedSearch);
  }, [fetchStats, debouncedSearch]);

  // ── Bill form state ────────────────────────────────────────────────────────
  const [form, setForm] = useState(blankForm());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState(null); // the invoice saved after a successful bill

  // ── Live calculations ──────────────────────────────────────────────────────
  const subtotal = form.items.reduce((sum, item) => {
    const qty = Number(item.qty) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  let discountAmount = 0;
  if (form.discountValue && Number(form.discountValue) > 0) {
    discountAmount =
      form.discountType === 'percent'
        ? (Number(form.discountValue) / 100) * subtotal
        : Number(form.discountValue);
  }
  discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
  const finalAmount = Math.max(0, subtotal - discountAmount);

  // ── Helpers for updating items ────────────────────────────────────────────
  const updateItem = (index, patch) => {
    setForm((f) => {
      const items = f.items.map((it, i) => (i === index ? { ...it, ...patch } : it));
      return { ...f, items };
    });
    if (errors[`item_${index}`]) {
      setErrors((e) => { const next = { ...e }; delete next[`item_${index}`]; return next; });
    }
  };

  const addItem = () => {
    setForm((f) => ({ ...f, items: [...f.items, blankItem()] }));
  };

  const removeItem = (index) => {
    setForm((f) => ({
      ...f,
      items: f.items.filter((_, i) => i !== index),
    }));
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!phoneValid(form.phone)) errs.phone = 'Enter a valid 10-digit phone number';
    let hasValidItem = false;
    form.items.forEach((item, i) => {
      if (!item.product) { errs[`item_${i}`] = 'Select a product'; }
      else if (Number(item.qty) <= 0) { errs[`item_${i}`] = 'Quantity must be > 0'; }
      else { hasValidItem = true; }
    });
    if (!hasValidItem) errs.items = 'Add at least one valid item';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  // WhatsApp must open IMMEDIATELY the moment the invoice number is available —
  // no blocking spinner in between, no extra confirmation tap.
  const handleSubmit = async () => {
    if (!validate()) return;
    if (submitting) return; // prevent double-tap

    setSubmitting(true);

    const phone = form.phone.trim();
    const payload = {
      customerName: form.customerName.trim() || undefined,
      phone,
      items: form.items
        .filter((i) => i.product && Number(i.qty) > 0)
        .map((i) => ({
          productId: i.product.id,
          qty: Number(i.qty),
          unitPrice: Number(i.unitPrice),
        })),
      discountType: form.discountType,
      discountValue: Number(form.discountValue) || 0,
    };

    try {
      const { data } = await client.post('/quick-billing', payload);
      const sale = data.sale;

      // ── Fire WhatsApp immediately — no extra confirmation, no delay ──────
      openWhatsApp(phone, sale);

      // Update UI state after WhatsApp is already launched
      setLastSale(sale);
      toast(`✓ Invoice ${sale.invoiceNumber} saved`, 'success');
      fetchStats(debouncedSearch);
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to create bill. Please try again.';
      toast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // ── New Bill reset ────────────────────────────────────────────────────────
  const handleNewBill = () => {
    setForm(blankForm());
    setErrors({});
    setLastSale(null);
  };

  // ── Resend WhatsApp from recent bills ─────────────────────────────────────
  const handleResend = (bill) => {
    const phone = bill?.customer?.phone || '';
    if (!phone) { toast('No phone number on record', 'warning'); return; }
    openWhatsApp(phone.replace(/^\+91/, ''), bill);
  };

  const formatTime = (dt) => {
    if (!dt) return '';
    return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="qb-page">

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="qb-header">
        <div className="qb-header-icon">🏪</div>
        <div>
          <h1>Quick Billing</h1>
          <p>Phoenix Mall Stall · Amudhasurabiy Organics</p>
        </div>
      </div>

      {/* ── Dashboard panel ─────────────────────────────────────────────── */}
      <button
        className="qb-panel-toggle"
        onClick={() => setPanelOpen((v) => !v)}
        aria-expanded={panelOpen}
        type="button"
      >
        <span>Today's Summary</span>
        <span className={`qb-panel-toggle-arrow${panelOpen ? ' open' : ''}`}>▾</span>
      </button>

      {panelOpen && (
        <>
          {/* Stat cards */}
          <div className="qb-stats-row">
            <div className="qb-stat-card">
              <div className="stat-value">
                {statsLoading ? '…' : `₹${fmtShort(stats.totalSales)}`}
              </div>
              <div className="stat-label">Revenue</div>
            </div>
            <div className="qb-stat-card">
              <div className="stat-value">{statsLoading ? '…' : stats.billCount}</div>
              <div className="stat-label">Bills Today</div>
            </div>
            <div className="qb-stat-card">
              <div className="stat-value">
                {statsLoading ? '…' : `₹${fmtShort(stats.totalDiscount)}`}
              </div>
              <div className="stat-label">Discounts</div>
            </div>
          </div>

          {/* Recent bills */}
          <div className="qb-section">
            <div className="qb-section-title">Recent Bills</div>

            {/* Search Invoice */}
            <div className="qb-search-wrap">
              <span className="qb-search-icon">🔍</span>
              <input
                id="qb-invoice-search"
                className="qb-search-input"
                type="search"
                placeholder="Search by invoice#, name, or phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search invoices"
              />
            </div>

            <div className="qb-recent-list">
              {recentBills.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
                  {searchQuery ? 'No matching invoices' : 'No bills today yet'}
                </p>
              )}
              {recentBills.map((bill) => (
                <div key={bill.id} className="qb-recent-item">
                  <div className="qb-recent-info">
                    <div className="qb-recent-inv">{bill.invoiceNumber}</div>
                    <div className="qb-recent-meta">
                      {bill.customer?.name || 'Walk-in'} · {bill.customer?.phone || ''}
                      {' · '}{formatTime(bill.createdAt)}
                    </div>
                  </div>
                  <div className="qb-recent-amount">₹{fmtShort(bill.grandTotal)}</div>
                  <button
                    className="qb-resend-btn"
                    title="Resend via WhatsApp"
                    onClick={() => handleResend(bill)}
                    type="button"
                    aria-label={`Resend invoice ${bill.invoiceNumber} via WhatsApp`}
                  >
                    💬
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Bill Form ───────────────────────────────────────────────────── */}
      <div className="qb-section" style={{ marginTop: '0.5rem' }}>
        <div className="qb-section-title">New Bill</div>

        <div className="qb-form-card">

          {/* Customer Name */}
          <div className="qb-field">
            <label className="qb-label" htmlFor="qb-customer-name">Customer Name</label>
            <input
              id="qb-customer-name"
              className="qb-input"
              type="text"
              placeholder="Optional"
              value={form.customerName}
              onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
              autoComplete="name"
            />
          </div>

          {/* Phone */}
          <div className="qb-field">
            <label className="qb-label" htmlFor="qb-phone">
              Phone Number <span className="qb-required">*</span>
            </label>
            <input
              id="qb-phone"
              className={`qb-input${errors.phone ? ' error' : ''}`}
              type="tel"
              inputMode="tel"
              placeholder="10-digit mobile number"
              value={form.phone}
              maxLength={10}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                setForm((f) => ({ ...f, phone: val }));
                if (errors.phone) setErrors((e2) => { const n = { ...e2 }; delete n.phone; return n; });
              }}
              autoComplete="tel-national"
            />
            {errors.phone && <div className="qb-error-msg">⚠ {errors.phone}</div>}
          </div>
        </div>

        {/* ── Line Items ────────────────────────────────────────────────── */}
        {form.items.map((item, index) => (
          <div key={item.id} className="qb-form-card">
            <div className="qb-line-item-header">
              <span className="qb-line-item-num">
                {form.items.length > 1 ? `Item ${index + 1}` : 'Item'}
              </span>
              {form.items.length > 1 && (
                <button
                  className="qb-remove-btn"
                  onClick={() => removeItem(index)}
                  type="button"
                  aria-label={`Remove item ${index + 1}`}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Product search */}
            <div className="qb-field">
              <label className="qb-label" htmlFor={`qb-product-${index}`}>
                Product <span className="qb-required">*</span>
              </label>
              <ProductSearch
                item={item}
                allProducts={allProducts}
                onChange={(patch) => updateItem(index, patch)}
              />
              {errors[`item_${index}`] && (
                <div className="qb-error-msg">⚠ {errors[`item_${index}`]}</div>
              )}
              {!productsLoaded && (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  Loading products…
                </div>
              )}
            </div>

            {/* Qty + Price row */}
            <div className="qb-price-qty-row">
              <div className="qb-field" style={{ marginBottom: 0 }}>
                <label className="qb-label">Quantity</label>
                <div className="qb-stepper" role="group" aria-label="Quantity">
                  <button
                    className="qb-stepper-btn"
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() =>
                      updateItem(index, { qty: Math.max(1, Number(item.qty) - 1) })
                    }
                  >
                    −
                  </button>
                  <input
                    className="qb-stepper-input"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={item.qty}
                    aria-label="Quantity"
                    onChange={(e) => {
                      const v = Math.max(0, parseInt(e.target.value, 10) || 0);
                      updateItem(index, { qty: v });
                    }}
                  />
                  <button
                    className="qb-stepper-btn"
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => updateItem(index, { qty: Number(item.qty) + 1 })}
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="qb-field" style={{ marginBottom: 0 }}>
                <label className="qb-label" htmlFor={`qb-price-${index}`}>
                  Price (₹)
                </label>
                <input
                  id={`qb-price-${index}`}
                  className="qb-input"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={item.unitPrice}
                  onChange={(e) =>
                    updateItem(index, { unitPrice: e.target.value, priceEdited: true })
                  }
                />
              </div>
            </div>

            {/* Line total */}
            <div className="qb-line-total-row">
              <span className="qb-line-total-label">Line Total</span>
              <span className="qb-line-total-value">
                ₹{fmt(Number(item.qty || 0) * Number(item.unitPrice || 0))}
              </span>
            </div>
          </div>
        ))}

        {/* Add another item */}
        <button
          className="qb-add-item-btn"
          type="button"
          onClick={addItem}
          aria-label="Add another item"
        >
          + Add Another Item
        </button>

        {/* ── Discount ────────────────────────────────────────────────── */}
        <div className="qb-form-card" style={{ marginTop: '0.5rem' }}>
          <div className="qb-field" style={{ marginBottom: 0 }}>
            <label className="qb-label" htmlFor="qb-discount">
              Discount{' '}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
            </label>
            <div className="qb-discount-row">
              <div className="qb-segment" role="group" aria-label="Discount type">
                <button
                  className={`qb-segment-btn${form.discountType === 'flat' ? ' active' : ''}`}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, discountType: 'flat' }))}
                  aria-pressed={form.discountType === 'flat'}
                >
                  ₹
                </button>
                <button
                  className={`qb-segment-btn${form.discountType === 'percent' ? ' active' : ''}`}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, discountType: 'percent' }))}
                  aria-pressed={form.discountType === 'percent'}
                >
                  %
                </button>
              </div>
              <input
                id="qb-discount"
                className="qb-input qb-discount-input"
                type="number"
                inputMode="decimal"
                min="0"
                placeholder={form.discountType === 'percent' ? 'e.g. 10' : 'e.g. 50'}
                value={form.discountValue}
                onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Final amount ────────────────────────────────────────────────── */}
      <div className="qb-section">
        <div className="qb-final-wrap">
          <div>
            <div className="qb-final-label">Final Amount</div>
            {discountAmount > 0 && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Subtotal ₹{fmt(subtotal)} − Discount ₹{fmt(discountAmount)}
              </div>
            )}
          </div>
          <div className="qb-final-amount">₹{fmt(finalAmount)}</div>
        </div>
      </div>

      {/* ── Sticky bottom action bar ──────────────────────────────────── */}
      <div className="qb-sticky-bar">
        {lastSale ? (
          <div className="qb-success-bar">
            <button
              id="qb-new-bill-btn"
              className="qb-new-bill-btn"
              type="button"
              onClick={handleNewBill}
            >
              ✓ Bill Saved — New Bill
            </button>
          </div>
        ) : (
          <button
            id="qb-bill-btn"
            className="qb-bill-btn"
            type="button"
            disabled={submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <span className="qb-btn-spinner" />
                Saving…
              </>
            ) : (
              <>
                <span className="wa-icon">💬</span>
                BILL &amp; SEND WHATSAPP
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
