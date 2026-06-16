import { useEffect, useState, useCallback } from 'react';
import { aiApi } from '../api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts';

const COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

export default function AIAnalytics() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    summary: {},
    insights: [],
    channelShare: [],
    typeShare: [],
  });

  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      const { data: resData } = await aiApi.insights();
      setData(resData);
    } catch {
      toast('Failed to load AI Consultant Insights', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  return (
    <div className="page" style={{ '--brand-primary': '#8b5cf6' }}>
      <div className="page-header" style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <div>
          <h1 className="page-title">
            🧠 AI Executive Advisor
          </h1>
          <p className="page-subtitle">Dynamic diagnostic analysis of your sales channels, segmentation performance, and actionable organic recommendations.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={loadInsights}>
          🔄 Refresh Audit
        </button>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Executive Overview Cards */}
          <div className="rm-dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="rm-stat-card" style={{ background: 'linear-gradient(135deg, #f5f3ff 0%, #edd9ff 100%)', border: '1px solid #c084fc' }}>
              <div className="rm-stat-info">
                <h3 style={{ color: '#6d28d9', fontWeight: 600 }}>Best Channel</h3>
                <p style={{ color: '#4c1d95', fontSize: '1.25rem' }}>{data.summary.bestSalesChannel || 'Retail Shop'}</p>
              </div>
            </div>
            <div className="rm-stat-card" style={{ background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', border: '1px solid #34d399' }}>
              <div className="rm-stat-info">
                <h3 style={{ color: '#047857', fontWeight: 600 }}>D2C Growth</h3>
                <p style={{ color: '#064e3b', fontSize: '1.25rem' }}>{data.summary.d2cGrowth}% MoM</p>
              </div>
            </div>
            <div className="rm-stat-card" style={{ background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', border: '1px solid #fbbf24' }}>
              <div className="rm-stat-info">
                <h3 style={{ color: '#b45309', fontWeight: 600 }}>White Label Growth</h3>
                <p style={{ color: '#78350f', fontSize: '1.25rem' }}>{data.summary.whiteLabelGrowth}% MoM</p>
              </div>
            </div>
            <div className="rm-stat-card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', border: '1px solid #60a5fa' }}>
              <div className="rm-stat-info">
                <h3 style={{ color: '#1d4ed8', fontWeight: 600 }}>D2C Customer Retention</h3>
                <p style={{ color: '#1e3a8a', fontSize: '1.25rem' }}>{data.summary.customerRetention}%</p>
              </div>
            </div>
          </div>

          {/* Diagnostics AI Cards Grid */}
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>💡 AI Diagnostic Findings</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
              {data.insights.map((insight, idx) => {
                let borderCol = '#8b5cf6';
                let bgCol = '#f5f3ff';
                if (insight.type === 'success') {
                  borderCol = '#10b981';
                  bgCol = '#ecfdf5';
                } else if (insight.type === 'warning') {
                  borderCol = '#f59e0b';
                  bgCol = '#fffbeb';
                } else if (insight.type === 'danger') {
                  borderCol = '#ef4444';
                  bgCol = '#fef2f2';
                }

                return (
                  <div key={idx} style={{ background: bgCol, borderLeft: `6px solid ${borderCol}`, padding: '1.25rem', borderRadius: '10px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '130px' }}>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1f2937', margin: '0 0 0.5rem 0' }}>{insight.title}</h3>
                      <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: 0, lineHeight: '1.5' }}>{insight.message}</p>
                    </div>
                    <div style={{ alignSelf: 'flex-end', fontSize: '0.75rem', fontWeight: 700, color: borderCol, background: 'white', padding: '0.25rem 0.5rem', borderRadius: '6px', marginTop: '0.75rem' }}>
                      {insight.metric}
                    </div>
                  </div>
                );
              })}
              {data.insights.length === 0 && (
                <div className="card" style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9ca3af', padding: '2rem' }}>
                  Awaiting database transaction statistics. Create sales or manufacturing entries to update the audit analyzer.
                </div>
              )}
            </div>
          </div>

          {/* Revenue Shares Charts */}
          <div className="rm-dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
            {/* Sales Channel revenue share */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', textAlign: 'center' }}>Revenue Share By Sales Channel</h3>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.channelShare} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} outerRadius={70} fill="#8884d8" dataKey="value">
                      {data.channelShare.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Customer Type revenue share */}
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', textAlign: 'center' }}>Revenue Share By Customer Type</h3>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.typeShare} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} outerRadius={70} fill="#8884d8" dataKey="value">
                      {data.typeShare.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
