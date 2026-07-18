const PDFDocument = require('pdfkit');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Helper to fetch image from URL or local path
const fetchImageBuffer = async (imgUrlOrPath) => {
  if (!imgUrlOrPath) return null;
  try {
    if (imgUrlOrPath.startsWith('http://') || imgUrlOrPath.startsWith('https://')) {
      const response = await axios.get(imgUrlOrPath, { responseType: 'arraybuffer', timeout: 5000 });
      return Buffer.from(response.data);
    } else {
      // Local path relative to backend root
      const localPath = path.resolve(__dirname, '..', imgUrlOrPath);
      if (fs.existsSync(localPath)) {
        return fs.readFileSync(localPath);
      }
    }
  } catch (err) {
    console.warn(`[Catalog Gen] Failed to fetch image: ${imgUrlOrPath} - ${err.message}`);
  }
  return null;
};

// Helper to clean HTML tags and decode HTML entities from text strings
const cleanHtmlText = (html) => {
  if (!html) return '';
  let text = html.replace(/<[^>]*>/g, ''); // Strip all tags
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
  return text.trim();
};

// Generates Premium PDF Catalog
exports.buildPdfCatalog = async (products, settings, pricingType = 'retail') => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      const brandColor = settings.brandColor || '#5a2d0c'; // default warm brown
      const companyName = settings.companyName || 'Amudhasurabiy Organics';
      const website = settings.websiteUrl || 'www.amudhasurabiy.com';
      const phone = settings.phone || '7010602115';
      const email = settings.email || 'info@amudhasurabiy.com';
      const gstNumber = settings.gstNumber || '';

      // Register custom premium serif fonts if available, fallback to standard serif
      const regularFontPath = path.resolve(__dirname, '..', 'assets', 'fonts', 'Lora-Regular.ttf');
      const boldFontPath = path.resolve(__dirname, '..', 'assets', 'fonts', 'Lora-Bold.ttf');
      
      if (fs.existsSync(regularFontPath)) {
        doc.registerFont('Lora', regularFontPath);
      } else {
        doc.registerFont('Lora', 'Times-Roman');
      }
      
      if (fs.existsSync(boldFontPath)) {
        doc.registerFont('Lora-Bold', boldFontPath);
      } else {
        doc.registerFont('Lora-Bold', 'Times-Bold');
      }

      // Load logo buffer if available
      const logoBuffer = await fetchImageBuffer(settings.logo || settings.logoUrl);

      let pageNumber = 1;

      // Draw Header & Footer helper
      const drawHeaderFooter = (currentPage) => {
        doc.save();
        
        // Header line (brass color)
        doc.strokeColor('#c9a25d').lineWidth(1).moveTo(40, 60).lineTo(555, 60).stroke();

        // Title Lora-Bold
        doc.fillColor('#2b1d14').font('Lora-Bold').fontSize(11).text(companyName, 40, 42);

        // Subtitle (Helvetica)
        doc.fillColor('#8fa383').font('Helvetica-Bold').fontSize(7.5).text('PRODUCT CATALOG', 480, 44, { align: 'right', width: 75, characterSpacing: 1 });

        // Footer line
        doc.strokeColor('#e6dfd5').lineWidth(0.5).moveTo(40, 800).lineTo(555, 800).stroke();

        // Footer details
        doc.fillColor('#8c7e75').font('Helvetica').fontSize(7.5);
        doc.text(`Contact: ${phone}  |  Email: ${email}  |  Web: ${website}`, 40, 808, { width: 400 });
        if (gstNumber) {
          doc.text(`GSTIN: ${gstNumber}`, 40, 820);
        }
        doc.text(`Page ${currentPage}`, 480, 808, { align: 'right', width: 75 });

        doc.restore();
      };

      // Draw elegant botanical leaf illustration for the cover page
      const drawBotanicalAccent = (centerX, centerY) => {
        doc.save();
        doc.strokeColor('#c9a25d').lineWidth(1.2).opacity(0.4);
        
        // Main stem curve
        doc.moveTo(centerX, centerY + 80)
           .bezierCurveTo(centerX - 10, centerY + 20, centerX + 10, centerY - 20, centerX, centerY - 80)
           .stroke();
        
        // Helper to draw a leaf shape
        const drawLeaf = (startX, startY, controlX1, controlY1, controlX2, controlY2, endX, endY) => {
          doc.moveTo(startX, startY)
             .bezierCurveTo(controlX1, controlY1, controlX2, controlY2, endX, endY)
             .bezierCurveTo(controlX2 - 5, controlY2 + 5, controlX1 + 5, controlY1 - 5, startX, startY)
             .fillAndStroke('#8fa383', '#c9a25d');
        };

        doc.fillColor('#8fa383').opacity(0.25);
        
        // Left leaf 1
        drawLeaf(centerX - 2, centerY + 40, centerX - 30, centerY + 30, centerX - 35, centerY + 10, centerX - 12, centerY + 22);
        // Right leaf 1
        drawLeaf(centerX + 2, centerY + 20, centerX + 30, centerY + 10, centerX + 35, centerY - 10, centerX + 12, centerY + 2);
        // Left leaf 2
        drawLeaf(centerX - 2, centerY - 10, centerX - 28, centerY - 20, centerX - 30, centerY - 38, centerX - 10, centerY - 25);
        // Right leaf 2
        drawLeaf(centerX + 2, centerY - 30, centerX + 28, centerY - 40, centerX + 30, centerY - 58, centerX + 10, centerY - 45);
        // Top leaf
        drawLeaf(centerX, centerY - 80, centerX - 12, centerY - 95, centerX + 12, centerY - 95, centerX, centerY - 110);

        doc.restore();
      };

      // 1. Cover Page (Dark espresso background)
      doc.rect(0, 0, 595, 842).fill('#2b1d14');
      
      // Dual frame border (Aged Brass & Gold)
      doc.strokeColor('#c9a25d').lineWidth(2).rect(20, 20, 555, 802).stroke();
      doc.strokeColor('#c9a25d').lineWidth(0.5).opacity(0.5).rect(24, 24, 547, 794).stroke();

      // Corner accents
      doc.save();
      doc.strokeColor('#c9a25d').lineWidth(1.5);
      doc.moveTo(24, 44).lineTo(24, 24).lineTo(44, 24).stroke(); // Top Left
      doc.moveTo(568, 44).lineTo(568, 24).lineTo(548, 24).stroke(); // Top Right
      doc.moveTo(24, 798).lineTo(24, 818).lineTo(44, 818).stroke(); // Bottom Left
      doc.moveTo(568, 798).lineTo(568, 818).lineTo(548, 818).stroke(); // Bottom Right
      doc.restore();

      // Draw custom leaf logo art in the center
      drawBotanicalAccent(297, 280);

      // Company Name
      doc.fillColor('#fffdf9').font('Lora-Bold').fontSize(24).text(companyName.toUpperCase(), 40, 420, { align: 'center', characterSpacing: 2 });
      
      // Separator Line
      doc.strokeColor('#c9a25d').lineWidth(1).moveTo(200, 470).lineTo(395, 470).stroke();

      doc.fillColor('#fffdf9').font('Lora').fontSize(14).text('OFFICIAL PRODUCT CATALOG', 40, 495, { align: 'center', characterSpacing: 1 });

      // Pricing context badge
      let tierLabel = 'RETAIL EDITION';
      if (pricingType === 'distributor') tierLabel = 'DISTRIBUTOR EDITION';
      if (pricingType === 'super_stockist') tierLabel = 'SUPER STOCKIST EDITION';
      if (pricingType === 'hide') tierLabel = 'PRODUCT DIRECTORY';

      doc.fillColor('#c9a25d').rect(172, 540, 250, 24, { rx: 4 }).fill();
      doc.fillColor('#2b1d14').font('Helvetica-Bold').fontSize(8.5).text(tierLabel, 172, 548, { align: 'center', width: 250, characterSpacing: 1 });

      doc.fillColor('#8c7e75').font('Helvetica').fontSize(9).text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 40, 710, { align: 'center' });
      doc.text(`Website: ${website}  |  Phone: ${phone}`, 40, 728, { align: 'center' });

      // 2. Content Pages Setup
      pageNumber++;
      doc.addPage();
      
      // Draw background fill for first content page
      doc.save();
      doc.fillColor('#fffdf9').rect(0, 0, 595, 842).fill();
      doc.restore();
      
      drawHeaderFooter(pageNumber);

      const sortedProducts = [...products].sort((a, b) => {
        const catA = (a.category || 'General').toLowerCase();
        const catB = (b.category || 'General').toLowerCase();
        if (catA < catB) return -1;
        if (catA > catB) return 1;

        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        if (nameA < nameB) return -1;
        if (nameA > nameB) return 1;
        return 0;
      });

      // 2-Column Grid Parameters
      const colWidth = 250;
      const cardHeight = 210;
      const leftPositions = [40, 305];
      const gutterY = 15;
      
      let rowY = 80;
      let colIndex = 0;
      let lastCategory = null;

      for (let i = 0; i < sortedProducts.length; i++) {
        const p = sortedProducts[i];
        const category = p.category || 'General';

        // Check if category changed
        const categoryChanged = lastCategory !== category;

        if (categoryChanged) {
          // If we were on the right column, reset to left column and move Y to next row
          if (colIndex === 1) {
            colIndex = 0;
            rowY = rowY + cardHeight + gutterY;
          }

          // Check Y limit to fit category title + at least 1 row of cards
          if (rowY + 45 + cardHeight > 780) {
            pageNumber++;
            doc.addPage();
            doc.save();
            doc.fillColor('#fffdf9').rect(0, 0, 595, 842).fill();
            doc.restore();
            drawHeaderFooter(pageNumber);
            rowY = 80;
          }

          // Draw Category Title Banner
          doc.save();
          doc.fillColor('#2b1d14').rect(40, rowY, 515, 26, { rx: 4 }).fill();
          doc.strokeColor('#c9a25d').lineWidth(1).moveTo(40, rowY + 26).lineTo(555, rowY + 26).stroke();
          doc.fillColor('#fffdf9').font('Lora-Bold').fontSize(10).text(category.toUpperCase(), 52, rowY + 9, { characterSpacing: 1.5 });
          doc.restore();

          rowY += 40;
          lastCategory = category;
        }

        // Draw Product Card at the current X/Y grid coordinate
        const cardX = leftPositions[colIndex];
        
        doc.save();
        // Soft white card box
        doc.fillColor('#ffffff').rect(cardX, rowY, colWidth, cardHeight, { rx: 6 }).fill();
        // Thin linen-like border
        doc.strokeColor('#e6dfd5').lineWidth(1).rect(cardX, rowY, colWidth, cardHeight, { rx: 6 }).stroke();
        doc.restore();

        // 1. Image Thumbnail Frame
        const imgX = cardX + 10;
        const imgY = rowY + 10;
        const imgW = 230;
        const imgH = 110;

        doc.save();
        doc.fillColor('#fdfaf6').rect(imgX, imgY, imgW, imgH, { rx: 4 }).fill();
        doc.strokeColor('#c9a25d').lineWidth(0.5).opacity(0.3).rect(imgX, imgY, imgW, imgH, { rx: 4 }).stroke();
        doc.restore();

        const drawMonogramPlaceholder = (x, y, w, h) => {
          doc.save();
          const initials = companyName.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase() || 'AO';
          doc.fillColor('#2b1d14').opacity(0.08).font('Lora-Bold').fontSize(36).text(initials, x, y + (h / 2) - 22, { align: 'center', width: w });
          doc.fillColor('#c9a25d').opacity(0.6).font('Lora').fontSize(7).text('ORGANIC SELECTION', x, y + (h / 2) + 16, { align: 'center', width: w, characterSpacing: 1.5 });
          doc.restore();
        };

        const imgBuffer = await fetchImageBuffer(p.image);
        if (imgBuffer) {
          try {
            doc.image(imgBuffer, imgX + 5, imgY + 5, {
              width: imgW - 10,
              height: imgH - 10,
              fit: [imgW - 10, imgH - 10],
              align: 'center',
              valign: 'center'
            });
          } catch (e) {
            drawMonogramPlaceholder(imgX, imgY, imgW, imgH);
          }
        } else {
          drawMonogramPlaceholder(imgX, imgY, imgW, imgH);
        }

        // 2. Product Name (Lora-Bold)
        doc.fillColor('#2b1d14').font('Lora-Bold').fontSize(9.5);
        doc.text(p.name, cardX + 12, rowY + 130, { width: colWidth - 24, height: 26, ellipsis: true });

        // 3. SKU / Pack Info
        doc.fillColor('#8c7e75').font('Helvetica').fontSize(7.5);
        const skuText = p.sku ? `SKU: ${p.sku}` : 'SKU: -';
        const packText = p.packSize ? `Pack: ${p.packSize}` : `Unit: 1 ${p.unit || 'pcs'}`;
        doc.text(`${skuText}   |   ${packText}`, cardX + 12, rowY + 160, { width: colWidth - 24, ellipsis: true });

        // Hairline separator before pricing
        doc.save();
        doc.strokeColor('#e6dfd5').lineWidth(0.5).moveTo(cardX + 12, rowY + 174).lineTo(cardX + colWidth - 12, rowY + 174).stroke();
        doc.restore();

        // 4. Prices
        if (pricingType !== 'hide') {
          let priceToShow = p.sellingPrice;
          let tierName = 'Retail Price';

          if (pricingType === 'distributor') {
            priceToShow = Number(p.wholesalePrice) > 0 ? p.wholesalePrice : (Number(p.yellowPrice) > 0 ? p.yellowPrice : p.sellingPrice);
            tierName = 'Distr. Price';
          } else if (pricingType === 'super_stockist') {
            priceToShow = Number(p.greenPrice) > 0 ? p.greenPrice : p.sellingPrice;
            tierName = 'Stockist Price';
          }

          doc.fillColor('#8c7e75').font('Helvetica').fontSize(7.5).text(`MRP: Rs. ${Number(p.mrp || p.sellingPrice).toFixed(2)}`, cardX + 12, rowY + 184);
          doc.fillColor('#2b1d14').font('Lora-Bold').fontSize(9.5).text(`Rs. ${Number(priceToShow).toFixed(2)}`, cardX + 120, rowY + 181, { align: 'right', width: colWidth - 132 });
          doc.fillColor('#c9a25d').font('Helvetica-Bold').fontSize(6.5).text(tierName.toUpperCase(), cardX + 120, rowY + 194, { align: 'right', width: colWidth - 132, characterSpacing: 0.5 });
        } else {
          doc.fillColor('#8fa383').font('Helvetica-Bold').fontSize(7.5).text('PRODUCT PROFILE', cardX + 12, rowY + 184);
          doc.fillColor('#c9a25d').font('Lora-Bold').fontSize(8.5).text('Details on Request', cardX + 120, rowY + 183, { align: 'right', width: colWidth - 132 });
        }

        // Advance layout coordinate parameters
        colIndex++;
        if (colIndex === 2) {
          colIndex = 0;
          rowY = rowY + cardHeight + gutterY;
        }

        // Check if next row will exceed vertical page threshold
        if (rowY + cardHeight > 780 && i < sortedProducts.length - 1) {
          pageNumber++;
          doc.addPage();
          doc.save();
          doc.fillColor('#fffdf9').rect(0, 0, 595, 842).fill();
          doc.restore();
          drawHeaderFooter(pageNumber);
          rowY = 80;
          colIndex = 0;
        }
      }

      // Finish document
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};


