import React from 'react';
import { DollarSign, Lock } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';

export default function PricingCard({
  formData = {},
  calculatedDiscount = 0,
}) {
  return (
    <ErrorBoundary>
      <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <DollarSign size={18} color="#16A34A" /> Commercial Pricing & Tax (Product Master)
            </h3>
            <span style={{ fontSize: '0.7rem', color: '#0284C7', fontWeight: 700, background: '#E0F2FE', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={11} /> Read-Only from Billing
            </span>
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
              Selling Price (₹)
            </label>
            <input
              type="text"
              readOnly
              value={`₹${formData.price || 0}`}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 800, color: '#0284C7', backgroundColor: '#F8FAFC' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Compare-at MRP (₹)
            </label>
            <input
              type="text"
              readOnly
              value={formData.mrp ? `₹${formData.mrp}` : 'N/A'}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', color: '#64748B', backgroundColor: '#F8FAFC', fontWeight: 600 }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              GST Rate (%)
            </label>
            <input
              type="text"
              readOnly
              value={`${formData.gstPercent !== undefined ? formData.gstPercent : 5}%`}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', backgroundColor: '#F8FAFC', fontWeight: 700, color: '#334155' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Unit / Weight
            </label>
            <input
              type="text"
              readOnly
              value={formData.unit || 'pcs'}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', backgroundColor: '#F8FAFC', fontWeight: 600 }}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
