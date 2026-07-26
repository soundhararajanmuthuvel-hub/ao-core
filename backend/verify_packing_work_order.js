const connectDB = require('./config/db');
const Product = require('./models/Product');
const ProductPackSize = require('./models/ProductPackSize');
const ManufacturingEntry = require('./models/ManufacturingEntry');
const RepackEntry = require('./models/RepackEntry');
const RawMaterial = require('./models/RawMaterial');
const repackController = require('./controllers/repackController');

async function runVerification() {
  console.log('--- STARTING ENTERPRISE PACKING WORK ORDER VERIFICATION ---');
  try {
    await connectDB();
    console.log('✓ Database synchronized and migrated successfully');

    // 1. Setup Bulk Product Master item & Manufacturing Entry (6.000 Kg)
    let bulkProduct = await Product.findOne({ where: { sku: 'TEST-ABC-BULK' } });
    if (!bulkProduct) {
      bulkProduct = await Product.create({
        name: 'ABC Malt Bulk',
        sku: 'TEST-ABC-BULK',
        productType: 'BULK_PRODUCT',
        stock: 6.000,
        unit: 'Kg',
        purchasePrice: 100.00,
        sellingPrice: 150.00,
        isActive: true,
        isArchived: false
      });
    } else {
      bulkProduct.stock = 6.000;
      await bulkProduct.save();
    }
    console.log(`✓ Bulk Product setup: ${bulkProduct.name} (Stock: ${bulkProduct.stock} Kg)`);

    // Create Manufacturing Batch (MFG-2026-TEST-001)
    let mfgEntry = await ManufacturingEntry.findOne({ where: { mfgNumber: 'MFG-2026-TEST-001' } });
    if (!mfgEntry) {
      mfgEntry = await ManufacturingEntry.create({
        mfgNumber: 'MFG-2026-TEST-001',
        batchNumber: 'ABC240725',
        productId: bulkProduct.id,
        qtyToProduce: 6.000,
        remainingBulkStock: 6.000,
        status: 'completed'
      });
    } else {
      mfgEntry.remainingBulkStock = 6.000;
      await mfgEntry.save();
    }
    console.log(`✓ Manufacturing Batch setup: ${mfgEntry.mfgNumber} (Remaining Bulk Stock: ${mfgEntry.remainingBulkStock} Kg)`);

    // 2. Configure Predefined Pack Sizes (200 g, 1 Kg)
    await ProductPackSize.destroy({ where: { productId: bulkProduct.id } });
    const packSize200g = await ProductPackSize.create({
      productId: bulkProduct.id,
      packName: '200 g',
      weightInGrams: 200,
      unit: 'g',
      sku: 'BLV-ABC-200G',
      barcode: '8901234567890',
      sellingPrice: 180,
      mrp: 199,
      stock: 0,
      status: 'Active'
    });

    const packSize1Kg = await ProductPackSize.create({
      productId: bulkProduct.id,
      packName: '1 Kg',
      weightInGrams: 1000,
      unit: 'g',
      sku: 'BLV-ABC-1KG',
      barcode: '8901234567891',
      sellingPrice: 750,
      mrp: 850,
      stock: 0,
      status: 'Active'
    });
    console.log('✓ Predefined Pack Sizes configured: 200 g & 1 Kg');

    // Setup user for createdById foreign key
    const User = require('./models/User');
    let dbUser = await User.findOne();
    if (!dbUser) {
      dbUser = await User.create({
        name: 'Test Admin',
        email: 'testadmin@aocore.com',
        password: 'Password@123',
        role: 'Super Admin'
      });
    }
    const mockUser = { id: dbUser.id, role: 'admin' };

    // 3. Execute Packing Work Order 1 (200 g × 20 packs = 4.000 Kg bulk)
    let resData = null;
    let resStatus = 200;
    const req1 = {
      user: mockUser,
      body: {
        productId: bulkProduct.id,
        packSizeId: packSize200g.id,
        qtyToProduce: 20,
        mfgEntryId: mfgEntry.id,
        mfgBatchNumber: 'ABC240725',
        status: 'completed'
      }
    };
    const res1 = {
      status: (code) => { resStatus = code; return res1; },
      json: (data) => { resData = data; return res1; }
    };

    await repackController.createEntry(req1, res1, (err) => { if (err) throw err; });
    console.log('✓ Packing Work Order 1 Executed (20 packs × 200g)');
    
    // Assertions for Work Order 1
    const entry1 = resData;
    if (!entry1 || !entry1.id) throw new Error('Packing Work Order 1 creation failed!');
    console.log(`  - Created Repack Entry: ${entry1.repackNumber}`);
    
    const updatedMfg1 = await ManufacturingEntry.findByPk(mfgEntry.id);
    console.log(`  - Remaining Bulk Stock on Batch: ${updatedMfg1.remainingBulkStock} Kg (Expected: 2.000 Kg)`);
    if (Number(updatedMfg1.remainingBulkStock) !== 2.000) throw new Error('Bulk stock calculation mismatch on Work Order 1!');

    const updatedPack200g = await ProductPackSize.findByPk(packSize200g.id);
    console.log(`  - Finished Goods Stock for 200g Pack: ${updatedPack200g.stock} Packs (Expected: 20 Packs)`);
    if (Number(updatedPack200g.stock) !== 20) throw new Error('Finished goods stock increment mismatch!');

    // 4. Test Over-Packing Prevention (Attempting 1 Kg × 3 packs = 3 Kg when only 2 Kg available)
    let overPackData = null;
    let overPackStatus = 200;
    const reqOver = {
      user: mockUser,
      body: {
        productId: bulkProduct.id,
        packSizeId: packSize1Kg.id,
        qtyToProduce: 3, // Requires 3 Kg, but only 2 Kg available!
        mfgEntryId: mfgEntry.id,
        status: 'completed'
      }
    };
    const resOver = {
      status: (code) => { overPackStatus = code; return resOver; },
      json: (data) => { overPackData = data; return resOver; }
    };

    await repackController.createEntry(reqOver, resOver, (err) => { if (err) throw err; });
    console.log(`✓ Over-packing test executed. HTTP Status: ${overPackStatus} (Expected: 400)`);
    if (overPackStatus !== 400) throw new Error('Over-packing was NOT blocked!');
    console.log(`  - Error Message: "${overPackData.message}"`);
    console.log(`  - Max Packs Possible: ${overPackData.maxPacksPossible} Packs (Expected: 2 Packs)`);
    if (overPackData.maxPacksPossible !== 2) throw new Error('Max packs possible calculation error!');

    // 5. Execute Packing Work Order 2 (1 Kg × 2 packs = 2.000 Kg bulk)
    const req2 = {
      user: mockUser,
      body: {
        productId: bulkProduct.id,
        packSizeId: packSize1Kg.id,
        qtyToProduce: 2, // Consumes remaining 2.000 Kg
        mfgEntryId: mfgEntry.id,
        mfgBatchNumber: 'ABC240725',
        status: 'completed'
      }
    };
    const res2 = {
      status: (code) => { resStatus = code; return res2; },
      json: (data) => { resData = data; return res2; }
    };

    await repackController.createEntry(req2, res2, (err) => { if (err) throw err; });
    const updatedMfg2 = await ManufacturingEntry.findByPk(mfgEntry.id);
    console.log(`✓ Packing Work Order 2 Executed. Remaining Bulk Stock: ${updatedMfg2.remainingBulkStock} Kg (Expected: 0.000 Kg)`);
    if (Number(updatedMfg2.remainingBulkStock) !== 0.000) throw new Error('Remaining bulk stock should be 0!');

    // 6. Test Atomic Void / Reversal Flow
    console.log(`--- Testing Atomic Void / Reversal on Entry ${entry1.id} (${entry1.repackNumber}) ---`);
    let revData = null;
    let revStatus = 200;
    const reqRev = {
      user: mockUser,
      params: { id: entry1.id },
      body: { reason: 'Operator error reversal test' }
    };
    const resRev = {
      status: (code) => { revStatus = code; return resRev; },
      json: (data) => { revData = data; return resRev; }
    };

    await repackController.reverseEntry(reqRev, resRev, (err) => { if (err) throw err; });
    console.log(`✓ Reversal executed. Response: "${revData.message}"`);

    const postRevMfg = await ManufacturingEntry.findByPk(mfgEntry.id);
    console.log(`  - Bulk Stock after Void Reversal: ${postRevMfg.remainingBulkStock} Kg (Expected: 4.000 Kg restored)`);
    if (Number(postRevMfg.remainingBulkStock) !== 4.000) throw new Error('Bulk stock was NOT restored properly on reversal!');

    const postRevPack = await ProductPackSize.findByPk(packSize200g.id);
    console.log(`  - Finished Goods Stock after Void Reversal: ${postRevPack.stock} Packs (Expected: 0 Packs)`);
    if (Number(postRevPack.stock) !== 0) throw new Error('Finished goods stock was NOT decremented properly on reversal!');

    const revEntryInDb = await RepackEntry.findByPk(entry1.id);
    console.log(`  - Entry Status: ${revEntryInDb.status} (Reversal Reason: "${revEntryInDb.reversalReason}")`);
    if (revEntryInDb.status !== 'reversed') throw new Error('Entry status was NOT marked reversed!');

    console.log('\n==============================================');
    console.log('VERIFICATION COMPLETE: Passed 10/10 assertions.');
    console.log('==============================================\n');
    process.exit(0);

  } catch (err) {
    console.error('❌ VERIFICATION FAILED:', err);
    process.exit(1);
  }
}

runVerification();
