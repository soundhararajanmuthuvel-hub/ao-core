import '../styles/invoice-template.css';
import { resolveAssetUrl } from '../utils/url';

export default function InvoiceTemplate({ sale, settings, captureId = 'invoice-capture' }) {
  if (!sale) return null;

  return (
    <div id={captureId} className="invoice-template">
      <header className="invoice-template-header">
        {settings?.logo && <img src={resolveAssetUrl(settings.logo)} alt="" className="invoice-logo" crossOrigin="anonymous" />}
        <div>
          <h1>{settings?.companyName || 'AO Core'}</h1>
          <p>{settings?.address}</p>
          <p>GST: {settings?.gstDetails}</p>
          <p>Phone: {settings?.phone}</p>
        </div>
      </header>
      <hr />
      <div className="invoice-template-meta">
        <div><strong>Invoice:</strong> {sale.invoiceNumber}</div>
        <div><strong>Date:</strong> {new Date(sale.date).toLocaleDateString('en-IN')}</div>
      </div>
      <div className="invoice-template-customer">
        <p><strong>Bill To:</strong> {sale.customer?.name}</p>
        <p>{sale.customer?.phone} {sale.customer?.email && `| ${sale.customer.email}`}</p>
        <p>{sale.customer?.address}</p>
        {sale.customer?.gstNumber && <p>GSTIN: {sale.customer.gstNumber}</p>}
      </div>
      <table className="invoice-template-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>GST%</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, idx) => (
            <tr key={idx}>
              <td>{idx + 1}</td>
              <td>{item.name}</td>
              <td>{item.qty}</td>
              <td>₹{item.unitPrice}</td>
              <td>{item.gstPercent || 0}%</td>
              <td>₹{Number(item.lineTotal).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="invoice-template-totals">
        <p>Subtotal: ₹{Number(sale.subtotal).toFixed(2)}</p>
        <p>GST: ₹{Number(sale.gstTotal).toFixed(2)}</p>
        {sale.discount > 0 && <p>Discount: ₹{Number(sale.discount).toFixed(2)}</p>}
        <p className="invoice-grand-total">Grand Total: ₹{Number(sale.grandTotal).toFixed(2)}</p>
        <p className="invoice-payment">Payment: {sale.paymentMethod} — {sale.paymentStatus}</p>
      </div>
      <p className="invoice-footer">Thank you for your business!</p>
    </div>
  );
}
