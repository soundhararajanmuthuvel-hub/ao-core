import { useEffect, useMemo, useState } from 'react';
import { purchasesApi, productsApi, suppliersApi, settingsApi } from '../api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { calculatePurchasePreview, getCompanyStateFromGstin, getStateCodeByName } from '../utils/gst';

const fmt = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

export default function Purchases() {
  const { toast } = useToast();
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [items, setItems] = useState([]);
  const [companyStateCode, setCompanyStateCode] = useState('');
  const [companyStateName, setCompanyStateName] = useState('');
  
  // New Suggestions and PO fields
  const [activeTab, setActiveTab] = useState('history');
  const [suggestions, setSuggestions] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [notes, setNotes] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [purchaseRes, productRes, supplierRes, settingsRes, suggestionsRes] = await Promise.all([
        purchasesApi.list(),
        productsApi.list({ limit: 200 }),
        suppliersApi.list({ includeInactive: true }),
        settingsApi.get(),
        purchasesApi.suggestions(),
      ]);

      setPurchases(purchaseRes.data.purchases || []);
      setProducts(productRes.data.products || []);
      setSuppliers(supplierRes.data.suppliers || []);
      setSuggestions(suggestionsRes.data.suggestions || []);

      const companyState = getCompanyStateFromGstin(settingsRes.data?.settings?.gstDetails || '');
      setCompanyStateCode(companyState.stateCode || '');
      setCompanyStateName(companyState.stateName || '');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to load purchase data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => String(supplier.id || supplier._id) === String(supplierId)) || null,
    [suppliers, supplierId]
  );

  const supplierStateCode = useMemo(() => {
    if (!selectedSupplier) return '';
    return selectedSupplier.stateCode || getStateCodeByName(selectedSupplier.state || '');
  }, [selectedSupplier]);

  const purchasePreview = useMemo(
    () =>
      calculatePurchasePreview({
        items,
        supplierStateCode,
        companyStateCode,
        supplierGstType: selectedSupplier?.gstRegistrationType || '',
      }),
    [items, supplierStateCode, companyStateCode, selectedSupplier]
  );

  const addItem = (productId) => {
    const product = products.find((p) => String(p._id || p.id) === String(productId));
    if (!product) return;

    setItems((current) => [
      ...current,
      {
        product: product._id || product.id,
        name: product.name,
        qty: 1,
        unitPrice: Number(product.purchasePrice || 0),
        gstPercent: Number(product.gstPercent || 0),
      },
    ]);
  };

  const updateItem = (index, field, value) => {
    setItems((current) => {
      const next = [...current];
      next[index] = {
        ...next[index],
        [field]: field === 'name' ? value : Number.isNaN(Number(value)) ? value : Number(value),
      };
      return next;
    });
  };

  const removeItem = (index) => {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const submit = async () => {
    if (!supplierId) {
      toast('Select a supplier first', 'warning');
      return;
    }
    if (!items.length) {
      toast('Add at least one purchase item', 'warning');
      return;
    }

    try {
      await purchasesApi.create({
        supplierId,
        supplier: selectedSupplier?.name || '',
        dueDate: dueDate || undefined,
        invoiceNumber: invoiceNumber || '',
        invoiceDate: invoiceDate || undefined,
        notes: notes || '',
        items: items.map(({ product, qty, unitPrice, gstPercent }) => ({
          product,
          qty,
          unitPrice,
          gstPercent,
        })),
      });
      toast('Purchase recorded', 'success');
      setShowForm(false);
      setSupplierId('');
      setItems([]);
      setDueDate('');
      setInvoiceNumber('');
      setInvoiceDate('');
      setNotes('');
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save purchase', 'error');
    }
  };

  // Handlers for suggestions
  const handleCreateSinglePO = (item) => {
    setSupplierId(String(item.supplierId));
    setItems([
      {
        product: item.itemId,
        name: item.name,
        qty: item.reorderQty,
        unitPrice: item.purchasePrice,
        gstPercent: item.gstPercent,
      }
    ]);
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setDueDate(sevenDays);
    setShowForm(true);
    setActiveTab('history');
  };

  const handleConsolidatePO = (group) => {
    setSupplierId(String(group.supplierId));
    setItems(
      group.items.map((item) => ({
        product: item.itemId,
        name: item.name,
        qty: item.reorderQty,
        unitPrice: item.purchasePrice,
        gstPercent: item.gstPercent,
      }))
    );
    const sevenDays = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    setDueDate(sevenDays);
    setShowForm(true);
    setActiveTab('history');
  };

  const sendWhatsAppInquiry = (item) => {
    const text = `Hello Supplier,

We need:

Product: ${item.name}
Quantity: ${item.reorderQty} ${item.unit}

Please share today's rate and availability.

AO Core ERP`;
    const encodedText = encodeURIComponent(text);
    const phone = String(item.supplierPhone || '').replace(/\D/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
    window.open(url, '_blank');
  };

  const handleConsolidateInquiry = (group) => {
    let itemsText = '';
    group.items.forEach((item) => {
      itemsText += `Product: ${item.name}\nQuantity: ${item.reorderQty} ${item.unit}\n\n`;
    });
    const text = `Hello Supplier,

We need:

${itemsText}Please share today's rate and availability.

AO Core ERP`;
    const encodedText = encodeURIComponent(text);
    const firstItem = group.items[0];
    const phone = String(firstItem?.supplierPhone || '').replace(/\D/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${encodedText}` : `https://wa.me/?text=${encodedText}`;
    window.open(url, '_blank');
  };

  const handleIgnore = async (key) => {
    try {
      await purchasesApi.ignoreSuggestion(key);
      toast('Suggestion ignored', 'success');
      load();
    } catch {
      toast('Failed to ignore suggestion', 'error');
    }
  };

  const groupedSuggestions = useMemo(() => {
    const groups = {};
    suggestions.forEach((item) => {
      const sName = item.supplierName || 'No Supplier Assigned';
      if (!groups[sName]) {
        groups[sName] = {
          supplierName: sName,
          supplierId: item.supplierId,
          items: [],
          totalEstimatedValue: 0,
        };
      }
      groups[sName].items.push(item);
      groups[sName].totalEstimatedValue += Number(item.estimatedValue || 0);
    });
    return Object.values(groups);
  }, [suggestions]);

  return (
    <div className="page" style={{ padding: '1.5rem' }}>
      <div className="page-header" style={{ marginBottom: '1rem' }}>
        <div>
          <h1 className="page-title">Purchases</h1>
          <p className="page-subtitle" style={{ margin: '0.25rem 0 0 0', color: '#64748b' }}>
            Create purchase orders with supplier GST data and tax calculations.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm((prev) => !prev)}>
          + New Purchase
        </button>
      </div>

      {showForm && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr', gap: '1rem', marginBottom: '1rem' }}>
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="form-group">
              <label>Select Supplier</label>
              <select
                className="form-control"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">Choose supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id || supplier._id} value={supplier.id || supplier._id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </div>

            {selectedSupplier && (
              <div
                style={{
                  border: '1px solid #dbeafe',
                  background: '#eff6ff',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 800, color: '#2563eb' }}>
                  Supplier GST Snapshot
                </div>
                <div style={{ marginTop: '0.35rem', fontWeight: 800, color: '#0f172a' }}>{selectedSupplier.name}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>GST Number</div>
                    <div style={{ fontWeight: 700 }}>{selectedSupplier.gstNumber || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>State</div>
                    <div style={{ fontWeight: 700 }}>{selectedSupplier.state || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>GST Type</div>
                    <div style={{ fontWeight: 700 }}>{selectedSupplier.gstRegistrationType || '—'}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>State Code</div>
                    <div style={{ fontWeight: 700 }}>{selectedSupplier.stateCode || '—'}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="form-group">
              <label>Add Product</label>
              <select
                className="form-control"
                onChange={(e) => {
                  addItem(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">Select product...</option>
                {products.map((product) => (
                  <option key={product._id || product.id} value={product._id || product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {items.map((item, index) => (
                <div
                  key={`${item.product}-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.5fr 0.5fr 0.8fr 0.7fr 0.3fr',
                    gap: '0.5rem',
                    alignItems: 'end',
                  }}
                >
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Product</label>
                    <input className="form-control" value={item.name} onChange={(e) => updateItem(index, 'name', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Qty</label>
                    <input
                      type="number"
                      className="form-control"
                      value={item.qty}
                      onChange={(e) => updateItem(index, 'qty', e.target.value)}
                      min="1"
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Unit Price</label>
                    <input
                      type="number"
                      className="form-control"
                      value={item.unitPrice}
                      onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>GST %</label>
                    <input
                      type="number"
                      className="form-control"
                      value={item.gstPercent}
                      onChange={(e) => updateItem(index, 'gstPercent', e.target.value)}
                    />
                  </div>
                  <div style={{ paddingBottom: '0.25rem' }}>
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(index)}>
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <div className="form-group">
                <label>Expected Delivery Date (Due Date)</label>
                <input type="date" className="form-control" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Invoice Number (Optional)</label>
                <input className="form-control" placeholder="e.g. INV-9988" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Invoice Date (Optional)</label>
                <input type="date" className="form-control" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Internal Notes</label>
                <input className="form-control" placeholder="Remarks..." value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" onClick={submit}>
                Save Purchase
              </button>
              <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                {items.length} item(s) selected
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem', alignSelf: 'start' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>GST Summary</h3>
            <p style={{ margin: '0.35rem 0 1rem 0', color: '#64748b', fontSize: '0.85rem' }}>
              {companyStateName
                ? `Company state: ${companyStateName}${companyStateCode ? ` (${companyStateCode})` : ''}`
                : 'Company GST is not configured'}
            </p>

            <div style={{ display: 'grid', gap: '0.75rem' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Subtotal</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>{fmt(purchasePreview.subtotal)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Tax Type</div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>{purchasePreview.taxType}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>CGST</div>
                  <div style={{ fontWeight: 800 }}>{fmt(purchasePreview.cgstAmount)}</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>SGST</div>
                  <div style={{ fontWeight: 800 }}>{fmt(purchasePreview.sgstAmount)}</div>
                </div>
                <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '0.75rem' }}>
                  <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>IGST</div>
                  <div style={{ fontWeight: 800 }}>{fmt(purchasePreview.igstAmount)}</div>
                </div>
              </div>
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Grand Total</div>
                <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#10b981' }}>{fmt(purchasePreview.grandTotal)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', gap: '0.5rem' }}>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => { setActiveTab('history'); }}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'history' ? '3px solid #ff9800' : '3px solid transparent',
            color: activeTab === 'history' ? '#ff9800' : '#64748b',
          }}
        >
          📋 Purchase History
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'suggestions' ? 'active' : ''}`}
          onClick={() => { setActiveTab('suggestions'); }}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: activeTab === 'suggestions' ? '3px solid #ff9800' : '3px solid transparent',
            color: activeTab === 'suggestions' ? '#ff9800' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem'
          }}
        >
          💡 Reorder Suggestions
          {suggestions.length > 0 && (
            <span style={{ backgroundColor: '#ef4444', color: '#fff', fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 700 }}>
              {suggestions.length}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {activeTab === 'history' && (
            <div className="card table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PO #</th>
                    <th>Supplier</th>
                    <th>GST Number</th>
                    <th>State</th>
                    <th>GST Type</th>
                    <th>Tax Type</th>
                    <th>Date</th>
                    <th>Subtotal</th>
                    <th>Tax</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={purchase.id || purchase._id}>
                      <td>{purchase.purchaseNumber}</td>
                      <td>{purchase.supplier || purchase.supplierRelation?.name || '—'}</td>
                      <td>{purchase.supplierGstNumber || purchase.supplierRelation?.gstNumber || '—'}</td>
                      <td>{purchase.supplierState || purchase.supplierRelation?.state || '—'}</td>
                      <td>{purchase.supplierGstType || purchase.supplierRelation?.gstRegistrationType || '—'}</td>
                      <td>{purchase.taxType || '—'}</td>
                      <td>{purchase.date ? new Date(purchase.date).toLocaleDateString() : '—'}</td>
                      <td>{fmt(purchase.subtotal)}</td>
                      <td>{fmt(purchase.taxTotal)}</td>
                      <td>{fmt(purchase.total)}</td>
                      <td>
                        <span className={`badge ${purchase.paymentStatus === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                          {purchase.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {purchases.length === 0 && (
                    <tr>
                      <td colSpan="11" style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                        No purchases found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'suggestions' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {groupedSuggestions.map((group) => (
                <div className="card" key={group.supplierName} style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                    <div>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#0f172a' }}>
                        🏢 Preferred Supplier: {group.supplierName}
                      </h3>
                      <p style={{ margin: '0.2rem 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>
                        Total Estimated Value: <strong>{fmt(group.totalEstimatedValue)}</strong> ({group.items.length} item(s) below minimum stock)
                      </p>
                    </div>
                    {group.supplierId && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleConsolidatePO(group)}
                          style={{ padding: '0.5rem 1rem', fontWeight: 700 }}
                        >
                          Consolidate PO
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleConsolidateInquiry(group)}
                          style={{ padding: '0.5rem 1rem', fontWeight: 700 }}
                        >
                          💬 Send WhatsApp Inquiry
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="table-wrap" style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: 0 }}>
                    <table className="data-table" style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Current Stock</th>
                          <th>Minimum Stock</th>
                          <th>Reorder Qty</th>
                          <th>Estimated Value</th>
                          <th>AI Suggestion</th>
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => (
                          <tr key={item.id}>
                            <td><strong>{item.name}</strong> <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>({item.sku})</span></td>
                            <td style={{ color: item.stock <= 0 ? '#ef4444' : '#f97316', fontWeight: 700 }}>
                              {item.stock} {item.unit}
                            </td>
                            <td>{item.minStock} {item.unit}</td>
                            <td style={{ fontWeight: 600 }}>{item.reorderQty} {item.unit}</td>
                            <td style={{ fontWeight: 700 }}>{fmt(item.estimatedValue)}</td>
                            <td style={{ fontSize: '0.85rem', color: '#475569', fontStyle: 'italic' }}>
                              <span style={{ display: 'inline-block', padding: '0.2rem 0.5rem', borderRadius: '6px', backgroundColor: '#f0fdf4', color: '#16a34a', border: '1px solid #dcfce7', fontWeight: 600 }}>
                                {item.aiSuggestion}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                                {item.supplierId && (
                                  <>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => handleCreateSinglePO(item)}
                                      style={{ padding: '0.25rem 0.5rem' }}
                                    >
                                      Create PO
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-sm"
                                      onClick={() => sendWhatsAppInquiry(item)}
                                      style={{ padding: '0.25rem 0.5rem' }}
                                    >
                                      Inquiry
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleIgnore(item.id)}
                                  style={{ padding: '0.25rem 0.5rem' }}
                                >
                                  Ignore
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {groupedSuggestions.length === 0 && (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
                  <span style={{ fontSize: '2.5rem' }}>🎉</span>
                  <h3 style={{ margin: '1rem 0 0.5rem 0', fontWeight: 700 }}>All Stock Levels Healthy!</h3>
                  <p style={{ margin: 0 }}>No items are currently below minimum stock levels.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
