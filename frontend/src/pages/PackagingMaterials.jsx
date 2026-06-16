import { useEffect, useState, useCallback } from 'react';
import { rawMaterialsApi, suppliersApi } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/rawmaterials.css';

const emptyMaterial = {
  name: '',
  materialCode: '',
  category: 'Packaging Materials',
  unit: 'Piece',
  minStock: 100,
  purchasePrice: 0,
  gstPercent: 18,
  supplierId: '',
  warehouse: '',
  status: 'Active',
};

const packagingCategories = [
  'Packaging Materials',
  'Labels',
  'Bottles',
  'Pouches',
  'Cartons',
  'Other Materials',
];

const units = ['Piece', 'Box', 'Kg', 'Gram', 'Liter'];

export default function PackagingMaterials() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('list');
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pagination / Filters
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Movements List
  const [movements, setMovements] = useState([]);
  const [movPage, setMovPage] = useState(1);
  const [movPages, setMovPages] = useState(1);
  const [selectedRmFilter, setSelectedRmFilter] = useState('');

  // Modals / Forms
  const [modalType, setModalType] = useState(null); // 'create', 'edit', 'purchase', 'adjust'
  const [form, setForm] = useState(emptyMaterial);

  const [purchaseForm, setPurchaseForm] = useState({
    rawMaterialId: '',
    quantity: '',
    price: '',
    supplierId: '',
    notes: '',
  });

  const [adjustForm, setAdjustForm] = useState({
    rawMaterialId: '',
    quantity: '',
    notes: '',
  });

  // Local calculations for dashboard cards based on filtered items
  const [metrics, setMetrics] = useState({
    totalItems: 0,
    lowStockItems: 0,
    totalValuation: 0,
    totalStockQty: 0,
  });

  // Load all materials from backend and filter by packaging categories
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch materials without category filtering first, so we can do local metrics
      const { data } = await rawMaterialsApi.list({
        page: 1,
        limit: 1000, // fetch all to do correct calculations and dropdown lists
      });

      const packagingItems = data.materials.filter((m) =>
        packagingCategories.includes(m.category)
      );

      // Perform calculations
      const totalItems = packagingItems.length;
      const lowStockItems = packagingItems.filter(
        (m) => Number(m.stock) <= Number(m.minStock)
      ).length;
      const totalValuation = packagingItems.reduce(
        (sum, m) => sum + Number(m.stock) * Number(m.purchasePrice),
        0
      );
      const totalStockQty = packagingItems.reduce(
        (sum, m) => sum + Number(m.stock),
        0
      );

      setMetrics({
        totalItems,
        lowStockItems,
        totalValuation,
        totalStockQty,
      });

      // Filter based on search & category filter for displaying in table
      let filteredItems = [...packagingItems];
      if (categoryFilter) {
        filteredItems = filteredItems.filter((m) => m.category === categoryFilter);
      }
      if (search) {
        const query = search.toLowerCase();
        filteredItems = filteredItems.filter(
          (m) =>
            m.name.toLowerCase().includes(query) ||
            m.materialCode.toLowerCase().includes(query)
        );
      }

      // Paginate locally
      const limit = 10;
      const totalCount = filteredItems.length;
      const totalPages = Math.ceil(totalCount / limit);
      const paginatedItems = filteredItems.slice((page - 1) * limit, page * limit);

      setMaterials(paginatedItems);
      setPages(totalPages || 1);

      // Load Suppliers
      const { data: supData } = await suppliersApi.list({ limit: 100 });
      setSuppliers(supData.suppliers);
    } catch (err) {
      toast('Failed to load packaging materials data', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, toast]);

  // Load movement logs and filter
  const loadMovements = useCallback(async () => {
    try {
      // Fetch all movements
      const { data } = await rawMaterialsApi.movements({
        page: 1,
        limit: 1000,
        rawMaterialId: selectedRmFilter,
      });

      // Filter for packaging categories
      const packagingMovements = data.movements.filter((mov) =>
        packagingCategories.includes(mov.rawMaterial?.category)
      );

      // Paginate locally
      const limit = 15;
      const totalCount = packagingMovements.length;
      const totalPages = Math.ceil(totalCount / limit);
      const paginatedMovs = packagingMovements.slice(
        (movPage - 1) * limit,
        movPage * limit
      );

      setMovements(paginatedMovs);
      setMovPages(totalPages || 1);
    } catch {
      toast('Failed to load movement logs', 'error');
    }
  }, [movPage, selectedRmFilter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === 'logs' || activeTab === 'valuation') {
      loadMovements();
    }
  }, [activeTab, loadMovements]);

  const openEdit = (material) => {
    setForm({ ...material });
    setModalType('edit');
  };

  const handleSave = async () => {
    try {
      if (modalType === 'edit') {
        await rawMaterialsApi.update(form.id || form._id, form);
        toast('Packaging material updated successfully', 'success');
      } else {
        await rawMaterialsApi.create(form);
        toast('Packaging material created successfully', 'success');
      }
      setModalType(null);
      setForm(emptyMaterial);
      loadData();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this packaging material?')) return;
    try {
      await rawMaterialsApi.remove(id);
      toast('Packaging material deleted successfully', 'success');
      loadData();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to delete', 'error');
    }
  };

  const handlePurchase = async () => {
    try {
      await rawMaterialsApi.purchase(purchaseForm);
      toast('Purchase entry recorded successfully', 'success');
      setModalType(null);
      setPurchaseForm({
        rawMaterialId: '',
        quantity: '',
        price: '',
        supplierId: '',
        notes: '',
      });
      loadData();
    } catch (err) {
      toast(err.response?.data?.message || 'Purchase failed', 'error');
    }
  };

  const handleAdjust = async () => {
    try {
      await rawMaterialsApi.adjust(adjustForm);
      toast('Stock adjusted successfully', 'success');
      setModalType(null);
      setAdjustForm({ rawMaterialId: '', quantity: '', notes: '' });
      loadData();
    } catch (err) {
      toast(err.response?.data?.message || 'Adjustment failed', 'error');
    }
  };

  return (
    <div className="page raw-materials-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Packaging Material Management</h1>
          <p className="page-subtitle">
            Track pouches, labels, bottles, cartons, stickers, and box inventory valuations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setModalType('purchase');
            }}
          >
            📥 Purchase Entry
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setModalType('adjust');
            }}
          >
            ⚙️ Stock Adjustment
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setForm(emptyMaterial);
              setModalType('create');
            }}
          >
            + Add Material
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="rm-dashboard-grid">
        <div className="rm-stat-card">
          <div className="rm-stat-icon">🏷️</div>
          <div className="rm-stat-info">
            <h3>Packaging Items</h3>
            <p>{metrics.totalItems}</p>
          </div>
        </div>
        <div className="rm-stat-card">
          <div className="rm-stat-icon" style={{ color: '#ef4444', background: '#fee2e2' }}>
            ⚠️
          </div>
          <div className="rm-stat-info">
            <h3>Low Stock Items</h3>
            <p>{metrics.lowStockItems}</p>
          </div>
        </div>
        <div className="rm-stat-card">
          <div className="rm-stat-icon" style={{ color: '#3b82f6', background: '#dbeafe' }}>
            📦
          </div>
          <div className="rm-stat-info">
            <h3>Total Stock Qty</h3>
            <p>{metrics.totalStockQty} pcs</p>
          </div>
        </div>
        <div className="rm-stat-card">
          <div className="rm-stat-icon" style={{ color: '#10b981', background: '#d1fae5' }}>
            💰
          </div>
          <div className="rm-stat-info">
            <h3>Packaging Value</h3>
            <p>
              ₹
              {Number(metrics.totalValuation || 0).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rm-tabs-bar">
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          Packaging List
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveTab('logs')}
        >
          Consumption & Move Logs
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${activeTab === 'valuation' ? 'active' : ''}`}
          onClick={() => setActiveTab('valuation')}
        >
          Valuation Reports
        </button>
      </div>

      {loading && activeTab === 'list' ? (
        <LoadingSpinner />
      ) : (
        <>
          {activeTab === 'list' && (
            <div className="card">
              <div
                className="filters-bar"
                style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}
              >
                <input
                  type="text"
                  className="form-control"
                  style={{ maxWidth: '300px' }}
                  placeholder="Search packaging or code..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
                <select
                  className="form-control"
                  style={{ maxWidth: '200px' }}
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Categories</option>
                  {packagingCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="table-wrap">
                <table className="data-table packaging-materials-table">
                  <thead>
                    <tr>
                      <th>Material Code</th>
                      <th>Material Name</th>
                      <th>Category</th>
                      <th>Unit</th>
                      <th>Current Stock</th>
                      <th>Min Stock</th>
                      <th>Unit Cost (Avg)</th>
                      <th>Supplier</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((m) => {
                      const isLow = Number(m.stock) <= Number(m.minStock);
                      return (
                        <tr key={m.id || m._id}>
                          <td>
                            <strong>{m.materialCode}</strong>
                          </td>
                          <td>{m.name}</td>
                          <td>{m.category}</td>
                          <td>{m.unit}</td>
                          <td>
                            <span
                              style={{ fontWeight: 600, color: isLow ? '#ef4444' : '#111827' }}
                            >
                              {m.stock} {isLow && '⚠️'}
                            </span>
                          </td>
                          <td>{m.minStock}</td>
                          <td>₹{Number(m.purchasePrice).toFixed(2)}</td>
                          <td>{m.supplier?.name || '-'}</td>
                          <td>
                            <span
                              className={`rm-badge ${
                                m.status === 'Active' ? 'rm-badge-active' : 'rm-badge-inactive'
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEdit(m)}
                            >
                              Edit
                            </button>{' '}
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(m.id || m._id)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {materials.length === 0 && (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', color: '#9ca3af' }}>
                          No packaging materials found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} pages={pages} onPageChange={setPage} />
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="card">
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Material</th>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>User</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((mov) => {
                      let badge = 'badge-success';
                      if (mov.type === 'consumption') badge = 'badge-danger';
                      if (mov.type === 'adjustment') badge = 'badge-warning';

                      return (
                        <tr key={mov.id || mov._id}>
                          <td>{new Date(mov.date || mov.createdAt).toLocaleString()}</td>
                          <td>
                            {mov.rawMaterial?.name} ({mov.rawMaterial?.materialCode})
                          </td>
                          <td>{mov.rawMaterial?.category}</td>
                          <td>
                            <span className={`badge ${badge}`}>
                              {mov.type.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}{' '}
                            {mov.rawMaterial?.unit}
                          </td>
                          <td>₹{Number(mov.price || 0).toFixed(2)}</td>
                          <td>{mov.createdBy?.name || 'System'}</td>
                          <td>{mov.notes || '-'}</td>
                        </tr>
                      );
                    })}
                    {movements.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', color: '#9ca3af' }}>
                          No packaging movement logs found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={movPage} pages={movPages} onPageChange={setMovPage} />
            </div>
          )}

          {activeTab === 'valuation' && (
            <div className="rm-layout with-sidebar">
              <div className="card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                  }}
                >
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                    Packaging Inventory Valuations
                  </h2>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => window.print()}
                  >
                    🖨️ Print Valuation Report
                  </button>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Unit</th>
                        <th>Available Stock</th>
                        <th>Unit Cost</th>
                        <th>Total Value</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((m) => {
                        const isLow = Number(m.stock) <= Number(m.minStock);
                        const value = Number(m.stock) * Number(m.purchasePrice);
                        return (
                          <tr key={m.id || m._id}>
                            <td>{m.materialCode}</td>
                            <td>{m.name}</td>
                            <td>{m.category}</td>
                            <td>{m.unit}</td>
                            <td style={{ fontWeight: 600 }}>{m.stock}</td>
                            <td>₹{Number(m.purchasePrice).toFixed(2)}</td>
                            <td style={{ fontWeight: 600 }}>₹{value.toFixed(2)}</td>
                            <td>
                              <span
                                className={`rm-badge ${
                                  isLow ? 'rm-badge-inactive' : 'rm-badge-active'
                                }`}
                              >
                                {isLow ? 'REORDER' : 'OK'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Low Stock Alerts */}
                <div className="card">
                  <h3
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#ef4444',
                      marginBottom: '0.75rem',
                    }}
                  >
                    ⚠️ Packaging Reorder Alerts
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {materials
                      .filter((m) => Number(m.stock) <= Number(m.minStock))
                      .map((m) => (
                        <div
                          key={m.id || m._id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '0.5rem',
                            background: '#fee2e2',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                          }}
                        >
                          <span>
                            <strong>{m.materialCode}</strong> - {m.name}
                          </span>
                          <span style={{ fontWeight: 700, color: '#b91c1c' }}>
                            {m.stock} / {m.minStock} {m.unit}
                          </span>
                        </div>
                      ))}
                    {materials.filter((m) => Number(m.stock) <= Number(m.minStock)).length ===
                      0 && (
                      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
                        All packaging stock levels are healthy.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal - Create/Edit */}
      {['create', 'edit'].includes(modalType) && (
        <Modal
          title={modalType === 'edit' ? 'Edit Packaging Material' : 'Add Packaging Material'}
          onClose={() => setModalType(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalType(null)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                Save
              </button>
            </>
          }
        >
          <div className="rm-grid-form">
            <div className="form-group">
              <label>Material Name</label>
              <input
                type="text"
                className="form-control"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Material Code</label>
              <input
                type="text"
                className="form-control"
                value={form.materialCode}
                onChange={(e) => setForm({ ...form, materialCode: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select
                className="form-control"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {packagingCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Unit</label>
              <select
                className="form-control"
                value={form.unit}
                onChange={(e) => setForm({ ...form, unit: e.target.value })}
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Minimum Stock Threshold</label>
              <input
                type="number"
                className="form-control"
                value={form.minStock}
                onChange={(e) => setForm({ ...form, minStock: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Purchase Price (Avg)</label>
              <input
                type="number"
                className="form-control"
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>GST %</label>
              <input
                type="number"
                className="form-control"
                value={form.gstPercent}
                onChange={(e) => setForm({ ...form, gstPercent: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Supplier</label>
              <select
                className="form-control"
                value={form.supplierId || ''}
                onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id || s._id} value={s.id || s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Warehouse Location</label>
              <input
                type="text"
                className="form-control"
                value={form.warehouse}
                onChange={(e) => setForm({ ...form, warehouse: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select
                className="form-control"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal - Purchase Entry */}
      {modalType === 'purchase' && (
        <Modal
          title="Packaging Material Purchase Entry"
          onClose={() => setModalType(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalType(null)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handlePurchase}>
                Submit Purchase
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Select Packaging Material</label>
              <select
                className="form-control"
                value={purchaseForm.rawMaterialId}
                onChange={(e) =>
                  setPurchaseForm({ ...purchaseForm, rawMaterialId: e.target.value })
                }
              >
                <option value="">Select Material</option>
                {materials.map((m) => (
                  <option key={m.id || m._id} value={m.id || m._id}>
                    {m.name} ({m.materialCode})
                  </option>
                ))}
              </select>
            </div>
            <div className="rm-grid-form">
              <div className="form-group">
                <label>Purchase Quantity</label>
                <input
                  type="number"
                  className="form-control"
                  value={purchaseForm.quantity}
                  onChange={(e) =>
                    setPurchaseForm({ ...purchaseForm, quantity: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>Unit Price (Excl. GST)</label>
                <input
                  type="number"
                  className="form-control"
                  value={purchaseForm.price}
                  onChange={(e) => setPurchaseForm({ ...purchaseForm, price: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Select Supplier</label>
              <select
                className="form-control"
                value={purchaseForm.supplierId}
                onChange={(e) =>
                  setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })
                }
              >
                <option value="">Use Material Default Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id || s._id} value={s.id || s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Notes / Invoice Number</label>
              <textarea
                className="form-control"
                rows="2"
                value={purchaseForm.notes}
                onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal - Stock Adjustment */}
      {modalType === 'adjust' && (
        <Modal
          title="Manual Stock Adjustment"
          onClose={() => setModalType(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalType(null)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleAdjust}>
                Save Adjustment
              </button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Select Packaging Material</label>
              <select
                className="form-control"
                value={adjustForm.rawMaterialId}
                onChange={(e) => setAdjustForm({ ...adjustForm, rawMaterialId: e.target.value })}
              >
                <option value="">Select Material</option>
                {materials.map((m) => (
                  <option key={m.id || m._id} value={m.id || m._id}>
                    {m.name} ({m.materialCode})
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity Delta (use negative to deduct stock)</label>
              <input
                type="number"
                className="form-control"
                placeholder="e.g. 100 or -50"
                value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>Reason / Notes</label>
              <textarea
                className="form-control"
                rows="2"
                value={adjustForm.notes}
                onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
