import { useEffect, useState } from 'react';
import { suppliersApi } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import LoadingSpinner from '../components/LoadingSpinner';

const empty = { name: '', phone: '', email: '', address: '', type: 'general', notes: '' };

export default function Suppliers() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => {
    setLoading(true);
    suppliersApi.list().then(({ data }) => setSuppliers(data.suppliers)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      if (modal === 'edit') await suppliersApi.update(form._id, form);
      else await suppliersApi.create(form);
      toast('Supplier saved', 'success');
      setModal(null);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Suppliers</h1>
          <p className="page-subtitle">For repack & manufacturing operations</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => { setForm(empty); setModal('create'); }}>+ Add Supplier</button>
      </div>
      {loading ? <LoadingSpinner /> : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Phone</th><th>Type</th><th>Address</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s._id}>
                  <td>{s.name}</td>
                  <td>{s.phone}</td>
                  <td><span className="badge badge-success">{s.type}</span></td>
                  <td>{s.address}</td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setForm(s); setModal('edit'); }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && (
        <Modal title={modal === 'edit' ? 'Edit Supplier' : 'Add Supplier'} onClose={() => setModal(null)} footer={<><button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={save}>Save</button></>}>
          <div className="form-group"><label>Name</label><input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="form-group"><label>Phone</label><input className="form-control" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="form-group"><label>Email</label><input className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="form-group"><label>Address</label><input className="form-control" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="form-group">
            <label>Type</label>
            <select className="form-control" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="general">General</option>
              <option value="packaging">Packaging (Repack)</option>
              <option value="raw_material">Raw Material (Manufacturing)</option>
            </select>
          </div>
          <div className="form-group"><label>Notes</label><textarea className="form-control" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </Modal>
      )}
    </div>
  );
}
