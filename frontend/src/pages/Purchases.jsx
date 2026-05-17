import { useEffect, useState } from 'react';
import { purchasesApi, productsApi } from '../api';
import { useToast } from '../context/ToastContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Purchases() {
  const { toast } = useToast();
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [items, setItems] = useState([]);

  const load = () => {
    setLoading(true);
    purchasesApi.list().then(({ data }) => setPurchases(data.purchases)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    productsApi.list({ limit: 200 }).then(({ data }) => setProducts(data.products));
  }, []);

  const addItem = (productId) => {
    const p = products.find((x) => x._id === productId);
    if (!p) return;
    setItems([...items, { product: p._id, qty: 1, unitPrice: p.purchasePrice }]);
  };

  const submit = async () => {
    try {
      await purchasesApi.create({ supplier, items });
      toast('Purchase recorded', 'success');
      setShowForm(false);
      setItems([]);
      load();
    } catch (err) {
      toast(err.response?.data?.message || 'Failed', 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Purchases</h1>
        <button type="button" className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New Purchase</button>
      </div>
      {showForm && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <div className="form-group"><label>Supplier</label><input className="form-control" value={supplier} onChange={(e) => setSupplier(e.target.value)} /></div>
          <select className="form-control" onChange={(e) => { addItem(e.target.value); e.target.value = ''; }}>
            <option value="">Add product...</option>
            {products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              <input type="number" className="form-control" value={item.qty} onChange={(e) => {
                const next = [...items]; next[i].qty = Number(e.target.value); setItems(next);
              }} />
              <input type="number" className="form-control" value={item.unitPrice} onChange={(e) => {
                const next = [...items]; next[i].unitPrice = Number(e.target.value); setItems(next);
              }} />
            </div>
          ))}
          <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={submit}>Save Purchase</button>
        </div>
      )}
      {loading ? <LoadingSpinner /> : (
        <div className="card table-wrap">
          <table className="data-table">
            <thead><tr><th>PO #</th><th>Supplier</th><th>Date</th><th>Total</th></tr></thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p._id}><td>{p.purchaseNumber}</td><td>{p.supplier}</td><td>{new Date(p.date).toLocaleDateString()}</td><td>₹{p.total}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
