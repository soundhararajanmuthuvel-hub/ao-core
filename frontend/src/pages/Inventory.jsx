import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { inventoryApi, productsApi, suppliersApi } from '../api';
import { useToast } from '../context/ToastContext';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Inventory({ defaultTab }) {
  const { toast } = useToast();
  const [tab, setTab] = useState(defaultTab || 'movements');
  const [movements, setMovements] = useState([]);
  const [report, setReport] = useState(null);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [adjust, setAdjust] = useState({ productId: '', quantity: 0, notes: '', supplierId: '', batchNumber: '', expiryDate: '' });
  const [repack, setRepack] = useState({ fromProductId: '', toProductId: '', fromQty: 0, toQty: 0, notes: '', supplierId: '' });
  const [mfg, setMfg] = useState({ inputId: '', inputQty: 0, outputId: '', outputQty: 0, notes: '', supplierId: '' });
  const [expandedProducts, setExpandedProducts] = useState({});

  const toggleExpand = (id) => {
    setExpandedProducts((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  useEffect(() => {
    productsApi.list({ limit: 200 }).then(({ data }) => setProducts(data.products));
    suppliersApi.list().then(({ data }) => setSuppliers(data.suppliers)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    if (tab === 'movements') {
      inventoryApi.movements({ page, limit: 20 }).then(({ data }) => {
        setMovements(data.movements);
        setPages(data.pages);
      }).finally(() => setLoading(false));
    } else if (tab === 'report') {
      inventoryApi.report().then(({ data }) => setReport(data)).finally(() => setLoading(false));
    } else setLoading(false);
  }, [tab, page]);

  const packagingSuppliers = suppliers.filter((s) => s.type === 'packaging' || s.type === 'general');
  const rawSuppliers = suppliers.filter((s) => s.type === 'raw_material' || s.type === 'general');

  const doAdjust = async () => {
    try {
      await inventoryApi.adjust(adjust);
      toast('Stock adjusted', 'success');
      setAdjust({ productId: '', quantity: 0, notes: '', supplierId: '', batchNumber: '', expiryDate: '' });
      setTab('movements');
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error');
    }
  };

  const doRepack = async () => {
    if (!repack.supplierId) return toast('Select a supplier for repack', 'warning');
    try {
      await inventoryApi.repack(repack);
      toast('Repack done', 'success');
      setRepack({ fromProductId: '', toProductId: '', fromQty: 0, toQty: 0, notes: '', supplierId: '' });
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error');
    }
  };

  const doMfg = async () => {
    if (!mfg.supplierId) return toast('Select a supplier for manufacturing', 'warning');
    try {
      await inventoryApi.manufacturing({
        inputs: [{ productId: mfg.inputId, qty: mfg.inputQty }],
        outputs: [{ productId: mfg.outputId, qty: mfg.outputQty }],
        notes: mfg.notes,
        supplierId: mfg.supplierId,
      });
      toast('Manufacturing done', 'success');
      setMfg({ inputId: '', inputQty: 0, outputId: '', outputQty: 0, notes: '', supplierId: '' });
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error');
    }
  };

  const ProductSelect = ({ value, onChange }) => (
    <select className="form-control" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select product</option>
      {products.map((p) => <option key={p._id} value={p._id}>{p.name} — stock: {p.stock} {p.unit}</option>)}
    </select>
  );

  const SupplierSelect = ({ value, onChange, list, label }) => (
    <div className="form-group">
      <label>{label || 'Supplier'} *</label>
      <select className="form-control" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select supplier</option>
        {list.map((s) => <option key={s._id} value={s._id}>{s.name} ({s.type})</option>)}
      </select>
      {list.length === 0 && (
        <p style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>
          <Link to="/suppliers">Add suppliers</Link> first
        </p>
      )}
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Inventory</h1>
          <p className="page-subtitle">Repack & manufacturing with supplier tracking</p>
        </div>
        <Link to="/suppliers" className="btn btn-secondary">Manage Suppliers</Link>
      </div>
      <div className="filters-bar">
        {['movements', 'report', 'adjust', 'repack', 'manufacturing'].map((t) => (
          <button key={t} type="button" className={`btn ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {loading ? <LoadingSpinner /> : (
        <>
          {tab === 'movements' && (
            <div className="card table-wrap">
              <table className="data-table movements-table">
                <thead><tr><th>Product</th><th>Type</th><th>Qty</th><th>Batch</th><th>Expiry</th><th>Supplier</th><th>Notes</th><th>Date</th></tr></thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m._id}>
                      <td>{m.product?.name}</td>
                      <td><span className="badge badge-success">{m.type}</span></td>
                      <td>{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                      <td>{m.batchNumber || '—'}</td>
                      <td>{m.expiryDate ? new Date(m.expiryDate).toLocaleDateString() : '—'}</td>
                      <td>{m.supplier?.name || '—'}</td>
                      <td>{m.notes}</td>
                      <td>{new Date(m.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} pages={pages} onPageChange={setPage} />
            </div>
          )}
          {tab === 'report' && report && (
            <div className="card">
              <p>Total inventory value: ₹{report.totalValue?.toLocaleString()}</p>
              <p>Low stock items: {report.lowStockCount}</p>
              <table className="data-table inventory-table">
                <thead><tr><th>Product</th><th>Stock</th><th>Supplier</th><th>Value</th></tr></thead>
                <tbody>
                  {report.products?.map((p) => {
                    const isExpanded = !!expandedProducts[p._id || p.id];
                    const hasPacks = p.packSizes && p.packSizes.length > 0;
                    return (
                      <React.Fragment key={p._id || p.id}>
                        <tr onClick={() => hasPacks && toggleExpand(p._id || p.id)} style={{ cursor: hasPacks ? 'pointer' : 'default' }}>
                          <td>
                            {hasPacks && (
                              <span style={{ marginRight: '0.5rem', display: 'inline-block', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                                ▶
                              </span>
                            )}
                            <strong>{p.name}</strong>
                            {hasPacks && <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>({p.packSizes.length} Pack Sizes Available)</span>}
                          </td>
                          <td>{p.stock} {p.unit}</td>
                          <td>{p.supplier || '—'}</td>
                          <td>₹{(p.stock * p.purchasePrice).toFixed(2)}</td>
                        </tr>
                        {hasPacks && isExpanded && (
                          <tr>
                            <td colSpan="4" style={{ paddingLeft: '2.5rem', background: '#f8fafc' }}>
                              <div style={{ padding: '0.5rem 0' }}>
                                <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.85rem', color: '#ff9800', fontWeight: 600 }}>Available Pack Sizes Inventory</h5>
                                <table style={{ width: '100%', maxWidth: '700px', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                                  <thead>
                                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                                      <th style={{ padding: '0.25rem 0' }}>Pack Size Name</th>
                                      <th>Weight (g)</th>
                                      <th>Physical Stock</th>
                                      <th>Selling Price</th>
                                      <th>MRP</th>
                                      <th>Packaging Cost</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {p.packSizes.map((ps) => (
                                      <tr key={ps.id || ps._id} style={{ borderBottom: '1px dashed #e2e8f0' }}>
                                        <td style={{ padding: '0.4rem 0' }}><strong>{ps.packName}</strong></td>
                                        <td>{ps.weightInGrams}g</td>
                                        <td><span className="badge badge-success" style={{ backgroundColor: '#22c55e', color: '#fff' }}>{ps.stock} packs</span></td>
                                        <td>₹{ps.sellingPrice}</td>
                                        <td>₹{ps.mrp}</td>
                                        <td>₹{ps.packagingCost}</td>
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
                  })}
                </tbody>
              </table>
            </div>
          )}
          {tab === 'adjust' && (
            <div className="card" style={{ maxWidth: 420 }}>
              <div className="form-group"><label>Product</label><ProductSelect value={adjust.productId} onChange={(v) => setAdjust({ ...adjust, productId: v })} /></div>
              <div className="form-group"><label>Quantity (+/-)</label><input type="number" className="form-control" value={adjust.quantity} onChange={(e) => setAdjust({ ...adjust, quantity: Number(e.target.value) })} /></div>
              <SupplierSelect value={adjust.supplierId} onChange={(v) => setAdjust({ ...adjust, supplierId: v })} list={suppliers} label="Supplier (optional)" />
              <div className="form-group"><label>Batch Number (Optional)</label><input className="form-control" value={adjust.batchNumber || ''} onChange={(e) => setAdjust({ ...adjust, batchNumber: e.target.value })} placeholder="e.g. BATCH-001" /></div>
              <div className="form-group"><label>Expiry Date (Optional)</label><input type="date" className="form-control" value={adjust.expiryDate || ''} onChange={(e) => setAdjust({ ...adjust, expiryDate: e.target.value })} /></div>
              <div className="form-group"><label>Notes</label><input className="form-control" value={adjust.notes} onChange={(e) => setAdjust({ ...adjust, notes: e.target.value })} /></div>
              <button type="button" className="btn btn-primary" onClick={doAdjust}>Apply</button>
            </div>
          )}
          {tab === 'repack' && (
            <div className="card" style={{ maxWidth: 520 }}>
              <h3 style={{ marginBottom: '1rem' }}>Repack products</h3>
              <p className="page-subtitle" style={{ marginBottom: '1rem' }}>Convert bulk stock into retail packs (e.g. 25kg → 1kg packs)</p>
              <SupplierSelect value={repack.supplierId} onChange={(v) => setRepack({ ...repack, supplierId: v })} list={packagingSuppliers} label="Packaging supplier" />
              <div className="form-group"><label>From product (bulk)</label><ProductSelect value={repack.fromProductId} onChange={(v) => setRepack({ ...repack, fromProductId: v })} /></div>
              <div className="form-group"><label>From quantity</label><input type="number" className="form-control" value={repack.fromQty} onChange={(e) => setRepack({ ...repack, fromQty: Number(e.target.value) })} /></div>
              <div className="form-group"><label>To product (pack)</label><ProductSelect value={repack.toProductId} onChange={(v) => setRepack({ ...repack, toProductId: v })} /></div>
              <div className="form-group"><label>To quantity (packs created)</label><input type="number" className="form-control" value={repack.toQty} onChange={(e) => setRepack({ ...repack, toQty: Number(e.target.value) })} /></div>
              <div className="form-group"><label>Notes</label><input className="form-control" value={repack.notes} onChange={(e) => setRepack({ ...repack, notes: e.target.value })} placeholder="e.g. Repacked 25kg rice into 1kg bags" /></div>
              <button type="button" className="btn btn-primary" onClick={doRepack}>Complete Repack</button>
            </div>
          )}
          {tab === 'manufacturing' && (
            <div className="card" style={{ maxWidth: 520 }}>
              <h3 style={{ marginBottom: '1rem' }}>Manufacturing</h3>
              <p className="page-subtitle" style={{ marginBottom: '1rem' }}>Use raw materials from supplier to produce finished goods</p>
              <SupplierSelect value={mfg.supplierId} onChange={(v) => setMfg({ ...mfg, supplierId: v })} list={rawSuppliers} label="Raw material supplier" />
              <div className="form-group"><label>Raw material</label><ProductSelect value={mfg.inputId} onChange={(v) => setMfg({ ...mfg, inputId: v })} /></div>
              <div className="form-group"><label>Quantity used</label><input type="number" className="form-control" value={mfg.inputQty} onChange={(e) => setMfg({ ...mfg, inputQty: Number(e.target.value) })} /></div>
              <div className="form-group"><label>Finished product</label><ProductSelect value={mfg.outputId} onChange={(v) => setMfg({ ...mfg, outputId: v })} /></div>
              <div className="form-group"><label>Quantity produced</label><input type="number" className="form-control" value={mfg.outputQty} onChange={(e) => setMfg({ ...mfg, outputQty: Number(e.target.value) })} /></div>
              <div className="form-group"><label>Notes</label><input className="form-control" value={mfg.notes} onChange={(e) => setMfg({ ...mfg, notes: e.target.value })} placeholder="e.g. Organic honey processing batch #12" /></div>
              <button type="button" className="btn btn-primary" onClick={doMfg}>Complete Manufacturing</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
