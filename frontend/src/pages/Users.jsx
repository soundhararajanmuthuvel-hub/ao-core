import { useEffect, useState } from 'react';
import { usersApi } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';

const empty = { name: '', email: '', password: '', role: 'staff', isActive: true };

export default function Users() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);

  const load = () => {
    setLoading(true);
    usersApi.list({ page, limit: 10 }).then(({ data }) => {
      setUsers(data.users);
      setPages(data.pages);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [page]);

  const save = async () => {
    try {
      if (modal === 'edit') await usersApi.update(form._id, form);
      else await usersApi.create(form);
      toast('User saved', 'success');
      setModal(null);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete user?')) return;
    await usersApi.remove(id);
    toast('Deleted', 'success');
    load();
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Users</h1>
        <button type="button" className="btn btn-primary" onClick={() => { setForm(empty); setModal('create'); }}>+ Add User</button>
      </div>
      {loading ? <LoadingSpinner /> : (
        <div className="card table-wrap">
          <table className="data-table users-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Actions</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className="badge badge-success">{u.role}</span></td>
                  <td>{u.isActive ? 'Yes' : 'No'}</td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setForm({ ...u, password: '' }); setModal('edit'); }}>Edit</button>{' '}
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(u._id)}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pages={pages} onPageChange={setPage} />
        </div>
      )}
      {modal && (
        <Modal title={modal === 'edit' ? 'Edit User' : 'Add User'} onClose={() => setModal(null)} footer={<><button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={save}>Save</button></>}>
          <div className="form-group"><label>Name</label><input className="form-control" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="form-group"><label>Email</label><input className="form-control" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="form-group"><label>Password {modal === 'edit' && '(leave blank to keep)'}</label><input type="password" className="form-control" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div className="form-group"><label>Role</label><select className="form-control" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="admin">Admin</option><option value="staff">Staff</option></select></div>
          <div className="form-group"><label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label></div>
        </Modal>
      )}
    </div>
  );
}
