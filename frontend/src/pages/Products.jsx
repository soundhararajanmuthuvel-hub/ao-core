import { useEffect, useState } from 'react';
import { productsApi, suppliersApi, integrationsApi } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import { resolveAssetUrl } from '../utils/url';

const PRODUCT_TYPE_LABELS = {
  RAW_MATERIAL: 'Raw Material',
  BULK_PRODUCT: 'Bulk Product (Powder)',
  RETAIL_PACK: 'Retail Pack Size',
  LABEL_PACK: 'Label Pack Size',
  manufactured: 'Manufactured Product (Legacy)',
  repacking: 'Repacking Product (Legacy)',
  trading: 'Trading Product (Legacy)',
  raw_material: 'Raw Material (Legacy)',
  packaging_material: 'Packaging Material (Legacy)'
};

const getProductTypeStyle = (type) => {
  switch (type) {
    case 'RAW_MATERIAL':
      return { backgroundColor: '#f1f5f9', color: '#475569', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' };
    case 'BULK_PRODUCT':
      return { backgroundColor: '#dcfce7', color: '#15803d', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' };
    case 'RETAIL_PACK':
      return { backgroundColor: '#e0f2fe', color: '#0369a1', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' };
    case 'LABEL_PACK':
      return { backgroundColor: '#fef3c7', color: '#d97706', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' };
    default:
      return { backgroundColor: '#e2e8f0', color: '#64748b', padding: '0.25rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600, display: 'inline-block' };
  }
};

const empty = { name: '', sku: '', barcode: '', category: 'General', stock: 0, lowStockThreshold: 10, reorderQty: 100, preferredSupplierId: '', unit: 'pcs', purchasePrice: 0, sellingPrice: 0, gstPercent: 0, supplier: '', productType: 'BULK_PRODUCT', parentProductId: '', packSize: '', conversionFactor: 1.0000 };

export default function Products() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [image, setImage] = useState(null);
  const [packViewMode, setPackViewMode] = useState('card'); // 'card' or 'list'
  const [subFormActive, setSubFormActive] = useState(false);
  const [subFormIndex, setSubFormIndex] = useState(null);
  const [subFormState, setSubFormState] = useState({
    packName: '',
    weightInGrams: 0,
    unit: 'g',
    sellingPrice: 0,
    mrp: 0,
    barcode: '',
    sku: '',
    status: 'Active',
    packagingCost: 0
  });

  const [suppliers, setSuppliers] = useState([]);
  const [refreshingProductId, setRefreshingProductId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const [activeTab, setActiveTab] = useState('active'); // 'active' or 'archived'
  const [deleteModal, setDeleteModal] = useState(null);
  const [dependencyReport, setDependencyReport] = useState(null);
  const [deleteMode, setDeleteMode] = useState('erp_only');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showDependencyDetails, setShowDependencyDetails] = useState(false);

  const handleForceRefresh = async (productId) => {
    setRefreshingProductId(productId);
    try {
      const { data } = await integrationsApi.forceRefreshWooProduct(productId);
      if (data.success && data.product) {
        toast('✓ Product refreshed successfully from WooCommerce', 'success');
        setForm(prev => ({
          ...prev,
          ...data.product,
          preferredSupplierId: data.product.preferredSupplierId || '',
          packSizes: data.product.packSizes || []
        }));
        load();
      } else {
        toast(data.message || 'Failed to refresh product', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Error refreshing product', 'error');
    } finally {
      setRefreshingProductId(null);
    }
  };

  const handleSyncAllProducts = async () => {
    setSyncingAll(true);
    try {
      const { data } = await integrationsApi.importProducts();
      if (data.success) {
        toast(data.message || '✓ Synced all products successfully', 'success');
        setPage(1);
        load();
      } else {
        toast(data.message || 'Failed to sync products', 'error');
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Sync failed', 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await productsApi.list({ page, search, category, limit: 10, showArchived: activeTab === 'archived' });
      setProducts(data.products);
      setPages(data.pages);
      
      const { data: supData } = await suppliersApi.list({ limit: 200 });
      setSuppliers(supData.suppliers || []);

      const { data: allProdData } = await productsApi.list({ limit: 1000 });
      setAllProducts(allProdData.products || []);
    } catch {
      toast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, search, category, activeTab]);
  useEffect(() => { productsApi.categories().then(({ data }) => setCategories(data.categories)); suppliersApi.list({ limit: 200 }).then(({ data }) => setSuppliers(data.suppliers || [])); }, []);

  const openModal = (p = null) => {
    setForm(p ? { 
      ...empty, 
      ...p, 
      productType: p.productType || 'BULK_PRODUCT', 
      purchasePrice: p.purchasePrice, 
      sellingPrice: p.sellingPrice, 
      reorderQty: p.reorderQty ?? 100,
      preferredSupplierId: p.preferredSupplierId || '',
      parentProductId: p.parentProductId || '',
      packSize: p.packSize || '',
      conversionFactor: p.conversionFactor ?? 1.0000,
      packSizes: p.packSizes || [] 
    } : { ...empty, productType: 'BULK_PRODUCT', packSizes: [] });
    setImage(null);
    setPackViewMode('card');
    setSubFormActive(false);
    setSubFormIndex(null);
    setModal(p ? 'edit' : 'create');
  };

  const startAddPackSize = () => {
    setSubFormIndex(null);
    setSubFormState({
      packName: '',
      weightInGrams: 0,
      unit: 'g',
      sellingPrice: 0,
      mrp: 0,
      barcode: '',
      sku: '',
      status: 'Active',
      packagingCost: 0
    });
    setSubFormActive(true);
  };

  const startEditPackSize = (idx) => {
    setSubFormIndex(idx);
    const ps = form.packSizes[idx];
    setSubFormState({
      packName: ps.packName || '',
      weightInGrams: Number(ps.weightInGrams) || 0,
      unit: ps.unit || 'g',
      sellingPrice: Number(ps.sellingPrice) || 0,
      mrp: Number(ps.mrp) || 0,
      barcode: ps.barcode || '',
      sku: ps.sku || '',
      status: ps.status || 'Active',
      packagingCost: Number(ps.packagingCost) || 0
    });
    setSubFormActive(true);
  };

  const savePackSizeSubForm = () => {
    if (!subFormState.packName || !subFormState.weightInGrams || subFormState.sellingPrice === undefined) {
      toast('Please fill Name, Weight, and Selling Price', 'warning');
      return;
    }
    const updatedPacks = [...(form.packSizes || [])];
    if (subFormIndex === null) {
      updatedPacks.push(subFormState);
    } else {
      updatedPacks[subFormIndex] = subFormState;
    }
    setForm({ ...form, packSizes: updatedPacks });
    setSubFormActive(false);
    setSubFormIndex(null);
  };

  const deletePackSize = (idx) => {
    if (!confirm('Are you sure you want to delete this pack size?')) return;
    const updatedPacks = (form.packSizes || []).filter((_, i) => i !== idx);
    setForm({ ...form, packSizes: updatedPacks });
  };

  const save = async () => {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { 
      if (k !== '_id' && k !== 'image' && k !== '__v' && k !== 'packSizes') {
        fd.append(k, v); 
      }
    });
    fd.append('packSizes', JSON.stringify(form.packSizes || []));
    if (image) fd.append('image', image);
    try {
      if (modal === 'edit') await productsApi.update(form._id, fd);
      else await productsApi.create(fd);
      toast('Product saved', 'success');
      setModal(null);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Save failed', 'error');
    }
  };

  const triggerDelete = async (product) => {
    try {
      const { data } = await productsApi.dependencies(product._id || product.id);
      if (data.success) {
        setDeleteModal({
          product: data.product,
          dependencies: data.dependencies,
          wooSyncActive: data.wooSyncActive
        });
        setDeleteMode('erp_only');
        setShowDependencyDetails(false);
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to check product dependencies', 'error');
    }
  };

  const handleAdjustStockToZero = async () => {
    if (!deleteModal) return;
    const prodId = deleteModal.product.id;
    try {
      const { data } = await productsApi.adjustZero(prodId);
      if (data.success) {
        toast('Stock reduced to zero successfully', 'success');
        const { data: depData } = await productsApi.dependencies(prodId);
        if (depData.success) {
          setDeleteModal({
            product: depData.product,
            dependencies: depData.dependencies,
            wooSyncActive: depData.wooSyncActive
          });
        }
        load();
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to adjust stock to zero', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteModal) return;
    const prodId = deleteModal.product.id;
    setIsDeleting(true);
    try {
      const { data } = await productsApi.remove(prodId, deleteMode);
      if (data.success) {
        toast(data.message || 'Product archived successfully', 'success');
        setDeleteModal(null);
        load();
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Archive operation failed', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!deleteModal) return;
    const prodId = deleteModal.product.id;
    setIsDeleting(true);
    try {
      const { data } = await productsApi.removePermanent(prodId);
      if (data.success) {
        toast('Product permanently deleted successfully', 'success');
        setDeleteModal(null);
        load();
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Permanent deletion failed', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async (id) => {
    setIsRestoring(true);
    try {
      const { data } = await productsApi.restore(id);
      if (data.success) {
        toast(data.message || 'Product restored successfully', 'success');
        load();
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to restore product', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const triggerPermanentDelete = async (product) => {
    if (!confirm(`Are you sure you want to PERMANENTLY delete product "${product.name}"? This action is irreversible.`)) return;
    try {
      const { data } = await productsApi.removePermanent(product._id || product.id);
      if (data.success) {
        toast('Product permanently deleted', 'success');
        load();
      }
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData && errorData.dependencies) {
        setDependencyReport({
          product,
          message: errorData.message || 'Cannot permanently delete product due to active dependencies.',
          dependencies: errorData.dependencies
        });
      } else {
        toast(errorData?.message || 'Permanent deletion failed', 'error');
      }
    }
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><h1 className="page-title">Products</h1><p className="page-subtitle">Manage inventory items</p></div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleSyncAllProducts}
            disabled={syncingAll}
          >
            {syncingAll ? 'Syncing...' : '🔄 Sync All Products'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => openModal()}>+ Add Product</button>
        </div>
      </div>

      {/* Active vs Archived sub-tabs inside Products list */}
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #e2e8f0', marginBottom: '1.25rem', paddingBottom: '0.25rem' }}>
        <button
          type="button"
          onClick={() => { setActiveTab('active'); setPage(1); }}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'active' ? '#ff9800' : '#64748b',
            borderBottom: activeTab === 'active' ? '3px solid #ff9800' : '3px solid transparent',
            outline: 'none'
          }}
        >
          🟢 Active Products
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab('archived'); setPage(1); }}
          style={{
            background: 'none',
            border: 'none',
            padding: '0.5rem 1rem',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: 'pointer',
            color: activeTab === 'archived' ? '#ef4444' : '#64748b',
            borderBottom: activeTab === 'archived' ? '3px solid #ef4444' : '3px solid transparent',
            outline: 'none'
          }}
        >
          📂 Archived Products
        </button>
      </div>

      {products.some(p => !p.productType) && (
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', padding: '1rem 1.25rem', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.9rem', boxShadow: 'var(--shadow-sm)' }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <div>
            <strong>Database Records Warning:</strong> Some products are missing a valid Product Type. Please update them in the Product Master.
          </div>
        </div>
      )}
      <div className="filters-bar">
        <input className="form-control" style={{ maxWidth: 240 }} placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="form-control" style={{ maxWidth: 180 }} value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {loading ? <LoadingSpinner /> : (
        <div className="card table-wrap">
          <table className="data-table products-table">
            <thead>
              <tr><th>Image</th><th>Name</th><th>SKU</th><th>Category</th><th>Type</th><th>Stock</th><th>Price</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td>{p.image ? <img src={resolveAssetUrl(p.image)} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} /> : '—'}</td>
                  <td>
                    <div>
                      <strong>{p.name}</strong> {p.stock <= p.lowStockThreshold && <span className="badge badge-warning">Low</span>}
                    </div>
                    {p.productType === 'BULK_PRODUCT' && (
                      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px', paddingLeft: '8px', borderLeft: '2px solid #ff9800' }}>
                        <span style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Variants</span>
                        {allProducts.filter(v => String(v.parentProductId) === String(p._id || p.id)).map(v => (
                          <div key={v._id || v.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '1px' }}>
                            <span style={{ fontSize: '0.75rem' }}>📦 {v.packSize || v.name}</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.75rem' }}>Stock: {v.stock} {v.unit || 'pcs'}</span>
                          </div>
                        ))}
                        {allProducts.filter(v => String(v.parentProductId) === String(p._id || p.id)).length === 0 && (
                          <span style={{ fontStyle: 'italic', fontSize: '0.7rem', color: '#94a3b8' }}>No variants configured</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{p.sku}</td>
                  <td>{p.category}</td>
                  <td>
                    <span style={getProductTypeStyle(p.productType)}>
                      {PRODUCT_TYPE_LABELS[p.productType] || 'Manufactured Product'}
                    </span>
                  </td>
                  <td>{p.stock} {p.unit}</td>
                  <td>₹{p.sellingPrice}</td>
                  <td>
                    {activeTab === 'active' ? (
                      <>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openModal(p)}>Edit</button>{' '}
                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => triggerDelete(p)}>Del</button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="btn btn-success btn-sm" onClick={() => handleRestore(p._id || p.id)} disabled={isRestoring}>
                          {isRestoring ? 'Restoring...' : '🔄 Restore'}
                        </button>{' '}
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => triggerDelete(p)}>
                          🗑️ Permanent Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pages={pages} onPageChange={setPage} />
        </div>
      )}
      {modal && (
        <Modal title={modal === 'edit' ? 'Edit Product' : 'Add Product'} className="modal-lg" onClose={() => setModal(null)} footer={<><button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={save}>Save</button></>}>
          <div className="form-row">
            {/* WooCommerce Integration Info Card */}
            {(form.woocommerce_product_id || form.wooProductId) ? (
              <div style={{
                gridColumn: 'span 2',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
                fontFamily: 'Inter, sans-serif'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <strong style={{ fontSize: '0.9rem', color: '#1e40af' }}>🔌 Source: WooCommerce</strong>
                    <span className="badge badge-success" style={{ fontSize: '0.75rem', backgroundColor: '#10b981', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>Synced</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#1e3a8a', marginTop: '0.25rem', display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
                    <span>WooCommerce Product ID: <strong>{form.woocommerce_product_id || form.wooProductId}</strong></span>
                    <span>Last Sync: <strong>{form.lastSyncTimestamp ? new Date(form.lastSyncTimestamp).toLocaleString() : 'N/A'}</strong></span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleForceRefresh(form._id || form.id)}
                  disabled={refreshingProductId === (form._id || form.id)}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {refreshingProductId === (form._id || form.id) ? 'Refreshing...' : '🔄 Force Refresh Product'}
                </button>
              </div>
            ) : (
              <div style={{
                gridColumn: 'span 2',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem',
                width: '100%',
                fontFamily: 'Inter, sans-serif'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <strong style={{ fontSize: '0.9rem', color: '#475569' }}>🏢 Source: Local ERP</strong>
                  <span className="badge badge-secondary" style={{ fontSize: '0.75rem', backgroundColor: '#64748b', color: '#fff', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>Local</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                  This product was created locally and is not linked to any WooCommerce product.
                </div>
              </div>
            )}

            {['name', 'sku', 'barcode', 'category', 'unit'].map((f) => (
              <div key={f} className="form-group"><label style={{ textTransform: 'capitalize' }}>{f}</label><input className="form-control" value={form[f] || ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} /></div>
            ))}
            <div className="form-group">
              <label>Supplier</label>
              <select
                className="form-control"
                value={form.supplier || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  let pType = form.productType;
                  if (val === 'repack') pType = 'repacking';
                  else if (val === 'AO Production') pType = 'manufactured';
                  setForm({ ...form, supplier: val, productType: pType });
                }}
              >
                <option value="">Select Supplier Type</option>
                <option value="AO Production">AO Production (Own Manufacturing)</option>
                <option value="repack">repack (Bulk Repacking)</option>
              </select>
            </div>
            <div className="form-group">
              <label>Product Type</label>
              <select
                className="form-control"
                value={form.productType || 'BULK_PRODUCT'}
                onChange={(e) => setForm({ ...form, productType: e.target.value })}
              >
                <option value="RAW_MATERIAL">Raw Material</option>
                <option value="BULK_PRODUCT">Bulk Product (Powder)</option>
                <option value="RETAIL_PACK">Retail Pack Size</option>
                <option value="LABEL_PACK">Label Pack Size</option>
                <option value="manufactured">Manufactured Product (Legacy)</option>
                <option value="repacking">Repacking Product (Legacy)</option>
                <option value="trading">Trading Product (Legacy)</option>
              </select>
            </div>
            {['RETAIL_PACK', 'LABEL_PACK'].includes(form.productType) && (
              <>
                <div className="form-group">
                  <label>Parent Bulk Product</label>
                  <select
                    className="form-control"
                    value={form.parentProductId || ''}
                    onChange={(e) => setForm({ ...form, parentProductId: e.target.value ? Number(e.target.value) : '' })}
                  >
                    <option value="">Select Parent Bulk Product</option>
                    {allProducts.filter(p => p.productType === 'BULK_PRODUCT').map(p => (
                      <option key={p._id || p.id} value={p._id || p.id}>{p.name} (SKU: {p.sku})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Pack Size (e.g. 200g, 1kg)</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 200g"
                    value={form.packSize || ''}
                    onChange={(e) => setForm({ ...form, packSize: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Conversion Factor (Weight in Kg per pack, e.g. 0.200)</label>
                  <input
                    type="number"
                    step="0.0001"
                    className="form-control"
                    placeholder="e.g. 0.2"
                    value={form.conversionFactor ?? 1.0000}
                    onChange={(e) => setForm({ ...form, conversionFactor: Number(e.target.value) })}
                  />
                </div>
              </>
            )}
            <div className="form-group">
              <label>Current Stock</label>
              <input type="number" className="form-control" value={form.stock ?? 0} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Minimum Stock Level</label>
              <input type="number" className="form-control" value={form.lowStockThreshold ?? 10} onChange={(e) => setForm({ ...form, lowStockThreshold: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Reorder Quantity</label>
              <input type="number" className="form-control" value={form.reorderQty ?? 100} onChange={(e) => setForm({ ...form, reorderQty: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Preferred Supplier</label>
              <select
                className="form-control"
                value={form.preferredSupplierId || ''}
                onChange={(e) => setForm({ ...form, preferredSupplierId: e.target.value ? Number(e.target.value) : '' })}
              >
                <option value="">Select Preferred Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Purchase Price</label>
              <input
                type="number"
                className="form-control"
                value={form.purchasePrice ?? 0}
                disabled={['repack', 'ao production'].includes(form.supplier?.toLowerCase().trim())}
                placeholder={['repack', 'ao production'].includes(form.supplier?.toLowerCase().trim()) ? 'Auto-calculated' : ''}
                onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
              />
              {['repack', 'ao production'].includes(form.supplier?.toLowerCase().trim()) ? (
                <small style={{ color: '#ff9800', marginTop: '4px', display: 'block', fontSize: '0.75rem' }}>
                  ⚠️ Auto-calculated based on recipe BOM or repack formula costs.
                </small>
              ) : (
                <small style={{ color: '#64748b', marginTop: '4px', display: 'block', fontSize: '0.75rem' }}>
                  Note: Auto-calculated if own manufacturing recipe exists.
                </small>
              )}
            </div>
            <div className="form-group">
              <label>Selling Price</label>
              <input type="number" className="form-control" value={form.sellingPrice ?? 0} onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>GST Percent (%)</label>
              <input type="number" className="form-control" value={form.gstPercent ?? 0} onChange={(e) => setForm({ ...form, gstPercent: Number(e.target.value) })} />
            </div>
            <div className="form-group"><label>Image</label><input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} /></div>
            
            <div className="pack-size-section" style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem', marginTop: '1.25rem', width: '100%' }}>
              <div className="pack-size-header">
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  📦 Pack Size Configurations
                </h4>
                {!subFormActive && (
                  <div className="pack-size-view-toggle">
                    <button
                      type="button"
                      className={`pack-size-toggle-btn ${packViewMode === 'card' ? 'active' : ''}`}
                      onClick={() => setPackViewMode('card')}
                    >
                      🎴 Cards
                    </button>
                    <button
                      type="button"
                      className={`pack-size-toggle-btn ${packViewMode === 'list' ? 'active' : ''}`}
                      onClick={() => setPackViewMode('list')}
                    >
                      📋 List
                    </button>
                  </div>
                )}
              </div>

              {subFormActive ? (
                /* Inline Sub-form editor */
                <div className="pack-size-sub-form">
                  <h5 style={{ margin: '0 0 1rem 0', fontWeight: 700, fontSize: '0.9rem', color: 'var(--brand-primary)' }}>
                    {subFormIndex === null ? '➕ Add New Pack Size' : '✏️ Edit Pack Size'}
                  </h5>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Pack Name *</label>
                      <input
                        className="form-control form-control-sm"
                        placeholder="e.g. 200g Pack"
                        value={subFormState.packName}
                        onChange={(e) => setSubFormState({ ...subFormState, packName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Weight / Qty *</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        placeholder="e.g. 200"
                        value={subFormState.weightInGrams || ''}
                        onChange={(e) => setSubFormState({ ...subFormState, weightInGrams: Number(e.target.value) })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Unit *</label>
                      <select
                        className="form-control form-control-sm"
                        value={subFormState.unit}
                        onChange={(e) => setSubFormState({ ...subFormState, unit: e.target.value })}
                        required
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="litre">litre</option>
                        <option value="pcs">pcs</option>
                        <option value="box">box</option>
                        <option value="carton">carton</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>SKU</label>
                      <input
                        className="form-control form-control-sm"
                        placeholder="e.g. ABC200"
                        value={subFormState.sku}
                        onChange={(e) => setSubFormState({ ...subFormState, sku: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Status</label>
                      <select
                        className="form-control form-control-sm"
                        value={subFormState.status}
                        onChange={(e) => setSubFormState({ ...subFormState, status: e.target.value })}
                      >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Selling Price (₹) *</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={subFormState.sellingPrice || ''}
                        onChange={(e) => setSubFormState({ ...subFormState, sellingPrice: Number(e.target.value) })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>MRP (₹)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={subFormState.mrp || ''}
                        onChange={(e) => setSubFormState({ ...subFormState, mrp: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Barcode</label>
                      <input
                        className="form-control form-control-sm"
                        value={subFormState.barcode}
                        onChange={(e) => setSubFormState({ ...subFormState, barcode: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label style={{ fontSize: '0.75rem' }}>Pkg Cost (₹)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={subFormState.packagingCost || ''}
                        onChange={(e) => setSubFormState({ ...subFormState, packagingCost: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSubFormActive(false)}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-sm" style={{ backgroundColor: 'var(--brand-primary)', borderColor: 'var(--brand-primary)' }} onClick={savePackSizeSubForm}>Save Pack Size</button>
                  </div>
                </div>
              ) : (
                /* Card or List Display mode */
                <div>
                  {packViewMode === 'card' ? (
                    <div className="pack-size-grid">
                      {(form.packSizes || []).map((ps, idx) => (
                        <div className={`pack-size-card ${ps.status === 'Inactive' ? 'inactive' : ''}`} key={idx}>
                          <div className="pack-size-card-top">
                            <span className="pack-size-card-weight">📦 {ps.weightInGrams}{ps.unit || 'g'}</span>
                            <span className={`pack-size-card-status ${ps.status === 'Inactive' ? 'inactive' : 'active'}`}>
                              {ps.status || 'Active'}
                            </span>
                          </div>
                          <div className="pack-size-card-body">
                            <div className="pack-size-card-name">{ps.packName}</div>
                            {ps.sku && <div className="pack-size-card-sku">SKU: {ps.sku}</div>}
                            {ps.barcode && <div className="pack-size-card-barcode">BC: {ps.barcode}</div>}
                            <div className="pack-size-card-price-row">
                              <span className="pack-size-card-price">₹{ps.sellingPrice}</span>
                              {ps.mrp > 0 && <span className="pack-size-card-mrp">₹{ps.mrp}</span>}
                            </div>
                          </div>
                          <div className="pack-size-card-actions">
                            <button type="button" className="pack-size-card-btn edit" onClick={() => startEditPackSize(idx)}>✏️ Edit</button>
                            <button type="button" className="pack-size-card-btn delete" onClick={() => deletePackSize(idx)}>🗑️ Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="table-wrap" style={{ marginTop: '1rem' }}>
                      <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Pack Name</th>
                            <th>Weight</th>
                            <th>Unit</th>
                            <th>MRP</th>
                            <th>Selling Price</th>
                            <th>Status</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(form.packSizes || []).map((ps, idx) => (
                            <tr key={idx}>
                              <td>
                                <div><strong>{ps.packName}</strong></div>
                                {ps.sku && <div style={{ fontSize: '0.72rem', color: '#80868b', fontFamily: 'monospace' }}>SKU: {ps.sku}</div>}
                                {ps.barcode && <div style={{ fontSize: '0.72rem', color: '#80868b', fontFamily: 'monospace' }}>BC: {ps.barcode}</div>}
                              </td>
                              <td>{ps.weightInGrams}</td>
                              <td><span className="badge badge-secondary">{ps.unit || 'g'}</span></td>
                              <td>₹{ps.mrp || 0}</td>
                              <td>₹{ps.sellingPrice || 0}</td>
                              <td>
                                <span className={`badge ${ps.status === 'Inactive' ? 'badge-secondary' : 'badge-success'}`}>
                                  {ps.status || 'Active'}
                                </span>
                              </td>
                              <td>
                                <button type="button" className="btn btn-secondary btn-sm" onClick={() => startEditPackSize(idx)}>Edit</button>{' '}
                                <button type="button" className="btn btn-danger btn-sm" onClick={() => deletePackSize(idx)}>Delete</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {(form.packSizes || []).length === 0 && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem', background: 'var(--bg-page)', borderRadius: '12px', marginTop: '1rem' }}>
                      No custom pack sizes configured. Product will be sold in bulk base unit only.
                    </div>
                  )}

                  <button
                    type="button"
                    className="pack-size-add-btn"
                    onClick={startAddPackSize}
                  >
                    <span>➕ Add New Pack Size</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        </Modal>
      )}

      {/* Delete Modals */}
      {deleteModal && (() => {
        const product = deleteModal.product;
        const dependencies = deleteModal.dependencies;
        const totalStock = Number(product.totalStock ?? product.stock);
        const unit = product.unit || 'pcs';

        const invVal = Number(dependencies.invoiceItems || 0);
        const mfgVal = Number(dependencies.mfgRecipes || 0) + Number(dependencies.mfgEntries || 0);
        const repVal = Number(dependencies.repackRecipes || 0) + Number(dependencies.repackEntries || 0);
        const purVal = Number(dependencies.purchaseItems || 0);
        const shpVal = Number(dependencies.shipments || 0);

        const hasDependencies = invVal > 0 || mfgVal > 0 || repVal > 0 || purVal > 0 || shpVal > 0;

        if (hasDependencies) {
          // CASE 2: Has dependencies (deletion blocked)
          return (
            <Modal
              title="Cannot Delete Product"
              onClose={() => setDeleteModal(null)}
              footer={
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowDependencyDetails(!showDependencyDetails)}
                    style={{
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#fff',
                      borderRadius: '8px',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {showDependencyDetails ? 'Hide Details' : 'View Dependencies'}
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={confirmDelete} 
                    disabled={isDeleting}
                    style={{
                      background: 'var(--brand-primary)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '8px',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(245, 158, 11, 0.25)'
                    }}
                  >
                    {isDeleting ? 'Archiving...' : 'Archive Product'}
                  </button>
                </>
              }
            >
              <div style={{ fontFamily: 'Inter, sans-serif', color: '#f8fafc' }}>
                <div style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '0.85rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '1.25rem', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>❌</span>
                  <strong>Cannot delete product.</strong>
                </div>

                <p style={{ margin: '0 0 1.25rem 0', fontSize: '0.95rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                  This product is already used in business transactions.
                </p>

                <div style={{ 
                  backgroundColor: 'rgba(15, 23, 42, 0.35)', 
                  padding: '1.25rem', 
                  borderRadius: '16px', 
                  border: '1px solid rgba(255, 255, 255, 0.08)', 
                  marginBottom: '1.25rem',
                  boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)'
                }}>
                  <h5 style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>Dependencies:</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.95rem', color: '#cbd5e1' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.4rem' }}>
                      <span>📄 Invoices</span>
                      <strong style={{ color: invVal > 0 ? '#ef4444' : '#64748b' }}>{invVal}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.4rem' }}>
                      <span>🌾 Manufacturing</span>
                      <strong style={{ color: mfgVal > 0 ? '#ef4444' : '#64748b' }}>{mfgVal}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.4rem' }}>
                      <span>📦 Repacking</span>
                      <strong style={{ color: repVal > 0 ? '#ef4444' : '#64748b' }}>{repVal}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '0.4rem' }}>
                      <span>🛒 Purchases</span>
                      <strong style={{ color: purVal > 0 ? '#ef4444' : '#64748b' }}>{purVal}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.1rem' }}>
                      <span>🚚 Shipments</span>
                      <strong style={{ color: shpVal > 0 ? '#ef4444' : '#64748b' }}>{shpVal}</strong>
                    </div>
                  </div>
                </div>

                {showDependencyDetails && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    {[
                      { label: 'Mfg Recipes', val: dependencies.mfgRecipes },
                      { label: 'Repack Recipes', val: dependencies.repackRecipes },
                      { label: 'Sales Invoices', val: dependencies.invoiceItems },
                      { label: 'Purchase Entries', val: dependencies.purchaseItems },
                      { label: 'Stock Movements', val: dependencies.stockMovements },
                      { label: 'Production Runs', val: dependencies.mfgEntries + dependencies.repackEntries },
                      { label: 'Shipments', val: dependencies.shipments },
                      { label: 'WooCommerce Links', val: dependencies.wooLinks }
                    ].map((d, i) => (
                      <div 
                        key={i} 
                        style={{ 
                          padding: '0.85rem 0.5rem', 
                          border: '1px solid rgba(255, 255, 255, 0.06)', 
                          borderRadius: '12px', 
                          backgroundColor: 'rgba(30, 41, 59, 0.45)', 
                          textAlign: 'center',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          minHeight: '75px'
                        }}
                      >
                        <span style={{ fontSize: '0.625rem', color: '#94a3b8', display: 'block', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{d.label}</span>
                        <strong style={{ fontSize: '1.25rem', color: d.val > 0 ? '#f43f5e' : '#cbd5e1', display: 'block' }}>{d.val}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {product.isLinkedToWoo && (
                  <div style={{ marginBottom: '1rem', padding: '1.25rem', backgroundColor: 'rgba(59, 130, 246, 0.08)', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                    <strong style={{ fontSize: '0.875rem', color: '#60a5fa', display: 'block', marginBottom: '0.75rem', fontWeight: 700 }}>
                      🔌 WooCommerce Integration Options
                    </strong>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#cbd5e1' }}>
                        <input
                          type="radio"
                          name="deleteMode"
                          value="erp_only"
                          checked={deleteMode === 'erp_only'}
                          onChange={(e) => setDeleteMode(e.target.value)}
                        />
                        Archive in ERP Only
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#cbd5e1' }}>
                        <input
                          type="radio"
                          name="deleteMode"
                          value="woo_and_erp"
                          checked={deleteMode === 'woo_and_erp'}
                          disabled={!deleteModal.wooSyncActive}
                          onChange={(e) => setDeleteMode(e.target.value)}
                        />
                        Archive in ERP & move WooCommerce product to Draft
                        {!deleteModal.wooSyncActive && <span style={{ fontSize: '0.75rem', color: '#64748b' }}> (Sync Inactive)</span>}
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: '#cbd5e1' }}>
                        <input
                          type="radio"
                          name="deleteMode"
                          value="unlink"
                          checked={deleteMode === 'unlink'}
                          onChange={(e) => setDeleteMode(e.target.value)}
                        />
                        Unlink WooCommerce Mapping (no archive)
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </Modal>
          );
        }

        // CASE 1: No dependencies (permanent deletion allowed)
        return (
          <Modal
            title="Delete Product?"
            onClose={() => setDeleteModal(null)}
            footer={
              <>
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteModal(null)}>Cancel</button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={confirmPermanentDelete}
                  disabled={isDeleting}
                  style={{
                    background: '#ef4444',
                    border: 'none',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </>
            }
          >
            <div style={{ fontFamily: 'Inter, sans-serif', color: '#cbd5e1' }}>
              <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.35)', padding: '1.25rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '1.25rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '0.75rem', fontSize: '0.95rem' }}>
                  <span style={{ color: '#94a3b8' }}>Product:</span>
                  <strong style={{ color: '#f8fafc' }}>{product.name}</strong>

                  <span style={{ color: '#94a3b8' }}>SKU:</span>
                  <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>{product.sku}</strong>

                  <span style={{ color: '#94a3b8' }}>Current Stock:</span>
                  <strong style={{ color: '#f8fafc' }}>{totalStock} {unit}</strong>

                  <span style={{ color: '#94a3b8' }}>Dependencies:</span>
                  <strong style={{ color: '#10b981' }}>None Found</strong>
                </div>

                <div style={{ color: '#10b981', fontWeight: 600, fontSize: '0.9rem', marginTop: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '1rem' }}>
                  <span style={{ fontSize: '1.1rem' }}>✓</span> This product can be permanently deleted.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.08)', padding: '1rem 1.25rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', fontSize: '0.875rem', lineHeight: 1.5 }}>
                <span style={{ fontSize: '1.2rem', marginTop: '-2px' }}>⚠️</span>
                <div>
                  <strong>Warning:</strong> This action will permanently remove the product. All associated inventory balance, stock records, WooCommerce mapping, and product settings will be deleted irreversibly.
                </div>
              </div>
            </div>
          </Modal>
        );
      })()}
    </div>
  );
}
