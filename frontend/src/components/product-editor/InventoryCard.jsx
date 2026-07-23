import React from 'react';
import { Database } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';

export default function InventoryCard({
  formData = {},
  setFormData = () => {},
  setIsDirty = () => {},
  stockStatus = { label: 'In Stock', color: '#10B981', badge: 'badge-success' },
}) {
  return (
    <ErrorBoundary>
      <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} color="#D97706" /> Inventory & Warehousing
          </h3>
          <span style={{ background: `${stockStatus.color}15`, color: stockStatus.color, border: `1px solid ${stockStatus.color}40`, padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800 }}>
            {stockStatus.label}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Stock Quantity *
            </label>
            <input
              type="number"
              value={formData.stock !== undefined ? formData.stock : 100}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, stock: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 700 }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Low Stock Threshold
            </label>
            <input
              type="number"
              value={formData.lowStockThreshold || 10}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, lowStockThreshold: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              SKU Code
            </label>
            <input
              type="text"
              placeholder="BLV-RAGI-500"
              value={formData.sku || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, sku: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontFamily: 'monospace' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Barcode / EAN
            </label>
            <input
              type="text"
              placeholder="8901234567890"
              value={formData.barcode || ''}
              onChange={(e) => {
                setFormData((prev) => ({ ...prev, barcode: e.target.value }));
                setIsDirty(true);
              }}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
