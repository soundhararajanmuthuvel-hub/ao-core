import React, { useState, useEffect } from 'react';
import { Package, Plus, Trash2, Edit2, ShieldAlert } from 'lucide-react';
import { repackApi } from '../../api';

export default function PackingConfigurationCard({ productId, productName }) {
  const [packSizes, setPackSizes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);

  const [form, setForm] = useState({
    packName: '',
    weightInGrams: '',
    unit: 'g',
    sku: '',
    barcode: '',
    sellingPrice: '',
    mrp: '',
    packagingCost: ''
  });

  useEffect(() => {
    if (productId) {
      fetchPackSizes();
    }
  }, [productId]);

  const fetchPackSizes = async () => {
    setLoading(true);
    try {
      const res = await repackApi.listPackSizes(productId);
      setPackSizes(res.data?.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditId(null);
    setForm({
      packName: '',
      weightInGrams: '',
      unit: 'g',
      sku: `${productName ? productName.substring(0, 3).toUpperCase() : 'SKU'}-${Date.now().toString().slice(-4)}`,
      barcode: '',
      sellingPrice: '',
      mrp: '',
      packagingCost: ''
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (ps) => {
    setEditId(ps.id || ps._id);
    setForm({
      packName: ps.packName || '',
      weightInGrams: ps.weightInGrams || '',
      unit: ps.unit || 'g',
      sku: ps.sku || '',
      barcode: ps.barcode || '',
      sellingPrice: ps.sellingPrice || '',
      mrp: ps.mrp || '',
      packagingCost: ps.packagingCost || ''
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.packName || !form.weightInGrams) {
      alert('Pack Name and Weight in grams are required');
      return;
    }
    try {
      const payload = {
        productId,
        ...form,
        weightInGrams: Number(form.weightInGrams),
        sellingPrice: Number(form.sellingPrice || 0),
        mrp: Number(form.mrp || 0),
        packagingCost: Number(form.packagingCost || 0)
      };

      if (editId) {
        await repackApi.updatePackSize(editId, payload);
      } else {
        await repackApi.createPackSize(payload);
      }

      setModalOpen(false);
      fetchPackSizes();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save pack size');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Deactivate this predefined pack size option?')) return;
    try {
      await repackApi.deletePackSize(id);
      fetchPackSizes();
    } catch (err) {
      alert('Failed to deactivate pack size');
    }
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.5rem', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={20} color="#ff9800" /> Predefined Pack Size Configurations
          </h3>
          <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            Configure predefined retail pack sizes (e.g. 100g, 200g, 500g, 1Kg, 5Kg) for floor operator selection.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', fontWeight: 700, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          onClick={handleOpenAdd}
        >
          <Plus size={16} /> Add Pack Size
        </button>
      </div>

      {!productId ? (
        <div style={{ padding: '1.5rem', backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '10px', color: '#873800', fontSize: '0.85rem', fontWeight: 600 }}>
          <ShieldAlert size={16} style={{ display: 'inline', marginRight: '0.4rem' }} /> Save this product first in Product Master before configuring pack sizes.
        </div>
      ) : (
        <div className="table-wrap">
          <table className="data-table" style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th>Pack Name</th>
                <th>Weight / Vol</th>
                <th>Retail SKU</th>
                <th>Barcode</th>
                <th>MRP (₹)</th>
                <th>Selling Price (₹)</th>
                <th>Pack Stock</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {packSizes.map(ps => (
                <tr key={ps.id || ps._id}>
                  <td style={{ fontWeight: 700, color: '#0f172a' }}>✓ {ps.packName}</td>
                  <td>{ps.weightInGrams} {ps.unit || 'g'}</td>
                  <td><code>{ps.sku || 'N/A'}</code></td>
                  <td>{ps.barcode || '—'}</td>
                  <td style={{ fontWeight: 600 }}>₹{ps.mrp}</td>
                  <td style={{ fontWeight: 700, color: '#10b981' }}>₹{ps.sellingPrice}</td>
                  <td><strong>{ps.stock || 0} packs</strong></td>
                  <td>
                    <span className={`badge ${ps.status === 'Active' ? 'badge-success' : 'badge-secondary'}`}>
                      {ps.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem', justifyContent: 'center' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleOpenEdit(ps)}>
                        <Edit2 size={12} /> Edit
                      </button>
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(ps.id || ps._id)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {packSizes.length === 0 && !loading && (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '1.5rem', color: '#64748b' }}>
                    No pack sizes configured yet. Click <strong>+ Add Pack Size</strong> to define retail configurations.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal for adding/editing pack size */}
      {modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '16px', width: '450px', maxWidth: '90%' }}>
            <h4 style={{ margin: '0 0 1rem 0', fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
              {editId ? 'Edit Pack Size Configuration' : 'Add Predefined Pack Size'}
            </h4>
            <form onSubmit={handleSave}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Pack Name *</label>
                  <input
                    type="text"
                    required
                    className="form-control"
                    placeholder="e.g. 200 g"
                    value={form.packName}
                    onChange={(e) => setForm({ ...form, packName: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Weight in Grams *</label>
                  <input
                    type="number"
                    required
                    className="form-control"
                    placeholder="e.g. 200"
                    value={form.weightInGrams}
                    onChange={(e) => setForm({ ...form, weightInGrams: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Retail SKU</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. BLV-200G"
                    value={form.sku}
                    onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Barcode</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. 890123456789"
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>MRP (₹)</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="199"
                    value={form.mrp}
                    onChange={(e) => setForm({ ...form, mrp: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Selling Price</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="180"
                    value={form.sellingPrice}
                    onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.8rem', fontWeight: 700 }}>Packing Cost</label>
                  <input
                    type="number"
                    className="form-control"
                    placeholder="5.5"
                    value={form.packagingCost}
                    onChange={(e) => setForm({ ...form, packagingCost: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', fontWeight: 700 }}>
                  Save Pack Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
