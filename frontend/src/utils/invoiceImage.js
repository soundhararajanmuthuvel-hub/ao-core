import html2canvas from 'html2canvas';

export function formatWhatsAppPhone(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

export function buildInvoiceMessage(sale, settings) {
  const company = settings?.companyName || 'AO Core';
  const lines = sale.items.map((i) => `• ${i.name} x${i.qty} = ₹${Number(i.lineTotal).toFixed(2)}`);
  return [
    `*${company}*`,
    `Invoice: *${sale.invoiceNumber}*`,
    `Date: ${new Date(sale.date).toLocaleDateString('en-IN')}`,
    '',
    ...lines,
    '',
    `*Total: ₹${Number(sale.grandTotal).toFixed(2)}*`,
    `Payment: ${String(sale.paymentStatus).toLowerCase() === 'partial' ? 'PARTIALLY PAID' : String(sale.paymentStatus).toUpperCase()}`,
    '',
    'Thank you!',
  ].join('\n');
}

export async function captureInvoiceElement(element) {
  if (!element) throw new Error('Invoice element not found');
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Failed to create image'))),
      'image/jpeg',
      0.92
    );
  });
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadInvoiceJpg(element, filename) {
  const blob = await captureInvoiceElement(element);
  downloadBlob(blob, filename || 'invoice.jpg');
  return blob;
}

export async function shareInvoiceWhatsApp(sale, settings, element) {
  const blob = await captureInvoiceElement(element);
  const filename = `${sale.invoiceNumber}.jpg`;
  const text = buildInvoiceMessage(sale, settings);
  const phone = formatWhatsAppPhone(sale.customer?.phone);

  const file = new File([blob], filename, { type: 'image/jpeg' });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ title: `Invoice ${sale.invoiceNumber}`, text, files: [file] });
      return { method: 'share' };
    } catch (e) {
      if (e.name === 'AbortError') return { method: 'cancelled' };
    }
  }

  downloadBlob(blob, filename);
  const attachNote = '\n\n📎 Invoice JPG downloaded — please attach it in WhatsApp.';
  const waUrl = phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(text + attachNote)}`
    : `https://wa.me/?text=${encodeURIComponent(text + attachNote)}`;
  window.open(waUrl, '_blank');
  return { method: 'whatsapp', downloaded: true };
}
