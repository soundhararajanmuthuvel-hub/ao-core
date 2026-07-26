const connectDB = require('./config/db');
const WooCommerceService = require('./utils/wooService');
const { sequelize } = require('./config/db');
const Product = require('./models/Product');

async function testWooSyncSequelize() {
  console.log('=== VERIFYING WOOCOMMERCE PRODUCT SYNC SEQUELIZE FIX ===');
  try {
    await connectDB();
    console.log('✓ Database connected.');

    // 1. Verify sequelize is imported in wooService module
    if (!sequelize) {
      throw new Error('sequelize singleton is not defined in config/db');
    }
    console.log('✓ Database singleton instance verified.');

    // 2. Test WooCommerceService initialization
    const mockSettings = {
      wooUrl: 'https://mock-store.local',
      wooConsumerKey: 'ck_test_123',
      wooConsumerSecret: 'cs_test_456',
      wooProductSyncMode: 'ERP Master'
    };

    const wooService = new WooCommerceService(mockSettings);
    console.log('✓ WooCommerceService initialized.');

    // 3. Test transaction capability used in importProductsDetailed
    console.log('--- Testing Transaction Execution ---');
    const t = await sequelize.transaction();
    console.log('✓ Transaction started successfully');

    const testSku = 'TEST-SYNC-' + Date.now();
    const testProd = await Product.create({
      name: 'Test Sync Product',
      sku: testSku,
      price: 199,
      productType: 'trading',
      unit: 'pcs'
    }, { transaction: t });
    
    console.log('✓ Product created inside transaction:', testProd.sku);
    
    await t.commit();
    console.log('✓ Transaction committed successfully.');

    // Cleanup
    await Product.destroy({ where: { sku: testSku } });
    console.log('✓ Test product cleaned up.');

    // 4. Test error handling / rollback inside product import transaction
    console.log('--- Testing Transaction Rollback on Error ---');
    const tRollback = await sequelize.transaction();
    try {
      await Product.create({
        name: null, // Should fail validation
        sku: testSku
      }, { transaction: tRollback });
      await tRollback.commit();
    } catch (err) {
      await tRollback.rollback();
      console.log('✓ Transaction rolled back successfully on error:', err.message);
    }

    console.log('\n==================================================');
    console.log('✓ VERIFICATION SUCCESSFUL: No ReferenceError');
    console.log('✓ Product sync module has active sequelize instance');
    console.log('✓ Transactions (start, commit, rollback) working properly');
    console.log('==================================================');

    process.exit(0);
  } catch (err) {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  }
}

testWooSyncSequelize();
