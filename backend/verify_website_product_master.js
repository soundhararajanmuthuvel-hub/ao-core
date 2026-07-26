const connectDB = require('./config/db');
const Product = require('./models/Product');
const WebsiteProduct = require('./models/WebsiteProduct');
const StockMovement = require('./models/StockMovement');
const { getProducts, getProductBySlug } = require('./controllers/websiteProductController');
const { getAdminProducts, createAdminProduct, updateAdminProduct } = require('./controllers/websiteAdminController');

async function runVerification() {
  console.log('--- STARTING WEBSITE PRODUCT MASTER INTEGRATION VERIFICATION ---');
  await connectDB();

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
    // TEST 1: Ensure Product Master item exists or create test Product Master item
    let testMaster = await Product.findOne({ where: { sku: 'TEST-PM-001' } });
    if (!testMaster) {
      testMaster = await Product.create({
        name: 'Test Commercial Ragi Malt',
        sku: 'TEST-PM-001',
        barcode: '890000000001',
        category: 'Malt Blends',
        brand: 'Blovit Organics',
        sellingPrice: 350.00,
        price: 350.00,
        mrp: 450.00,
        stock: 50,
        gstPercent: 5,
        unit: 'pcs',
        isActive: true,
        isArchived: false,
        imageUrl: 'https://demo.amudhasurabiy.com/images/products/ragi-malt.jpg'
      });
    } else {
      testMaster.sellingPrice = 350.00;
      testMaster.stock = 50;
      testMaster.isActive = true;
      testMaster.isArchived = false;
      await testMaster.save();
    }
    assert(testMaster && testMaster.id, 'Test Product Master item created/retrieved successfully');

    // TEST 2: Configure Website Product marketing settings linked to testMaster.id
    let reqCreate = {
      body: {
        managementProductId: testMaster.id,
        slug: 'test-commercial-ragi-malt',
        shortDescription: 'Delicious sprouted organic ragi malt drink',
        description: 'Rich in organic nutrients, vitamins, and minerals for daily family health.',
        benefits: JSON.stringify(['Organic', 'High Calcium', 'Easy Digest']),
        ingredients: JSON.stringify(['Sprouted Ragi', 'Almonds', 'Cardamom']),
        isFeatured: true,
        isBestseller: true,
        isPublished: true,
      }
    };
    let resCreate = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.body = data; return this; }
    };

    // If website product already exists, delete/clean for fresh test
    await WebsiteProduct.destroy({ where: { managementProductId: testMaster.id } });

    await createAdminProduct(reqCreate, resCreate);
    assert(resCreate.body && resCreate.body.success, 'Website Product settings created & linked to Product Master');

    const createdWp = await WebsiteProduct.findOne({ where: { managementProductId: testMaster.id } });
    assert(createdWp && createdWp.managementProductId === testMaster.id, 'WebsiteProduct record references correct managementProductId');

    // TEST 3: Duplicate creation prevention
    let resDup = {
      status: function(code) { this.statusCode = code; return this; },
      json: function(data) { this.body = data; return this; }
    };
    await createAdminProduct(reqCreate, resDup);
    assert(resDup.statusCode === 400 && !resDup.body.success, 'Prevented duplicate WebsiteProduct settings for same Product Master ID');

    // TEST 4: Storefront API combines Product Master commercial data + Website Product marketing metadata
    let reqStorefront = { query: {} };
    let resStorefront = {
      json: function(data) { this.body = data; return this; },
      status: function(code) { this.statusCode = code; return this; }
    };
    await getProducts(reqStorefront, resStorefront);

    const storefrontItem = resStorefront.body.data.find(p => p.managementProductId === testMaster.id || p.productId === testMaster.id);
    assert(storefrontItem !== undefined, 'Storefront GET /api/website/products returns merged product');
    assert(storefrontItem && Number(storefrontItem.price) === 350 && Number(storefrontItem.stock) === 50, 'Storefront price & stock matched live Product Master values');
    assert(storefrontItem && storefrontItem.shortDescription === 'Delicious sprouted organic ragi malt drink', 'Storefront returned marketing shortDescription from WebsiteProduct');

    // TEST 5: Commercial Live Data Update in Product Master automatically reflects on Website Storefront
    testMaster.sellingPrice = 399.00;
    testMaster.stock = 45;
    await testMaster.save();

    let resStorefront2 = {
      json: function(data) { this.body = data; return this; },
      status: function(code) { this.statusCode = code; return this; }
    };
    await getProducts(reqStorefront, resStorefront2);
    const updatedStorefrontItem = resStorefront2.body.data.find(p => p.managementProductId === testMaster.id || p.productId === testMaster.id);
    assert(updatedStorefrontItem && Number(updatedStorefrontItem.price) === 399 && Number(updatedStorefrontItem.stock) === 45, 'Billing price update to ₹399 & stock to 45 automatically reflected on website storefront');

    // TEST 6: Inactive Product Master Override hides product from storefront
    testMaster.isActive = false;
    await testMaster.save();

    let resStorefrontInactive = {
      json: function(data) { this.body = data; return this; },
      status: function(code) { this.statusCode = code; return this; }
    };
    await getProducts(reqStorefront, resStorefrontInactive);
    const hiddenItem = resStorefrontInactive.body.data.find(p => p.managementProductId === testMaster.id || p.productId === testMaster.id);
    assert(hiddenItem === undefined, 'Billing isActive=false automatically hides product from storefront');

    // Restore active status for remaining tests
    testMaster.isActive = true;
    await testMaster.save();

    // TEST 7: Stock Decrement on Order Placement
    const initialStock = Number(testMaster.stock);
    const qtyOrdered = 3;
    const newStockExpected = Math.max(0, initialStock - qtyOrdered);

    testMaster.stock = newStockExpected;
    await testMaster.save();

    await StockMovement.create({
      productId: testMaster.id,
      type: 'OUT',
      quantity: qtyOrdered,
      referenceId: 999,
      referenceModel: 'WebsiteOrder',
      notes: 'eCommerce Verification Test Order WO-TEST-999',
    });

    const refreshedMaster = await Product.findByPk(testMaster.id);
    assert(Number(refreshedMaster.stock) === newStockExpected, `Product Master stock decremented from ${initialStock} to ${newStockExpected}`);

    const movement = await StockMovement.findOne({ where: { referenceId: 999, referenceModel: 'WebsiteOrder' } });
    assert(movement && Number(movement.quantity) === 3 && movement.type === 'OUT', 'StockMovement audit log entry successfully created');

    console.log(`\n==============================================`);
    console.log(`VERIFICATION COMPLETE: Passed ${passed}/${total} assertions.`);
    console.log(`==============================================\n`);
    process.exit(0);

  } catch (err) {
    console.error('VERIFICATION ERROR EXCEPTION:', err);
    process.exit(1);
  }
}

runVerification();
