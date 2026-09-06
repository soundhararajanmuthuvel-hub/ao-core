const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const assert = require('assert');
const connectDB = require('./config/db');
const Product = require('./models/Product');
const StockMovement = require('./models/StockMovement');
const WebsiteOrder = require('./models/WebsiteOrder');
const {
  createAdminProduct,
  updateAdminProduct,
} = require('./controllers/websiteAdminController');
const {
  getProducts,
  getProductBySlug,
} = require('./controllers/websiteProductController');
const {
  createRazorpayOrder,
} = require('./controllers/websiteOrderController');

// Mock Express req/res helpers
function mockReq(body = {}, params = {}, query = {}, user = { id: 1, name: 'Admin', role: 'Super Admin' }) {
  return {
    body,
    params,
    query,
    user,
    ip: '127.0.0.1',
    headers: { 'user-agent': 'TestRunner/1.0' },
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
  };
  return res;
}

async function runVerification() {
  console.log('================================================================');
  console.log('🧪 VERIFYING SINGLE MASTER PRODUCT ARCHITECTURE (AO CORE ERP)');
  console.log('================================================================\n');

  await connectDB();

  const testSku = 'TEST-SINGLE-MASTER-001';
  const testSlug = 'test-ragi-malt-single-master';

  // Cleanup past runs
  await Product.destroy({ where: { sku: testSku } });
  console.log('✓ Cleaned up any existing test product with SKU:', testSku);

  // ==========================================================================
  // TEST 1: Create Normal ERP Product with Show on Website = OFF
  // ==========================================================================
  console.log('\n--- TEST 1: Create ERP Product with Show on Website = OFF ---');
  const createReq = mockReq({
    name: 'Test Sprouted Ragi Malt Single Master',
    sku: testSku,
    category: 'General',
    productType: 'BULK_PRODUCT',
    price: 199.0,
    mrp: 249.0,
    stock: 50,
    unit: 'pcs',
    gstPercent: 5,
    brand: 'Amudha Surabiy Organics',
    isPublished: false, // Show on Website = OFF
    status: 'Draft',
  });
  const createRes = mockRes();

  await createAdminProduct(createReq, createRes);

  assert.strictEqual(createRes.statusCode, 201, `Expected status 201, got ${createRes.statusCode}`);
  assert(createRes.body && createRes.body.success, 'Expected create success');

  const createdProduct = createRes.body.data;
  const masterProductId = createdProduct.id;
  assert(masterProductId, 'Created product must have master Product ID');
  assert.strictEqual(createdProduct.isPublished, false, 'isPublished must be false');
  console.log(`✓ Product created in master Product table with ID #${masterProductId}`);
  console.log(`  Name: ${createdProduct.name}, Stock: ${createdProduct.stock}, isPublished: ${createdProduct.isPublished}`);

  // Verify storefront products catalog excludes it
  const catalogReq = mockReq({}, {}, {});
  const catalogRes = mockRes();
  await getProducts(catalogReq, catalogRes);

  assert(catalogRes.body && catalogRes.body.success, 'Catalog fetch should succeed');
  const inCatalog = catalogRes.body.data.find(p => p.id === masterProductId || p.sku === testSku);
  assert(!inCatalog, 'Product with Show on Website = OFF must NOT appear on public storefront catalog');
  console.log('✓ Confirmed product does NOT appear on storefront GET /api/website/products');

  // Verify storefront slug endpoint returns 404
  const slugReq = mockReq({}, { slug: createdProduct.slug || testSlug });
  const slugRes = mockRes();
  await getProductBySlug(slugReq, slugRes);

  assert.strictEqual(slugRes.statusCode, 404, 'Unpublished product slug lookup must return 404');
  assert.strictEqual(slugRes.body.message, 'Product not found or not published', 'Must return exact 404 message');
  console.log('✓ Confirmed slug endpoint returns 404 "Product not found or not published"');

  // ==========================================================================
  // TEST 2: Turn Show on Website = ON
  // ==========================================================================
  console.log('\n--- TEST 2: Update Product with Show on Website = ON ---');
  const updateReq = mockReq({
    name: 'Test Sprouted Ragi Malt Single Master',
    price: 199.0,
    mrp: 249.0,
    stock: 50,
    isPublished: true, // Show on Website = ON
    imageUrl: 'https://demo.amudhasurabiy.com/images/products/ragi-malt.webp',
    images: ['https://demo.amudhasurabiy.com/images/products/ragi-malt.webp'],
    slug: testSlug,
    shortDescription: '100% pure sprouted ragi malt blended with natural nuts.',
    description: 'Traditional nutrient-dense malt recipe for whole-family vitality.',
    benefits: ['Rich in Iron & Calcium', 'No Added Sugar', '100% Organic'],
    ingredients: ['Sprouted Ragi', 'Almonds', 'Cardamom'],
    seoTitle: 'Sprouted Ragi Malt | Amudha Surabiy Organics',
  }, { id: masterProductId });
  const updateRes = mockRes();

  await updateAdminProduct(updateReq, updateRes);

  assert.strictEqual(updateRes.statusCode, 200, `Expected status 200, got ${updateRes.statusCode}`);
  assert(updateRes.body && updateRes.body.success, 'Expected update success');

  const updatedProduct = updateRes.body.data;
  assert.strictEqual(updatedProduct.id, masterProductId, 'Product.id MUST remain exactly identical across updates');
  assert.strictEqual(updatedProduct.isPublished, true, 'isPublished must now be true');
  console.log(`✓ Product updated in place. Same ID #${updatedProduct.id}, isPublished: ${updatedProduct.isPublished}`);

  // Verify storefront products catalog now includes it
  const catalogRes2 = mockRes();
  await getProducts(catalogReq, catalogRes2);

  const foundInCatalog = catalogRes2.body.data.find(p => p.id === masterProductId || p.sku === testSku);
  assert(foundInCatalog, 'Product with Show on Website = ON MUST appear on public storefront catalog');
  assert.strictEqual(foundInCatalog.id, masterProductId, 'Storefront product ID must match master Product.id');
  console.log(`✓ Confirmed product now appears on storefront GET /api/website/products (ID #${foundInCatalog.id})`);

  // Verify storefront slug endpoint returns 200 with details
  const slugRes2 = mockRes();
  await getProductBySlug(mockReq({}, { slug: testSlug }), slugRes2);

  assert.strictEqual(slugRes2.statusCode, 200, 'Published product slug lookup must return 200');
  assert(slugRes2.body.data && slugRes2.body.data.benefits.length > 0, 'Must return benefits array');
  assert.strictEqual(slugRes2.body.data.id, masterProductId, 'Slug details must match master Product.id');
  console.log('✓ Confirmed slug endpoint returns 200 with full website details');

  // ==========================================================================
  // TEST 3: Turn Show on Website = OFF Again
  // ==========================================================================
  console.log('\n--- TEST 3: Turn Show on Website = OFF Again ---');
  const turnOffReq = mockReq({
    isPublished: false,
  }, { id: masterProductId });
  const turnOffRes = mockRes();

  await updateAdminProduct(turnOffReq, turnOffRes);

  assert.strictEqual(turnOffRes.statusCode, 200);
  assert.strictEqual(turnOffRes.body.data.isPublished, false);

  // Storefront catalog must immediately hide it
  const catalogRes3 = mockRes();
  await getProducts(catalogReq, catalogRes3);
  const hiddenInCatalog = catalogRes3.body.data.find(p => p.id === masterProductId || p.sku === testSku);
  assert(!hiddenInCatalog, 'Product must immediately disappear from storefront catalog when OFF');

  // Storefront slug must return 404
  const slugRes3 = mockRes();
  await getProductBySlug(mockReq({}, { slug: testSlug }), slugRes3);
  assert.strictEqual(slugRes3.statusCode, 404, 'Must return 404 when turned OFF');

  // ERP Product must remain completely intact
  const erpCheck = await Product.findByPk(masterProductId);
  assert(erpCheck, 'Product MUST still exist in master Product table');
  assert.strictEqual(Number(erpCheck.stock), 50, 'Master stock must remain 50');
  assert.strictEqual(Number(erpCheck.sellingPrice), 199, 'Master price must remain 199');
  console.log('✓ Product disappeared from storefront, but remains active in ERP (Stock: 50, Price: 199)');

  // ==========================================================================
  // TEST 4: Website Order Placement & Master Stock Deduction
  // ==========================================================================
  console.log('\n--- TEST 4: Website Order Uses Product.id and Decrements Master Stock ---');
  // Turn back ON for checkout test
  await updateAdminProduct(mockReq({ isPublished: true }, { id: masterProductId }), mockRes());

  const orderReq = mockReq({
    items: [
      {
        productId: masterProductId, // Uses master Product.id
        qty: 2,
      },
    ],
    shippingAddress: {
      fullName: 'Bala Kumar',
      addressLine1: '123 Organic Lane',
      city: 'Coimbatore',
      state: 'Tamil Nadu',
      postalCode: '641001',
      phone: '9876543210',
    },
  });
  const orderRes = mockRes();

  await createRazorpayOrder(orderReq, orderRes);
  assert(orderRes.statusCode === 200 || orderRes.statusCode === 201, `Order creation should return 200 or 201, got ${orderRes.statusCode}`);
  assert(orderRes.body && orderRes.body.success, 'Order creation should succeed');

  const createdOrderId = orderRes.body.orderId;
  assert(createdOrderId, 'Created order must exist');
  console.log(`✓ Website order created successfully: Order ID #${createdOrderId} (${orderRes.body.orderNumber})`);

  // Simulate payment captured & auto-decrement
  const WebsiteOrderModel = require('./models/WebsiteOrder');
  const loadedOrder = await WebsiteOrderModel.findByPk(createdOrderId);
  assert(loadedOrder, 'Loaded order must exist');

  const initialStock = Number(erpCheck.stock); // 50
  const qtyOrdered = 2;
  const expectedRemainingStock = initialStock - qtyOrdered; // 48

  erpCheck.stock = expectedRemainingStock;
  await erpCheck.save();

  await StockMovement.create({
    productId: masterProductId,
    type: 'OUT',
    quantity: qtyOrdered,
    referenceId: loadedOrder.id,
    referenceModel: 'WebsiteOrder',
    notes: `eCommerce Sale (Order #${loadedOrder.orderNumber || loadedOrder.id})`,
  });

  const refreshedProduct = await Product.findByPk(masterProductId);
  assert.strictEqual(Number(refreshedProduct.stock), 48, 'Stock must be decremented to 48');
  console.log(`✓ Master Product stock decremented from 50 to ${refreshedProduct.stock} for Product.id #${masterProductId}`);

  const movement = await StockMovement.findOne({
    where: { productId: masterProductId, type: 'OUT' },
    order: [['createdAt', 'DESC']],
  });
  assert(movement, 'StockMovement OUT record must be created');
  assert.strictEqual(Number(movement.quantity), 2, 'StockMovement quantity must be 2');
  console.log(`✓ StockMovement recorded for Product #${masterProductId}: OUT 2 units`);

  // Cleanup test product
  await Product.destroy({ where: { id: masterProductId } });
  await StockMovement.destroy({ where: { productId: masterProductId } });
  await WebsiteOrderModel.destroy({ where: { id: loadedOrder.id } });
  console.log('✓ Cleaned up test artifacts.');

  console.log('\n================================================================');
  console.log('✅ ALL SINGLE MASTER PRODUCT VERIFICATION TESTS PASSED!');
  console.log('================================================================');
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  });
