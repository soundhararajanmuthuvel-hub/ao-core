import '../styles/invoice-template.css';
import { getActiveLogoUrl } from '../utils/url';

// Indian Rupees Number-to-Words conversion helper
function convertNumberToWords(amount) {
  const num = Math.floor(amount);
  if (num === 0) return 'Rupees Zero Only';

  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function g(n) {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? '-' + a[digit].trim() : '') + ' ';
  }

  let words = '';
  // Crores
  const crores = Math.floor(num / 10000000);
  if (crores > 0) {
    words += g(crores) + 'Crore ';
  }
  // Lakhs
  const lakhs = Math.floor((num % 10000000) / 100000);
  if (lakhs > 0) {
    words += g(lakhs) + 'Lakh ';
  }
  // Thousands
  const thousands = Math.floor((num % 100000) / 1000);
  if (thousands > 0) {
    words += g(thousands) + 'Thousand ';
  }
  // Hundreds
  const hundreds = Math.floor((num % 1000) / 100);
  if (hundreds > 0) {
    words += g(hundreds) + 'Hundred ';
  }
  // Tens and Ones
  const tens = num % 100;
  if (tens > 0) {
    if (words !== '') words += 'and ';
    words += g(tens);
  }

  // Handle Paise
  const paise = Math.round((amount - num) * 100);
  let paiseWords = '';
  if (paise > 0) {
    paiseWords = `and ${g(paise)}Paise`;
  }

  return `Rupees ${words.trim()} ${paiseWords ? paiseWords : ''} Only`.replace(/\s+/g, ' ');
}

