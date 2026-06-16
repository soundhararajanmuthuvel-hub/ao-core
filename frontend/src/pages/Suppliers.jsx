import { useCallback, useEffect, useMemo, useState } from 'react';
import { suppliersApi } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  GST_REGISTRATION_TYPES,
  GST_STATE_OPTIONS,
  getStateCodeByName,
  getStateNameByCode,
  isValidGstin,
  isValidPan,
} from '../utils/gst';

const emptyForm = {
  name: '',
  phone: '',
  email: '',
  address: '',
  type: 'general',
  gstRegistered: false,
  gstNumber: '',
  gstRegistrationType: 'Regular',
  state: '',
  stateCode: '',
  panNumber: '',
  tdsApplicable: false,
  notes: '',
};

const fmt = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(n || 0));

const supplierTypeLabel = (type) => {
  if (type === 'raw_material') return 'Raw Material';
  if (type === 'packaging') return 'Packaging';
  return 'Finished Goods';
};

const supplierTypeBadge = (type) => {
  if (type === 'raw_material') return 'badge-success';
  if (type === 'packaging') return 'badge-primary';
  return 'badge-secondary';
};

export default function Suppliers() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [supRes, dashRes, purRes] = await Promise.all([
        suppliersApi.list({ includeInactive: true }),
        suppliersApi.dashboard(),
        suppliersApi.purchases(),
      ]);
      setSuppliers(supRes.data.suppliers || []);
      setDashboard(dashRes.data || null);
      setPurchases(purRes.data.purchases || []);
    } catch (err) {
      console.error(err);
      toast('Failed to load supplier data', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => String(supplier.id || supplier._id) === String(selectedSupplierId)) || null,
    [suppliers, selectedSupplierId]
  );

  const profilePurchases = useMemo(() => {
    if (!selectedSupplier) return [];
    return purchases
      .filter(
        (purchase) =>
          String(purchase.supplierId || '') === String(selectedSupplier.id || selectedSupplier._id) ||
          String(purchase.supplier || '').toLowerCase() === String(selectedSupplier.name || '').toLowerCase()
      )
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [purchases, selectedSupplier]);

  const openCreate = () => {
    setForm(emptyForm);
    setModal('create');
  };

  const openEdit = (supplier) => {
    const isRegistered = !!supplier.gstNumber;
    const stateCode = supplier.stateCode || getStateCodeByName(supplier.state || '');
    setForm({
      ...emptyForm,
      ...supplier,
      gstRegistered: isRegistered,
      gstNumber: supplier.gstNumber || '',
      gstRegistrationType: supplier.gstRegistrationType || 'Regular',
      state: supplier.state || '',
      stateCode: stateCode || '',
      panNumber: supplier.panNumber || '',
      tdsApplicable: Boolean(supplier.tdsApplicable),
      notes: supplier.notes || '',
    });
    setModal('edit');
  };

  const openProfile = (supplier) => {
    setSelectedSupplierId(supplier.id || supplier._id);
    setActiveTab('profile');
  };

  const handleStateChange = (nextState) => {
    setForm((prev) => ({
      ...prev,
      state: nextState,
      stateCode: getStateCodeByName(nextState),
    }));
  };

  const handleGstinChange = (value) => {
    const next = String(value || '').trim().toUpperCase();
    setForm((prev) => {
      const nextForm = { ...prev, gstNumber: next };
      if (isValidGstin(next) && !nextForm.stateCode) {
        nextForm.stateCode = next.slice(0, 2);
        nextForm.state = getStateNameByCode(nextForm.stateCode) || nextForm.state;
      }
      return nextForm;
    });
  };

  const save = async () => {
    if (!form.name.trim()) return toast('Supplier name is required', 'warning');
    if (form.gstRegistered && form.gstNumber.trim()) {
      if (!isValidGstin(form.gstNumber)) {
        return toast('GST number must be a valid 15-character GSTIN', 'warning');
      }
    }

    try {
      const targetId = form.id || form._id;
      const isRegistered = form.gstRegistered && !!form.gstNumber.trim();
      const payload = {
        ...form,
        gstNumber: isRegistered ? form.gstNumber.trim().toUpperCase() : '',
        gstRegistrationType: isRegistered ? 'Regular' : 'Unregistered',
      };

      if (modal === 'edit') {
        await suppliersApi.update(targetId, payload);
        toast('Supplier updated successfully', 'success');
      } else {
        const { data } = await suppliersApi.create(payload);
        const createdId = data?.supplier?.id || data?.supplier?._id;
        if (createdId) {
          setSelectedSupplierId(createdId);
        }
        toast('Supplier created successfully', 'success');
      }

      setModal(null);
      await loadData();
      if (targetId) {
        setSelectedSupplierId(targetId);
      }
    } catch (err) {
      toast(err.response?.data?.message || 'Save failed', 'error');
    }
  };

  const removeSupplier = async (id) => {
    if (!confirm('Are you sure you want to deactivate this supplier?')) return;
    try {
      await suppliersApi.remove(id);
      toast('Supplier deactivated', 'success');
      if (String(selectedSupplierId) === String(id)) {
        setSelectedSupplierId('');
      }
      loadData();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to deactivate supplier', 'error');
    }
  };

  const handlePay = async (id, type) => {
    if (!confirm('Mark this purchase as PAID? This will update outstanding payables.')) return;
    try {
      await suppliersApi.pay(id, type);
      toast('Payment logged successfully', 'success');
      loadData();
    } catch (err) {
      toast(err.response?.data?.message || 'Payment update failed', 'error');
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const terms = [
      supplier.name,
      supplier.phone,
      supplier.email,
      supplier.gstNumber,
      supplier.state,
      supplier.gstRegistrationType,
      supplier.panNumber,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesSearch = terms.includes(search.toLowerCase());

    if (activeTab === 'all' || activeTab === 'dashboard' || activeTab === 'profile') return matchesSearch;
    if (activeTab === 'raw_material') return supplier.type === 'raw_material' && matchesSearch;
    if (activeTab === 'packaging') return supplier.type === 'packaging' && matchesSearch;
    if (activeTab === 'general') return supplier.type === 'general' && matchesSearch;
    return matchesSearch;
  });

  const outstandingPurchases = purchases.filter((purchase) => purchase.paymentStatus === 'Pending');

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Supplier & Payables Management
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Maintain supplier GST records, review payable balances, and inspect purchase history from one screen.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
          onClick={openCreate}
        >
          + Add Supplier
        </button>
      </div>

      <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', gap: '0.5rem', overflowX: 'auto' }}>
        <button type="button" className={`rm-tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: activeTab === 'dashboard' ? '3px solid #ff9800' : '3px solid transparent', color: activeTab === 'dashboard' ? '#ff9800' : '#64748b' }}>
          Dashboard
        </button>
        <button type="button" className={`rm-tab-btn ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: activeTab === 'profile' ? '3px solid #ff9800' : '3px solid transparent', color: activeTab === 'profile' ? '#ff9800' : '#64748b' }}>
          Supplier Profile
        </button>
        <button type="button" className={`rm-tab-btn ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: activeTab === 'all' ? '3px solid #ff9800' : '3px solid transparent', color: activeTab === 'all' ? '#ff9800' : '#64748b' }}>
          All Suppliers
        </button>
        <button type="button" className={`rm-tab-btn ${activeTab === 'raw_material' ? 'active' : ''}`} onClick={() => setActiveTab('raw_material')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: activeTab === 'raw_material' ? '3px solid #ff9800' : '3px solid transparent', color: activeTab === 'raw_material' ? '#ff9800' : '#64748b' }}>
          Raw Material
        </button>
        <button type="button" className={`rm-tab-btn ${activeTab === 'packaging' ? 'active' : ''}`} onClick={() => setActiveTab('packaging')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: activeTab === 'packaging' ? '3px solid #ff9800' : '3px solid transparent', color: activeTab === 'packaging' ? '#ff9800' : '#64748b' }}>
          Packaging
        </button>
        <button type="button" className={`rm-tab-btn ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: activeTab === 'general' ? '3px solid #ff9800' : '3px solid transparent', color: activeTab === 'general' ? '#ff9800' : '#64748b' }}>
          Finished Goods
        </button>
        <button type="button" className={`rm-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: activeTab === 'history' ? '3px solid #ff9800' : '3px solid transparent', color: activeTab === 'history' ? '#ff9800' : '#64748b' }}>
          Purchase History
        </button>
        <button type="button" className={`rm-tab-btn ${activeTab === 'outstanding' ? 'active' : ''}`} onClick={() => setActiveTab('outstanding')} style={{ padding: '0.75rem 1.25rem', fontWeight: 600, fontSize: '0.9rem', borderBottom: activeTab === 'outstanding' ? '3px solid #ff9800' : '3px solid transparent', color: activeTab === 'outstanding' ? '#ff9800' : '#64748b' }}>
          Outstanding Payments ({outstandingPurchases.length})
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <>
          {activeTab === 'dashboard' && dashboard && (
            <div>
              <div className="repack-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="repack-stat-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="repack-stat-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Total Suppliers</div>
                  <div className="repack-stat-val" style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginTop: '0.25rem' }}>{dashboard.metrics?.totalSuppliers || 0}</div>
                </div>
                <div className="repack-stat-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="repack-stat-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Active Suppliers</div>
                  <div className="repack-stat-val" style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>{dashboard.metrics?.activeSuppliers || 0}</div>
                </div>
                <div className="repack-stat-card" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.25rem', boxShadow: 'var(--shadow-sm)' }}>
                  <div className="repack-stat-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Outstanding Payables</div>
                  <div className="repack-stat-val" style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444', marginTop: '0.25rem' }}>{fmt(dashboard.metrics?.outstandingPayables || 0)}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1.5rem' }}>
                <div>
                  <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>Low Stock Purchase Suggestions</h3>
                    {dashboard.suggestions?.length === 0 ? (
                      <div style={{ padding: '1.5rem', textAlign: 'center', background: '#ecfdf5', borderRadius: '8px', color: '#065f46', fontWeight: 600 }}>
                        All raw material and packaging stock values are above threshold limits.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {dashboard.suggestions?.map((suggestion, idx) => (
                          <div key={idx} style={{ border: '1px solid #fef3c7', background: '#fffbeb', borderRadius: '8px', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ color: '#b45309', fontSize: '0.95rem' }}>{suggestion.materialName} ({suggestion.materialCode})</strong>
                              <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                                Stock: {suggestion.stock} {suggestion.unit} (Minimum: {suggestion.minStock} {suggestion.unit})
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', display: 'block' }}>Primary Supplier</span>
                              <strong style={{ color: '#0f172a', fontSize: '0.9rem' }}>{suggestion.suggestedSupplier}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1rem 0', fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>Recent Purchase History</h3>
                    <table className="data-table" style={{ fontSize: '0.85rem' }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Supplier</th>
                          <th>GST Type</th>
                          <th>Purchase / Item</th>
                          <th>Amount</th>
                          <th style={{ textAlign: 'center' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.recentPurchases?.map((purchase, idx) => (
                          <tr key={idx}>
                            <td>{purchase.date ? new Date(purchase.date).toLocaleDateString() : '—'}</td>
                            <td style={{ fontWeight: 600 }}>{purchase.supplier}</td>
                            <td>{purchase.supplierGstType || '—'}</td>
                            <td>{purchase.item}</td>
                            <td style={{ fontWeight: 700 }}>{fmt(purchase.total)}</td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`badge ${purchase.paymentStatus === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                                {purchase.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {dashboard.recentPurchases?.length === 0 && (
                          <tr>
                            <td colSpan="6" style={{ textAlign: 'center', color: '#64748b' }}>No purchase activity logged yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem', height: 'fit-content' }}>
                  <h3 style={{ margin: '0 0 1rem 0', fontWeight: 700, fontSize: '1.1rem', color: '#0f172a' }}>Top Suppliers by Spend</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
                    {dashboard.topSuppliers?.map((topSupplier, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#fffbeb', color: '#d97706', fontSize: '0.75rem', fontWeight: 800 }}>
                              {idx + 1}
                            </span>
                            <strong style={{ color: '#0f172a' }}>{topSupplier.name}</strong>
                          </div>
                        </div>
                        <div style={{ fontWeight: 700, color: '#334155' }}>
                          {fmt(topSupplier.spend)}
                        </div>
                      </div>
                    ))}
                    {dashboard.topSuppliers?.length === 0 && (
                      <div style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>No spending data recorded.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Supplier Profile</h2>
                  <p style={{ margin: '0.35rem 0 0 0', color: '#64748b', fontSize: '0.9rem' }}>
                    View GST registration data, payable balances, and the full purchase trail for a supplier.
                  </p>
                </div>
                <select
                  className="form-control"
                  style={{ minWidth: 280, maxWidth: 360 }}
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                >
                  <option value="">Select supplier</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id || supplier._id} value={supplier.id || supplier._id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>

              {!selectedSupplier ? (
                <div style={{ border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '1.5rem', textAlign: 'center', color: '#64748b' }}>
                  Pick a supplier to open the profile view.
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Company Name</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>{selectedSupplier.name}</div>
                      <div style={{ marginTop: '0.5rem' }}>
                        <span className={`badge ${supplierTypeBadge(selectedSupplier.type)}`}>
                          {supplierTypeLabel(selectedSupplier.type)}
                        </span>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>GST Number</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', marginTop: '0.35rem' }}>{selectedSupplier.gstNumber || '—'}</div>
                      <div style={{ marginTop: '0.35rem', color: '#64748b', fontSize: '0.85rem' }}>
                        GST Registration Type: {selectedSupplier.gstRegistrationType || '—'}
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Outstanding Balance</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ef4444', marginTop: '0.35rem' }}>
                        {fmt(selectedSupplier.outstandingAmount || 0)}
                      </div>
                      <div style={{ marginTop: '0.35rem', color: '#64748b', fontSize: '0.85rem' }}>
                        Last Purchase Date: {selectedSupplier.lastPurchaseDate ? new Date(selectedSupplier.lastPurchaseDate).toLocaleDateString() : '—'}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>PAN Number</div>
                      <div style={{ marginTop: '0.35rem', fontWeight: 700, color: '#0f172a' }}>{selectedSupplier.panNumber || '—'}</div>
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>State</div>
                      <div style={{ marginTop: '0.35rem', fontWeight: 700, color: '#0f172a' }}>{selectedSupplier.state || '—'}</div>
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>State Code</div>
                      <div style={{ marginTop: '0.35rem', fontWeight: 700, color: '#0f172a' }}>{selectedSupplier.stateCode || '—'}</div>
                    </div>
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1rem' }}>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>TDS Applicable</div>
                      <div style={{ marginTop: '0.35rem', fontWeight: 700, color: '#0f172a' }}>{selectedSupplier.tdsApplicable ? 'Yes' : 'No'}</div>
                    </div>
                  </div>

                  <div className="card table-wrap" style={{ boxShadow: 'none', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1rem 0 1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Purchase History</h3>
                      <div style={{ color: '#64748b', fontSize: '0.85rem' }}>
                        {profilePurchases.length} record(s)
                      </div>
                    </div>
                    <table className="data-table" style={{ marginTop: '0.75rem' }}>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>PO #</th>
                          <th>GST Number</th>
                          <th>GST Type</th>
                          <th>Tax Type</th>
                          <th>Total</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profilePurchases.map((purchase) => (
                          <tr key={`${purchase.type}-${purchase.id}`}>
                            <td>{purchase.date ? new Date(purchase.date).toLocaleDateString() : '—'}</td>
                            <td>{purchase.purchaseNumber || purchase.item || purchase.itemName}</td>
                            <td>{purchase.supplierGstNumber || '—'}</td>
                            <td>{purchase.supplierGstType || '—'}</td>
                            <td>{purchase.taxType || '—'}</td>
                            <td style={{ fontWeight: 700 }}>{fmt(purchase.total)}</td>
                            <td>
                              <span className={`badge ${purchase.paymentStatus === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                                {purchase.paymentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {profilePurchases.length === 0 && (
                          <tr>
                            <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '1.5rem' }}>
                              No purchase history found for this supplier.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {['all', 'raw_material', 'packaging', 'general'].includes(activeTab) && (
            <div>
              <div className="filters-bar" style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <input
                  className="form-control"
                  style={{ maxWidth: '300px' }}
                  placeholder="Search supplier name, GST number, state, PAN..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="card table-wrap">
                <table className="data-table suppliers-table">
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>GST Number</th>
                      <th>State</th>
                      <th>GST Type</th>
                      <th>Outstanding Amount</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((supplier) => (
                      <tr key={supplier.id || supplier._id}>
                        <td style={{ fontWeight: 600 }}>{supplier.name}</td>
                        <td>{supplier.gstNumber || '—'}</td>
                        <td>{supplier.state || '—'}</td>
                        <td>
                          <span className="badge badge-secondary">
                            {supplier.gstRegistrationType || '—'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 700, color: Number(supplier.outstandingAmount || 0) > 0 ? '#ef4444' : '#0f172a' }}>
                          {fmt(supplier.outstandingAmount || 0)}
                        </td>
                        <td>
                          <span className={`badge ${supplier.isActive ? 'badge-success' : 'badge-secondary'}`}>
                            {supplier.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openProfile(supplier)}>
                              View
                            </button>
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(supplier)}>
                              Edit
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => removeSupplier(supplier.id || supplier._id)}>
                              Deactivate
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredSuppliers.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                          No matching suppliers found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="card table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>GST Number</th>
                    <th>GST Type</th>
                    <th>Item(s) Purchased</th>
                    <th>Quantity / Units</th>
                    <th>Tax Type</th>
                    <th>Total Cost</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr key={`${purchase.type}-${purchase.id}`}>
                      <td>{purchase.date ? new Date(purchase.date).toLocaleDateString() : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{purchase.supplier}</td>
                      <td>{purchase.supplierGstNumber || '—'}</td>
                      <td>{purchase.supplierGstType || '—'}</td>
                      <td>{purchase.itemName || purchase.item}</td>
                      <td>{purchase.qty}</td>
                      <td>{purchase.taxType || '—'}</td>
                      <td style={{ fontWeight: 700 }}>{fmt(purchase.total)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${purchase.paymentStatus === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                          {purchase.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {purchases.length === 0 && (
                    <tr>
                      <td colSpan="9" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No purchase history recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'outstanding' && (
            <div className="card table-wrap">
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem', color: '#991b1b', fontSize: '0.875rem' }}>
                <strong>Outstanding Payables Alert:</strong> The list below contains purchases that are still unpaid. Click Mark Paid once payment is transferred.
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Purchase Date</th>
                    <th>Supplier</th>
                    <th>GST Number</th>
                    <th>GST Type</th>
                    <th>Description</th>
                    <th>Units</th>
                    <th>Amount Payable</th>
                    <th style={{ textAlign: 'center' }}>Log Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {outstandingPurchases.map((purchase) => (
                    <tr key={`${purchase.type}-${purchase.id}`}>
                      <td>{purchase.date ? new Date(purchase.date).toLocaleDateString() : '—'}</td>
                      <td style={{ fontWeight: 600 }}>{purchase.supplier}</td>
                      <td>{purchase.supplierGstNumber || '—'}</td>
                      <td>{purchase.supplierGstType || '—'}</td>
                      <td>{purchase.itemName || purchase.item}</td>
                      <td>{purchase.qty}</td>
                      <td style={{ fontWeight: 700, color: '#ef4444' }}>{fmt(purchase.total)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ backgroundColor: '#10b981', borderColor: '#10b981', padding: '0.25rem 0.6rem', fontSize: '0.75rem', fontWeight: 600 }}
                          onClick={() => handlePay(purchase.id, purchase.type)}
                        >
                          Mark Paid
                        </button>
                      </td>
                    </tr>
                  ))}
                  {outstandingPurchases.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', color: '#10b981', fontWeight: 600, padding: '2rem' }}>
                        Great. There are no outstanding payments remaining.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {modal && (
        <Modal
          title={modal === 'edit' ? 'Edit Supplier' : 'Add New Supplier'}
          onClose={() => setModal(null)}
          footer={(
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800' }} onClick={save}>
                Save Supplier
              </button>
            </>
          )}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label>Supplier Name *</label>
              <input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Phone Number</label>
                <input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>

            <div className="form-group">
              <label>Supplier Type *</label>
              <select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required>
                <option value="general">Finished Goods Supplier (General)</option>
                <option value="packaging">Packaging Materials Supplier</option>
                <option value="raw_material">Raw Materials / Ingredients Supplier</option>
              </select>
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '1rem', marginBottom: '1rem' }}>
              <input
                type="checkbox"
                id="gstRegistered"
                checked={Boolean(form.gstRegistered)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setForm(prev => ({
                    ...prev,
                    gstRegistered: checked,
                    gstNumber: checked ? prev.gstNumber : '',
                    gstRegistrationType: checked ? 'Regular' : 'Unregistered'
                  }));
                }}
              />
              <label htmlFor="gstRegistered" style={{ margin: 0, fontWeight: 600, cursor: 'pointer' }}>
                GST Registered Supplier
              </label>
            </div>

            {form.gstRegistered && (
              <div className="form-group">
                <label>GST Number (Optional)</label>
                <input
                  className="form-control"
                  placeholder="33ABCDE1234F1Z5"
                  value={form.gstNumber || ''}
                  onChange={(e) => handleGstinChange(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label>Address</label>
              <textarea className="form-control" rows={2} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>

            <div className="form-group">
              <label>Internal Notes / Remarks</label>
              <textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
