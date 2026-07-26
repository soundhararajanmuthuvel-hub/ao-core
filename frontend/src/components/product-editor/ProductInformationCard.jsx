import React, { useState } from 'react';
import { Box, Sparkles, Lock, ExternalLink, Search } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';

export default function ProductInformationCard({
  formData = {},
  setFormData = () => {},
  setIsDirty = () => {},
  triggerAiGenerator = () => {},
  aiLoadingField = null,
  managementProductsList = [],
}) {
  const [selectorQuery, setSelectorQuery] = useState('');

  const filteredMasterProducts = (managementProductsList || []).filter(p => {
    if (!selectorQuery.trim()) return true;
    const q = selectorQuery.toLowerCase().trim();
    const pName = String(p.name || p.productName || '').toLowerCase();
    const pSku = String(p.sku || '').toLowerCase();
    const pBarcode = String(p.barcode || '').toLowerCase();
    const pBrand = String(p.brand || '').toLowerCase();
    const pCategory = String(p.category || '').toLowerCase();
    return (
      pName.includes(q) ||
      pSku.includes(q) ||
      pBarcode.includes(q) ||
      pBrand.includes(q) ||
      pCategory.includes(q)
    );
  });

  const handleSelectMaster = (prodId) => {
    const sel = (managementProductsList || []).find(p => String(p.id) === String(prodId));
    if (sel) {
      const chosenName = sel.name || sel.productName || '';
      const chosenPrice = sel.sellingPrice !== undefined && sel.sellingPrice !== null ? sel.sellingPrice : (sel.price || 0);
      const chosenStock = sel.stock !== undefined && sel.stock !== null ? sel.stock : (sel.stockQuantity || 0);
      const chosenGst = sel.gstPercent !== undefined && sel.gstPercent !== null ? sel.gstPercent : (sel.gstRate || 0);

      setFormData(prev => ({
        ...prev,
        managementProductId: sel.id,
        productId: sel.id,
        name: chosenName,
        sku: sel.sku || '',
        barcode: sel.barcode || '',
        brand: sel.brand || 'Blovit',
        category: sel.category || 'General',
        price: Number(chosenPrice),
        sellingPrice: Number(chosenPrice),
        gstPercent: Number(chosenGst),
        stock: Number(chosenStock),
        stockQuantity: Number(chosenStock),
        masterStatus: sel.status || (sel.isActive ? 'Active' : 'Inactive'),
        imageUrl: sel.imageUrl || sel.image || ''
      }));
      setIsDirty(true);
    }
  };

  return (
    <ErrorBoundary>
      <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        
        {/* PRODUCT MASTER SELECTOR BAR */}
        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '1rem', borderRadius: '10px', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 800, color: '#0284C7', display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              <Box size={16} /> Select Product from Billing Product Master *
            </label>

            {formData.sku && (
              <button
                type="button"
                onClick={() => window.open(`/sales?tab=products&search=${encodeURIComponent(formData.sku)}`, '_blank')}
                style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', padding: '0.3rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <ExternalLink size={13} /> Open Product Master
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Search Product Master (Name, SKU, Barcode)..."
                value={selectorQuery}
                onChange={e => setSelectorQuery(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.6rem 0.5rem 2.1rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.8rem', outline: 'none' }}
              />
            </div>

            <select
              value={formData.managementProductId || formData.productId || ''}
              onChange={e => handleSelectMaster(e.target.value)}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #0284C7', fontSize: '0.85rem', fontWeight: 700, backgroundColor: '#FFFFFF', color: '#0F172A' }}
            >
              {(managementProductsList || []).length === 0 ? (
                <option value="" disabled>-- No active products found in Product Master --</option>
              ) : (
                <option value="">
                  -- Choose Active Product Master Item ({filteredMasterProducts.length} Available) --
                </option>
              )}
              {filteredMasterProducts.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name || p.productName} | SKU: {p.sku || 'N/A'} | Price: ₹{p.sellingPrice !== undefined ? p.sellingPrice : (p.price || 0)} | Stock: {p.stock !== undefined ? p.stock : (p.stockQuantity || 0)} ({p.category || 'General'})
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Lock size={12} color="#0284C7" /> Commercial data (Price, Stock, GST, Barcode) is read-only and managed in Billing Product Master.
          </div>
        </div>

        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Box size={18} color="#0284C7" /> General Information & Marketing Details
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Product Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Sprouted Ragi Malt 250g"
              value={formData.name || ''}
              onChange={(e) => {
                const newName = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  name: newName,
                  slug: prev.editingSlugManually ? prev.slug : newName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
                }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}
            />
          </div>

          {/* Slug & Category & Brand */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                URL Slug *
              </label>
              <input
                type="text"
                placeholder="product-url-slug"
                value={formData.slug || ''}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, slug: e.target.value, editingSlugManually: true }));
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                Category
              </label>
              <input
                type="text"
                placeholder="Category (e.g. Health Mixes)"
                value={formData.category || 'General'}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, category: e.target.value }));
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', color: '#0F172A', fontWeight: 600 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                Brand
              </label>
              <input
                type="text"
                placeholder="Brand Name"
                value={formData.brand || 'Blovit Organics'}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, brand: e.target.value }));
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', color: '#0F172A', fontWeight: 600 }}
              />
            </div>
          </div>

          {/* Short Description */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Storefront Short Summary
            </label>
            <input
              type="text"
              placeholder="Brief tagline for storefront product cards..."
              value={formData.shortDescription || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, shortDescription: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            />
          </div>

          {/* Full Description + AI Generator */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569' }}>
                Storefront Full Description
              </label>
              <button
                type="button"
                onClick={() => triggerAiGenerator('description')}
                disabled={aiLoadingField === 'description'}
                style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <Sparkles size={12} /> {aiLoadingField === 'description' ? 'Generating...' : 'AI Generate'}
              </button>
            </div>
            <textarea
              rows={4}
              placeholder="Detailed organic product narrative for storefront..."
              value={formData.description || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, description: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.88rem', lineHeight: '1.5' }}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
