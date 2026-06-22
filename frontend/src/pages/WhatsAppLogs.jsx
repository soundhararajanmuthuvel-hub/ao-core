import { useState, useEffect } from 'react';
import { whatsappApi } from '../api';
import { useToast } from '../context/ToastContext';
import { Search, Filter, Phone, Calendar, FileText, CheckCircle, MessageSquare, AlertCircle, RefreshCw, X, Eye } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import Pagination from '../components/Pagination';
import Modal from '../components/Modal';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function WhatsAppLogs() {
  const { toast } = useToast();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({
    sentToday: 0,
    delivered: 0,
    read: 0,
    failed: 0,
    pending: 0
  });
  const [activityChart, setActivityChart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Pagination, search & filters state
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Selected Log Drawer Modal state
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const { data } = await whatsappApi.getStats();
      if (data.success) {
        setStats(data.stats || { sentToday: 0, delivered: 0, read: 0, failed: 0, pending: 0 });
        setActivityChart(data.activityChart || []);
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp statistics:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 10,
        search,
        status: statusFilter,
        type: typeFilter
      };
      const { data } = await whatsappApi.getLogs(params);
      if (data.success) {
        setLogs(data.logs || []);
        setPages(data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch WhatsApp logs:', err);
      toast('Failed to load communication logs', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, statusFilter, typeFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleRefresh = () => {
    fetchStats();
    fetchLogs();
    toast('Data refreshed successfully', 'success');
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Read':
        return 'badge-success';
      case 'Delivered':
        return 'badge-info';
      case 'Sent':
        return 'badge-primary';
      case 'Failed':
        return 'badge-danger';
      case 'Pending':
      default:
        return 'badge-secondary';
    }
  };

  const getStatusBadgeStyle = (status) => {
    const base = {
      padding: '0.25rem 0.5rem',
      borderRadius: '6px',
      fontSize: '0.75rem',
      fontWeight: 700,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.25rem'
    };
    switch (status) {
      case 'Read':
        return { ...base, backgroundColor: '#dcfce7', color: '#16a34a' };
      case 'Delivered':
        return { ...base, backgroundColor: '#e0f2fe', color: '#0369a1' };
      case 'Sent':
        return { ...base, backgroundColor: '#e0e7ff', color: '#4338ca' };
      case 'Failed':
        return { ...base, backgroundColor: '#fee2e2', color: '#dc2626' };
      case 'Pending':
      default:
        return { ...base, backgroundColor: '#f1f5f9', color: '#475569' };
    }
  };

  return (
    <div style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box' }}>
      
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            💬 Communication Center
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Monitor WhatsApp automated dispatches, status logs, payment reminder activities, and delivery diagnostics.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}
        >
          <RefreshCw size={16} /> Refresh Center
        </button>
      </div>

      {/* Statistics Cards & Chart Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '1.5rem', marginBottom: '1.5rem', alignItems: 'stretch' }}>
        
        {/* Left Column: Counters Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
            📈 Today's Log Status Counters
          </h3>
          {statsLoading ? (
            <div className="card" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <LoadingSpinner />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', flex: 1 }}>
              
              <div className="card" style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '12px', borderLeft: '4px solid #4338ca', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Sent Today</span>
                <strong style={{ fontSize: '2rem', color: '#1e293b', marginTop: '0.25rem' }}>{stats.sentToday}</strong>
              </div>

              <div className="card" style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '12px', borderLeft: '4px solid #16a34a', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Read Status</span>
                <strong style={{ fontSize: '2rem', color: '#1e293b', marginTop: '0.25rem' }}>{stats.read}</strong>
              </div>

              <div className="card" style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '12px', borderLeft: '4px solid #0369a1', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Delivered</span>
                <strong style={{ fontSize: '2rem', color: '#1e293b', marginTop: '0.25rem' }}>{stats.delivered}</strong>
              </div>

              <div className="card" style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '12px', borderLeft: '4px solid #dc2626', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Failed Messages</span>
                <strong style={{ fontSize: '2rem', color: '#dc2626', marginTop: '0.25rem' }}>{stats.failed}</strong>
              </div>

              <div className="card" style={{ padding: '1rem', backgroundColor: '#fff', borderRadius: '12px', borderLeft: '4px solid #475569', gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Pending Queue Messages:</span>
                <strong style={{ fontSize: '1.5rem', color: '#475569' }}>{stats.pending}</strong>
              </div>

            </div>
          )}
        </div>

        {/* Right Column: 7 Day Activity Chart */}
        <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 800, color: '#1e293b' }}>
            📅 7-Day Activity Insights
          </h3>
          <div style={{ flex: 1, minHeight: '180px' }}>
            {statsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <LoadingSpinner />
              </div>
            ) : activityChart.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '0.875rem' }}>
                No recent activity logged.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'rgba(241, 245, 249, 0.5)' }} />
                  <Bar dataKey="count" fill="var(--brand-primary, #ff9800)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

      {/* Logs Monitor Section */}
      <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
        <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.1rem', fontWeight: 800, color: '#0f172a' }}>
          📋 Live Dispatch Logs
        </h3>

        {/* Filter and Search Bar */}
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center', backgroundColor: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px' }}>
          
          {/* Search Box */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: '200px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.25rem 0.75rem' }}>
            <Search size={16} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search by Mobile, Name, Message text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', width: '100%', fontSize: '0.875rem', padding: '0.25rem 0' }}
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setPage(1); }} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={16} color="#94a3b8" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Status:</span>
            <select
              className="form-control form-control-sm"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', width: '130px' }}
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="Sent">Sent</option>
              <option value="Delivered">Delivered</option>
              <option value="Read">Read</option>
              <option value="Failed">Failed</option>
              <option value="Pending">Pending</option>
            </select>
          </div>

          {/* Type Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#475569' }}>Type:</span>
            <select
              className="form-control form-control-sm"
              style={{ padding: '0.25rem 0.5rem', fontSize: '0.85rem', border: '1px solid #cbd5e1', borderRadius: '6px', width: '180px' }}
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Message Types</option>
              <option value="Invoice">Invoice</option>
              <option value="Payment Reminder">Payment Reminder</option>
              <option value="Shipment">Shipment</option>
              <option value="Greeting">Greeting</option>
              <option value="Promotion">Promotion</option>
              <option value="Outstanding Recovery">Outstanding Recovery</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary btn-sm" style={{ fontWeight: 700 }}>
            Search
          </button>
        </form>

        {/* Logs Table */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <LoadingSpinner />
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>
            <p style={{ margin: 0, fontSize: '0.95rem' }}>No communication logs found matching your filters.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Timestamp</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Customer / Recipient</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Mobile</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Message Type</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Message Content Preview</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                  <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }} onClick={() => setSelectedLog(log)}>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#475569', fontSize: '0.8rem' }}>
                      {new Date(log.date).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontWeight: 600, color: '#1e293b' }}>
                      {log.customerName || 'Walk-in Customer'}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'monospace' }}>
                      {log.mobile}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                        {log.messageType}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', color: '#64748b', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.messageText}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span style={getStatusBadgeStyle(log.status)}>
                        {log.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--brand-primary, #ff9800)' }}
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ marginTop: '1.25rem' }}>
              <Pagination page={page} pages={pages} onPageChange={setPage} />
            </div>
          </div>
        )}
      </div>

      {/* Selected Log Drawer Modal */}
      {selectedLog && (
        <Modal
          title="💬 Communication Log Details"
          onClose={() => setSelectedLog(null)}
          footer={
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
              Close Details
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', fontSize: '0.9rem' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Date / Time</span>
                <strong style={{ color: '#1e293b' }}>
                  {new Date(selectedLog.date).toLocaleString('en-IN')}
                </strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Status</span>
                <span style={getStatusBadgeStyle(selectedLog.status)}>
                  {selectedLog.status}
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Customer Name</span>
                <strong style={{ color: '#1e293b' }}>{selectedLog.customerName || 'Walk-in Customer'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Mobile Number</span>
                <strong style={{ color: '#1e293b', fontFamily: 'monospace' }}>{selectedLog.mobile}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block' }}>Message Category</span>
                <span style={{ display: 'inline-block', marginTop: '0.25rem', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                  {selectedLog.messageType}
                </span>
              </div>
            </div>

            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.5rem' }}>Message Text</span>
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', whiteSpace: 'pre-wrap', lineHeight: '1.5', fontFamily: 'Inter, sans-serif', color: '#334155' }}>
                {selectedLog.messageText}
              </div>
            </div>

            {selectedLog.status === 'Failed' && selectedLog.error && (
              <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fee2e2', borderRadius: '8px', padding: '1rem', color: '#b91c1c' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', display: 'block', fontWeight: 700, marginBottom: '0.25rem' }}>⚠️ Error Diagnostics</span>
                <span style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{selectedLog.error}</span>
              </div>
            )}

          </div>
        </Modal>
      )}

    </div>
  );
}
