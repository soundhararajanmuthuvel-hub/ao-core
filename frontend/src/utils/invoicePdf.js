import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getActiveLogoUrl } from './url';

// Helper to convert hex brand color to RGB for jsPDF
function hexToRgb(hex) {
  const defaultRgb = { r: 90, g: 45, b: 12 }; // Default dark brown #5A2D0C
  if (!hex) return defaultRgb;
  const cleanHex = hex.replace('#', '');
  if (cleanHex.length !== 6 && cleanHex.length !== 3) return defaultRgb;
  
  let h = cleanHex;
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  }
  
  const num = parseInt(h, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

// Helper to load image asynchronously
const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
};

// Indian Rupees Number-to-Words helper
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

  const paise = Math.round((amount - num) * 100);
  let paiseWords = '';
  if (paise > 0) {
    paiseWords = `and ${g(paise)}Paise`;
  }

  return `Rupees ${words.trim()} ${paiseWords ? paiseWords : ''} Only`.replace(/\s+/g, ' ');
}

// Core document builder to build premium multi-format invoice
export async function buildInvoicePdfDoc(sale, settings) {
  // Determine layout settings from Settings
  const paperSize = settings?.paperSize || (settings?.invoiceFormat === 'Thermal' ? 'Thermal 80mm' : 'A4');
  const isThermal = paperSize.startsWith('Thermal');
  
  let pageWidth = 210; // Default A4 Width
  let pageHeight = 297; // Default A4 Height
  let margin = 8;       // Top, Bottom, Left, Right margins (8mm standard)
  let logoSize = 12;
  let companyNameSize = 13.5;
  let fontSize = 7.5;
  let textScale = 1.0;

  if (paperSize === 'A5') {
    pageWidth = 148;
    pageHeight = 210;
    margin = 8;
    logoSize = 9;
    companyNameSize = 11;
    fontSize = 7;
    textScale = 0.9;
  } else if (paperSize === 'Thermal 80mm') {
    pageWidth = 80;
    pageHeight = 220; // Long slip height
    margin = 4;
    logoSize = 8;
    companyNameSize = 10;
    fontSize = 6.5;
    textScale = 0.8;
  } else if (paperSize === 'Thermal 58mm') {
    pageWidth = 58;
    pageHeight = 180; // Long slip height
    margin = 3;
    logoSize = 7;
    companyNameSize = 9;
    fontSize = 6;
    textScale = 0.7;
  }

  const startX = margin;
  const endX = pageWidth - margin;
  const contentWidth = pageWidth - (margin * 2);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight],
  });

  const primaryRgb = hexToRgb('#5A2D0C'); // Primary Dark Brown
  const accentRgb = hexToRgb('#F59E0B');  // Golden Orange

  // Load Company Logo
  let logoLoaded = false;
  let logoImg = null;
  if (settings?.logo || settings?.logoUrl) {
    try {
      let logoUrl = null;
      try {
        const cached = localStorage.getItem('cached_brand_data');
        if (cached) {
          logoUrl = JSON.parse(cached).logoUrl;
        }
      } catch (_) {}
      if (!logoUrl) {
        logoUrl = getActiveLogoUrl(settings);
      }
      logoImg = await loadImage(logoUrl);
      logoLoaded = true;
    } catch (err) {
      console.error('Failed to load active logo, using default placeholder:', err);
      try {
        logoImg = await loadImage('/default-logo.png');
        logoLoaded = true;
      } catch (e) {
        console.error('Default logo placeholder also failed:', e);
      }
    }
  }

  // 1. Company Header Section
  let companyY = 10;
  
  if (isThermal) {
    // Centered Thermal Header
    if (logoLoaded && logoImg) {
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(255, 255, 255);
      const logoCenterX = pageWidth / 2;
      doc.circle(logoCenterX, companyY + 4, logoSize / 2 + 1, 'FD');
      doc.addImage(logoImg, 'PNG', logoCenterX - (logoSize / 2), companyY + 4 - (logoSize / 2), logoSize, logoSize);
      companyY += logoSize + 4;
    }
    
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(companyNameSize);
    doc.text(settings?.companyName || 'Amudhasurabiy Organics', pageWidth / 2, companyY, { align: 'center' });

    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    
    let addrY = companyY + 3.5;
    if (settings?.address) {
      const splitAddr = doc.splitTextToSize(settings.address, contentWidth);
      doc.text(splitAddr, pageWidth / 2, addrY, { align: 'center' });
      addrY += (splitAddr.length * 2.5);
    }
    
    let detailsLine = '';
    if (settings?.phone) detailsLine += `Phone: ${settings.phone}`;
    if (settings?.email) detailsLine += ` | Email: ${settings.email}`;
    if (detailsLine) {
      doc.text(detailsLine, pageWidth / 2, addrY, { align: 'center' });
      addrY += 2.8;
    }
    
    if (settings?.websiteUrl) {
      doc.text(`Website: ${settings.websiteUrl}`, pageWidth / 2, addrY, { align: 'center' });
      addrY += 2.8;
    }

    const customerGst = sale.customer?.gstNumber || sale.customerGSTIN || '';
    const companyGst = settings?.gstNumber || settings?.gstDetails || '';
    const isGstInvoice = sale.invoiceType ? (sale.invoiceType === 'GST') : !!customerGst;
    if (isGstInvoice && companyGst) {
      doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.setFont('helvetica', 'bold');
      doc.text(`GSTIN: ${companyGst}`, pageWidth / 2, addrY, { align: 'center' });
      addrY += 3.2;
    }
    companyY = addrY;
  } else {
    // Standard A4/A5 Header (Left Logo, Right Text)
    if (logoLoaded && logoImg) {
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(255, 255, 255);
      doc.circle(startX + logoSize / 2 + 1, companyY + logoSize / 2 + 1, logoSize / 2 + 1.5, 'FD');
      doc.addImage(logoImg, 'PNG', startX + 1, companyY + 1, logoSize, logoSize);
    }

    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(companyNameSize);
    doc.text(settings?.companyName || 'Amudhasurabiy Organics', endX, companyY, { align: 'right' });

    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    
    let addrY = companyY + 4;
    if (settings?.address) {
      const splitAddr = doc.splitTextToSize(settings.address, contentWidth - 40);
      doc.text(splitAddr, endX, addrY, { align: 'right' });
      addrY += (splitAddr.length * 2.8);
    }
    
    let contactLine = '';
    if (settings?.phone) contactLine += `Phone: ${settings.phone} `;
    if (settings?.email) contactLine += `| Email: ${settings.email}`;
    if (contactLine) {
      doc.text(contactLine, endX, addrY, { align: 'right' });
      addrY += 2.8;
    }
    
    if (settings?.websiteUrl) {
      doc.text(`Website: ${settings.websiteUrl}`, endX, addrY, { align: 'right' });
      addrY += 2.8;
    }

    const customerGst = sale.customer?.gstNumber || sale.customerGSTIN || '';
    const companyGst = settings?.gstNumber || settings?.gstDetails || '';
    const isGstInvoice = sale.invoiceType ? (sale.invoiceType === 'GST') : !!customerGst;
    if (isGstInvoice && companyGst) {
      doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.setFont('helvetica', 'bold');
      doc.text(`GSTIN: ${companyGst}`, endX, addrY, { align: 'right' });
      addrY += 3.2;
    }
    companyY = addrY;
  }

  // Accent divider line
  const dividerY = Math.max(isThermal ? 16 : 22, companyY + 1);
  doc.setDrawColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setLineWidth(0.5);
  doc.line(startX, dividerY, endX, dividerY);

  // 2. Invoice Title
  const titleY = dividerY + (isThermal ? 3.5 : 4.5);
  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(isThermal ? 9.5 : 11);
  doc.text(sale.customer?.gstNumber || sale.customerGSTIN || sale.invoiceType === 'GST' ? 'TAX INVOICE' : 'INVOICE', isThermal ? pageWidth / 2 : startX, titleY, {
    align: isThermal ? 'center' : 'left'
  });

  // 3. Invoice Metadata Card (2 columns for A4/A5, stacked for Thermal)
  const metaY = titleY + 2.5;
  const customerGst = sale.customer?.gstNumber || sale.customerGSTIN || '';
  const isGstInvoice = sale.invoiceType ? (sale.invoiceType === 'GST') : !!customerGst;
  const isIntrastate = customerGst && (settings?.gstNumber || settings?.gstDetails) && customerGst.substring(0, 2) === (settings.gstNumber || settings.gstDetails).substring(0, 2);

  let metaHeight = 9.5;
  if (isThermal) {
    metaHeight = 15;
  }
  
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(253, 253, 253);
  doc.rect(startX, metaY, contentWidth, metaHeight, 'FD');

  doc.setFontSize(fontSize);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');

  if (isThermal) {
    // Stacked metadata for Thermal roll
    doc.text(`Invoice No: ${sale.invoiceNumber}`, startX + 2, metaY + 3.2);
    doc.text(`Date: ${new Date(sale.date).toLocaleDateString('en-IN')}`, startX + 2, metaY + 6.2);
    doc.text(`Reference: ${sale.reference || 'N/A'}`, startX + 2, metaY + 9.2);
    doc.text(`Terms: ${sale.paymentTerms || 'Due on Receipt'}`, startX + 2, metaY + 12.2);
  } else {
    // 2-column Metadata for A4/A5
    doc.text(`Invoice Number:  ${sale.invoiceNumber}`, startX + 2.5, metaY + 3.5);
    doc.text(`Invoice Date:      ${new Date(sale.date).toLocaleDateString('en-IN')}`, startX + 2.5, metaY + 7.0);
    
    const col2X = startX + (contentWidth / 2) + 2;
    doc.text(`Reference:           ${sale.reference || 'N/A'}`, col2X, metaY + 3.5);
    if (isGstInvoice && sale.placeOfSupply) {
      doc.text(`Place of Supply:   ${sale.placeOfSupply}`, col2X, metaY + 7.0);
    } else {
      doc.text(`Payment Terms:     ${sale.paymentTerms || 'Due on Receipt'}`, col2X, metaY + 7.0);
    }
  }

  // 4. Customer Billing & Shipping Cards
  const cardsY = metaY + metaHeight + (isThermal ? 2.5 : 3.0);
  
  // Card layout parameters
  const billName = sale.customer?.name || 'Walk-in Customer';
  const billPhone = sale.customer?.phone || '';
  const billAddress = sale.customer?.address || 'N/A';
  const billGst = customerGst;

  const shipName = sale.shippingName || billName;
  const shipPhone = sale.shippingPhone || billPhone;
  const shipAddress = sale.shippingAddress || billAddress;
  const shipGst = customerGst;

  let nextLayoutY = cardsY;

  if (isThermal) {
    // Stacked single column for Thermal
    const cardHeight = (billAddress !== 'N/A' || billPhone) ? 17.5 : 12;
    
    // BILL TO
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(startX, cardsY, contentWidth, cardHeight, 1.2, 1.2, 'FD');
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO:', startX + 2.5, cardsY + 3.2);
    doc.setDrawColor(226, 232, 240);
    doc.line(startX + 2.5, cardsY + 4.2, startX + contentWidth - 2.5, cardsY + 4.2);

    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(billName, startX + 2.5, cardsY + 7.2);
    
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    let lY = cardsY + 10.5;
    if (billPhone) {
      doc.text(`Phone: ${billPhone}`, startX + 2.5, lY);
      lY += 3.2;
    }
    if (billAddress !== 'N/A') {
      const splitCustAddr = doc.splitTextToSize(billAddress, contentWidth - 5);
      doc.text(splitCustAddr[0] || '', startX + 2.5, lY);
      lY += 3.2;
    }
    if (isGstInvoice && billGst) {
      doc.setFont('helvetica', 'bold');
      doc.text(`GSTIN: ${billGst}`, startX + 2.5, cardsY + cardHeight - 1.5);
    }
    
    nextLayoutY = cardsY + cardHeight + 2.5;

    // SHIP TO (Only print on Thermal if details are different to save paper width/length)
    if (shipAddress !== billAddress || shipName !== billName) {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(startX, nextLayoutY, contentWidth, cardHeight, 1.2, 1.2, 'FD');
      doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
      doc.setFont('helvetica', 'bold');
      doc.text('SHIP TO:', startX + 2.5, nextLayoutY + 3.2);
      doc.line(startX + 2.5, nextLayoutY + 4.2, startX + contentWidth - 2.5, nextLayoutY + 4.2);

      doc.setTextColor(30, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.text(shipName, startX + 2.5, nextLayoutY + 7.2);
      
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      let sY = nextLayoutY + 10.5;
      if (shipPhone) {
        doc.text(`Phone: ${shipPhone}`, startX + 2.5, sY);
        sY += 3.2;
      }
      if (shipAddress !== 'N/A') {
        const splitShipAddr = doc.splitTextToSize(shipAddress, contentWidth - 5);
        doc.text(splitShipAddr[0] || '', startX + 2.5, sY);
        sY += 3.2;
      }
      if (isGstInvoice && shipGst) {
        doc.setFont('helvetica', 'bold');
        doc.text(`GSTIN: ${shipGst}`, startX + 2.5, nextLayoutY + cardHeight - 1.5);
      }
      nextLayoutY = nextLayoutY + cardHeight + 2.5;
    }
  } else {
    // Side-by-side columns for A4/A5
    const cardWidth = (contentWidth - 4) / 2;
    const cardHeight = 17.5;
    
    // BILL TO
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(startX, cardsY, cardWidth, cardHeight, 1.2, 1.2, 'FD');
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFont('helvetica', 'bold');
    doc.text('BILL TO:', startX + 2.5, cardsY + 3.2);
    doc.setDrawColor(226, 232, 240);
    doc.line(startX + 2.5, cardsY + 4.2, startX + cardWidth - 2.5, cardsY + 4.2);

    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(billName, startX + 2.5, cardsY + 7.2);
    
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    let lY = cardsY + 10.5;
    if (billPhone) {
      doc.text(`Phone: ${billPhone}`, startX + 2.5, lY);
      lY += 3.2;
    }
    if (billAddress !== 'N/A') {
      const splitCustAddr = doc.splitTextToSize(billAddress, cardWidth - 5);
      doc.text(splitCustAddr[0] || '', startX + 2.5, lY);
    }
    if (isGstInvoice && billGst) {
      doc.setFont('helvetica', 'bold');
      doc.text(`GSTIN: ${billGst}`, startX + 2.5, cardsY + 15.5);
    }

    // SHIP TO
    const shipX = startX + cardWidth + 4;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(shipX, cardsY, cardWidth, cardHeight, 1.2, 1.2, 'FD');
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFont('helvetica', 'bold');
    doc.text('SHIP TO:', shipX + 2.5, cardsY + 3.2);
    doc.line(shipX + 2.5, cardsY + 4.2, shipX + cardWidth - 2.5, cardsY + 4.2);

    doc.setTextColor(30, 30, 30);
    doc.setFont('helvetica', 'bold');
    doc.text(shipName, shipX + 2.5, cardsY + 7.2);
    
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    let sY = cardsY + 10.5;
    if (shipPhone) {
      doc.text(`Phone: ${shipPhone}`, shipX + 2.5, sY);
      sY += 3.2;
    }
    if (shipAddress !== 'N/A') {
      const splitShipAddr = doc.splitTextToSize(shipAddress, cardWidth - 5);
      doc.text(splitShipAddr[0] || '', shipX + 2.5, sY);
    }
    if (isGstInvoice && shipGst) {
      doc.setFont('helvetica', 'bold');
      doc.text(`GSTIN: ${shipGst}`, shipX + 2.5, cardsY + 15.5);
    }

    nextLayoutY = cardsY + cardHeight + 3.0;
  }

  // 5. Product Table
  let tableHeaders;
  let tableColStyles;
  
  if (isThermal) {
    // Dynamic minimal columns for Thermal format slips
    tableHeaders = ['#', 'Product Name', 'Qty', 'Rate', 'Amount'];
    tableColStyles = {
      0: { halign: 'center', cellWidth: 5 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 8 },
      3: { halign: 'right', cellWidth: 14 },
      4: { halign: 'right', cellWidth: 16 }
    };
  } else if (isGstInvoice) {
    // Complete columns for Standard GST
    tableHeaders = ['#', 'Product Name', 'HSN', 'Qty', 'Unit', 'Rate', 'Disc', 'GST%', 'Tax Amt', 'Amount'];
    tableColStyles = {
      0: { halign: 'center', cellWidth: 6 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 10 },
      3: { halign: 'center', cellWidth: 8 },
      4: { halign: 'center', cellWidth: 8 },
      5: { halign: 'right', cellWidth: 15 },
      6: { halign: 'right', cellWidth: 12 },
      7: { halign: 'center', cellWidth: 10 },
      8: { halign: 'right', cellWidth: 15 },
      9: { halign: 'right', cellWidth: 18 }
    };
  } else {
    // Standard Non-GST multi-column layout
    tableHeaders = ['#', 'Product Name', 'Qty', 'Unit', 'Rate', 'Discount', 'Amount'];
    tableColStyles = {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 15 },
      3: { halign: 'center', cellWidth: 15 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 25 }
    };
  }

  const tableBody = sale.items.map((item, idx) => {
    const unit = item.product?.unit || item.unit || 'pcs';
    const discVal = Number(item.discount || 0);
    const discStr = discVal > 0 ? `${discVal.toFixed(2)}` : '0.00';

    let row = [
      idx + 1,
      item.name,
    ];

    if (!isThermal && isGstInvoice) {
      row.push(item.product?.gstClass || '0000');
    }

    row.push(Number(item.qty).toFixed(0));

    if (!isThermal) {
      row.push(unit.toUpperCase());
    }

    row.push(Number(item.unitPrice).toFixed(2));

    if (!isThermal) {
      row.push(discStr);
    }

    if (!isThermal && isGstInvoice) {
      const itemTotal = Number(item.lineTotal || 0);
      const gstPct = Number(item.gstPercent || 0);
      let taxAmt = 0;
      if (settings?.defaultGstMode === 'inclusive') {
        taxAmt = itemTotal - (itemTotal / (1 + gstPct / 100));
      } else {
        taxAmt = itemTotal * (gstPct / 100);
      }
      row.push(`${gstPct}%`);
      row.push(taxAmt.toFixed(2));
    }

    row.push(Number(item.lineTotal).toFixed(2));
    return row;
  });

  autoTable(doc, {
    startY: nextLayoutY,
    margin: { left: startX, right: startX },
    theme: 'striped',
    headStyles: {
      fillColor: [primaryRgb.r, primaryRgb.g, primaryRgb.b],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: isThermal ? 6.5 : 7.5,
      cellPadding: isThermal ? 1.0 : 1.2,
    },
    styles: {
      font: 'helvetica',
      fontSize: isThermal ? 6.5 : 7.5,
      cellPadding: isThermal ? 1.0 : 1.2,
    },
    alternateRowStyles: {
      fillColor: [249, 246, 242], // Alternating row color
    },
    columnStyles: tableColStyles,
    head: [tableHeaders],
    body: tableBody,
  });

  // 6. Bottom Summary Layout
  let y = doc.lastAutoTable.finalY + (isThermal ? 2.0 : 2.5);

  // Dynamic Page Break Calculations
  const sectionHeight = isThermal ? 32 : 38;
  if (y + sectionHeight > (pageHeight - margin - 10)) {
    doc.addPage();
    y = margin + 2;
  }

  // UPI Payments & QR parameters
  const upiId = settings?.upiId;
  const payeeName = settings?.payeeName || settings?.companyName || 'AO Core';
  const grandTotalStr = Number(sale.grandTotal).toFixed(2);
  const upiLink = upiId ? `upi://pay?pa=${upiId}&pn=${encodeURIComponent(payeeName)}&am=${grandTotalStr}&cu=INR` : null;

  if (isThermal) {
    // Stacked layout for Thermal bottom sections
    
    // Amount in Words
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(startX, y, contentWidth, 7, 1, 1, 'FD');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'bold');
    doc.text('AMOUNT IN WORDS', startX + 2, y + 2.2);
    doc.setFontSize(6.5);
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    const splitWords = doc.splitTextToSize(convertNumberToWords(sale.grandTotal), contentWidth - 4);
    doc.text(splitWords, startX + 2, y + 4.8);
    
    y += 9.5;

    // Totals Box (Full Width)
    const totalsLines = [
      { label: 'Subtotal:', val: `Rs. ${Number(sale.subtotal).toFixed(2)}` }
    ];
    if (Number(sale.discount) > 0) {
      totalsLines.push({ label: 'Discount:', val: `-Rs. ${Number(sale.discount).toFixed(2)}` });
    }
    if (isGstInvoice) {
      const totalGst = Number(sale.gstTotal || sale.totalGST || 0);
      if (totalGst > 0) {
        if (isIntrastate || !customerGst) {
          totalsLines.push({ label: 'CGST:', val: `Rs. ${(totalGst/2).toFixed(2)}` });
          totalsLines.push({ label: 'SGST:', val: `Rs. ${(totalGst/2).toFixed(2)}` });
        } else {
          totalsLines.push({ label: 'IGST:', val: `Rs. ${totalGst.toFixed(2)}` });
        }
      }
    }
    if (Number(sale.shippingCharge || 0) > 0) {
      totalsLines.push({ label: 'Shipping:', val: `Rs. ${Number(sale.shippingCharge).toFixed(2)}` });
    }
    if (Number(sale.roundOff || 0) !== 0) {
      totalsLines.push({ label: 'Round Off:', val: `Rs. ${Number(sale.roundOff).toFixed(2)}` });
    }

    const tHeight = (totalsLines.length * 2.8) + 7.5;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(startX, y, contentWidth, tHeight, 1, 1, 'FD');

    let tY = y + 3.0;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    
    totalsLines.forEach((l) => {
      doc.text(l.label, startX + 3, tY);
      doc.text(l.val, endX - 3, tY, { align: 'right' });
      tY += 2.8;
    });

    // Grand Total Bar
    doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.roundedRect(startX + 1.5, tY - 0.5, contentWidth - 3, 4.5, 0.8, 0.8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.text('Grand Total:', startX + 3, tY + 2.6);
    doc.text(`Rs. ${Number(sale.grandTotal).toFixed(2)}`, endX - 3, tY + 2.6, { align: 'right' });

    y += tHeight + 2.5;

    // Bank Account & UPI Code
    if (settings?.bankDetails || upiId) {
      const bankCardHeight = upiId ? 18 : 12;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(startX, y, contentWidth, bankCardHeight, 1, 1, 'FD');

      let textX = startX + 2;
      if (upiId) {
        try {
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&ecc=H&data=${encodeURIComponent(upiLink)}`;
          const qrImg = await loadImage(qrUrl);
          doc.addImage(qrImg, 'PNG', startX + 1.5, y + 1.5, 14, 14);
          textX = startX + 17;
        } catch (e) {
          console.error(e);
        }
      }

      doc.setFontSize(5.5);
      doc.setTextColor(100, 100, 100);
      doc.text('PAYMENT INFO', textX, y + 2.8);
      
      doc.setFontSize(6);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      let bY = y + 5.5;
      if (upiId) {
        doc.text(`UPI: ${upiId}`, textX, bY);
        bY += 2.8;
      }
      if (settings?.bankDetails) {
        const splitBankText = doc.splitTextToSize(settings.bankDetails, contentWidth - (textX - startX) - 2);
        doc.text(splitBankText.slice(0, 3), textX, bY);
      }
      y += bankCardHeight + 2;
    }
  } else {
    // Side-by-side summary layout for A4/A5
    const leftColWidth = (contentWidth * 0.58);
    
    // Amount in Words
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(startX, y, leftColWidth, 8, 1, 1, 'FD');
    
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'bold');
    doc.text('AMOUNT IN WORDS', startX + 2, y + 2.5);
    
    doc.setFontSize(7);
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    const splitWords = doc.splitTextToSize(convertNumberToWords(sale.grandTotal), leftColWidth - 4);
    doc.text(splitWords, startX + 2, y + 5.8);

    let bottomPanelY = y + 10;
    
    // Bank Account & UPI card
    if (settings?.bankDetails || upiId) {
      const bankDetailsHeight = 18;
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(startX, bottomPanelY, leftColWidth, bankDetailsHeight, 1, 1, 'FD');

      let bankTextX = startX + 2;

      // Dynamic High-Resolution UPI QR Code
      if (upiId) {
        try {
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&ecc=H&data=${encodeURIComponent(upiLink)}`;
          const qrImg = await loadImage(qrUrl);
          doc.addImage(qrImg, 'PNG', startX + 1.5, bottomPanelY + 1.5, 14, 14);
          bankTextX = startX + 18;
        } catch (err) {
          console.error(err);
        }
      }

      doc.setFontSize(6);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'bold');
      doc.text('PAYMENT DETAILS', bankTextX, bottomPanelY + 3);

      doc.setFontSize(6.5);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      
      let textLineY = bottomPanelY + 6.0;
      if (upiId) {
        doc.text(`UPI ID: ${upiId}`, bankTextX, textLineY);
        textLineY += 3.0;
      }
      if (settings?.bankDetails) {
        const splitBankText = doc.splitTextToSize(settings.bankDetails, leftColWidth - (bankTextX - startX) - 2);
        doc.text(splitBankText.slice(0, 3), bankTextX, textLineY);
      }
    }

    // Right column: Totals summary card
    const rightColX = startX + leftColWidth + 4;
    const rightColWidth = contentWidth - leftColWidth - 4;
    
    let totalLineY = y + 4.0;
    
    const linesToDraw = [];
    linesToDraw.push({ label: 'Subtotal:', val: `Rs. ${Number(sale.subtotal).toFixed(2)}`, color: [80, 80, 80], bold: false });

    if (Number(sale.discount) > 0) {
      linesToDraw.push({ label: 'Discount:', val: `-Rs. ${Number(sale.discount).toFixed(2)}`, color: [239, 68, 68], bold: false });
    }

    if (isGstInvoice) {
      linesToDraw.push({ label: 'Taxable Amount:', val: `Rs. ${Number(sale.taxableAmount || (Number(sale.subtotal) - Number(sale.discount))).toFixed(2)}`, color: [80, 80, 80], bold: false });
      
      const totalGst = Number(sale.gstTotal || sale.totalGST || 0);
      if (totalGst > 0) {
        if (isIntrastate || !customerGst) {
          const splitGst = totalGst / 2;
          linesToDraw.push({ label: 'CGST:', val: `Rs. ${splitGst.toFixed(2)}`, color: [100, 100, 100], bold: false });
          linesToDraw.push({ label: 'SGST:', val: `Rs. ${splitGst.toFixed(2)}`, color: [100, 100, 100], bold: false });
        } else {
          linesToDraw.push({ label: 'IGST:', val: `Rs. ${totalGst.toFixed(2)}`, color: [100, 100, 100], bold: false });
        }
      }
    }

    if (Number(sale.shippingCharge || 0) > 0) {
      linesToDraw.push({ label: 'Shipping Charge:', val: `Rs. ${Number(sale.shippingCharge).toFixed(2)}`, color: [80, 80, 80], bold: false });
    }

    if (Number(sale.roundOff || 0) !== 0) {
      const rOffVal = Number(sale.roundOff);
      linesToDraw.push({ 
        label: 'Round Off:', 
        val: rOffVal > 0 ? `+Rs. ${rOffVal}` : `-Rs. ${Math.abs(rOffVal)}`, 
        color: [100, 100, 100], 
        bold: false, 
        italic: true 
      });
    }

    const rectHeight = (linesToDraw.length * 3.0) + 11.5;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(rightColX, y, rightColWidth, rectHeight, 1.2, 1.2, 'FD');

    doc.setFontSize(7);
    linesToDraw.forEach((line) => {
      doc.setTextColor(line.color[0], line.color[1], line.color[2]);
      if (line.italic) doc.setFont('helvetica', 'italic');
      else if (line.bold) doc.setFont('helvetica', 'bold');
      else doc.setFont('helvetica', 'normal');
      
      doc.text(line.label, rightColX + 3, totalLineY);
      doc.text(line.val, rightColX + rightColWidth - 3, totalLineY, { align: 'right' });
      totalLineY += 3.0;
    });

    // Draw Grand Total bar
    const gTotalY = totalLineY + 0.5;
    doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.roundedRect(rightColX + 2, gTotalY, rightColWidth - 4, 5.5, 1, 1, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Grand Total:', rightColX + 4, gTotalY + 3.8);
    doc.text(`Rs. ${Number(sale.grandTotal).toFixed(2)}`, rightColX + rightColWidth - 4, gTotalY + 3.8, { align: 'right' });

    y = Math.max(bottomPanelY + 20, y + rectHeight + 3);
  }

  // 7. Terms & Conditions
  if (settings?.termsAndConditions) {
    if (y + 12 > (pageHeight - margin - 8)) {
      doc.addPage();
      y = margin + 2;
    }
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('TERMS & CONDITIONS:', startX, y);
    y += 3.0;

    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    const splitTerms = doc.splitTextToSize(settings.termsAndConditions, contentWidth);
    doc.text(splitTerms.slice(0, 3), startX, y);
    y += (Math.min(3, splitTerms.length) * 2.5);
  }

  // 8. Elegant Footer
  const footerY = Math.max(y + 3, pageHeight - margin - 12);
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Thank you for your purchase.', pageWidth / 2, footerY, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text(`This invoice was generated by ${settings?.companyName || 'Amudhasurabiy Organics'}.`, pageWidth / 2, footerY + 3.0, { align: 'center' });
  
  if (settings?.websiteUrl) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFont('helvetica', 'bold');
    doc.text(`Visit: ${settings.websiteUrl}`, pageWidth / 2, footerY + 5.5, { align: 'center' });
  }

  return doc;
}

export async function downloadInvoicePdf(sale, settings) {
  const doc = await buildInvoicePdfDoc(sale, settings);
  doc.save(`${sale.invoiceNumber}.pdf`);
}

export async function getInvoicePdfBlob(sale, settings) {
  const doc = await buildInvoicePdfDoc(sale, settings);
  return doc.output('blob');
}
