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

  let companyY = 12;
  if (logoLoaded && logoImg) {
    // Draw soft-bordered white circle container for logo
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(255, 255, 255);
    doc.circle(17, 21, 9, 'FD'); // X=17, Y=21, Radius=9
    
    // Position image on top of the circle
    doc.addImage(logoImg, 'PNG', 10, 14, 14, 14);
  }

  // Company Information (Right aligned)
  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(settings?.companyName || 'Amudhasurabiy Organics', endX, companyY, { align: 'right' });

  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  let addrY = companyY + 4;
  if (settings?.address) {
    const splitAddr = doc.splitTextToSize(settings.address, 90);
    doc.text(splitAddr, endX, addrY, { align: 'right' });
    addrY += (splitAddr.length * 3.5);
  }
  if (settings?.phone) {
    doc.text(`Phone: ${settings.phone}`, endX, addrY, { align: 'right' });
    addrY += 3.5;
  }
  if (settings?.email) {
    doc.text(`Email: ${settings.email}`, endX, addrY, { align: 'right' });
    addrY += 3.5;
  }
  if (settings?.websiteUrl) {
    doc.text(`Website: ${settings.websiteUrl}`, endX, addrY, { align: 'right' });
    addrY += 3.5;
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
    addrY += 4;
  }

  // Accent divider line
  const dividerY = Math.max(34, addrY);
  doc.setDrawColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setLineWidth(0.6);
  doc.line(startX, dividerY, endX, dividerY);

  // 2. Invoice Title
  const titleY = dividerY + 6;
  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(isGstInvoice ? 'TAX INVOICE' : 'INVOICE', startX, titleY);

  // 3. Invoice Metadata Card (2-column layout)
  const metaY = titleY + 3;
  const metaHeight = 13;
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(253, 253, 253);
  doc.rect(startX, metaY, contentWidth, metaHeight, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(50, 50, 50);
  doc.setFont('helvetica', 'bold');
  
  // Left Column
  doc.text(`Invoice Number:  ${sale.invoiceNumber}`, startX + 3, metaY + 4.5);
  doc.text(`Invoice Date:      ${new Date(sale.date).toLocaleDateString('en-IN')}`, startX + 3, metaY + 9.5);
  
  // Right Column
  const col2X = startX + 68;
  doc.text(`Reference:           ${sale.reference || 'N/A'}`, col2X, metaY + 4.5);
  if (isGstInvoice && sale.placeOfSupply) {
    doc.text(`Place of Supply:   ${sale.placeOfSupply}`, col2X, metaY + 9.5);
  } else {
    doc.text(`Payment Terms:     ${sale.paymentTerms || 'Due on Receipt'}`, col2X, metaY + 9.5);
  }

  // 4. Customer Billing & Shipping Cards
  const cardsY = metaY + metaHeight + 4;
  const cardWidth = 64;
  const cardHeight = 22;

  // BILL TO Card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(startX, cardsY, cardWidth, cardHeight, 1.5, 1.5, 'FD');
  
  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('BILL TO:', startX + 3, cardsY + 4.5);
  doc.setDrawColor(226, 232, 240);
  doc.line(startX + 3, cardsY + 5.5, startX + cardWidth - 3, cardsY + 5.5);

  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(sale.customer?.name || 'Walk-in Customer', startX + 3, cardsY + 9.5);
  
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  let addrLineY = cardsY + 13.5;
  if (sale.customer?.phone) {
    doc.text(`Phone: ${sale.customer.phone}`, startX + 3, addrLineY);
    addrLineY += 3.5;
  }
  if (sale.customer?.address) {
    const splitCustAddr = doc.splitTextToSize(sale.customer.address, cardWidth - 6);
    doc.text(splitCustAddr[0] || '', startX + 3, addrLineY);
    addrLineY += 3.5;
  }
  if (isGstInvoice && customerGst) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${customerGst}`, startX + 3, cardsY + 20.5);
  }

  // SHIP TO Card
  const shipX = startX + 68;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(shipX, cardsY, cardWidth, cardHeight, 1.5, 1.5, 'FD');

  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.setFont('helvetica', 'bold');
  doc.text('SHIP TO:', shipX + 3, cardsY + 4.5);
  doc.line(shipX + 3, cardsY + 5.5, shipX + cardWidth - 3, cardsY + 5.5);

  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(sale.shippingName || sale.customer?.name || 'Walk-in Customer', shipX + 3, cardsY + 9.5);

  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  let shipAddrLineY = cardsY + 13.5;
  if (sale.shippingPhone || sale.customer?.phone) {
    doc.text(`Phone: ${sale.shippingPhone || sale.customer.phone}`, shipX + 3, shipAddrLineY);
    shipAddrLineY += 3.5;
  }
  if (sale.shippingAddress || sale.customer?.address) {
    const splitShipAddr = doc.splitTextToSize(sale.shippingAddress || sale.customer.address, cardWidth - 6);
    doc.text(splitShipAddr[0] || '', shipX + 3, shipAddrLineY);
    shipAddrLineY += 3.5;
  }
  if (isGstInvoice && customerGst) {
    doc.setFont('helvetica', 'bold');
    doc.text(`GSTIN: ${customerGst}`, shipX + 3, cardsY + 20.5);
  }

  // 5. Product Table Setup
  const tableStartY = cardsY + cardHeight + 4;
  
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

    let row = [
      idx + 1,
      item.name,
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
      cellPadding: 1.5,
    },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 1.5,
    },
    alternateRowStyles: {
      fillColor: [249, 246, 242], // Soft beige background alternate
    },
    columnStyles: tableColStyles,
    head: [tableHeaders],
    body: tableBody,
  });

  // Calculate final Y position after table draws
  let y = doc.lastAutoTable.finalY + 4;

  // Verify page break criteria for bottom summary section
  const sectionHeight = 45;
  if (y + sectionHeight > 195) {
    doc.addPage();
    y = 12;
  }

  // 6. Bottom Section Layout

  // Left column: Amount in Words, Bank & UPI details
  const leftColWidth = 72;
  
  // Amount in Words card
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(startX, y, leftColWidth, 10, 1, 1, 'FD');
  
  doc.setFontSize(6.5);
  doc.setTextColor(100, 100, 100);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT IN WORDS', startX + 2, y + 3);
  
  doc.setFontSize(7.5);
  doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  const splitWords = doc.splitTextToSize(convertNumberToWords(sale.grandTotal), leftColWidth - 4);
  doc.text(splitWords, startX + 2, y + 6.5);

  let bottomPanelY = y + 12;
  
  // Bank Account & UPI card
  if (settings?.bankDetails || upiId) {
    const bankDetailsHeight = 22;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(startX, bottomPanelY, leftColWidth, bankDetailsHeight, 1, 1, 'FD');

    let bankTextX = startX + 2;

    // Load and add UPI QR code inside the card if configured
    if (upiId) {
      try {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(upiLink)}`;
        const qrImg = await loadImage(qrUrl);
        doc.addImage(qrImg, 'PNG', startX + 2, bottomPanelY + 2, 18, 18);
        bankTextX = startX + 22; // Shift bank detail labels right
      } catch (err) {
        console.error('Failed to load QR code for PDF document:', err);
      }
    }

    doc.setFontSize(6.5);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'bold');
    doc.text('PAYMENT DETAILS', bankTextX, bottomPanelY + 4);

    doc.setFontSize(7);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'normal');
    
    let textLineY = bottomPanelY + 7.5;
    if (upiId) {
      doc.text(`UPI ID: ${upiId}`, bankTextX, textLineY);
      textLineY += 3.5;
    }
    if (settings?.bankDetails) {
      const splitBankText = doc.splitTextToSize(settings.bankDetails, leftColWidth - (bankTextX - startX) - 3);
      doc.text(splitBankText.slice(0, 3), bankTextX, textLineY);
    }
  }

  // Right column: Totals summary card
  const rightColX = startX + 76;
  const rightColWidth = 56;
  
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(rightColX, y, rightColWidth, 34, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');

  let totalLineY = y + 4.5;
  doc.text('Subtotal:', rightColX + 3, totalLineY);
  doc.text(`Rs. ${Number(sale.subtotal).toFixed(2)}`, rightColX + rightColWidth - 3, totalLineY, { align: 'right' });

  if (Number(sale.discount) > 0) {
    totalLineY += 3.5;
    doc.setTextColor(239, 68, 68);
    doc.text('Discount:', rightColX + 3, totalLineY);
    doc.text(`-Rs. ${Number(sale.discount).toFixed(2)}`, rightColX + rightColWidth - 3, totalLineY, { align: 'right' });
    doc.setTextColor(80, 80, 80);
  }

  if (isGstInvoice) {
    totalLineY += 3.5;
    doc.text('Taxable Amount:', rightColX + 3, totalLineY);
    doc.text(`Rs. ${Number(sale.taxableAmount || (Number(sale.subtotal) - Number(sale.discount))).toFixed(2)}`, rightColX + rightColWidth - 3, totalLineY, { align: 'right' });

    const totalGst = Number(sale.gstTotal || sale.totalGST || 0);
    if (totalGst > 0) {
      if (isIntrastate || !customerGst) {
        const splitGst = totalGst / 2;
        totalLineY += 3.5;
        doc.text('CGST:', rightColX + 3, totalLineY);
        doc.text(`Rs. ${splitGst.toFixed(2)}`, rightColX + rightColWidth - 3, totalLineY, { align: 'right' });
        totalLineY += 3.5;
        doc.text('SGST:', rightColX + 3, totalLineY);
        doc.text(`Rs. ${splitGst.toFixed(2)}`, rightColX + rightColWidth - 3, totalLineY, { align: 'right' });
      } else {
        totalLineY += 3.5;
        doc.text('IGST:', rightColX + 3, totalLineY);
        doc.text(`Rs. ${totalGst.toFixed(2)}`, rightColX + rightColWidth - 3, totalLineY, { align: 'right' });
      }
    }
  }

  if (Number(sale.shippingCharge || 0) > 0) {
    totalLineY += 3.5;
    doc.text('Shipping Charge:', rightColX + 3, totalLineY);
    doc.text(`Rs. ${Number(sale.shippingCharge).toFixed(2)}`, rightColX + rightColWidth - 3, totalLineY, { align: 'right' });
  }

  if (Number(sale.roundOff || 0) !== 0) {
    totalLineY += 3.5;
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text('Round Off:', rightColX + 3, totalLineY);
    const rOffVal = Number(sale.roundOff);
    doc.text(rOffVal > 0 ? `+Rs. ${rOffVal}` : `-Rs. ${Math.abs(rOffVal)}`, rightColX + rightColWidth - 3, totalLineY, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
  }

  // Draw highlighted Grand Total bar
  const gTotalY = y + 26.5;
  doc.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
  doc.roundedRect(rightColX + 2, gTotalY, rightColWidth - 4, 6, 1, 1, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Grand Total:', rightColX + 4, gTotalY + 4.2);
  doc.text(`Rs. ${Number(sale.grandTotal).toFixed(2)}`, rightColX + rightColWidth - 4, gTotalY + 4.2, { align: 'right' });

  // 7. Terms & Conditions (if configured)
  let nextY = bottomPanelY + 25;
  if (settings?.termsAndConditions) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('TERMS & CONDITIONS:', startX, nextY);
    nextY += 3.5;

    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    const splitTerms = doc.splitTextToSize(settings.termsAndConditions, contentWidth);
    doc.text(splitTerms.slice(0, 3), startX, nextY);
    nextY += (Math.min(3, splitTerms.length) * 3);
  }

  // 8. Elegant Footer
  const footerY = Math.max(nextY + 4, 196);
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('Thank you for your purchase.', 74, footerY, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text(`This invoice was generated by ${settings?.companyName || 'Amudhasurabiy Organics'}.`, 74, footerY + 3.5, { align: 'center' });
  
  if (settings?.websiteUrl) {
    doc.setTextColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
    doc.setFont('helvetica', 'bold');
    doc.text(`Visit: ${settings.websiteUrl}`, 74, footerY + 6.5, { align: 'center' });
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
