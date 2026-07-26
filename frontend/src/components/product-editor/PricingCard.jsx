import React from 'react';
import { DollarSign } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';

export default function PricingCard({
  formData = {},
  setFormData = () => {},
  setIsDirty = () => {},
  calculatedDiscount = 0,
}) {
  return (
    <ErrorBoundary>
      <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={18} color="#16A34A" /> Pricing & Tax Settings
            </h3>
          </div>
          {calculatedDiscount > 0 && (
            <span style={{ background: '#DCFCE7', color: '#15803D', border: '1px solid #86EFAC', padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800 }}>
              {calculatedDiscount}% OFF Special Offer
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Selling Price (₹) *
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 299"
              value={formData.price || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, price: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 800, color: '#0284C7' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Compare-at / Original MRP (₹)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 399"
              value={formData.mrp || formData.compareAtPrice || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, mrp: e.target.value, compareAtPrice: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', color: '#64748B', fontWeight: 600 }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              GST Rate (%)
            </label>
            <input
              type="number"
              min="0"
              max="28"
              value={formData.gstPercent !== undefined ? formData.gstPercent : 5}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, gstPercent: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', color: '#334155', fontWeight: 600 }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Unit / Weight
            </label>
            <input
              type="text"
              placeholder="e.g. 250g / pcs"
              value={formData.unit || 'pcs'}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, unit: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 600 }}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
