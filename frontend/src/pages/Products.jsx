import { useEffect, useState } from 'react';
import { productsApi } from '../api';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import LoadingSpinner from '../components/LoadingSpinner';

const empty = { name: '', sku: '', barcode: '', category: 'General', stock: 0, lowStockThreshold: 10, unit: 'pcs', purchasePrice: 0, sellingPrice: 0, gstPercent: 0, supplier: '' };

export default function Products() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(empty);
  const [image, setImage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await productsApi.list({ page, search, category, limit: 10 });
      setProducts(data.products);
      setPages(data.pages);
    } catch {
      toast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [page, search, category]);
  useEffect(() => { productsApi.categories().then(({ data }) => setCategories(data.categories)); }, []);

  const openModal = (p = null) => {
    setForm(p ? { ...p, purchasePrice: p.purchasePrice, sellingPrice: p.sellingPrice } : empty);
    setImage(null);
    setModal(p ? 'edit' : 'create');
  };

  const save = async () => {
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (k !== '_id' && k !== 'image' && k !== '__v') fd.append(k, v); });
    if (image) fd.append('image', image);
    try {
      if (modal === 'edit') await productsApi.update(form._id, fd);
      else await productsApi.create(fd);
      toast('Product saved', 'success');
      setModal(null);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Save failed', 'error');
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this product?')) return;
    try {
      await productsApi.remove(id);
      toast('Product deleted', 'success');
      load();
    } catch {
      toast('Delete failed', 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">Products</h1><p className="page-subtitle">Manage inventory items</p></div>
        <button type="button" className="btn btn-primary" onClick={() => openModal()}>+ Add Product</button>
      </div>
      <div className="filters-bar">
        <input className="form-control" style={{ maxWidth: 240 }} placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select className="form-control" style={{ maxWidth: 180 }} value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {loading ? <LoadingSpinner /> : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Image</th><th>Name</th><th>SKU</th><th>Category</th><th>Stock</th><th>Price</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p._id}>
                  <td>{p.image ? <img src={p.image} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} /> : '—'}</td>
                  <td>{p.name} {p.stock <= p.lowStockThreshold && <span className="badge badge-warning">Low</span>}</td>
                  <td>{p.sku}</td>
                  <td>{p.category}</td>
                  <td>{p.stock} {p.unit}</td>
                  <td>₹{p.sellingPrice}</td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openModal(p)}>Edit</button>{' '}
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => remove(p._id)}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={page} pages={pages} onPageChange={setPage} />
        </div>
      )}
      {modal && (
        <Modal title={modal === 'edit' ? 'Edit Product' : 'Add Product'} onClose={() => setModal(null)} footer={<><button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button><button type="button" className="btn btn-primary" onClick={save}>Save</button></>}>
          <div className="form-row">
            {['name', 'sku', 'barcode', 'category', 'unit', 'supplier'].map((f) => (
              <div key={f} className="form-group"><label>{f}</label><input className="form-control" value={form[f] || ''} onChange={(e) => setForm({ ...form, [f]: e.target.value })} /></div>
            ))}
            {['stock', 'lowStockThreshold', 'purchasePrice', 'sellingPrice', 'gstPercent'].map((f) => (
              <div key={f} className="form-group"><label>{f}</label><input type="number" className="form-control" value={form[f] ?? 0} onChange={(e) => setForm({ ...form, [f]: Number(e.target.value) })} /></div>
            ))}
            <div className="form-group"><label>Image</label><input type="file" accept="image/*" onChange={(e) => setImage(e.target.files[0])} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
