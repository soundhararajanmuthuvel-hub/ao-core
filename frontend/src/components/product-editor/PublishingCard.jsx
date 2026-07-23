import React from 'react';
import ErrorBoundary from '../ErrorBoundary';

export default function PublishingCard({
  formData = {},
  setFormData = () => {},
  setIsDirty = () => {},
}) {
  return (
    <ErrorBoundary>
      <div style={{ marginTop: '1.5rem', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1rem', background: '#FAFAFA' }}>
        <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0F172A', marginBottom: '0.75rem' }}>Publishing Status</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="pubStatus"
              value="published"
              checked={formData.status === 'published'}
              onChange={() => {
                setFormData((prev) => ({ ...prev, status: 'published' }));
                setIsDirty(true);
              }}
            />
            Published (Live on Storefront)
          </label>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="radio"
              name="pubStatus"
              value="draft"
              checked={formData.status === 'draft'}
              onChange={() => {
                setFormData((prev) => ({ ...prev, status: 'draft' }));
                setIsDirty(true);
              }}
            />
            Draft (Hidden from Storefront)
          </label>
        </div>
      </div>
    </ErrorBoundary>
  );
}
