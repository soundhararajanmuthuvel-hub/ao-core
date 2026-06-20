import { useState, useEffect } from 'react';
import { sfaApi, usersApi } from '../api';
import { BarChart3, Users, Clipboard, Percent, Clock, MapPin, Search } from 'lucide-react';

export default function FieldSalesAnalytics() {
  const [salesmen, setSalesmen] = useState([]);
  const [selectedSalesmanId, setSelectedSalesmanId] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSalesmen = async () => {
      try {
        const res = await usersApi.list({ limit: 100 });
        const list = (res.data?.users || []).filter(u => u.role === 'Salesman' || u.role === 'Sales Executive');
        setSalesmen(list);
        if (list.length > 0) {
          setSelectedSalesmanId(list[0].id);
        }
      } catch (err) {
        console.error('Error fetching salesmen list:', err);
      }
    };
    loadSalesmen();
  }, []);

  const loadAnalytics = async () => {
    if (!selectedSalesmanId) return;
    try {
      setLoading(true);
      const res = await sfaApi.getAnalytics({
        salesmanId: selectedSalesmanId,
        date: selectedDate
      });
      setAnalytics(res.data);
    } catch (err) {
      console.error('Error fetching SFA performance analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [selectedSalesmanId, selectedDate]);

  const {
    assignedCustomers = 0,
    visitedCustomers = 0,
    ordersGenerated = 0,
    orderConversionRate = 0,
    timeSpentInFieldMin = 0,
    averageDurationPerVisitMin = 0
  } = analytics || {};

  const coverageRate = assignedCustomers > 0 ? Math.round((visitedCustomers / assignedCustomers) * 100) : 0;

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>Field Sales Performance Analytics</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0.25rem 0 0 0' }}>Track visit completion ratios, order generation, visit durations, and salesmen coverage stats.</p>
      </div>

      {/* Filter Options */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, minWidth: '240px' }}>
            <label style={{ fontWeight: 600 }}>Select Sales Executive</label>
            <select
              className="form-control"
              value={selectedSalesmanId}
              onChange={(e) => setSelectedSalesmanId(e.target.value)}
            >
              <option value="" disabled>— Select Salesman —</option>
              {salesmen.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
            <label style={{ fontWeight: 600 }}>Target Date</label>
            <input
              type="date"
              className="form-control"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={loadAnalytics}>
            Refresh Analytics
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      ) : !analytics ? (
        <div className="card empty-state">
          <h3>No Analytics Available</h3>
          <p>Please select an active salesman and date to generate metrics.</p>
        </div>
      ) : (
        <div>
          {/* KPI Analytics Grid */}
          <div className="stat-grid" style={{ marginBottom: '2rem' }}>
            <div className="stat-card" style={{ borderLeft: '4px solid var(--info)' }}>
              <div className="label">Beat Route Coverage Rate</div>
              <div className="value" style={{ color: 'var(--info)' }}>{coverageRate}%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                {visitedCustomers} visited / {assignedCustomers} assigned
              </div>
            </div>
            
            <div className="stat-card" style={{ borderLeft: '4px solid var(--success)' }}>
              <div className="label">Orders Generated</div>
              <div className="value success">{ordersGenerated} orders</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Through visited shops
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
              <div className="label">Visit-to-Order Conversion</div>
              <div className="value warning">{orderConversionRate}%</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Order productivity ratio
              </div>
            </div>

            <div className="stat-card" style={{ borderLeft: '4px solid var(--brand-primary)' }}>
              <div className="label">Time Spent in Field</div>
              <div className="value" style={{ color: 'var(--brand-primary)' }}>{timeSpentInFieldMin} mins</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                Avg visit duration: {averageDurationPerVisitMin} mins
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.5rem' }} className="form-row">
            {/* Visual Performance Charts */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 2rem 0', alignSelf: 'flex-start' }}>Beat Coverage Percentage</h3>
              
              {/* Circular SVG Chart */}
              <div style={{ position: 'relative', width: '200px', height: '200px' }}>
                <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke="var(--border)"
                    strokeWidth="16"
                  />
                  <circle
                    cx="100"
                    cy="100"
                    r="85"
                    fill="none"
                    stroke="var(--brand-primary)"
                    strokeWidth="16"
                    strokeDasharray={2 * Math.PI * 85}
                    strokeDashoffset={2 * Math.PI * 85 * (1 - (coverageRate / 100))}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.6s ease-in-out' }}
                  />
                </svg>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Inter, sans-serif'
                }}>
                  <span style={{ fontSize: '2.25rem', fontWeight: 900, color: 'var(--text-primary)' }}>{coverageRate}%</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Coverage</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1.5rem', marginTop: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--brand-primary)' }}></span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Visited ({visitedCustomers})</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--border)' }}></span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Remaining ({Math.max(0, assignedCustomers - visitedCustomers)})</span>
                </div>
              </div>
            </div>

            {/* Performance Analytics Log Details */}
            <div className="card">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1.25rem 0' }}>Daily Workday Analytics</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Customer Beat Pool</span>
                  <strong style={{ fontSize: '0.9rem' }}>{assignedCustomers} retailers</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Shops Checked-in Today</span>
                  <strong style={{ fontSize: '0.9rem' }}>{visitedCustomers} shops</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Productive Orders Transacted</span>
                  <strong style={{ fontSize: '0.9rem' }}>{ordersGenerated} orders</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cumulative Field Time</span>
                  <strong style={{ fontSize: '0.9rem' }}>{timeSpentInFieldMin} minutes</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Average Duration Per Shop Visit</span>
                  <strong style={{ fontSize: '0.9rem' }}>{averageDurationPerVisitMin} mins/retailer</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
