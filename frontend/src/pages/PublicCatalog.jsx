import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { catalogApi } from '../api';
import { resolveAssetUrl } from '../utils/url';
import LoadingSpinner from '../components/LoadingSpinner';

export default function PublicCatalog() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [settings, setSettings] = useState({});
  const [categories, setCategories] = useState([]);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  
  // Download states
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [imageGeneratingId, setImageGeneratingId] = useState(null);

  useEffect(() => {
    const fetchPublicData = async () => {
      try {
        const { data } = await catalogApi.getPublicCatalog();
        if (data.success) {
          setProducts(data.products || []);
          setSettings(data.settings || {});
          
          // Compute unique categories
          const cats = new Set(data.products.map(p => p.category).filter(Boolean));
          setCategories(['All', ...Array.from(cats)]);
        }
      } catch (err) {
        console.error('Error loading public catalog:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPublicData();
  }, []);

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch && !p.isArchived;
  });

  const handleDownloadPdf = async () => {
    setPdfGenerating(true);
    try {
      const response = await catalogApi.downloadPdf({ category: selectedCategory, pricingType: 'retail' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `catalog-${selectedCategory.replace(/\s+/g, '_')}-retail.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to generate catalog PDF. Please try again.');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDownloadImage = async (p, format) => {
    setImageGeneratingId(`${p.id || p._id}_${format}`);
    try {
      const response = await catalogApi.downloadImage(p.id || p._id, { format, pricingType: 'retail' });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'image/svg+xml' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${p.name.replace(/\s+/g, '_')}-${format}-retail.svg`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to download product image. Please try again.');
    } finally {
      setImageGeneratingId(null);
    }
  };

  if (loading) return <LoadingSpinner />;

  const brandColor = settings.brandColor || '#5a2d0c';

  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#faf6f0', 
      color: '#2d1502', 
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      padding: '0 0 4rem 0'
    }}>
      
      {/* Brand Header Banner */}
      <header style={{ 
        background: `linear-gradient(135deg, ${brandColor} 0%, #2f1301 100%)`, 
        color: '#ffffff', 
        padding: '3rem 1.5rem', 
        textAlign: 'center',
        position: 'relative',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          {settings.logoUrl || settings.logo ? (
            <img 
              src={resolveAssetUrl(settings.logoUrl || settings.logo)} 
              alt="Logo" 
              style={{ height: '70px', objectFit: 'contain', marginBottom: '0.5rem', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.2))' }} 
              onError={(e) => { e.target.style.display = 'none'; }}
            />
          ) : null}
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, margin: 0, letterSpacing: '0.5px' }}>
            {settings.companyName || 'Amudhasurabiy Organics'}
          </h1>
          <p style={{ fontSize: '1rem', opacity: 0.9, margin: 0, fontWeight: 500, letterSpacing: '1px' }}>
            100% PURE, NATURAL &amp; ORGANIC PRODUCTS
          </p>
          
          <button
            onClick={handleDownloadPdf}
            disabled={pdfGenerating}
            style={{
              marginTop: '1.25rem',
              backgroundColor: '#ffffff',
              color: brandColor,
              border: 'none',
              padding: '0.75rem 1.75rem',
              borderRadius: '30px',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
            onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
          >
            📥 {pdfGenerating ? 'Generating Catalog...' : 'Download Full PDF Catalog'}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '1200px', margin: '2rem auto', padding: '0 1.5rem' }}>
        
        {/* Search & Category Filter Tabs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2.5rem' }}>
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 Search products by name, ingredients, or benefits..."
              style={{
                width: '100%',
                padding: '1rem 1.5rem',
                fontSize: '1.05rem',
                border: '2px solid #e8dec9',
                borderRadius: '30px',
                outline: 'none',
                backgroundColor: '#ffffff',
                color: '#2d1502',
                boxShadow: '0 2px 8px rgba(90,45,12,0.05)',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Category Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            overflowX: 'auto', 
            paddingBottom: '0.5rem', 
            whiteSpace: 'nowrap',
            scrollbarWidth: 'none'
          }}>
            {categories.map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  borderRadius: '20px',
                  cursor: 'pointer',
                  backgroundColor: selectedCategory === cat ? brandColor : '#ffffff',
                  color: selectedCategory === cat ? '#ffffff' : '#5a2d0c',
                  border: selectedCategory === cat ? 'none' : '1px solid #e8dec9',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
                  transition: 'all 0.2s'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Catalogue Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '2rem' }}>
          {filteredProducts.map(p => {
            const isDiscounted = Number(p.mrp) > Number(p.sellingPrice);
            const savings = isDiscounted ? Math.round(((p.mrp - p.sellingPrice) / p.mrp) * 100) : 0;
            const prodId = p.id || p._id;

            return (
              <div
                key={prodId}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 10px 30px rgba(90,45,12,0.06)',
                  border: '1px solid #efe8dc',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s'
                }}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-4px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                {/* Product Image */}
                <div style={{ width: '100%', height: '220px', backgroundColor: '#fdfbf7', overflow: 'hidden', position: 'relative' }}>
                  <img
                    src={p.image ? resolveAssetUrl(p.image) : '/placeholder.png'}
                    alt={p.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.target.src = '/placeholder.png'; }}
                  />
                  {isDiscounted && (
                    <div style={{
                      position: 'absolute',
                      top: '12px',
                      right: '12px',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      padding: '0.35rem 0.6rem',
                      borderRadius: '6px',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.15)'
                    }}>
                      🏷️ SAVE {savings}%
                    </div>
                  )}
                  <div style={{
                    position: 'absolute',
                    bottom: '12px',
                    left: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    color: brandColor,
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    backdropFilter: 'blur(4px)'
                  }}>
                    {p.category}
                  </div>
                </div>

                {/* Details Container */}
                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: '#2d1502' }}>{p.name}</h3>
                    {p.packSize && (
                      <span style={{ fontSize: '0.8rem', color: '#8c7866', fontWeight: 600, display: 'block', marginTop: '0.2rem' }}>
                        Pack Weight: {p.packSize}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {p.description || p.shortDescription ? (
                    <p style={{ fontSize: '0.85rem', color: '#5c4e43', margin: 0, lineBreak: 'auto', lineHeight: 1.4 }}>
                      {p.description || p.shortDescription}
                    </p>
                  ) : null}

                  {/* Ingredients & Benefits */}
                  {p.ingredients ? (
                    <div style={{ marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8c7866', display: 'block' }}>🌱 INGREDIENTS:</span>
                      <p style={{ fontSize: '0.8rem', color: '#5c4e43', margin: '0.1rem 0 0 0', fontStyle: 'italic' }}>{p.ingredients}</p>
                    </div>
                  ) : null}

                  {p.benefits ? (
                    <div style={{ marginTop: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8c7866', display: 'block' }}>✨ KEY BENEFITS:</span>
                      <p style={{ fontSize: '0.8rem', color: '#5c4e43', margin: '0.1rem 0 0 0' }}>{p.benefits}</p>
                    </div>
                  ) : null}

                  {/* Pricing Box */}
                  <div style={{ 
                    marginTop: 'auto', 
                    paddingTop: '1rem', 
                    borderTop: '1px solid #efe8dc', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'baseline' 
                  }}>
                    <div>
                      {isDiscounted && (
                        <span style={{ fontSize: '0.8rem', color: '#8c7866', textDecoration: 'line-through', marginRight: '0.5rem' }}>
                          ₹{Number(p.mrp).toFixed(2)}
                        </span>
                      )}
                      <span style={{ fontSize: '1.25rem', fontWeight: 900, color: brandColor }}>
                        ₹{Number(p.sellingPrice).toFixed(2)}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#8c7866', fontWeight: 600 }}>Inc. GST</span>
                  </div>

                  {/* Download SVGs Poster Options */}
                  <div style={{ marginTop: '0.75rem', borderTop: '1px dashed #efe8dc', paddingTop: '0.75rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8c7866', display: 'block', marginBottom: '0.4rem' }}>
                      💾 Save product graphic to gallery:
                    </span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => handleDownloadImage(p, '1080x1080')}
                        disabled={imageGeneratingId === `${prodId}_1080x1080`}
                        style={{
                          backgroundColor: '#faf6f0',
                          border: '1px solid #e8dec9',
                          borderRadius: '6px',
                          color: brandColor,
                          fontSize: '0.7rem',
                          padding: '0.35rem 0',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {imageGeneratingId === `${prodId}_1080x1080` ? '...' : 'Square 1:1'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadImage(p, '1080x1350')}
                        disabled={imageGeneratingId === `${prodId}_1080x1350`}
                        style={{
                          backgroundColor: '#faf6f0',
                          border: '1px solid #e8dec9',
                          borderRadius: '6px',
                          color: brandColor,
                          fontSize: '0.7rem',
                          padding: '0.35rem 0',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {imageGeneratingId === `${prodId}_1080x1350` ? '...' : 'Feed 4:5'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadImage(p, '1080x1920')}
                        disabled={imageGeneratingId === `${prodId}_1080x1920`}
                        style={{
                          backgroundColor: '#faf6f0',
                          border: '1px solid #e8dec9',
                          borderRadius: '6px',
                          color: brandColor,
                          fontSize: '0.7rem',
                          padding: '0.35rem 0',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {imageGeneratingId === `${prodId}_1080x1920` ? '...' : 'Story 9:16'}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

      </main>

      {/* Footer Details */}
      <footer style={{ 
        marginTop: '5rem', 
        borderTop: '1px solid #e8dec9', 
        padding: '2.5rem 1.5rem', 
        textAlign: 'center', 
        fontSize: '0.85rem', 
        color: '#8c7866' 
      }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p style={{ margin: 0, fontWeight: 700 }}>
            {settings.companyName || 'Amudhasurabiy Organics'}
          </p>
          {settings.phone ? <p style={{ margin: 0 }}>📞 Customer Support: {settings.phone}</p> : null}
          {settings.email ? <p style={{ margin: 0 }}>✉️ Email: {settings.email}</p> : null}
          {settings.websiteUrl ? (
            <p style={{ margin: 0 }}>
              🌐 Web: <a href={`https://${settings.websiteUrl.replace(/https?:\/\//i, '')}`} target="_blank" rel="noopener noreferrer" style={{ color: brandColor, fontWeight: 700 }}>{settings.websiteUrl}</a>
            </p>
          ) : null}
          {settings.gstNumber ? <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.8 }}>GSTIN: {settings.gstNumber}</p> : null}
        </div>
      </footer>

    </div>
  );
}
