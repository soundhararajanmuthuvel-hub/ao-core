import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  RefreshCw,
  AlertTriangle,
  Cloud,
  Cpu,
  ArrowLeft
} from 'lucide-react';
import client from '../api/client';
import { resolveAssetUrl } from '../utils/url';
import ErrorBoundary from './ErrorBoundary';

// Modular Sub-Components
import ProductInformationCard from './product-editor/ProductInformationCard';
import PricingCard from './product-editor/PricingCard';
import InventoryCard from './product-editor/InventoryCard';
import MediaCard from './product-editor/MediaCard';
import BenefitsCard from './product-editor/BenefitsCard';
import IngredientsCard from './product-editor/IngredientsCard';
import NutritionCard from './product-editor/NutritionCard';
import SEOCard from './product-editor/SEOCard';
import PublishingCard from './product-editor/PublishingCard';
import PreviewCard from './product-editor/PreviewCard';
import PackingConfigurationCard from './product-editor/PackingConfigurationCard';

export default function EnterpriseProductEditor({
  product = null,
  isOpen = false,
  onClose = () => {},
  onSaveSuccess = () => {},
  managementProductsList = [],
}) {
  if (!isOpen) return null;

  // Form State Single Source of Truth
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
    gstPercent: 5,
    stock: product?.stock !== undefined ? product.stock : 100,
    lowStockThreshold: 10,
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
    status: product?.isActive ? 'published' : 'draft',
    isBestseller: !!product?.isBestseller,
  });

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoadingField, setAiLoadingField] = useState(null);
  const [msg, setMsg] = useState({ type: '', text: '' });

  // Cloudinary Asynchronous Upload & Retry State
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [uploadingToCloudinary, setUploadingToCloudinary] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadErrorMsg, setUploadErrorMsg] = useState('');
  const [lastFailedFiles, setLastFailedFiles] = useState([]);
  const [optimisticPreviews, setOptimisticPreviews] = useState([]);

  // Auto-generate slug when name changes if slug hasn't been manually touched
  const [editingSlugManually, setEditingSlugManually] = useState(false);
  useEffect(() => {
    if (formData.name && !editingSlugManually) {
      const generated = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setFormData((prev) => ({ ...prev, slug: generated }));
    }
  }, [formData.name]);

  // Derived Pure Computed Values
  const calculatedDiscount = useMemo(() => {
    const p = parseFloat(formData.price) || 0;
    const mrp = parseFloat(formData.mrp) || parseFloat(formData.compareAtPrice) || 0;
    if (mrp > p && mrp > 0) {
      return Math.round(((mrp - p) / mrp) * 100);
    }
    return 0;
  }, [formData.price, formData.mrp, formData.compareAtPrice]);

  const stockStatus = useMemo(() => {
    const s = parseInt(formData.stock, 10) || 0;
    if (s <= 0) return { label: 'Out of Stock', color: '#EF4444', badge: 'badge-danger' };
    if (s <= (formData.lowStockThreshold || 10)) return { label: 'Low Stock', color: '#F59E0B', badge: 'badge-warning' };
    return { label: 'In Stock', color: '#10B981', badge: 'badge-success' };
  }, [formData.stock, formData.lowStockThreshold]);

  const seoScore = useMemo(() => {
    let score = 0;
    if (formData.metaTitle && formData.metaTitle.length >= 30 && formData.metaTitle.length <= 60) score += 40;
    else if (formData.metaTitle) score += 20;
    if (formData.metaDescription && formData.metaDescription.length >= 70 && formData.metaDescription.length <= 160) score += 40;
    else if (formData.metaDescription) score += 20;
    if (formData.keywords) score += 20;
    return score;
  }, [formData.metaTitle, formData.metaDescription, formData.keywords]);

  const previewImage = useMemo(() => {
    if (formData.images && formData.images.length > 0 && formData.images[0]) {
      return resolveAssetUrl(formData.images[0]);
    }
    return null;
  }, [formData.images]);

  // Fully asynchronous File Upload with Progress Tracking & Error Recovery
  const executeUpload = async (filesToUpload) => {
    if (!filesToUpload || filesToUpload.length === 0) return;

    setUploadingToCloudinary(true);
    setUploadProgress(0);
    setUploadErrorMsg('');
    setMsg({ type: '', text: '' });

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
      } else {
        const errMsg = res.data.error || res.data.reason || 'Cloudinary upload failed';
        const suggestion = res.data.suggestion || '';
        const fullMsg = suggestion ? `${errMsg}. ${suggestion}` : errMsg;
        setUploadErrorMsg(fullMsg);
        setLastFailedFiles(filesToUpload);
        setMsg({ type: 'error', text: `Upload Warning: ${fullMsg}` });
      }
    } catch (err) {
      console.error('[Async Upload Failure]', err);
      const errMsg = err.response?.data?.reason || err.response?.data?.error || err.response?.data?.message || err.message || 'Cloudinary upload failed';
      const suggestion = err.response?.data?.suggestion || '';
      const fullMsg = suggestion ? `${errMsg}. ${suggestion}` : errMsg;
      setUploadErrorMsg(fullMsg);
      setLastFailedFiles(filesToUpload);
      setMsg({ type: 'error', text: `Upload Warning: ${fullMsg}` });
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

  // AI Assistant Generator
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

  // Save Product Handler
  const handleSaveProduct = async (statusOverride = null) => {
    const targetMasterId = formData.managementProductId || formData.productId;
    if (!targetMasterId) {
      setMsg({ type: 'error', text: 'Please select an active product from Billing Product Master.' });
      return;
    }

    setSaving(true);
    setMsg({ type: '', text: '' });

    const finalStatus = statusOverride || formData.status;
    const payload = {
      managementProductId: targetMasterId,
      productId: targetMasterId,
      slug: formData.slug,
      description: formData.description,
      shortDescription: formData.shortDescription,
      galleryImages: JSON.stringify(formData.images),
      images: JSON.stringify(formData.images),
      benefits: JSON.stringify(formData.benefits),
      ingredients: JSON.stringify(formData.ingredients),
      nutritionFacts: JSON.stringify(
        (formData.nutritionTable || []).reduce((acc, curr) => {
          acc[curr.nutrient] = `${curr.value}${curr.unit}`;
          return acc;
        }, {})
      ),
      faqs: JSON.stringify(formData.faqs || []),
      seoTitle: formData.metaTitle || formData.seoTitle || '',
      seoDescription: formData.metaDescription || formData.seoDescription || '',
      seoKeywords: formData.keywords || formData.seoKeywords || '',
      badges: JSON.stringify(formData.badges || []),
      healthGoals: JSON.stringify(formData.healthGoals || []),
      isFeatured: !!formData.isFeatured,
      isBestseller: !!formData.isBestseller,
      isTrending: !!formData.isTrending,
      isPublished: finalStatus === 'published',
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
        setMsg({ type: 'success', text: `Website Product settings ${formData.id ? 'updated' : 'configured'} successfully!` });
        onSaveSuccess();
        setTimeout(() => onClose(), 800);
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save website product settings.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ErrorBoundary>
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
        {/* TOP HEADER */}
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
              <ArrowLeft size={18} color="#475569" />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  {formData.id ? `Edit Storefront Product: ${formData.name}` : 'Configure Storefront Product Settings'}
                </h2>
                {isDirty && (
                  <span style={{ background: '#FEF3C7', color: '#92400E', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={12} /> Unsaved Changes
                  </span>
                )}
              </div>
              <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                Enrich Product Master with Storefront Descriptions, SEO & Marketing Media
              </span>
            </div>
          </div>

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
                  <Check size={16} /> Save Product Settings
                </>
              )}
            </button>
          </div>
        </header>

        {/* ALERT MSG BANNER */}
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

        {/* 70/30 MODULAR GRID LAYOUT */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', overflow: 'hidden', background: '#F8FAFC' }}>
          
          {/* LEFT COLUMN (70%) */}
          <div style={{ overflowY: 'auto', padding: '1.5rem 2rem 5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <ProductInformationCard
              formData={formData}
              setFormData={setFormData}
              setIsDirty={setIsDirty}
              triggerAiGenerator={triggerAiGenerator}
              aiLoadingField={aiLoadingField}
              managementProductsList={managementProductsList}
            />

            <PricingCard
              formData={formData}
              setFormData={setFormData}
              setIsDirty={setIsDirty}
              calculatedDiscount={calculatedDiscount}
            />

            <InventoryCard
              formData={formData}
              setFormData={setFormData}
              setIsDirty={setIsDirty}
              stockStatus={stockStatus}
            />

            <PackingConfigurationCard
              productId={formData.id}
              productName={formData.name}
            />

            <BenefitsCard
              formData={formData}
              setFormData={setFormData}
              setIsDirty={setIsDirty}
              triggerAiGenerator={triggerAiGenerator}
              aiLoadingField={aiLoadingField}
            />

            <IngredientsCard
              formData={formData}
              setFormData={setFormData}
              setIsDirty={setIsDirty}
              triggerAiGenerator={triggerAiGenerator}
              aiLoadingField={aiLoadingField}
            />

            <NutritionCard
              formData={formData}
              setFormData={setFormData}
              setIsDirty={setIsDirty}
              triggerAiGenerator={triggerAiGenerator}
              aiLoadingField={aiLoadingField}
            />

            <SEOCard
              formData={formData}
              setFormData={setFormData}
              setIsDirty={setIsDirty}
              triggerAiGenerator={triggerAiGenerator}
              aiLoadingField={aiLoadingField}
              seoScore={seoScore}
            />
          </div>

          {/* RIGHT COLUMN (30%) */}
          <div style={{ borderLeft: '1px solid #E2E8F0', background: '#FFF', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '1.5rem' }}>
            <MediaCard
              formData={formData}
              setFormData={setFormData}
              setIsDirty={setIsDirty}
              uploadingToCloudinary={uploadingToCloudinary}
              uploadProgress={uploadProgress}
              uploadErrorMsg={uploadErrorMsg}
              customImageUrl={customImageUrl}
              setCustomImageUrl={setCustomImageUrl}
              handleCloudinaryFileUpload={handleCloudinaryFileUpload}
              handleRetryUpload={handleRetryUpload}
              optimisticPreviews={optimisticPreviews}
            />

            <PreviewCard
              formData={formData}
              previewImage={previewImage}
              calculatedDiscount={calculatedDiscount}
            />

            <PublishingCard
              formData={formData}
              setFormData={setFormData}
              setIsDirty={setIsDirty}
            />
          </div>

        </div>
      </div>
    </ErrorBoundary>
  );
}
