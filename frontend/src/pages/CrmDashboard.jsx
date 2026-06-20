import { useState, useEffect } from 'react';
import { crmApi } from '../api';
import { LayoutDashboard, Users, UserCheck, TrendingUp, DollarSign, Calendar, BarChart3, AlertCircle } from 'lucide-react';

export default function CrmDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const res = await crmApi.getDashboard();
        setData(res.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching CRM Dashboard:', err);
        setError('Failed to load CRM dashboard details.');
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--danger)' }}>
        <AlertCircle size={40} style={{ marginBottom: '1rem' }} />
        <h3>Error Loading Dashboard</h3>
        <p>{error}</p>
      </div>
    );
  }

  const {
    totalLeads = 0,
    newLeads = 0,
    convertedLeads = 0,
    conversionRate = 0,
    totalPipelineValue = 0,
    followUpStats = { pending: 0, completed: 0, missed: 0 },
    statusBreakdown = [],
    categoryBreakdown = [],
    sourceBreakdown = []
  } = data || {};

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1600px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>CRM Dashboard</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Overview of lead acquisition, pipeline value, and customer conversions.</p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="stat-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--info)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', color: 'var(--info)' }}>
            <Users size={24} />
          </div>
          <div>
            <div className="label">Total Leads</div>
            <div className="value">{totalLeads}</div>
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--warning)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="label">New Leads</div>
            <div className="value">{newLeads}</div>
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--success)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)' }}>
            <UserCheck size={24} />
          </div>
          <div>
            <div className="label">Lead Conversion</div>
            <div className="value success">{conversionRate}%</div>
          </div>
        </div>

        <div className="stat-card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderLeft: '4px solid var(--brand-primary)' }}>
          <div style={{ padding: '0.75rem', borderRadius: '12px', background: 'rgba(90, 45, 12, 0.1)', color: 'var(--brand-primary)' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <div className="label">Pipeline Value</div>
            <div className="value" style={{ color: 'var(--brand-primary)' }}>₹{totalPipelineValue.toLocaleString('en-IN')}</div>
          </div>
        </div>
      </div>

      <div className="chart-grid" style={{ marginBottom: '2rem' }}>
        {/* Follow Ups Status Card */}
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: 700 }}>
            <Calendar size={18} color="var(--brand-primary)" /> Follow-up Summary
          </h3>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1, padding: '1rem', borderRadius: '8px', background: 'var(--bg-page)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--warning)' }}>{followUpStats.pending}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 600 }}>Pending</div>
            </div>
            <div style={{ flex: 1, padding: '1rem', borderRadius: '8px', background: 'var(--bg-page)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{followUpStats.completed}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 600 }}>Completed</div>
            </div>
            <div style={{ flex: 1, padding: '1rem', borderRadius: '8px', background: 'var(--bg-page)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--danger)' }}>{followUpStats.missed}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem', fontWeight: 600 }}>Missed</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Visual Progress Bar */}
            {(() => {
              const total = (followUpStats.pending + followUpStats.completed + followUpStats.missed) || 1;
              const pendPerc = (followUpStats.pending / total) * 100;
              const compPerc = (followUpStats.completed / total) * 100;
              const missPerc = (followUpStats.missed / total) * 100;
              return (
                <div>
                  <div style={{ height: '10px', borderRadius: '5px', overflow: 'hidden', display: 'flex', background: 'var(--border)' }}>
                    <div style={{ width: `${compPerc}%`, background: 'var(--success)', transition: 'width 0.3s' }}></div>
                    <div style={{ width: `${pendPerc}%`, background: 'var(--warning)', transition: 'width 0.3s' }}></div>
                    <div style={{ width: `${missPerc}%`, background: 'var(--danger)', transition: 'width 0.3s' }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                    <span>Success: {Math.round(compPerc)}%</span>
                    <span>Miss Rate: {Math.round(missPerc)}%</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Lead Status Breakdown Card */}
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0', fontSize: '1.1rem', fontWeight: 700 }}>
            <BarChart3 size={18} color="var(--brand-primary)" /> Lead Pipeline Stages
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {statusBreakdown.map((item, idx) => {
              const maxCount = Math.max(...statusBreakdown.map(s => s.count)) || 1;
              const widthPerc = (item.count / maxCount) * 100;
              let barColor = 'var(--brand-primary)';
              if (item.status === 'New') barColor = 'var(--warning)';
              if (item.status === 'Customer') barColor = 'var(--success)';
              if (item.status === 'Rejected') barColor = 'var(--danger)';
              if (item.status === 'Interested') barColor = 'var(--info)';

              return (
                <div key={item.status}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>{item.status}</span>
                    <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{item.count}</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--bg-page)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${widthPerc}%`, background: barColor, borderRadius: '4px', transition: 'width 0.4s' }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="chart-grid">
        {/* Category breakdown */}
        <div className="card">
          <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', fontWeight: 700 }}>Leads by Business Segment</h3>
          {categoryBreakdown.length === 0 ? (
            <div className="empty-state">No category breakdown data available.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {categoryBreakdown.map((item) => {
                const total = categoryBreakdown.reduce((sum, c) => sum + c.count, 0) || 1;
                const perc = Math.round((item.count / total) * 100);
                return (
                  <div key={item.category} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-primary)' }}></span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{item.category}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{item.count}</span>
                      <span style={{ fontSize: '0.75rem', background: 'var(--bg-page)', padding: '2px 8px', borderRadius: '12px', minWidth: '42px', textAlign: 'center', fontWeight: 700 }}>{perc}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Lead Sources Card */}
        <div className="card">
          <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', fontWeight: 700 }}>Lead Sources</h3>
          {sourceBreakdown.length === 0 ? (
            <div className="empty-state">No lead source data available.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {sourceBreakdown.map((item) => {
                const total = sourceBreakdown.reduce((sum, s) => sum + s.count, 0) || 1;
                const perc = Math.round((item.count / total) * 100);
                return (
                  <div key={item.source} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }}></span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{item.source}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{item.count}</span>
                      <span style={{ fontSize: '0.75rem', background: 'var(--bg-page)', padding: '2px 8px', borderRadius: '12px', minWidth: '42px', textAlign: 'center', fontWeight: 700 }}>{perc}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
