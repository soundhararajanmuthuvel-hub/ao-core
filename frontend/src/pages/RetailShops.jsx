import { useEffect, useState, useCallback } from 'react';
import { customersApi } from '../api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function RetailShops() {
  const { toast } = useToast();
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await customersApi.list({ type: 'Retail Shop', limit: 100 });
      setShops(data.customers);
    } catch {
      toast('Failed to load Retail Shop records', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecordPayment = async (id, currentBalance) => {
    const amount = prompt(`Enter payment received amount for this shop (Outstanding: Rs. ${currentBalance}):`);
    if (!amount || isNaN(amount) || Number(amount) <= 0) return;

    try {
      const remaining = Number(currentBalance) - Number(amount);
      await customersApi.update(id, { balance: remaining });
      toast('Payment received & customer balance updated successfully!', 'success');
      loadData();
    } catch {
      toast('Failed to record payment', 'error');
    }
  };

  return (
    <div className="page" style={{ '--brand-primary': '#ff5722' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Retail Shops Management</h1>
          <p className="page-subtitle">Monitor shop credit limits, outstanding balances, payment terms, and clear pending dues.</p>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="rm-layout with-sidebar">
          <div className="card table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Shop Name</th>
                  <th>Outstanding Dues</th>
                  <th>Credit Limit</th>
                  <th>Payment Terms</th>
                  <th>Contact info</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shops.map((s) => {
                  const isNearLimit = Number(s.balance) > (Number(s.creditLimit) * 0.8);
                  return (
                    <tr key={s.id || s._id}>
                      <td>
                        <strong>{s.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.businessName || '-'}</div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: s.balance > 0 ? '#ef4444' : '#10b981' }}>
                          Rs. {Number(s.balance).toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span style={{ color: isNearLimit ? '#ef4444' : '#111827', fontWeight: isNearLimit ? 600 : 400 }}>
                          Rs. {Number(s.creditLimit || 0).toLocaleString()} {isNearLimit && '⚠️'}
                        </span>
                      </td>
                      <td><span className="badge badge-warning">{s.paymentTerms || 'COD'}</span></td>
                      <td>
                        <div>{s.phone}</div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{s.email}</div>
                      </td>
                      <td>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => handleRecordPayment(s.id || s._id, s.balance)}>
                          💵 Pay In
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {shops.length === 0 && (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: '#9ca3af' }}>No retail shops found. Go to main Customer directory to classify a customer as Retail Shop.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#b91c1c', marginBottom: '0.75rem' }}>🚨 Credit Limits Summary</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {shops.filter(s => s.balance > 0).map((s) => {
                  const pct = Math.min((s.balance / (s.creditLimit || 1)) * 100, 100);
                  return (
                    <div key={s.id || s._id} style={{ fontSize: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>{s.name}</span>
                        <span>{pct.toFixed(0)}% Limit</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#f3f4f6', borderRadius: '9999px', marginTop: '0.25rem', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', background: pct > 80 ? '#ef4444' : '#f59e0b', borderRadius: '9999px' }} />
                      </div>
                    </div>
                  );
                })}
                {shops.filter(s => s.balance > 0).length === 0 && (
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>No outstanding balances found across shops.</p>
                )}
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>🚚 Dispatch & Delivery Rules</h3>
              <ul style={{ fontSize: '0.875rem', color: '#4b5563', paddingLeft: '1.25rem', margin: 0, lineHeight: '1.5' }}>
                <li>Do not dispatch new orders to stores that exceed their credit limit.</li>
                <li>Credit limit updates require Manager/Admin privileges.</li>
                <li>Remind clients 2 days before paymentTerms lapse.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
