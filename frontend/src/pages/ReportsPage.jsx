import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { reportsApi, manufacturingApi, inventoryApi, suppliersApi } from '../api';
import { useToast } from '../context/ToastContext';
import { GST_REGISTRATION_TYPES, GST_STATE_OPTIONS } from '../utils/gst';
import { exportGstReportPdf, formatCurrency, formatReportDate } from '../utils/gstReports';

export default function ReportsPage() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'sales';

  // Date range state
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // GST Reports states
  const [gstSubTab, setGstSubTab] = useState('summary');
  const [gstSummaryData, setGstSummaryData] = useState(null);
  const [gstReportRows, setGstReportRows] = useState([]);
  const [gstHsnRows, setGstHsnRows] = useState([]);
  const [gstReportsLoading, setGstReportsLoading] = useState(false);

  // Report results
  const [sales, setSales] = useState(null);
  const [purchases, setPurchases] = useState(null);
  const [purchaseRows, setPurchaseRows] = useState([]);
  const [reportSuppliers, setReportSuppliers] = useState([]);
  const [purchaseFilters, setPurchaseFilters] = useState({
    supplierId: '',
    gstNumber: '',
    state: '',
    gstType: '',
  });
  const [daily, setDaily] = useState(null);
  const [shipping, setShipping] = useState(null);
  const [mfgRunsCount, setMfgRunsCount] = useState(0);
  const [invValuation, setInvValuation] = useState(0);

  // Shipping Cost Report states
  const [shippingSubTab, setShippingSubTab] = useState('delivery');
  const [shippingCostsData, setShippingCostsData] = useState(null);
  const [shippingCostsLoading, setShippingCostsLoading] = useState(false);

  const loadShippingCosts = async () => {
    setShippingCostsLoading(true);
    try {
      const { data } = await reportsApi.shippingCosts({ from, to });
      if (data.success) {
        setShippingCostsData(data);
      }
    } catch {
      toast('Failed to load shipping costs data', 'error');
    } finally {
      setShippingCostsLoading(false);
    }
  };

  const exportShippingCosts = async () => {
    try {
      const { data } = await reportsApi.exportShippingCosts({ from, to });
      download(data, 'shipping-cost-report.xlsx');
      toast('Exported Shipping Cost Report', 'success');
    } catch {
      toast('Export failed', 'error');
    }
  };

  useEffect(() => {
    // Pre-load quick totals
    manufacturingApi.list().then(({ data }) => setMfgRunsCount(data.length || 0)).catch(() => {});
    inventoryApi.report().then(({ data }) => setInvValuation(data.totalValue || 0)).catch(() => {});
    suppliersApi.list({ includeInactive: true }).then(({ data }) => setReportSuppliers(data.suppliers || [])).catch(() => {});
  }, []);

  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadSales = async () => {
    try {
      const { data } = await reportsApi.sales({ from, to });
      setSales(data);
    } catch {
      toast('Failed to load sales data', 'error');
    }
  };

  const loadPurchases = async () => {
    try {
      const params = {
        ...purchaseFilters,
        from,
        to,
      };
      const { data } = await reportsApi.purchases(params);
      setPurchases({
        count: data.count || 0,
        total: data.total || 0,
      });
      setPurchaseRows(data.purchases || []);
    } catch {
      toast('Failed to load purchases data', 'error');
    }
  };

  const loadDaily = async () => {
    try {
      const { data } = await reportsApi.daily({ date });
      setDaily(data);
    } catch {
      toast('Failed to load daily reports', 'error');
    }
  };

  const loadShipping = async () => {
    try {
      const { data } = await reportsApi.shipping({ from, to });
      setShipping(data);
    } catch {
      toast('Failed to load shipping data', 'error');
    }
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
    try {
      const params = {
        ...purchaseFilters,
        from,
        to,
      };
      const { data } = await reportsApi.exportPurchases(params);
      download(data, 'purchases-report.xlsx');
      toast('Exported', 'success');
    } catch {
      toast('Export failed', 'error');
    }
  };

  const exportDaily = async () => {
    try {
      const { data } = await reportsApi.exportDaily({ date });
      download(data, `daily-${date}.xlsx`);
      toast('Exported', 'success');
    } catch {
      toast('Export failed', 'error');
    }
  };

  const exportShipping = async () => {
    try {
      const { data } = await reportsApi.exportShipping({ from, to });
      download(data, 'shipping-report.xlsx');
      toast('Exported', 'success');
    } catch {
      toast('Export failed', 'error');
    }
  };

  const loadGstReport = async (subTabKey) => {
    setGstReportsLoading(true);
    try {
      const activeKey = subTabKey || gstSubTab;
      const params = { from, to };
      
      if (activeKey === 'summary') {
        const { data } = await reportsApi.gstSummary(params);
        if (data.success) {
          setGstSummaryData(data.data);
        }
      } else if (activeKey === 'hsn') {
        const { data } = await reportsApi.gstHsn(params);
        if (data.success) {
          setGstHsnRows(data.data || []);
        }
      } else {
        let res;
        if (activeKey === 'gstr1') res = await reportsApi.gstGstr1(params);
        else if (activeKey === 'b2b') res = await reportsApi.gstB2b(params);
        else if (activeKey === 'b2c') res = await reportsApi.gstB2c(params);
        else if (activeKey === 'salesRegister') res = await reportsApi.gstSalesRegister(params);

        if (res && res.data.success) {
          setGstReportRows(res.data.data || []);
        }
      }
    } catch (err) {
      console.error('Failed to load GST report:', err);
      toast('Failed to load GST report data', 'error');
    } finally {
      setGstReportsLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab === 'gst') {
      loadGstReport(gstSubTab);
    }
  }, [currentTab, gstSubTab]);

  useEffect(() => {
    if (currentTab === 'shipping') {
      if (shippingSubTab === 'delivery') {
        loadShipping();
      } else if (shippingSubTab === 'logistics') {
        loadShippingCosts();
      }
    }
  }, [currentTab, shippingSubTab]);

  const exportGstExcel = async () => {
    try {
      const params = { from, to };
      let res;
      let filename = 'gst-report.xlsx';
      if (gstSubTab === 'gstr1') {
        res = await reportsApi.exportGstGstr1Excel(params);
        filename = 'gstr-1-report.xlsx';
      } else if (gstSubTab === 'b2b') {
        res = await reportsApi.exportGstB2bExcel(params);
        filename = 'b2b-gst-report.xlsx';
      } else if (gstSubTab === 'b2c') {
        res = await reportsApi.exportGstB2cExcel(params);
        filename = 'b2c-gst-report.xlsx';
      } else if (gstSubTab === 'hsn') {
        res = await reportsApi.exportGstHsnExcel(params);
        filename = 'hsn-summary-report.xlsx';
      } else if (gstSubTab === 'salesRegister') {
        res = await reportsApi.exportGstSalesRegisterExcel(params);
        filename = 'sales-gst-register.xlsx';
      } else {
        toast('Export not supported for this report type', 'warning');
        return;
      }
      download(res.data, filename);
      toast('Exported Excel successfully', 'success');
    } catch (err) {
      console.error('Export failed:', err);
      toast('Export Excel failed', 'error');
    }
  };

  const exportGstCsv = async () => {
    if (gstSubTab !== 'gstr1') {
      toast('CSV export is only supported for GSTR-1', 'warning');
      return;
    }
    try {
      const res = await reportsApi.exportGstGstr1Csv({ from, to });
      download(res.data, 'gstr-1-report.csv');
      toast('Exported CSV successfully', 'success');
    } catch (err) {
      console.error('Export CSV failed:', err);
      toast('Export CSV failed', 'error');
    }
  };

  const exportGstPdf = () => {
    if (gstSubTab === 'summary' && gstSummaryData) {
      exportGstReportPdf({
        title: 'GST Summary Report',
        subtitle: `Period: ${from || 'All'} to ${to || 'All'}`,
        summaryCards: [
          { label: 'Total Liability', value: formatCurrency(gstSummaryData.totalLiability) },
          { label: 'Total ITC', value: formatCurrency(gstSummaryData.totalItc) },
          { label: 'Net GST Payable', value: formatCurrency(gstSummaryData.netGstPayable), color: gstSummaryData.netGstPayable > 0 ? [239, 68, 68] : [16, 185, 129] }
        ],
        sections: [{
          title: 'Transaction Metrics',
          columns: ['Metric', 'Count / Details'],
          rows: [
            ['Sales Invoice Count', gstSummaryData.salesCount],
            ['Purchase Invoice Count', gstSummaryData.purchasesCount],
            ['Calculated Liability (Sales)', formatCurrency(gstSummaryData.totalLiability)],
            ['Input Tax Credit (Purchases)', formatCurrency(gstSummaryData.totalItc)],
            ['Net Tax Due', formatCurrency(gstSummaryData.netGstPayable)]
          ]
        }],
        filename: 'gst-summary-report.pdf'
      });
      toast('Exported PDF successfully', 'success');
    } else if (gstSubTab === 'gstr1') {
      exportGstReportPdf({
        title: 'GSTR-1 Report',
        subtitle: `Period: ${from || 'All'} to ${to || 'All'}`,
        summaryCards: [
          { label: 'Sales Count', value: gstReportRows.length },
          { label: 'Taxable Amount', value: formatCurrency(gstReportRows.reduce((sum, r) => sum + r.taxableAmount, 0)) },
          { label: 'GST Total', value: formatCurrency(gstReportRows.reduce((sum, r) => sum + r.gstTotal, 0)) }
        ],
        sections: [{
          columns: ['Invoice #', 'Date', 'Customer Name', 'GSTIN', 'Taxable Val', 'CGST', 'SGST', 'IGST', 'GST Total', 'Invoice Val', 'State'],
          rows: gstReportRows.map(r => [
            r.invoiceNumber,
            formatReportDate(r.date),
            r.customerName,
            r.customerGstNumber || '—',
            formatCurrency(r.taxableAmount),
            formatCurrency(r.cgstAmount),
            formatCurrency(r.sgstAmount),
            formatCurrency(r.igstAmount),
            formatCurrency(r.gstTotal),
            formatCurrency(r.grandTotal),
            r.customerState || '—'
          ])
        }],
        filename: 'gstr-1-report.pdf'
      });
      toast('Exported PDF successfully', 'success');
    } else if (gstSubTab === 'b2b') {
      exportGstReportPdf({
        title: 'GST B2B Report',
        subtitle: `Period: ${from || 'All'} to ${to || 'All'}`,
        summaryCards: [
          { label: 'Invoices Count', value: gstReportRows.length },
          { label: 'Taxable Amount', value: formatCurrency(gstReportRows.reduce((sum, r) => sum + r.taxableAmount, 0)) },
          { label: 'GST Total', value: formatCurrency(gstReportRows.reduce((sum, r) => sum + r.gstTotal, 0)) }
        ],
        sections: [{
          columns: ['Invoice #', 'Date', 'Customer Name', 'GSTIN', 'Taxable Val', 'CGST', 'SGST', 'IGST', 'Invoice Val'],
          rows: gstReportRows.map(r => [
            r.invoiceNumber,
            formatReportDate(r.date),
            r.customerName,
            r.customerGstNumber,
            formatCurrency(r.taxableAmount),
            formatCurrency(r.cgstAmount),
            formatCurrency(r.sgstAmount),
            formatCurrency(r.igstAmount),
            formatCurrency(r.grandTotal)
          ])
        }],
        filename: 'b2b-gst-report.pdf'
      });
      toast('Exported PDF successfully', 'success');
    } else if (gstSubTab === 'b2c') {
      exportGstReportPdf({
        title: 'GST B2C Report',
        subtitle: `Period: ${from || 'All'} to ${to || 'All'}`,
        summaryCards: [
          { label: 'Invoices Count', value: gstReportRows.length },
          { label: 'Taxable Amount', value: formatCurrency(gstReportRows.reduce((sum, r) => sum + r.taxableAmount, 0)) },
          { label: 'GST Total', value: formatCurrency(gstReportRows.reduce((sum, r) => sum + r.gstTotal, 0)) }
        ],
        sections: [{
          columns: ['Invoice #', 'Date', 'Customer Name', 'Taxable Val', 'CGST', 'SGST', 'IGST', 'Invoice Val'],
          rows: gstReportRows.map(r => [
            r.invoiceNumber,
            formatReportDate(r.date),
            r.customerName,
            formatCurrency(r.taxableAmount),
            formatCurrency(r.cgstAmount),
            formatCurrency(r.sgstAmount),
            formatCurrency(r.igstAmount),
            formatCurrency(r.grandTotal)
          ])
        }],
        filename: 'b2c-gst-report.pdf'
      });
      toast('Exported PDF successfully', 'success');
    } else if (gstSubTab === 'hsn') {
      exportGstReportPdf({
        title: 'HSN / GST Class Summary',
        subtitle: `Period: ${from || 'All'} to ${to || 'All'}`,
        summaryCards: [
          { label: 'Taxable Value', value: formatCurrency(gstHsnRows.reduce((sum, r) => sum + r.taxableAmount, 0)) },
          { label: 'Total Tax', value: formatCurrency(gstHsnRows.reduce((sum, r) => sum + r.taxAmount, 0)) }
        ],
        sections: [{
          columns: ['GST Class', 'Description', 'GST %', 'Total Qty', 'Taxable Val', 'CGST', 'SGST', 'IGST', 'Total Tax'],
          rows: gstHsnRows.map(r => [
            r.gstClass,
            r.description,
            `${r.gstPercent}%`,
            r.qty,
            formatCurrency(r.taxableAmount),
            formatCurrency(r.cgstAmount),
            formatCurrency(r.sgstAmount),
            formatCurrency(r.igstAmount),
            formatCurrency(r.taxAmount)
          ])
        }],
        filename: 'hsn-summary-report.pdf'
      });
      toast('Exported PDF successfully', 'success');
    } else if (gstSubTab === 'salesRegister') {
      exportGstReportPdf({
        title: 'Sales GST Register',
        subtitle: `Period: ${from || 'All'} to ${to || 'All'}`,
        summaryCards: [
          { label: 'Invoices', value: gstReportRows.length },
          { label: 'Taxable Amount', value: formatCurrency(gstReportRows.reduce((sum, r) => sum + r.taxableAmount, 0)) },
          { label: 'GST Total', value: formatCurrency(gstReportRows.reduce((sum, r) => sum + r.gstTotal, 0)) }
        ],
        sections: [{
          columns: ['Invoice #', 'Date', 'Customer Name', 'GSTIN', 'Taxable Val', 'CGST', 'SGST', 'IGST', 'GST Total', 'Shipping', 'Total Val', 'Payment', 'Status'],
          rows: gstReportRows.map(r => [
            r.invoiceNumber,
            formatReportDate(r.date),
            r.customerName,
            r.customerGstNumber || '—',
            formatCurrency(r.taxableAmount),
            formatCurrency(r.cgstAmount),
            formatCurrency(r.sgstAmount),
            formatCurrency(r.igstAmount),
            formatCurrency(r.gstTotal),
            formatCurrency(r.shippingCharge),
            formatCurrency(r.grandTotal),
            r.paymentMethod || '—',
            r.paymentStatus || '—'
          ])
        }],
        filename: 'sales-gst-register.pdf'
      });
      toast('Exported PDF successfully', 'success');
    } else {
      toast('Report data not loaded or summary not available', 'warning');
    }
  };

  const setTab = (tabName) => {
    setSearchParams({ tab: tabName });
  };

  return (
    <div className="page" style={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif' }}>
      <div className="page-header" style={{ marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            📑 Analytics Reports Center
          </h1>
          <p className="page-subtitle" style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '0.25rem', marginBottom: 0 }}>
            Export sheets, check accounting, and review logistic dispatches.
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', marginBottom: '1.5rem', gap: '0.5rem', overflowX: 'auto' }}>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'sales' ? 'active' : ''}`}
          onClick={() => setTab('sales')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'sales' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'sales' ? '#ff9800' : '#64748b',
          }}
        >
          📊 Sales Reports
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'inventory' ? 'active' : ''}`}
          onClick={() => setTab('inventory')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'inventory' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'inventory' ? '#ff9800' : '#64748b',
          }}
        >
          🌾 Inventory & Purchases
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'manufacturing' ? 'active' : ''}`}
          onClick={() => setTab('manufacturing')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'manufacturing' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'manufacturing' ? '#ff9800' : '#64748b',
          }}
        >
          🏭 Production Reports
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'shipping' ? 'active' : ''}`}
          onClick={() => setTab('shipping')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'shipping' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'shipping' ? '#ff9800' : '#64748b',
          }}
        >
          🚚 Shipping Reports
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'profit' ? 'active' : ''}`}
          onClick={() => setTab('profit')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'profit' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'profit' ? '#ff9800' : '#64748b',
          }}
        >
          💳 Profit & Loss Summary
        </button>
        <button
          type="button"
          className={`rm-tab-btn ${currentTab === 'gst' ? 'active' : ''}`}
          onClick={() => setTab('gst')}
          style={{
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.9rem',
            borderBottom: currentTab === 'gst' ? '3px solid #ff9800' : '3px solid transparent',
            color: currentTab === 'gst' ? '#ff9800' : '#64748b',
          }}
        >
          🧾 Indian GST Reports
        </button>
      </div>

      <div className="tab-content" style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
        {currentTab === 'sales' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Filter Sales Period</h3>
              <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="date" className="form-control" style={{ maxWidth: '180px' }} value={from} onChange={(e) => setFrom(e.target.value)} />
                <input type="date" className="form-control" style={{ maxWidth: '180px' }} value={to} onChange={(e) => setTo(e.target.value)} />
                <button type="button" className="btn btn-secondary" onClick={loadSales}>Load Summary</button>
                <button type="button" className="btn btn-primary" onClick={exportSales}>Export Excel</button>
              </div>
              {sales && <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#4b5563' }}>📊 Found <strong>{sales.count}</strong> invoices issued, totaling <strong>₹{Number(sales.total || 0).toLocaleString()}</strong></p>}
            </div>

            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Daily Billing Summary</h3>
              <div className="form-row" style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input type="date" className="form-control" style={{ maxWidth: '180px' }} value={date} onChange={(e) => setDate(e.target.value)} />
                <button type="button" className="btn btn-secondary" onClick={loadDaily}>Load</button>
                <button type="button" className="btn btn-primary" onClick={exportDaily}>Export Daily Excel</button>
              </div>
              {daily && <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#4b5563' }}>✓ <strong>{daily.count}</strong> sales logged on this date, totaling <strong>₹{Number(daily.total || 0).toLocaleString()}</strong></p>}
            </div>
          </div>
        )}

        {currentTab === 'inventory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Purchase Report Filters</h3>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                <div className="form-group">
                  <label>Supplier</label>
                  <select
                    className="form-control"
                    value={purchaseFilters.supplierId}
                    onChange={(e) => setPurchaseFilters({ ...purchaseFilters, supplierId: e.target.value })}
                  >
                    <option value="">All suppliers</option>
                    {reportSuppliers.map((supplier) => (
                      <option key={supplier.id || supplier._id} value={supplier.id || supplier._id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>GST Number</label>
                  <input
                    className="form-control"
                    value={purchaseFilters.gstNumber}
                    onChange={(e) => setPurchaseFilters({ ...purchaseFilters, gstNumber: e.target.value })}
                    placeholder="Search GSTIN"
                  />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <select
                    className="form-control"
                    value={purchaseFilters.state}
                    onChange={(e) => setPurchaseFilters({ ...purchaseFilters, state: e.target.value })}
                  >
                    <option value="">All states</option>
                    {GST_STATE_OPTIONS.map((state) => (
                      <option key={state.code} value={state.name}>
                        {state.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>GST Type</label>
                  <select
                    className="form-control"
                    value={purchaseFilters.gstType}
                    onChange={(e) => setPurchaseFilters({ ...purchaseFilters, gstType: e.target.value })}
                  >
                    <option value="">All GST types</option>
                    {GST_REGISTRATION_TYPES.map((gstType) => (
                      <option key={gstType} value={gstType}>
                        {gstType}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>From Date</label>
                  <input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="form-group">
                  <label>To Date</label>
                  <input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" style={{ marginRight: '0.5rem' }} onClick={loadPurchases}>
                  Load Purchases
                </button>
                <button type="button" className="btn btn-primary" onClick={exportPurchases}>
                  Export Purchases Excel
                </button>
              </div>
            </div>

            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#1e293b' }}>Purchases Report</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ borderLeft: '4px solid #10b981', paddingLeft: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>PURCHASE COUNT</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>{purchases ? purchases.count : 0}</div>
                </div>
                <div style={{ borderLeft: '4px solid #ef4444', paddingLeft: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>TOTAL VALUE</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', marginTop: '0.25rem' }}>
                    ₹{purchases ? Number(purchases.total || 0).toLocaleString() : '0'}
                  </div>
                </div>
                <div style={{ borderLeft: '4px solid #2563eb', paddingLeft: '1rem' }}>
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>INVENTORY VALUE</span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#2563eb', marginTop: '0.25rem' }}>
                    ₹{Number(invValuation).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="card table-wrap" style={{ padding: 0, boxShadow: 'none', border: '1px solid #e2e8f0' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>PO #</th>
                      <th>Supplier</th>
                      <th>GST Number</th>
                      <th>State</th>
                      <th>GST Type</th>
                      <th>Tax Type</th>
                      <th>Date</th>
                      <th>Subtotal</th>
                      <th>Tax</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseRows.map((purchase) => (
                      <tr key={purchase.id || purchase._id}>
                        <td>{purchase.purchaseNumber}</td>
                        <td>{purchase.supplier}</td>
                        <td>{purchase.supplierGstNumber || '—'}</td>
                        <td>{purchase.supplierState || '—'}</td>
                        <td>{purchase.supplierGstType || '—'}</td>
                        <td>{purchase.taxType || '—'}</td>
                        <td>{purchase.date ? new Date(purchase.date).toLocaleDateString() : '—'}</td>
                        <td>₹{Number(purchase.subtotal || 0).toLocaleString()}</td>
                        <td>₹{Number(purchase.taxTotal || 0).toLocaleString()}</td>
                        <td>₹{Number(purchase.total || 0).toLocaleString()}</td>
                        <td>
                          <span className={`badge ${purchase.paymentStatus === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                            {purchase.paymentStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {purchaseRows.length === 0 && (
                      <tr>
                        <td colSpan="11" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                          Load a purchase report to see GST filtered results.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'manufacturing' && (
          <div className="card" style={{ padding: '2rem', backgroundColor: '#fff', borderRadius: '12px', textAlign: 'center' }}>
            <span style={{ fontSize: '2.5rem' }}>🏭</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '1rem 0 0.5rem 0', color: '#1e293b' }}>Production Runs Report</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1rem' }}>Total active recipe recipes and production orders processed.</p>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ff9800' }}>{mfgRunsCount} Finished Production Batches Logged</div>
          </div>
        )}

        {currentTab === 'shipping' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Shipping Sub-tab Navigation */}
            <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem', overflowX: 'auto', backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '8px' }}>
              {[
                { key: 'delivery', label: '🚚 Delivery Tracking Summary' },
                { key: 'logistics', label: '📈 Logistics Profit & Loss Analysis' }
              ].map((sub) => (
                <button
                  key={sub.key}
                  type="button"
                  className={`rm-tab-btn ${shippingSubTab === sub.key ? 'active' : ''}`}
                  onClick={() => setShippingSubTab(sub.key)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: shippingSubTab === sub.key ? '#fff' : 'transparent',
                    color: shippingSubTab === sub.key ? '#ff9800' : '#64748b',
                    boxShadow: shippingSubTab === sub.key ? '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {shippingSubTab === 'delivery' && (
              <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Shipping & Dispatch Deliveries</h3>
                <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <input type="date" className="form-control" style={{ maxWidth: '180px' }} value={from} onChange={(e) => setFrom(e.target.value)} />
                  <input type="date" className="form-control" style={{ maxWidth: '180px' }} value={to} onChange={(e) => setTo(e.target.value)} />
                  <button type="button" className="btn btn-secondary" onClick={loadShipping}>Load Status Summary</button>
                  <button type="button" className="btn btn-primary" onClick={exportShipping}>Export Excel</button>
                </div>
                {shipping && (
                  <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#4b5563' }}>
                    🚚 Found <strong>{shipping.count}</strong> shipments. Delivered: <strong style={{ color: '#10b981' }}>{shipping.metrics.delivered}</strong> | In Transit: <strong style={{ color: '#3b82f6' }}>{shipping.metrics.inTransit}</strong> | Pending: <strong>{shipping.metrics.pending}</strong> | Returned: <strong style={{ color: '#ef4444' }}>{shipping.metrics.returned}</strong>
                  </p>
                )}
              </div>
            )}

            {shippingSubTab === 'logistics' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Filter Card */}
                <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Filter Logistics Period</h3>
                  <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>From:</span>
                      <input type="date" className="form-control" style={{ maxWidth: '180px' }} value={from} onChange={(e) => setFrom(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: '#64748b' }}>To:</span>
                      <input type="date" className="form-control" style={{ maxWidth: '180px' }} value={to} onChange={(e) => setTo(e.target.value)} />
                    </div>
                    <button type="button" className="btn btn-secondary" onClick={loadShippingCosts}>Apply Period</button>
                    <button type="button" className="btn btn-primary" onClick={exportShippingCosts}>📥 Export Cost Report Excel</button>
                  </div>
                </div>

                {/* Metrics Summary Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                  <div className="card" style={{ borderLeft: '4px solid #3b82f6', padding: '1rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>COLLECTED SHIPPING</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.25rem' }}>
                      ₹{shippingCostsData ? Number(shippingCostsData.metrics?.totalCollected || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                  </div>
                  <div className="card" style={{ borderLeft: '4px solid #6b7280', padding: '1rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>PACKING COST</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6b7280', marginTop: '0.25rem' }}>
                      ₹{shippingCostsData ? Number(shippingCostsData.metrics?.totalPacking || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                  </div>
                  <div className="card" style={{ borderLeft: '4px solid #6b7280', padding: '1rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>HANDLING COST</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6b7280', marginTop: '0.25rem' }}>
                      ₹{shippingCostsData ? Number(shippingCostsData.metrics?.totalHandling || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                  </div>
                  <div className="card" style={{ borderLeft: '4px solid #6b7280', padding: '1rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>COURIER COST</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6b7280', marginTop: '0.25rem' }}>
                      ₹{shippingCostsData ? Number(shippingCostsData.metrics?.totalCourier || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                  </div>
                  <div className="card" style={{ borderLeft: '4px solid #6b7280', padding: '1rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>LOADING COST</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6b7280', marginTop: '0.25rem' }}>
                      ₹{shippingCostsData ? Number(shippingCostsData.metrics?.totalLoading || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                  </div>
                  <div className="card" style={{ borderLeft: `4px solid ${shippingCostsData?.metrics?.totalProfitLoss >= 0 ? '#10b981' : '#ef4444'}`, padding: '1rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>SHIPPING P&L</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: shippingCostsData?.metrics?.totalProfitLoss >= 0 ? '#10b981' : '#ef4444', marginTop: '0.25rem' }}>
                      ₹{shippingCostsData ? Number(shippingCostsData.metrics?.totalProfitLoss || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}
                    </div>
                  </div>
                </div>

                {/* Table view */}
                <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Invoices Shipping Details</h3>
                  <div className="card table-wrap" style={{ padding: 0, boxShadow: 'none', border: '1px solid #e2e8f0' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Invoice #</th>
                          <th>Customer</th>
                          <th>Date</th>
                          <th>Shipping Collected</th>
                          <th>Packing Cost</th>
                          <th>Handling Cost</th>
                          <th>Courier Cost</th>
                          <th>Loading Cost</th>
                          <th>Shipping P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shippingCostsLoading ? (
                          <tr>
                            <td colSpan="9" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                              Loading report data...
                            </td>
                          </tr>
                        ) : shippingCostsData?.rows?.map((row, idx) => (
                          <tr key={idx}>
                            <td>{row.invoiceNumber}</td>
                            <td>{row.customerName}</td>
                            <td>{row.date}</td>
                            <td style={{ fontWeight: 600, color: '#3b82f6' }}>₹{Number(row.shippingChargeCollected).toFixed(2)}</td>
                            <td>₹{Number(row.packingCost).toFixed(2)}</td>
                            <td>₹{Number(row.handlingCost).toFixed(2)}</td>
                            <td>₹{Number(row.courierCost).toFixed(2)}</td>
                            <td>₹{Number(row.loadingCost).toFixed(2)}</td>
                            <td style={{ fontWeight: 600, color: row.actualShippingProfitLoss >= 0 ? '#10b981' : '#ef4444' }}>
                              ₹{Number(row.actualShippingProfitLoss).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                        {!shippingCostsLoading && (!shippingCostsData || shippingCostsData.rows.length === 0) && (
                          <tr>
                            <td colSpan="9" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>
                              No data found for the selected period. Apply filters and click Load.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentTab === 'profit' && (
          <div className="card" style={{ padding: '2rem', backgroundColor: '#fff', borderRadius: '12px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Financial Profit & Loss Sheet</h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '1.5rem' }}>Calculates the absolute revenue generated against warehouse packaging & raw purchase costs.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <div style={{ borderLeft: '4px solid #10b981', paddingLeft: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>REVENUE TALLIES (SALES)</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>₹{sales ? Number(sales.total || 0).toLocaleString() : '—'}</div>
              </div>
              <div style={{ borderLeft: '4px solid #ef4444', paddingLeft: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>EXPENDITURE (PURCHASES)</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ef4444', marginTop: '0.25rem' }}>₹{purchases ? Number(purchases.total || 0).toLocaleString() : '—'}</div>
              </div>
              <div style={{ borderLeft: '4px solid #ff9800', paddingLeft: '1rem' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>NET DIFFERENTIAL PROFIT</span>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#ff9800', marginTop: '0.25rem' }}>
                  ₹{(sales && purchases) ? Number(sales.total - purchases.total).toLocaleString() : '—'}
                </div>
              </div>
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { await Promise.all([loadSales(), loadPurchases()]); }}>
                Recalculate Net Profit Margins
              </button>
            </div>
          </div>
        )}

        {currentTab === 'gst' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Filter Card */}
            <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Filter Tax Period</h3>
              <div className="form-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>From:</span>
                  <input type="date" className="form-control" style={{ maxWidth: '180px' }} value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: '#64748b' }}>To:</span>
                  <input type="date" className="form-control" style={{ maxWidth: '180px' }} value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <button type="button" className="btn btn-secondary" onClick={() => loadGstReport(gstSubTab)}>Apply Period</button>
                {gstSubTab !== 'summary' && (
                  <>
                    <button type="button" className="btn btn-primary" onClick={exportGstExcel}>📥 Export Excel</button>
                    {gstSubTab === 'gstr1' && <button type="button" className="btn btn-secondary" onClick={exportGstCsv}>📄 Export CSV</button>}
                  </>
                )}
                <button type="button" className="btn btn-danger" onClick={exportGstPdf}>📋 Download PDF Report</button>
              </div>
            </div>

            {/* GST Sub-tab Navigation */}
            <div className="rm-tabs-bar" style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', gap: '0.5rem', overflowX: 'auto', backgroundColor: '#f8fafc', padding: '0.5rem', borderRadius: '8px' }}>
              {[
                { key: 'summary', label: '📊 GST Summary' },
                { key: 'gstr1', label: '📄 GSTR-1 (Sales)' },
                { key: 'b2b', label: '🏢 B2B Invoices' },
                { key: 'b2c', label: '👥 B2C Invoices' },
                { key: 'hsn', label: '📦 HSN Summary' },
                { key: 'salesRegister', label: '🧾 Sales Register' }
              ].map((sub) => (
                <button
                  key={sub.key}
                  type="button"
                  className={`rm-tab-btn ${gstSubTab === sub.key ? 'active' : ''}`}
                  onClick={() => setGstSubTab(sub.key)}
                  style={{
                    padding: '0.5rem 1rem',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: gstSubTab === sub.key ? '#ff9800' : 'transparent',
                    color: gstSubTab === sub.key ? '#fff' : '#64748b',
                  }}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Sub-tab Content Panels */}
            {gstReportsLoading ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>Loading report data...</div>
            ) : (
              <>
                {/* GST SUMMARY PANEL */}
                {gstSubTab === 'summary' && gstSummaryData && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
                      <div className="card" style={{ borderLeft: '4px solid #2563eb', padding: '1.25rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Tax Liability (Sales)</span>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb', marginTop: '0.25rem' }}>
                          {formatCurrency(gstSummaryData.totalLiability)}
                        </div>
                        <small style={{ color: '#64748b', display: 'block', marginTop: '0.25rem' }}>Total GST collected on {gstSummaryData.salesCount} invoices</small>
                      </div>
                      <div className="card" style={{ borderLeft: '4px solid #16a34a', padding: '1.25rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Input Tax Credit (Purchases)</span>
                        <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#16a34a', marginTop: '0.25rem' }}>
                          {formatCurrency(gstSummaryData.totalItc)}
                        </div>
                        <small style={{ color: '#64748b', display: 'block', marginTop: '0.25rem' }}>Total GST paid on {gstSummaryData.purchasesCount} purchase records</small>
                      </div>
                      <div className="card" style={{
                        borderLeft: `4px solid ${gstSummaryData.netGstPayable > 0 ? '#dc2626' : '#10b981'}`,
                        padding: '1.25rem',
                        backgroundColor: '#fff',
                        borderRadius: '12px'
                      }}>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Net GST Payable / Refund</span>
                        <div style={{
                          fontSize: '1.75rem',
                          fontWeight: 800,
                          color: gstSummaryData.netGstPayable > 0 ? '#dc2626' : '#10b981',
                          marginTop: '0.25rem'
                        }}>
                          {formatCurrency(gstSummaryData.netGstPayable)}
                        </div>
                        <small style={{ color: '#64748b', display: 'block', marginTop: '0.25rem' }}>
                          {gstSummaryData.netGstPayable > 0 ? 'Tax due to Government' : 'Tax credit carry-forward available'}
                        </small>
                      </div>
                    </div>

                    <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: '#1e293b' }}>Summary Matrix</h3>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Report Type</th>
                            <th>Count</th>
                            <th style={{ textAlign: 'right' }}>Tax Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Sales (Liability)</td>
                            <td>{gstSummaryData.salesCount} Invoices</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#2563eb' }}>{formatCurrency(gstSummaryData.totalLiability)}</td>
                          </tr>
                          <tr>
                            <td>Purchases (ITC)</td>
                            <td>{gstSummaryData.purchasesCount} Receipts</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: '#16a34a' }}>{formatCurrency(gstSummaryData.totalItc)}</td>
                          </tr>
                          <tr style={{ borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                            <td>Net Due / Credit Balance</td>
                            <td>—</td>
                            <td style={{ textAlign: 'right', color: gstSummaryData.netGstPayable > 0 ? '#dc2626' : '#10b981' }}>
                              {formatCurrency(gstSummaryData.netGstPayable)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* GSTR-1 SALES PANEL */}
                {gstSubTab === 'gstr1' && (
                  <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>GSTR-1 Outward Supplies Report</h3>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>GSTIN</th>
                            <th style={{ textAlign: 'right' }}>Taxable Value</th>
                            <th style={{ textAlign: 'right' }}>CGST</th>
                            <th style={{ textAlign: 'right' }}>SGST</th>
                            <th style={{ textAlign: 'right' }}>IGST</th>
                            <th style={{ textAlign: 'right' }}>Total Tax</th>
                            <th style={{ textAlign: 'right' }}>Invoice Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gstReportRows.map(r => (
                            <tr key={r.id}>
                              <td>{r.invoiceNumber}</td>
                              <td>{formatReportDate(r.date)}</td>
                              <td>{r.customerName}</td>
                              <td style={{ fontFamily: 'monospace' }}>{r.customerGstNumber || '—'}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxableAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.cgstAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.sgstAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.igstAmount)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(r.gstTotal)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(r.grandTotal)}</td>
                            </tr>
                          ))}
                          {gstReportRows.length === 0 && (
                            <tr>
                              <td colSpan="10" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No sales data found for the selected period.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* B2B PANEL */}
                {gstSubTab === 'b2b' && (
                  <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Registered B2B Supplies</h3>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Date</th>
                            <th>Customer</th>
                            <th>GSTIN</th>
                            <th style={{ textAlign: 'right' }}>Taxable Value</th>
                            <th style={{ textAlign: 'right' }}>CGST</th>
                            <th style={{ textAlign: 'right' }}>SGST</th>
                            <th style={{ textAlign: 'right' }}>IGST</th>
                            <th style={{ textAlign: 'right' }}>Invoice Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gstReportRows.map(r => (
                            <tr key={r.id}>
                              <td>{r.invoiceNumber}</td>
                              <td>{formatReportDate(r.date)}</td>
                              <td>{r.customerName}</td>
                              <td style={{ fontFamily: 'monospace' }}>{r.customerGstNumber}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxableAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.cgstAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.sgstAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.igstAmount)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(r.grandTotal)}</td>
                            </tr>
                          ))}
                          {gstReportRows.length === 0 && (
                            <tr>
                              <td colSpan="9" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No B2B sales data found for the selected period.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* B2C PANEL */}
                {gstSubTab === 'b2c' && (
                  <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Consumer & E-Commerce B2C Supplies</h3>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Date</th>
                            <th>Customer Name</th>
                            <th style={{ textAlign: 'right' }}>Taxable Value</th>
                            <th style={{ textAlign: 'right' }}>CGST</th>
                            <th style={{ textAlign: 'right' }}>SGST</th>
                            <th style={{ textAlign: 'right' }}>IGST</th>
                            <th style={{ textAlign: 'right' }}>Invoice Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gstReportRows.map(r => (
                            <tr key={r.id}>
                              <td>{r.invoiceNumber}</td>
                              <td>{formatReportDate(r.date)}</td>
                              <td>{r.customerName}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxableAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.cgstAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.sgstAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.igstAmount)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(r.grandTotal)}</td>
                            </tr>
                          ))}
                          {gstReportRows.length === 0 && (
                            <tr>
                              <td colSpan="8" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No B2C supplies found for the selected period.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* HSN PANEL */}
                {gstSubTab === 'hsn' && (
                  <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>HSN Code / GST Class Summary</h3>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>GST Class</th>
                            <th>Description</th>
                            <th style={{ textAlign: 'center' }}>GST Rate</th>
                            <th style={{ textAlign: 'center' }}>Quantity Sold</th>
                            <th style={{ textAlign: 'right' }}>Taxable Value</th>
                            <th style={{ textAlign: 'right' }}>CGST</th>
                            <th style={{ textAlign: 'right' }}>SGST</th>
                            <th style={{ textAlign: 'right' }}>IGST</th>
                            <th style={{ textAlign: 'right' }}>Total GST Tax</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gstHsnRows.map((r, idx) => (
                            <tr key={idx}>
                              <td><strong>{r.gstClass}</strong></td>
                              <td>{r.description}</td>
                              <td style={{ textAlign: 'center' }}>{r.gstPercent}%</td>
                              <td style={{ textAlign: 'center' }}>{r.qty}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxableAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.cgstAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.sgstAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.igstAmount)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#2563eb' }}>{formatCurrency(r.taxAmount)}</td>
                            </tr>
                          ))}
                          {gstHsnRows.length === 0 && (
                            <tr>
                              <td colSpan="9" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No products supply data found.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* SALES REGISTER PANEL */}
                {gstSubTab === 'salesRegister' && (
                  <div className="card" style={{ padding: '1.5rem', backgroundColor: '#fff', borderRadius: '12px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>GST Sales Register Breakdown</h3>
                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Invoice #</th>
                            <th>Date</th>
                            <th>Customer Name</th>
                            <th>GSTIN</th>
                            <th style={{ textAlign: 'right' }}>Taxable Value</th>
                            <th style={{ textAlign: 'right' }}>CGST</th>
                            <th style={{ textAlign: 'right' }}>SGST</th>
                            <th style={{ textAlign: 'right' }}>IGST</th>
                            <th style={{ textAlign: 'right' }}>Total Tax</th>
                            <th style={{ textAlign: 'right' }}>Shipping Charge</th>
                            <th style={{ textAlign: 'right' }}>Invoice Value</th>
                            <th>Payment</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {gstReportRows.map(r => (
                            <tr key={r.id}>
                              <td>{r.invoiceNumber}</td>
                              <td>{formatReportDate(r.date)}</td>
                              <td>{r.customerName}</td>
                              <td style={{ fontFamily: 'monospace' }}>{r.customerGstNumber || '—'}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.taxableAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.cgstAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.sgstAmount)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.igstAmount)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(r.gstTotal)}</td>
                              <td style={{ textAlign: 'right' }}>{formatCurrency(r.shippingCharge)}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatCurrency(r.grandTotal)}</td>
                              <td>{r.paymentMethod || '—'}</td>
                              <td>
                                <span className={`badge ${r.paymentStatus === 'Paid' ? 'badge-success' : 'badge-warning'}`}>
                                  {r.paymentStatus}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {gstReportRows.length === 0 && (
                            <tr>
                              <td colSpan="13" style={{ textAlign: 'center', color: '#64748b', padding: '2rem' }}>No invoices loaded in Sales Register.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
