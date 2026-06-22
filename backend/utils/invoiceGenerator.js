const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const fetchImageBuffer = async (imgUrlOrPath) => {
  if (!imgUrlOrPath) return null;
  try {
    if (imgUrlOrPath.startsWith('http://') || imgUrlOrPath.startsWith('https://')) {
      const response = await axios.get(imgUrlOrPath, { responseType: 'arraybuffer', timeout: 5000 });
      return Buffer.from(response.data);
    } else {
      const cleanPath = imgUrlOrPath.startsWith('/') ? imgUrlOrPath.substring(1) : imgUrlOrPath;
      const localPath = path.resolve(__dirname, '..', cleanPath);
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath);
      }
    }
  } catch (err) {
    console.warn(`[Invoice PDF Gen] Failed to fetch image: ${imgUrlOrPath} - ${err.message}`);
  }
  return null;
};

exports.generateInvoicePdf = async (invoice, settings, destPath) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      
      const invoicesDir = path.dirname(destPath);
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      const stream = fs.createWriteStream(destPath);
      doc.pipe(stream);

      const brandColor = settings.brandColor || '#2563eb';
      const companyName = settings.companyName || 'AO Core Organic';
      const address = settings.address || '';
      const phone = settings.phone || '';
      const email = settings.email || '';
      const gstNumber = settings.gstNumber || '';

      // Load logo buffer
      const logoBuffer = await fetchImageBuffer(settings.logo || settings.logoUrl);

      // Accent color bar
      doc.rect(0, 0, 595, 15).fill(brandColor);

      let textStartX = 40;
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 40, 30, { height: 40 });
          textStartX = 180;
        } catch (e) {
          console.warn('PDF logo rendering failed:', e.message);
        }
      }

      // Company info
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(18).text(companyName, textStartX, 30);
      doc.fillColor('#475569').font('Helvetica').fontSize(9);
      let currentY = 50;
      if (address) {
        doc.text(address, textStartX, currentY, { width: 220 });
        currentY += doc.heightOfString(address, { width: 220 }) + 3;
      }
      if (gstNumber) {
        doc.text(`GSTIN: ${gstNumber}`, textStartX, currentY);
        currentY += 12;
      }
      if (phone || email) {
        doc.text(`Phone: ${phone} | Email: ${email}`, textStartX, currentY);
      }

      // Metadata (Top Right)
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(16).text('INVOICE', 400, 30, { align: 'right', width: 155 });
      doc.fillColor('#475569').font('Helvetica').fontSize(9.5);
      doc.text(`Invoice No: ${invoice.invoiceNumber}`, 400, 50, { align: 'right', width: 155 });
      doc.text(`Date: ${new Date(invoice.date || invoice.createdAt).toLocaleDateString()}`, 400, 65, { align: 'right', width: 155 });
      
      const paymentStatus = (invoice.paymentStatus || 'pending').toUpperCase();
      let statusColor = '#ef4444';
      if (paymentStatus === 'PAID') statusColor = '#22c55e';
      else if (paymentStatus === 'PARTIAL') statusColor = '#eab308';
      doc.fillColor(statusColor).font('Helvetica-Bold').text(`Status: ${paymentStatus}`, 400, 80, { align: 'right', width: 155 });

      // Divider line
      doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(40, 110).lineTo(555, 110).stroke();

      // Bill To details
      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(10).text('BILL TO:', 40, 125);
      const customerName = invoice.customer?.name || 'Walk-in Customer';
      doc.fillColor('#1e293b').font('Helvetica-Bold').fontSize(12).text(customerName, 40, 140);
      
      doc.fillColor('#475569').font('Helvetica').fontSize(9);
      let customerY = 155;
      if (invoice.customer?.phone) {
        doc.text(`Phone: ${invoice.customer.phone}`, 40, customerY);
        customerY += 13;
      }
      if (invoice.customer?.address) {
        doc.text(invoice.customer.address, 40, customerY, { width: 300 });
        customerY += doc.heightOfString(invoice.customer.address, { width: 300 }) + 3;
      }
      if (invoice.customer?.gstNumber) {
        doc.text(`GSTIN: ${invoice.customer.gstNumber}`, 40, customerY);
        customerY += 13;
      }

      // Products Table Headers
      let tableY = Math.max(customerY + 15, 230);
      doc.rect(40, tableY, 515, 20).fill(brandColor);
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(9);
      doc.text('Item Description', 45, tableY + 6);
      doc.text('Qty', 320, tableY + 6, { width: 40, align: 'center' });
      doc.text('Unit Price', 370, tableY + 6, { width: 60, align: 'right' });
      doc.text('GST%', 440, tableY + 6, { width: 40, align: 'center' });
      doc.text('Total Amount', 490, tableY + 6, { width: 60, align: 'right' });

      tableY += 20;

      // Table Body
      const items = invoice.items || [];
      doc.fillColor('#334155').font('Helvetica').fontSize(9);
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (i % 2 === 1) {
          doc.rect(40, tableY, 515, 20).fill('#f8fafc');
          doc.fillColor('#334155');
        } else {
          doc.fillColor('#334155');
        }

        const name = item.name || '';
        const qty = String(item.qty || 0);
        const price = `Rs. ${Number(item.unitPrice || 0).toFixed(2)}`;
        const gst = `${item.gstPercent || 0}%`;
        const total = `Rs. ${Number(item.lineTotal || (item.qty * item.unitPrice)).toFixed(2)}`;

        doc.text(name, 45, tableY + 6, { width: 270, lineBreak: false });
        doc.text(qty, 320, tableY + 6, { width: 40, align: 'center' });
        doc.text(price, 370, tableY + 6, { width: 60, align: 'right' });
        doc.text(gst, 440, tableY + 6, { width: 40, align: 'center' });
        doc.text(total, 490, tableY + 6, { width: 60, align: 'right' });

        tableY += 20;
      }

      // Summary block
      let summaryY = tableY + 15;
      if (summaryY > 700) {
        doc.addPage();
        summaryY = 50;
      }

      doc.rect(345, summaryY, 210, 80).fill('#f8fafc');
      doc.fillColor('#475569').font('Helvetica').fontSize(9.5);
      
      doc.text('Subtotal:', 355, summaryY + 10);
      doc.text(`Rs. ${Number(invoice.subtotal || 0).toFixed(2)}`, 545, summaryY + 10, { align: 'right' });

      doc.text('GST Total:', 355, summaryY + 25);
      doc.text(`Rs. ${Number(invoice.gstTotal || 0).toFixed(2)}`, 545, summaryY + 25, { align: 'right' });

      doc.text('Discount:', 355, summaryY + 40);
      doc.text(`Rs. ${Number(invoice.discount || 0).toFixed(2)}`, 545, summaryY + 40, { align: 'right' });

      doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(355, summaryY + 52).lineTo(545, summaryY + 52).stroke();

      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(10.5);
      doc.text('Grand Total:', 355, summaryY + 62);
      doc.text(`Rs. ${Number(invoice.grandTotal || 0).toFixed(2)}`, 545, summaryY + 62, { align: 'right' });

      // UPI payment instructions
      if (settings.upiId) {
        doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(9.5).text('PAYMENT VIA UPI:', 40, summaryY + 10);
        doc.fillColor('#334155').font('Helvetica').fontSize(9);
        doc.text(`Payee Name: ${settings.payeeName || companyName}`, 40, summaryY + 25);
        doc.text(`UPI ID: ${settings.upiId}`, 40, summaryY + 40);
      }

      // Footer
      doc.fillColor('#94a3b8').font('Helvetica-Oblique').fontSize(8.5);
      doc.text('Thank you for choosing us! We appreciate your business.', 40, 770);
      doc.text('Terms & Conditions: Goods once sold cannot be returned or exchanged.', 40, 785);

      doc.end();

      stream.on('finish', () => resolve(destPath));
      stream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
};