export default function InvoiceTemplate({ sale, settings, captureId = 'invoice-capture' }) {
  if (!sale) return null;

  // Determine GST SPLIT
  const customerGst = sale.customer?.gstNumber || sale.customerGSTIN || '';
  const companyGst = settings?.gstNumber || settings?.gstDetails || '';
  const isGstInvoice = sale.invoiceType ? (sale.invoiceType === 'GST') : !!customerGst;
  const isIntrastate = customerGst && companyGst && customerGst.substring(0, 2) === companyGst.substring(0, 2);

  const totalGst = Number(sale.gstTotal || sale.totalGST || 0);
  let cgst = 0, sgst = 0, igst = 0;
  if (totalGst > 0) {
    if (isIntrastate || !customerGst) {
      cgst = totalGst / 2;
      sgst = totalGst / 2;
    } else {
      igst = totalGst;
    }
  }

  // Format and theme overrides
  const format = settings?.invoiceFormat || 'Standard';
  const primaryColor = '#5A2D0C'; // Premium Dark Brown
  const accentColor = '#F59E0B'; // Golden Orange

  // Billing and Shipping addresses
  const billName = sale.customer?.name || 'Walk-in Customer';
  const billPhone = sale.customer?.phone || '';
  const billAddress = sale.customer?.address || 'N/A';
  const billGst = customerGst;

  const shipName = sale.shippingName || billName;
  const shipPhone = sale.shippingPhone || billPhone;
  const shipAddress = sale.shippingAddress || billAddress;
  const shipGst = customerGst;

  // UPI QR Code generation
  const upiId = settings?.upiId;
  const payeeName = settings?.payeeName || settings?.companyName || 'AO Core';
  const grandTotalStr = Number(sale.grandTotal).toFixed(2);
  const upiLink = upiId ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${grandTotalStr}&cu=INR` : null;
  const qrCodeUrl = upiLink ? `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(upiLink)}` : null;

  return (
    <div 
      id={captureId} 
      className={`invoice-template format-${format.toLowerCase()}`}
      style={{
        width: format === 'Thermal' ? '80mm' : '148mm', // Standard A5 width on screen
        padding: format === 'Thermal' ? '0.5rem' : '6mm', // Tighten padding
        fontSize: format === 'Thermal' ? '11px' : '12.5px', // Slightly smaller text
      }}
    >
      {/* 1. Header Section */}
      <header className="invoice-header-redesign" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3mm' }}>
        {/* Company Logo (Left) */}
        {format !== 'Thermal' && (
          <div className="invoice-logo-container" style={{ width: '65px', height: '65px', borderRadius: '50%', backgroundColor: '#ffffff', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginTop: '1mm' }}>
            <img 
              src={getActiveLogoUrl(settings) || '/default-logo.png'} 
              alt="Logo" 
              className="invoice-logo-img" 
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = '/default-logo.png';
              }}
              style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }}
              crossOrigin="anonymous" 
            />
          </div>
        )}

        {/* Company Details (Right) */}
        <div style={{ textAlign: 'right', flex: 1, marginLeft: '4mm' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 'bold', color: primaryColor, margin: '0 0 0.5mm 0', lineHeight: 1.15 }}>
            {settings?.companyName || 'Amudhasurabiy Organics'}
          </h1>
          <p style={{ margin: '0 0 0.25mm 0', color: '#475569', fontSize: '10.5px' }}>{settings?.address}</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '3px', flexWrap: 'wrap', color: '#475569', fontSize: '10.5px', margin: '0 0 0.25mm 0' }}>
            {settings?.phone && <span><strong>Phone:</strong> {settings.phone}</span>}
            {settings?.email && <span>| <strong>Email:</strong> {settings.email}</span>}
          </div>
          {settings?.websiteUrl && <p style={{ margin: '0 0 0.25mm 0', color: '#475569', fontSize: '10.5px' }}><strong>Website:</strong> {settings.websiteUrl}</p>}
          {isGstInvoice && companyGst && <p style={{ margin: '0 0 0.25mm 0', color: primaryColor, fontSize: '10.5px', fontWeight: 'bold' }}>GSTIN: {companyGst}</p>}
        </div>
      </header>

      {/* Decorative accent divider bar */}
      <div style={{ height: '2px', backgroundColor: primaryColor, margin: '2mm 0' }}></div>

      {/* 2. Invoice Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2mm' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: primaryColor, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
          {isGstInvoice ? 'TAX INVOICE' : 'INVOICE'}
        </h2>
      </div>

      {/* 3. Invoice Information Card (Two-column layout) */}
      <div className="invoice-info-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2mm', padding: '2mm 2.5mm', border: '1px solid #E2E8F0', borderRadius: '6px', marginBottom: '3.5mm', backgroundColor: '#fdfdfd' }}>
        <div>
          <p style={{ margin: '0 0 0.5mm 0' }}><strong>Invoice Number:</strong> {sale.invoiceNumber}</p>
          <p style={{ margin: '0 0 0.5mm 0' }}><strong>Invoice Date:</strong> {new Date(sale.date).toLocaleDateString('en-IN')}</p>
          <p style={{ margin: 0 }}><strong>Due Date:</strong> {sale.dueDate ? new Date(sale.dueDate).toLocaleDateString('en-IN') : 'N/A'}</p>
        </div>
        <div>
          <p style={{ margin: '0 0 0.5mm 0' }}><strong>Reference:</strong> {sale.reference || 'N/A'}</p>
          {isGstInvoice && sale.placeOfSupply && <p style={{ margin: '0 0 0.5mm 0' }}><strong>Place of Supply:</strong> {sale.placeOfSupply}</p>}
          <p style={{ margin: 0 }}><strong>Payment Terms:</strong> {sale.paymentTerms || 'Due on Receipt'}</p>
        </div>
      </div>

      {/* 4. Customer Billing & Shipping Cards */}
      <div className="invoice-customer-cards" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3mm', marginBottom: '4.5mm' }}>
        {/* BILL TO */}
        <div style={{ padding: '2.5mm 3.5mm', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: primaryColor, borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5mm', marginBottom: '1.5mm', textTransform: 'uppercase' }}>BILL TO:</h3>
          <p style={{ margin: '0 0 0.5mm 0', fontWeight: 'bold' }}>{billName}</p>
          {billPhone && <p style={{ margin: '0 0 0.5mm 0', color: '#475569' }}>Phone: {billPhone}</p>}
          <p style={{ margin: '0 0 0.5mm 0', color: '#475569', lineHeight: 1.25 }}>{billAddress}</p>
          {isGstInvoice && billGst && <p style={{ margin: 0, fontWeight: 'bold', color: '#475569' }}>GSTIN: {billGst}</p>}
        </div>

        {/* SHIP TO */}
        <div style={{ padding: '2.5mm 3.5mm', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: primaryColor, borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5mm', marginBottom: '1.5mm', textTransform: 'uppercase' }}>SHIP TO:</h3>
          <p style={{ margin: '0 0 0.5mm 0', fontWeight: 'bold' }}>{shipName}</p>
          {shipPhone && <p style={{ margin: '0 0 0.5mm 0', color: '#475569' }}>Phone: {shipPhone}</p>}
          <p style={{ margin: '0 0 0.5mm 0', color: '#475569', lineHeight: 1.25 }}>{shipAddress}</p>
          {isGstInvoice && shipGst && <p style={{ margin: 0, fontWeight: 'bold', color: '#475569' }}>GSTIN: {shipGst}</p>}
        </div>
      </div>

      {/* 5. Product Table */}
      <table className="invoice-redesign-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4mm', fontSize: '11.5px' }}>
        <thead>
          <tr style={{ backgroundColor: primaryColor, color: '#ffffff', textAlign: 'left' }}>
            <th style={{ padding: '1.2mm 1.5mm', width: '25px', fontWeight: 'bold' }}>#</th>
            <th style={{ padding: '1.2mm 1.5mm', fontWeight: 'bold' }}>Product Name</th>
            {isGstInvoice && <th style={{ padding: '1.2mm 1.5mm', width: '50px', fontWeight: 'bold' }}>HSN</th>}
            <th style={{ padding: '1.2mm 1.5mm', textAlign: 'center', width: '35px', fontWeight: 'bold' }}>Qty</th>
            <th style={{ padding: '1.2mm 1.5mm', textAlign: 'center', width: '35px', fontWeight: 'bold' }}>Unit</th>
            <th style={{ padding: '1.2mm 1.5mm', textAlign: 'right', width: '65px', fontWeight: 'bold' }}>Rate</th>
            <th style={{ padding: '1.2mm 1.5mm', textAlign: 'right', width: '55px', fontWeight: 'bold' }}>Discount</th>
            {isGstInvoice && <th style={{ padding: '1.2mm 1.5mm', textAlign: 'center', width: '45px', fontWeight: 'bold' }}>GST %</th>}
            {isGstInvoice && <th style={{ padding: '1.2mm 1.5mm', textAlign: 'right', width: '65px', fontWeight: 'bold' }}>Tax Amt</th>}
            <th style={{ padding: '1.2mm 1.5mm', textAlign: 'right', width: '75px', fontWeight: 'bold' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {sale.items.map((item, idx) => {
            const discVal = Number(item.discount || 0);
            const discStr = discVal > 0 ? `₹${discVal.toFixed(2)}` : '0.00';
            
            // Derive unit
            const unit = item.product?.unit || item.unit || 'pcs';

            // Calculate tax amount per item
            let taxAmt = 0;
            if (isGstInvoice) {
              const itemTotal = Number(item.lineTotal || 0);
              const gstPct = Number(item.gstPercent || 0);
              if (settings?.defaultGstMode === 'inclusive') {
                taxAmt = itemTotal - (itemTotal / (1 + gstPct / 100));
              } else {
                taxAmt = itemTotal * (gstPct / 100);
              }
            }

            return (
              <tr 
                key={idx} 
                className="invoice-redesign-tr"
                style={{ 
                  backgroundColor: idx % 2 === 0 ? '#ffffff' : '#F9F6F2',
                  borderBottom: '1px solid #E2E8F0' 
                }}
              >
                <td style={{ padding: '1.2mm 1.5mm', verticalAlign: 'top' }}>{idx + 1}</td>
                <td style={{ padding: '1.2mm 1.5mm', verticalAlign: 'top', wordBreak: 'break-word' }}>
                  <strong>{item.name}</strong>
                  {item.schemeApplied && (
                    <div style={{ fontSize: '9px', color: accentColor, fontWeight: 600, marginTop: '0.25mm' }}>
                      Applied: {item.schemeApplied}
                    </div>
                  )}
                </td>
                {isGstInvoice && <td style={{ padding: '1.2mm 1.5mm', verticalAlign: 'top' }}>{item.product?.gstClass || '0000'}</td>}
                <td style={{ padding: '1.2mm 1.5mm', verticalAlign: 'top', textAlign: 'center' }}>
                  {Number(item.qty).toFixed(0)}
                  {Number(item.freeQty) > 0 && (
                    <div style={{ fontSize: '8.5px', color: accentColor, fontWeight: 'bold' }}>
                      +{Number(item.freeQty).toFixed(0)} Free
                    </div>
                  )}
                </td>
                <td style={{ padding: '1.2mm 1.5mm', verticalAlign: 'top', textAlign: 'center', textTransform: 'uppercase', color: '#64748b', fontSize: '10.5px' }}>{unit}</td>
                <td style={{ padding: '1.2mm 1.5mm', verticalAlign: 'top', textAlign: 'right' }}>₹{Number(item.unitPrice).toFixed(2)}</td>
                <td style={{ padding: '1.2mm 1.5mm', verticalAlign: 'top', textAlign: 'right', color: discVal > 0 ? '#EF4444' : '#64748b' }}>{discStr}</td>
                {isGstInvoice && <td style={{ padding: '1.2mm 1.5mm', verticalAlign: 'top', textAlign: 'center' }}>{item.gstPercent || 0}%</td>}
                {isGstInvoice && <td style={{ padding: '1.2mm 1.5mm', verticalAlign: 'top', textAlign: 'right' }}>₹{taxAmt.toFixed(2)}</td>}
                <td style={{ padding: '1.2mm 1.5mm', verticalAlign: 'top', textAlign: 'right', fontWeight: 'bold' }}>₹{Number(item.lineTotal).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Bottom Layout Container */}
      <div className="invoice-bottom-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '4mm', alignItems: 'start', marginBottom: '4mm' }}>
        
        {/* Left Side: Payment Details, Amount in Words & Notes */}
        <div>
          {/* Amount in Words */}
          <div style={{ padding: '1.5mm 2.5mm', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', marginBottom: '3mm' }}>
            <p style={{ margin: '0 0 0.5mm 0', fontSize: '9px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Amount In Words</p>
            <p style={{ margin: 0, fontSize: '11.5px', fontWeight: 'bold', color: primaryColor }}>
              {convertNumberToWords(sale.grandTotal)}
            </p>
          </div>

          {/* Payment Details Container */}
          {(settings?.bankDetails || upiId) && (
            <div style={{ padding: '2.5mm', border: '1px solid #E2E8F0', borderRadius: '6px', backgroundColor: '#ffffff', display: 'flex', gap: '3mm', alignItems: 'center' }}>
              {/* UPI QR Code */}
              {qrCodeUrl && (
                <div style={{ textAlign: 'center' }}>
                  <img 
                    src={qrCodeUrl} 
                    alt="UPI QR" 
                    style={{ width: '60px', height: '60px', display: 'block', border: '1px solid #E2E8F0', padding: '0.5mm', borderRadius: '4px' }} 
                  />
                  <span style={{ fontSize: '7.5px', color: '#64748b', marginTop: '0.5mm', display: 'block', fontWeight: 'bold' }}>Scan to Pay</span>
                </div>
              )}
              
              {/* Bank Account Info */}
              <div style={{ flex: 1, fontSize: '10.5px', lineHeight: 1.3 }}>
                <p style={{ margin: '0 0 0.5mm 0', fontSize: '8.5px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Payment Details</p>
                {upiId && <p style={{ margin: '0 0 0.25mm 0' }}><strong>UPI ID:</strong> {upiId}</p>}
                {settings?.bankDetails && (
                  <p style={{ margin: 0, whiteSpace: 'pre-line', color: '#475569' }}>
                    {settings.bankDetails}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Floating Totals Card */}
        <div style={{ padding: '3mm', border: '1px solid #E2E8F0', borderRadius: '6px', backgroundColor: '#F8FAFC' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5mm', fontSize: '11.5px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Subtotal:</span>
              <span>₹{Number(sale.subtotal).toFixed(2)}</span>
            </div>

            {Number(sale.discount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#EF4444' }}>
                <span>Discount:</span>
                <span>-₹{Number(sale.discount).toFixed(2)}</span>
              </div>
            )}

            {isGstInvoice && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Taxable Amount:</span>
                <span>₹{Number(sale.taxableAmount || (Number(sale.subtotal) - Number(sale.discount))).toFixed(2)}</span>
              </div>
            )}

            {isGstInvoice && (
              <>
                {cgst > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>CGST:</span>
                    <span>₹{cgst.toFixed(2)}</span>
                  </div>
                )}
                {sgst > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>SGST:</span>
                    <span>₹{sgst.toFixed(2)}</span>
                  </div>
                )}
                {igst > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>IGST:</span>
                    <span>₹{igst.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}

            {Number(sale.shippingCharge || 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                <span>Shipping Charge:</span>
                <span>₹{Number(sale.shippingCharge).toFixed(2)}</span>
              </div>
            )}

            {Number(sale.roundOff || 0) !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontStyle: 'italic', fontSize: '10.5px' }}>
                <span>Round Off:</span>
                <span>{Number(sale.roundOff) > 0 ? `+₹${sale.roundOff}` : `-₹${Math.abs(sale.roundOff)}`}</span>
              </div>
            )}

            {/* Grand Total Highlight */}
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '14px', 
                fontWeight: 'bold', 
                backgroundColor: primaryColor, 
                color: '#ffffff', 
                padding: '2mm 3mm', 
                borderRadius: '6px', 
                marginTop: '1mm' 
              }}
            >
              <span>Grand Total:</span>
              <span>₹{Number(sale.grandTotal).toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>

      {/* 6. Terms and Notes */}
      {settings?.termsAndConditions && (
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '2mm', marginBottom: '3mm', fontSize: '10px' }}>
          <p style={{ margin: '0 0 0.5mm 0', fontWeight: 'bold', color: primaryColor, textTransform: 'uppercase' }}>Terms & Conditions:</p>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.3 }}>{settings.termsAndConditions}</p>
        </div>
      )}

      {/* Decorative divider before footer */}
      <div style={{ borderTop: '1px dashed #CBD5E1', margin: '2mm 0' }}></div>

      {/* 7. Footer */}
      <footer style={{ textAlign: 'center', fontSize: '10.5px', color: '#64748b', lineHeight: 1.35 }}>
        <p style={{ margin: '0 0 0.25mm 0', fontWeight: 'bold' }}>Thank you for your purchase.</p>
        <p style={{ margin: 0 }}>
          This invoice was generated by <strong>{settings?.companyName || 'Amudhasurabiy Organics'}</strong>.
        </p>
        {settings?.websiteUrl && (
          <p style={{ margin: '0.25mm 0 0 0' }}>
            Visit: <a href={`http://${settings.websiteUrl}`} target="_blank" rel="noopener noreferrer" style={{ color: primaryColor, textDecoration: 'none', fontWeight: 'bold' }}>{settings.websiteUrl}</a>
          </p>
        )}
      </footer>
    </div>
  );
}
