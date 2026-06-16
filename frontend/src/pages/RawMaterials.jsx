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
  category: 'Ingredients',
  unit: 'Piece',
  minStock: 10,
  reorderQty: 100,
  purchasePrice: 0,
  gstPercent: 0,
  supplierId: '',
  warehouse: '',
  status: 'Active',
};

const categories = [
  'Ingredients',
  'Packaging Materials',
  'Labels',
  'Bottles',
  'Pouches',
  'Cartons',
  'Other Materials',
];

const units = ['Kg', 'Gram', 'Liter', 'Piece', 'Box'];

export default function RawMaterials() {
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

  // Dashboard Cards
  const [metrics, setMetrics] = useState({
    totalMaterials: 0,
    lowStockMaterials: 0,
    materialConsumption: 0,
    materialValue: 0,
  });

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

  // Report Data
  const [reportData, setReportData] = useState({
    materialsList: [],
    consumptions: [],
    purchases: [],
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load List
      const { data } = await rawMaterialsApi.list({
        page,
        search,
        category: categoryFilter,
        limit: 10,
      });
      setMaterials(data.materials);
      setPages(data.pages);

      // Load Metrics & Reports
      const { data: repData } = await rawMaterialsApi.report();
      setMetrics(repData.cards);
      setReportData(repData.reports);

      // Load Suppliers
      const { data: supData } = await suppliersApi.list({ limit: 100 });
      setSuppliers(supData.suppliers);
    } catch {
      toast('Failed to load raw materials data', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryFilter, toast]);

  const loadMovements = useCallback(async () => {
    try {
      const { data } = await rawMaterialsApi.movements({
        page: movPage,
        rawMaterialId: selectedRmFilter,
        limit: 15,
      });
      setMovements(data.movements);
      setMovPages(data.pages);
    } catch {
      toast('Failed to load logs', 'error');
    }
  }, [movPage, selectedRmFilter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (activeTab === 'logs') {
      loadMovements();
    }
  }, [activeTab, loadMovements]);

  const openEdit = (material) => {
    setForm(material);
    setModalType('edit');
  };

  const handleSave = async () => {
    try {
      if (modalType === 'edit') {
        await rawMaterialsApi.update(form.id || form._id, form);
        toast('Material updated successfully', 'success');
      } else {
        await rawMaterialsApi.create(form);
        toast('Material created successfully', 'success');
      }
      setModalType(null);
      setForm(emptyMaterial);
      loadData();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to save', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this raw material?')) return;
    try {
      await rawMaterialsApi.remove(id);
      toast('Material deleted successfully', 'success');
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
      setPurchaseForm({ rawMaterialId: '', quantity: '', price: '', supplierId: '', notes: '' });
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
          <h1 className="page-title">Raw Material Management</h1>
          <p className="page-subtitle">Track manufacturing ingredients, packaging, labels, and stock valuation.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn btn-secondary" onClick={() => { setModalType('purchase'); }}>
            📥 Purchase Entry
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => { setModalType('adjust'); }}>
            ⚙️ Stock Adjustment
          </button>
          <button type="button" className="btn btn-primary" onClick={() => { setForm(emptyMaterial); setModalType('create'); }}>
            + Add Material
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="rm-dashboard-grid">
        <div className="rm-stat-card">
          <div className="rm-stat-icon">📦</div>
          <div className="rm-stat-info">
            <h3>Total Raw Materials</h3>
            <p>{metrics.totalMaterials}</p>
          </div>
        </div>
        <div className="rm-stat-card">
          <div className="rm-stat-icon" style={{ color: '#ef4444', background: '#fee2e2' }}>⚠️</div>
          <div className="rm-stat-info">
            <h3>Low Stock Alert</h3>
            <p>{metrics.lowStockMaterials}</p>
          </div>
        </div>
        <div className="rm-stat-card">
          <div className="rm-stat-icon" style={{ color: '#3b82f6', background: '#dbeafe' }}>🔄</div>
          <div className="rm-stat-info">
            <h3>Material Consumed</h3>
            <p>{metrics.materialConsumption} units</p>
          </div>
        </div>
        <div className="rm-stat-card">
          <div className="rm-stat-icon" style={{ color: '#10b981', background: '#d1fae5' }}>💰</div>
          <div className="rm-stat-info">
            <h3>Material Value</h3>
            <p>Rs. {Number(metrics.materialValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="rm-tabs-bar">
        <button type="button" className={`rm-tab-btn ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>
          Materials List
        </button>
        <button type="button" className={`rm-tab-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
          Consumption Logs
        </button>
        <button type="button" className={`rm-tab-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
          Reports
        </button>
      </div>

      {loading && activeTab === 'list' ? (
        <LoadingSpinner />
      ) : (
        <>
          {activeTab === 'list' && (
            <div className="card">
              <div className="filters-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  className="form-control"
                  style={{ maxWidth: '300px' }}
                  placeholder="Search material or code..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
                <select
                  className="form-control"
                  style={{ maxWidth: '200px' }}
                  value={categoryFilter}
                  onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
                >
                  <option value="">All Categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="table-wrap">
                <table className="data-table raw-materials-table">
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
                          <td><strong>{m.materialCode}</strong></td>
                          <td>{m.name}</td>
                          <td>{m.category}</td>
                          <td>{m.unit}</td>
                          <td>
                            <span style={{ fontWeight: 600, color: isLow ? '#ef4444' : '#111827' }}>
                              {m.stock} {isLow && '⚠️'}
                            </span>
                          </td>
                          <td>{m.minStock}</td>
                          <td>Rs. {Number(m.purchasePrice).toFixed(2)}</td>
                          <td>{m.supplier?.name || '-'}</td>
                          <td>
                            <span className={`rm-badge ${m.status === 'Active' ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                              {m.status}
                            </span>
                          </td>
                          <td>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(m)}>Edit</button>{' '}
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(m.id || m._id)}>Delete</button>
                          </td>
                        </tr>
                      );
                    })}
                    {materials.length === 0 && (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', color: '#9ca3af' }}>No raw materials found.</td>
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
              <div className="filters-bar" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <select
                  className="form-control"
                  style={{ maxWidth: '300px' }}
                  value={selectedRmFilter}
                  onChange={(e) => { setSelectedRmFilter(e.target.value); setMovPage(1); }}
                >
                  <option value="">All Materials</option>
                  {reportData.materialsList.map((m) => (
                    <option key={m.id || m._id} value={m.id || m._id}>{m.name} ({m.materialCode})</option>
                  ))}
                </select>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Material</th>
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
                          <td>{mov.rawMaterial?.name} ({mov.rawMaterial?.materialCode})</td>
                          <td>
                            <span className={`badge ${badge}`}>
                              {mov.type.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity} {mov.rawMaterial?.unit}
                          </td>
                          <td>Rs. {Number(mov.price || 0).toFixed(2)}</td>
                          <td>{mov.createdBy?.name || 'System'}</td>
                          <td>{mov.notes || '-'}</td>
                        </tr>
                      );
                    })}
                    {movements.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: '#9ca3af' }}>No logs found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <Pagination page={movPage} pages={movPages} onPageChange={setMovPage} />
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="rm-layout with-sidebar">
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Stock Valuation Report</h2>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => window.print()}>🖨️ Print Report</button>
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
                        <th>Reorder Needed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.materialsList.map((m) => {
                        const isLow = Number(m.stock) <= Number(m.minStock);
                        const value = Number(m.stock) * Number(m.purchasePrice);
                        return (
                          <tr key={m.id || m._id}>
                            <td>{m.materialCode}</td>
                            <td>{m.name}</td>
                            <td>{m.category}</td>
                            <td>{m.unit}</td>
                            <td style={{ fontWeight: 600 }}>{m.stock}</td>
                            <td>Rs. {Number(m.purchasePrice).toFixed(2)}</td>
                            <td style={{ fontWeight: 600 }}>Rs. {value.toFixed(2)}</td>
                            <td>
                              <span className={`rm-badge ${isLow ? 'rm-badge-inactive' : 'rm-badge-active'}`}>
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
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.75rem' }}>⚠️ Low Stock Items</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {reportData.materialsList.filter(m => Number(m.stock) <= Number(m.minStock)).map((m) => (
                      <div key={m.id || m._id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#fee2e2', borderRadius: '6px', fontSize: '0.875rem' }}>
                        <span><strong>{m.materialCode}</strong> - {m.name}</span>
                        <span style={{ fontWeight: 700, color: '#b91c1c' }}>{m.stock} / {m.minStock} {m.unit}</span>
                      </div>
                    ))}
                    {reportData.materialsList.filter(m => Number(m.stock) <= Number(m.minStock)).length === 0 && (
                      <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>All material stocks are in healthy levels.</p>
                    )}
                  </div>
                </div>

                {/* Consumption Summary */}
                <div className="card">
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>📈 Material Purchases</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {reportData.purchases.slice(0, 5).map((p) => (
                      <div key={p.id || p._id} style={{ fontSize: '0.875rem', borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                          <span>{p.rawMaterial?.name}</span>
                          <span style={{ color: '#10b981' }}>+{p.quantity} {p.rawMaterial?.unit}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                          <span>Cost: Rs. {(p.quantity * p.price).toFixed(2)}</span>
                          <span>{new Date(p.date || p.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
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
          title={modalType === 'edit' ? 'Edit Raw Material' : 'Add Raw Material'}
          onClose={() => setModalType(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSave}>Save</button>
            </>
          }
        >
          <div className="rm-grid-form">
            <div className="form-group">
              <label>Material Name</label>
              <input type="text" className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Material Code</label>
              <input type="text" className="form-control" value={form.materialCode} onChange={(e) => setForm({ ...form, materialCode: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="form-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Unit</label>
              <select className="form-control" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                {units.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Minimum Stock Threshold</label>
              <input type="number" className="form-control" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Reorder Quantity</label>
              <input type="number" className="form-control" value={form.reorderQty ?? 100} onChange={(e) => setForm({ ...form, reorderQty: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Purchase Price (Avg)</label>
              <input type="number" className="form-control" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>GST %</label>
              <input type="number" className="form-control" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Supplier</label>
              <select className="form-control" value={form.supplierId || ''} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
                <option value="">Select Supplier</option>
                {suppliers.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Warehouse Location</label>
              <input type="text" className="form-control" value={form.warehouse} onChange={(e) => setForm({ ...form, warehouse: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select className="form-control" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
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
          title="Raw Material Purchase Entry"
          onClose={() => setModalType(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handlePurchase}>Submit Purchase</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Select Raw Material</label>
              <select className="form-control" value={purchaseForm.rawMaterialId} onChange={(e) => setPurchaseForm({ ...purchaseForm, rawMaterialId: e.target.value })}>
                <option value="">Select Material</option>
                {reportData.materialsList.map((m) => (
                  <option key={m.id || m._id} value={m.id || m._id}>{m.name} ({m.materialCode})</option>
                ))}
              </select>
            </div>
            <div className="rm-grid-form">
              <div className="form-group">
                <label>Purchase Quantity</label>
                <input type="number" className="form-control" value={purchaseForm.quantity} onChange={(e) => setPurchaseForm({ ...purchaseForm, quantity: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Unit Price (Excl. GST)</label>
                <input type="number" className="form-control" value={purchaseForm.price} onChange={(e) => setPurchaseForm({ ...purchaseForm, price: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>Select Supplier</label>
              <select className="form-control" value={purchaseForm.supplierId} onChange={(e) => setPurchaseForm({ ...purchaseForm, supplierId: e.target.value })}>
                <option value="">Use Material Default Supplier</option>
                {suppliers.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Notes / Invoice Number</label>
              <textarea className="form-control" rows="2" value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} />
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
              <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleAdjust}>Save Adjustment</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Select Raw Material</label>
              <select className="form-control" value={adjustForm.rawMaterialId} onChange={(e) => setAdjustForm({ ...adjustForm, rawMaterialId: e.target.value })}>
                <option value="">Select Material</option>
                {reportData.materialsList.map((m) => (
                  <option key={m.id || m._id} value={m.id || m._id}>{m.name} ({m.materialCode})</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Quantity Delta (use negative to deduct stock)</label>
              <input type="number" className="form-control" placeholder="e.g. 50 or -20" value={adjustForm.quantity} onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Reason / Notes</label>
              <textarea className="form-control" rows="2" value={adjustForm.notes} onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
