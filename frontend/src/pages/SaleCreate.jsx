import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsApi, customersApi, salesApi } from '../api';
import { useToast } from '../context/ToastContext';

export default function SaleCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [amountPaid, setAmountPaid] = useState(0);

  useEffect(() => {
    productsApi.list({ limit: 200 }).then(({ data }) => setProducts(data.products));
    customersApi.list({ limit: 200 }).then(({ data }) => setCustomers(data.customers));
  }, []);

  const addToCart = (productId) => {
    const p = products.find((x) => x._id === productId);
    if (!p) return;
    const existing = cart.find((c) => c.product === p._id);
    if (existing) {
      setCart(cart.map((c) => c.product === p._id ? { ...c, qty: c.qty + 1 } : c));
    } else {
      setCart([...cart, { product: p._id, name: p.name, qty: 1, unitPrice: p.sellingPrice, gstPercent: p.gstPercent, stock: p.stock }]);
    }
  };

  const updateQty = (productId, qty) => {
    if (qty < 1) { setCart(cart.filter((c) => c.product !== productId)); return; }
    setCart(cart.map((c) => c.product === productId ? { ...c, qty } : c));
  };

  const subtotal = cart.reduce((s, i) => s + i.qty * i.unitPrice, 0);
  const gstTotal = cart.reduce((s, i) => s + (i.qty * i.unitPrice * i.gstPercent) / 100, 0);
  const grandTotal = subtotal + gstTotal - discount;

  useEffect(() => { if (paymentStatus === 'paid') setAmountPaid(grandTotal); }, [grandTotal, paymentStatus]);

  const submit = async () => {
    if (!customerId || !cart.length) return toast('Select customer and items', 'error');
    try {
      const { data } = await salesApi.create({
        customer: customerId,
        items: cart.map(({ product, qty, unitPrice, gstPercent }) => ({ product, qty, unitPrice, gstPercent })),
        discount,
        paymentMethod,
        paymentStatus,
        amountPaid,
      });
      toast('Invoice created', 'success');
      navigate(`/sales/${data.sale._id}`);
    } catch (err) {
      toast(err.response?.data?.message || 'Failed to create invoice', 'error');
    }
  };

  return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">New Invoice</h1></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <h3>Add Products</h3>
          <select className="form-control" onChange={(e) => { addToCart(e.target.value); e.target.value = ''; }}>
            <option value="">Select product...</option>
            {products.map((p) => <option key={p._id} value={p._id}>{p.name} — Stock: {p.stock} — ₹{p.sellingPrice}</option>)}
          </select>
        </div>
        <div className="card">
          <div className="form-group"><label>Customer</label>
            <select className="form-control" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select...</option>
              {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group"><label>Payment</label>
              <select className="form-control" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                {['cash', 'card', 'upi', 'bank', 'credit'].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-group"><label>Status</label>
              <select className="form-control" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                {['paid', 'partial', 'pending'].map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group"><label>Discount (₹)</label><input type="number" className="form-control" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} /></div>
          {paymentStatus !== 'paid' && <div className="form-group"><label>Amount Paid</label><input type="number" className="form-control" value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value))} /></div>}
        </div>
      </div>
      <div className="card" style={{ marginTop: '1rem' }}>
        <table className="data-table cart-table">
          <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>GST%</th><th>Total</th><th></th></tr></thead>
          <tbody>
            {cart.map((i) => (
              <tr key={i.product}>
                <td>{i.name}</td>
                <td><input type="number" value={i.qty} min={1} max={i.stock} onChange={(e) => updateQty(i.product, Number(e.target.value))} /></td>
                <td>₹{i.unitPrice}</td>
                <td>{i.gstPercent}%</td>
                <td>₹{(i.qty * i.unitPrice * (1 + i.gstPercent / 100)).toFixed(2)}</td>
                <td><button type="button" className="btn btn-danger btn-sm" onClick={() => updateQty(i.product, 0)}>×</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ textAlign: 'right', marginTop: '1rem' }}>
          <p>Subtotal: ₹{subtotal.toFixed(2)}</p>
          <p>GST: ₹{gstTotal.toFixed(2)}</p>
          <p>Discount: ₹{discount}</p>
          <h3>Grand Total: ₹{grandTotal.toFixed(2)}</h3>
          <button type="button" className="btn btn-primary" onClick={submit}>Create Invoice</button>
        </div>
      </div>
    </div>
  );
}
