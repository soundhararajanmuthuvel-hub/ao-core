import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  RefreshCw,
  AlertTriangle,
  ArrowLeft,
  Settings,
  DollarSign,
  Database,
  Hammer,
  Globe,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Search,
  CheckCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import client from '../api/client';
import { resolveAssetUrl } from '../utils/url';
import ErrorBoundary from './ErrorBoundary';

export default function EnterpriseProductEditor({
  product = null,
  isOpen = false,
  onClose = () => {},
  onSaveSuccess = () => {},
  managementProductsList = [],
  mode = 'full',
}) {
  if (!isOpen) return null;

  // Normalize ID (handle both SQL id and legacy mongo-like _id)
  const productId = product?.id || product?._id || null;

  // Form State
  const [formData, setFormData] = useState({
    id: productId,
    name: product?.name || '',
    slug: product?.slug || '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    category: product?.category || 'General',
    subCategory: product?.subCategory || '',
    brand: product?.brand || 'Blovit Organics',
    unit: product?.unit || 'pcs',
    productType: product?.productType || 'trading',
    hsnCode: product?.hsnCode || product?.gstClass || '',
    gstPercent: product?.gstPercent !== undefined ? product.gstPercent : 5,
    status: product?.status || 'Draft',
    isActive: product?.isActive !== undefined ? !!product.isActive : true,

    // Pricing
    purchasePrice: product?.purchasePrice || '',
    costPrice: product?.costPrice || '',
    sellingPrice: product?.sellingPrice || product?.price || '',
    price: product?.sellingPrice || product?.price || '',
    mrp: product?.mrp || product?.compareAtPrice || '',
    compareAtPrice: product?.mrp || product?.compareAtPrice || '',
    wholesalePrice: product?.wholesalePrice || '',
    distributorPrice: product?.distributorPrice || '',
    dealerPrice: product?.dealerPrice || '',

    // Inventory
    openingStock: product?.openingStock || 0,
    stock: product?.stock !== undefined ? product.stock : 0,
    minStock: product?.minStock || 0,
    maxStock: product?.maxStock || 0,
    reorderLevel: product?.reorderLevel || 0,
    lowStockThreshold: product?.lowStockThreshold || 10,

    // Manufacturing / Advanced
    bom: product?.bom || '',
    recipe: product?.recipe || '',
    shelfLife: product?.shelfLife || '',
    batchTracking: !!product?.batchTracking,
    expiryTracking: !!product?.expiryTracking,

    // Website Publishing (MASTER TOGGLE)
    isPublished: !!(product?.isPublished || product?.publishToWebsite),
    publishToWebsite: !!(product?.isPublished || product?.publishToWebsite),

    // Website Information
    images: Array.isArray(product?.images) ? product.images : (() => {
      try { return JSON.parse(product?.images || '[]'); } catch { return product?.imageUrl ? [product.imageUrl] : []; }
    })(),
    imageUrl: product?.imageUrl || product?.image || '',
    videoUrl: product?.videoUrl || '',
    shortDescription: product?.shortDescription || '',
    description: product?.description || '',
    highlights: product?.highlights || '',

    benefits: Array.isArray(product?.benefits) ? product.benefits : (() => {
      try { return JSON.parse(product?.benefits || '[]'); } catch { return []; }
    })(),
    ingredients: Array.isArray(product?.ingredients) ? product.ingredients : (() => {
      try { return JSON.parse(product?.ingredients || '[]'); } catch { return []; }
    })(),
    nutritionFacts: typeof product?.nutritionFacts === 'object' && product?.nutritionFacts !== null ? product.nutritionFacts : (() => {
      try { return JSON.parse(product?.nutritionFacts || '{}'); } catch { return {}; }
    })(),
    usageInstructions: product?.usageInstructions || '',
    faqs: Array.isArray(product?.faqs) ? product.faqs : (() => {
      try { return JSON.parse(product?.faqs || '[]'); } catch { return []; }
    })(),

    // Appearance & Badges
    isFeatured: !!product?.isFeatured,
    isBestseller: !!product?.isBestseller,
    isTrending: !!product?.isTrending,
    websiteLabels: Array.isArray(product?.websiteLabels) ? product.websiteLabels : (() => {
      try { return JSON.parse(product?.websiteLabels || '[]'); } catch { return []; }
    })(),
    healthGoals: Array.isArray(product?.healthGoals) ? product.healthGoals : (() => {
      try { return JSON.parse(product?.healthGoals || '[]'); } catch { return []; }
    })(),
    sortOrder: product?.sortOrder || 0,

    // Search Engine (SEO)
    seoTitle: product?.seoTitle || '',
    seoDescription: product?.seoDescription || '',
    seoKeywords: product?.seoKeywords || '',
    canonicalUrl: product?.canonicalUrl || '',
    openGraphImage: product?.openGraphImage || '',
    schemaData: product?.schemaData || '',
  });

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoadingField, setAiLoadingField] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [showHideConfirm, setShowHideConfirm] = useState(false);

  // Sub-accordions under Website Details
  const [openWebsiteSections, setOpenWebsiteSections] = useState({
    photos: true,
    description: true,
    information: true,
    appearance: false,
    seo: false,
  });

  // ERP Advanced Collapsible (Wholesale tiers, BOM, Manufacturing)
  const [showAdvancedErp, setShowAdvancedErp] = useState(false);

  // Cloudinary Upload state
  const [uploadingToCloudinary, setUploadingToCloudinary] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Dynamic input states
  const [newBenefit, setNewBenefit] = useState('');
  const [newIngredient, setNewIngredient] = useState('');
  const [newFaqQ, setNewFaqQ] = useState('');
  const [newFaqA, setNewFaqA] = useState('');
  const [nutritionKey, setNutritionKey] = useState('');
  const [nutritionVal, setNutritionVal] = useState('');

  // Auto slug generation
  const [editingSlugManually, setEditingSlugManually] = useState(false);

  useEffect(() => {
    if (formData.name && !editingSlugManually && !formData.slug) {
      const generated = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setFormData((prev) => ({ ...prev, slug: generated }));
    }
  }, [formData.name, editingSlugManually]);

  const calculatedDiscount = useMemo(() => {
    const p = parseFloat(formData.price || formData.sellingPrice) || 0;
    const mrp = parseFloat(formData.mrp || formData.compareAtPrice) || 0;
    if (mrp > p && mrp > 0) {
      return Math.round(((mrp - p) / mrp) * 100);
    }
    return 0;
  }, [formData.price, formData.sellingPrice, formData.mrp, formData.compareAtPrice]);

  const toggleWebsiteSection = (sec) => {
    setOpenWebsiteSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  const handleToggleShowOnWebsite = () => {
    if (formData.isPublished) {
      // Switching from ON to OFF: Prompt friendly confirmation
      setShowHideConfirm(true);
    } else {
      // Switching from OFF to ON: Immediately reveal website details
      setFormData(prev => ({ ...prev, isPublished: true, publishToWebsite: true }));
      setIsDirty(true);
    }
  };

  const confirmHideFromWebsite = () => {
    setFormData(prev => ({ ...prev, isPublished: false, publishToWebsite: false }));
    setIsDirty(true);
    setShowHideConfirm(false);
  };

  const handleCloudinaryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingToCloudinary(true);
    setUploadProgress(25);
    const fd = new FormData();
    files.forEach(f => fd.append('images', f));

    try {
      setUploadProgress(60);
      const res = await client.post('/website-admin/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadProgress(90);
      if (res.data.success && res.data.urls) {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, ...res.data.urls],
          imageUrl: prev.imageUrl || res.data.urls[0]
        }));
        setIsDirty(true);
        setMsg({ type: 'success', text: 'Images uploaded successfully!' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to upload images: ' + (err.response?.data?.message || err.message) });
    } finally {
      setUploadingToCloudinary(false);
      setUploadProgress(0);
    }
  };

  const triggerAiGenerator = async (field) => {
    setAiLoadingField(field);
    setMsg({ type: '', text: '' });
    try {
      const res = await client.post('/website-admin/ai-generate', {
        field,
        name: formData.name || 'Organic Health Product',
        category: formData.category,
      });

      if (res.data && res.data.result) {
        const raw = res.data.result;
        if (field === 'description') {
          setFormData(prev => ({ ...prev, description: raw }));
        } else if (field === 'shortDescription') {
          setFormData(prev => ({ ...prev, shortDescription: raw }));
        } else if (field === 'benefits') {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setFormData(prev => ({ ...prev, benefits: parsed }));
          } catch {
            setFormData(prev => ({ ...prev, benefits: [...prev.benefits, raw] }));
          }
        } else if (field === 'ingredients') {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) setFormData(prev => ({ ...prev, ingredients: parsed }));
          } catch {
            setFormData(prev => ({ ...prev, ingredients: [...prev.ingredients, raw] }));
          }
        }
        setIsDirty(true);
        setMsg({ type: 'success', text: `AI generated content for ${field} successfully!` });
      }
    } catch {
      setMsg({ type: 'error', text: 'AI assistant failed to generate content.' });
    } finally {
      setAiLoadingField(null);
    }
  };

  const handleSave = async () => {
    // 1. Basic validation
    if (!formData.name?.trim()) {
      setMsg({ type: 'error', text: 'Product Name is required.' });
      return;
    }

    const finalPrice = parseFloat(formData.sellingPrice || formData.price);
    if (isNaN(finalPrice) || finalPrice <= 0) {
      setMsg({ type: 'error', text: 'Selling Price is required and must be greater than zero.' });
      return;
    }

    // 2. Publication validation only when Show on Website is ON
    if (formData.isPublished) {
      const primaryImg = formData.images?.[0] || formData.imageUrl;
      if (!primaryImg) {
        setMsg({ type: 'error', text: 'At least one product image is required when Show on Website is ON.' });
        return;
      }
      if (!formData.slug?.trim() && !formData.name?.trim()) {
        setMsg({ type: 'error', text: 'Website slug or product name is required when Show on Website is ON.' });
        return;
      }
    }

    setSaving(true);
    setMsg({ type: '', text: '' });

    const payload = {
      ...formData,
      name: formData.name.trim(),
      price: finalPrice,
      sellingPrice: finalPrice,
      compareAtPrice: Number(formData.mrp || formData.compareAtPrice || 0),
      mrp: Number(formData.mrp || formData.compareAtPrice || 0),
      stock: Number(formData.stock || 0),
      openingStock: Number(formData.openingStock || 0),
      minStock: Number(formData.minStock || 0),
      maxStock: Number(formData.maxStock || 0),
      reorderLevel: Number(formData.reorderLevel || 0),
      lowStockThreshold: Number(formData.lowStockThreshold || 10),
      costPrice: Number(formData.costPrice || 0),
      purchasePrice: Number(formData.purchasePrice || 0),
      dealerPrice: Number(formData.dealerPrice || 0),
      distributorPrice: Number(formData.distributorPrice || 0),
      wholesalePrice: Number(formData.wholesalePrice || 0),
      gstPercent: Number(formData.gstPercent || 0),
      isPublished: !!formData.isPublished,
      publishToWebsite: !!formData.isPublished,
      status: formData.status || (formData.isPublished ? 'Published' : 'Draft'),
      imageUrl: formData.images?.[0] || formData.imageUrl || '',
      images: formData.images,
      galleryImages: formData.images,
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
        setMsg({ type: 'success', text: `Product "${formData.name}" saved successfully!` });
        onSaveSuccess();
        setTimeout(() => onClose(), 600);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save product.' });
    } finally {
      setSaving(false);
    }
  };

  const removeListItem = (field, idx) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== idx)
    }));
    setIsDirty(true);
  };

  const addBenefitItem = () => {
    if (newBenefit.trim()) {
      setFormData(prev => ({ ...prev, benefits: [...prev.benefits, newBenefit.trim()] }));
      setNewBenefit('');
      setIsDirty(true);
    }
  };

  const addIngredientItem = () => {
    if (newIngredient.trim()) {
      setFormData(prev => ({ ...prev, ingredients: [...prev.ingredients, newIngredient.trim()] }));
      setNewIngredient('');
      setIsDirty(true);
    }
  };

  const addFaqItem = () => {
    if (newFaqQ.trim() && newFaqA.trim()) {
      setFormData(prev => ({ ...prev, faqs: [...prev.faqs, { q: newFaqQ.trim(), a: newFaqA.trim() }] }));
      setNewFaqQ('');
      setNewFaqA('');
      setIsDirty(true);
    }
  };

  const addNutritionItem = () => {
    if (nutritionKey.trim() && nutritionVal.trim()) {
      setFormData(prev => ({
        ...prev,
        nutritionFacts: {
          ...prev.nutritionFacts,
          [nutritionKey.trim()]: nutritionVal.trim()
        }
      }));
      setNutritionKey('');
      setNutritionVal('');
      setIsDirty(true);
    }
  };

  const removeNutritionItem = (key) => {
    const updated = { ...formData.nutritionFacts };
    delete updated[key];
    setFormData(prev => ({ ...prev, nutritionFacts: updated }));
    setIsDirty(true);
  };

  const toggleLabel = (lbl) => {
    const current = [...formData.websiteLabels];
    if (current.includes(lbl)) {
      setFormData(prev => ({ ...prev, websiteLabels: current.filter(x => x !== lbl) }));
    } else {
      setFormData(prev => ({ ...prev, websiteLabels: [...current, lbl] }));
    }
    setIsDirty(true);
  };

  const toggleHealthGoal = (goal) => {
    const current = [...formData.healthGoals];
    if (current.includes(goal)) {
      setFormData(prev => ({ ...prev, healthGoals: current.filter(x => x !== goal) }));
    } else {
      setFormData(prev => ({ ...prev, healthGoals: [...current, goal] }));
    }
    setIsDirty(true);
  };

  return (
    <ErrorBoundary>
      <div style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      }}>
        {/* TOP HEADER */}
        <header style={{
          height: '64px',
          background: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0',
          padding: '0 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={onClose}
              type="button"
              style={{
                padding: '0.45rem',
                borderRadius: '8px',
                border: '1px solid #CBD5E1',
                background: '#FFFFFF',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                color: '#475569'
              }}
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {formData.id ? `Edit Product: ${formData.name || 'Untitled'}` : 'Add Product'}
                </h2>
                {isDirty && (
                  <span style={{
                    background: '#FEF3C7',
                    color: '#92400E',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <AlertTriangle size={12} /> Unsaved Changes
                  </span>
                )}
                {formData.id && (
                  <span style={{ fontSize: '0.75rem', color: '#64748B', fontFamily: 'monospace' }}>
                    ID: {formData.id}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '2px' }}>
                Master ERP Product & Website Integration
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#F8FAFC',
                color: '#475569',
                border: '1px solid #CBD5E1',
                padding: '0.55rem 1.1rem',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || uploadingToCloudinary}
              style={{
                background: '#0284C7',
                color: '#FFFFFF',
                border: 'none',
                padding: '0.55rem 1.35rem',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontSize: '0.85rem',
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)'
              }}
            >
              {saving ? <RefreshCw size={16} className="spin" /> : <Check size={16} />}
              {formData.id ? 'Save Changes' : 'Save Product'}
            </button>
          </div>
        </header>

        {/* NOTIFICATION MESSAGES */}
        {msg.text && (
          <div style={{
            padding: '0.65rem 1.5rem',
            background: msg.type === 'error' ? '#FEF2F2' : '#F0FDF4',
            color: msg.type === 'error' ? '#991B1B' : '#166534',
            borderBottom: '1px solid #CBD5E1',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{msg.text}</span>
            <button
              type="button"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'inherit' }}
              onClick={() => setMsg({ type: '', text: '' })}
            >
              ×
            </button>
          </div>
        )}

        {/* CONFIRM HIDE MODAL DIALOG */}
        {showHideConfirm && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
          }}>
            <div style={{
              background: '#FFF',
              borderRadius: '12px',
              padding: '1.5rem',
              maxWidth: '420px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)'
            }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                Hide this product from the website?
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#64748B', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
                The product will remain fully active in <strong>Inventory</strong>, <strong>Manufacturing</strong>, <strong>Billing</strong>, and <strong>Sales</strong>. Only its public visibility on the Blovit website will be turned off.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowHideConfirm(false)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid #CBD5E1',
                    background: '#FFF',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmHideFromWebsite}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#EF4444',
                    color: '#FFF',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  Hide Product
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MAIN SCROLLABLE FORM BODY */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#F1F5F9', padding: '1.5rem' }}>
          <div style={{ maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

            {/* CARD 1: NORMAL PRODUCT DETAILS */}
            <div style={{
              background: '#FFFFFF',
              borderRadius: '12px',
              padding: '1.5rem 1.75rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              border: '1px solid #E2E8F0'
            }}>
              <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Product Details
                </h3>
                <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  Standard ERP information used by Inventory, Billing, and Manufacturing.
                </span>
              </div>

              {/* Row 1: Product Name, SKU */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    placeholder="e.g. ABC Malt"
                    onChange={e => { setFormData(prev => ({ ...prev, name: e.target.value })); setIsDirty(true); }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.9rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    SKU
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    placeholder="e.g. ABC001"
                    onChange={e => { setFormData(prev => ({ ...prev, sku: e.target.value })); setIsDirty(true); }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'monospace', fontSize: '0.9rem' }}
                  />
                </div>
              </div>

              {/* Row 2: Category, Product Type, Unit, ERP Status */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Product Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    placeholder="e.g. Malt, Spices, Health"
                    onChange={e => { setFormData(prev => ({ ...prev, category: e.target.value })); setIsDirty(true); }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Product Type
                  </label>
                  <select
                    value={formData.productType}
                    onChange={e => { setFormData(prev => ({ ...prev, productType: e.target.value })); setIsDirty(true); }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.88rem', background: '#FFF' }}
                  >
                    <option value="BULK_PRODUCT">Bulk Product (Powder)</option>
                    <option value="RETAIL_PACK">Retail Pack Size</option>
                    <option value="RAW_MATERIAL">Raw Material</option>
                    <option value="trading">Trading Product</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Unit
                  </label>
                  <input
                    type="text"
                    value={formData.unit}
                    placeholder="pcs, kg, g, box"
                    onChange={e => { setFormData(prev => ({ ...prev, unit: e.target.value })); setIsDirty(true); }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Status
                  </label>
                  <select
                    value={formData.isActive ? 'Active' : 'Inactive'}
                    onChange={e => { setFormData(prev => ({ ...prev, isActive: e.target.value === 'Active' })); setIsDirty(true); }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.88rem', background: '#FFF' }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Selling Price, MRP, Stock, GST */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Selling Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={formData.sellingPrice || formData.price}
                    placeholder="250"
                    onChange={e => { setFormData(prev => ({ ...prev, sellingPrice: e.target.value, price: e.target.value })); setIsDirty(true); }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem', fontWeight: 700, color: '#0284C7' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    MRP (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.mrp || formData.compareAtPrice}
                    placeholder="300"
                    onChange={e => { setFormData(prev => ({ ...prev, mrp: e.target.value, compareAtPrice: e.target.value })); setIsDirty(true); }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    Stock
                  </label>
                  <input
                    type="number"
                    value={formData.stock}
                    placeholder="50"
                    onChange={e => { setFormData(prev => ({ ...prev, stock: e.target.value })); setIsDirty(true); }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                    GST (%)
                  </label>
                  <input
                    type="number"
                    value={formData.gstPercent}
                    placeholder="5"
                    onChange={e => { setFormData(prev => ({ ...prev, gstPercent: e.target.value })); setIsDirty(true); }}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.95rem' }}
                  />
                </div>
              </div>

              {/* Collapsible Trigger: Advanced ERP Information */}
              <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9' }}>
                <button
                  type="button"
                  onClick={() => setShowAdvancedErp(!showAdvancedErp)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#64748B',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {showAdvancedErp ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  {showAdvancedErp ? 'Hide Advanced ERP Fields (HSN, Barcode, Wholesale, Recipe)' : 'Show Advanced ERP Fields (HSN, Barcode, Wholesale, Recipe)'}
                </button>
              </div>

              {/* Collapsible Section: Advanced ERP */}
              {showAdvancedErp && (
                <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px dashed #E2E8F0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>HSN Code</label>
                      <input type="text" value={formData.hsnCode} placeholder="4, 6 or 8 digits" onChange={e => { setFormData(prev => ({ ...prev, hsnCode: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Barcode</label>
                      <input type="text" value={formData.barcode} onChange={e => { setFormData(prev => ({ ...prev, barcode: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Brand</label>
                      <input type="text" value={formData.brand} onChange={e => { setFormData(prev => ({ ...prev, brand: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Purchase Price (₹)</label>
                      <input type="number" value={formData.purchasePrice} onChange={e => { setFormData(prev => ({ ...prev, purchasePrice: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Wholesale Price (₹)</label>
                      <input type="number" value={formData.wholesalePrice} onChange={e => { setFormData(prev => ({ ...prev, wholesalePrice: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Distributor Price (₹)</label>
                      <input type="number" value={formData.distributorPrice} onChange={e => { setFormData(prev => ({ ...prev, distributorPrice: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Dealer Price (₹)</label>
                      <input type="number" value={formData.dealerPrice} onChange={e => { setFormData(prev => ({ ...prev, dealerPrice: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Connected BOM / Formula</label>
                      <input type="text" placeholder="BOM Code or Recipe ID" value={formData.bom} onChange={e => { setFormData(prev => ({ ...prev, bom: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Product Shelf Life</label>
                      <input type="text" placeholder="e.g. 12 Months" value={formData.shelfLife} onChange={e => { setFormData(prev => ({ ...prev, shelfLife: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* CARD 2: SHOW ON WEBSITE MASTER TOGGLE BANNER */}
            <div style={{
              background: formData.isPublished ? '#F0FDF4' : '#FFFFFF',
              border: formData.isPublished ? '2px solid #86EFAC' : '1px solid #E2E8F0',
              borderRadius: '12px',
              padding: '1.25rem 1.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  backgroundColor: formData.isPublished ? '#DCFCE7' : '#F1F5F9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.4rem'
                }}>
                  🌐
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                      Show on Website
                    </h4>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      backgroundColor: formData.isPublished ? '#16A34A' : '#64748B',
                      color: '#FFFFFF'
                    }}>
                      {formData.isPublished ? 'ON' : 'OFF'}
                    </span>
                  </div>
                  <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                    Turn this on to publish this product on the Blovit storefront.
                  </p>
                </div>
              </div>

              {/* Master Toggle Button */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={handleToggleShowOnWebsite}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '4px',
                    borderRadius: '24px',
                    border: formData.isPublished ? '1px solid #16A34A' : '1px solid #CBD5E1',
                    background: formData.isPublished ? '#16A34A' : '#E2E8F0',
                    cursor: 'pointer',
                    width: '64px',
                    height: '32px',
                    position: 'relative',
                    transition: 'background-color 0.2s ease',
                    outline: 'none'
                  }}
                  title={formData.isPublished ? 'Click to turn off website publishing' : 'Click to turn on website publishing'}
                >
                  <span style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    backgroundColor: '#FFFFFF',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    display: 'block',
                    transform: formData.isPublished ? 'translateX(32px)' : 'translateX(0)',
                    transition: 'transform 0.2s ease'
                  }} />
                </button>
              </div>
            </div>

            {/* CARD 3: DYNAMICALLY EXPANDING WEBSITE DETAILS ACCORDION */}
            {formData.isPublished && (
              <div style={{
                background: '#FFFFFF',
                borderRadius: '12px',
                border: '1px solid #E2E8F0',
                padding: '1.5rem 1.75rem',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1.25rem',
                animation: 'fadeIn 0.3s ease-in-out'
              }}>
                <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Globe size={20} color="#0284C7" />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                      Website Details
                    </h3>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                    Configure photos, description, ingredients, nutrition, and storefront search appearance.
                  </span>
                </div>

                {/* SUBSECTION 1: PRODUCT PHOTOS */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div
                    onClick={() => toggleWebsiteSection('photos')}
                    style={{
                      padding: '0.75rem 1rem',
                      background: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <ImageIcon size={16} color="#0284C7" />
                      <strong style={{ fontSize: '0.88rem', color: '#1E293B' }}>Product Photos</strong>
                      <span style={{ fontSize: '0.75rem', color: '#64748B' }}>({formData.images.length} images)</span>
                    </div>
                    {openWebsiteSections.photos ? <ChevronDown size={18} color="#64748B" /> : <ChevronRight size={18} color="#64748B" />}
                  </div>

                  {openWebsiteSections.photos && (
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        {formData.images.map((img, idx) => (
                          <div
                            key={idx}
                            style={{
                              position: 'relative',
                              width: '90px',
                              height: '90px',
                              border: idx === 0 ? '2px solid #0284C7' : '1px solid #CBD5E1',
                              borderRadius: '8px',
                              overflow: 'hidden'
                            }}
                          >
                            <img src={resolveAssetUrl(img)} alt={`Product ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            {idx === 0 && (
                              <span style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: 'rgba(2, 132, 199, 0.9)',
                                color: '#FFF',
                                fontSize: '9px',
                                fontWeight: 800,
                                textAlign: 'center',
                                padding: '1px 0'
                              }}>
                                MAIN PHOTO
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() => removeListItem('images', idx)}
                              style={{
                                position: 'absolute',
                                top: 3,
                                right: 3,
                                background: 'rgba(239,68,68,0.9)',
                                color: '#FFF',
                                border: 'none',
                                borderRadius: '50%',
                                width: 18,
                                height: 18,
                                fontSize: '10px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Delete photo"
                            >
                              ×
                            </button>
                          </div>
                        ))}

                        <label style={{
                          width: '90px',
                          height: '90px',
                          border: '2px dashed #0284C7',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                          background: '#F0F9FF'
                        }}>
                          <ImageIcon size={20} color="#0284C7" />
                          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0284C7', marginTop: 4 }}>+ Upload</span>
                          <input type="file" multiple accept="image/*" onChange={handleCloudinaryUpload} style={{ display: 'none' }} />
                        </label>
                      </div>

                      {uploadingToCloudinary && (
                        <div style={{ fontSize: '0.8rem', color: '#0284C7', fontWeight: 700 }}>
                          Uploading to Cloudinary... ({uploadProgress}%)
                        </div>
                      )}
                      <span style={{ fontSize: '0.75rem', color: '#64748B' }}>
                        The first photo will be used as the Main Product Photo on the storefront and in the ERP catalog.
                      </span>
                    </div>
                  )}
                </div>

                {/* SUBSECTION 2: PRODUCT DESCRIPTION */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div
                    onClick={() => toggleWebsiteSection('description')}
                    style={{
                      padding: '0.75rem 1rem',
                      background: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={16} color="#0284C7" />
                      <strong style={{ fontSize: '0.88rem', color: '#1E293B' }}>Product Description</strong>
                    </div>
                    {openWebsiteSections.description ? <ChevronDown size={18} color="#64748B" /> : <ChevronRight size={18} color="#64748B" />}
                  </div>

                  {openWebsiteSections.description && (
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                            Short Description *
                          </label>
                          <button
                            type="button"
                            onClick={() => triggerAiGenerator('shortDescription')}
                            disabled={aiLoadingField === 'shortDescription'}
                            style={{
                              background: '#F0F9FF',
                              border: '1px solid #BAE6FD',
                              color: '#0284C7',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Sparkles size={12} /> {aiLoadingField === 'shortDescription' ? 'Generating...' : 'AI Generate'}
                          </button>
                        </div>
                        <input
                          type="text"
                          value={formData.shortDescription}
                          onChange={e => { setFormData(prev => ({ ...prev, shortDescription: e.target.value })); setIsDirty(true); }}
                          placeholder="Brief 1-2 sentence teaser shown on product cards..."
                          style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
                        />
                      </div>

                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                            Full Description
                          </label>
                          <button
                            type="button"
                            onClick={() => triggerAiGenerator('description')}
                            disabled={aiLoadingField === 'description'}
                            style={{
                              background: '#F0F9FF',
                              border: '1px solid #BAE6FD',
                              color: '#0284C7',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Sparkles size={12} /> {aiLoadingField === 'description' ? 'Generating...' : 'AI Generate'}
                          </button>
                        </div>
                        <textarea
                          rows={4}
                          value={formData.description}
                          onChange={e => { setFormData(prev => ({ ...prev, description: e.target.value })); setIsDirty(true); }}
                          placeholder="Detailed product story, preparation details, and qualities..."
                          style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* SUBSECTION 3: PRODUCT INFORMATION (Benefits, Ingredients, Nutrition, FAQs) */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div
                    onClick={() => toggleWebsiteSection('information')}
                    style={{
                      padding: '0.75rem 1rem',
                      background: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <HelpCircle size={16} color="#0284C7" />
                      <strong style={{ fontSize: '0.88rem', color: '#1E293B' }}>Product Information (Benefits, Ingredients, Nutrition, FAQs)</strong>
                    </div>
                    {openWebsiteSections.information ? <ChevronDown size={18} color="#64748B" /> : <ChevronRight size={18} color="#64748B" />}
                  </div>

                  {openWebsiteSections.information && (
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {/* Benefits */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                            Benefits
                          </label>
                          <button
                            type="button"
                            onClick={() => triggerAiGenerator('benefits')}
                            disabled={aiLoadingField === 'benefits'}
                            style={{
                              background: '#F0F9FF',
                              border: '1px solid #BAE6FD',
                              color: '#0284C7',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              cursor: 'pointer'
                            }}
                          >
                            <Sparkles size={12} /> {aiLoadingField === 'benefits' ? 'Generating...' : 'AI Suggest'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="e.g. Boosts Daily Immunity"
                            value={newBenefit}
                            onChange={e => setNewBenefit(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addBenefitItem(); } }}
                            style={{ flex: 1, padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                          />
                          <button
                            type="button"
                            onClick={addBenefitItem}
                            style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '0 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                          >
                            + Add
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {formData.benefits.map((b, idx) => (
                            <span key={idx} style={{ background: '#E0F2FE', color: '#0369A1', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              ✓ {b} <Trash2 size={12} style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => removeListItem('benefits', idx)} />
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Ingredients */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
                            Ingredients
                          </label>
                          <button
                            type="button"
                            onClick={() => triggerAiGenerator('ingredients')}
                            disabled={aiLoadingField === 'ingredients'}
                            style={{
                              background: '#F0F9FF',
                              border: '1px solid #BAE6FD',
                              color: '#0284C7',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: 6,
                              cursor: 'pointer'
                            }}
                          >
                            <Sparkles size={12} /> {aiLoadingField === 'ingredients' ? 'Generating...' : 'AI Suggest'}
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="e.g. Sprouted Ragi, Almonds, Cardamom"
                            value={newIngredient}
                            onChange={e => setNewIngredient(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addIngredientItem(); } }}
                            style={{ flex: 1, padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                          />
                          <button
                            type="button"
                            onClick={addIngredientItem}
                            style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '0 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                          >
                            + Add
                          </button>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                          {formData.ingredients.map((ing, idx) => (
                            <span key={idx} style={{ background: '#F1F5F9', color: '#334155', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {ing} <Trash2 size={12} style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => removeListItem('ingredients', idx)} />
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Nutrition Facts */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          Nutrition Facts Table
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="Nutrient (e.g. Protein, Iron)"
                            value={nutritionKey}
                            onChange={e => setNutritionKey(e.target.value)}
                            style={{ flex: 1, padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                          />
                          <input
                            type="text"
                            placeholder="Value (e.g. 12g per 100g)"
                            value={nutritionVal}
                            onChange={e => setNutritionVal(e.target.value)}
                            style={{ flex: 1, padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                          />
                          <button
                            type="button"
                            onClick={addNutritionItem}
                            style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '0 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}
                          >
                            Add Fact
                          </button>
                        </div>
                        {Object.keys(formData.nutritionFacts).length > 0 && (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                            <tbody>
                              {Object.entries(formData.nutritionFacts).map(([k, v]) => (
                                <tr key={k} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                  <td style={{ padding: '6px 0', fontWeight: 700, color: '#1E293B' }}>{k}</td>
                                  <td style={{ padding: '6px 0', color: '#475569' }}>{v}</td>
                                  <td style={{ width: '40px', textAlign: 'right' }}>
                                    <button type="button" onClick={() => removeNutritionItem(k)} style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer' }}>×</button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>

                      {/* How to Use / Usage Instructions */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          How to Use / Usage Instructions
                        </label>
                        <input
                          type="text"
                          value={formData.usageInstructions}
                          onChange={e => { setFormData(prev => ({ ...prev, usageInstructions: e.target.value })); setIsDirty(true); }}
                          placeholder="e.g. Mix 2 spoons with 150ml warm milk or water..."
                          style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.88rem' }}
                        />
                      </div>

                      {/* FAQs */}
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                          FAQs
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem', background: '#F8FAFC', padding: '0.75rem', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                          <input
                            type="text"
                            placeholder="Question"
                            value={newFaqQ}
                            onChange={e => setNewFaqQ(e.target.value)}
                            style={{ padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                          />
                          <input
                            type="text"
                            placeholder="Answer"
                            value={newFaqA}
                            onChange={e => setNewFaqA(e.target.value)}
                            style={{ padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                          />
                          <button
                            type="button"
                            onClick={addFaqItem}
                            style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '0.45rem', borderRadius: 6, cursor: 'pointer', fontWeight: 700, fontSize: '0.82rem', alignSelf: 'flex-start' }}
                          >
                            + Add FAQ
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          {formData.faqs.map((faq, idx) => (
                            <div key={idx} style={{ borderLeft: '3px solid #0284C7', paddingLeft: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#1E293B' }}>Q: {faq.q}</div>
                                <div style={{ fontSize: '0.8rem', color: '#64748B' }}>A: {faq.a}</div>
                              </div>
                              <button type="button" onClick={() => removeListItem('faqs', idx)} style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer' }}>×</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* SUBSECTION 4: WEBSITE APPEARANCE (Badges, Health Goals, Featured, Bestseller, Trending) */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div
                    onClick={() => toggleWebsiteSection('appearance')}
                    style={{
                      padding: '0.75rem 1rem',
                      background: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Sparkles size={16} color="#0284C7" />
                      <strong style={{ fontSize: '0.88rem', color: '#1E293B' }}>Website Appearance (Badges, Health Goals, Merchandising)</strong>
                    </div>
                    {openWebsiteSections.appearance ? <ChevronDown size={18} color="#64748B" /> : <ChevronRight size={18} color="#64748B" />}
                  </div>

                  {openWebsiteSections.appearance && (
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                          Storefront Highlights
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {[
                            { key: 'Featured', field: 'isFeatured' },
                            { key: 'Bestseller', field: 'isBestseller' },
                            { key: 'Trending', field: 'isTrending' },
                          ].map(b => (
                            <button
                              key={b.field}
                              type="button"
                              onClick={() => {
                                setFormData(prev => ({ ...prev, [b.field]: !prev[b.field] }));
                                setIsDirty(true);
                              }}
                              style={{
                                padding: '6px 14px',
                                borderRadius: '16px',
                                border: formData[b.field] ? '1px solid #0284C7' : '1px solid #CBD5E1',
                                background: formData[b.field] ? '#E0F2FE' : '#FFF',
                                color: formData[b.field] ? '#0369A1' : '#64748B',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                                cursor: 'pointer'
                              }}
                            >
                              {formData[b.field] ? '✓ ' : ''}{b.key}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: 6 }}>
                          Health Goals
                        </label>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {[
                            'Increase Iron',
                            'Weight Gain',
                            'Weight Loss',
                            'Immunity',
                            'Kids Nutrition',
                            'Energy Booster',
                            'Pregnancy',
                            'Diabetes Friendly'
                          ].map(goal => {
                            const active = formData.healthGoals.includes(goal);
                            return (
                              <button
                                key={goal}
                                type="button"
                                onClick={() => toggleHealthGoal(goal)}
                                style={{
                                  padding: '5px 12px',
                                  borderRadius: '16px',
                                  border: active ? '1px solid #16A34A' : '1px solid #CBD5E1',
                                  background: active ? '#DCFCE7' : '#FFF',
                                  color: active ? '#15803D' : '#64748B',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                  cursor: 'pointer'
                                }}
                              >
                                {active ? '✓ ' : ''}{goal}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* SUBSECTION 5: SEARCH ENGINE (SEO) */}
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
                  <div
                    onClick={() => toggleWebsiteSection('seo')}
                    style={{
                      padding: '0.75rem 1rem',
                      background: '#F8FAFC',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Search size={16} color="#0284C7" />
                      <strong style={{ fontSize: '0.88rem', color: '#1E293B' }}>Search Engine (SEO Slug, Meta Title, Description)</strong>
                    </div>
                    {openWebsiteSections.seo ? <ChevronDown size={18} color="#64748B" /> : <ChevronRight size={18} color="#64748B" />}
                  </div>

                  {openWebsiteSections.seo && (
                    <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                            Website Slug *
                          </label>
                          <input
                            type="text"
                            value={formData.slug}
                            onChange={e => { setFormData(prev => ({ ...prev, slug: e.target.value })); setEditingSlugManually(true); setIsDirty(true); }}
                            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'monospace', fontSize: '0.85rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                            SEO Meta Title
                          </label>
                          <input
                            type="text"
                            value={formData.seoTitle}
                            onChange={e => { setFormData(prev => ({ ...prev, seoTitle: e.target.value })); setIsDirty(true); }}
                            placeholder={formData.name}
                            style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: 2 }}>
                          SEO Meta Description
                        </label>
                        <textarea
                          rows={2}
                          value={formData.seoDescription}
                          onChange={e => { setFormData(prev => ({ ...prev, seoDescription: e.target.value })); setIsDirty(true); }}
                          placeholder="Search snippet summary..."
                          style={{ width: '100%', padding: '0.45rem 0.65rem', borderRadius: 6, border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>
                  )}
                </div>

              </div>
            )}

            {/* BOTTOM ACTION BAR */}
            <div style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem 0'
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: '#FFFFFF',
                  color: '#475569',
                  border: '1px solid #CBD5E1',
                  padding: '0.65rem 1.5rem',
                  borderRadius: '8px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || uploadingToCloudinary}
                style={{
                  background: '#0284C7',
                  color: '#FFFFFF',
                  border: 'none',
                  padding: '0.65rem 1.75rem',
                  borderRadius: '8px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.9rem',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)'
                }}
              >
                {saving ? <RefreshCw size={18} className="spin" /> : <Check size={18} />}
                {formData.id ? 'Save Changes' : 'Save Product'}
              </button>
            </div>

          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
