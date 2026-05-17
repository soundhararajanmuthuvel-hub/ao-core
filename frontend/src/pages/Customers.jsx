import { useEffect, useState } from 'react';
import { customersApi } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';

const empty = { name: '', phone: '', email: '', address: '', gstNumber: '', balance: 0 };

export default function Customers() {
  const { toast } = useToast();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [history, setHistory] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await customersApi.list({ page, search, limit: 10 });
      setCustomers(data.customers);
      setPages(data.pages);
    } catch {
      toast('Failed to load customers', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, search]);

  const openModal = async (c = null) => {
    setForm(c || empty);
    setHistory([]);
    if (c) {
      const { data } = await customersApi.sales(c._id);
      setHistory(data.sales);
    }
    setModal(c ? 'edit' : 'create');
  };

  const save = async () => {
    try {
      if (modal === 'edit') await customersApi.update(form._id, form);
      else await customersApi.create(form);
      toast('Customer saved', 'success');
      setModal(null);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Save failed', 'error');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete customer?')) return;
    await customersApi.remove(id);
    toast('Deleted', 'success');
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Customers</h1></div>
        <button type="button" className="btn btn-primary" onClick={() => openModal()}>+ Add Customer</button>
      </div>
      <input className="form-control filters-bar" style={{ maxWidth: 280 }} placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      {loading ? <LoadingSpinner /> : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Balance</th><th>Actions</th></tr></thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c._id}>
                  <td>{c.name}</td>
                  <td>{c.phone}</td>
                  <td>{c.email}</td>
                  <td><span className={c.balance > 0 ? 'badge badge-warning' : 'badge badge-success'}>₹{c.balance}</span></td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openModal(c)}>Edit</button>{' '}
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(c._id)}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pages={pages} onPageChange={setPage} />
        </div>
      )}
      {modal && (
        <Modal title={modal === 'edit' ? 'Edit Customer' : 'Add Customer'} onClose={() => setModal(null)} footer={<><button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={save}>Save</button></>}>
          {Object.keys(empty).map((f) => (
            <div key={f} className="form-group"><label>{f}</label><input className="form-control" value={form[f] ?? ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} /></div>
          ))}
          {history.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <h4>Sales History</h4>
              {history.map((s) => <p key={s._id}>{s.invoiceNumber} — ₹{s.grandTotal} ({s.paymentStatus})</p>)}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
