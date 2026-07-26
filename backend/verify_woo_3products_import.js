const connectDB = require('./config/db');
const WooCommerceService = require('./utils/wooService');
const Product = require('./models/Product');
const axios = require('axios');

async function runVerification() {
  console.log('=== STARTING WOOCOMMERCE PRODUCT SYNC (3 PRODUCTS) VERIFICATION ===');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`✕ FAIL: ${message}`);
    }
  }

  try {
    // Step 1: Connect Database & Trigger Dynamic Schema Alignment
    await connectDB();
    console.log('✓ Database connected and dynamic schema alignment executed.');

    // Verify 'images' column exists on Product model and table
    assert(Product.rawAttributes.images !== undefined, 'Product model has images attribute defined');

    // Clean up previous test products
    const testSkus = ['WOO-RAGI-250', 'WOO-BEET-200', 'WOO-TURM-100'];
    await Product.destroy({ where: { sku: testSkus } });
    console.log('✓ Cleaned up any prior test records.');

    // Mock 3 Published WooCommerce Products Payload
    const mock3WooProducts = [
      {
        id: 101,
        name: 'Sprouted Ragi Malt 250g',
        sku: 'WOO-RAGI-250',
        slug: 'sprouted-ragi-malt-250g',
        regular_price: '299',
        sale_price: '249',
        price: '249',
        stock_quantity: 45,
        status: 'publish',
        stock_status: 'instock',
        weight: '0.250',
        dimensions: { length: '10', width: '5', height: '15' },
        categories: [{ id: 1, name: 'Health Mixes' }],
        tags: [{ name: 'Organic' }, { name: 'Superfood' }],
        attributes: [{ name: 'Brand', options: ['Amudhasurabiy'] }],
        images: [
          { id: 1001, src: 'https://demo.amudhasurabiy.com/ragi-front.jpg' },
          { id: 1002, src: 'https://demo.amudhasurabiy.com/ragi-back.jpg' }
        ],
        description: 'Nutritious sprouted ragi malt rich in calcium and iron.',
        short_description: 'Pure organic sprouted ragi malt',
        tax_class: 'GST_5',
        permalink: 'https://demo.amudhasurabiy.com/product/sprouted-ragi-malt-250g',
        date_modified: '2026-07-26T12:00:00'
      },
      {
        id: 102,
        name: 'Organic Beetroot Malt 200g',
        sku: 'WOO-BEET-200',
        slug: 'organic-beetroot-malt-200g',
        regular_price: '349',
        sale_price: '0',
        price: '349',
        stock_quantity: 30,
        status: 'publish',
        stock_status: 'instock',
        weight: '0.200',
        dimensions: { length: '8', width: '4', height: '12' },
        categories: [{ id: 1, name: 'Health Mixes' }],
        tags: [{ name: 'Beetroot' }],
        attributes: [{ name: 'Brand', options: ['Amudhasurabiy'] }],
        images: [
          { id: 1003, src: 'https://demo.amudhasurabiy.com/beetroot.jpg' }
        ],
        description: 'Delicious beetroot malt blend for natural stamina.',
        short_description: 'Natural beetroot drink mix',
        tax_class: 'GST_5',
        permalink: 'https://demo.amudhasurabiy.com/product/organic-beetroot-malt-200g',
        date_modified: '2026-07-26T12:30:00'
      },
      {
        id: 103,
        name: 'Herbal Turmeric Powder 100g',
        sku: 'WOO-TURM-100',
        slug: 'herbal-turmeric-powder-100g',
        regular_price: '150',
        sale_price: '120',
        price: '120',
        stock_quantity: 100,
        status: 'publish',
        stock_status: 'instock',
        weight: '0.100',
        dimensions: { length: '5', width: '3', height: '10' },
        categories: [{ id: 2, name: 'Spices' }],
        tags: [{ name: 'Herbal' }],
        attributes: [{ name: 'Brand', options: ['Amudhasurabiy'] }],
        images: [
          { id: 1004, src: 'https://demo.amudhasurabiy.com/turmeric.jpg' }
        ],
        description: 'Pure high-curcumin herbal turmeric powder.',
        short_description: 'High curcumin organic turmeric',
        tax_class: 'GST_5',
        permalink: 'https://demo.amudhasurabiy.com/product/herbal-turmeric-powder-100g',
        date_modified: '2026-07-26T13:00:00'
      }
    ];

    // Mock axios.get for WooCommerce API endpoint
    const origAxiosGet = axios.get;
    axios.get = async function(url, config) {
      if (url.includes('/wp-json/wc/v3/products')) {
        return { data: mock3WooProducts };
      }
      return origAxiosGet.apply(this, arguments);
    };

    // Instantiate WooCommerceService
    const mockSettings = {
      wooUrl: 'https://demo.amudhasurabiy.com',
      wooConsumerKey: 'ck_mock_key',
      wooConsumerSecret: 'cs_mock_secret',
      wooProductSyncMode: 'Two-Way Sync'
    };

    const wooService = new WooCommerceService(mockSettings);

    console.log('\n--- 1. Testing WooCommerce Product Import Execution ---');
    const result = await wooService.importProductsDetailed();

    assert(result.success === true, 'importProductsDetailed returned success: true');
    assert(result.summary.received === 3, 'Products Found: 3');
    assert(result.summary.imported === 3, 'Imported: 3');
    assert(result.summary.updated === 0, 'Updated: 0');
    assert(result.summary.skipped === 0, 'Skipped: 0');
    assert(result.summary.failed === 0, 'Failed: 0 (No SQL errors, no missing columns)');

    // Restore axios.get
    axios.get = origAxiosGet;

    console.log('\n--- 2. Verifying Database Record Attributes ---');
    for (const mockItem of mock3WooProducts) {
      const dbProd = await Product.findOne({ where: { sku: mockItem.sku } });
      assert(dbProd !== null, `Product ${mockItem.sku} exists in database`);
      if (dbProd) {
        assert(dbProd.name === mockItem.name, `Name matches: ${dbProd.name}`);
        assert(Number(dbProd.price) === Number(mockItem.regular_price), `Price matches: ${dbProd.price}`);
        assert(Number(dbProd.salePrice) === Number(mockItem.sale_price), `Sale price matches: ${dbProd.salePrice}`);
        assert(Number(dbProd.stock) === Number(mockItem.stock_quantity), `Stock matches: ${dbProd.stock}`);
        assert(dbProd.category === mockItem.categories[0].name, `Category matches: ${dbProd.category}`);
        assert(dbProd.brand === 'Amudhasurabiy', `Brand matches: ${dbProd.brand}`);
        assert(dbProd.image === mockItem.images[0].src, `Featured image URL matches: ${dbProd.image}`);
        
        // Verify 'images' column JSON string content
        let parsedImages = [];
        try {
          parsedImages = JSON.parse(dbProd.images || '[]');
        } catch (e) {}
        assert(parsedImages.length === mockItem.images.length, `Images column contains ${parsedImages.length} image URLs`);
        assert(parsedImages[0] === mockItem.images[0].src, 'Images column URL matches featured image');
      }
    }

    console.log('\n--- 3. Testing Partial Failure Handling & Isolation ---');
    const mockPayloadWith1Bad = [
      {
        id: null, // Invalid: missing product ID
        name: 'Invalid Bad Product',
        sku: 'BAD-001'
      },
      {
        id: 104,
        name: 'Valid Product 4',
        sku: 'WOO-VAL-004',
        regular_price: '199',
        stock_quantity: 10,
        images: [{ src: 'https://demo.amudhasurabiy.com/val4.jpg' }]
      }
    ];

    axios.get = async function(url, config) {
      if (url.includes('/wp-json/wc/v3/products')) {
        return { data: mockPayloadWith1Bad };
      }
      return origAxiosGet.apply(this, arguments);
    };

    const partialResult = await wooService.importProductsDetailed();
    axios.get = origAxiosGet;

    assert(partialResult.summary.received === 2, 'Received 2 items in payload');
    assert(partialResult.summary.imported === 1, 'Imported 1 valid product independently');
    assert(partialResult.summary.failed === 1, '1 bad product failed and was isolated');
    assert(partialResult.summary.errors.length === 1, 'Errors list recorded 1 failure');
    assert(partialResult.summary.errors[0].stage === 'Validation', 'Failure stage recorded as Validation');

    // Clean up test records
    await Product.destroy({ where: { sku: [...testSkus, 'WOO-VAL-004'] } });
    console.log('\n✓ Cleanup complete.');

    console.log('\n==================================================');
    console.log(`VERIFICATION COMPLETE: ${passed} / ${total} ASSERTS PASSED`);
    console.log('==================================================');

    if (passed === total) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ VERIFICATION FAILED WITH EXCEPTION:', err);
    process.exit(1);
  }
}

runVerification();
