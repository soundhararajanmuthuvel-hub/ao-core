import React from 'react';
import { Layers, Plus, Trash2, Sparkles } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';

export default function BenefitsCard({
  formData = {},
  setFormData = () => {},
  setIsDirty = () => {},
  triggerAiGenerator = () => {},
  aiLoadingField = null,
}) {
  return (
    <ErrorBoundary>
      <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Layers size={18} color="#9333EA" /> Key Health Benefits
          </h3>
          <button
            type="button"
            onClick={() => triggerAiGenerator('benefits')}
            disabled={aiLoadingField === 'benefits'}
            style={{ background: '#FAF5FF', color: '#9333EA', border: '1px solid #E9D5FF', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Sparkles size={12} /> {aiLoadingField === 'benefits' ? 'Generating...' : 'AI Benefits'}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {formData.benefits && formData.benefits.map((b, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                type="text"
                placeholder="e.g. 100% Sprouted & Easily Digestible"
                value={b}
                onChange={(e) => {
                  const updated = [...formData.benefits];
                  updated[idx] = e.target.value;
                  setFormData((prev) => ({ ...prev, benefits: updated }));
                  setIsDirty(true);
                }}
                style={{ flex: 1, padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
              />
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, benefits: prev.benefits.filter((_, i) => i !== idx) }));
                  setIsDirty(true);
                }}
                style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', borderRadius: '6px', padding: '4px', cursor: 'pointer' }}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => {
              setFormData((prev) => ({ ...prev, benefits: [...(prev.benefits || []), ''] }));
              setIsDirty(true);
            }}
            style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0284C7', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}
          >
            <Plus size={14} /> Add Benefit
          </button>
        </div>
      </div>
    </ErrorBoundary>
  );
}
