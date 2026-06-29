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

// Core document builder to build premium A5 invoice
export async function buildInvoicePdfDoc(sale, settings) {
  // A5 dimensions: 148mm x 210mm
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  });

  const primaryRgb = hexToRgb('#5A2D0C'); // Primary Dark Brown
  const accentRgb = hexToRgb('#F59E0B');  // Golden Orange

  // Margins
  const startX = 8;
  const endX = 140; // 148 - 8
  const contentWidth = 132;

  // 1. Company Header (Logo on Left, Details on Right)
  let logoLoaded = false;
  let logoImg = null;
  if (settings?.logo || settings?.logoUrl) {
    try {
      const logoUrl = getActiveLogoUrl(settings);
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

  let companyY = 10;
  if (logoLoaded && logoImg) {
    // Draw soft-bordered white circle container for logo (smaller circle)
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.circle(15, 14, 7, 'FD'); // Center X=15, Y=14, Radius=7
    
    // Position image on top of the circle
    doc.addImage(logoImg, 'PNG', 9.5, 10.5, 11, 11);
  }

  // Company Information (Right aligned) - Decreased size to 11.5 to prevent wrapping
  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(settings?.companyName || 'Amudhasurabiy Organics', endX, companyY, { align: 'right' });

  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  let addrY = companyY + 4;
  if (settings?.address) {
    const splitAddr = doc.splitTextToSize(settings.address, 90);
    doc.text(splitAddr, endX, addrY, { align: 'right' });
    addrY += (splitAddr.length * 2.8);
  }
  if (settings?.phone) {
    doc.text(`Phone: ${settings.phone}`, endX, addrY, { align: 'right' });
    addrY += 2.8;
  }
  if (settings?.email) {
    doc.text(`Email: ${settings.email}`, endX, addrY, { align: 'right' });
    addrY += 2.8;
  }
  if (settings?.websiteUrl) {
    doc.text(`Website: ${settings.websiteUrl}`, endX, addrY, { align: 'right' });
    addrY += 2.8;
  }

  // GST SPLIT Details
  const customerGst = sale.customer?.gstNumber || sale.customerGSTIN || '';
  const companyGst = settings?.gstNumber || settings?.gstDetails || '';
  const isGstInvoice = sale.invoiceType ? (sale.invoiceType === 'GST') : !!customerGst;
  const isIntrastate = customerGst && companyGst && customerGst.substring(0, 2) === companyGst.substring(0, 2);

  if (isGstInvoice && companyGst) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${companyGst}`, endX, addrY, { align: 'right' });
    addrY += 3.2;
  }

  // Accent divider line
  const dividerY = Math.max(22, addrY);
  doc.setDrawColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setLineWidth(0.5);
  doc.line(startX, dividerY, endX, dividerY);

  // 2. Invoice Title
  const titleY = dividerY + 4;
  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(isGstInvoice ? 'TAX INVOICE' : 'INVOICE', startX, titleY);

  // 3. Invoice Metadata Card (2-column layout)
  const metaY = titleY + 2.5;
  const metaHeight = 10;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(253, 253, 253);
  doc.rect(startX, metaY, contentWidth, metaHeight, 'FD');

  doc.setFontSize(7);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  
  // Left Column
  doc.text(`Invoice Number:  ${sale.invoiceNumber}`, startX + 2.5, metaY + 3.5);
  doc.text(`Invoice Date:      ${new Date(sale.date).toLocaleDateString('en-IN')}`, startX + 2.5, metaY + 7.5);
  
  // Right Column
  const col2X = startX + 68;
  doc.text(`Reference:           ${sale.reference || 'N/A'}`, col2X, metaY + 3.5);
  if (isGstInvoice && sale.placeOfSupply) {
    doc.text(`Place of Supply:   ${sale.placeOfSupply}`, col2X, metaY + 7.5);
  } else {
    doc.text(`Payment Terms:     ${sale.paymentTerms || 'Due on Receipt'}`, col2X, metaY + 7.5);
  }

  // 4. Customer Billing & Shipping Cards
  const cardsY = metaY + metaHeight + 3;
  const cardWidth = 64;
  const cardHeight = 16.5;

  // BILL TO Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(startX, cardsY, cardWidth, cardHeight, 1.2, 1.2, 'FD');
  
  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('BILL TO:', startX + 2.5, cardsY + 3.2);
  doc.setDrawColor(226, 232, 240);
  doc.line(startX + 2.5, cardsY + 4.2, startX + cardWidth - 2.5, cardsY + 4.2);

  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(sale.customer?.name || 'Walk-in Customer', startX + 2.5, cardsY + 7.2);
  
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  let addrLineY = cardsY + 10.5;
  if (sale.customer?.phone) {
    doc.text(`Phone: ${sale.customer.phone}`, startX + 2.5, addrLineY);
    addrLineY += 3.2;
  }
  if (sale.customer?.address) {
    const splitCustAddr = doc.splitTextToSize(sale.customer.address, cardWidth - 5);
    doc.text(splitCustAddr[0] || '', startX + 2.5, addrLineY);
    addrLineY += 3.2;
  }
  if (isGstInvoice && customerGst) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${customerGst}`, startX + 2.5, cardsY + 14.5);
  }

  // SHIP TO Card
  const shipX = startX + 68;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(shipX, cardsY, cardWidth, cardHeight, 1.2, 1.2, 'FD');

  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFont('helvetica', 'bold');
  doc.text('SHIP TO:', shipX + 2.5, cardsY + 3.2);
  doc.line(shipX + 2.5, cardsY + 4.2, shipX + cardWidth - 2.5, cardsY + 4.2);

  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(sale.shippingName || sale.customer?.name || 'Walk-in Customer', shipX + 2.5, cardsY + 7.2);

  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  let shipAddrLineY = cardsY + 10.5;
  if (sale.shippingPhone || sale.customer?.phone) {
    doc.text(`Phone: ${sale.shippingPhone || sale.customer.phone}`, shipX + 2.5, shipAddrLineY);
    shipAddrLineY += 3.2;
  }
  if (sale.shippingAddress || sale.customer?.address) {
    const splitShipAddr = doc.splitTextToSize(sale.shippingAddress || sale.customer.address, cardWidth - 5);
    doc.text(splitShipAddr[0] || '', shipX + 2.5, shipAddrLineY);
    shipAddrLineY += 3.2;
  }
  if (isGstInvoice && customerGst) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${customerGst}`, shipX + 2.5, cardsY + 14.5);
  }

  // 5. Product Table Setup
  const tableStartY = cardsY + cardHeight + 2.8;
  
  // Table Columns Schema
  let tableHeaders;
  let tableColStyles;
  if (isGstInvoice) {
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

    let displayName = item.name;
    if (item.schemeApplied && item.schemeApplied.trim().toLowerCase() !== 'none') {
      displayName += `\nApplied: ${item.schemeApplied}`;
    }

    let row = [
      idx + 1,
      displayName,
      ...(isGstInvoice ? [item.product?.gstClass || '0000'] : []),
      Number(item.qty).toFixed(0),
      unit.toUpperCase(),
      Number(item.unitPrice).toFixed(2),
      discStr,
    ];

    if (isGstInvoice) {
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
    startY: tableStartY,
    margin: { left: startX, right: startX },
    theme: 'striped',
    headStyles: {
      fillColor: [primaryRgb.r, primaryRgb.g, primaryRgb.b],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      cellPadding: 1.2,
    },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 1.2,
    },
    alternateRowStyles: {
      fillColor: [249, 246, 242], // Soft beige background alternate
    },
    columnStyles: tableColStyles,
    head: [tableHeaders],
    body: tableBody,
  });

  // Calculate final Y position after table draws
  let y = doc.lastAutoTable.finalY + 2.5;

  // Verify page break criteria for bottom summary section
  const sectionHeight = 35;
  if (y + sectionHeight > 195) {
    doc.addPage();
    y = 10;
  }

  // 6. Bottom Section Layout

  // Left column: Amount in Words, Bank & UPI details
  const leftColWidth = 72;
  
  // Amount in Words card
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

    // Load and add UPI QR code inside the card if configured
    if (upiId) {
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(upiLink)}`;
        const qrImg = await loadImage(qrUrl);
        doc.addImage(qrImg, 'PNG', startX + 1.5, bottomPanelY + 1.5, 14, 14);
        bankTextX = startX + 18; // Shift bank detail labels right
      } catch (err) {
        console.error('Failed to load QR code for PDF document:', err);
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
  const rightColX = startX + 76;
  const rightColWidth = 56;
  
  let totalLineY = y + 4.0;
  
  // Calculate dynamic offsets
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

  let nextY = Math.max(bottomPanelY + 20, y + rectHeight + 3);

  // 7. Terms & Conditions (if configured)
  if (settings?.termsAndConditions) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('TERMS & CONDITIONS:', startX, nextY);
    nextY += 3.0;

    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    const splitTerms = doc.splitTextToSize(settings.termsAndConditions, contentWidth);
    doc.text(splitTerms.slice(0, 3), startX, nextY);
    nextY += (Math.min(3, splitTerms.length) * 2.5);
  }

  // 8. Elegant Footer
  const footerY = Math.max(nextY + 3, 198);
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Thank you for your purchase.', 74, footerY, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text(`This invoice was generated by ${settings?.companyName || 'Amudhasurabiy Organics'}.`, 74, footerY + 3.0, { align: 'center' });
  
  if (settings?.websiteUrl) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFont('helvetica', 'bold');
    doc.text(`Visit: ${settings.websiteUrl}`, 74, footerY + 5.5, { align: 'center' });
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
