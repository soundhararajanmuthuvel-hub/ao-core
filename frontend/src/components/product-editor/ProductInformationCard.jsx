import React from 'react';
import { Box, Sparkles } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';

export default function ProductInformationCard({
  formData = {},
  setFormData = () => {},
  setIsDirty = () => {},
  triggerAiGenerator = () => {},
  aiLoadingField = null,
}) {
  return (
    <ErrorBoundary>
      <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Box size={18} color="#0284C7" /> General Information
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Product Title *
            </label>
            <input
              type="text"
              placeholder="e.g. Sprouted Ragi Malt 500g (Organic Health Blend)"
              value={formData.name || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, name: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.6rem 0.8rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 600 }}
            />
          </div>

          {/* Slug & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                URL Slug *
              </label>
              <input
                type="text"
                value={formData.slug || ''}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, slug: e.target.value }));
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontFamily: 'monospace' }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                Category
              </label>
              <select
                value={formData.category || 'Malt Blends'}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, category: e.target.value }));
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              >
                <option value="Malt Blends">Malt Blends</option>
                <option value="Health Drinks">Health Drinks</option>
                <option value="Organic Mixes">Organic Mixes</option>
                <option value="Traditional Foods">Traditional Foods</option>
                <option value="Superfoods">Superfoods</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
                Brand
              </label>
              <input
                type="text"
                value={formData.brand || 'Blovit Organics'}
                onChange={(e) => {
                  setFormData((prev) => ({ ...prev, brand: e.target.value }));
                  setIsDirty(true);
                }}
                style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* Short Description */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Short Summary
            </label>
            <input
              type="text"
              placeholder="Brief tagline for product catalog cards..."
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
                Full Description
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
              placeholder="Detailed organic product narrative..."
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
