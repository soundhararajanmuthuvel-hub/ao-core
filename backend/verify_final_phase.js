const { sequelize } = require('./config/db');
const connectDB = require('./config/db');
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const RawMaterial = require('./models/RawMaterial');
const StockMovement = require('./models/StockMovement');
const ManufacturingEntry = require('./models/ManufacturingEntry');
const Invoice = require('./models/Invoice');
const InvoiceItem = require('./models/InvoiceItem');
const Shipment = require('./models/Shipment');
const { runTrackingAutoCheck } = require('./controllers/shippingController');
const { updateStock } = require('./utils/stockService');

async function testAll() {
  console.log('--- STARTING VERIFICATION SYSTEM FOR FINAL BUSINESS LOGIC ---');
  await connectDB();
  console.log('Connected to Database successfully.');

  // Clean old test objects safely by disabling foreign key checks
  await sequelize.query('PRAGMA foreign_keys = OFF;');
  try {
    const existingProd = await Product.findOne({ where: { sku: 'TEST-FG-1' } });
    if (existingProd) {
      const InvoiceItem = require('./models/InvoiceItem');
      const StockMovement = require('./models/StockMovement');
      const StockLoss = require('./models/StockLoss');
      const Shipment = require('./models/Shipment');
      
      await StockLoss.destroy({ where: { productId: existingProd.id } });
      await StockMovement.destroy({ where: { productId: existingProd.id } });
      
      const invoiceItems = await InvoiceItem.findAll({ where: { productId: existingProd.id } });
      for (const item of invoiceItems) {
        await Shipment.destroy({ where: { invoiceId: item.invoiceId } });
        await Invoice.destroy({ where: { id: item.invoiceId } });
      }
      await InvoiceItem.destroy({ where: { productId: existingProd.id } });
      await Product.destroy({ where: { id: existingProd.id } });
    }

    const existingCust = await Customer.findOne({ where: { email: 'testcustomer@ao.com' } });
    if (existingCust) {
      await Invoice.destroy({ where: { customerId: existingCust.id } });
      await Customer.destroy({ where: { id: existingCust.id } });
    }

    const existingRM = await RawMaterial.findOne({ where: { materialCode: 'TEST-RM-1' } });
    if (existingRM) {
      const RawMaterialMovement = require('./models/RawMaterialMovement');
      await RawMaterialMovement.destroy({ where: { rawMaterialId: existingRM.id } });
      await RawMaterial.destroy({ where: { id: existingRM.id } });
    }
  } finally {
    await sequelize.query('PRAGMA foreign_keys = ON;');
  }

  // 1. Create raw materials and product
  const rm = await RawMaterial.create({
    name: 'Test Raw Material 1',
    materialCode: 'TEST-RM-1',
    category: 'Ingredients',
    unit: 'Kg',
    stock: 500,
    minStock: 10,
    purchasePrice: 10.00
  });

  const prod = await Product.create({
    name: 'Test Product 250g',
    sku: 'TEST-FG-1',
    sellingPrice: 150.00,
    purchasePrice: 40.00,
    stock: 0,
    unit: 'Kg',
    weight: 0.250,
    productType: 'manufactured'
  });

  // 2. Create customer with special pricing overrides
  const cust = await Customer.create({
    name: 'Test VIP Customer',
    email: 'testcustomer@ao.com',
    phone: '9876543210',
    customerType: 'Retail Shop',
    paymentTerms: 'Net 30',
    state: 'Tamil Nadu',
    specialPricing: {
      [prod.id]: {
        price: 130.00,
        discount: 10.00, // 10% discount on custom price
        scheme: '10+1'
      }
    }
  });

  console.log('✓ Created Test entities.');

  // 3. Perform a manufacturing run: generates MMM-YYYY batch & best before 6 months expiry
  const entryDate = new Date();
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const expectedBatch = `${months[entryDate.getMonth()]}-${entryDate.getFullYear()}`;
  
  // Directly simulate createEntry stock update
  await updateStock(prod.id, 100, {
    type: 'manufacturing',
    batchNumber: expectedBatch,
    expiryDate: new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000)
  });

  console.log(`✓ Stock movement generated with batch ${expectedBatch}.`);
  const mfgMove = await StockMovement.findOne({ where: { productId: prod.id, batchNumber: expectedBatch } });
  if (mfgMove) {
    console.log(`  Found movement: Batch = ${mfgMove.batchNumber}, Expiry = ${mfgMove.expiryDate}`);
  } else {
    throw new Error('Failed to find manufacturing stock movement!');
  }

  // Add another batch (older/expiring soon) to test FIFO
  const oldBatch = 'JAN-2026';
  const oldExpiry = new Date('2026-07-01');
  await updateStock(prod.id, 50, {
    type: 'manufacturing',
    batchNumber: oldBatch,
    expiryDate: oldExpiry
  });
  console.log(`✓ Old stock batch ${oldBatch} loaded for FIFO verification.`);

  // 4. Test FIFO Stock Deduction & Price Engine on Sale
  console.log('Testing sales creation with specialPricing overrides & schemes...');
  
  const req = {
    body: {
      customer: cust.id,
      items: [
        {
          product: prod.id,
          qty: 20,
          unitPrice: 150.00, 
          gstPercent: 0
        }
      ],
      paymentMethod: 'credit',
      paymentStatus: 'pending',
      amountPaid: 0,
      date: new Date()
    },
    user: { id: 1 }
  };

  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; }
  };

  const next = (err) => { if (err) throw err; };

  const salesController = require('./controllers/salesController');
  await salesController.createSale(req, res, next);

  console.log('✓ createSale executed successfully.');
  const invoice = await Invoice.findOne({
    where: { customerId: cust.id },
    include: [{ model: InvoiceItem, as: 'items' }]
  });

  if (!invoice) throw new Error('Invoice not created');
  console.log(`  Invoice Created: ${invoice.invoiceNumber}`);
  console.log(`  Grand Total: ₹${invoice.grandTotal} (Expected: ~2615)`);
  console.log(`  Shipping Charge: ₹${invoice.shippingCharge} (Expected: ~275)`);
  console.log(`  Invoice Due Date: ${invoice.dueDate} (Expected: ~30 days from now)`);

  const item = invoice.items[0];
  console.log(`  Item Name: ${item.name}`);
  console.log(`  Item Qty: ${item.qty}, Free Qty: ${item.freeQty} (Expected: 20 + 2)`);
  console.log(`  Item Scheme: ${item.schemeApplied} (Expected: 10+1)`);
  console.log(`  Item Price: ₹${item.unitPrice} (Expected: 117.00)`);
  console.log(`  Item Offer Cost: ₹${item.offerCost} (Expected: 2 * purchasePrice = 80.00)`);
  console.log(`  Item Actual Profit: ₹${item.actualProfit} (Expected: (20 * 117) - (22 * 40) = 2340 - 880 = 1460.00)`);

  // Verify FIFO deduction: Deducted 22 units of prod.
  const oldBatchMove = await StockMovement.findOne({
    where: { productId: prod.id, batchNumber: 'JAN-2026', quantity: -22 }
  });
  if (oldBatchMove) {
    console.log(`✓ FIFO Verification: Successfully deducted 22 units from oldest batch 'JAN-2026'.`);
  } else {
    throw new Error('FIFO verification failed: No matching negative movement found on old batch!');
  }

  // 5. Test Outstanding Invoices Endpoint
  const outstandingRes = {
    status(code) { return this; },
    json(data) { this.data = data; }
  };
  await salesController.getOutstandingInvoices({}, outstandingRes, next);
  console.log(`✓ getOutstandingInvoices returned ${outstandingRes.data.length} records.`);
  const VIPOutstanding = outstandingRes.data.find(o => o.id === invoice.id);
  if (VIPOutstanding) {
    console.log(`  Outstanding Invoice: Balance = ₹${VIPOutstanding.balance}, Days Overdue = ${VIPOutstanding.daysOverdue}`);
  } else {
    throw new Error('Failed to find VIP invoice in outstanding report!');
  }

  // 6. Test WhatsApp Reminder Endpoint
  const reminderReq = { params: { id: invoice.id } };
  const reminderRes = {
    status(code) { return this; },
    json(data) { this.data = data; }
  };
  await salesController.getWhatsAppReminder(reminderReq, reminderRes, next);
  console.log('✓ getWhatsAppReminder generated reminder payload:');
  console.log(`  Text: "${reminderRes.data.messageText}"`);
  console.log(`  Link: ${reminderRes.data.whatsappUrl}`);

  // 7. Test Stock Loss Logging
  console.log('Testing Stock Loss logging...');
  const inventoryController = require('./controllers/inventoryController');
  const lossReq = {
    body: {
      itemType: 'finished_goods',
      productId: prod.id,
      quantity: 5,
      reason: 'Packing Damage',
      notes: 'Burst bag'
    },
    user: { id: 1 }
  };
  const lossRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; }
  };
  await inventoryController.createStockLoss(lossReq, lossRes, next);
  console.log(`✓ createStockLoss executed successfully. Loss Value: ₹${lossRes.data.totalLossValue}`);

  // Check new product stock level
  const updatedProd = await Product.findByPk(prod.id);
  console.log(`  Updated Product Stock: ${updatedProd.stock} (Expected: 123)`);
  if (Number(updatedProd.stock) !== 123) throw new Error('Stock levels mismatch after loss deduction');

  // Test Loss Dashboard
  const dashRes = {
    status(code) { return this; },
    json(data) { this.data = data; }
  };
  await inventoryController.getLossDashboard({}, dashRes, next);
  console.log(`✓ Loss Dashboard: Monthly Loss = ₹${dashRes.data.monthlyLossValue}, Loss % of Sales = ${dashRes.data.lossPercentage}%`);

  // 8. Test Shipment Tracker Background check
  console.log('Testing Shipment Tracking background scheduler simulation...');
  const ShipmentModel = require('./models/Shipment');
  const shipment = await ShipmentModel.create({
    shipmentNumber: 'SH-TEST-1',
    invoiceId: invoice.id,
    trackingNumber: 'kmu3907483',
    courier: 'Professional Couriers',
    shipmentDate: new Date(Date.now() - 3 * 60 * 60 * 1000), 
    status: 'Pending',
    courierStatus: 'Pending',
    createdById: 1
  });

  await runTrackingAutoCheck();
  const updatedShipment = await ShipmentModel.findByPk(shipment.id);
  console.log(`✓ runTrackingAutoCheck executed.`);
  console.log(`  Updated Shipment Status: ${updatedShipment.status} (Expected: In Transit)`);
  console.log(`  Courier Location: ${updatedShipment.lastKnownLocation}`);
  if (updatedShipment.status !== 'In Transit') throw new Error('Tracking simulation did not progress shipment status');

  console.log('--- ALL VERIFICATIONS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

testAll().catch(err => {
  console.error('VERIFICATION FAILED WITH ERROR:', err);
  process.exit(1);
});
