import React from 'react';
import { Activity, Plus, Trash2, Sparkles } from 'lucide-react';
import ErrorBoundary from '../ErrorBoundary';

export default function NutritionCard({
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
            <Activity size={18} color="#059669" /> Nutritional Facts & Information
          </h3>
          <button
            type="button"
            onClick={() => triggerAiGenerator('nutrition')}
            disabled={aiLoadingField === 'nutrition'}
            style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Sparkles size={12} /> {aiLoadingField === 'nutrition' ? 'Generating...' : 'AI Nutrition'}
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', fontSize: '0.75rem', color: '#64748B', textAlign: 'left' }}>
              <th style={{ padding: '6px 8px' }}>Nutrient Name</th>
              <th style={{ padding: '6px 8px' }}>Value</th>
              <th style={{ padding: '6px 8px' }}>Unit</th>
              <th style={{ width: 30 }} />
            </tr>
          </thead>
          <tbody>
            {formData.nutritionTable && formData.nutritionTable.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    value={item.nutrient}
                    onChange={(e) => {
                      const updated = [...formData.nutritionTable];
                      updated[idx].nutrient = e.target.value;
                      setFormData((prev) => ({ ...prev, nutritionTable: updated }));
                      setIsDirty(true);
                    }}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                  />
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    value={item.value}
                    onChange={(e) => {
                      const updated = [...formData.nutritionTable];
                      updated[idx].value = e.target.value;
                      setFormData((prev) => ({ ...prev, nutritionTable: updated }));
                      setIsDirty(true);
                    }}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                  />
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <input
                    type="text"
                    value={item.unit}
                    onChange={(e) => {
                      const updated = [...formData.nutritionTable];
                      updated[idx].unit = e.target.value;
                      setFormData((prev) => ({ ...prev, nutritionTable: updated }));
                      setIsDirty(true);
                    }}
                    style={{ width: '100%', padding: '4px 6px', borderRadius: '4px', border: '1px solid #CBD5E1', fontSize: '0.8rem' }}
                  />
                </td>
                <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, nutritionTable: prev.nutritionTable.filter((_, i) => i !== idx) }));
                      setIsDirty(true);
                    }}
                    style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button
          type="button"
          onClick={() => {
            setFormData((prev) => ({ ...prev, nutritionTable: [...(prev.nutritionTable || []), { nutrient: '', value: '', unit: 'g' }] }));
            setIsDirty(true);
          }}
          style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0284C7', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginTop: '8px' }}
        >
          <Plus size={14} /> Add Nutrient Row
        </button>
      </div>
    </ErrorBoundary>
  );
}
