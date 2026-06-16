const { sequelize } = require('./config/db');
const connectDB = require('./config/db');
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Order = require('./models/Order');
const Invoice = require('./models/Invoice');
const InvoiceItem = require('./models/InvoiceItem');
const Shipment = require('./models/Shipment');
const StockMovement = require('./models/StockMovement');
const Settings = require('./models/Settings');
const { Op } = require('sequelize');
const { updateStock } = require('./utils/stockService');

// Simple assertion helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function verifyOrderNoting() {
  console.log('--- STARTING VERIFICATION SYSTEM FOR ORDER NOTING MODULE ---');
  await connectDB();
  console.log('Connected to Database successfully.');

  // Clean old test objects safely
  await sequelize.query('PRAGMA foreign_keys = OFF;');
  try {
    const existingProd = await Product.findOne({ where: { sku: 'TEST-ORD-FG-1' } });
    if (existingProd) {
      await StockMovement.destroy({ where: { productId: existingProd.id } });
      await InvoiceItem.destroy({ where: { productId: existingProd.id } });
      await Product.destroy({ where: { id: existingProd.id } });
    }

    const existingCust = await Customer.findOne({ where: { phone: '9876543219' } });
    if (existingCust) {
      await Customer.destroy({ where: { id: existingCust.id } });
    }

    const testOrders = await Order.findAll({
      where: {
        [Op.or]: [
          { customerName: 'Test Noting VIP Customer' },
          { customerName: 'Test Backdated Customer' },
          { orderNumber: { [Op.like]: 'ORD-%' } }
        ]
      }
    });

    for (const order of testOrders) {
      if (order.invoiceId) {
        await InvoiceItem.destroy({ where: { invoiceId: order.invoiceId } });
        await Invoice.destroy({ where: { id: order.invoiceId } });
      }
      if (order.shipmentId) {
        await Shipment.destroy({ where: { id: order.shipmentId } });
      }
      await Order.destroy({ where: { id: order.id } });
    }
    
    console.log('Cleaned up previous test records.');
  } finally {
    await sequelize.query('PRAGMA foreign_keys = ON;');
  }

  // 1. Verify database schemas and settings defaults
  const settings = await Settings.findOne();
  assert(settings !== null, 'Settings record exists');
  assert(settings.boxWeight !== undefined, 'Settings.boxWeight is defined');
  assert(settings.packingMaterialWeight !== undefined, 'Settings.packingMaterialWeight is defined');
  assert(settings.logisticsCharge !== undefined, 'Settings.logisticsCharge is defined');
  assert(settings.orderCounter !== undefined, 'Settings.orderCounter is defined');
  console.log(`Settings defaults: Box Weight=${settings.boxWeight}kg, Packing Weight=${settings.packingMaterialWeight}kg, Logistics Charge=₹${settings.logisticsCharge}`);

  // Create test entities
  const prod = await Product.create({
    name: 'Test Noting Product 500g',
    sku: 'TEST-ORD-FG-1',
    sellingPrice: 200.00,
    purchasePrice: 60.00,
    stock: 0,
    unit: 'Kg',
    weight: 0.500,
    productType: 'manufactured'
  });

  const cust = await Customer.create({
    name: 'Test Noting VIP Customer',
    email: 'testnoting@ao.com',
    phone: '9876543219',
    customerType: 'Retail Shop',
    paymentTerms: 'COD',
    state: 'Tamil Nadu',
    specialPricing: {
      [prod.id]: {
        price: 180.00,
        discount: 5.00, // 5% discount on 180.00 -> 171.00
        scheme: '10+1'
      }
    }
  });
  console.log('✓ Created Test Product & Customer with Special Pricing override.');

  // Load a batch via manufacturing to ensure FIFO stock deduction works
  const currentBatch = 'JUN-2026';
  await updateStock(prod.id, 100, {
    type: 'manufacturing',
    batchNumber: currentBatch,
    expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
  });
  console.log('✓ Stock loaded via manufacturing (100 units).');

  // Test 2: Create Prepared Order (Fast Order Entry Form Tab)
  console.log('\n--- Test 2: Create Prepared Order ---');
  const orderController = require('./controllers/orderController');
  
  const createReq = {
    body: {
      customerName: cust.name,
      customerId: cust.id,
      phoneNumber: cust.phone,
      area: 'Chennai',
      address: '123 Test Street, Chennai',
      notes: 'Please pack carefully.',
      logisticsCharge: 16.00,
      items: [
        {
          productId: prod.id,
          qty: 10,
          unitPrice: 200.00
        }
      ]
    },
    user: { id: 1 }
  };

  const createRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; }
  };

  const next = (err) => { if (err) throw err; };

  await orderController.createOrder(createReq, createRes, next);
  assert(createRes.statusCode === 201, 'Order created successfully with HTTP 201');
  const createdOrder = createRes.data.order;
  assert(createdOrder.status === 'Prepared', 'Order status is initially "Prepared"');
  assert(createdOrder.orderNumber.startsWith('ORD-'), `Order number generated: ${createdOrder.orderNumber}`);
  assert(!createdOrder.invoiceId, 'No invoice is generated during Prepared stage');
  assert(!createdOrder.shipmentId, 'No shipment is registered during Prepared stage');

  // Verify no stock is deducted yet
  const prodAfterPrepared = await Product.findByPk(prod.id);
  assert(Number(prodAfterPrepared.stock) === 100, 'Product stock remains 100 during Prepared stage');

  // Test 3: Attempt to "Mark as Packed" with INSUFFICIENT stock
  console.log('\n--- Test 3: Mark as Packed (Insufficient Stock) ---');
  // Temporarily adjust product stock to 5 units
  await Product.update({ stock: 5 }, { where: { id: prod.id } });
  
  const packFailReq = {
    params: { id: createdOrder.id },
    user: { id: 1 }
  };
  const packFailRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; }
  };

  await orderController.markPacked(packFailReq, packFailRes, next);
  assert(packFailRes.statusCode === 400, 'Mark Packed returned HTTP 400 for insufficient stock');
  assert(packFailRes.data.message.includes('Insufficient stock'), `Fails with error: ${packFailRes.data.message}`);

  // Restore stock
  await Product.update({ stock: 100 }, { where: { id: prod.id } });

  // Test 4: Successful "Mark as Packed"
  console.log('\n--- Test 4: Mark as Packed (Successful) ---');
  const packSuccessRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; }
  };

  await orderController.markPacked(packFailReq, packSuccessRes, next);
  assert(packSuccessRes.statusCode === 200, 'Mark Packed returned HTTP 200');
  
  // Inspect updated order, invoice, and shipment
  const packedOrder = packSuccessRes.data.order;
  const invoice = packSuccessRes.data.invoice;
  const shipment = packSuccessRes.data.shipment;

  assert(packedOrder.status === 'Packed', 'Order transitioned to "Packed"');
  assert(packedOrder.invoiceId !== null, `Invoice linked: ${packedOrder.invoiceId}`);
  assert(packedOrder.shipmentId !== null, `Shipment linked: ${packedOrder.shipmentId}`);

  // Verify stock deduction (10 + 1 free = 11 units should be deducted)
  const prodAfterPacked = await Product.findByPk(prod.id);
  assert(Number(prodAfterPacked.stock) === 89, `Stock deducted: ${prodAfterPacked.stock} (Expected 89)`);

  // Verify special pricing was resolved
  // Base price = 180, discount = 5%, net = 171. Qty = 10. GST exclusive.
  // 10 * 171 = 1710. GST percent = 0 (since prod has 0 gstPercent).
  // Total line total = 1710. Grand total = 1710 + 16 (logistics charge) = 1726.
  assert(Number(invoice.grandTotal) === 1726.00, `Invoice grandTotal is ₹${invoice.grandTotal} (Expected ₹1726.00)`);
  assert(Number(invoice.shippingCharge) === 16.00, `Invoice shippingCharge is ₹${invoice.shippingCharge} (Expected ₹16.00)`);

  const invoiceItems = await InvoiceItem.findAll({ where: { invoiceId: invoice.id } });
  assert(invoiceItems.length === 1, 'InvoiceItem created');
  const invItem = invoiceItems[0];
  assert(Number(invItem.qty) === 10, 'InvoiceItem qty is 10');
  assert(Number(invItem.freeQty) === 1, 'InvoiceItem freeQty is 1 (Applying scheme 10+1)');
  assert(invItem.schemeApplied === '10+1', 'Scheme "10+1" was applied');

  // Verify shipment details
  assert(shipment.status === 'Pending', `Shipment status is "${shipment.status}"`);
  assert(shipment.trackingNumber === '', 'Shipment tracking number is blank/null');
  assert(shipment.courier === '', 'Shipment courier partner is blank/null');
  // Weight estimation:
  // 11 units * 0.500kg = 5.5kg.
  // Settings boxWeight = 0.200, packingMaterialWeight = 0.100.
  // totalProdWeight = 5.5.
  // Under the rules:
  // totalProdWeight <= 1.0 -> 1.5kg
  // totalProdWeight <= 5.0 -> 5kg
  // totalProdWeight <= 10.0 -> 10kg
  // Otherwise -> totalProdWeight + boxW + packW
  // Since totalProdWeight is 5.5kg (which is > 5.0 and <= 10.0), it should default to 10kg!
  assert(Number(shipment.packageWeight) === 10.0, `Shipment packageWeight is ${shipment.packageWeight} (Expected 10.0)`);

  // Test 5: Mark as Dispatched
  console.log('\n--- Test 5: Mark as Dispatched ---');
  const dispatchReq = {
    params: { id: packedOrder.id },
    body: {
      courierPartner: 'Delhivery',
      trackingNumber: 'DEL123456789',
      dispatchDate: new Date()
    },
    headers: { origin: 'http://localhost:5173' },
    user: { id: 1 }
  };
  const dispatchRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; }
  };

  await orderController.markDispatched(dispatchReq, dispatchRes, next);
  assert(dispatchRes.statusCode === 200, 'Mark Dispatched returned HTTP 200');
  const dispatchedOrder = dispatchRes.data.order;
  assert(dispatchedOrder.status === 'Dispatched', 'Order transitioned to "Dispatched"');
  assert(dispatchedOrder.courierPartner === 'Delhivery', 'Courier logged');
  assert(dispatchedOrder.trackingNumber === 'DEL123456789', 'Tracking Number logged');

  const updatedShipment = await Shipment.findByPk(shipment.id);
  assert(updatedShipment.status === 'In Transit', 'Shipment status transitioned to "In Transit"');
  assert(updatedShipment.courier === 'Delhivery', 'Shipment courier updated');
  assert(updatedShipment.trackingNumber === 'DEL123456789', 'Shipment tracking number updated');

  // Test 6: Mark as Delivered
  console.log('\n--- Test 6: Mark as Delivered ---');
  const deliverReq = {
    params: { id: dispatchedOrder.id },
    body: {
      deliveredBy: 'Suresh Kumar',
      remarks: 'Delivered in good condition.',
      deliveryDate: new Date()
    },
    user: { id: 1 }
  };
  const deliverRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; }
  };

  await orderController.markDelivered(deliverReq, deliverRes, next);
  assert(deliverRes.statusCode === 200, 'Mark Delivered returned HTTP 200');
  const deliveredOrder = deliverRes.data.order;
  assert(deliveredOrder.status === 'Delivered', 'Order status is "Delivered"');
  assert(deliveredOrder.deliveredBy === 'Suresh Kumar', 'Delivered By logged');
  assert(deliveredOrder.remarks === 'Delivered in good condition.', 'Remarks logged');

  const deliveredShipment = await Shipment.findByPk(shipment.id);
  assert(deliveredShipment.status === 'Delivered', 'Shipment status transitioned to "Delivered"');

  const paidInvoice = await Invoice.findByPk(invoice.id);
  assert(paidInvoice.paymentStatus === 'paid', 'Invoice paymentStatus set to paid for COD/Cash');
  assert(Number(paidInvoice.amountPaid) === 1726.00, `Invoice amountPaid is ${paidInvoice.amountPaid}`);

  // Test 7: Dashboard Stats and Overdue Dispatch Alerts (>3 Days Prepared)
  console.log('\n--- Test 7: Dashboard Stats & Delayed Alert Banner ---');
  
  // Create a backdated order (e.g. 4 days ago) in Prepared status
  const orderDate4DaysAgo = new Date();
  orderDate4DaysAgo.setDate(orderDate4DaysAgo.getDate() - 4);

  const backdatedOrder = await Order.create({
    orderNumber: 'ORD-TEST-DELAY',
    customerName: 'Test Backdated Customer',
    customerId: cust.id,
    phoneNumber: cust.phone,
    area: 'Coimbatore',
    address: '456 Test Road, Coimbatore',
    orderDate: orderDate4DaysAgo,
    expectedDispatchDate: new Date(orderDate4DaysAgo.getTime() + 3 * 24 * 60 * 60 * 1000),
    status: 'Prepared',
    logisticsCharge: 16.00,
    totalAmount: 16.00,
    items: [],
    source: 'ERP_Manual'
  });

  console.log('✓ Created backdated Prepared order (4 days old) to trigger alert.');

  const dashRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; }
  };

  await orderController.getOrderDashboard({}, dashRes, next);
  assert(dashRes.statusCode === 200, 'Dashboard statistics returned HTTP 200');
  const stats = dashRes.data;
  console.log('Dashboard Stats returned:', stats);
  assert(stats.preparedOrders >= 1, 'Includes prepared orders');
  assert(stats.delayedOrders >= 1, 'Overdue dispatch count (>3 days prepared) is >= 1');

  // Verify that analyticsController returns delayedOrdersCount
  const analyticsController = require('./controllers/analyticsController');
  const analyticsRes = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.data = data; }
  };
  await analyticsController.getDashboard({}, analyticsRes, next);
  assert(analyticsRes.statusCode === 200, 'Analytics Dashboard returned HTTP 200');
  assert(analyticsRes.data.cards && analyticsRes.data.cards.delayedOrdersCount !== undefined, `analyticsController getDashboard contains delayedOrdersCount: ${analyticsRes.data.cards.delayedOrdersCount}`);

  // Cleanup backdated test order
  await Order.destroy({ where: { id: backdatedOrder.id } });

  console.log('\n--- ALL VERIFICATIONS PASSED SUCCESSFULLY! ---');
  process.exit(0);
}

verifyOrderNoting().catch(err => {
  console.error('\n*** VERIFICATION FAILED ***');
  console.error(err);
  process.exit(1);
});
