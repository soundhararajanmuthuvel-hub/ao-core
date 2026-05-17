import { useState } from 'react';
import { reportsApi } from '../api';
import { useToast } from '../context/ToastContext';

export default function Reports() {
  const { toast } = useToast();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [sales, setSales] = useState(null);
  const [purchases, setPurchases] = useState(null);
  const [daily, setDaily] = useState(null);

  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadSales = async () => {
    const { data } = await reportsApi.sales({ from, to });
    setSales(data);
  };

  const loadPurchases = async () => {
    const { data } = await reportsApi.purchases();
    setPurchases(data);
  };

  const loadDaily = async () => {
    const { data } = await reportsApi.daily({ date });
    setDaily(data);
  };

  const exportSales = async () => {
    try {
      const { data } = await reportsApi.exportSales({ from, to });
      download(data, 'sales-report.xlsx');
      toast('Exported', 'success');
    } catch {
      toast('Export failed', 'error');
    }
  };

  const exportPurchases = async () => {
    const { data } = await reportsApi.exportPurchases();
    download(data, 'purchases-report.xlsx');
    toast('Exported', 'success');
  };

  const exportDaily = async () => {
    const { data } = await reportsApi.exportDaily({ date });
    download(data, `daily-${date}.xlsx`);
    toast('Exported', 'success');
  };

  return (
    <div className="page">
      <div className="page-header"><h1 className="page-title">Reports</h1></div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3>Sales Report</h3>
        <div className="form-row">
          <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
          <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" className="btn btn-secondary" onClick={loadSales}>Load</button>
          <button type="button" className="btn btn-primary" onClick={exportSales}>Export Excel</button>
        </div>
        {sales && <p>{sales.count} invoices — Total: ₹{sales.total}</p>}
      </div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3>Purchases Report</h3>
        <button type="button" className="btn btn-secondary" onClick={loadPurchases}>Load</button>
        <button type="button" className="btn btn-primary" onClick={exportPurchases}>Export Excel</button>
        {purchases && <p>{purchases.count} purchases — Total: ₹{purchases.total}</p>}
      </div>
      <div className="card">
        <h3>Daily Report</h3>
        <input type="date" className="form-control" style={{ maxWidth: 200 }} value={date} onChange={(e) => setDate(e.target.value)} />
        <button type="button" className="btn btn-secondary" onClick={loadDaily}>Load</button>
        <button type="button" className="btn btn-primary" onClick={exportDaily}>Export Excel</button>
        {daily && <p>{daily.count} sales — Total: ₹{daily.total}</p>}
      </div>
    </div>
  );
}
