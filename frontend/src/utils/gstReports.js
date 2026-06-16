import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

export const formatReportDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN');
};

const addSummaryCards = (doc, cards, startY) => {
  if (!cards.length) return startY;

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const availableWidth = pageWidth - margin * 2;
  const columns = 3;
  const gap = 4;
  const cardWidth = (availableWidth - gap * (columns - 1)) / columns;
  const cardHeight = 18;

  cards.forEach((card, index) => {
    const row = Math.floor(index / columns);
    const col = index % columns;
    const x = margin + col * (cardWidth + gap);
    const y = startY + row * (cardHeight + 6);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(String(card.label || '').toUpperCase(), x + 3, y + 6);

    doc.setFontSize(11);
    doc.setTextColor(card.color || 15, card.color ? undefined : 23, card.color ? undefined : 42);
    doc.text(String(card.value ?? ''), x + 3, y + 13);
  });

  const rows = Math.ceil(cards.length / columns);
  return startY + rows * (cardHeight + 6) + 2;
};

export function exportGstReportPdf({
  title,
  subtitle,
  summaryCards = [],
  sections = [],
  filename = 'gst-report.pdf',
}) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 210, 10, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text(title || 'GST Report', 14, 20);

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 14, 26);
  }

  let cursorY = addSummaryCards(doc, summaryCards, 32);

  sections.forEach((section, index) => {
    if (index > 0 || summaryCards.length) {
      cursorY += 4;
    }

    if (section.title) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text(section.title, 14, cursorY);
      cursorY += 4;
    }

    autoTable(doc, {
      startY: cursorY,
      head: [section.columns || []],
      body: section.rows || [],
      theme: 'striped',
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: 2.5,
      },
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: section.columnStyles || {},
      margin: { left: 14, right: 14 },
    });

    cursorY = doc.lastAutoTable.finalY + 8;
  });

  doc.save(filename);
}
