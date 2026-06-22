import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { resolveAssetUrl, getActiveLogoUrl } from './url';

// Helper to convert hex brand color to RGB for jsPDF fill/text colors
function hexToRgb(hex) {
  const defaultRgb = { r: 37, g: 99, b: 235 }; // Default blue #2563eb
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

// Helper to load image asynchronously in the browser
const loadImage = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Avoid CORS canvas taint issues
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
};

// Core document builder to keep code DRY
export async function buildInvoicePdfDoc(sale, settings) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const company = settings?.companyName || 'AO Core Organic';
  const brandRgb = hexToRgb(settings?.brandColor);

  // 1. Top Decorative Brand Accent Bar
  doc.setFillColor(brandRgb.r, brandRgb.g, brandRgb.b);
  doc.rect(0, 0, 210, 6, 'F');

  // Determine starting X and Y coordinates for the company details based on Logo availability
  let companyStartX = 14;
  let companyY = 20;

  if (settings?.logo || settings?.logoUrl) {
    try {
      let logoUrl = getActiveLogoUrl(settings);
      let img;
      try {
        img = await loadImage(logoUrl);
      } catch (err) {
        console.error('Failed to load active logo, falling back to default:', err);
        logoUrl = '/favicon.png';
        img = await loadImage(logoUrl);
      }
      const logoHeight = 15;
      const logoWidth = Math.min(35, logoHeight * (img.width / img.height));
      
      // Draw logo on the top left
      doc.addImage(img, 'PNG', 14, 12, logoWidth, logoHeight);
      
      // Move text start position to the right of the logo
      companyStartX = 14 + logoWidth + 4;
      companyY = 16;
    } catch (err) {
      console.error('Failed to load logo image:', err);
    }
  }

  // 2. Company / Header Section
  doc.setTextColor(brandRgb.r, brandRgb.g, brandRgb.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text(company, companyStartX, companyY);

  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let addressY = companyY + 5.5;
  if (settings?.address) {
    doc.text(settings.address, companyStartX, addressY);
    addressY += 4.5;
  }
  if (settings?.gstDetails) {
    doc.text(`GSTIN: ${settings.gstDetails}`, companyStartX, addressY);
    addressY += 4.5;
  }
  if (settings?.phone) {
    doc.text(`Phone: ${settings.phone}`, companyStartX, addressY);
    addressY += 4.5;
  }

  // 3. Invoice Metadata (Right Aligned)
  doc.setTextColor(brandRgb.r, brandRgb.g, brandRgb.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('INVOICE', 196, 20, { align: 'right' });

  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Invoice No: ${sale.invoiceNumber}`, 196, 26, { align: 'right' });
  doc.text(`Date: ${new Date(sale.date).toLocaleDateString()}`, 196, 31, { align: 'right' });
  
  const paymentStatus = sale.paymentStatus || 'paid';
  doc.setFont('helvetica', 'bold');
  if (paymentStatus === 'paid') {
    doc.setTextColor(34, 197, 94); // Green for paid
  } else if (paymentStatus === 'partial') {
    doc.setTextColor(234, 179, 8); // Yellow for partial
  } else {
    doc.setTextColor(239, 68, 68); // Red for unpaid/pending
  }
  doc.text(`Status: ${paymentStatus.toLowerCase() === 'partial' ? 'PARTIALLY PAID' : paymentStatus.toUpperCase()}`, 196, 36, { align: 'right' });

  // 4. Divider Line
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.4);
  doc.line(14, 45, 196, 45);

  // 5. Customer Details ("Bill To")
  doc.setTextColor(brandRgb.r, brandRgb.g, brandRgb.b);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('BILL TO:', 14, 52);

  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text(sale.customer?.name || 'Walk-in Customer', 14, 58);

  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  let customerY = 63;
  if (sale.customer?.phone) {
    doc.text(`Phone: ${sale.customer.phone}`, 14, customerY);
    customerY += 5;
  }
  if (sale.customer?.address) {
    doc.text(sale.customer.address, 14, customerY);
    customerY += 5;
  }
  if (sale.customer?.gstNumber) {
    doc.text(`GSTIN: ${sale.customer.gstNumber}`, 14, customerY);
    customerY += 5;
  }

  // 6. Products Table (AutoTable)
  const startTableY = Math.max(customerY + 4, 76);
  autoTable(doc, {
    startY: startTableY,
    theme: 'striped',
    headStyles: {
      fillColor: [brandRgb.r, brandRgb.g, brandRgb.b],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9.5,
    },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      cellPadding: 3.5,
    },
    columnStyles: {
      0: { cellWidth: 'auto' }, // Item Name
      1: { halign: 'center', cellWidth: 20 }, // Qty
      2: { halign: 'right', cellWidth: 30 }, // Price
      3: { halign: 'center', cellWidth: 20 }, // GST%
      4: { halign: 'right', cellWidth: 30 }, // Total
    },
    head: [['Item Description', 'Qty', 'Unit Price', 'GST%', 'Total Amount']],
    body: sale.items.map((item) => [
      item.name,
      item.qty,
      `Rs. ${Number(item.unitPrice).toFixed(2)}`,
      `${item.gstPercent || 0}%`,
      `Rs. ${Number(item.lineTotal).toFixed(2)}`
    ]),
  });

  // 7. Summary Block (Right Aligned Box)
  const y = doc.lastAutoTable.finalY + 8;
  
  // Gray summary panel background
  doc.setFillColor(248, 250, 252);
  doc.rect(126, y, 70, 36, 'F');
  
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  doc.setFont('helvetica', 'normal');
  
  doc.text('Subtotal:', 130, y + 6);
  doc.text(`Rs. ${Number(sale.subtotal).toFixed(2)}`, 192, y + 6, { align: 'right' });
  
  doc.text('GST Total:', 130, y + 12);
  doc.text(`Rs. ${Number(sale.gstTotal).toFixed(2)}`, 192, y + 12, { align: 'right' });
  
  doc.text('Discount:', 130, y + 18);
  doc.text(`Rs. ${Number(sale.discount).toFixed(2)}`, 192, y + 18, { align: 'right' });
  
  // Total Divider line
  doc.setDrawColor(220, 225, 230);
  doc.line(130, y + 22, 192, y + 22);
  
  // Grand Total
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(brandRgb.r, brandRgb.g, brandRgb.b);
  doc.text('Grand Total:', 130, y + 28);
  doc.text(`Rs. ${Number(sale.grandTotal).toFixed(2)}`, 192, y + 28, { align: 'right' });

  // 8. Footer Section
  const footerY = y + 42;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'italic');
  doc.text('Thank you for choosing us! We appreciate your business.', 14, footerY);
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Terms & Conditions: Goods once sold cannot be returned or exchanged.', 14, footerY + 5.5);

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
