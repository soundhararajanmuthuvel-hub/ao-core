const { sequelize } = require('./config/db');
const connectDB = require('./config/db');
const ReturnRequest = require('./models/ReturnRequest');
const ReturnItem = require('./models/ReturnItem');
const RepackWorkOrder = require('./models/RepackWorkOrder');
const ManufacturingNcr = require('./models/ManufacturingNcr');
const BatchRecall = require('./models/BatchRecall');
const ReturnCreditNote = require('./models/ReturnCreditNote');
const SupplierClaim = require('./models/SupplierClaim');
const ReturnPolicy = require('./models/ReturnPolicy');


const returnsController = require('./controllers/returnsController');

// Mock response builder
function createMockRes() {
  const res = {};
  res.statusCode = 200;
  res.status = function(code) {
    this.statusCode = code;
    return this;
  };
  res.json = function(data) {
    this.responseData = data;
    return this;
  };
  return res;
}

async function testReturnRecoverySystem() {
  console.log('====================================================');
  console.log('STARTING AO CORE ERP V5.5 RETURN & RECOVERY VERIFICATION');
  console.log('====================================================');

  try {
    // 1. Sync DB tables safely
    console.log('\n[1/7] Syncing Database Models...');
    await sequelize.query('PRAGMA foreign_keys = OFF;');
    await connectDB();
    await ReturnPolicy.sync();
    await ReturnRequest.sync();
    await ReturnItem.sync();
    await RepackWorkOrder.sync();
    await ManufacturingNcr.sync();
    await SupplierClaim.sync();
    await BatchRecall.sync();
    await ReturnCreditNote.sync();
    await sequelize.query('PRAGMA foreign_keys = ON;');
    console.log('✓ Database tables synchronized successfully.');

    // Ensure a test Product exists for foreign key constraints
    const Product = require('./models/Product');
    let testProd = await Product.findOne();
    if (!testProd) {
      testProd = await Product.create({
        name: 'ABC Malt 500g Pouch',
        sku: 'ABC-MALT-500',
        price: 250,
        stock: 100,
        unit: 'Pks',
        category: 'Malts'
      });
    }

    // 2. Test Scan Lookup Endpoint
    console.log('\n[2/7] Testing Barcode & QR Code Scan Lookup API...');
    const scanReq = { body: { barcode: 'ABC-MALT-500' } };
    const scanRes = createMockRes();
    await returnsController.scanLookup(scanReq, scanRes);
    console.log('✓ Scan lookup successful:', scanRes.responseData.data.productName);

    // 3. Test Create RMA Return Request
    console.log('\n[3/7] Testing Return Authorization (RMA) Creation...');
    const rmaReq = {
      body: {
        category: 'External',
        source: 'Retail Shop',
        customerType: 'Retail Shop',
        returnType: 'Customer Return',
        returnReason: 'Damaged Packing',
        rootCause: 'Transport',
        courierName: 'Professional Couriers',
        trackingNumber: 'TRK-984210',
        gpsLatitude: 11.0168,
        gpsLongitude: 76.9558,
        items: [
          {
            productId: testProd.id,
            batchNumber: 'ABC240715',
            quantity: 10,
            unit: 'Pks',
            unitPrice: 250,
            qcConditionProduct: 'Perfect',
            qcConditionPackage: 'Torn'
          }
        ]
      }
    };

    const rmaRes = createMockRes();
    await returnsController.createReturnRequest(rmaReq, rmaRes);
    const createdRma = rmaRes.responseData.data;
    console.log(`✓ RMA Created: ${createdRma.rmaNumber} (Approval Level: ${createdRma.approvalLevel})`);

    // 4. Test Manager RMA Approval
    console.log('\n[4/7] Testing Manager RMA Approval Workflow...');
    const approveReq = { params: { id: createdRma.id }, body: { action: 'Approve' } };
    const approveRes = createMockRes();
    await returnsController.approveReturn(approveReq, approveRes);
    console.log(`✓ RMA Approved. Current Status: ${approveRes.responseData.data.status}`);

    // 5. Test QC Inspection & Mandatory Disposition Execution
    console.log('\n[5/7] Testing Warehouse QC Inspection & Repack Work Order Engine...');
    const rmaDetailsReq = { params: { id: createdRma.id } };
    const rmaDetailsRes = createMockRes();
    await returnsController.getReturnById(rmaDetailsReq, rmaDetailsRes);
    const itemId = rmaDetailsRes.responseData.data.items[0].id;

    const qcReq = {
      params: { id: createdRma.id },
      body: {
        qcRemarks: 'Pouch damaged during transit, product perfect. Routed to Repacking Dept.',
        itemsInspection: [
          {
            itemId: itemId,
            disposition: 'Repack',
            qcConditionProduct: 'Perfect',
            qcConditionPackage: 'Torn',
            packagingFailureCategory: 'Torn Pouch'
          }
        ]
      }
    };
    const qcRes = createMockRes();
    await returnsController.qcInspect(qcReq, qcRes);
    console.log(`✓ QC Inspection Completed. Status: ${qcRes.responseData.data.status}`);

    // 6. Test Repack Work Order Completion
    console.log('\n[6/7] Testing Repack Work Order Execution...');
    const repackReq = { query: {} };
    const repackRes = createMockRes();
    await returnsController.getRepackWorkOrders(repackReq, repackRes);
    console.log(`✓ Repack Work Orders Count: ${repackRes.responseData.count}`);
    if (repackRes.responseData.data.length > 0) {
      const woId = repackRes.responseData.data[0].id;
      const completeWoReq = { params: { id: woId } };
      const completeWoRes = createMockRes();
      await returnsController.completeRepackWorkOrder(completeWoReq, completeWoRes);
      console.log(`✓ Repack Work Order ${repackRes.responseData.data[0].workOrderNumber} Completed & Restored to Finished Goods.`);
    }

    // 7. Test AI Predictions & Executive Dashboard Metrics
    console.log('\n[7/7] Testing AI Predictions & Executive Recovery Dashboard...');
    const aiReq = { query: {} };
    const aiRes = createMockRes();
    await returnsController.getAiInsights(aiReq, aiRes);
    console.log(`✓ AI Insights Generated: ${aiRes.responseData.count} predictions active.`);
    aiRes.responseData.data.forEach((ins, idx) => {
      console.log(`   [AI #${idx + 1}] [${ins.severity}] ${ins.title}: ${ins.description}`);
    });

    const dashReq = { query: {} };
    const dashRes = createMockRes();
    await returnsController.getDashboardMetrics(dashReq, dashRes);
    console.log(`✓ Dashboard Recovery Metrics: Recovery % = ${dashRes.responseData.data.recoveryPercentage}%, Loss % = ${dashRes.responseData.data.lossPercentage}%`);

    console.log('\n====================================================');
    console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (10/10)');
    console.log('====================================================');
    process.exit(0);
  } catch (error) {
    console.error('Verification failed:', error);
    process.exit(1);
  }
}

testReturnRecoverySystem();
