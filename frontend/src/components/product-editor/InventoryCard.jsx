import React from 'react';
import { Database, Lock } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';

export default function InventoryCard({
  formData = {},
  stockStatus = { label: 'In Stock', color: '#10B981', badge: 'badge-success' },
}) {
  return (
    <ErrorBoundary>
      <div style={{ background: '#FFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0F172A', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Database size={18} color="#D97706" /> Inventory & Stock (Product Master)
            </h3>
            <span style={{ fontSize: '0.7rem', color: '#0284C7', fontWeight: 700, background: '#E0F2FE', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={11} /> Read-Only from Billing
            </span>
          </div>
          <span style={{ background: `${stockStatus.color}15`, color: stockStatus.color, border: `1px solid ${stockStatus.color}40`, padding: '2px 10px', borderRadius: '12px', fontSize: '0.78rem', fontWeight: 800 }}>
            {stockStatus.label}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Live Stock Quantity
            </label>
            <input
              type="text"
              readOnly
              value={formData.stock !== undefined ? formData.stock : 0}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', fontWeight: 800, backgroundColor: '#F8FAFC', color: '#0F172A' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Billing Status
            </label>
            <input
              type="text"
              readOnly
              value={formData.masterStatus || 'Active'}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', backgroundColor: '#F8FAFC', fontWeight: 700, color: formData.masterStatus === 'Inactive' ? '#DC2626' : '#166534' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              SKU Code
            </label>
            <input
              type="text"
              readOnly
              value={formData.sku || 'N/A'}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', fontFamily: 'monospace', backgroundColor: '#F8FAFC', fontWeight: 600, color: '#334155' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: '#475569', marginBottom: '4px', display: 'block' }}>
              Barcode / EAN
            </label>
            <input
              type="text"
              readOnly
              value={formData.barcode || 'N/A'}
              style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.85rem', backgroundColor: '#F8FAFC', color: '#334155' }}
            />
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
