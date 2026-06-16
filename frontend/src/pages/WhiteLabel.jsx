import { useEffect, useState, useCallback } from 'react';
import { customersApi, productsApi } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

export default function WhiteLabel() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState(null); // 'edit', 'recipe', 'branding'
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Edit fields state
  const [editForm, setEditForm] = useState({
    brandName: '',
    labelDesignRef: '',
    packagingType: '',
    moq: 0,
    manufacturingNotes: '',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await customersApi.list({ type: 'White Label', limit: 100 });
      setCustomers(data.customers);
      
      const { data: prodData } = await productsApi.list({ limit: 1000 });
      setProducts(prodData.products);
    } catch {
      toast('Failed to load White Label customers', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openEdit = (c) => {
    setSelectedCustomer(c);
    setEditForm({
      brandName: c.brandName || '',
      labelDesignRef: c.labelDesignRef || '',
      packagingType: c.packagingType || '',
      moq: c.moq || 0,
      manufacturingNotes: c.manufacturingNotes || '',
    });
    setModalType('edit');
  };

  const handleSaveEdit = async () => {
    try {
      await customersApi.update(selectedCustomer.id || selectedCustomer._id, editForm);
      toast('White Label profile updated', 'success');
      setModalType(null);
      loadData();
    } catch {
      toast('Failed to update profile', 'error');
    }
  };

  return (
    <div className="page" style={{ '--brand-primary': '#4f46e5' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">White Label Branding Hub</h1>
          <p className="page-subtitle">Manage contract manufacturing clients, brand specifications, MOQ thresholds, and packaging recipes.</p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="rm-layout with-sidebar">
          <div className="card table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Brand Name</th>
                  <th>MOQ</th>
                  <th>Packaging Type</th>
                  <th>Design Reference</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id || c._id}>
                    <td>
                      <strong>{c.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{c.businessName || '-'}</div>
                    </td>
                    <td><span className="badge badge-success">{c.brandName || 'Not Set'}</span></td>
                    <td>{c.moq || '0'} units</td>
                    <td>{c.packagingType || '-'}</td>
                    <td><code>{c.labelDesignRef || '-'}</code></td>
                    <td>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(c)}>Spec Sheet</button>{' '}
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setSelectedCustomer(c); setModalType('recipe'); }}>Custom pricing</button>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af' }}>No White Label customers configured. Go to main Customer directory to classify a customer as White Label.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>🏷️ Brand Design References</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {customers.map((c) => (
                  <div key={c.id || c._id} style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '0.5rem', fontSize: '0.875rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                      <span>{c.brandName || c.name}</span>
                      <code>{c.labelDesignRef || 'NO_REF'}</code>
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      Pkg: {c.packagingType || 'Default'} | MOQ: {c.moq || 0}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>⚙️ Quality Assurance Checklist</h3>
              <ul style={{ fontSize: '0.875rem', color: '#4b5563', paddingLeft: '1.25rem', margin: 0, lineHeight: '1.6' }}>
                <li>Verify brand design reference tags on billing.</li>
                <li>Audit label rolls stocks in Raw Materials prior to bottling.</li>
                <li>Enforce MOQ rules on purchase invoices.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Specification Edit */}
      {modalType === 'edit' && selectedCustomer && (
        <Modal
          title={`Edit Specification: ${selectedCustomer.name}`}
          onClose={() => setModalType(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setModalType(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleSaveEdit}>Save Specs</button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Client brand Name</label>
              <input type="text" className="form-control" value={editForm.brandName} onChange={(e) => setEditForm({ ...editForm, brandName: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Label Design Reference (SKU / Code)</label>
              <input type="text" className="form-control" value={editForm.labelDesignRef} onChange={(e) => setEditForm({ ...editForm, labelDesignRef: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Packaging Type (e.g. Glass Jars, Pouches, Tubes)</label>
              <input type="text" className="form-control" value={editForm.packagingType} onChange={(e) => setEditForm({ ...editForm, packagingType: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Minimum Order Quantity (MOQ)</label>
              <input type="number" className="form-control" value={editForm.moq} onChange={(e) => setEditForm({ ...editForm, moq: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Contract Manufacturing / Packing Instructions</label>
              <textarea className="form-control" rows="3" value={editForm.manufacturingNotes} onChange={(e) => setEditForm({ ...editForm, manufacturingNotes: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}

      {/* Modal - Custom Pricing */}
      {modalType === 'recipe' && selectedCustomer && (
        <Modal
          title={`Custom Special Pricing - ${selectedCustomer.name}`}
          onClose={() => setModalType(null)}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ fontSize: '0.875rem', color: '#4b5563' }}>Configure special contracting price overrides for finished products sold to this client.</p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Standard Price</th>
                  <th>Client Special Price</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const specialPrice = selectedCustomer.specialPricing?.[p.sku] || selectedCustomer.specialPricing?.[p.id] || p.sellingPrice;
                  return (
                    <tr key={p.id || p._id}>
                      <td>{p.name} ({p.sku})</td>
                      <td>Rs. {p.sellingPrice}</td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#4f46e5' }}>Rs. {specialPrice}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
}
