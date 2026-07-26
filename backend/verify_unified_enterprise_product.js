const assert = require('assert');
const path = require('path');

// Set node environment
process.env.NODE_ENV = 'test';

const connectDB = require('./config/db');
const { sequelize } = connectDB;

const Product = require('./models/Product');
const WebsiteProduct = require('./models/WebsiteProduct');
const ProductAuditLog = require('./models/ProductAuditLog');

const websiteAdminController = require('./controllers/websiteAdminController');
const websiteProductController = require('./controllers/websiteProductController');

const runMockRes = () => {
  const res = {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.data = obj;
      return this;
    }
  };
  return res;
};

async function runVerification() {
  console.log('=== STARTING UNIFIED ENTERPRISE PRODUCT VERIFICATION ===\n');

  try {
    // Run connectDB to perform dynamic schema auto-alignment
    await connectDB();
    await sequelize.sync({ alter: false });

    // Clean up test records
    await Product.destroy({ where: { slug: ['enterprise-test-malt', 'enterprise-test-malt-2'] } });
    await WebsiteProduct.destroy({ where: { slug: ['enterprise-test-malt', 'enterprise-test-malt-2'] } });

    console.log('--- TEST 1: Single Unified Product Creation (Show on Website: ON) ---');
    const req1 = {
      body: {
        name: 'Enterprise Test Malt 500g',
        slug: 'enterprise-test-malt',
        sku: 'ETM-500',
        barcode: '8901234567890',
        category: 'Health Mixes',
        brand: 'Blovit Organics',
        price: 350,
        compareAtPrice: 450,
        mrp: 450,
        stock: 50,
        unit: 'gms',
        gstPercent: 5,
        status: 'Published',
        availabilityState: 'In Stock',
        isPublished: true,
        isActive: true,
        shortDescription: 'Organic energy health mix for immunity',
        description: 'Premium sprouted ragi and almond malt health drink.',
        benefits: ['100% Organic', 'Rich in Calcium & Fiber'],
        ingredients: ['Sprouted Ragi', 'Almonds', 'Cardamom'],
        nutritionFacts: { Protein: '12g', Energy: '380 kcal' },
        usageInstructions: 'Mix 2 tbsp with warm milk or water.',
        faqs: [{ q: 'Is it sugar-free?', a: 'Yes, no added refined sugar.' }],
        seoTitle: 'Buy Enterprise Test Malt 500g Online',
        seoDescription: 'Best organic sprouted ragi malt drink.',
        seoKeywords: 'ragi, malt, organic, blovit',
        badges: ['Organic', 'Best Seller'],
        healthGoals: ['Immunity', 'Energy'],
        isFeatured: true,
        isBestseller: true,
        isTrending: true,
        sortOrder: 1,
        images: ['https://example.com/etm-primary.jpg'],
      },
      user: { id: 1, name: 'Test Admin' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'TestRunner' }
    };
    const res1 = runMockRes();

    await websiteAdminController.createAdminProduct(req1, res1);

    assert.strictEqual(res1.statusCode, 201, `Expected status 201, got ${res1.statusCode}: ${JSON.stringify(res1.data)}`);
    assert.strictEqual(res1.data.success, true, 'Create endpoint must return success: true');
    console.log('✓ Unified Product Creation API responded status 201 OK');

    const createdProductId = res1.data.data.productId;
    const dbProduct = await Product.findByPk(createdProductId);
    assert.ok(dbProduct, 'Product record must exist in DB');
    assert.strictEqual(dbProduct.name, 'Enterprise Test Malt 500g');
    assert.strictEqual(dbProduct.slug, 'enterprise-test-malt');
    assert.strictEqual(Number(dbProduct.price), 350);
    assert.strictEqual(Number(dbProduct.mrp), 450);
    assert.strictEqual(dbProduct.isPublished, true, 'isPublished must be true');
    console.log('✓ Unified Product record verified in database with all attributes');

    console.log('\n--- TEST 2: Storefront GET APIs return Published Product ---');
    const reqList = { query: {} };
    const resList = runMockRes();
    await websiteProductController.getProducts(reqList, resList);

    assert.strictEqual(resList.statusCode, 200, 'Storefront GET /products must return 200');
    assert.strictEqual(resList.data.success, true);
    const foundInList = resList.data.data.find(p => p.slug === 'enterprise-test-malt');
    assert.ok(foundInList, 'Published product must appear in /api/website/products storefront listing');
    assert.strictEqual(foundInList.price, 350);
    console.log('✓ Storefront listing /api/website/products returned published product');

    const reqSlug = { params: { slug: 'enterprise-test-malt' } };
    const resSlug = runMockRes();
    await websiteProductController.getProductBySlug(reqSlug, resSlug);
    assert.strictEqual(resSlug.statusCode, 200, 'Storefront GET /products/:slug must return 200');
    assert.strictEqual(resSlug.data.data.name, 'Enterprise Test Malt 500g');
    assert.deepStrictEqual(resSlug.data.data.benefits, ['100% Organic', 'Rich in Calcium & Fiber']);
    console.log('✓ Storefront detail /api/website/products/:slug returned complete product details');

    console.log('\n--- TEST 3: Storefront Hiding when Visibility OFF (isPublished: false) ---');
    const reqUpdateOff = {
      params: { id: createdProductId },
      body: {
        isPublished: false,
        status: 'Draft',
      },
      user: { id: 1, name: 'Test Admin' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'TestRunner' }
    };
    const resUpdateOff = runMockRes();
    await websiteAdminController.updateAdminProduct(reqUpdateOff, resUpdateOff);

    assert.strictEqual(resUpdateOff.statusCode, 200, 'Update product status must return 200');

    // Verify /api/website/products filters it out
    const resListOff = runMockRes();
    await websiteProductController.getProducts({ query: {} }, resListOff);
    const foundInListOff = resListOff.data.data.find(p => p.slug === 'enterprise-test-malt');
    assert.strictEqual(foundInListOff, undefined, 'Unpublished product MUST NOT appear in storefront listing');
    console.log('✓ Unpublished product successfully hidden from /api/website/products');

    // Verify /api/website/products/:slug returns 404
    const resSlugOff = runMockRes();
    await websiteProductController.getProductBySlug(reqSlug, resSlugOff);
    assert.strictEqual(resSlugOff.statusCode, 404, 'Unpublished product GET /products/:slug MUST return 404 Not Found');
    console.log('✓ Storefront /api/website/products/:slug returned 404 Not Found when Show on Website is OFF');

    console.log('\n--- TEST 4: Automatic Slug Conflict Resolution ---');
    const reqDupSlug = {
      body: {
        name: 'Enterprise Test Malt 500g',
        slug: 'enterprise-test-malt', // Intentionally duplicate slug
        sku: 'ETM-500-DUP',
        price: 380,
        isPublished: true,
      },
      user: { id: 1, name: 'Test Admin' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'TestRunner' }
    };
    const resDupSlug = runMockRes();
    await websiteAdminController.createAdminProduct(reqDupSlug, resDupSlug);

    assert.strictEqual(resDupSlug.statusCode, 201, 'Duplicate slug request should succeed with auto-resolved slug');
    const dupProductId = resDupSlug.data.data.productId;
    const dupDbProduct = await Product.findByPk(dupProductId);
    assert.strictEqual(dupDbProduct.slug, 'enterprise-test-malt-2', 'Slug collision must automatically resolve to enterprise-test-malt-2');
    console.log(`✓ Automatic Slug Resolution: Duplicate "enterprise-test-malt" resolved to "${dupDbProduct.slug}"`);

    console.log('\n--- TEST 5: Enterprise Validation Guardrails ---');
    // Test Missing Name
    const resNoName = runMockRes();
    await websiteAdminController.createAdminProduct({ body: { price: 100 } }, resNoName);
    assert.strictEqual(resNoName.statusCode, 400, 'Missing name must be rejected with 400');
    assert.strictEqual(resNoName.data.message, 'Product Name is required.');
    console.log('✓ Validation Guard: Missing product name correctly rejected with 400');

    // Test Invalid Price
    const resBadPrice = runMockRes();
    await websiteAdminController.createAdminProduct({ body: { name: 'Bad Price Item', price: -50 } }, resBadPrice);
    assert.strictEqual(resBadPrice.statusCode, 400, 'Negative/Zero price must be rejected with 400');
    assert.strictEqual(resBadPrice.data.message, 'Price must be a valid positive number.');
    console.log('✓ Validation Guard: Invalid price correctly rejected with 400');

    // Test Duplicate SKU
    const resDupSku = runMockRes();
    await websiteAdminController.createAdminProduct({ body: { name: 'Dup SKU Item', sku: 'ETM-500', price: 200 } }, resDupSku);
    assert.strictEqual(resDupSku.statusCode, 400, 'Duplicate SKU must be rejected with 400');
    assert.ok(resDupSku.data.message.includes('Duplicate SKU'), 'Error message must specify duplicate SKU');
    console.log('✓ Validation Guard: Duplicate SKU "ETM-500" correctly rejected with 400');

    console.log('\n--- TEST 6: Audit Log & Version History ---');
    const auditLogs = await ProductAuditLog.findAll({ where: { productId: createdProductId } });
    assert.ok(auditLogs.length >= 2, `ProductAuditLog should record actions for product ${createdProductId}`);
    console.log(`✓ Audit Log: ${auditLogs.length} audit actions recorded for create/update/unpublish`);

    const updatedDbProduct = await Product.findByPk(createdProductId);
    const versionHistory = JSON.parse(updatedDbProduct.versionHistory || '[]');
    assert.ok(versionHistory.length >= 2, 'Version history must retain save snapshots');
    console.log(`✓ Version History: ${versionHistory.length} save versions snapshotted`);

    // Clean up
    await Product.destroy({ where: { id: [createdProductId, dupProductId] } });
    await WebsiteProduct.destroy({ where: { managementProductId: [createdProductId, dupProductId] } });
    await ProductAuditLog.destroy({ where: { productId: [createdProductId, dupProductId] } });

    console.log('\n==================================================');
    console.log(' ALL 6 ENTERPRISE VERIFICATION TESTS PASSED SUCCESSFULLY! ');
    console.log('==================================================\n');
  } catch (err) {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  }
}

runVerification();
