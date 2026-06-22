import { useState, useEffect } from 'react';
import { productsApi, customersApi, catalogApi } from '../api';
import { useToast } from '../context/ToastContext';
import { resolveAssetUrl } from '../utils/url';
import LoadingSpinner from '../components/LoadingSpinner';
import Modal from '../components/Modal';

export default function CatalogCenter() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  
  // Filters
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedTier, setSelectedTier] = useState('retail'); // retail, distributor, super_stockist, hide
  const [searchQuery, setSearchQuery] = useState('');
  
  // PDF download loading
  const [pdfGenerating, setPdfGenerating] = useState(false);
  const [imageGeneratingId, setImageGeneratingId] = useState(null);

  // WhatsApp share modal state
  const [shareModal, setShareModal] = useState(null); // { format: 'pdf'|'image', product?: p }
  const [sharePhone, setSharePhone] = useState('');
  const [shareCustomerId, setShareCustomerId] = useState('');
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const initData = async () => {
      try {
        const [prodRes, catRes, custRes] = await Promise.all([
          productsApi.list({ limit: 500 }),
          productsApi.categories(),
          customersApi.list({ limit: 500 })
        ]);
        setProducts(prodRes.data.products || []);
        setCategories(['All', ...(catRes.data.categories || [])]);
        setCustomers(custRes.data.customers || []);
      } catch (err) {
        console.error('Error loading Catalog Center:', err);
        toast('Failed to load products and categories', 'error');
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && !p.isArchived;
  });

  // Calculate pricing tier displayed
  const getTierPriceDisplay = (p) => {
    if (selectedTier === 'hide') return 'Hidden';
    if (selectedTier === 'retail') return `₹${Number(p.sellingPrice).toFixed(2)}`;
    if (selectedTier === 'distributor') {
      const price = Number(p.wholesalePrice) > 0 ? p.wholesalePrice : (Number(p.yellowPrice) > 0 ? p.yellowPrice : p.sellingPrice);
      return `₹${Number(price).toFixed(2)}`;
    }
    if (selectedTier === 'super_stockist') {
      const price = Number(p.greenPrice) > 0 ? p.greenPrice : p.sellingPrice;
      return `₹${Number(price).toFixed(2)}`;
    }
    return `₹${Number(p.sellingPrice).toFixed(2)}`;
  };

  const handleDownloadPdf = async () => {
    setPdfGenerating(true);
    try {
      const response = await catalogApi.downloadPdf({ category: selectedCategory, pricingType: selectedTier });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `catalog-${selectedCategory.replace(/\s+/g, '_')}-${selectedTier}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast('PDF Catalog generated & downloaded successfully', 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to generate PDF catalog', 'error');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleDownloadImage = async (p, format) => {
    setImageGeneratingId(`${p.id || p._id}_${format}`);
    try {
      const response = await catalogApi.downloadImage(p.id || p._id, { format, pricingType: selectedTier });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'image/svg+xml' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${p.name.replace(/\s+/g, '_')}-${format}-${selectedTier}.svg`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast(`SVG Catalog (${format}) downloaded successfully`, 'success');
    } catch (err) {
      console.error(err);
      toast('Failed to generate Image catalog', 'error');
    } finally {
      setImageGeneratingId(null);
    }
  };

  const openShareModal = (format, product = null) => {
    setShareModal({ format, product });
    setSharePhone('');
    setShareCustomerId('');
  };

  const handleCustomerSelect = (id) => {
    setShareCustomerId(id);
    const selected = customers.find(c => String(c.id || c._id) === String(id));
    if (selected && selected.phone) {
      // Clean up phone number format if needed
      setSharePhone(selected.phone);
    }
  };

  const handleWhatsAppShare = async (e) => {
    e.preventDefault();
    if (!sharePhone) {
      toast('Please enter a phone number', 'warning');
      return;
    }
    setSharing(true);
    try {
      const payload = {
        phone: sharePhone,
        customerId: shareCustomerId || null,
        pricingType: selectedTier,
        category: selectedCategory,
        format: shareModal.format,
        productId: shareModal.product ? (shareModal.product.id || shareModal.product._id) : null
      };
      await catalogApi.shareWhatsApp(payload);
      toast('Catalog shared via WhatsApp successfully!', 'success');
      setShareModal(null);
    } catch (err) {
      console.error(err);
      toast(err.response?.data?.message || 'Failed to send catalog via WhatsApp', 'error');
    } finally {
      setSharing(false);
    }
  };

  const copyPublicLink = () => {
    const link = `${window.location.origin}/catalog`;
    navigator.clipboard.writeText(link);
    toast('Public Catalog link copied to clipboard!', 'success');
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page" style={{ padding: '2rem', fontFamily: 'Inter, sans-serif' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>📖 Catalog Center</h1>
          <p className="page-subtitle" style={{ color: 'var(--text-secondary)', marginTop: '0.25rem' }}>Create, download, and share customized product catalogs in PDF &amp; image formats.</p>
        </div>
        <button
          type="button"
          onClick={copyPublicLink}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}
        >
          🔗 Copy Public Link
        </button>
      </div>

      {/* Main Grid: Control Panel & Marketing Center */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2.5rem' }}>
        
        {/* PDF Generator Card */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>📄</span>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Bulk PDF Catalog Creator</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.1rem 0 0 0' }}>Generate premium layouts for printing or sending.</p>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Category Filter</label>
              <select className="form-control" value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}>
                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Pricing Mode</label>
              <select className="form-control" value={selectedTier} onChange={e => setSelectedTier(e.target.value)}>
                <option value="retail">Retail Prices</option>
                <option value="distributor">Distributor Prices</option>
                <option value="super_stockist">Stockist Prices</option>
                <option value="hide">Hide Prices</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleDownloadPdf}
              disabled={pdfGenerating}
              style={{ fontWeight: 700, height: '42px' }}
            >
              {pdfGenerating ? 'Generating...' : '📥 Download PDF'}
            </button>
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => openShareModal('pdf')}
              style={{ fontWeight: 700, height: '42px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
            >
              <span>💬 Send via WA</span>
            </button>
          </div>
        </div>

        {/* Public Sharing Portal Card */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '12px', boxShadow: 'var(--shadow)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.75rem' }}>🌐</span>
            <div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>QR Code &amp; Public Link</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0.1rem 0 0 0' }}>Share catalog link so clients scan and browse online.</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '0.5rem 0' }}>
            <div style={{ backgroundColor: '#fff', padding: '0.5rem', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img 
                src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(window.location.origin + '/catalog')}`} 
                alt="QR Code" 
                style={{ width: '80px', height: '80px' }} 
              />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Scan URL:</span>
              <code style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-page)', padding: '0.25rem 0.5rem', borderRadius: '4px', wordBreak: 'break-all', color: 'var(--brand-primary)' }}>
                {window.location.origin}/catalog
              </code>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
            <a
              href={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(window.location.origin + '/catalog')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ flex: 1, textAlign: 'center', textDecoration: 'none', fontWeight: 600, display: 'inline-block', lineHeight: '36px' }}
            >
              🖼️ Get High-Res QR
            </a>
          </div>
        </div>

      </div>

      {/* Catalog Search & Filter Headers */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="🔍 Search product name or SKU..."
              className="form-control"
              style={{ width: '100%', height: '42px' }}
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem', whiteSpace: 'nowrap' }}>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: '0.5rem 1.25rem',
                fontSize: '0.85rem',
                fontWeight: 700,
                borderRadius: '25px',
                cursor: 'pointer',
                backgroundColor: selectedCategory === cat ? 'var(--brand-primary)' : 'var(--bg-card)',
                color: selectedCategory === cat ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: 'var(--shadow)',
                border: selectedCategory === cat ? 'none' : '1px solid var(--border)',
                transition: 'all 0.2s'
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Products Preview Grid */}
      <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '1rem' }}>
        Product Listing ({filteredProducts.length} Items)
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {filteredProducts.map(p => {
          const prodId = p.id || p._id;
          return (
            <div
              key={prodId}
              className="card"
              style={{
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow)',
                display: 'flex',
                flexDirection: 'column',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
            >
              {/* Product Thumbnail */}
              <div style={{ width: '100%', height: '180px', backgroundColor: 'var(--bg-page)', overflow: 'hidden', position: 'relative' }}>
                <img
                  src={p.image ? resolveAssetUrl(p.image) : '/placeholder.png'}
                  alt={p.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => { e.target.src = '/placeholder.png'; }}
                />
                <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'var(--brand-primary)', color: '#ffffff', fontSize: '0.7rem', fontWeight: 800, padding: '0.25rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                  {p.category}
                </div>
              </div>

              {/* Product Details */}
              <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>{p.name}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>SKU: {p.sku}</span>
                </div>

                {/* Technical specs block */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', paddingBottom: '0.25rem', borderBottom: '1px solid var(--border)' }}>
                  <span>Pack Size:</span>
                  <span style={{ fontWeight: 700 }}>{p.packSize || `1 ${p.unit || 'pcs'}`}</span>
                </div>

                {/* Price indicators */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.25rem 0' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>MRP: ₹{Number(p.mrp || p.sellingPrice).toFixed(2)}</span>
                  <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--brand-primary)' }}>
                    {getTierPriceDisplay(p)}
                  </span>
                </div>

                {/* Visual Image Catalog aspect ratios download buttons */}
                <div style={{ marginTop: '0.75rem', borderTop: '1px dashed var(--border)', paddingTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
                    🖼️ SVG Poster Aspect Ratios:
                  </span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                    {[
                      { format: '1080x1080', label: 'Square (1:1)' },
                      { format: '1080x1350', label: 'Feed (4:5)' },
                      { format: '1080x1920', label: 'Story (9:16)' }
                    ].map(aspect => (
                      <button
                        key={aspect.format}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDownloadImage(p, aspect.format)}
                        disabled={imageGeneratingId === `${prodId}_${aspect.format}`}
                        style={{ fontSize: '0.7rem', padding: '0.35rem 0', fontWeight: 700 }}
                        title={`Download SVG Poster in ${aspect.format}`}
                      >
                        {imageGeneratingId === `${prodId}_${aspect.format}` ? '...' : aspect.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Individual Share Action */}
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => openShareModal('image', p)}
                  style={{ width: '100%', marginTop: '0.5rem', fontWeight: 700 }}
                >
                  💬 Share Product Poster (WhatsApp)
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Share Modal Dialog */}
      {shareModal && (
        <Modal
          title={shareModal.format === 'pdf' ? 'Share PDF Catalog via WhatsApp' : `Share Poster for ${shareModal.product?.name}`}
          onClose={() => setShareModal(null)}
          footer={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShareModal(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleWhatsAppShare} disabled={sharing}>
                {sharing ? 'Sending...' : '🚀 Send WhatsApp'}
              </button>
            </>
          }
        >
          <form onSubmit={handleWhatsAppShare} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label>Select Customer Profile (Pre-populates details)</label>
              <select 
                className="form-control" 
                value={shareCustomerId} 
                onChange={e => handleCustomerSelect(e.target.value)}
              >
                <option value="">-- Custom Recipient / Manual Number --</option>
                {customers.map(cust => (
                  <option key={cust.id || cust._id} value={cust.id || cust._id}>
                    {cust.name} ({cust.companyName || 'No Company'}) - {cust.phone || 'No Phone'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>WhatsApp Number (with country code, e.g. +91XXXXXXXXXX or 91XXXXXXXXXX) *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 917010602115"
                value={sharePhone}
                onChange={e => setSharePhone(e.target.value)}
                required
              />
            </div>

            <div style={{ backgroundColor: 'var(--bg-page)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--brand-primary)', display: 'block', marginBottom: '0.25rem' }}>
                Message Preview:
              </span>
              <p style={{ margin: 0, whiteSpace: 'pre-line', color: 'var(--text-secondary)' }}>
                {shareModal.format === 'pdf' 
                  ? `Hello [Customer Name],\n\nThank you for your interest.\n\nPlease find our latest product catalog attached.\n\nRegards,\n[Company Name]` 
                  : `Hello [Customer Name],\n\nThank you for your interest.\n\nPlease find our latest product catalog attached.\n\nView product online: ${window.location.origin}/catalog?search=${encodeURIComponent(shareModal.product?.name || '')}`
                }
              </p>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
}
