import { useEffect, useState, useCallback } from 'react';
import { customersApi, salesApi } from '../api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function D2CCustomers() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await customersApi.list({ type: 'D2C Customer', limit: 100 });
      setCustomers(data.customers);

      const { data: salesData } = await salesApi.list({ limit: 1000 });
      const d2cCustIds = new Set(data.customers.map(c => c.id || c._id));
      const d2cSales = salesData.sales.filter(s => d2cCustIds.has(s.customerId));
      setSales(d2cSales);
    } catch {
      toast('Failed to load D2C customer listings', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Compute metrics
  const totalD2C = customers.length;
  const activeD2C = customers.filter(c => c.status === 'Active').length;
  
  // Returning are those with > 1 sales
  const customerOrdersCount = {};
  sales.forEach(s => {
    customerOrdersCount[s.customerId] = (customerOrdersCount[s.customerId] || 0) + 1;
  });
  const returningD2C = Object.values(customerOrdersCount).filter(count => count > 1).length;

  const totalSalesVal = sales.reduce((sum, s) => sum + Number(s.grandTotal || 0), 0);
  const avgOrderVal = sales.length > 0 ? totalSalesVal / sales.length : 0;

  return (
    <div className="page" style={{ '--brand-primary': '#e91e63' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Direct-To-Consumer (D2C) Directory</h1>
          <p className="page-subtitle">Analyze returning shopper frequency and view D2C order metrics.</p>
        </div>
      </div>

      {/* D2C Metrics Grid */}
      <div className="rm-dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="rm-stat-card">
          <div className="rm-stat-icon" style={{ color: '#e91e63', background: '#fce4ec' }}>👥</div>
          <div className="rm-stat-info">
            <h3>Total D2C Shoppers</h3>
            <p>{totalD2C}</p>
          </div>
        </div>
        <div className="rm-stat-card">
          <div className="rm-stat-icon" style={{ color: '#4caf50', background: '#e8f5e9' }}>⚡</div>
          <div className="rm-stat-info">
            <h3>Active Shoppers</h3>
            <p>{activeD2C}</p>
          </div>
        </div>
        <div className="rm-stat-card">
          <div className="rm-stat-icon" style={{ color: '#2196f3', background: '#e3f2fd' }}>🔄</div>
          <div className="rm-stat-info">
            <h3>Returning Buyers</h3>
            <p>{returningD2C}</p>
          </div>
        </div>
        <div className="rm-stat-card">
          <div className="rm-stat-icon" style={{ color: '#9c27b0', background: '#f3e5f5' }}>🛒</div>
          <div className="rm-stat-info">
            <h3>Average Order Value</h3>
            <p>Rs. {avgOrderVal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="rm-layout with-sidebar">
          <div className="card table-wrap" style={{ flex: 2 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Shopper Name</th>
                  <th>Contact Info</th>
                  <th>Pincode</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id || c._id}>
                    <td><strong>{c.name}</strong></td>
                    <td>
                      <div>{c.phone}</div>
                      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{c.email}</div>
                    </td>
                    <td>{c.pincode || '-'}</td>
                    <td>
                      <span className={`rm-badge ${c.status === 'Active' ? 'rm-badge-active' : 'rm-badge-inactive'}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: '#9ca3af' }}>No D2C Customers configured. Go to main Customer directory to classify a customer as D2C Customer.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', flex: 1 }}>
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem' }}>📈 Repeat Purchasing Analytics</h3>
              <p style={{ fontSize: '0.875rem', color: '#4b5563', lineHeight: '1.5', margin: 0 }}>
                Direct-To-Consumer shoppers represent a key recurring revenue channel. Use the main Customer Analytics tab to perform detailed cohort analyses, segment inactive buyers, and generate tailored follow-up template messages.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
