import { useState, useEffect } from 'react';
import { crmApi } from '../api';
import { CheckCircle, Clock, AlertTriangle, Phone, MapPin, FileText, Gift, Bookmark, Trash2, Edit2, Calendar } from 'lucide-react';

export default function FollowUps() {
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Pending'); // Pending, Completed, Missed
  const [typeFilter, setTypeFilter] = useState('');

  const loadFollowUps = async () => {
    try {
      setLoading(true);
      const params = {
        status: activeTab
      };
      const res = await crmApi.getFollowUps(params);
      setFollowUps(res.data);
    } catch (err) {
      console.error('Error fetching follow-ups:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFollowUps();
  }, [activeTab]);

  const handleMarkComplete = async (e, id) => {
    e.stopPropagation();
    try {
      await crmApi.updateFollowUp(id, { status: 'Completed' });
      loadFollowUps();
      alert('Task marked as completed!');
    } catch (err) {
      alert('Failed to update task');
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Delete this follow-up schedule?')) return;
    try {
      await crmApi.deleteFollowUp(id);
      loadFollowUps();
    } catch (err) {
      alert('Failed to delete task');
    }
  };

  // Get matching icon based on follow-up type
  const getTypeIcon = (type) => {
    switch (type) {
      case 'Call Customer':
        return <Phone size={16} color="var(--info)" />;
      case 'Visit Customer':
        return <MapPin size={16} color="var(--brand-primary)" />;
      case 'Send Catalog':
        return <FileText size={16} color="var(--warning)" />;
      case 'Send Offer':
        return <Bookmark size={16} color="var(--danger)" />;
      case 'Send Sample':
        return <Gift size={16} color="var(--success)" />;
      default:
        return <Phone size={16} color="var(--text-secondary)" />;
    }
  };

  const filteredFollowUps = typeFilter 
    ? followUps.filter(f => f.type === typeFilter)
    : followUps;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>Sales Follow-ups</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Log communication prompts, calls, product catalog visits, and reminders.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-bar" style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.5rem' }}>
        <button
          className={`tab-btn ${activeTab === 'Pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('Pending')}
          style={{
            padding: '0.75rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'Pending' ? '3px solid var(--warning)' : '3px solid transparent',
            color: activeTab === 'Pending' ? 'var(--warning)' : 'var(--text-secondary)'
          }}
        >
          <Clock size={16} style={{ marginRight: '0.35rem', display: 'inline-block', verticalAlign: 'text-bottom' }} /> Pending Tasks
        </button>
        <button
          className={`tab-btn ${activeTab === 'Completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('Completed')}
          style={{
            padding: '0.75rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'Completed' ? '3px solid var(--success)' : '3px solid transparent',
            color: activeTab === 'Completed' ? 'var(--success)' : 'var(--text-secondary)'
          }}
        >
          <CheckCircle size={16} style={{ marginRight: '0.35rem', display: 'inline-block', verticalAlign: 'text-bottom' }} /> Completed Logs
        </button>
        <button
          className={`tab-btn ${activeTab === 'Missed' ? 'active' : ''}`}
          onClick={() => setActiveTab('Missed')}
          style={{
            padding: '0.75rem 1rem',
            border: 'none',
            background: 'none',
            fontSize: '0.9rem',
            fontWeight: 700,
            cursor: 'pointer',
            borderBottom: activeTab === 'Missed' ? '3px solid var(--danger)' : '3px solid transparent',
            color: activeTab === 'Missed' ? 'var(--danger)' : 'var(--text-secondary)'
          }}
        >
          <AlertTriangle size={16} style={{ marginRight: '0.35rem', display: 'inline-block', verticalAlign: 'text-bottom' }} /> Missed Reminders
        </button>
      </div>

      {/* Filter and Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }} className="form-row">
        {/* Filter Card */}
        <div className="card" style={{ height: 'fit-content', padding: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 1rem 0' }}>Filter by Type</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              { label: 'All Activities', value: '' },
              { label: 'Call Customer', value: 'Call Customer' },
              { label: 'Visit Customer', value: 'Visit Customer' },
              { label: 'Send Catalog', value: 'Send Catalog' },
              { label: 'Send Offer', value: 'Send Offer' },
              { label: 'Send Sample', value: 'Send Sample' }
            ].map(t => (
              <button
                key={t.label}
                onClick={() => setTypeFilter(t.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  background: typeFilter === t.value ? 'rgba(90, 45, 12, 0.08)' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  color: typeFilter === t.value ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  transition: 'all 0.15s'
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Task Cards Container */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {loading ? (
            <div className="loading-spinner">
              <div className="spinner"></div>
            </div>
          ) : filteredFollowUps.length === 0 ? (
            <div className="card empty-state">
              <h3>No follow-ups recorded</h3>
              <p>Great job! There are no records match this criteria.</p>
            </div>
          ) : (
            filteredFollowUps.map(f => {
              const shopName = f.lead?.shopName || f.customer?.name || 'Unknown Client';
              const targetDate = new Date(f.followUpDate);
              const isMissed = activeTab === 'Missed' || (f.status === 'Pending' && targetDate < new Date());

              return (
                <div
                  key={f.id}
                  className="card"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '1rem',
                    background: 'var(--bg-card)',
                    borderLeft: `4px solid ${isMissed ? 'var(--danger)' : (activeTab === 'Completed' ? 'var(--success)' : 'var(--warning)')}`
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                    <div style={{ padding: '0.6rem', borderRadius: '8px', background: 'var(--bg-page)', marginTop: '0.2rem' }}>
                      {getTypeIcon(f.type)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <h4 style={{ margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>{f.type}</h4>
                        <span style={{ fontSize: '0.75rem', background: 'var(--bg-page)', padding: '2px 8px', borderRadius: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                          {shopName}
                        </span>
                      </div>
                      <p style={{ margin: '0.4rem 0 0.4rem 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{f.notes || 'No description notes recorded.'}</p>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <Calendar size={12} />
                        <span>Due: {targetDate.toLocaleDateString('en-IN')} {targetDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {f.status === 'Pending' && (
                      <button className="btn btn-success btn-sm" onClick={(e) => handleMarkComplete(e, f.id)}>
                        Mark Complete
                      </button>
                    )}
                    <button className="btn btn-icon btn-sm" onClick={(e) => handleDelete(e, f.id)} style={{ color: 'var(--danger)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