// Generates WhatsApp-friendly SVG Catalog Image
exports.buildSvgCatalog = async (product, settings, format = '1080x1080', pricingType = 'retail') => {
  let width = 1080;
  let height = 1080;
  if (format === '1080x1350') height = 1350;
  if (format === '1080x1920') height = 1920;

  const brandColor = settings.brandColor || '#5a2d0c';
  const companyName = settings.companyName || 'Amudhasurabiy Organics';
  const website = settings.websiteUrl || 'www.amudhasurabiy.com';
  const phone = settings.phone || '7010602115';

  // Pricing
  let priceToShow = product.sellingPrice;
  let tierLabel = 'Retail Price';
  if (pricingType === 'distributor') {
    priceToShow = Number(product.wholesalePrice) > 0 ? product.wholesalePrice : (Number(product.yellowPrice) > 0 ? product.yellowPrice : product.sellingPrice);
    tierLabel = 'Distributor Offer';
  } else if (pricingType === 'super_stockist') {
    priceToShow = Number(product.greenPrice) > 0 ? product.greenPrice : product.sellingPrice;
    tierLabel = 'Stockist Offer';
  }

  // QR Code URL link
  const publicCatalogLink = `https://erp.amudhasurabiy.com/catalog`; // standard fallback
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&color=${brandColor.replace('#', '')}&data=${encodeURIComponent(publicCatalogLink)}`;

  // Product Image
  const prodImgUrl = product.image ? `https://erp.amudhasurabiy.com/${product.image.replace(/^\//, '')}` : 'https://erp.amudhasurabiy.com/placeholder.png';
  const logoImgUrl = settings.logo || settings.logoUrl || 'https://erp.amudhasurabiy.com/favicon.png';

  // Benefits parsing
  const benefitsList = (product.benefits || 'High Quality Organic Raw Ingredients\nPacked Hygienically & Untouched by Hand\nRich in Vitamins and Micro-nutrients')
    .split('\n')
    .filter(Boolean)
    .slice(0, 4);

  // SVG Elements Coordinates depending on height (aspect ratio mapping)
  let logoY = 80;
  let imgY = 160;
  let imgHeight = 440;
  let infoY = 640;
  let benefitsY = 780;
  let footerY = height - 120;

  if (height === 1350) {
    imgY = 200;
    imgHeight = 520;
    infoY = 770;
    benefitsY = 940;
    footerY = 1200;
  } else if (height === 1920) {
    logoY = 120;
    imgY = 260;
    imgHeight = 700;
    infoY = 1040;
    benefitsY = 1260;
    footerY = 1720;
  }

  // Building SVG layout dynamically
  let svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fffdfb" />
      <stop offset="100%" stop-color="#fdf4eb" />
    </linearGradient>
    
    <!-- Shadow filter for card -->
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="10" stdDeviation="15" flood-color="#805e49" flood-opacity="0.15" />
    </filter>
  </defs>

  <!-- Elegant Background -->
  <rect width="${width}" height="${height}" fill="url(#bgGrad)" />
  
  <!-- Double Frame Border -->
  <rect x="25" y="25" width="${width - 50}" height="${height - 50}" fill="none" stroke="${brandColor}" stroke-width="4" rx="16" />
  <rect x="33" y="33" width="${width - 66}" height="${height - 66}" fill="none" stroke="${brandColor}" stroke-width="1.5" rx="12" stroke-dasharray="8,5" opacity="0.6" />

  <!-- Header - Company Logo & Name -->
  <g transform="translate(60, ${logoY})">
    <image href="${logoImgUrl}" x="0" y="-35" width="70" height="70" />
    <text x="90" y="0" font-family="'Montserrat', 'Inter', sans-serif" font-weight="800" font-size="28" fill="${brandColor}" letter-spacing="1.5">${companyName.toUpperCase()}</text>
    <text x="90" y="24" font-family="'Inter', sans-serif" font-weight="600" font-size="14" fill="#64748b" letter-spacing="3">100% NATURAL &amp; ORGANIC</text>
  </g>

  <!-- Centered Product Image Card -->
  <g filter="url(#shadow)">
    <rect x="190" y="${imgY}" width="700" height="${imgHeight}" rx="24" fill="#ffffff" stroke="#f3e8df" stroke-width="2" />
    <image href="${prodImgUrl}" x="220" y="${imgY + 30}" width="640" height="${imgHeight - 60}" preserveAspectRatio="xMidYMid meet" />
  </g>

  <!-- Product Info & Pricing -->
  <g transform="translate(60, ${infoY})">
    <!-- Pack Size Badge -->
    <rect x="0" y="0" width="160" height="36" rx="8" fill="${brandColor}" />
    <text x="80" y="23" font-family="'Inter', sans-serif" font-weight="800" font-size="16" fill="#ffffff" text-anchor="middle">${product.packSize || 'Standard'}</text>

    <!-- Product Title -->
    <text x="0" y="85" font-family="'Montserrat', 'Inter', sans-serif" font-weight="800" font-size="44" fill="#2d1502">${product.name}</text>
    
    <!-- Category -->
    <text x="0" y="125" font-family="'Inter', sans-serif" font-weight="600" font-size="16" fill="#64748b" letter-spacing="2">${(product.category || 'General').toUpperCase()}</text>

    <!-- Pricing Grid -->
    <g transform="translate(600, 30)">
      <!-- MRP Crossout -->
      <text x="360" y="0" font-family="'Inter', sans-serif" font-weight="600" font-size="20" fill="#94a3b8" text-anchor="end">MRP <tspan text-decoration="line-through">Rs. ${Number(product.mrp || product.sellingPrice).toFixed(0)}</tspan></text>
      
      <!-- Tier Pricing -->
      <rect x="120" y="15" width="240" height="60" rx="12" fill="#fef2f2" stroke="#fee2e2" stroke-width="2" />
      <text x="240" y="42" font-family="'Montserrat', 'Inter', sans-serif" font-weight="800" font-size="14" fill="#b91c1c" text-anchor="middle">${tierLabel.toUpperCase()}</text>
      <text x="240" y="65" font-family="'Montserrat', 'Inter', sans-serif" font-weight="800" font-size="28" fill="#b91c1c" text-anchor="middle">Rs. ${Number(priceToShow).toFixed(0)}/-</text>
    </g>
  </g>

  <!-- Benefits section -->
  <g transform="translate(60, ${benefitsY})">
    <text x="0" y="0" font-family="'Montserrat', 'Inter', sans-serif" font-weight="800" font-size="18" fill="${brandColor}" letter-spacing="2">KEY BENEFITS &amp; QUALITY FLAGS</text>
    <line x1="0" y1="12" x2="350" y2="12" stroke="${brandColor}" stroke-width="2" opacity="0.3" />
    
    ${benefitsList.map((benefit, idx) => `
      <g transform="translate(0, ${28 + idx * 32})">
        <circle cx="10" cy="12" r="6" fill="${brandColor}" opacity="0.8" />
        <path d="M7 12 l2 2 l4 -4" fill="none" stroke="#ffffff" stroke-width="2" />
        <text x="28" y="18" font-family="'Inter', sans-serif" font-weight="600" font-size="16" fill="#4a3b32">${benefit}</text>
      </g>
    `).join('')}
  </g>

  <!-- Footer - Contact & QR Link -->
  <g transform="translate(65, ${footerY})">
    <!-- QR Code Block -->
    <rect x="0" y="0" width="100" height="100" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="2" />
    <image href="${qrCodeUrl}" x="5" y="5" width="90" height="90" />
    <text x="115" y="40" font-family="'Inter', sans-serif" font-weight="700" font-size="16" fill="#2d1502">SCAN TO SHOP ONLINE</text>
    <text x="115" y="60" font-family="'Inter', sans-serif" font-weight="500" font-size="14" fill="#64748b">${website}</text>

    <!-- Support details -->
    <g transform="translate(650, 20)">
      <rect x="0" y="0" width="310" height="60" rx="30" fill="${brandColor}" />
      <text x="155" y="36" font-family="'Montserrat', 'Inter', sans-serif" font-weight="800" font-size="18" fill="#ffffff" text-anchor="middle">💬 ORDER: ${phone}</text>
    </g>
  </g>
</svg>
  `.trim();

  return svg;
};
