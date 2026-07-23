import React from 'react';
import { Eye, Star, ShoppingCart, ShieldCheck } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';
import { resolveAssetUrl } from '../../utils/url';

export default function PreviewCard({
  formData = {},
  previewImage = null,
  calculatedDiscount = 0,
}) {
  const displayImage = previewImage || (formData.images && formData.images.length > 0 ? resolveAssetUrl(formData.images[0]) : null);

  return (
    <ErrorBoundary>
      <div style={{ border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', background: '#FAFAFA' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Eye size={16} color="#0284C7" /> Storefront Card Live Preview
          </h4>
          <span style={{ fontSize: '0.65rem', background: '#0284C7', color: '#FFF', fontWeight: 700, padding: '1px 6px', borderRadius: '4px' }}>
            Live Sync
          </span>
        </div>

        {/* E-Commerce Product Card Mock */}
        <div style={{ background: '#FFF', border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
          <div style={{ position: 'relative', height: '160px', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {displayImage ? (
              <img src={displayImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: '0.75rem' }}>
                No Product Image
              </div>
            )}

            {calculatedDiscount > 0 && (
              <span style={{ position: 'absolute', top: 8, left: 8, background: '#DC2626', color: '#FFF', fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>
                {calculatedDiscount}% OFF
              </span>
            )}
          </div>

          <div style={{ padding: '0.85rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#0284C7', textTransform: 'uppercase', tracking: '0.5px' }}>
              {formData.category || 'Malt Blends'}
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {formData.name || 'Sprouted Ragi Malt 500g'}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: '4px 0' }}>
              <Star size={12} color="#F59E0B" fill="#F59E0B" />
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0F172A' }}>4.9</span>
              <span style={{ fontSize: '0.7rem', color: '#64748B' }}>(128 reviews)</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem', marginTop: '6px' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A' }}>
                ₹{formData.price || '399'}
              </span>
              {formData.mrp && parseFloat(formData.mrp) > (parseFloat(formData.price) || 0) && (
                <span style={{ fontSize: '0.78rem', color: '#94A3B8', textDecoration: 'line-through' }}>
                  ₹{formData.mrp}
                </span>
              )}
            </div>

            <button
              type="button"
              style={{ width: '100%', marginTop: '0.65rem', background: '#0284C7', color: '#FFF', border: 'none', borderRadius: '6px', padding: '0.4rem', fontSize: '0.78rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', cursor: 'pointer' }}
            >
              <ShoppingCart size={14} /> Add to Cart
            </button>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
