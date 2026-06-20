import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi } from '../api';
import { resolveAssetUrl } from '../utils/url';
import LoadingSpinner from '../components/LoadingSpinner';

const primaryColor = '#5a2d0c';

export default function MobileCatalog() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Basket overlay state for field orders
  const [selectedCustomerTier, setSelectedCustomerTier] = useState('RED');

  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          productsApi.list({ limit: 100 }),
          productsApi.categories()
        ]);
        setProducts(prodRes.data.products || []);
        setCategories(['All', ...(catRes.data || [])]);
      } catch (err) {
        console.error('Error loading mobile catalog:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  if (loading) return <LoadingSpinner />;

  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && !p.isArchived;
  });

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Catalog Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>📖 Field Products Catalog</h1>
          <p className="page-subtitle" style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.2rem' }}>Browse stock catalog, trade parameters, and tier margins.</p>
        </div>
        <button 
          type="button" 
          onClick={() => navigate('/field-ordering')} 
          className="btn btn-primary"
          style={{ backgroundColor: primaryColor, borderColor: primaryColor, fontWeight: 700 }}
        >
          🛒 Place Order
        </button>
      </div>

      {/* Selector for customer tier simulation */}
      <div className="card" style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Preview Pricing Tier:</span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {[
            { tier: 'GREEN', label: '🟢 GREEN Tier (Least Margin)' },
            { tier: 'YELLOW', label: '🟡 YELLOW Tier (Medium)' },
            { tier: 'RED', label: '🔴 RED Tier (High Margin)' }
          ].map(t => (
            <button
              key={t.tier}
              type="button"
              onClick={() => setSelectedCustomerTier(t.tier)}
              style={{
                padding: '0.35rem 0.75rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '6px',
                cursor: 'pointer',
                backgroundColor: selectedCustomerTier === t.tier ? primaryColor : '#fff',
                color: selectedCustomerTier === t.tier ? '#fff' : '#475569',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                border: selectedCustomerTier === t.tier ? 'none' : '1px solid #cbd5e1'
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search & Category Filter Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="🔍 Fast search by product name or SKU..."
          className="form-control"
          style={{ width: '100%', padding: '0.75rem' }}
        />

        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.4rem', whiteSpace: 'nowrap' }}>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '0.4rem 1rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                borderRadius: '20px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedCategory === cat ? '#0f172a' : '#f1f5f9',
                color: selectedCategory === cat ? '#fff' : '#475569',
                transition: 'all 0.2s'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Catalog Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1.25rem' }}>
        {filteredProducts.map(p => {
          const isOutOfStock = Number(p.stock) <= 0;
          
          // Resolve tier pricing
          let tierPrice = p.sellingPrice;
          if (selectedCustomerTier === 'GREEN' && Number(p.greenPrice) > 0) tierPrice = p.greenPrice;
          else if (selectedCustomerTier === 'YELLOW' && Number(p.yellowPrice) > 0) tierPrice = p.yellowPrice;
          else if (selectedCustomerTier === 'RED' && Number(p.redPrice) > 0) tierPrice = p.redPrice;

          return (
            <div 
              key={p.id} 
              className="card" 
              style={{ 
                borderRadius: '12px', 
                overflow: 'hidden', 
                backgroundColor: '#fff', 
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                opacity: isOutOfStock ? 0.75 : 1
              }}
            >
              {/* Product Image */}
              <div style={{ width: '100%', height: '160px', backgroundColor: '#f8fafc', overflow: 'hidden', position: 'relative' }}>
                <img 
                  src={p.image ? resolveAssetUrl(p.image) : '/placeholder.png'} 
                  alt={p.name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  onError={(e) => { e.target.src = '/placeholder.png'; }}
                />
                
                {/* Stock Warning Overlay */}
                <div style={{ position: 'absolute', top: '8px', right: '8px' }}>
                  {isOutOfStock ? (
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.5rem', backgroundColor: '#ef4444', color: '#fff', borderRadius: '4px', textTransform: 'uppercase' }}>
                      🚫 Out of Stock
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.2rem 0.5rem', backgroundColor: '#d1fae5', color: '#065f46', borderRadius: '4px', textTransform: 'uppercase' }}>
                      In Stock ({Math.round(p.stock)} {p.unit})
                    </span>
                  )}
                </div>
              </div>

              {/* Product Info */}
              <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <div>
                  <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>{p.category}</span>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', margin: '0.1rem 0 0 0' }}>{p.name}</h3>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>SKU: {p.sku}</span>
                </div>

                {/* Tier Pricing Visualizer */}
                <div style={{ backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '6px', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>MRP:</span>
                    <span style={{ textDecoration: 'line-through' }}>₹{p.mrp || p.sellingPrice}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: primaryColor }}>
                    <span>Active price ({selectedCustomerTier}):</span>
                    <span>₹{tierPrice}</span>
                  </div>
                </div>

                {/* Pricing Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem', fontSize: '0.7rem', textAlign: 'center', marginTop: '0.25rem' }}>
                  <div style={{ padding: '0.2rem', backgroundColor: '#e2f0e9', color: '#15803d', borderRadius: '4px' }}>
                    <strong>Green</strong><br />₹{p.greenPrice || '-'}
                  </div>
                  <div style={{ padding: '0.2rem', backgroundColor: '#fffbeb', color: '#b45309', borderRadius: '4px' }}>
                    <strong>Yellow</strong><br />₹{p.yellowPrice || '-'}
                  </div>
                  <div style={{ padding: '0.2rem', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '4px' }}>
                    <strong>Red</strong><br />₹{p.redPrice || '-'}
                  </div>
                </div>

                {/* Action button */}
                <button
                  type="button"
                  onClick={() => navigate(`/field-ordering?productId=${p.id}`)}
                  disabled={isOutOfStock}
                  className="btn btn-secondary btn-sm"
                  style={{ 
                    marginTop: 'auto', 
                    width: '100%', 
                    fontWeight: 700, 
                    border: '1px solid ' + primaryColor,
                    color: primaryColor,
                    backgroundColor: '#fff'
                  }}
                >
                  ➕ Add to Order
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
