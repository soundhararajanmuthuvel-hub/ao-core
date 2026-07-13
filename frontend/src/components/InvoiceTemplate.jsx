import '../styles/invoice-template.css';
import { useCompanyBrand } from '../context/CompanyBrandContext';

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
  const { logoUrl } = useCompanyBrand();
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

  // Determine paper settings
  const paperSize = settings?.paperSize || (settings?.invoiceFormat === 'Thermal' ? 'Thermal 80mm' : 'A4');
  const isThermal = paperSize.startsWith('Thermal');
  
  let containerWidth = '210mm'; // Default A4
  let containerPadding = '8mm';
  let containerFontSize = '13.5px';
  let logoSize = '65px';
  let rowPadding = '1.2mm 1.5mm';
  let spacingUnit = '3mm';
  let cardPadding = '2.5mm 3.5mm';
  let tableFontSize = '11.5px';

  if (paperSize === 'A5') {
    containerWidth = '148mm';
    containerPadding = '4mm'; // Tighten padding
    containerFontSize = '11px'; // Slightly smaller base font
    logoSize = '45px';
    rowPadding = '0.8mm 1.2mm'; // Tighten rows
    spacingUnit = '1.5mm';      // Half the standard vertical spacing
    cardPadding = '2mm 3mm';    // Tighten card paddings
    tableFontSize = '10px';
  } else if (paperSize === 'Thermal 80mm') {
    containerWidth = '80mm';
    containerPadding = '3mm';
    containerFontSize = '11px';
    logoSize = '45px';
    rowPadding = '0.8mm 1.2mm';
    spacingUnit = '1.5mm';
    cardPadding = '2mm 3mm';
    tableFontSize = '10px';
  } else if (paperSize === 'Thermal 58mm') {
    containerWidth = '58mm';
    containerPadding = '2mm';
    containerFontSize = '9.5px';
    logoSize = '40px';
    rowPadding = '0.6mm 1mm';
    spacingUnit = '1mm';
    cardPadding = '1.5mm 2mm';
    tableFontSize = '9.5px';
  }

  const paperSizeStyle = `
    @media print {
      @page {
        size: ${paperSize === 'A4' ? 'A4 portrait' : paperSize === 'A5' ? 'A5 portrait' : paperSize === 'Thermal 80mm' ? '80mm auto' : '58mm auto'};
        margin: ${isThermal ? (paperSize === 'Thermal 80mm' ? '4mm' : '3mm') : '8mm'};
      }
      body {
        margin: 0 !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
    }
  `;

  return (
    <>
      <style>{paperSizeStyle}</style>
      <div 
        id={captureId} 
        className={`invoice-template format-${paperSize.toLowerCase().replace(' ', '-')}`}
        style={{
          width: containerWidth,
        maxWidth: containerWidth,
        padding: containerPadding,
        fontSize: containerFontSize,
        backgroundColor: '#ffffff',
        margin: '0 auto',
        boxSizing: 'border-box'
      }}
    >
      {/* 1. Header Section */}
      <header 
        className="invoice-header-redesign" 
        style={{ 
          display: 'flex', 
          flexDirection: isThermal ? 'column' : 'row',
          justifyContent: isThermal ? 'center' : 'space-between', 
          alignItems: isThermal ? 'center' : 'flex-start', 
          marginBottom: spacingUnit
        }}
      >
        {/* Company Logo */}
        {format !== 'Thermal' && logoUrl && (
          <div 
            className="invoice-logo-container" 
            style={{ 
              width: logoSize, 
              height: logoSize, 
              borderRadius: '50%', 
              backgroundColor: '#ffffff', 
              border: '1px solid #E2E8F0', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              overflow: 'hidden', 
              marginTop: isThermal ? '0' : '0.5mm',
              marginBottom: isThermal ? '1.5mm' : '0'
            }}
          >
            <img 
              src={logoUrl || '/default-logo.png'} 
              alt="Logo" 
              className="invoice-logo-img" 
              style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain' }}
              crossOrigin="anonymous" 
            />
          </div>
        )}

        {/* Company Details */}
        <div style={{ textAlign: isThermal ? 'center' : 'right', flex: 1, marginLeft: isThermal ? '0' : '4mm' }}>
          <h1 style={{ fontSize: isThermal ? '15px' : '20px', fontWeight: 'bold', color: primaryColor, margin: '0 0 0.5mm 0', lineHeight: 1.15 }}>
            {settings?.companyName || 'Amudhasurabiy Organics'}
          </h1>
          <p style={{ margin: '0 0 0.25mm 0', color: '#475569', fontSize: isThermal ? '9.5px' : '10px' }}>{settings?.address}</p>
          <div style={{ display: 'flex', justifyContent: isThermal ? 'center' : 'flex-end', gap: '3px', flexWrap: 'wrap', color: '#475569', fontSize: isThermal ? '9.5px' : '10px', margin: '0 0 0.25mm 0' }}>
            {settings?.phone && <span><strong>Phone:</strong> {settings.phone}</span>}
            {settings?.email && <span>| <strong>Email:</strong> {settings.email}</span>}
          </div>
          {settings?.websiteUrl && <p style={{ margin: '0 0 0.25mm 0', color: '#475569', fontSize: isThermal ? '9.5px' : '10px' }}><strong>Website:</strong> {settings.websiteUrl}</p>}
          {isGstInvoice && companyGst && <p style={{ margin: '0 0 0.25mm 0', color: primaryColor, fontSize: isThermal ? '9.5px' : '10px', fontWeight: 'bold' }}>GSTIN: {companyGst}</p>}
        </div>
      </header>

      {/* Decorative accent divider bar */}
      <div style={{ height: '2px', backgroundColor: primaryColor, margin: `${spacingUnit} 0` }}></div>

      {/* 2. Invoice Title */}
      <div style={{ display: 'flex', justifyContent: isThermal ? 'center' : 'space-between', alignItems: 'center', marginBottom: spacingUnit }}>
        <h2 style={{ fontSize: isThermal ? '13px' : '16px', fontWeight: 'bold', color: primaryColor, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.01em' }}>
          {isGstInvoice ? 'TAX INVOICE' : 'INVOICE'}
        </h2>
      </div>

      {/* 3. Invoice Information Card (Two-column layout) */}
      <div className="invoice-info-grid" style={{ display: 'grid', gridTemplateColumns: isThermal ? '1fr' : '1fr 1fr', gap: '1.5mm', padding: spacingUnit, border: '1px solid #E2E8F0', borderRadius: '6px', marginBottom: spacingUnit, backgroundColor: '#fdfdfd' }}>
        <div>
          <p style={{ margin: '0 0 0.5mm 0' }}><strong>Invoice No:</strong> {sale.invoiceNumber}</p>
          <p style={{ margin: '0 0 0.5mm 0' }}><strong>Date:</strong> {new Date(sale.date).toLocaleDateString('en-IN')}</p>
          <p style={{ margin: 0 }}><strong>Due Date:</strong> {sale.dueDate ? new Date(sale.dueDate).toLocaleDateString('en-IN') : 'N/A'}</p>
        </div>
        <div>
          <p style={{ margin: '0 0 0.5mm 0' }}><strong>Reference:</strong> {sale.reference || 'N/A'}</p>
          {isGstInvoice && sale.placeOfSupply && <p style={{ margin: '0 0 0.5mm 0' }}><strong>Place of Supply:</strong> {sale.placeOfSupply}</p>}
          <p style={{ margin: 0 }}><strong>Payment Terms:</strong> {sale.paymentTerms || 'Due on Receipt'}</p>
        </div>
      </div>

      {/* 4. Customer Billing & Shipping Cards */}
      <div className="invoice-customer-cards" style={{ display: 'grid', gridTemplateColumns: isThermal ? '1fr' : '1fr 1fr', gap: '3mm', marginBottom: spacingUnit }}>
        {/* BILL TO */}
        <div style={{ padding: cardPadding, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
          <h3 style={{ fontSize: '10px', fontWeight: 'bold', color: primaryColor, borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5mm', marginBottom: '1.5mm', textTransform: 'uppercase' }}>BILL TO:</h3>
          <p style={{ margin: '0 0 0.5mm 0', fontWeight: 'bold' }}>{billName}</p>
          {billPhone && <p style={{ margin: '0 0 0.5mm 0', color: '#475569' }}>Phone: {billPhone}</p>}
          <p style={{ margin: '0 0 0.5mm 0', color: '#475569', lineHeight: 1.25 }}>{billAddress}</p>
          {isGstInvoice && billGst && <p style={{ margin: 0, fontWeight: 'bold', color: '#475569' }}>GSTIN: {billGst}</p>}
        </div>

        {/* SHIP TO (Hide on Thermal if duplicate to save roll space) */}
        {(!isThermal || shipAddress !== billAddress || shipName !== billName) && (
          <div style={{ padding: cardPadding, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
            <h3 style={{ fontSize: '10px', fontWeight: 'bold', color: primaryColor, borderBottom: '1px solid #E2E8F0', paddingBottom: '0.5mm', marginBottom: '1.5mm', textTransform: 'uppercase' }}>SHIP TO:</h3>
            <p style={{ margin: '0 0 0.5mm 0', fontWeight: 'bold' }}>{shipName}</p>
            {shipPhone && <p style={{ margin: '0 0 0.5mm 0', color: '#475569' }}>Phone: {shipPhone}</p>}
            <p style={{ margin: '0 0 0.5mm 0', color: '#475569', lineHeight: 1.25 }}>{shipAddress}</p>
            {isGstInvoice && shipGst && <p style={{ margin: 0, fontWeight: 'bold', color: '#475569' }}>GSTIN: {shipGst}</p>}
          </div>
        )}
      </div>

      {/* 5. Product Table */}
      <table className="invoice-redesign-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: spacingUnit, fontSize: tableFontSize }}>
        <thead>
          <tr style={{ backgroundColor: primaryColor, color: '#ffffff', textAlign: 'left' }}>
            <th style={{ padding: rowPadding, width: '20px', fontWeight: 'bold' }}>#</th>
            <th style={{ padding: rowPadding, fontWeight: 'bold' }}>Product Name</th>
            {!isThermal && isGstInvoice && <th style={{ padding: rowPadding, width: '45px', fontWeight: 'bold' }}>HSN</th>}
            <th style={{ padding: rowPadding, textAlign: 'center', width: '30px', fontWeight: 'bold' }}>Qty</th>
            {!isThermal && <th style={{ padding: rowPadding, textAlign: 'center', width: '35px', fontWeight: 'bold' }}>Unit</th>}
            <th style={{ padding: rowPadding, textAlign: 'right', width: '55px', fontWeight: 'bold' }}>Rate</th>
            {!isThermal && <th style={{ padding: rowPadding, textAlign: 'right', width: '50px', fontWeight: 'bold' }}>Discount</th>}
            {!isThermal && isGstInvoice && <th style={{ padding: rowPadding, textAlign: 'center', width: '40px', fontWeight: 'bold' }}>GST %</th>}
            {!isThermal && isGstInvoice && <th style={{ padding: rowPadding, textAlign: 'right', width: '55px', fontWeight: 'bold' }}>Tax Amt</th>}
            <th style={{ padding: rowPadding, textAlign: 'right', width: '65px', fontWeight: 'bold' }}>Amount</th>
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
                <td style={{ padding: rowPadding, verticalAlign: 'top' }}>{idx + 1}</td>
                <td style={{ padding: rowPadding, verticalAlign: 'top', wordBreak: 'break-word' }}>
                  <strong>{item.name}</strong>
                  {item.schemeApplied && item.schemeApplied.trim().toLowerCase() !== 'none' && (
                    <div style={{ fontSize: '8.5px', color: accentColor, fontWeight: 600, marginTop: '0.25mm' }}>
                      Applied: {item.schemeApplied}
                    </div>
                  )}
                </td>
                {!isThermal && isGstInvoice && <td style={{ padding: rowPadding, verticalAlign: 'top' }}>{item.product?.gstClass || '0000'}</td>}
                <td style={{ padding: rowPadding, verticalAlign: 'top', textAlign: 'center' }}>
                  {Number(item.qty).toFixed(0)}
                  {Number(item.freeQty) > 0 && (
                    <div style={{ fontSize: '8.5px', color: accentColor, fontWeight: 'bold' }}>
                      +{Number(item.freeQty).toFixed(0)} Free
                    </div>
                  )}
                </td>
                {!isThermal && <td style={{ padding: rowPadding, verticalAlign: 'top', textAlign: 'center', textTransform: 'uppercase', color: '#64748b', fontSize: '10px' }}>{unit}</td>}
                <td style={{ padding: rowPadding, verticalAlign: 'top', textAlign: 'right' }}>₹{Number(item.unitPrice).toFixed(2)}</td>
                {!isThermal && <td style={{ padding: rowPadding, verticalAlign: 'top', textAlign: 'right', color: discVal > 0 ? '#EF4444' : '#64748b' }}>{discStr}</td>}
                {!isThermal && isGstInvoice && <td style={{ padding: rowPadding, verticalAlign: 'top', textAlign: 'center' }}>{item.gstPercent || 0}%</td>}
                {!isThermal && isGstInvoice && <td style={{ padding: rowPadding, verticalAlign: 'top', textAlign: 'right' }}>₹{taxAmt.toFixed(2)}</td>}
                <td style={{ padding: rowPadding, verticalAlign: 'top', textAlign: 'right', fontWeight: 'bold' }}>₹{Number(item.lineTotal).toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Bottom Layout Container */}
      <div 
        className="invoice-bottom-grid" 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: isThermal ? '1fr' : '1.2fr 1fr', 
          gap: spacingUnit, 
          alignItems: 'start', 
          marginBottom: spacingUnit
        }}
      >
        {/* Left Side: Payment Details, Amount in Words & Notes */}
        <div>
          {/* Amount in Words */}
          <div style={{ padding: cardPadding, backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '6px', marginBottom: spacingUnit }}>
            <p style={{ margin: '0 0 0.5mm 0', fontSize: '8.5px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Amount In Words</p>
            <p style={{ margin: 0, fontSize: '10.5px', fontWeight: 'bold', color: primaryColor }}>
              {convertNumberToWords(sale.grandTotal)}
            </p>
          </div>

          {/* Payment Details Container */}
          {(settings?.bankDetails || upiId) && (
            <div style={{ padding: cardPadding, border: '1px solid #E2E8F0', borderRadius: '6px', backgroundColor: '#ffffff', display: 'flex', gap: '3.5mm', alignItems: 'center' }}>
              {/* UPI QR Code */}
              {qrCodeUrl && (
                <div style={{ textAlign: 'center' }}>
                  <img 
                    src={qrCodeUrl} 
                    alt="UPI QR" 
                    style={{ width: '50px', height: '50px', display: 'block', border: '1px solid #E2E8F0', padding: '0.5mm', borderRadius: '4px' }} 
                  />
                  <span style={{ fontSize: '7px', color: '#64748b', marginTop: '0.5mm', display: 'block', fontWeight: 'bold' }}>Scan to Pay</span>
                </div>
              )}
              
              {/* Bank Account Info */}
              <div style={{ flex: 1, fontSize: '10px', lineHeight: 1.25 }}>
                <p style={{ margin: '0 0 0.5mm 0', fontSize: '8px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase' }}>Payment Details</p>
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
        <div style={{ padding: cardPadding, border: '1px solid #E2E8F0', borderRadius: '6px', backgroundColor: '#F8FAFC' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2mm', fontSize: '10.5px' }}>
            
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
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontStyle: 'italic', fontSize: '10px' }}>
                <span>Round Off:</span>
                <span>{Number(sale.roundOff) > 0 ? `+₹${sale.roundOff}` : `-₹${Math.abs(sale.roundOff)}`}</span>
              </div>
            )}

            {/* Grand Total Highlight */}
            <div 
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: '12.5px', 
                fontWeight: 'bold', 
                backgroundColor: primaryColor, 
                color: '#ffffff', 
                padding: '1.5mm 2.2mm', 
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
        <div style={{ borderTop: '1px solid #E2E8F0', paddingTop: '1.5mm', marginBottom: spacingUnit, fontSize: '9px' }}>
          <p style={{ margin: '0 0 0.5mm 0', fontWeight: 'bold', color: primaryColor, textTransform: 'uppercase' }}>Terms & Conditions:</p>
          <p style={{ margin: 0, color: '#64748b', lineHeight: 1.35 }}>{settings.termsAndConditions}</p>
        </div>
      )}

      {/* Decorative divider before footer */}
      <div style={{ borderTop: '1px dashed #CBD5E1', margin: '1.5mm 0' }}></div>

      {/* 7. Footer */}
      <footer style={{ textAlign: 'center', fontSize: '9.5px', color: '#64748b', lineHeight: 1.35 }}>
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
    </>
  );
}
