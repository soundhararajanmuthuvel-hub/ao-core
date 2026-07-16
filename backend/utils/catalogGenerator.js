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

      const brandColor = settings.brandColor || '#5a2d0c';
      const companyName = settings.companyName || 'Amudhasurabiy Organics';
      const website = settings.websiteUrl || 'www.amudhasurabiy.com';
      const phone = settings.phone || '7010602115';
      const email = settings.email || 'info@amudhasurabiy.com';
      const gstNumber = settings.gstNumber || '';

      // Load logo buffer if available
      const logoBuffer = await fetchImageBuffer(settings.logo || settings.logoUrl);

      let pageNumber = 1;

      // Draw Header & Footer helper
      const drawHeaderFooter = (currentPage) => {
        doc.save();
        
        // Header line
        doc.strokeColor(brandColor).lineWidth(1.5).moveTo(40, 60).lineTo(555, 60).stroke();

        // Logo / Title
        if (logoBuffer) {
          try {
            doc.image(logoBuffer, 40, 25, { height: 30 });
          } catch (e) {
            doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(14).text(companyName, 40, 32);
          }
        } else {
          doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(14).text(companyName, 40, 32);
        }

        // Subtitle
        doc.fillColor('#64748b').font('Helvetica').fontSize(8).text('PRODUCT CATALOG', 480, 28, { align: 'right', width: 75 });
        doc.text(new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), 450, 40, { align: 'right', width: 105 });

        // Footer line
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(40, 800).lineTo(555, 800).stroke();

        // Footer details
        doc.fillColor('#64748b').font('Helvetica').fontSize(7.5);
        doc.text(`Contact: ${phone}  |  Email: ${email}  |  Web: ${website}`, 40, 808, { width: 400 });
        if (gstNumber) {
          doc.text(`GSTIN: ${gstNumber}`, 40, 820);
        }
        doc.text(`Page ${currentPage}`, 480, 808, { align: 'right', width: 75 });

        doc.restore();
      };

      // 1. Cover Page
      doc.rect(0, 0, 595, 842).fill('#fffaf5');
      
      // Decorative border
      doc.strokeColor(brandColor).lineWidth(2).rect(20, 20, 555, 802).stroke();
      doc.strokeColor(brandColor).lineWidth(0.5).rect(24, 24, 547, 794).stroke();

      // Corner accents inside the decorative border
      doc.save();
      doc.strokeColor(brandColor).lineWidth(1.5);
      // Top Left corner frame
      doc.moveTo(24, 44).lineTo(24, 24).lineTo(44, 24).stroke();
      // Top Right corner frame
      doc.moveTo(568, 44).lineTo(568, 24).lineTo(548, 24).stroke();
      // Bottom Left corner frame
      doc.moveTo(24, 798).lineTo(24, 818).lineTo(44, 818).stroke();
      // Bottom Right corner frame
      doc.moveTo(568, 798).lineTo(568, 818).lineTo(548, 818).stroke();
      doc.restore();

      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 197, 180, { width: 200 });
        } catch (e) {}
      }

      doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(32).text(companyName, 40, 400, { align: 'center' });
      doc.fillColor('#334155').font('Helvetica-Bold').fontSize(16).text('OFFICIAL PRODUCT CATALOG & PRICE LIST', 40, 450, { align: 'center' });

      // Pricing context badge
      let tierLabel = 'RETAIL EDITION';
      if (pricingType === 'distributor') tierLabel = 'DISTRIBUTOR EDITION';
      if (pricingType === 'super_stockist') tierLabel = 'SUPER STOCKIST EDITION';
      if (pricingType === 'hide') tierLabel = 'PRODUCT PROFILE DIRECTORY';

      doc.fillColor(brandColor).rect(172, 500, 250, 25, { rx: 5 }).fill();
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text(tierLabel, 172, 508, { align: 'center', width: 250 });

      doc.fillColor('#64748b').font('Helvetica').fontSize(10).text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 40, 680, { align: 'center' });
      doc.text(`Website: ${website}  |  Phone: ${phone}`, 40, 700, { align: 'center' });

      pageNumber++;
      doc.addPage();

      // 2. Product Pages Grouped by Category
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

      let itemY = 80;
      let lastCategory = null;
      drawHeaderFooter(pageNumber);

      for (let i = 0; i < sortedProducts.length; i++) {
        const p = sortedProducts[i];
        const category = p.category || 'General';

        // Strip and clean the text elements
        const descText = cleanHtmlText(p.description || p.shortDescription || 'No description provided.');
        const ingText = p.ingredients ? cleanHtmlText(p.ingredients) : '';

        // Calculate card height dynamically
        let rightContentHeight = 15; // top margin
        
        // Product name height
        doc.font('Helvetica-Bold').fontSize(13);
        rightContentHeight += doc.heightOfString(p.name, { width: 345 }) + 3;

        // SKU / Category height
        doc.font('Helvetica-Bold').fontSize(7.5);
        const skuCatText = `SKU: ${p.sku || 'N/A'}    |    CATEGORY: ${category.toUpperCase()}`;
        rightContentHeight += doc.heightOfString(skuCatText, { width: 345 }) + 6;

        // Description height
        doc.font('Helvetica').fontSize(9);
        rightContentHeight += doc.heightOfString(descText, { width: 345, lineGap: 1 }) + 8;

        // Ingredients height
        if (ingText) {
          doc.font('Helvetica-Bold').fontSize(8);
          const fullIngText = `INGREDIENTS: ${ingText}`;
          rightContentHeight += doc.heightOfString(fullIngText, { width: 345 }) + 6;
        }

        // Barcode height
        if (p.barcode) {
          doc.font('Helvetica').fontSize(7.5);
          rightContentHeight += doc.heightOfString(`Barcode: ${p.barcode}`, { width: 345 }) + 6;
        }

        // Badge and Prices space
        rightContentHeight += 30; 
        rightContentHeight += 15; // bottom margin

        // Card height clamp
        const boxHeight = Math.max(150, rightContentHeight);

        // Check if category changed
        const categoryChanged = lastCategory !== category;
        let dividerHeight = categoryChanged ? 45 : 0;

        // Page break logic
        if (itemY + dividerHeight + boxHeight > 780) {
          pageNumber++;
          doc.addPage();
          drawHeaderFooter(pageNumber);
          itemY = 80;
        }

        // Draw Category Section Divider
        if (categoryChanged) {
          doc.save();
          doc.fillColor(brandColor).rect(40, itemY, 515, 26, { rx: 3 }).fill();
          doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text(category.toUpperCase(), 50, itemY + 8, { characterSpacing: 1.5 });
          doc.restore();
          itemY += 36;
          lastCategory = category;
        }

        // Draw Product Card Box
        doc.save();
        doc.rect(40, itemY, 515, boxHeight).fill('#ffffff');
        doc.strokeColor('#e2e8f0').lineWidth(0.75).rect(40, itemY, 515, boxHeight).stroke();

        // Image / Branded Placeholder Left Column
        const imgW = 110;
        const imgH = 110;
        const imgX = 55;
        const imgY = itemY + (boxHeight - imgH) / 2;

        const drawPlaceholder = (x, y, w, h) => {
          doc.save();
          doc.fillColor(brandColor).fillOpacity(0.04).rect(x, y, w, h, { rx: 5 }).fill();
          doc.strokeColor(brandColor).lineWidth(0.75).fillOpacity(1.0).rect(x + 4, y + 4, w - 8, h - 8, { rx: 4 }).stroke();
          
          const initials = companyName.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase() || 'AO';
          doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(20).text(initials, x, y + (h / 2) - 15, { align: 'center', width: w });
          doc.font('Helvetica-Oblique').fontSize(7.5).text('Organic Premium', x, y + (h / 2) + 12, { align: 'center', width: w });
          doc.restore();
        };

        const imgBuffer = await fetchImageBuffer(p.image);
        if (imgBuffer) {
          try {
            doc.image(imgBuffer, imgX, imgY, { width: imgW, height: imgH, fit: [imgW, imgH] });
          } catch (e) {
            drawPlaceholder(imgX, imgY, imgW, imgH);
          }
        } else {
          drawPlaceholder(imgX, imgY, imgW, imgH);
        }

        // Content Layout (Right Column)
        let textY = itemY + 15;
        const textX = 185;
        const textWidth = 355;

        // Product Name
        doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(13);
        doc.text(p.name, textX, textY, { width: textWidth });
        textY += doc.heightOfString(p.name, { width: textWidth }) + 3;

        // SKU / Category Info
        doc.fillColor('#64748b').font('Helvetica-Bold').fontSize(7.5);
        const skuCatString = `SKU: ${p.sku || 'N/A'}    |    CATEGORY: ${category.toUpperCase()}`;
        doc.text(skuCatString, textX, textY, { characterSpacing: 1.0 });
        textY += doc.heightOfString(skuCatString, { width: textWidth }) + 6;

        // Description
        doc.fillColor('#334155').font('Helvetica').fontSize(9);
        doc.text(descText, textX, textY, { width: textWidth, lineGap: 1 });
        textY += doc.heightOfString(descText, { width: textWidth, lineGap: 1 }) + 8;

        // Ingredients
        if (ingText) {
          doc.fillColor('#475569').font('Helvetica-Bold').fontSize(8);
          doc.text('INGREDIENTS: ', textX, textY, { continued: true });
          doc.font('Helvetica').fillColor('#64748b').text(ingText, { width: textWidth - 80 });
          textY += doc.heightOfString(`INGREDIENTS: ${ingText}`, { width: textWidth }) + 6;
        }

        // Barcode
        if (p.barcode) {
          doc.fillColor('#94a3b8').font('Helvetica').fontSize(7.5).text(`Barcode: ${p.barcode}`, textX, textY);
          textY += doc.heightOfString(`Barcode: ${p.barcode}`, { width: textWidth }) + 6;
        }

        // Bottom Badge & Pricing Row
        const bottomContentY = itemY + boxHeight - 30;

        // Pack Size Badge
        const packText = p.packSize ? `Pack: ${p.packSize}` : `Unit: 1 ${p.unit || 'pcs'}`;
        
        doc.save();
        doc.fillColor(brandColor).fillOpacity(0.06);
        doc.rect(textX, bottomContentY, 110, 16, { rx: 3 }).fill();
        doc.restore();
        
        doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(7.5).text(packText, textX + 5, bottomContentY + 4, { width: 100, align: 'center' });

        // Prices Block
        if (pricingType !== 'hide') {
          let priceToShow = p.sellingPrice;
          let tierName = 'Retail Price';

          if (pricingType === 'distributor') {
            priceToShow = Number(p.wholesalePrice) > 0 ? p.wholesalePrice : (Number(p.yellowPrice) > 0 ? p.yellowPrice : p.sellingPrice);
            tierName = 'Distributor Price';
          } else if (pricingType === 'super_stockist') {
            priceToShow = Number(p.greenPrice) > 0 ? p.greenPrice : p.sellingPrice;
            tierName = 'Stockist Price';
          }

          doc.fillColor('#64748b').font('Helvetica').fontSize(8.5).text(`MRP: Rs. ${Number(p.mrp || p.sellingPrice).toFixed(2)}`, textX + 130, bottomContentY + 3);
          doc.fillColor(brandColor).font('Helvetica-Bold').fontSize(10).text(`${tierName}: Rs. ${Number(priceToShow).toFixed(2)}`, textX + 220, bottomContentY + 2, { align: 'right', width: textWidth - 220 });
        }

        doc.restore();
        itemY += boxHeight + 15;
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
