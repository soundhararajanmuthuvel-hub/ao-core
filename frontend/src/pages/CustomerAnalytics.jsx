import { useEffect, useState, useCallback } from 'react';
import { customersApi, salesApi } from '../api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function CustomerAnalytics() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [activeSegment, setActiveSegment] = useState('repeat'); // 'repeat', 'inactive30', 'inactive60', 'inactive90', 'topBuyers'
  const [selectedFollowUp, setSelectedFollowUp] = useState(null); // Selected customer for follow-up builder
  const [waTemplate, setWaTemplate] = useState('inactive'); // 'inactive', 'appreciate', 'custom'
  const [customMsg, setCustomMsg] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([
        customersApi.list({ limit: 1000 }),
        salesApi.list({ limit: 1000 }),
      ]);
      setCustomers(cRes.data.customers || []);
      setSales(sRes.data.sales || []);
    } catch {
      toast('Failed to load analytics records', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute purchase stats per customer
  const computeStats = () => {
    const customerMap = {};

    customers.forEach(c => {
      customerMap[c.id || c._id] = {
        id: c.id || c._id,
        name: c.name,
        phone: c.phone || '',
        email: c.email || '',
        customerType: c.customerType || 'Retail Shop',
        status: c.status || 'Active',
        totalSpent: 0,
        purchaseCount: 0,
        lastPurchaseDate: null,
        daysSinceLastPurchase: null
      };
    });

    sales.forEach(s => {
      const cId = s.customerId || s.customer?.id || s.customer?._id;
      if (cId && customerMap[cId]) {
        customerMap[cId].totalSpent += Number(s.grandTotal || 0);
        customerMap[cId].purchaseCount += 1;
        const invoiceDate = new Date(s.date || s.createdAt);
        if (!customerMap[cId].lastPurchaseDate || invoiceDate > new Date(customerMap[cId].lastPurchaseDate)) {
          customerMap[cId].lastPurchaseDate = invoiceDate;
        }
      }
    });

    const now = new Date();
    const customerList = Object.values(customerMap).map(c => {
      if (c.lastPurchaseDate) {
        const diffTime = Math.abs(now - c.lastPurchaseDate);
        c.daysSinceLastPurchase = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      } else {
        c.daysSinceLastPurchase = 999; // Never purchased
      }
      return c;
    });

    // Segmentations
    const repeatCustomers = customerList.filter(c => c.purchaseCount > 1).sort((a, b) => b.purchaseCount - a.purchaseCount);
    const topBuyers = [...customerList].filter(c => c.purchaseCount > 0).sort((a, b) => b.totalSpent - a.totalSpent);

    const inactive30 = customerList.filter(c => c.purchaseCount > 0 && c.daysSinceLastPurchase > 30 && c.daysSinceLastPurchase <= 60).sort((a, b) => b.daysSinceLastPurchase - a.daysSinceLastPurchase);
    const inactive60 = customerList.filter(c => c.purchaseCount > 0 && c.daysSinceLastPurchase > 60 && c.daysSinceLastPurchase <= 90).sort((a, b) => b.daysSinceLastPurchase - a.daysSinceLastPurchase);
    const inactive90 = customerList.filter(c => c.purchaseCount > 0 && c.daysSinceLastPurchase > 90).sort((a, b) => b.daysSinceLastPurchase - a.daysSinceLastPurchase);

    return {
      customerList,
      repeatCustomers,
      topBuyers,
      inactive30,
      inactive60,
      inactive90
    };
  };

  const stats = computeStats();

  const getSegmentList = () => {
    switch (activeSegment) {
      case 'repeat': return stats.repeatCustomers;
      case 'inactive30': return stats.inactive30;
      case 'inactive60': return stats.inactive60;
      case 'inactive90': return stats.inactive90;
      case 'topBuyers': return stats.topBuyers;
      default: return [];
    }
  };

  const getSegmentTitle = () => {
    switch (activeSegment) {
      case 'repeat': return 'Repeat Customers (>1 Purchase)';
      case 'inactive30': return 'Inactive Shoppers (30 to 60 Days)';
      case 'inactive60': return 'Inactive Shoppers (60 to 90 Days)';
      case 'inactive90': return 'Dormant Shoppers (90+ Days)';
      case 'topBuyers': return 'Top Buyers by Revenue';
      default: return 'Customer segment';
    }
  };

  const exportCSV = () => {
    const list = getSegmentList();
    const title = getSegmentTitle().replace(/[^a-zA-Z0-9]/g, '_');
    const headers = 'Name,Customer Type,Phone,Email,Total Spent (₹),Purchases Count,Days Since Last Purchase\n';
    const rows = list.map(c => 
      `"${c.name}","${c.customerType}","${c.phone}","${c.email}",${c.totalSpent.toFixed(2)},${c.purchaseCount},${c.daysSinceLastPurchase === 999 ? 'Never' : c.daysSinceLastPurchase}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AO_${title}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openFollowUp = (customer) => {
    setSelectedFollowUp(customer);
    setWaTemplate('inactive');
    setCustomMsg('');
  };

  const getWhatsAppMessage = () => {
    if (!selectedFollowUp) return '';
    const name = selectedFollowUp.name;
    if (waTemplate === 'inactive') {
      return `Dear ${name}, we miss you at Amudhasurabiy Organics! Enjoy a special 10% discount on your next organic health foods order. Use code WEBACK10. Order now at: http://amudhasurabiy.in`;
    }
    if (waTemplate === 'appreciate') {
      return `Dear ${name}, thank you for being a valued buyer of Amudhasurabiy Organics products! We appreciate your loyalty and support.`;
    }
    return customMsg || `Hello ${name}, this is Amudhasurabiy Organics.`;
  };

  const sendWhatsApp = () => {
    if (!selectedFollowUp) return;
    const phone = selectedFollowUp.phone.replace(/[^0-9]/g, '');
    const text = encodeURIComponent(getWhatsAppMessage());
    window.open(`https://wa.me/${phone.startsWith('91') || phone.length < 10 ? phone : '91' + phone}?text=${text}`, '_blank');
  };

  const fmt = (v) => '₹' + Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="page" style={{ '--brand-primary': '#ff9800' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            📊 Customer Purchase Analytics
          </h1>
          <p className="page-subtitle" style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            Identify repeat buyers, track churn risk metrics, analyze inactive periods, and launch instant client reactivation flows.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Segment Statistics Grid */}
          <div className="rm-dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div 
              className={`rm-stat-card ${activeSegment === 'repeat' ? 'active-card' : ''}`} 
              style={{ cursor: 'pointer', border: activeSegment === 'repeat' ? '2px solid #ff9800' : '1px solid #e2e8f0', background: '#fff', padding: '1.25rem', borderRadius: '12px' }}
              onClick={() => { setActiveSegment('repeat'); setSelectedFollowUp(null); }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Repeat Buyers</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ff9800', marginTop: '0.25rem' }}>{stats.repeatCustomers.length}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Shoppers with &gt;1 orders</div>
            </div>

            <div 
              className={`rm-stat-card ${activeSegment === 'inactive30' ? 'active-card' : ''}`} 
              style={{ cursor: 'pointer', border: activeSegment === 'inactive30' ? '2px solid #ff9800' : '1px solid #e2e8f0', background: '#fff', padding: '1.25rem', borderRadius: '12px' }}
              onClick={() => { setActiveSegment('inactive30'); setSelectedFollowUp(null); }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Inactive (30-60d)</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#d97706', marginTop: '0.25rem' }}>{stats.inactive30.length}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Last order 30 to 60 days ago</div>
            </div>

            <div 
              className={`rm-stat-card ${activeSegment === 'inactive60' ? 'active-card' : ''}`} 
              style={{ cursor: 'pointer', border: activeSegment === 'inactive60' ? '2px solid #ff9800' : '1px solid #e2e8f0', background: '#fff', padding: '1.25rem', borderRadius: '12px' }}
              onClick={() => { setActiveSegment('inactive60'); setSelectedFollowUp(null); }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Inactive (60-90d)</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ea580c', marginTop: '0.25rem' }}>{stats.inactive60.length}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Last order 60 to 90 days ago</div>
            </div>

            <div 
              className={`rm-stat-card ${activeSegment === 'inactive90' ? 'active-card' : ''}`} 
              style={{ cursor: 'pointer', border: activeSegment === 'inactive90' ? '2px solid #ff9800' : '1px solid #e2e8f0', background: '#fff', padding: '1.25rem', borderRadius: '12px' }}
              onClick={() => { setActiveSegment('inactive90'); setSelectedFollowUp(null); }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Dormant (90d+)</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#dc2626', marginTop: '0.25rem' }}>{stats.inactive90.length}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Last order over 90 days ago</div>
            </div>

            <div 
              className={`rm-stat-card ${activeSegment === 'topBuyers' ? 'active-card' : ''}`} 
              style={{ cursor: 'pointer', border: activeSegment === 'topBuyers' ? '2px solid #ff9800' : '1px solid #e2e8f0', background: '#fff', padding: '1.25rem', borderRadius: '12px' }}
              onClick={() => { setActiveSegment('topBuyers'); setSelectedFollowUp(null); }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' }}>Top Revenue Buyers</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: '#2563eb', marginTop: '0.25rem' }}>{stats.topBuyers.length}</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>Ranked by billing value</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: selectedFollowUp ? '1.5fr 1fr' : '1fr', gap: '1.5rem', transition: 'all 0.3s ease' }}>
            {/* Left Content Table */}
            <div className="card table-wrap" style={{ padding: '1.5rem', background: '#fff', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>{getSegmentTitle()}</h3>
                <button type="button" className="btn btn-secondary btn-sm" onClick={exportCSV} disabled={getSegmentList().length === 0} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  📥 Export Segment CSV
                </button>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Type</th>
                    <th>Total Billing</th>
                    <th>Purchases</th>
                    <th>Last Active</th>
                    <th>Days Since Purchase</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getSegmentList().map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.phone}</div>
                      </td>
                      <td>{c.customerType}</td>
                      <td style={{ fontWeight: 600, color: '#334155' }}>{fmt(c.totalSpent)}</td>
                      <td>
                        <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155', fontWeight: 700 }}>
                          {c.purchaseCount} orders
                        </span>
                      </td>
                      <td>{c.lastPurchaseDate ? new Date(c.lastPurchaseDate).toLocaleDateString() : '—'}</td>
                      <td>
                        {c.daysSinceLastPurchase === 999 ? (
                          <span style={{ color: '#64748b' }}>Never</span>
                        ) : (
                          <strong style={{ color: c.daysSinceLastPurchase > 60 ? '#dc2626' : c.daysSinceLastPurchase > 30 ? '#d97706' : '#16a34a' }}>
                            {c.daysSinceLastPurchase} days
                          </strong>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button 
                          type="button" 
                          className="btn btn-primary btn-sm" 
                          style={{ backgroundColor: '#ff9800', borderColor: '#ff9800', fontSize: '0.75rem' }} 
                          onClick={() => openFollowUp(c)}
                        >
                          💬 Follow Up
                        </button>
                      </td>
                    </tr>
                  ))}
                  {getSegmentList().length === 0 && (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', color: '#94a3b8', padding: '2.5rem' }}>No customers found in this segment.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Right Content Panel: WhatsApp Builder */}
            {selectedFollowUp && (
              <div className="card" style={{ padding: '1.5rem', background: '#fff', borderRadius: '12px', height: 'fit-content', border: '1px solid #ff9800' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>💬 Reactivation Campaign</h3>
                  <button type="button" style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }} onClick={() => setSelectedFollowUp(null)}>&times;</button>
                </div>

                <div style={{ marginBottom: '1.25rem', fontSize: '0.85rem', color: '#475569' }}>
                  <div style={{ marginBottom: '0.25rem' }}><strong>Target Shopper:</strong> {selectedFollowUp.name}</div>
                  <div style={{ marginBottom: '0.25rem' }}><strong>Contact Phone:</strong> {selectedFollowUp.phone || 'N/A'}</div>
                  <div><strong>Days Since Purchase:</strong> {selectedFollowUp.daysSinceLastPurchase} days ago</div>
                </div>

                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.4rem' }}>Message Template</label>
                  <select 
                    className="form-control" 
                    value={waTemplate} 
                    onChange={(e) => setWaTemplate(e.target.value)}
                    style={{ fontSize: '0.85rem', height: '42px', borderRadius: '8px' }}
                  >
                    <option value="inactive">Inactive customer reactivate discount</option>
                    <option value="appreciate">Appreciation message</option>
                    <option value="custom">Create Custom Message</option>
                  </select>
                </div>

                {waTemplate === 'custom' && (
                  <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                    <label style={{ fontWeight: 700, fontSize: '0.85rem', color: '#334155', display: 'block', marginBottom: '0.4rem' }}>Custom Text</label>
                    <textarea 
                      className="form-control" 
                      rows="4" 
                      placeholder="Type custom text..."
                      value={customMsg}
                      onChange={(e) => setCustomMsg(e.target.value)}
                      style={{ fontSize: '0.85rem', borderRadius: '8px' }}
                    />
                  </div>
                )}

                <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
                  <span style={{ fontWeight: 700, color: '#64748b', display: 'block', marginBottom: '0.35rem', textTransform: 'uppercase', fontSize: '0.7rem' }}>Preview Message:</span>
                  <p style={{ margin: 0, fontStyle: 'italic', color: '#334155', lineHeight: '1.4' }}>"{getWhatsAppMessage()}"</p>
                </div>

                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={sendWhatsApp}
                  disabled={!selectedFollowUp.phone}
                  style={{ width: '100%', backgroundColor: '#25d366', borderColor: '#25d366', height: '46px', fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderRadius: '8px', color: '#fff' }}
                >
                  🚀 Send via WhatsApp Direct
                </button>
                {!selectedFollowUp.phone && (
                  <small style={{ color: '#dc2626', marginTop: '0.4rem', display: 'block', textAlign: 'center' }}>⚠️ Customer must have a phone number configured.</small>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
