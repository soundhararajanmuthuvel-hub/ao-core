import { useEffect, useState, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { salesApi } from '../api';
import { downloadInvoicePdf } from '../utils/invoicePdf';
import { downloadInvoiceJpg, shareInvoiceWhatsApp } from '../utils/invoiceImage';
import { useToast } from '../context/ToastContext';
import InvoiceTemplate from '../components/InvoiceTemplate';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SaleView() {
  const { id } = useParams();
  const { toast } = useToast();
  const captureRef = useRef(null);
  const [sale, setSale] = useState(null);
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    salesApi.get(id).then(({ data }) => { setSale(data.sale); setSettings(data.settings); });
  }, [id]);

  const getEl = () => captureRef.current;

  const handleJpg = async () => {
    setBusy('jpg');
    try {
      await downloadInvoiceJpg(getEl(), `${sale.invoiceNumber}.jpg`);
      toast('Invoice JPG downloaded', 'success');
    } catch {
      toast('Failed to create JPG', 'error');
    } finally {
      setBusy('');
    }
  };

  const handleWhatsApp = async () => {
    if (!sale.customer?.phone) {
      toast('Customer has no phone number — add phone in Customers', 'warning');
    }
    setBusy('wa');
    try {
      const result = await shareInvoiceWhatsApp(sale, settings, getEl());
      if (result.method === 'whatsapp') {
        toast('JPG downloaded — WhatsApp opened. Attach the image to send.', 'success');
      } else if (result.method === 'share') {
        toast('Shared via device', 'success');
      }
    } catch {
      toast('WhatsApp share failed', 'error');
    } finally {
      setBusy('');
    }
  };

  if (!sale) return <LoadingSpinner />;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Invoice {sale.invoiceNumber}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Link to={`/sales/${id}/print`} className="btn btn-secondary">Print</Link>
          <button type="button" className="btn btn-secondary" onClick={() => downloadInvoicePdf(sale, settings)}>PDF</button>
          <button type="button" className="btn btn-secondary" onClick={handleJpg} disabled={!!busy}>
            {busy === 'jpg' ? '…' : 'Download JPG'}
          </button>
          <button type="button" className="btn btn-whatsapp" onClick={handleWhatsApp} disabled={!!busy}>
            {busy === 'wa' ? '…' : 'Send WhatsApp'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <p><strong>Customer:</strong> {sale.customer?.name} {sale.customer?.phone && `(${sale.customer.phone})`}</p>
        <p><strong>Date:</strong> {new Date(sale.date).toLocaleDateString()}</p>
        <p><strong>Payment:</strong> {sale.paymentMethod} — {sale.paymentStatus}</p>
      </div>

      <div className="invoice-capture-hidden" aria-hidden="true">
        <div ref={captureRef}>
          <InvoiceTemplate sale={sale} settings={settings} captureId="invoice-capture-view" />
        </div>
      </div>

      <div className="card">
        <InvoiceTemplate sale={sale} settings={settings} captureId="invoice-preview" />
      </div>
    </div>
  );
}
