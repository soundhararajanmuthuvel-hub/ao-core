import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { salesApi } from '../api';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';

const fmt = (n) => `₹${(n || 0).toLocaleString('en-IN')}`;

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    salesApi.list({ page, search, limit: 10 }).then(({ data }) => {
      setSales(data.sales);
      setPages(data.pages);
    }).finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Sales & Invoices</h1></div>
        <Link to="/sales/new" className="btn btn-primary">+ New Invoice</Link>
      </div>
      <input className="form-control" style={{ maxWidth: 280, marginBottom: '1rem' }} placeholder="Search invoice..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      {loading ? <LoadingSpinner /> : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s._id}>
                  <td>{s.invoiceNumber}</td>
                  <td>{s.customer?.name}</td>
                  <td>{new Date(s.date).toLocaleDateString()}</td>
                  <td>{fmt(s.grandTotal)}</td>
                  <td><span className={`badge badge-${s.paymentStatus === 'paid' ? 'success' : 'warning'}`}>{s.paymentStatus}</span></td>
                  <td>
                    <Link to={`/sales/${s._id}`} className="btn btn-secondary btn-sm">View</Link>{' '}
                    <Link to={`/sales/${s._id}/print`} className="btn btn-secondary btn-sm">Print</Link>{' '}
                    <Link to={`/sales/${s._id}`} className="btn btn-whatsapp btn-sm" title="WhatsApp / JPG">WA</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pages={pages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
