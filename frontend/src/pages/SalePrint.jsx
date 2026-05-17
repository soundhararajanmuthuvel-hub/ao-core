import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { salesApi } from '../api';
import InvoiceTemplate from '../components/InvoiceTemplate';
import './SalePrint.css';

export default function SalePrint() {
  const { id } = useParams();
  const [sale, setSale] = useState(null);
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    salesApi.get(id).then(({ data }) => { setSale(data.sale); setSettings(data.settings); });
  }, [id]);

  useEffect(() => {
    if (sale) setTimeout(() => window.print(), 600);
  }, [sale]);

  if (!sale) return <p>Loading...</p>;

  return (
    <>
      <div className="print-actions no-print">
        <Link to={`/sales/${id}`} className="btn btn-secondary">← Back</Link>
      </div>
      <InvoiceTemplate sale={sale} settings={settings} captureId="invoice-print" />
    </>
  );
}
