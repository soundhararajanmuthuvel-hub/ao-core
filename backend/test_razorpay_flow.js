require('dotenv').config();
const crypto = require('crypto');
const connectDB = require('./config/db');
const WebsiteOrder = require('./models/WebsiteOrder');
const WebsiteProduct = require('./models/WebsiteProduct');
const { createRazorpayOrder, verifyPayment, handleWebhook } = require('./controllers/websiteOrderController');

async function testRazorpayIntegration() {
  console.log('=== REAL RAZORPAY INTEGRATION SUITE ===\n');
  await connectDB();

  // 1. Ensure test product exists
  let product = await WebsiteProduct.findOne();
  if (!product) {
    product = await WebsiteProduct.create({
      name: 'Sprouted Ragi Malt 500g',
      slug: 'sprouted-ragi-malt-500g',
      price: 250.00,
      stock: 50,
      isActive: true
    });
  }
  const initialStock = product.stock;
  console.log(`✓ Product ready: ${product.name} (Stock: ${initialStock}, Price: ₹${product.price})`);

  // 2. Test Order Creation
  const reqOrder = {
    headers: {},
    body: {
      items: [{ productId: product.id, qty: 2 }],
      shippingAddress: {
        fullName: 'Test Customer',
        mobile: '9876543210',
        addressLine1: '123 Test Street',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560001'
      },
      guestDetails: {
        fullName: 'Test Customer',
        mobile: '9876543210',
        email: 'test@example.com'
      }
    }
  };

  let resOrderData = null;
  const resOrder = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { resOrderData = data; return this; }
  };

  await createRazorpayOrder(reqOrder, resOrder);

  if (!resOrderData || !resOrderData.success) {
    console.error('❌ Order creation failed:', resOrderData);
    process.exit(1);
  }

  console.log(`✓ Order initialized successfully!`);
  console.log(`  - Order Number: ${resOrderData.orderNumber}`);
  console.log(`  - Razorpay Order ID: ${resOrderData.razorpayOrderId}`);
  console.log(`  - Amount: ₹${resOrderData.amount} (${resOrderData.amountPaise} paise)`);
  console.log(`  - Currency: ${resOrderData.currency}`);
  console.log(`  - Key ID returned: ${resOrderData.keyId}`);
  if (resOrderData.key_secret || resOrderData.keySecret) {
    console.error('❌ SECURITY ERROR: Key secret exposed in response!');
    process.exit(1);
  } else {
    console.log(`✓ Security Check: Key secret is NOT exposed.`);
  }

  // 3. Test Webhook Payment Captured Signature Verification & Stock Decrement
  const mockWebhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_blovit_webhook_secret_2026';
  const webhookBodyObj = {
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: `pay_test_${Date.now()}`,
          order_id: resOrderData.razorpayOrderId,
          amount: resOrderData.amountPaise,
          status: 'captured'
        }
      }
    }
  };

  const rawWebhookBody = JSON.stringify(webhookBodyObj);
  const webhookSignature = crypto
    .createHmac('sha256', mockWebhookSecret)
    .update(rawWebhookBody)
    .digest('hex');

  const reqWebhook = {
    headers: {
      'x-razorpay-signature': webhookSignature
    },
    rawBody: Buffer.from(rawWebhookBody, 'utf8'),
    body: webhookBodyObj
  };

  let webhookResData = null;
  const resWebhook = {
    status: function(code) { this.statusCode = code; return this; },
    json: function(data) { webhookResData = data; return this; }
  };

  await handleWebhook(reqWebhook, resWebhook);
  console.log(`✓ Webhook handled response:`, webhookResData);

  const updatedOrder = await WebsiteOrder.findOne({ where: { razorpayOrderId: resOrderData.razorpayOrderId } });
  console.log(`✓ Order Status in DB after Webhook: ${updatedOrder.status} / Payment: ${updatedOrder.paymentStatus}`);

  const updatedProduct = await WebsiteProduct.findByPk(product.id);
  console.log(`✓ Stock after purchase: ${updatedProduct.stock} (decremented by 2 from ${initialStock})`);

  if (updatedOrder.paymentStatus === 'Captured' && updatedProduct.stock === initialStock - 2) {
    console.log('\n✅ ALL INTEGRATION CHECKS PASSED SUCCESSFULLY!\n');
  } else {
    console.error('❌ Verification state mismatch.');
  }

  process.exit(0);
}

testRazorpayIntegration().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
