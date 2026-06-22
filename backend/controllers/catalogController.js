const { Op } = require('sequelize');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const { getSettings, logActivity } = require('../utils/helpers');
const catalogGenerator = require('../utils/catalogGenerator');
const whatsappService = require('../services/whatsappService');
const fs = require('fs');
const path = require('path');

// Ensure cache directory exists
const getCacheDir = () => {
  const dir = path.resolve(__dirname, '..', 'uploads', 'catalogs');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

// Clear all cached catalog files
exports.clearCatalogCache = () => {
  try {
    const dir = getCacheDir();
    const files = fs.readdirSync(dir);
    for (const file of files) {
      fs.unlinkSync(path.join(dir, file));
    }
    console.log('[Catalog Cache] Cleared all generated catalog files due to product updates.');
  } catch (err) {
    console.error('[Catalog Cache] Failed to clear cache:', err.message);
  }
};

// 1. Unauthenticated Public Catalog List
exports.getPublicCatalog = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      where: { isArchived: false },
      order: [['category', 'ASC'], ['name', 'ASC']]
    });
    const settings = await getSettings();
    res.json({
      success: true,
      products,
      settings: {
        companyName: settings.companyName,
        logo: settings.logo,
        logoUrl: settings.logoUrl,
        websiteUrl: settings.websiteUrl,
        phone: settings.phone,
        email: settings.email,
        gstNumber: settings.gstNumber,
        brandColor: settings.brandColor
      }
    });
  } catch (err) {
    next(err);
  }
};

// 2. Download / Stream PDF Catalog (with Caching)
exports.downloadPdfCatalog = async (req, res, next) => {
  try {
    const category = req.query.category || 'All';
    const pricingType = req.query.pricingType || 'retail'; // retail, distributor, super_stockist, hide

    const cacheDir = getCacheDir();
    const cacheFilename = `catalog_PDF_${category.replace(/[^a-zA-Z0-9]/g, '_')}_${pricingType}.pdf`;
    const cachePath = path.join(cacheDir, cacheFilename);

    // Serve from cache if exists
    if (fs.existsSync(cachePath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="catalog-${category}-${pricingType}.pdf"`);
      return fs.createReadStream(cachePath).pipe(res);
    }

    // Query products
    const query = { isArchived: false };
    if (category !== 'All') {
      query.category = category;
    }

    const products = await Product.findAll({
      where: query,
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    const settings = await getSettings();

    // Generate PDF buffer
    const pdfBuffer = await catalogGenerator.buildPdfCatalog(products, settings, pricingType);

    // Write to cache file
    fs.writeFileSync(cachePath, pdfBuffer);

    // Send response
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="catalog-${category}-${pricingType}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};

// 3. Download / Stream Product SVG Image Catalog (with Caching)
exports.downloadImageCatalog = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const format = req.query.format || '1080x1080'; // 1080x1080, 1080x1350, 1080x1920
    const pricingType = req.query.pricingType || 'retail';

    const cacheDir = getCacheDir();
    const cacheFilename = `catalog_IMG_${productId}_${format}_${pricingType}.svg`;
    const cachePath = path.join(cacheDir, cacheFilename);

    // Serve from cache if exists
    if (fs.existsSync(cachePath)) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return fs.createReadStream(cachePath).pipe(res);
    }

    const product = await Product.findByPk(productId);
    if (!product || product.isArchived) {
      return res.status(404).json({ message: 'Product not found' });
    }

    const settings = await getSettings();

    // Generate SVG string
    const svgString = await catalogGenerator.buildSvgCatalog(product, settings, format, pricingType);

    // Write to cache file
    fs.writeFileSync(cachePath, svgString, 'utf-8');

    // Send response
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svgString);
  } catch (err) {
    next(err);
  }
};

// 4. WhatsApp Catalog Link or PDF Attachment Sharing
exports.sendCatalogWhatsApp = async (req, res, next) => {
  try {
    const { phone, customerId, pricingType = 'retail', category = 'All', format = 'pdf', productId } = req.body;

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required' });
    }

    const settings = await getSettings();
    const companyName = settings.companyName || 'Amudhasurabiy Organics';
    const contactPhone = settings.phone || '7010602115';
    const website = settings.websiteUrl || 'www.amudhasurabiy.com';

    let customerName = 'Customer';
    if (customerId) {
      const customer = await Customer.findByPk(customerId);
      if (customer) {
        customerName = customer.name;
      }
    }

    const messageText = `Hello ${customerName},\n\nThank you for your interest.\n\nPlease find our latest product catalog attached.\n\nRegards,\n${companyName}\n\nPhone: ${contactPhone}\nWebsite: ${website}`;

    const cacheDir = getCacheDir();

    if (format === 'pdf') {
      // 1. Generate / retrieve PDF from cache
      const cacheFilename = `catalog_PDF_${category.replace(/[^a-zA-Z0-9]/g, '_')}_${pricingType}.pdf`;
      const pdfPath = path.join(cacheDir, cacheFilename);

      if (!fs.existsSync(pdfPath)) {
        const query = { isArchived: false };
        if (category !== 'All') {
          query.category = category;
        }
        const products = await Product.findAll({
          where: query,
          order: [['category', 'ASC'], ['name', 'ASC']]
        });
        const pdfBuffer = await catalogGenerator.buildPdfCatalog(products, settings, pricingType);
        fs.writeFileSync(pdfPath, pdfBuffer);
      }

      // Send PDF document via whatsappService
      const result = await whatsappService.sendPdf(phone, messageText, pdfPath, customerId || null, 'Greeting');

      await logActivity(req.user.id, 'share', 'catalog', `Sent PDF catalog (${category} / ${pricingType}) to ${customerName} (${phone})`);

      res.json({
        success: true,
        message: 'Product catalog PDF sent successfully via WhatsApp.',
        messageId: result.messageId,
        logId: result.logId
      });
    } else {
      // Image format (SVG catalog)
      if (!productId) {
        return res.status(400).json({ message: 'Product ID is required for image catalog sharing' });
      }

      const product = await Product.findByPk(productId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const cacheFilename = `catalog_IMG_${productId}_1080x1080_${pricingType}.svg`;
      const svgPath = path.join(cacheDir, cacheFilename);

      if (!fs.existsSync(svgPath)) {
        const svgString = await catalogGenerator.buildSvgCatalog(product, settings, '1080x1080', pricingType);
        fs.writeFileSync(svgPath, svgString, 'utf-8');
      }

      // Send text message with a public link to the product card
      const publicLinkMessage = `${messageText}\n\nView product online: https://erp.amudhasurabiy.com/catalog?search=${encodeURIComponent(product.name)}`;
      const result = await whatsappService.sendMessage(phone, publicLinkMessage, customerId || null, 'Greeting');

      await logActivity(req.user.id, 'share', 'catalog', `Sent product image catalog link for ${product.name} to ${customerName} (${phone})`);

      res.json({
        success: true,
        message: 'Product catalog details shared successfully via WhatsApp.',
        messageId: result.messageId,
        logId: result.logId
      });
    }
  } catch (err) {
    next(err);
  }
};
