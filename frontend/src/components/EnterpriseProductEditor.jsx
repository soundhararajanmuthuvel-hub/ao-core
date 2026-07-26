import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  RefreshCw,
  AlertTriangle,
  Cloud,
  Cpu,
  ArrowLeft,
  Settings,
  DollarSign,
  Database,
  Hammer,
  Globe,
  Share2,
  Image as ImageIcon,
  FileText,
  History,
  Sparkles,
  Plus,
  Trash2
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
}) {
  if (!isOpen) return null;

  // Form State
  const [formData, setFormData] = useState({
    id: product?.id || null,
    name: product?.name || '',
    slug: product?.slug || '',
    sku: product?.sku || '',
    barcode: product?.barcode || '',
    category: product?.category || 'General',
    subCategory: product?.subCategory || '',
    brand: product?.brand || 'Blovit Organics',
    unit: product?.unit || 'pcs',
    productType: product?.productType || 'trading',
    hsnCode: product?.hsnCode || '',
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

    // Manufacturing
    bom: product?.bom || '',
    recipe: product?.recipe || '',
    shelfLife: product?.shelfLife || '',
    batchTracking: !!product?.batchTracking,
    expiryTracking: !!product?.expiryTracking,

    // Website Publishing
    isPublished: !!product?.isPublished,
    publishToWebsite: !!product?.isPublished,
    
    // Website Information
    images: Array.isArray(product?.images) ? product.images : (() => {
      try { return JSON.parse(product?.images || '[]'); } catch { return product?.imageUrl ? [product.imageUrl] : []; }
    })(),
    imageUrl: product?.imageUrl || '',
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
    nutritionFacts: typeof product?.nutritionFacts === 'object' ? product.nutritionFacts : (() => {
      try { return JSON.parse(product?.nutritionFacts || '{}'); } catch { return {}; }
    })(),
    usageInstructions: product?.usageInstructions || '',
    faqs: Array.isArray(product?.faqs) ? product.faqs : (() => {
      try { return JSON.parse(product?.faqs || '[]'); } catch { return []; }
    })(),
    
    // Labels & Health Goals
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

    // SEO
    seoTitle: product?.seoTitle || '',
    seoDescription: product?.seoDescription || '',
    seoKeywords: product?.seoKeywords || '',
    canonicalUrl: product?.canonicalUrl || '',
    openGraphImage: product?.openGraphImage || '',
    schemaData: product?.schemaData || '',
    versionHistory: Array.isArray(product?.versionHistory) ? product.versionHistory : (() => {
      try { return JSON.parse(product?.versionHistory || '[]'); } catch { return []; }
    })(),
  });

  const [activeTab, setActiveTab] = useState('general');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoadingField, setAiLoadingField] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Cloudinary Upload state
  const [uploadingToCloudinary, setUploadingToCloudinary] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // New list inputs
  const [newBenefit, setNewBenefit] = useState('');
  const [newIngredient, setNewIngredient] = useState('');
  const [newFaqQ, setNewFaqQ] = useState('');
  const [newFaqA, setNewFaqA] = useState('');
  const [newHealthGoal, setNewHealthGoal] = useState('');
  const [newLabel, setNewLabel] = useState('');

  // Nutrition Table keys
  const [nutritionKey, setNutritionKey] = useState('');
  const [nutritionVal, setNutritionVal] = useState('');

  // Auto slug generation
  const [editingSlugManually, setEditingSlugManually] = useState(false);
  useEffect(() => {
    if (formData.name && !editingSlugManually) {
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

  const handleCloudinaryUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadingToCloudinary(true);
    setUploadProgress(20);
    const fd = new FormData();
    files.forEach(f => fd.append('images', f));

    try {
      setUploadProgress(50);
      const res = await client.post('/website-admin/upload-image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadProgress(80);
      if (res.data.success && res.data.urls) {
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, ...res.data.urls],
          imageUrl: prev.imageUrl || res.data.urls[0]
        }));
        setIsDirty(true);
        setMsg({ type: 'success', text: 'Images uploaded successfully to Cloudinary!' });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to upload images: ' + err.message });
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
        name: formData.name || 'Organic Malt Drink',
        category: formData.category,
      });

      if (res.data && res.data.result) {
        const raw = res.data.result;
        if (field === 'description') {
          setFormData(prev => ({ ...prev, description: raw }));
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
    if (!formData.name.trim()) {
      setMsg({ type: 'error', text: 'Product Title is required.' });
      return;
    }
    const finalPrice = parseFloat(formData.sellingPrice || formData.price);
    if (isNaN(finalPrice) || finalPrice <= 0) {
      setMsg({ type: 'error', text: 'Selling Price is required and must be greater than zero.' });
      return;
    }

    // Publication logic validation
    if (formData.isPublished) {
      if (!formData.images || formData.images.length === 0) {
        setMsg({ type: 'error', text: 'At least one product image is required when Show on Website is enabled.' });
        return;
      }
      if (!formData.shortDescription?.trim()) {
        setMsg({ type: 'error', text: 'Short Description is required when Show on Website is enabled.' });
        return;
      }
      if (!formData.category?.trim() || formData.category === 'General') {
        setMsg({ type: 'error', text: 'A specific product Category is required when Show on Website is enabled.' });
        return;
      }
    }

    setSaving(true);
    setMsg({ type: '', text: '' });

    const payload = {
      ...formData,
      price: finalPrice,
      sellingPrice: finalPrice,
      compareAtPrice: Number(formData.mrp || formData.compareAtPrice || 0),
      mrp: Number(formData.mrp || formData.compareAtPrice || 0),
      stock: Number(formData.stock),
      openingStock: Number(formData.openingStock),
      minStock: Number(formData.minStock),
      maxStock: Number(formData.maxStock),
      reorderLevel: Number(formData.reorderLevel),
      costPrice: Number(formData.costPrice || 0),
      purchasePrice: Number(formData.purchasePrice || 0),
      dealerPrice: Number(formData.dealerPrice || 0),
      distributorPrice: Number(formData.distributorPrice || 0),
      wholesalePrice: Number(formData.wholesalePrice || 0),
      isPublished: !!formData.isPublished,
      publishToWebsite: !!formData.isPublished,
      status: formData.status || (formData.isPublished ? 'Published' : 'Draft'),
      imageUrl: formData.images?.[0] || formData.imageUrl || '',
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
        setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save unified product.' });
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
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', backdropFilter: 'blur(8px)', zIndex: 1200, display: 'flex', flexDirection: 'column', fontFamily: 'Inter, sans-serif' }}>
        {/* HEADER */}
        <header style={{ height: '64px', background: '#FFF', borderBottom: '1px solid #E2E8F0', padding: '0 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={onClose} style={{ padding: '0.4rem', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <ArrowLeft size={18} color="#475569" />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {formData.id ? `Edit Product: ${formData.name}` : 'Create Master Product'}
                </h2>
                {isDirty && (
                  <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> Unsaved Changes
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={handleSave} disabled={saving || uploadingToCloudinary} style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '0.55rem 1.25rem', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
              {saving ? <RefreshCw size={16} className="spin" /> : <Check size={16} />} Save Product
            </button>
          </div>
        </header>

        {/* ALERTS */}
        {msg.text && (
          <div style={{ padding: '0.65rem 1.5rem', background: msg.type === 'error' ? '#FEF2F2' : '#F0FDF4', color: msg.type === 'error' ? '#991B1B' : '#166534', borderBottom: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
            <span>{msg.text}</span>
            <span style={{ cursor: 'pointer' }} onClick={() => setMsg({ type: '', text: '' })}>×</span>
          </div>
        )}

        {/* TABS STRIP */}
        <div style={{ display: 'flex', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '0 1rem' }}>
          {[
            { id: 'general', label: 'Basic Info', icon: Settings },
            { id: 'pricing', label: 'Pricing', icon: DollarSign },
            { id: 'inventory', label: 'Inventory', icon: Database },
            { id: 'manufacturing', label: 'Manufacturing', icon: Hammer },
            { id: 'publishing', label: 'Website Publishing', icon: Globe },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.85rem 1.25rem',
                border: 'none',
                background: 'transparent',
                borderBottom: activeTab === tab.id ? '2px solid #0284C7' : '2px solid transparent',
                color: activeTab === tab.id ? '#0284C7' : '#64748B',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {/* CONTAINER */}
        <div style={{ flex: 1, overflowY: 'auto', background: '#F1F5F9', padding: '1.5rem' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', background: '#FFF', borderRadius: '12px', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>

            {/* TAB: GENERAL */}
            {activeTab === 'general' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#0F172A' }}>General Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Product Title *</label>
                    <input type="text" value={formData.name} onChange={e => { setFormData(prev => ({ ...prev, name: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>SKU</label>
                    <input type="text" value={formData.sku} onChange={e => { setFormData(prev => ({ ...prev, sku: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Barcode</label>
                    <input type="text" value={formData.barcode} onChange={e => { setFormData(prev => ({ ...prev, barcode: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Category</label>
                    <input type="text" value={formData.category} onChange={e => { setFormData(prev => ({ ...prev, category: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Sub Category</label>
                    <input type="text" value={formData.subCategory} onChange={e => { setFormData(prev => ({ ...prev, subCategory: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Brand</label>
                    <input type="text" value={formData.brand} onChange={e => { setFormData(prev => ({ ...prev, brand: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Unit</label>
                    <input type="text" value={formData.unit} onChange={e => { setFormData(prev => ({ ...prev, unit: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Product Type</label>
                    <select value={formData.productType} onChange={e => { setFormData(prev => ({ ...prev, productType: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }}>
                      <option value="trading">Trading Product</option>
                      <option value="BULK_PRODUCT">Bulk Product (Powder)</option>
                      <option value="RETAIL_PACK">Retail Pack Size</option>
                      <option value="RAW_MATERIAL">Raw Material</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>HSN Code</label>
                    <input type="text" value={formData.hsnCode} onChange={e => { setFormData(prev => ({ ...prev, hsnCode: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>GST Percent (%)</label>
                    <input type="number" value={formData.gstPercent} onChange={e => { setFormData(prev => ({ ...prev, gstPercent: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>ERP Status</label>
                    <select value={formData.isActive ? 'Active' : 'Inactive'} onChange={e => { setFormData(prev => ({ ...prev, isActive: e.target.value === 'Active' })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }}>
                      <option value="Active">Active (ERP Usable)</option>
                      <option value="Inactive">Inactive (ERP Blocked)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PRICING */}
            {activeTab === 'pricing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#0F172A' }}>Pricing Settings</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Selling Price (₹) *</label>
                    <input type="number" value={formData.sellingPrice || formData.price} onChange={e => { setFormData(prev => ({ ...prev, sellingPrice: e.target.value, price: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1', color: '#0284C7', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>MRP / Original Price (₹)</label>
                    <input type="number" value={formData.mrp || formData.compareAtPrice} onChange={e => { setFormData(prev => ({ ...prev, mrp: e.target.value, compareAtPrice: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Calculated Discount</label>
                    <div style={{ padding: '0.55rem', background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: 6, fontWeight: 700, color: '#16A34A' }}>
                      {calculatedDiscount > 0 ? `${calculatedDiscount}% OFF` : 'No Discount'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Purchase Price</label>
                    <input type="number" value={formData.purchasePrice} onChange={e => { setFormData(prev => ({ ...prev, purchasePrice: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Cost Price</label>
                    <input type="number" value={formData.costPrice} onChange={e => { setFormData(prev => ({ ...prev, costPrice: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Wholesale Price</label>
                    <input type="number" value={formData.wholesalePrice} onChange={e => { setFormData(prev => ({ ...prev, wholesalePrice: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Distributor Price</label>
                    <input type="number" value={formData.distributorPrice} onChange={e => { setFormData(prev => ({ ...prev, distributorPrice: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Dealer Price</label>
                    <input type="number" value={formData.dealerPrice} onChange={e => { setFormData(prev => ({ ...prev, dealerPrice: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: INVENTORY */}
            {activeTab === 'inventory' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#0F172A' }}>Inventory Settings</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Opening Stock</label>
                    <input type="number" value={formData.openingStock} onChange={e => { setFormData(prev => ({ ...prev, openingStock: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Current Live Stock</label>
                    <input type="number" value={formData.stock} onChange={e => { setFormData(prev => ({ ...prev, stock: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1', fontWeight: 700 }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Min Stock Limit</label>
                    <input type="number" value={formData.minStock} onChange={e => { setFormData(prev => ({ ...prev, minStock: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Max Stock Limit</label>
                    <input type="number" value={formData.maxStock} onChange={e => { setFormData(prev => ({ ...prev, maxStock: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Reorder Level</label>
                    <input type="number" value={formData.reorderLevel} onChange={e => { setFormData(prev => ({ ...prev, reorderLevel: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                </div>
              </div>
            )}

            {/* TAB: MANUFACTURING */}
            {activeTab === 'manufacturing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#0F172A' }}>Manufacturing & Recipes</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Connected BOM / Formula</label>
                    <input type="text" placeholder="BOM Code or Link..." value={formData.bom} onChange={e => { setFormData(prev => ({ ...prev, bom: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Product Shelf Life</label>
                    <input type="text" placeholder="e.g. 12 Months" value={formData.shelfLife} onChange={e => { setFormData(prev => ({ ...prev, shelfLife: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Recipe Instructions</label>
                  <textarea rows={4} value={formData.recipe} onChange={e => { setFormData(prev => ({ ...prev, recipe: e.target.value })); setIsDirty(true); }} placeholder="Describe the manufacturing or packing formula details..." style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                </div>

                <div style={{ display: 'flex', gap: '2rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.batchTracking} onChange={e => { setFormData(prev => ({ ...prev, batchTracking: e.target.checked })); setIsDirty(true); }} /> Enable Batch Tracking
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.expiryTracking} onChange={e => { setFormData(prev => ({ ...prev, expiryTracking: e.target.checked })); setIsDirty(true); }} /> Enable Expiry Tracking
                  </label>
                </div>
              </div>
            )}

            {/* TAB: WEBSITE PUBLISHING */}
            {activeTab === 'publishing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ background: '#F8FAFC', padding: '1.25rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: '#0F172A' }}>Website Visibility</h4>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 800, fontSize: '0.9rem', color: '#0284C7', cursor: 'pointer' }}>
                    <input type="checkbox" checked={formData.isPublished} onChange={e => { setFormData(prev => ({ ...prev, isPublished: e.target.checked })); setIsDirty(true); }} style={{ width: '18px', height: '18px' }} /> Show on Website
                  </label>
                </div>

                {/* ANIMATED / COLLAPSIBLE EXPAND SECTION */}
                <div style={{
                  maxHeight: formData.isPublished ? '5000px' : '0px',
                  overflow: 'hidden',
                  transition: 'max-height 0.5s ease-out',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.5rem'
                }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5rem', color: '#0284C7', margin: '0.5rem 0 0 0' }}>Website Information & Storefront Assets</h3>

                  {/* IMAGES */}
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569', marginBottom: '0.5rem' }}>Product Images & Gallery (Cloudinary Support)</h4>
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                      {formData.images.map((img, idx) => (
                        <div key={idx} style={{ position: 'relative', width: '90px', height: '90px', border: '1px solid #CBD5E1', borderRadius: '8px', overflow: 'hidden' }}>
                          <img src={resolveAssetUrl(img)} alt="Product" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          <button type="button" onClick={() => removeListItem('images', idx)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(239,68,68,0.9)', color: '#FFF', border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: '10px', cursor: 'pointer' }}>×</button>
                        </div>
                      ))}
                      <label style={{ width: '90px', height: '90px', border: '2px dashed #0284C7', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#F0F9FF' }}>
                        <ImageIcon size={24} color="#0284C7" />
                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0284C7', marginTop: 4 }}>Add Image</span>
                        <input type="file" multiple accept="image/*" onChange={handleCloudinaryUpload} style={{ display: 'none' }} />
                      </label>
                    </div>
                    {uploadingToCloudinary && (
                      <div style={{ fontSize: '0.8rem', color: '#0284C7', fontWeight: 700 }}>Uploading to Cloudinary... ({uploadProgress}%)</div>
                    )}
                  </div>

                  {/* CONTENT */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Short Tagline / Description *</label>
                    <input type="text" value={formData.shortDescription} onChange={e => { setFormData(prev => ({ ...prev, shortDescription: e.target.value })); setIsDirty(true); }} placeholder="Storefront teaser narrative..." style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569' }}>Long Description</label>
                      <button type="button" onClick={() => triggerAiGenerator('description')} disabled={aiLoadingField === 'description'} style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0284C7', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, cursor: 'pointer' }}>
                        <Sparkles size={12} style={{ marginRight: 2 }} /> {aiLoadingField === 'description' ? 'Generating...' : 'AI Generate'}
                      </button>
                    </div>
                    <textarea rows={4} value={formData.description} onChange={e => { setFormData(prev => ({ ...prev, description: e.target.value })); setIsDirty(true); }} placeholder="Comprehensive narrative..." style={{ width: '100%', padding: '0.55rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                  </div>

                  {/* DYNAMIC BENEFITS LIST */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Product Benefits (Dynamic List)</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input type="text" placeholder="e.g. Rich in Iron" value={newBenefit} onChange={e => setNewBenefit(e.target.value)} style={{ flex: 1, padding: '0.45rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                      <button type="button" onClick={addBenefitItem} style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '0 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>+ Add Benefit</button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {formData.benefits.map((b, idx) => (
                        <span key={idx} style={{ background: '#E0F2FE', color: '#0369A1', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          ✓ {b} <Trash2 size={12} style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => removeListItem('benefits', idx)} />
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* DYNAMIC INGREDIENTS LIST */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Ingredients (Dynamic List)</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input type="text" placeholder="e.g. Almonds" value={newIngredient} onChange={e => setNewIngredient(e.target.value)} style={{ flex: 1, padding: '0.45rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                      <button type="button" onClick={addIngredientItem} style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '0 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>+ Add Ingredient</button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                      {formData.ingredients.map((ing, idx) => (
                        <span key={idx} style={{ background: '#F1F5F9', color: '#334155', fontSize: '0.75rem', fontWeight: 700, padding: '4px 10px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {ing} <Trash2 size={12} style={{ cursor: 'pointer', color: '#EF4444' }} onClick={() => removeListItem('ingredients', idx)} />
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* NUTRITION TABLE */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>Nutrition Facts Facts Table</label>
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <input type="text" placeholder="Nutrient (e.g. Energy)" value={nutritionKey} onChange={e => setNutritionKey(e.target.value)} style={{ flex: 1, padding: '0.45rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                      <input type="text" placeholder="Value (e.g. 380 kcal)" value={nutritionVal} onChange={e => setNutritionVal(e.target.value)} style={{ flex: 1, padding: '0.45rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                      <button type="button" onClick={addNutritionItem} style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '0 1rem', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>Add Fact</button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead>
                        <tr style={{ background: '#F8FAFC' }}>
                          <th style={{ textAlign: 'left', padding: '6px', borderBottom: '1px solid #E2E8F0' }}>Nutrient</th>
                          <th style={{ textAlign: 'left', padding: '6px', borderBottom: '1px solid #E2E8F0' }}>Value</th>
                          <th style={{ width: '50px', borderBottom: '1px solid #E2E8F0' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(formData.nutritionFacts).map(([k, v]) => (
                          <tr key={k}>
                            <td style={{ padding: '6px', borderBottom: '1px solid #F1F5F9', fontWeight: 700 }}>{k}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid #F1F5F9' }}>{v}</td>
                            <td style={{ padding: '6px', borderBottom: '1px solid #F1F5F9' }}>
                              <button type="button" onClick={() => removeNutritionItem(k)} style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer' }}>×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* FAQ */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: 4 }}>FAQ List</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.5rem', background: '#F8FAFC', padding: '1rem', borderRadius: 8, border: '1px solid #E2E8F0' }}>
                      <input type="text" placeholder="Question" value={newFaqQ} onChange={e => setNewFaqQ(e.target.value)} style={{ padding: '0.45rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                      <input type="text" placeholder="Answer" value={newFaqA} onChange={e => setNewFaqA(e.target.value)} style={{ padding: '0.45rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                      <button type="button" onClick={addFaqItem} style={{ background: '#0284C7', color: '#FFF', border: 'none', padding: '0.45rem', borderRadius: 6, cursor: 'pointer', fontWeight: 700 }}>Add FAQ</button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {formData.faqs.map((faq, idx) => (
                        <div key={idx} style={{ borderLeft: '3px solid #0284C7', paddingLeft: '8px', display: 'flex', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.8rem' }}>Q: {faq.q}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748B' }}>A: {faq.a}</div>
                          </div>
                          <button type="button" onClick={() => removeListItem('faqs', idx)} style={{ border: 'none', background: 'transparent', color: '#EF4444', cursor: 'pointer' }}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* TOOGLE LABELS CHIPS */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Website Labels (Toggle Chips)</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {[
                        { key: 'Featured', toggle: 'isFeatured' },
                        { key: 'Bestseller', toggle: 'isBestseller' },
                        { key: 'Trending', toggle: 'isTrending' },
                        { key: 'New Arrival', labelOnly: true },
                        { key: 'Organic', labelOnly: true },
                        { key: 'Healthy Choice', labelOnly: true },
                        { key: 'Kids Favourite', labelOnly: true },
                      ].map(lbl => {
                        const isToggle = !!lbl.toggle;
                        const active = isToggle ? formData[lbl.toggle] : formData.websiteLabels.includes(lbl.key);
                        return (
                          <button
                            key={lbl.key}
                            type="button"
                            onClick={() => {
                              if (isToggle) {
                                setFormData(prev => ({ ...prev, [lbl.toggle]: !prev[lbl.toggle] }));
                              } else {
                                toggleLabel(lbl.key);
                              }
                            }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '16px',
                              border: active ? '1px solid #0284C7' : '1px solid #CBD5E1',
                              background: active ? '#E0F2FE' : '#FFF',
                              color: active ? '#0369A1' : '#64748B',
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              cursor: 'pointer'
                            }}
                          >
                            {active ? '✓ ' : ''}{lbl.key}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* HEALTH GOALS */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>Health Goals (Dynamic Tags)</label>
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

                  {/* SEO */}
                  <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: 8, border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, margin: 0, color: '#0F172A' }}>Search Engine Optimization (SEO) Settings</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>SEO Slug *</label>
                        <input type="text" value={formData.slug} onChange={e => { setFormData(prev => ({ ...prev, slug: e.target.value })); setEditingSlugManually(true); setIsDirty(true); }} style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid #CBD5E1', fontFamily: 'monospace' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>SEO Meta Title</label>
                        <input type="text" value={formData.seoTitle} onChange={e => { setFormData(prev => ({ ...prev, seoTitle: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: 2 }}>Meta Description</label>
                      <textarea rows={2} value={formData.seoDescription} onChange={e => { setFormData(prev => ({ ...prev, seoDescription: e.target.value })); setIsDirty(true); }} style={{ width: '100%', padding: '0.45rem', borderRadius: 6, border: '1px solid #CBD5E1' }} />
                    </div>
                  </div>

                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
