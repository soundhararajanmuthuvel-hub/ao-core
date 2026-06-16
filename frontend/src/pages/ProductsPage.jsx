import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Products from './Products';
import RawMaterials from './RawMaterials';
import PackagingMaterials from './PackagingMaterials';
import { productsApi } from '../api';

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'finished';
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    productsApi.categories()
      .then(({ data }) => setCategories(data.categories || []))
      .catch(() => {});
  }, [currentTab]);

  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            📦 Products & Items Master
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Manage Finished Goods, Raw Materials, Packaging Inventory, and Item Categories.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', gap: '0.5rem', overflowX: 'auto' }}>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'finished' ? 'active' : ''}`}
          onClick={() => setTab('finished')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'finished' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'finished' ? '#ff9800' : '#64748b',
          }}
        >
          🎁 Finished Goods
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'raw-materials' ? 'active' : ''}`}
          onClick={() => setTab('raw-materials')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'raw-materials' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'raw-materials' ? '#ff9800' : '#64748b',
          }}
        >
          🌾 Raw Materials
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'packaging-materials' ? 'active' : ''}`}
          onClick={() => setTab('packaging-materials')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'packaging-materials' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'packaging-materials' ? '#ff9800' : '#64748b',
          }}
        >
          🏷️ Packaging Materials
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'categories' ? 'active' : ''}`}
          onClick={() => setTab('categories')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'categories' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'categories' ? '#ff9800' : '#64748b',
          }}
        >
          🗂️ Categories List
        </button>
      </div>

      <div className="tab-content" style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
        {currentTab === 'finished' && <Products />}
        {currentTab === 'raw-materials' && <RawMaterials />}
        {currentTab === 'packaging-materials' && <PackagingMaterials />}
        {currentTab === 'categories' && (
          <div className="card" style={{ padding: '2rem', backgroundColor: '#fff', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', color: '#1e293b' }}>Seeded Item Categories</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {categories.map((c) => (
                <div key={c} style={{ border: '1px solid #e2e8f0', padding: '1rem 1.5rem', borderRadius: '8px', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600, color: '#334155' }}>📁 {c}</span>
                  <span style={{ fontSize: '0.75rem', backgroundColor: '#e2e8f0', padding: '0.2rem 0.5rem', borderRadius: '6px', color: '#475569', fontWeight: 600 }}>Active</span>
                </div>
              ))}
              {categories.length === 0 && (
                <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>No product categories registered.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
