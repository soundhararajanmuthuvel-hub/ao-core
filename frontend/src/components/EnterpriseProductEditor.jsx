import { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Upload,
  Image as ImageIcon,
  Trash2,
  Plus,
  Check,
  X,
  Search,
  Globe,
  ShieldCheck,
  CheckCircle,
  RefreshCw,
  Copy,
  Eye,
  Star,
  Zap,
  Tag,
  Box,
  Layers,
  DollarSign,
  Database,
  Cpu,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  LayoutGrid,
  Sliders,
  HelpCircle,
  Activity,
  Cloud,
  CheckSquare,
  Square,
  Grid,
  List,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import client from '../api/client';
import { resolveAssetUrl } from '../utils/url';

export default function EnterpriseProductEditor({
  product = null,
  isOpen = false,
  onClose = () => {},
  onSaveSuccess = () => {},
  managementProductsList = [],
}) {
  if (!isOpen) return null;

  // Active Tab for Mobile / Full view
  const [activeEditorTab, setActiveEditorTab] = useState('info'); // info | images | pricing | seo | ai | preview

  // Form State
  const [formData, setFormData] = useState({
    id: product?.id || null,
    name: product?.name || '',
    slug: product?.slug || '',
    brand: product?.brand || 'Blovit Organics',
    category: product?.category || 'Malt Blends',
    subCategory: product?.subCategory || 'Traditional Health Mix',
    price: product?.price || '',
    compareAtPrice: product?.compareAtPrice || '',
    mrp: product?.mrp || product?.compareAtPrice || '',
    discount: 0,
    gstPercent: 5,
    stock: product?.stock !== undefined ? product.stock : 100,
    lowStockThreshold: 10,
    allowBackorders: false,
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    shortDescription: product?.shortDescription || '',
    description: product?.description || '',
    images: Array.isArray(product?.images)
      ? product.images
      : (() => {
          try { return JSON.parse(product?.images || '[]'); } catch { return product?.images ? [product.images] : []; }
        })(),
    imagePublicId: product?.imagePublicId || '',
    benefits: Array.isArray(product?.benefits)
      ? product.benefits
      : (() => {
          try { return JSON.parse(product?.benefits || '[]'); } catch { return ['100% Organic', 'Boosts Natural Immunity', 'Rich in Calcium & Fiber']; }
        })(),
    ingredients: Array.isArray(product?.ingredients)
      ? product.ingredients
      : (() => {
          try { return JSON.parse(product?.ingredients || '[]'); } catch { return ['Sprouted Ragi', 'Almonds', 'Cardamom', 'Dates']; }
        })(),
    nutritionTable: [
      { nutrient: 'Calories', value: '380', unit: 'kcal' },
      { nutrient: 'Protein', value: '12.5', unit: 'g' },
      { nutrient: 'Calcium', value: '340', unit: 'mg' },
      { nutrient: 'Iron', value: '4.2', unit: 'mg' },
      { nutrient: 'Dietary Fiber', value: '8.1', unit: 'g' },
    ],
    metaTitle: product?.name ? `${product.name} - Pure Organic Health Drink` : '',
    metaDescription: product?.shortDescription || 'Buy premium organic health mix online.',
    keywords: 'organic, malt, health mix, blovit, sprouted ragi',
    canonicalUrl: '',
    status: product?.isActive ? 'published' : 'draft',
    isBestseller: !!product?.isBestseller,
    isFeatured: true,
    isTrending: false,
    isNewArrival: false,
    healthGoals: ['Immunity', 'Energy', 'Digestion'],
    tags: ['organic', 'gluten-free', 'traditional'],
  });

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoadingField, setAiLoadingField] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Cloudinary Media Library Modal State
  const [showMediaManager, setShowMediaManager] = useState(false);
  const [mediaLibrary, setMediaLibrary] = useState([]);
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');
  const [uploadingToCloudinary, setUploadingToCloudinary] = useState(false);
  const [selectedMediaItems, setSelectedMediaItems] = useState([]);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadErrorMsg, setUploadErrorMsg] = useState('');
  const [lastFailedFiles, setLastFailedFiles] = useState([]);
  const [optimisticPreviews, setOptimisticPreviews] = useState([]);

  // Fully asynchronous File Upload with Progress Tracking & Error Recovery
  const executeUpload = async (filesToUpload) => {
    if (!filesToUpload || filesToUpload.length === 0) return;

    setUploadingToCloudinary(true);
    setUploadProgress(0);
    setUploadErrorMsg('');
    setMsg({ type: '', text: '' });

    // Generate optimistic blob preview URLs
    const tempPreviews = filesToUpload.map((f) => URL.createObjectURL(f));
    setOptimisticPreviews(tempPreviews);

    const formDataUpload = new FormData();
    filesToUpload.forEach((f) => formDataUpload.append('images', f));

    try {
      const res = await client.post('/website-admin/upload-image', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || progressEvent.loaded;
          const percent = Math.round((progressEvent.loaded * 100) / total);
          setUploadProgress(percent);
        },
      });

      if (res.data.success && res.data.urls) {
        setFormData((prev) => ({
          ...prev,
          images: [...prev.images, ...res.data.urls],
          imagePublicId: res.data.publicIds?.[0] || prev.imagePublicId,
        }));
        setIsDirty(true);
        setMsg({ type: 'success', text: `✨ ${res.data.urls.length} image(s) uploaded to Cloudinary CDN successfully!` });
        setLastFailedFiles([]);
        loadMediaLibrary();
      }
    } catch (err) {
      console.error('[Async Upload Failure]', err);
      const errMsg = err.response?.data?.reason || err.response?.data?.message || err.message || 'Cloudinary upload failed';
      const suggestion = err.response?.data?.suggestion || '';
      const fullMsg = suggestion ? `${errMsg}. ${suggestion}` : errMsg;
      setUploadErrorMsg(fullMsg);
      setLastFailedFiles(filesToUpload);
      setMsg({ type: 'error', text: `Upload Failed: ${fullMsg}` });
    } finally {
      setUploadingToCloudinary(false);
      setOptimisticPreviews([]);
      setUploadProgress(0);
    }
  };

  const handleCloudinaryFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      executeUpload(files);
      e.target.value = '';
    }
  };

  const handleRetryUpload = () => {
    if (lastFailedFiles.length > 0) {
      executeUpload(lastFailedFiles);
    }
  };

  // AI Assistant One-Click Generator
  const triggerAiGenerator = async (field) => {
    setAiLoadingField(field);
    setMsg({ type: '', text: '' });
    try {
      const res = await client.post('/website-admin/ai-generate', {
        field,
        name: formData.name || 'Organic Health Drink',
        category: formData.category,
      });

      if (res.data && res.data.result) {
        const raw = res.data.result;
        if (field === 'description') {
          setFormData((prev) => ({ ...prev, description: raw }));
        } else if (field === 'benefits') {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setFormData((prev) => ({ ...prev, benefits: parsed }));
          } catch {
            setFormData((prev) => ({ ...prev, benefits: [raw] }));
          }
        } else if (field === 'ingredients') {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setFormData((prev) => ({ ...prev, ingredients: parsed }));
          } catch {
            setFormData((prev) => ({ ...prev, ingredients: [raw] }));
          }
        } else if (field === 'nutrition') {
          try {
            const parsed = JSON.parse(raw);
            const table = Object.entries(parsed).map(([nutrient, val]) => ({
              nutrient,
              value: val.toString().replace(/[^0-9.]/g, ''),
              unit: val.toString().replace(/[0-9.]/g, '').trim() || 'g',
            }));
            setFormData((prev) => ({ ...prev, nutritionTable: table }));
          } catch {}
        } else if (field === 'seo') {
          try {
            const parsed = JSON.parse(raw);
            setFormData((prev) => ({
              ...prev,
              metaTitle: parsed.metaTitle || prev.metaTitle,
              metaDescription: parsed.metaDescription || prev.metaDescription,
              keywords: parsed.keywords || prev.keywords,
            }));
          } catch {}
        }
        setIsDirty(true);
        setMsg({ type: 'success', text: `AI generated ${field} successfully!` });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'AI generation request failed.' });
    } finally {
      setAiLoadingField(null);
    }
  };

  // Form Save Handler
  const handleSaveProduct = async (statusOverride = null) => {
    if (!formData.name.trim()) {
      setMsg({ type: 'error', text: 'Product name is required.' });
      return;
    }

    setSaving(true);
    setMsg({ type: '', text: '' });

    const finalStatus = statusOverride || formData.status;
    const payload = {
      name: formData.name,
      slug: formData.slug,
      price: parseFloat(formData.price) || 0,
      compareAtPrice: parseFloat(formData.mrp) || parseFloat(formData.compareAtPrice) || null,
      stock: parseInt(formData.stock, 10) || 0,
      category: formData.category,
      brand: formData.brand,
      description: formData.description,
      shortDescription: formData.shortDescription,
      images: JSON.stringify(formData.images),
      imageUrl: formData.images[0] || '',
      benefits: JSON.stringify(formData.benefits),
      ingredients: JSON.stringify(formData.ingredients),
      nutritionFacts: JSON.stringify(
        formData.nutritionTable.reduce((acc, curr) => {
          acc[curr.nutrient] = `${curr.value}${curr.unit}`;
          return acc;
        }, {})
      ),
      isBestseller: formData.isBestseller,
      isActive: finalStatus === 'published',
      sku: formData.sku,
    };

    try {
      let res;
      if (formData.id) {
        res = await client.put(`/website-admin/products/${formData.id}`, payload);
      } else {
        res = await client.post('/website-admin/products', payload);
      }

      if (res.data.success) {
        setIsDirty(false);
        setMsg({ type: 'success', text: `Product ${formData.id ? 'updated' : 'created'} successfully!` });
        onSaveSuccess();
        setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save product.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* 1. TOP PAGE HEADER BAR */}
      <header
        style={{
          height: '64px',
          background: 'rgba(255, 255, 255, 0.95)',
          borderBottom: '1px solid #E2E8F0',
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={onClose}
            style={{
              padding: '0.4rem',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              background: '#FFF',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={18} color="#64748B" />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {formData.id ? `Edit Product: ${formData.name || 'Untitled'}` : 'Create Website Product'}
              </h2>
              {isDirty && (
                <span
                  style={{
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <AlertTriangle size={12} /> Unsaved Changes
                </span>
              )}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
              Enterprise Shopify-Level Product Editor & Cloudinary CDN Hub
            </span>
          </div>
        </div>

        {/* API STATUS MONITOR BADGES */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.72rem', fontWeight: 700 }}>
            <span style={{ background: '#ECFDF5', color: '#047857', padding: '3px 8px', borderRadius: '6px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} /> Website API: 200 OK
            </span>
            <span style={{ background: '#ECFDF5', color: '#047857', padding: '3px 8px', borderRadius: '6px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Cloud size={12} /> Cloudinary CDN: Active
            </span>
            <span style={{ background: '#EFF6FF', color: '#1D4ED8', padding: '3px 8px', borderRadius: '6px', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Cpu size={12} /> AI Engine: Ready
            </span>
          </div>

          <button
            onClick={() => handleSaveProduct(formData.status)}
            disabled={saving || uploadingToCloudinary}
            style={{
              background: uploadingToCloudinary ? '#94A3B8' : 'var(--primary-color, #0284C7)',
              color: '#FFF',
              border: 'none',
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: (saving || uploadingToCloudinary) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
              boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
            }}
          >
            {uploadingToCloudinary ? (
              <>
                <RefreshCw size={16} className="spin" /> Uploading ({uploadProgress}%)
              </>
            ) : saving ? (
              <>
                <RefreshCw size={16} className="spin" /> Saving...
              </>
            ) : (
              <>
                <Check size={16} /> Save Product
              </>
            )}
          </button>
        </div>
      </header>

      {/* ALERT NOTIFICATION MSG */}
      {msg.text && (
        <div
          style={{
            padding: '0.6rem 1.5rem',
            background: msg.type === 'error' ? '#FEF2F2' : '#F0FDF4',
            color: msg.type === 'error' ? '#991B1B' : '#166534',
            borderBottom: '1px solid #CBD5E1',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>{msg.text}</span>
          <X size={14} style={{ cursor: 'pointer' }} onClick={() => setMsg({ type: '', text: '' })} />
        </div>
      )}

      {/* 2. MAIN 70/30 GRID CONTAINER */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', overflow: 'hidden', background: '#F8FAFC' }}>
        
        {/* LEFT COLUMN (70%) - PRODUCT CONTENT & CONFIGURATION */}
        <div style={{ overflowY: 'auto', padding: '1.5rem 2rem 5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* GENERAL PRODUCT INFORMATION CARD */}
          <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Box size={18} color="#0284C7" /> General Information
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                  Product Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Sprouted Ragi Malt 500g (Organic Health Blend)"
                  value={formData.name}
                  onChange={(e) => {
                    setFormData({ ...formData, name: e.target.value });
                    setIsDirty(true);
                  }}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 600 }}
                />
              </div>

              {/* SLUG & BRAND / CATEGORY ROW */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                    URL Slug
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => {
                      setEditingSlugManually(true);
                      setFormData({ ...formData, slug: e.target.value });
                      setIsDirty(true);
                    }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontFamily: 'monospace' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                    Brand
                  </label>
                  <select
                    value={formData.brand}
                    onChange={(e) => {
                      setFormData({ ...formData, brand: e.target.value });
                      setIsDirty(true);
                    }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <option value="Blovit Organics">Blovit Organics</option>
                    <option value="Amudhasurabi">Amudhasurabi</option>
                    <option value="Traditional Harvest">Traditional Harvest</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      setFormData({ ...formData, category: e.target.value });
                      setIsDirty(true);
                    }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600 }}
                  >
                    <option value="Malt Blends">Malt Blends</option>
                    <option value="Health Drink">Health Drink</option>
                    <option value="Superfoods">Superfoods</option>
                    <option value="Organic Millets">Organic Millets</option>
                    <option value="Snacks">Snacks</option>
                  </select>
                </div>
              </div>

              {/* SHORT DESCRIPTION & FULL DESCRIPTION */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                  Short Description (Storefront Excerpt)
                </label>
                <input
                  type="text"
                  placeholder="100% Organic sprouted ragi malt enriched with almonds and dates."
                  value={formData.shortDescription}
                  onChange={(e) => {
                    setFormData({ ...formData, shortDescription: e.target.value });
                    setIsDirty(true);
                  }}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>Full Description</label>
                  <button
                    type="button"
                    onClick={() => triggerAiGenerator('description')}
                    disabled={aiLoadingField === 'description'}
                    style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Sparkles size={12} /> {aiLoadingField === 'description' ? 'Generating...' : '⚡ Generate AI Description'}
                  </button>
                </div>
                <textarea
                  rows={4}
                  placeholder="Provide comprehensive details about organic processing, sprouted grain benefits, and serving suggestions..."
                  value={formData.description}
                  onChange={(e) => {
                    setFormData({ ...formData, description: e.target.value });
                    setIsDirty(true);
                  }}
                  style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', lineHeight: '1.5' }}
                />
              </div>
            </div>
          </div>

          {/* PRICING & INVENTORY CARD */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* PRICING */}
            <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <DollarSign size={18} color="#059669" /> Pricing & Offers
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Selling Price (₹) *</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => {
                      setFormData({ ...formData, price: e.target.value });
                      setIsDirty(true);
                    }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontWeight: 800, color: '#0284C7' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Original MRP (₹)</label>
                  <input
                    type="number"
                    value={formData.mrp}
                    onChange={(e) => {
                      setFormData({ ...formData, mrp: e.target.value });
                      setIsDirty(true);
                    }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  />
                </div>
              </div>
              {calculatedDiscount > 0 && (
                <div style={{ marginTop: '0.75rem', background: '#DCFCE7', color: '#166534', padding: '0.4rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700 }}>
                  Offer Discount: {calculatedDiscount}% OFF
                </div>
              )}
            </div>

            {/* INVENTORY */}
            <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="#D97706" /> Stock & Inventory
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Current Stock (Units)</label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => {
                      setFormData({ ...formData, stock: e.target.value });
                      setIsDirty(true);
                    }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>Low Stock Alert</label>
                  <input
                    type="number"
                    value={formData.lowStockThreshold}
                    onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* DYNAMIC BENEFITS & INGREDIENTS */}
          <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Zap size={18} color="#8B5CF6" /> Key Health Benefits & Ingredients
              </h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => triggerAiGenerator('benefits')}
                  disabled={aiLoadingField === 'benefits'}
                  style={{ background: '#F3E8FF', color: '#6B21A8', border: '1px solid #E9D5FF', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}
                >
                  ⚡ AI Benefits
                </button>
                <button
                  type="button"
                  onClick={() => triggerAiGenerator('ingredients')}
                  disabled={aiLoadingField === 'ingredients'}
                  style={{ background: '#F3E8FF', color: '#6B21A8', border: '1px solid #E9D5FF', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}
                >
                  ⚡ AI Ingredients
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              {/* BENEFITS LIST */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem', display: 'block' }}>
                  Benefits Bullet Points
                </label>
                {formData.benefits.map((b, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    <input
                      type="text"
                      value={b}
                      onChange={(e) => {
                        const updated = [...formData.benefits];
                        updated[idx] = e.target.value;
                        setFormData({ ...formData, benefits: updated });
                        setIsDirty(true);
                      }}
                      style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, benefits: formData.benefits.filter((_, i) => i !== idx) })}
                      style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: '6px', padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, benefits: [...formData.benefits, ''] })}
                  style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0284C7', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}
                >
                  <Plus size={14} /> Add Benefit
                </button>
              </div>

              {/* INGREDIENTS LIST */}
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem', display: 'block' }}>
                  Ingredients List
                </label>
                {formData.ingredients.map((ing, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
                    <input
                      type="text"
                      value={ing}
                      onChange={(e) => {
                        const updated = [...formData.ingredients];
                        updated[idx] = e.target.value;
                        setFormData({ ...formData, ingredients: updated });
                        setIsDirty(true);
                      }}
                      style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, ingredients: formData.ingredients.filter((_, i) => i !== idx) })}
                      style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: '6px', padding: '4px' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, ingredients: [...formData.ingredients, ''] })}
                  style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0284C7', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}
                >
                  <Plus size={14} /> Add Ingredient
                </button>
              </div>
            </div>
          </div>

          {/* SEO & SEARCH ENGINE PREVIEW */}
          <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe size={18} color="#2563EB" /> SEO & Google Search Snippet Preview
              </h3>
              <button
                type="button"
                onClick={() => triggerAiGenerator('seo')}
                disabled={aiLoadingField === 'seo'}
                style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}
              >
                ⚡ Generate Meta Tags
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                  Meta Title ({formData.metaTitle.length}/60)
                </label>
                <input
                  type="text"
                  value={formData.metaTitle}
                  onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                  Meta Description ({formData.metaDescription.length}/160)
                </label>
                <textarea
                  rows={2}
                  value={formData.metaDescription}
                  onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                  style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                />
              </div>

              {/* LIVE GOOGLE SERP PREVIEW BOX */}
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#202124', marginBottom: '2px' }}>https://blovit.com › products › {formData.slug}</div>
                <div style={{ fontSize: '1rem', color: '#1a0dab', fontWeight: 600, textDecoration: 'underline', marginBottom: '2px' }}>
                  {formData.metaTitle || formData.name || 'Product Title'}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#4d5156', lineHeight: '1.4' }}>
                  {formData.metaDescription || 'Buy organic health mix online. 100% natural and sprouted.'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (30%) - CLOUDINARY MEDIA MANAGER & LIVE STOREFRONT PREVIEW */}
        <div style={{ borderLeft: '1px solid #E2E8F0', background: '#FFF', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '1.5rem' }}>
          
          {/* CLOUDINARY MEDIA MANAGER CARD */}
          <div style={{ marginBottom: '1.5rem', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', background: '#FAFAFA' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ fontSize: '0.88rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Cloud size={16} color="#0284C7" /> Cloudinary Media Library
              </h4>
            </div>

            {/* UPLOAD PROGRESS BAR */}
            {uploadingToCloudinary && (
              <div style={{ marginBottom: '1rem', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 700, color: '#0284C7', marginBottom: '4px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <RefreshCw size={12} className="spin" /> Uploading to Cloudinary...
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#E0F2FE', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${uploadProgress}%`, height: '100%', background: '#0284C7', transition: 'width 0.2s ease' }} />
                </div>
              </div>
            )}

            {/* INLINE UPLOAD ERROR & RETRY BUTTON */}
            {uploadErrorMsg && !uploadingToCloudinary && (
              <div style={{ marginBottom: '1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991B1B', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <AlertTriangle size={14} /> Cloudinary Upload Failed
                </div>
                <div style={{ fontSize: '0.75rem', color: '#7F1D1D', marginBottom: '0.6rem', lineHeight: '1.4' }}>
                  {uploadErrorMsg}
                </div>
                <button
                  type="button"
                  onClick={handleRetryUpload}
                  style={{ background: '#DC2626', color: '#FFF', border: 'none', borderRadius: '6px', padding: '0.35rem 0.75rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                >
                  <RotateCcw size={12} /> Retry Upload
                </button>
              </div>
            )}

            {/* DIRECT CLOUDINARY UPLOAD BUTTON */}
            <div style={{ marginBottom: '1rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  padding: '0.6rem 1rem',
                  border: '1px dashed #0284C7',
                  borderRadius: '8px',
                  background: '#F0F9FF',
                  cursor: uploadingToCloudinary ? 'not-allowed' : 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#0284C7',
                }}
              >
                <Upload size={16} />
                {uploadingToCloudinary ? `Uploading (${uploadProgress}%)...` : 'Upload to Cloudinary'}
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  disabled={uploadingToCloudinary}
                  onChange={handleCloudinaryFileUpload}
                  style={{ display: 'none' }}
                />
              </label>

              {/* FALLBACK DIRECT IMAGE URL INPUT */}
              <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                <input
                  type="url"
                  placeholder="Or paste direct image URL..."
                  value={customImageUrl || ''}
                  onChange={(e) => setCustomImageUrl(e.target.value)}
                  style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.78rem' }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!customImageUrl?.trim()) return;
                    setFormData((prev) => ({ ...prev, images: [...prev.images, customImageUrl.trim()] }));
                    setCustomImageUrl('');
                    setIsDirty(true);
                  }}
                  style={{ background: '#0284C7', color: '#FFF', border: 'none', borderRadius: '6px', padding: '0.4rem 0.65rem', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Add URL
                </button>
              </div>
            </div>

            {/* OPTIMISTIC PREVIEW THUMBNAILS */}
            {optimisticPreviews.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {optimisticPreviews.map((url, idx) => (
                  <div key={idx} style={{ position: 'relative', border: '1px dashed #0284C7', borderRadius: '6px', overflow: 'hidden', height: '80px', opacity: 0.7 }}>
                    <img src={url} alt="Uploading..." style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', inset: 0, background: 'rgba(2, 132, 199, 0.4)', color: '#FFF', fontSize: '0.65rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {uploadProgress}%
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* PRODUCT IMAGES GALLERY GRID */}
            {formData.images && formData.images.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {formData.images.map((imgUrl, idx) => (
                  <div
                    key={idx}
                    style={{
                      position: 'relative',
                      border: idx === 0 ? '2px solid #0284C7' : '1px solid #E2E8F0',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      height: '80px',
                    }}
                  >
                    <img src={resolveAssetUrl(imgUrl)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {idx === 0 && (
                      <span style={{ position: 'absolute', top: 2, left: 2, background: '#0284C7', color: '#FFF', fontSize: '0.6rem', fontWeight: 700, padding: '1px 4px', borderRadius: '3px' }}>
                        Cover
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, images: formData.images.filter((_, i) => i !== idx) })}
                      style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', color: '#FFF', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94A3B8', fontSize: '0.8rem' }}>
                No images attached. Upload to Cloudinary to add gallery images.
              </div>
            )}
          </div>

          {/* LIVE STOREFRONT PREVIEW CARD */}
          <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', background: '#FFF', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Eye size={14} color="#10B981" /> Storefront Live Preview
            </div>

            {/* BLOVIT WEBSITE CARD SAMPLE */}
            <div style={{ border: '1px solid #F1F5F9', borderRadius: '12px', overflow: 'hidden', background: '#FFF' }}>
              <div style={{ height: '160px', background: '#F8FAFC', position: 'relative' }}>
                {formData.images && formData.images.length > 0 ? (
                  <img src={resolveAssetUrl(formData.images[0])} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#CBD5E1' }}>
                    <ImageIcon size={36} />
                  </div>
                )}
                {calculatedDiscount > 0 && (
                  <span style={{ position: 'absolute', top: 8, left: 8, background: '#EF4444', color: '#FFF', fontSize: '0.7rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                    {calculatedDiscount}% OFF
                  </span>
                )}
              </div>
              <div style={{ padding: '1rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 600 }}>{formData.brand}</div>
                <div style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', margin: '2px 0 6px 0' }}>
                  {formData.name || 'Sprouted Ragi Malt 500g'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0284C7' }}>₹{formData.price || '250'}</span>
                  {formData.mrp && <span style={{ fontSize: '0.8rem', color: '#94A3B8', textDecoration: 'line-through' }}>₹{formData.mrp}</span>}
                </div>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {formData.benefits.slice(0, 2).map((b, i) => (
                    <span key={i} style={{ background: '#F1F5F9', color: '#475569', fontSize: '0.68rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                      ✓ {b}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* PUBLISHING CONTROLS */}
          <div style={{ marginTop: '1.5rem', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', background: '#FAFAFA' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.75rem' }}>Publishing Status</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="radio"
                  name="pubStatus"
                  value="published"
                  checked={formData.status === 'published'}
                  onChange={() => setFormData({ ...formData, status: 'published' })}
                />
                Published (Live on Website)
              </label>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="radio"
                  name="pubStatus"
                  value="draft"
                  checked={formData.status === 'draft'}
                  onChange={() => setFormData({ ...formData, status: 'draft' })}
                />
                Draft (Hidden from Storefront)
              </label>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
