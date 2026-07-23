import React from 'react';
import { Globe, Sparkles } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';

export default function SEOCard({
  formData = {},
  setFormData = () => {},
  setIsDirty = () => {},
  triggerAiGenerator = () => {},
  aiLoadingField = null,
  seoScore = 0,
}) {
  return (
    <ErrorBoundary>
      <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={18} color="#2563EB" /> SEO & Google Search Snippet Preview
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ background: seoScore >= 70 ? '#ECFDF5' : '#FEF3C7', color: seoScore >= 70 ? '#047857' : '#B45309', padding: '2px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 800 }}>
              SEO Score: {seoScore}%
            </span>
            <button
              type="button"
              onClick={() => triggerAiGenerator('seo')}
              disabled={aiLoadingField === 'seo'}
              style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Sparkles size={12} /> {aiLoadingField === 'seo' ? 'Generating...' : 'AI Meta Tags'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Meta Title ({(formData.metaTitle || '').length}/60)
            </label>
            <input
              type="text"
              value={formData.metaTitle || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, metaTitle: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Meta Description ({(formData.metaDescription || '').length}/160)
            </label>
            <textarea
              rows={2}
              value={formData.metaDescription || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, metaDescription: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Target SEO Keywords
            </label>
            <input
              type="text"
              placeholder="organic malt, ragi drink, traditional health blend"
              value={formData.keywords || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, keywords: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            />
          </div>

          {/* SERP Snippet Box */}
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#202124', marginBottom: '2px' }}>https://blovit.com › products › {formData.slug || 'product-slug'}</div>
            <div style={{ fontSize: '1rem', color: '#1a0dab', fontWeight: 600, textDecoration: 'underline', marginBottom: '2px' }}>
              {formData.metaTitle || formData.name || 'Product Title'}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#4d5156', lineHeight: '1.4' }}>
              {formData.metaDescription || 'Buy organic health mix online. 100% natural and sprouted.'}
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
