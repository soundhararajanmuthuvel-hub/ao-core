const { sequelize } = require('./config/db');
const connectDB = require('./config/db');
const Product = require('./models/Product');
const StockMovement = require('./models/StockMovement');
const PackingConversion = require('./models/PackingConversion');
const PackingConversionItem = require('./models/PackingConversionItem');
const { updateStock } = require('./utils/stockService');
const packingConversionController = require('./controllers/packingConversionController');

async function runTests() {
  console.log('--- STARTING VERIFICATION SYSTEM FOR BULK MANUFACTURING & PACKING CONVERSION ---');
  await connectDB();
  console.log('Database connected successfully.');

  // Find products
  const bulkProduct = await Product.findOne({ where: { sku: 'ABC-MALT-BULK' } });
  const variant200 = await Product.findOne({ where: { sku: 'ABC-MALT-200G' } });
  const variant500 = await Product.findOne({ where: { sku: 'ABC-MALT-500G' } });
  const variant1kg = await Product.findOne({ where: { sku: 'ABC-MALT-1KG' } });

  if (!bulkProduct || !variant200 || !variant500 || !variant1kg) {
    throw new Error('Required seeded ABC Malt products not found! Make sure you seed the database first.');
  }

  console.log(`Found ABC Malt Bulk ID: ${bulkProduct.id}`);
  console.log(`Found Variant 200g ID: ${variant200.id}`);
  console.log(`Found Variant 500g ID: ${variant500.id}`);
  console.log(`Found Variant 1kg ID: ${variant1kg.id}`);

  // Safely clean old conversions and movements
  await sequelize.query('PRAGMA foreign_keys = OFF;');
  try {
    const list = await PackingConversion.findAll({ where: { sourceProductId: bulkProduct.id } });
    for (const pc of list) {
      await PackingConversionItem.destroy({ where: { packingConversionId: pc.id } });
      await StockMovement.destroy({ where: { referenceId: pc.id, referenceModel: 'PackingConversion' } });
      await pc.destroy();
    }
    // Clean any direct adjustments for these products
    await StockMovement.destroy({ where: { productId: bulkProduct.id } });
    await StockMovement.destroy({ where: { productId: variant200.id } });
    await StockMovement.destroy({ where: { productId: variant500.id } });
    await StockMovement.destroy({ where: { productId: variant1kg.id } });

    // Reset stocks to 0
    bulkProduct.stock = 0;
    await bulkProduct.save();
    variant200.stock = 0;
    await variant200.save();
    variant500.stock = 0;
    await variant500.save();
    variant1kg.stock = 0;
    await variant1kg.save();
  } finally {
    await sequelize.query('PRAGMA foreign_keys = ON;');
  }
  console.log('✓ Cleaned and reset previous test data.');

  // Mock Request/Response objects
  const createMockRes = () => {
    return {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.data = data;
      }
    };
  };

  const next = (err) => {
    if (err) throw err;
  };

  // Test Case 1: Produce 6 KG Bulk Powder
  console.log('\n--- TEST CASE 1: Manufacturing Production (6 KG) ---');
  await updateStock(bulkProduct.id, 6.0, {
    type: 'manufacturing',
    notes: 'ABC Malt Bulk Production Batch: ABC-2026-001'
  });
  
  let currentBulk = await Product.findByPk(bulkProduct.id);
  console.log(`ABC Malt Bulk stock: ${currentBulk.stock} KG (Expected: 6.00 KG)`);
  if (Number(currentBulk.stock) !== 6.0) {
    throw new Error('Test Case 1 failed: stock is not 6 KG');
  }

  // Test Case 2: Validation of Insufficient Stock (tries to convert 8 KG: 200g x 20 + 1kg x 4)
  console.log('\n--- TEST CASE 2: Insufficient Stock Validation ---');
  const req2 = {
    user: { id: 1 },
    body: {
      sourceProductId: bulkProduct.id,
      notes: 'Insufficient Stock Run',
      items: [
        { targetProductId: variant200.id, qty: 20 }, // 4 KG
        { targetProductId: variant1kg.id, qty: 4 }   // 4 KG
      ]
    }
  };
  const res2 = createMockRes();
  await packingConversionController.createPackingConversion(req2, res2, next);
  console.log(`Response Code: ${res2.statusCode}`);
  console.log(`Response Msg: "${res2.data.message}"`);
  if (res2.statusCode !== 400 || !res2.data.message.includes('Insufficient stock')) {
    throw new Error('Test Case 2 failed: allowed packing with insufficient stock');
  }
  console.log('✓ Insufficient stock correctly blocked.');

  // Test Case 3: Convert Entire Stock (200g x 20 + 1kg x 2 = 6 KG)
  console.log('\n--- TEST CASE 3: Mixed Packing Conversion (200g x 20, 1kg x 2) ---');
  const req3 = {
    user: { id: 1 },
    body: {
      sourceProductId: bulkProduct.id,
      notes: 'Example 3 Mixed Conversion',
      items: [
        { targetProductId: variant200.id, qty: 20 }, // 4 KG
        { targetProductId: variant1kg.id, qty: 2 }   // 2 KG
      ]
    }
  };
  const res3 = createMockRes();
  await packingConversionController.createPackingConversion(req3, res3, next);
  
  if (res3.statusCode !== 201) {
    throw new Error(`Test Case 3 failed: response code ${res3.statusCode}`);
  }

  const pRun = res3.data;
  console.log(`✓ Conversion executed successfully. Conversion Number: ${pRun.conversionNumber}`);

  currentBulk = await Product.findByPk(bulkProduct.id);
  const current200 = await Product.findByPk(variant200.id);
  const current1kg = await Product.findByPk(variant1kg.id);

  console.log(`Bulk Remaining Stock: ${currentBulk.stock} KG (Expected: 0.00 KG)`);
  console.log(`ABC Malt 200g Stock: ${current200.stock} PCS (Expected: 20 PCS)`);
  console.log(`ABC Malt 1kg Stock: ${current1kg.stock} PCS (Expected: 2 PCS)`);

  if (Number(currentBulk.stock) !== 0.0 || Number(current200.stock) !== 20 || Number(current1kg.stock) !== 2) {
    throw new Error('Test Case 3 failed: Stocks did not update correctly after save');
  }

  // Test Case 4: Stock Ledger Movements
  console.log('\n--- TEST CASE 4: Verify Stock Ledger Movements ---');
  const movements = await StockMovement.findAll({
    where: { referenceId: pRun.id, referenceModel: 'PackingConversion' },
    order: [['id', 'ASC']]
  });
  console.log(`Logged ${movements.length} movements (Expected: 3)`);
  if (movements.length !== 3) {
    throw new Error('Test Case 4 failed: Incorrect number of ledger entries');
  }

  movements.forEach(m => {
    console.log(`  Ledger Entry: ProductID = ${m.productId}, Qty = ${m.quantity}, Type = ${m.type}, Notes = "${m.notes}"`);
  });

  // Test Case 5: Reverse Conversion Run
  console.log('\n--- TEST CASE 5: Reverse Conversion Run ---');
  const req5 = {
    user: { id: 1 },
    params: { id: pRun.id }
  };
  const res5 = createMockRes();
  await packingConversionController.reversePackingConversion(req5, res5, next);

  if (res5.statusCode !== 200) {
    throw new Error(`Test Case 5 failed: response code ${res5.statusCode}`);
  }

  const restoredBulk = await Product.findByPk(bulkProduct.id);
  const restored200 = await Product.findByPk(variant200.id);
  const restored1kg = await Product.findByPk(variant1kg.id);

  console.log(`Restored Bulk Stock: ${restoredBulk.stock} KG (Expected: 6.00 KG)`);
  console.log(`Restored 200g Stock: ${restored200.stock} PCS (Expected: 0 PCS)`);
  console.log(`Restored 1kg Stock: ${restored1kg.stock} PCS (Expected: 0 PCS)`);

  if (Number(restoredBulk.stock) !== 6.0 || Number(restored200.stock) !== 0 || Number(restored1kg.stock) !== 0) {
    throw new Error('Test Case 5 failed: Stocks did not revert correctly after reversal');
  }

  console.log('\n--- ALL BULK MANUFACTURING & PACKING CONVERSION VERIFICATIONS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('VERIFICATION SYSTEM FAILED WITH ERROR:', err);
  process.exit(1);
});
