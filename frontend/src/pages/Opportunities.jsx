import { useState, useEffect } from 'react';
import { crmApi, customersApi } from '../api';
import { Plus, DollarSign, Calendar, Target, Edit2, Trash2, ShieldAlert } from 'lucide-react';

const STAGES = ['Qualification', 'Proposal', 'Negotiation', 'Won', 'Lost'];

const STAGE_COLORS = {
  Qualification: '#64748b',
  Proposal: '#3b82f6',
  Negotiation: '#f59e0b',
  Won: '#10b981',
  Lost: '#ef4444'
};

export default function Opportunities() {
  const [opportunities, setOpportunities] = useState([]);
  const [leads, setLeads] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    value: '',
    stage: 'Qualification',
    closeDate: '',
    leadId: '',
    customerId: '',
    notes: ''
  });

  const [draggedOverStage, setDraggedOverStage] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [oppRes, leadsRes, custRes] = await Promise.all([
        crmApi.getOpportunities(),
        crmApi.getLeads(),
        customersApi.list({ limit: 100 })
      ]);
      setOpportunities(oppRes.data);
      setLeads(leadsRes.data);
      setCustomers(custRes.data.customers || []);
    } catch (err) {
      console.error('Error fetching opportunities data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Form submit (Add/Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const dataToSubmit = {
        ...formData,
        value: parseFloat(formData.value) || 0,
        leadId: formData.leadId ? parseInt(formData.leadId) : null,
        customerId: formData.customerId ? parseInt(formData.customerId) : null,
        closeDate: formData.closeDate || null
      };

      if (isEditing) {
        await crmApi.updateOpportunity(editingId, dataToSubmit);
      } else {
        await crmApi.createOpportunity(dataToSubmit);
      }
      setModalOpen(false);
      resetForm();
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving opportunity');
    }
  };

  // Edit click
  const handleEdit = (opp) => {
    setFormData({
      title: opp.title || '',
      value: opp.value || '',
      stage: opp.stage || 'Qualification',
      closeDate: opp.closeDate ? opp.closeDate.split('T')[0] : '',
      leadId: opp.leadId || '',
      customerId: opp.customerId || '',
      notes: opp.notes || ''
    });
    setIsEditing(true);
    setEditingId(opp.id);
    setModalOpen(true);
  };

  // Delete opportunity
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this opportunity?')) return;
    try {
      await crmApi.deleteOpportunity(id);
      loadData();
    } catch (err) {
      alert('Error deleting opportunity');
    }
  };

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e, oppId) => {
    e.dataTransfer.setData('text/plain', oppId.toString());
  };

  const handleDragOver = (e, stage) => {
    e.preventDefault();
    setDraggedOverStage(stage);
  };

  const handleDrop = async (e, targetStage) => {
    e.preventDefault();
    setDraggedOverStage(null);
    const oppIdStr = e.dataTransfer.getData('text/plain');
    if (!oppIdStr) return;
    const oppId = parseInt(oppIdStr);
    
    // Find matching opportunity
    const opp = opportunities.find(o => o.id === oppId);
    if (!opp || opp.stage === targetStage) return;

    // Optimistic UI update
    setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, stage: targetStage } : o));

    try {
      await crmApi.updateOpportunity(oppId, { stage: targetStage });
    } catch (err) {
      console.error('Failed to update stage on server:', err);
      // Revert if API call fails
      loadData();
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      value: '',
      stage: 'Qualification',
      closeDate: '',
      leadId: '',
      customerId: '',
      notes: ''
    });
    setIsEditing(false);
    setEditingId(null);
  };

  // Calculate metrics
  const totalPipeline = opportunities
    .filter(o => o.stage !== 'Won' && o.stage !== 'Lost')
    .reduce((sum, o) => sum + (parseFloat(o.value) || 0), 0);

  const wonTotal = opportunities
    .filter(o => o.stage === 'Won')
    .reduce((sum, o) => sum + (parseFloat(o.value) || 0), 0);

  const totalOpps = opportunities.length || 1;
  const wonCount = opportunities.filter(o => o.stage === 'Won').length;
  const winRate = Math.round((wonCount / totalOpps) * 100);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>Deals & Opportunities</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Drag cards to progress deal status. Track pipeline forecast & closed wins.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setModalOpen(true); }}>
          <Plus size={18} /> New Deal Opportunity
        </button>
      </div>

      {/* Tally Metrics */}
      <div className="stat-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--info)' }}>
          <div className="label">Open Pipeline Forecast</div>
          <div className="value" style={{ color: 'var(--info)' }}>₹{totalPipeline.toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div className="label">Total Closed Wins</div>
          <div className="value success">₹{wonTotal.toLocaleString('en-IN')}</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="label">Conversion Win Rate</div>
          <div className="value warning">{winRate}%</div>
        </div>
      </div>

      {/* Kanban Board Container */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: '1rem',
        alignItems: 'start',
        overflowX: 'auto',
        paddingBottom: '1rem'
      }} className="form-row">
        {STAGES.map((stage) => {
          const colOpps = opportunities.filter(o => o.stage === stage);
          const colValue = colOpps.reduce((sum, o) => sum + (parseFloat(o.value) || 0), 0);
          const isDragOver = draggedOverStage === stage;

          return (
            <div
              key={stage}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDrop={(e) => handleDrop(e, stage)}
              style={{
                background: isDragOver ? 'rgba(90, 45, 12, 0.04)' : 'var(--bg-page)',
                borderRadius: 'var(--radius)',
                border: isDragOver ? '2px dashed var(--brand-primary)' : '1px solid var(--border)',
                padding: '0.75rem',
                minHeight: '480px',
                display: 'flex',
                flexDirection: 'column',
                transition: 'background 0.2s, border 0.2s'
              }}
            >
              {/* Column Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                borderBottom: `2px solid ${STAGE_COLORS[stage]}`,
                paddingBottom: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STAGE_COLORS[stage] }}></span>
                  <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{stage}</span>
                </div>
                <span style={{ fontSize: '0.75rem', background: 'var(--bg-card)', padding: '2px 6px', borderRadius: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  {colOpps.length}
                </span>
              </div>

              {/* Column Value Forecast */}
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                ₹{colValue.toLocaleString('en-IN')}
              </div>

              {/* Cards Wrapper */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
                {colOpps.map((opp) => {
                  const shopName = opp.lead?.shopName || opp.customer?.name || 'Independent Opportunity';
                  return (
                    <div
                      key={opp.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, opp.id)}
                      className="card"
                      style={{
                        padding: '0.75rem',
                        cursor: 'grab',
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
                        userSelect: 'none',
                        transition: 'transform 0.15s'
                      }}
                      onDragEnd={(e) => e.target.style.opacity = '1'}
                      onDragOver={(e) => e.target.style.opacity = '0.5'}
                    >
                      <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>{opp.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--brand-primary)', fontWeight: 700, marginBottom: '0.5rem' }}>₹{opp.value ? opp.value.toLocaleString('en-IN') : '0'}</div>
                      
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Target size={12} /> {shopName}
                      </div>

                      {opp.closeDate && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          <Calendar size={12} /> Target: {new Date(opp.closeDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.4rem', borderTop: '1px solid var(--bg-page)', marginTop: '0.6rem', paddingTop: '0.4rem' }}>
                        <button className="btn btn-icon btn-sm" onClick={() => handleEdit(opp)} style={{ padding: '2px 4px', height: '24px', minHeight: '24px' }}>
                          <Edit2 size={10} />
                        </button>
                        <button className="btn btn-icon btn-sm" onClick={() => handleDelete(opp.id)} style={{ padding: '2px 4px', height: '24px', minHeight: '24px', color: 'var(--danger)' }}>
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE / EDIT MODAL */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, color: 'var(--brand-primary)', fontWeight: 800 }}>
                {isEditing ? 'Modify Opportunity' : 'New Deal Opportunity'}
              </h3>
              <button style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Deal Opportunity Title *</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Bulk Repacked Millet Deal"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Deal Value (INR) *</label>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="₹"
                      required
                      value={formData.value}
                      onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Estimated Target Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={formData.closeDate}
                      onChange={(e) => setFormData({ ...formData, closeDate: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Link to Lead (Optional)</label>
                    <select
                      className="form-control"
                      value={formData.leadId}
                      onChange={(e) => setFormData({ ...formData, leadId: e.target.value, customerId: '' })}
                    >
                      <option value="">— Select Lead —</option>
                      {leads.map(l => (
                        <option key={l.id} value={l.id}>{l.shopName} ({l.city})</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Link to Converted Customer</label>
                    <select
                      className="form-control"
                      value={formData.customerId}
                      onChange={(e) => setFormData({ ...formData, customerId: e.target.value, leadId: '' })}
                    >
                      <option value="">— Select Customer —</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Pipeline Stage *</label>
                    <select
                      className="form-control"
                      value={formData.stage}
                      onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
                    >
                      {STAGES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Deal Notes / Next Action Plan</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{isEditing ? 'Save Changes' : 'Launch Opportunity'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
