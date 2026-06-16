import { useEffect, useState, useCallback } from 'react';
import { customersApi, productsApi } from '../api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function OrganicStores() {
  const { toast } = useToast();
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await customersApi.list({ type: 'Organic Store', limit: 100 });
      setStores(data.customers);
      
      const { data: prodData } = await productsApi.list({ limit: 1000 });
      setProducts(prodData.products);
    } catch {
      toast('Failed to load Organic Store listings', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered stores
  const filteredStores = stores.filter(s => activeCategory === 'All' || s.storeCategory === activeCategory);

  const handleUpdateCategory = async (id, cat) => {
    try {
      await customersApi.update(id, { storeCategory: cat });
      toast('Store Tier category updated', 'success');
      loadData();
    } catch {
      toast('Update failed', 'error');
    }
  };

  return (
    <div className="page" style={{ '--brand-primary': '#10b981' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Organic & Health Stores Directory</h1>
          <p className="page-subtitle">Manage regional health stores, monitor store category tiers, and view organic stock recommendations.</p>
        </div>
      </div>

      <div className="rm-tabs-bar" style={{ marginBottom: '1.5rem' }}>
        {['All', 'A', 'B', 'C'].map((cat) => (
          <button
            key={cat}
            type="button"
            className={`rm-tab-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
            style={{ fontWeight: 600 }}
          >
            {cat === 'All' ? 'All Stores' : `Tier ${cat} Stores`}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="rm-layout with-sidebar">
          <div className="card table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Store Details</th>
                  <th>Tier Category</th>
                  <th>Contact Person</th>
                  <th>State & Pincode</th>
                  <th>Email</th>
                  <th>Quick Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStores.map((s) => (
                  <tr key={s.id || s._id}>
                    <td>
                      <strong>{s.name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.businessName || 'Retail Outlet'}</div>
                    </td>
                    <td>
                      <select
                        className="form-control form-control-sm"
                        style={{ maxWidth: '80px', fontWeight: 600 }}
                        value={s.storeCategory || 'B'}
                        onChange={(e) => handleUpdateCategory(s.id || s._id, e.target.value)}
                      >
                        <option value="A">Tier A</option>
                        <option value="B">Tier B</option>
                        <option value="C">Tier C</option>
                      </select>
                    </td>
                    <td>{s.contactPerson || '-'}</td>
                    <td>{s.state ? `${s.state} (${s.pincode || ''})` : '-'}</td>
                    <td>{s.email}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          toast(`Generating email recommendation checklist for ${s.name}...`, 'info');
                        }}
                      >
                        📧 Send Catalog
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredStores.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af' }}>No stores found in this category tier.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>🌿 Organic Recommendations</h3>
              <p style={{ fontSize: '0.875rem', color: '#4b5563', lineHeight: '1.5', margin: '0 0 1rem 0' }}>
                Suggest high-demand organic SKUs for stores based on their tier.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ padding: '0.75rem', background: '#ecfdf5', borderRadius: '8px', borderLeft: '4px solid #10b981' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Tier A Recommendations</div>
                  <div style={{ fontSize: '0.75rem', color: '#047857', marginTop: '0.25rem' }}>
                    Suggest <strong>Bulk Oats 25kg Bag</strong> and <strong>Choco Malt 1kg Pack</strong> for bulk organic aisles.
                  </div>
                </div>
                
                <div style={{ padding: '0.75rem', background: '#f0fdf4', borderRadius: '8px', borderLeft: '4px solid #34d399' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Tier B / C Recommendations</div>
                  <div style={{ fontSize: '0.75rem', color: '#065f46', marginTop: '0.25rem' }}>
                    Suggest <strong>Honey Oats 500g Pack</strong> and <strong>Organic Honey 250g Jars</strong>.
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>📊 Repeat Order Cycle</h3>
              <p style={{ fontSize: '0.875rem', color: '#4b5563', lineHeight: '1.5', margin: 0 }}>
                Tier A stores order on average every <strong>14 days</strong>. Tier B/C stores run a <strong>30-day</strong> cycle. Proactively email order proposals 3 days before their estimated reorder date.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
