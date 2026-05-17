import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { analyticsApi } from '../api';
import LoadingSpinner from '../components/LoadingSpinner';

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsApi.dashboard().then(({ data: d }) => setData(d)).finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">Analytics</h1></div>
      <div className="chart-grid">
        <div className="card">
          <h3>Revenue vs Profit</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.charts.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(v) => fmt(v)} />
              <Bar dataKey="revenue" fill="var(--brand-primary)" />
              <Bar dataKey="profit" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>Sales Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.charts.salesTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(v) => fmt(v)} />
              <Line dataKey="total" stroke="var(--brand-primary)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
