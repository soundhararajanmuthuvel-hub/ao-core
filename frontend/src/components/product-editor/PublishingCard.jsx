import React from 'react';
import ErrorBoundary from '../ErrorBoundary';
import { Globe, ShieldCheck, Tag } from 'lucide-react';

export default function PublishingCard({
  formData = {},
  setFormData = () => {},
  setIsDirty = () => {},
}) {
  const isPublished = formData.isPublished !== undefined ? !!formData.isPublished : (formData.status === 'published' || formData.status === 'Published');
  const isActive = formData.isActive !== undefined ? !!formData.isActive : true;

  return (
    <ErrorBoundary>
      <div style={{ marginTop: '1.5rem', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '1.25rem', background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <h4 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0F172A', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Globe size={16} color="#0284C7" /> Storefront Visibility & Lifecycle Status
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
          {/* 1. Show on Website Switch */}
          <div style={{ background: isPublished ? '#F0FDF4' : '#FFF5F5', border: `1px solid ${isPublished ? '#BBF7D0' : '#FECDD3'}`, padding: '1rem', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '0.85rem', color: isPublished ? '#166534' : '#991B1B', display: 'block' }}>🌐 Show on Website</strong>
                <span style={{ fontSize: '0.75rem', color: isPublished ? '#15803D' : '#BE123C' }}>
                  {isPublished ? 'Visible on live storefront API' : 'Hidden from public storefront'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => {
                  const val = e.target.checked;
                  setFormData((prev) => ({
                    ...prev,
                    isPublished: val,
                    publishToWebsite: val,
                    status: val ? 'Published' : 'Draft'
                  }));
                  setIsDirty(true);
                }}
                style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#16A34A' }}
              />
            </div>
          </div>

          {/* 2. ERP Active Switch */}
          <div style={{ background: isActive ? '#F0F9FF' : '#F8FAFC', border: `1px solid ${isActive ? '#BAE6FD' : '#E2E8F0'}`, padding: '1rem', borderRadius: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ fontSize: '0.85rem', color: isActive ? '#0369A1' : '#475569', display: 'block' }}>⚡ ERP Active Status</strong>
                <span style={{ fontSize: '0.75rem', color: isActive ? '#0284C7' : '#64748B' }}>
                  {isActive ? 'Usable in Billing, Sales & Manufacturing' : 'Inactive / Discontinued'}
                </span>
              </div>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => {
                  const val = e.target.checked;
                  setFormData((prev) => ({ ...prev, isActive: val }));
                  setIsDirty(true);
                }}
                style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: '#0284C7' }}
              />
            </div>
          </div>
        </div>

        {/* 3. Stage Dropdown & Availability State */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Publishing Workflow Stage
            </label>
            <select
              value={formData.status || (isPublished ? 'Published' : 'Draft')}
              onChange={(e) => {
                const newStage = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  status: newStage,
                  isPublished: newStage === 'Published',
                  publishToWebsite: newStage === 'Published'
                }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700 }}
            >
              <option value="Draft">Draft (Internal Editing)</option>
              <option value="Ready">Ready (Marketing Reviewed)</option>
              <option value="Published">Published (Live Storefront)</option>
              <option value="Archived">Archived (Unpublished)</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Live Availability State
            </label>
            <select
              value={formData.availabilityState || 'In Stock'}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, availabilityState: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontWeight: 700 }}
            >
              <option value="In Stock">In Stock</option>
              <option value="Out of Stock">Out of Stock</option>
              <option value="Preorder">Preorder</option>
              <option value="Coming Soon">Coming Soon</option>
              <option value="Discontinued">Discontinued</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Sort Display Order
            </label>
            <input
              type="number"
              value={formData.sortOrder || 0}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, sortOrder: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
