import '../styles/invoice-template.css';
import { resolveAssetUrl, getActiveLogoUrl } from '../utils/url';

export default function InvoiceTemplate({ sale, settings, captureId = 'invoice-capture' }) {
  if (!sale) return null;

  // Determine GST Split: Intra-state (CGST + SGST) vs Inter-state (IGST)
  const customerGst = sale.customer?.gstNumber || '';
  const companyGst = settings?.gstDetails || '';
  // Check if first 2 digits (state code) of GSTIN match
  const isIntrastate = customerGst && companyGst && customerGst.substring(0, 2) === companyGst.substring(0, 2);

  const totalGst = Number(sale.gstTotal || 0);
  let cgst = 0, sgst = 0, igst = 0;
  if (totalGst > 0) {
    if (isIntrastate || !customerGst) { // default to local if no GSTIN provided
      cgst = totalGst / 2;
      sgst = totalGst / 2;
    } else {
      igst = totalGst;
    }
  }

  // Formatting configurations
  const format = settings?.invoiceFormat || 'Standard';
  const theme = settings?.invoiceTheme || 'default';
  const primaryColor = settings?.brandColor || '#2563eb';

  return (
    <div 
      id={captureId} 
      className={`invoice-template format-${format.toLowerCase()} theme-${theme}`}
      style={{
        width: format === 'Thermal' ? '80mm' : '100%',
        padding: format === 'Thermal' ? '0.5rem' : '1.5rem',
        fontSize: format === 'Thermal' ? '11px' : '14px',
        lineHeight: 1.4,
      }}
    >
      <header className="invoice-template-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        {(settings?.logo || settings?.logoUrl) && format !== 'Thermal' && (
          <img 
            src={getActiveLogoUrl(settings)} 
            alt="" 
            className="invoice-logo" 
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/favicon.png';
            }}
            style={{ maxHeight: '60px', objectFit: 'contain' }} 
            crossOrigin="anonymous" 
          />
        )}
        <div style={{ textAlign: format === 'Thermal' ? 'center' : 'right', width: format === 'Thermal' ? '100%' : 'auto' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: primaryColor, margin: '0 0 0.25rem 0' }}>
            {settings?.companyName || 'AO Core'}
          </h1>
          <p style={{ margin: '0 0 0.15rem 0', color: '#64748b' }}>{settings?.address}</p>
          {settings?.gstDetails && <p style={{ margin: '0 0 0.15rem 0', color: '#64748b' }}>GSTIN: {settings.gstDetails}</p>}
          {settings?.phone && <p style={{ margin: 0, color: '#64748b' }}>Phone: {settings.phone}</p>}
        </div>
      </header>
      
      <hr style={{ border: 'none', borderTop: `1px solid ${primaryColor}22`, margin: '0.75rem 0' }} />

      <div className="invoice-template-meta" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div><strong>Invoice No:</strong> {sale.invoiceNumber}</div>
        <div><strong>Date:</strong> {new Date(sale.date).toLocaleDateString('en-IN')}</div>
      </div>

      <div className="invoice-template-customer" style={{ marginBottom: '1rem', backgroundColor: '#f8fafc', padding: '0.75rem', borderRadius: '8px' }}>
        <p style={{ margin: '0 0 0.25rem 0' }}><strong>Bill To:</strong> {sale.customer?.name}</p>
        <p style={{ margin: '0 0 0.25rem 0', color: '#475569' }}>Phone: {sale.customer?.phone} {sale.customer?.email && `| Email: ${sale.customer.email}`}</p>
        <p style={{ margin: '0 0 0.25rem 0', color: '#475569' }}>{sale.customer?.address}</p>
        {sale.customer?.gstNumber && <p style={{ margin: 0, color: '#475569' }}>GSTIN: {sale.customer.gstNumber}</p>}
      </div>

      <table className="invoice-template-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${primaryColor}`, textAlign: 'left' }}>
            <th style={{ padding: '0.4rem 0.25rem' }}>#</th>
            <th style={{ padding: '0.4rem 0.25rem' }}>Item</th>
            <th style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>Qty</th>
            <th style={{ padding: '0.4rem 0.25rem', textAlign: 'right' }}>Rate</th>
            <th style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>GST</th>
            <th style={{ padding: '0.4rem 0.25rem', textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '0.4rem 0.25rem' }}>{idx + 1}</td>
              <td style={{ padding: '0.4rem 0.25rem' }}>
                <div><strong>{item.name}</strong></div>
                {item.schemeApplied && (
                  <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>
                    Applied: {item.schemeApplied}
                  </div>
                )}
              </td>
              <td style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>
                {Number(item.qty).toFixed(0)}
                {Number(item.freeQty) > 0 && (
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b', marginLeft: '0.25rem' }}>
                    (+{Number(item.freeQty).toFixed(0)} Free)
                  </span>
                )}
              </td>
              <td style={{ padding: '0.4rem 0.25rem', textAlign: 'right' }}>₹{Number(item.unitPrice).toFixed(2)}</td>
              <td style={{ padding: '0.4rem 0.25rem', textAlign: 'center' }}>{item.gstPercent || 0}%</td>
              <td style={{ padding: '0.4rem 0.25rem', textAlign: 'right' }}>₹{Number(item.lineTotal).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-template-totals" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginTop: '1rem' }}>
        <div style={{ width: format === 'Thermal' ? '100%' : '250px', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.9rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Taxable Value:</span>
            <span>₹{Number(sale.subtotal).toFixed(2)}</span>
          </div>
          
          {cgst > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CGST:</span>
              <span>₹{cgst.toFixed(2)}</span>
            </div>
          )}
          {sgst > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>SGST:</span>
              <span>₹{sgst.toFixed(2)}</span>
            </div>
          )}
          {igst > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>IGST:</span>
              <span>₹{igst.toFixed(2)}</span>
            </div>
          )}

          {Number(sale.shippingCharge) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Shipping Charge:</span>
              <span>₹{Number(sale.shippingCharge).toFixed(2)}</span>
            </div>
          )}
          {Number(sale.packingCharge) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Packing Charge:</span>
              <span>₹{Number(sale.packingCharge).toFixed(2)}</span>
            </div>
          )}
          {Number(sale.handlingCharge) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Handling Charge:</span>
              <span>₹{Number(sale.handlingCharge).toFixed(2)}</span>
            </div>
          )}
          {Number(sale.courierCharge) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Courier Charge:</span>
              <span>₹{Number(sale.courierCharge).toFixed(2)}</span>
            </div>
          )}
          {Number(sale.otherCharge) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Other Charge:</span>
              <span>₹{Number(sale.otherCharge).toFixed(2)}</span>
            </div>
          )}

          {Number(sale.discount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
              <span>Discount:</span>
              <span>-₹{Number(sale.discount).toFixed(2)}</span>
            </div>
          )}

          {Number(sale.roundOff) !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontStyle: 'italic', fontSize: '0.8rem' }}>
              <span>Round Off:</span>
              <span>{Number(sale.roundOff) > 0 ? `+₹${sale.roundOff}` : `-₹${Math.abs(sale.roundOff)}`}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800, borderTop: `1px solid ${primaryColor}`, paddingTop: '0.4rem', marginTop: '0.2rem', color: primaryColor }}>
            <span>Grand Total:</span>
            <span>₹{Number(sale.grandTotal).toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748b' }}>
        <p style={{ margin: '0 0 0.25rem 0' }}>Payment Mode: <strong style={{ textTransform: 'uppercase' }}>{sale.paymentMethod}</strong> — Status: <strong style={{ textTransform: 'uppercase' }}>{String(sale.paymentStatus).toLowerCase() === 'partial' ? 'PARTIALLY PAID' : String(sale.paymentStatus).toUpperCase()}</strong></p>
        {sale.gstBillingMode && <p style={{ margin: '0 0 0.5rem 0' }}>Tax Invoicing: GST {sale.gstBillingMode.toUpperCase()}</p>}
        <p className="invoice-footer" style={{ margin: 0, fontWeight: 600 }}>Thank you for your business!</p>
      </div>
    </div>
  );
}
