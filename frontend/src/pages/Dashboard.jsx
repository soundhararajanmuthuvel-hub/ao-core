import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { analyticsApi, productsApi } from '../api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

const StatCard = ({ label, value, className = '' }) => (
  <div className="stat-card">
    <div className="label">{label}</div>
    <div className={`value ${className}`}>{value}</div>
  </div>
);

export default function Dashboard() {
  const { isAdmin } = useAuth();
  const [data, setData] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (isAdmin) {
          const { data: d } = await analyticsApi.dashboard();
          setData(d);
        }
        const { data: ls } = await productsApi.lowStock();
        setLowStock(ls.products?.slice(0, 5) || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAdmin]);

  if (loading) return <LoadingSpinner />;

  const cards = data?.cards || {};

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome to AO Core ERP</p>
        </div>
        <Link to="/sales/new" className="btn btn-primary">+ New Invoice</Link>
      </div>

      {isAdmin && (
        <div className="stat-grid">
          <StatCard label="Total Products" value={cards.totalProducts || 0} />
          <StatCard label="Total Sales" value={cards.totalSales || 0} />
          <StatCard label="Revenue" value={fmt(cards.revenue)} className="success" />
          <StatCard label="Profit" value={fmt(cards.profit)} className="success" />
          <StatCard label="Today's Sales" value={fmt(cards.todaySales)} />
          <StatCard label="Today's Orders" value={cards.todayOrders || 0} />
          <StatCard label="Low Stock" value={cards.lowStockCount || 0} className="danger" />
        </div>
      )}

      {isAdmin && data?.charts && (
        <div className="chart-grid">
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Monthly Revenue</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.charts.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v) => fmt(v)} />
                <Legend />
                <Bar dataKey="revenue" fill="var(--brand-primary)" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Profit Trend</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.charts.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(v) => fmt(v)} />
                <Line type="monotone" dataKey="profit" stroke="#22c55e" name="Profit" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Top Products</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.charts.topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip />
                <Bar dataKey="qty" fill="var(--brand-primary)" name="Qty Sold" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: '1rem' }}>Sales Trend (30 days)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.charts.salesTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(v) => fmt(v)} />
                <Line type="monotone" dataKey="total" stroke="var(--brand-primary)" name="Sales" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {lowStock.length > 0 && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Low Stock Alerts</h3>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Product</th><th>SKU</th><th>Stock</th><th>Threshold</th></tr>
              </thead>
              <tbody>
                {lowStock.map((p) => (
                  <tr key={p._id}>
                    <td>{p.name}</td>
                    <td>{p.sku}</td>
                    <td><span className="badge badge-danger">{p.stock}</span></td>
                    <td>{p.lowStockThreshold}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
