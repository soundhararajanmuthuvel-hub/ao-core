import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function downloadInvoicePdf(sale, settings) {
  const doc = new jsPDF();
  const company = settings?.companyName || 'AO Core';
  doc.setFontSize(18);
  doc.text(company, 14, 20);
  doc.setFontSize(10);
  doc.text(settings?.address || '', 14, 28);
  doc.text(`GST: ${settings?.gstDetails || ''}`, 14, 34);
  doc.text(`Phone: ${settings?.phone || ''}`, 14, 40);

  doc.setFontSize(14);
  doc.text('INVOICE', 150, 20);
  doc.setFontSize(10);
  doc.text(`# ${sale.invoiceNumber}`, 150, 28);
  doc.text(`Date: ${new Date(sale.date).toLocaleDateString()}`, 150, 34);

  doc.text(`Bill To: ${sale.customer?.name || ''}`, 14, 52);
  doc.text(`${sale.customer?.phone || ''}`, 14, 58);
  doc.text(`${sale.customer?.address || ''}`, 14, 64);

  autoTable(doc, {
    startY: 72,
    head: [['Item', 'Qty', 'Price', 'GST%', 'Total']],
    body: sale.items.map((i) => [i.name, i.qty, i.unitPrice, i.gstPercent, i.lineTotal]),
  });

  const y = doc.lastAutoTable.finalY + 10;
  doc.text(`Subtotal: ₹${sale.subtotal}`, 140, y);
  doc.text(`GST: ₹${sale.gstTotal}`, 140, y + 6);
  doc.text(`Discount: ₹${sale.discount}`, 140, y + 12);
  doc.setFontSize(12);
  doc.text(`Grand Total: ₹${sale.grandTotal}`, 140, y + 22);
  doc.save(`${sale.invoiceNumber}.pdf`);
}
