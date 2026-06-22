const connectDB = require('./config/db');
const Product = require('./models/Product');
const catalogGenerator = require('./utils/catalogGenerator');
const catalogController = require('./controllers/catalogController');
const fs = require('fs');
const path = require('path');

async function runVerification() {
  console.log('=== START CATALOG SYSTEM VERIFICATION ===');
  try {
    // 1. Connect to DB
    await connectDB();
    console.log('✅ Connected to database.');

    // 2. Fetch active products or seed mock
    let products = await Product.findAll({ where: { isArchived: false } });
    if (products.length === 0) {
      console.log('⚠️ No active products found. Seeding a temporary test product...');
      await Product.create({
        name: 'Test Verify Malt',
        sku: 'TESTVMALT',
        barcode: '123456789012',
        category: 'Health Drink',
        stock: 50,
        mrp: 350.00,
        sellingPrice: 300.00,
        wholesalePrice: 280.00,
        ingredients: 'Beetroot, Carrot, Malt',
        benefits: 'Rich in vitamins\nBoosts immunity\nNatural ingredients',
        packSize: '500g'
      });
      products = await Product.findAll({ where: { isArchived: false } });
    }
    console.log(`✅ Loaded ${products.length} active products for testing.`);

    // 3. Test PDF Catalog Generation
    console.log('\n--- Testing PDF Catalog Generation ---');
    const settings = {
      companyName: 'Amudhasurabiy Organics (Test)',
      logoUrl: 'https://erp.amudhasurabiy.com/favicon.png',
      phone: '7010602115',
      email: 'info@amudhasurabiy.com',
      websiteUrl: 'www.amudhasurabiy.com',
      gstNumber: '33AABCA1234A1Z1',
      brandColor: '#5a2d0c'
    };

    const pdfBuffer = await catalogGenerator.buildPdfCatalog(products, settings, 'retail');
    if (Buffer.isBuffer(pdfBuffer) && pdfBuffer.length > 100) {
      console.log(`✅ PDF generation successful. Buffer size: ${pdfBuffer.length} bytes.`);
    } else {
      throw new Error('PDF Generation failed or returned empty buffer.');
    }

    // 4. Test SVG Catalog Generation
    console.log('\n--- Testing SVG Catalog Generation (Square, Story, Feed) ---');
    const testProduct = products[0];
    const formats = ['1080x1080', '1080x1350', '1080x1920'];
    
    for (const format of formats) {
      const svgString = await catalogGenerator.buildSvgCatalog(testProduct, settings, format, 'distributor');
      if (typeof svgString === 'string' && svgString.includes('<svg') && svgString.includes('</svg>')) {
        console.log(`✅ SVG generation for ${format} successful. Length: ${svgString.length} chars.`);
      } else {
        throw new Error(`SVG Generation failed for format ${format}`);
      }
    }

    // 5. Test Controller Cache Behavior
    console.log('\n--- Testing Controller Cache Behavior ---');
    // Clear cache first
    catalogController.clearCatalogCache();
    const cacheDir = path.resolve(__dirname, 'uploads', 'catalogs');
    const testFile = path.join(cacheDir, `catalog_PDF_All_retail.pdf`);
    
    if (fs.existsSync(testFile)) {
      throw new Error('Cache directory was not cleared properly.');
    }
    console.log('✅ Cache directory successfully cleared.');

    // Mock Express request/response for PDF download (triggers caching)
    let resHeaders = {};
    let responseData = null;
    const req = { query: { category: 'All', pricingType: 'retail' } };
    const res = {
      setHeader(name, val) {
        resHeaders[name] = val;
      },
      send(data) {
        responseData = data;
      }
    };

    await catalogController.downloadPdfCatalog(req, res, (err) => { if (err) throw err; });
    
    if (fs.existsSync(testFile)) {
      console.log('✅ PDF generated and successfully cached on disk.');
    } else {
      throw new Error('PDF Catalog download did not write cache file to disk.');
    }

    console.log('\n=== ALL CATALOG SYSTEM TESTS PASSED SUCCESSFULLY! ===');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ VERIFICATION FAILED:', error.message);
    process.exit(1);
  }
}

runVerification();
