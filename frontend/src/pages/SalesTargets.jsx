import { useState, useEffect } from 'react';
import { salesTargetsApi, productsApi, usersApi } from '../api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';
import { motion, AnimatePresence } from 'framer-motion';

export default function SalesTargets() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState(null);
  const [products, setProducts] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [showCelebration, setShowCelebration] = useState(false);
  
  // Configuration Target Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [targetType, setTargetType] = useState('Company');
  const [targetPeriod, setTargetPeriod] = useState('Monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [valueType, setValueType] = useState('Revenue');
  const [targetValue, setTargetValue] = useState('');
  const [productId, setProductId] = useState('');
  const [salesmanId, setSalesmanId] = useState('');
  const [creating, setCreating] = useState(false);

  // Settings states (stored locally)
  const [workingDays, setWorkingDays] = useState(26);
  const [redistribute, setRedistribute] = useState(true);
  const [enableLeaderboard, setEnableLeaderboard] = useState(true);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [dashRes, prodRes, userRes] = await Promise.all([
        salesTargetsApi.dashboard(),
        productsApi.list({ limit: 100 }),
        usersApi.list({ role: 'Salesman' })
      ]);
      
      setMetrics(dashRes.data);
      setProducts(prodRes.data.products || []);
      setSalesmen(userRes.data.users || []);

      // Trigger celebration if target reached
      if (dashRes.data.metrics?.monthlyAchievementPercent >= 100) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 8000);
      }
    } catch (err) {
      toast('Failed to load performance metrics', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleCreateTarget = async (e) => {
    e.preventDefault();
    if (!targetValue) return;
    setCreating(true);
    try {
      await salesTargetsApi.create({
        targetType,
        targetPeriod,
        year,
        month: targetPeriod === 'Yearly' ? null : month,
        valueType,
        targetValue,
        productId: targetType === 'Product' ? productId : null,
        salesmanId: targetType === 'Salesman' ? salesmanId : null,
      });
      toast('Sales target configured', 'success');
      setModalOpen(false);
      setTargetValue('');
      fetchDashboardData();
    } catch {
      toast('Failed to save sales target', 'error');
    } finally {
      setCreating(false);
    }
  };

  const getStatusColor = (percent) => {
    if (percent >= 100) return '#10b981'; // Green
    if (percent >= 75) return '#f59e0b'; // Amber
    return '#ef4444'; // Red
  };

  if (loading || !metrics) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><LoadingSpinner /></div>;
  }

  const { metrics: stat, productPerformance, salesmanLeaderboard, aiSuggestions } = metrics;

  return (
    <div className="page" style={{ padding: '1.25rem', fontFamily: 'Inter, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Celebration overlay */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99999,
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              textAlign: 'center'
            }}
          >
            {/* Confetti Elements */}
            {Array.from({ length: 40 }).map((_, i) => (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  top: '-10px',
                  left: `${Math.random() * 100}%`,
                  width: '10px',
                  height: '10px',
                  backgroundColor: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#a855f7'][i % 5],
                  borderRadius: i % 2 === 0 ? '50%' : '0%',
                  animation: `floatParticles ${3 + Math.random() * 4}s infinite linear`,
                  animationDelay: `${Math.random() * 2}s`
                }}
              />
            ))}
            
            <motion.div
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', damping: 15 }}
            >
              <span style={{ fontSize: '5rem' }}>🎉</span>
              <h1 style={{ fontSize: '2.5rem', fontWeight: 900, margin: '1rem 0' }}>Target Achieved!</h1>
              <h3 style={{ color: '#fbbf24', fontSize: '1.5rem', fontWeight: 700 }}>🏆 Outstanding Performance</h3>
              <p style={{ fontSize: '1.1rem', marginTop: '1rem', color: '#94a3b8' }}>
                You have exceeded the monthly company target by {stat.monthlyAchievementPercent - 100}%!
              </p>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setShowCelebration(false)} 
                style={{ marginTop: '2rem', padding: '0.65rem 2rem', fontWeight: 700, borderRadius: '30px' }}
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>🎯 Sales Target & Performance Manager</h1>
          <p className="page-subtitle" style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Automatically redistribute targets, monitor SFA leaderboards, and check AI suggestions.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            onClick={() => {
              let csv = "Salesman,Target,Actual,Achievement %,Collections,Visits\n";
              salesmanLeaderboard.forEach(s => {
                csv += `"${s.name}",${s.target},${s.actual},${s.achievementPercent}%,${s.collections},${s.visits}\n`;
              });
              const blob = new Blob([csv], { type: 'text/csv' });
              const link = document.createElement('a');
              link.href = URL.createObjectURL(blob);
              link.download = 'Salesman_Target_Report.csv';
              link.click();
            }}
            style={{ fontWeight: 700, fontSize: '0.8rem' }}
          >
            📤 Export CSV
          </button>
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={() => setModalOpen(true)}
            style={{ fontWeight: 700, fontSize: '0.8rem' }}
          >
            + Set Sales Target
          </button>
        </div>
      </div>

      {/* Target Status Ribbon */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.25rem',
        borderRadius: '12px',
        backgroundColor: '#fff',
        borderLeft: `5px solid ${getStatusColor(stat.monthlyAchievementPercent)}`,
        boxShadow: 'var(--shadow)',
        marginBottom: '1.25rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.25rem' }}>📢</span>
          <span style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>
            {stat.monthlyAchievementPercent >= 100 
              ? '✅ Excellent Recovery - Monthly target achieved. Great job!' 
              : `Current Monthly Achievement: ${stat.monthlyAchievementPercent}% (Status: ${stat.monthlyAchievementPercent >= 75 ? '🟡 Amber' : '🔴 Red'})`}
          </span>
        </div>
        <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569' }}>
          Badge: {stat.rewardBadge}
        </span>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        
        {/* Card 1: Today Target */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Today's Target</span>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.6rem', color: '#1e293b' }}>
            ₹{stat.todayTarget?.toLocaleString()}
          </h2>
          <div style={{ fontSize: '0.7rem', color: '#22c55e', fontWeight: 650 }}>
            Actual Sales: ₹{stat.todaySales?.toLocaleString()}
          </div>
        </div>

        {/* Card 2: Today Remaining (Redistributed) */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Today's Remaining Target</span>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.6rem', color: '#1e293b' }}>
            ₹{stat.todayRemaining?.toLocaleString()}
          </h2>
          <div style={{ fontSize: '0.7rem', color: '#ea580c', fontWeight: 650 }}>
            Recalculated from missed days
          </div>
        </div>

        {/* Card 3: Monthly Target */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Monthly Target</span>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.6rem', color: '#1e293b' }}>
            ₹{stat.monthlyTarget?.toLocaleString()}
          </h2>
          <div style={{ fontSize: '0.7rem', color: '#2563eb', fontWeight: 650 }}>
            Achieved: ₹{stat.monthlyActual?.toLocaleString()} ({stat.monthlyAchievementPercent}%)
          </div>
        </div>

        {/* Card 4: Forecast Risk */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Target Risk Level</span>
          <h2 style={{ margin: 0, fontWeight: 900, fontSize: '1.3rem', color: stat.upcomingTargetRisk?.includes('High') ? '#ef4444' : '#10b981' }}>
            {stat.upcomingTargetRisk}
          </h2>
          <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 650 }}>
            Days Remaining: {stat.remainingWorkingDays} Working Days
          </div>
        </div>

      </div>

      {/* Main performance grids */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        
        {/* Salesmen Leaderboard */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>🏆 Salesman Performance Leaderboard</h3>
          <div className="table-wrap" style={{ flex: 1 }}>
            <table className="data-table" style={{ fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>Rank</th>
                  <th>Name</th>
                  <th>Target</th>
                  <th>Actual</th>
                  <th>Visits</th>
                  <th>Ach. %</th>
                </tr>
              </thead>
              <tbody>
                {salesmanLeaderboard.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 800, color: s.rank === 1 ? '#fbbf24' : '#64748b' }}>#{s.rank}</td>
                    <td><strong>{s.name}</strong></td>
                    <td>₹{s.target?.toLocaleString()}</td>
                    <td>₹{s.actual?.toLocaleString()}</td>
                    <td>{s.visits} / month</td>
                    <td style={{ color: getStatusColor(s.achievementPercent), fontWeight: 700 }}>
                      {s.achievementPercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Product Targets Performance */}
        <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>📦 Product performance</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto' }}>
            {productPerformance.map(p => (
              <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 700 }}>
                  <span>{p.name}</span>
                  <span style={{ color: getStatusColor(p.achievementPercent) }}>{p.actual} / {p.target} ({p.achievementPercent}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min(100, p.achievementPercent)}%`, height: '100%', backgroundColor: getStatusColor(p.achievementPercent), borderRadius: '4px' }} />
                </div>
              </div>
            ))}
            {productPerformance.length === 0 && (
              <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>No specific product targets configured.</div>
            )}
          </div>
        </div>

      </div>

      {/* AI Recommendation panel */}
      <div className="card" style={{ padding: '1.25rem', backgroundColor: '#fdfbf7', border: '1px solid #fef3c7', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.75rem 0', fontWeight: 800, fontSize: '1rem', color: '#b45309', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          🤖 Target AI Insights & Predictions
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.8rem', color: '#78350f', fontWeight: 600 }}>
          {aiSuggestions.map((s, idx) => (
            <li key={idx}>{s}</li>
          ))}
          {aiSuggestions.length === 0 && (
            <li>System targets are balanced. Complete sales to generate insights.</li>
          )}
        </ul>
      </div>

      {/* Settings Grid */}
      <div className="card" style={{ padding: '1.25rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', fontWeight: 800, fontSize: '1rem', color: '#1e293b' }}>⚙️ Target Parameter Settings</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.35rem' }}>Working Days per Month</label>
            <input 
              type="number" 
              className="form-control" 
              value={workingDays} 
              onChange={(e) => setWorkingDays(e.target.value)}
              style={{ fontSize: '0.8rem', padding: '0.4rem' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
            <input 
              type="checkbox" 
              checked={redistribute} 
              onChange={(e) => setRedistribute(e.target.checked)} 
              id="sett-redist"
              style={{ transform: 'scale(1.25)' }}
            />
            <label htmlFor="sett-redist" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', cursor: 'pointer', margin: 0 }}>
              Auto-redistribute missed daily targets
            </label>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem' }}>
            <input 
              type="checkbox" 
              checked={enableLeaderboard} 
              onChange={(e) => setEnableLeaderboard(e.target.checked)} 
              id="sett-leader"
              style={{ transform: 'scale(1.25)' }}
            />
            <label htmlFor="sett-leader" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', cursor: 'pointer', margin: 0 }}>
              Enable Salesman Leaderboards
            </label>
          </div>
        </div>
      </div>

      {/* Target Configuration Modal */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000 }} onClick={() => setModalOpen(false)} />
            <div style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '450px',
              maxWidth: '95%',
              backgroundColor: '#fff',
              borderRadius: '16px',
              boxShadow: '0 20px 45px rgba(0,0,0,0.2)',
              zIndex: 3001,
              padding: '1.5rem',
              fontFamily: 'Inter, sans-serif'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, fontWeight: 800, color: '#0f172a' }}>🎯 Configure Sales Target</h3>
                <button type="button" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }} onClick={() => setModalOpen(false)}>✕</button>
              </div>

              <form onSubmit={handleCreateTarget} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>Target Type</label>
                  <select className="form-control" value={targetType} onChange={(e) => setTargetType(e.target.value)} style={{ fontSize: '0.8rem', padding: '0.45rem' }}>
                    <option value="Company">Company</option>
                    <option value="Product">Product</option>
                    <option value="Salesman">Salesman</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>Target Period</label>
                  <select className="form-control" value={targetPeriod} onChange={(e) => setTargetPeriod(e.target.value)} style={{ fontSize: '0.8rem', padding: '0.45rem' }}>
                    <option value="Monthly">Monthly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>

                {targetType === 'Product' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>Product</label>
                    <select className="form-control" value={productId} onChange={(e) => setProductId(e.target.value)} style={{ fontSize: '0.8rem', padding: '0.45rem' }} required>
                      <option value="">Select Product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                  </div>
                )}

                {targetType === 'Salesman' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>Salesman</label>
                    <select className="form-control" value={salesmanId} onChange={(e) => setSalesmanId(e.target.value)} style={{ fontSize: '0.8rem', padding: '0.45rem' }} required>
                      <option value="">Select Salesman...</option>
                      {salesmen.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>Value Type</label>
                    <select className="form-control" value={valueType} onChange={(e) => setValueType(e.target.value)} style={{ fontSize: '0.8rem', padding: '0.45rem' }}>
                      <option value="Revenue">Revenue (₹)</option>
                      <option value="Quantity">Quantity (Pcs)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#475569', marginBottom: '0.25rem' }}>Target Value</label>
                    <input 
                      type="number" 
                      className="form-control" 
                      value={targetValue} 
                      onChange={(e) => setTargetValue(e.target.value)} 
                      style={{ fontSize: '0.8rem', padding: '0.45rem' }} 
                      placeholder="e.g. 50000"
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '1rem' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)} style={{ flex: 1, padding: '0.5rem', fontWeight: 700 }}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', fontWeight: 700 }} disabled={creating}>
                    {creating ? 'Saving...' : 'Save Target'}
                  </button>
                </div>
              </form>
            </div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
