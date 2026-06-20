const { sequelize } = require('./config/db');
const connectDB = require('./config/db');
const Product = require('./models/Product');
const RawMaterial = require('./models/RawMaterial');
const RawMaterialMovement = require('./models/RawMaterialMovement');
const StockMovement = require('./models/StockMovement');
const ManufacturingRecipe = require('./models/ManufacturingRecipe');
const ManufacturingRecipeMaterial = require('./models/ManufacturingRecipeMaterial');
const ManufacturingEntry = require('./models/ManufacturingEntry');
const ManufacturingEntryMaterial = require('./models/ManufacturingEntryMaterial');

const manufacturingController = require('./controllers/manufacturingController');

// Helper to mock request/response
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

async function runTests() {
  console.log('--- STARTING INTEGRATION VERIFICATION FOR RECIPE VARIANTS & MODES ---');
  await connectDB();
  console.log('Database connected.');

  // 1. Ensure finished products exist (seeded by seedAbcMalt.js or custom created here)
  let parentProduct = await Product.findOne({ where: { sku: 'ABC-MALT-BULK' } });
  if (!parentProduct) {
    parentProduct = await Product.create({
      name: 'ABC Malt Bulk',
      sku: 'ABC-MALT-BULK',
      productType: 'BULK_PRODUCT',
      unit: 'KG',
      stock: 0.0,
      purchasePrice: 200.00,
      sellingPrice: 0.0,
      lowStockThreshold: 1.0,
    });
  }

  let variant200 = await Product.findOne({ where: { sku: 'ABC-MALT-200G' } });
  if (!variant200) {
    variant200 = await Product.create({
      name: 'ABC Malt 200g',
      sku: 'ABC-MALT-200G',
      parentProductId: parentProduct.id,
      productType: 'RETAIL_PACK',
      packSize: '200g',
      conversionFactor: 0.2,
      unit: 'pcs',
      stock: 0,
      sellingPrice: 120,
      mrp: 150
    });
  }

  // Ensure raw material ingredients exist
  const ingredientsData = [
    { name: 'Apple Raw', category: 'General', unit: 'Kg', purchasePrice: 50 },
    { name: 'Beetroot Raw', category: 'General', unit: 'Kg', purchasePrice: 30 },
    { name: 'Carrot Raw', category: 'General', unit: 'Kg', purchasePrice: 25 },
    { name: 'Jaggery Powder Raw', category: 'General', unit: 'Kg', purchasePrice: 60 },
    { name: 'Cashew Raw', category: 'General', unit: 'Kg', purchasePrice: 400 },
    { name: 'Badam Raw', category: 'General', unit: 'Kg', purchasePrice: 500 },
    { name: 'Cardamom Raw', category: 'General', unit: 'Kg', purchasePrice: 1000 },
  ];

  const materialsMap = {};
  for (const item of ingredientsData) {
    let raw = await RawMaterial.findOne({ where: { name: item.name } });
    if (!raw) {
      raw = await RawMaterial.create({
        ...item,
        materialCode: item.name.toUpperCase().replace(/\s+/g, '_'),
        stock: 500.0 // Give plenty of stock
      });
    } else {
      raw.stock = 500.0;
      await raw.save();
    }
    materialsMap[item.name] = raw;
  }
  console.log('✓ Ingredients initialized with 500.0 Kg stock.');

  // Reset stocks of finished goods to 0
  parentProduct.stock = 0.0;
  await parentProduct.save();
  variant200.stock = 0;
  await variant200.save();
  console.log('✓ Reset parent bulk and variant stocks to 0.');

  // Clean old entries & recipe to ensure no duplicate conflicts
  await sequelize.query('PRAGMA foreign_keys = OFF;');
  try {
    const oldRecipe = await ManufacturingRecipe.findOne({ where: { name: 'ABC Malt 200g Test Recipe' } });
    if (oldRecipe) {
      await ManufacturingRecipeMaterial.destroy({ where: { recipeId: oldRecipe.id } });
      await oldRecipe.destroy();
    }
    // Delete any old manufacturing runs for variant or parent
    const entries = await ManufacturingEntry.findAll({ where: { productId: [parentProduct.id, variant200.id] } });
    for (const e of entries) {
      await ManufacturingEntryMaterial.destroy({ where: { mfgEntryId: e.id } });
      await StockMovement.destroy({ where: { referenceId: e.id, referenceModel: 'ManufacturingEntry' } });
      await RawMaterialMovement.destroy({ where: { referenceId: e.id, referenceModel: 'ManufacturingEntry' } });
      await e.destroy();
    }
  } finally {
    await sequelize.query('PRAGMA foreign_keys = ON;');
  }
  console.log('✓ Cleaned stale recipes and runs database rows.');

  // ==========================================
  // TEST CASE 1: Create Recipe via Controller
  // ==========================================
  console.log('\n--- TEST CASE 1: Create Variant Recipe ---');
  const req1 = {
    user: { id: 1 },
    body: {
      name: 'ABC Malt 200g Test Recipe',
      productId: parentProduct.id,
      variantProductId: variant200.id,
      packSize: '200g',
      yieldPacks: 30,
      packWeight: 0.2,
      wastagePercent: 5.0,
      materials: Object.values(materialsMap).map(m => ({
        rawMaterialId: m.id,
        qty: m.name.includes('Cardamom') ? 0.1 : 1.0
      }))
    }
  };
  const res1 = createMockRes();
  await manufacturingController.createRecipe(req1, res1, next);

  if (res1.statusCode !== 201) {
    throw new Error(`Failed to create recipe: status ${res1.statusCode}`);
  }
  const createdRecipe = res1.data;
  console.log(`✓ Recipe created successfully: ${createdRecipe.name}`);
  console.log(`  Calculated Yield Qty (KG): ${createdRecipe.yieldQty} (Expected: 6.00)`);
  if (Number(createdRecipe.yieldQty) !== 6.0) {
    throw new Error(`Expected yieldQty to be 6.0 but got ${createdRecipe.yieldQty}`);
  }

  // ==========================================
  // TEST CASE 2: Mode 2 Direct-to-Pack Run
  // ==========================================
  console.log('\n--- TEST CASE 2: Mode 2 Direct-to-Pack Manufacturing ---');
  // Cardamom stock before run
  const cardamomBefore = Number(materialsMap['Cardamom Raw'].stock);

  const req2 = {
    user: { id: 1 },
    body: {
      recipeId: createdRecipe.id,
      productId: variant200.id,
      qtyToProduce: 30, // 30 packs
      laborCost: 15.00,
      otherCost: 5.00,
      notes: 'Test Mode 2 Direct to Pack',
      status: 'completed',
      productionMode: 'pack'
    }
  };
  const res2 = createMockRes();
  await manufacturingController.createEntry(req2, res2, next);

  if (res2.statusCode !== 201) {
    throw new Error(`Failed to run Mode 2 Direct to Pack: status ${res2.statusCode}`);
  }
  const run2 = res2.data;
  console.log(`✓ Run created: ${run2.mfgNumber}`);

  // Check stocks
  const updatedVariant = await Product.findByPk(variant200.id);
  const updatedBulk = await Product.findByPk(parentProduct.id);
  console.log(`Variant Stock: ${updatedVariant.stock} PCS (Expected: 30)`);
  console.log(`Bulk Stock: ${updatedBulk.stock} KG (Expected: 0)`);
  if (Number(updatedVariant.stock) !== 30 || Number(updatedBulk.stock) !== 0) {
    throw new Error('Stock increments for variant direct-to-pack are incorrect!');
  }

  // Check ingredients stock (wastage = 5% => multiplier = 1.05. Cardamom qty = 0.1 => 0.1 * 1.05 = 0.105 Kg)
  const cardamomAfter = await RawMaterial.findByPk(materialsMap['Cardamom Raw'].id);
  const diff = cardamomBefore - Number(cardamomAfter.stock);
  console.log(`Cardamom Deducted: ${diff.toFixed(3)} Kg (Expected: 0.105 Kg)`);
  if (Math.abs(diff - 0.105) > 0.0001) {
    throw new Error('Ingredients scaling with wastage percent did not calculate correctly!');
  }

  // Check stock ledger entries
  const movements = await StockMovement.findAll({ where: { referenceId: run2.id, referenceModel: 'ManufacturingEntry' } });
  console.log(`Ledger entry count: ${movements.length} (Expected: 1)`);
  if (movements.length !== 1 || movements[0].productId !== variant200.id || Number(movements[0].quantity) !== 30) {
    throw new Error('Stock ledger entries for Mode 2 direct-to-pack are invalid!');
  }
  console.log('✓ Mode 2 stock and ingredients updates verified successfully.');

  // ==========================================
  // TEST CASE 3: Mode 1 Bulk Weight Run
  // ==========================================
  console.log('\n--- TEST CASE 3: Mode 1 Bulk Manufacturing ---');
  const req3 = {
    user: { id: 1 },
    body: {
      recipeId: createdRecipe.id,
      productId: parentProduct.id,
      qtyToProduce: 6.0, // 6 KG
      laborCost: 10.00,
      otherCost: 2.00,
      notes: 'Test Mode 1 Bulk',
      status: 'completed',
      productionMode: 'weight'
    }
  };
  const res3 = createMockRes();
  await manufacturingController.createEntry(req3, res3, next);

  if (res3.statusCode !== 201) {
    throw new Error(`Failed to run Mode 1 Bulk: status ${res3.statusCode}`);
  }
  const run3 = res3.data;
  console.log(`✓ Run created: ${run3.mfgNumber}`);

  const updatedBulkAfter = await Product.findByPk(parentProduct.id);
  console.log(`Bulk Stock: ${updatedBulkAfter.stock} KG (Expected: 6.00)`);
  if (Number(updatedBulkAfter.stock) !== 6.0) {
    throw new Error('Stock increments for bulk mode are incorrect!');
  }
  console.log('✓ Mode 1 stock updates verified successfully.');

  // ==========================================
  // TEST CASE 4: Reversal Verifications
  // ==========================================
  console.log('\n--- TEST CASE 4: Reversing Mode 2 Direct-to-Pack ---');
  const req4 = {
    user: { id: 1 },
    params: { id: run2.id }
  };
  const res4 = createMockRes();
  await manufacturingController.reverseEntry(req4, res4, next);

  if (res4.statusCode !== 200) {
    throw new Error(`Failed to reverse Mode 2: status ${res4.statusCode}`);
  }
  const reversedVariant = await Product.findByPk(variant200.id);
  console.log(`Reversed Variant Stock: ${reversedVariant.stock} PCS (Expected: 0)`);
  if (Number(reversedVariant.stock) !== 0) {
    throw new Error('Reversal did not deduct variant stock correctly!');
  }

  console.log('\n--- TEST CASE 5: Reversing Mode 1 Bulk ---');
  const req5 = {
    user: { id: 1 },
    params: { id: run3.id }
  };
  const res5 = createMockRes();
  await manufacturingController.reverseEntry(req5, res5, next);

  if (res5.statusCode !== 200) {
    throw new Error(`Failed to reverse Mode 1: status ${res5.statusCode}`);
  }
  const reversedBulk = await Product.findByPk(parentProduct.id);
  console.log(`Reversed Bulk Stock: ${reversedBulk.stock} KG (Expected: 0)`);
  if (Number(reversedBulk.stock) !== 0) {
    throw new Error('Reversal did not deduct bulk stock correctly!');
  }

  console.log('\n--- ALL VERIFICATIONS COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

runTests().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
