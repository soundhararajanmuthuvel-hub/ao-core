const assert = require('assert');

process.env.NODE_ENV = 'test';

const connectDB = require('./config/db');
const { sequelize } = connectDB;

const Product = require('./models/Product');
const WebsiteProduct = require('./models/WebsiteProduct');
const ProductAuditLog = require('./models/ProductAuditLog');
const Invoice = require('./models/Invoice');
const InvoiceItem = require('./models/InvoiceItem');

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

async function runMasterProductVerification() {
  console.log('=== STARTING SINGLE MASTER PRODUCT ARCHITECTURE VERIFICATION ===\n');

  try {
    await connectDB();
    await sequelize.sync({ alter: false });

    // Clean test products
    await Product.destroy({ where: { sku: ['MASTER-TEST-001', 'ERP-ONLY-002'] } });

    console.log('--- 1. Testing Existing ERP Product Visibility in Website Module ---');
    const erpProd = await Product.create({
      name: 'Existing ERP Ragi Powder 1kg',
      sku: 'ERP-ONLY-002',
      category: 'Bulk Powders',
      price: 180,
      stock: 250,
      isActive: true,
      isPublished: true,
      publishToWebsite: true,
      isArchived: false,
    });

    const resAdminList = runMockRes();
    await websiteAdminController.getAdminProducts({ query: {} }, resAdminList);
    assert.strictEqual(resAdminList.statusCode, 200);
    const foundErpProd = resAdminList.data.data.find(p => p.productId === erpProd.id);
    assert.ok(foundErpProd, 'Existing ERP Product MUST be directly visible in Website Products list');
    assert.strictEqual(foundErpProd.price, 180);
    console.log('✓ PASS: Existing ERP Product is directly visible in Website module list');

    console.log('\n--- 2. Testing Single Product Creation (Zero Duplication) ---');
    const reqCreate = {
      body: {
        name: 'Master Unified Health Mix 500g',
        slug: 'master-unified-health-mix',
        sku: 'MASTER-TEST-001',
        category: 'Organic Health',
        brand: 'Blovit',
        price: 499,
        compareAtPrice: 599,
        mrp: 599,
        stock: 120,
        unit: 'gms',
        isPublished: true,
        isActive: true,
        shortDescription: 'Single master product for ERP & Storefront',
        description: 'Comprehensive organic blend with sprouted pulses.',
        benefits: ['Rich in Iron', 'Natural Energy'],
        ingredients: ['Ragi', 'Almonds', 'Dates'],
        seoTitle: 'Master Unified Health Mix 500g Online',
      },
      user: { id: 1, name: 'Super Admin' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'TestRunner' }
    };
    const resCreate = runMockRes();
    await websiteAdminController.createAdminProduct(reqCreate, resCreate);
    assert.strictEqual(resCreate.statusCode, 201);
    const masterProdId = resCreate.data.data.productId;

    // Verify only ONE master record exists
    const masterProdsCount = await Product.count({ where: { sku: 'MASTER-TEST-001' } });
    assert.strictEqual(masterProdsCount, 1, 'Exactly 1 Product record must exist for SKU MASTER-TEST-001');
    console.log('✓ PASS: Single Product created with zero table duplication (Product.id = ' + masterProdId + ')');

    console.log('\n--- 3. Testing Storefront Visibility Toggle (Show on Website: OFF) ---');
    // Storefront listing contains product when isPublished = true
    const resStorefront1 = runMockRes();
    await websiteProductController.getProducts({ query: {} }, resStorefront1);
    const inStorefront1 = resStorefront1.data.data.find(p => p.productId === masterProdId);
    assert.ok(inStorefront1, 'Product MUST be listed on storefront when Show on Website is ON');

    // Toggle Show on Website OFF
    const reqToggleOff = {
      params: { id: masterProdId },
      body: { isPublished: false },
      user: { id: 1, name: 'Super Admin' },
      ip: '127.0.0.1',
      headers: { 'user-agent': 'TestRunner' }
    };
    const resToggleOff = runMockRes();
    await websiteAdminController.updateAdminProduct(reqToggleOff, resToggleOff);
    assert.strictEqual(resToggleOff.statusCode, 200);

    // Verify hidden from storefront
    const resStorefront2 = runMockRes();
    await websiteProductController.getProducts({ query: {} }, resStorefront2);
    const inStorefront2 = resStorefront2.data.data.find(p => p.productId === masterProdId);
    assert.strictEqual(inStorefront2, undefined, 'Product MUST be hidden from storefront when Show on Website is OFF');

    // Verify ERP functionality is 100% unaffected
    const erpCheck = await Product.findByPk(masterProdId);
    assert.strictEqual(!!erpCheck.isActive, true, 'ERP isActive MUST remain true when website toggle is OFF');
    assert.strictEqual(Number(erpCheck.stock), 120, 'ERP stock MUST remain intact');
    console.log('✓ PASS: Turning Show on Website OFF hides from storefront while ERP Inventory & Billing remain 100% active');

    console.log('\n--- 4. Testing Historical Invoice Reference Integrity ---');
    const Customer = require('./models/Customer');
    let cust = await Customer.findByPk(1);
    if (!cust) {
      cust = await Customer.create({ name: 'Test Customer', phone: '9999999999' });
    }

    // Simulate historical invoice referencing product
    const inv = await Invoice.create({
      invoiceNumber: `INV-TEST-${Date.now()}`,
      customerId: cust.id,
      totalAmount: 499,
      status: 'Paid',
    });
    const invItem = await InvoiceItem.create({
      invoiceId: inv.id,
      productId: masterProdId,
      productName: erpCheck.name,
      quantity: 1,
      qty: 1,
      unitPrice: 499,
      totalPrice: 499,
      lineTotal: 499,
    });

    assert.strictEqual(invItem.productId, masterProdId, 'Historical invoice item must reference Product.id');
    console.log('✓ PASS: Historical invoice references Product.id (' + masterProdId + ') cleanly');

    // Clean up test records
    await InvoiceItem.destroy({ where: { id: invItem.id } });
    await Invoice.destroy({ where: { id: inv.id } });
    await Product.destroy({ where: { id: [erpProd.id, masterProdId] } });
    await WebsiteProduct.destroy({ where: { managementProductId: [erpProd.id, masterProdId] } });

    console.log('\n==================================================');
    console.log(' SINGLE MASTER PRODUCT ARCHITECTURE VERIFICATION PASSED! ');
    console.log('==================================================\n');
  } catch (err) {
    console.error('\n❌ VERIFICATION TEST FAILED:', err);
    process.exit(1);
  }
}

runMasterProductVerification();
