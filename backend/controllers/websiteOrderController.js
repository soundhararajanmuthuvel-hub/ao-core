const crypto = require('crypto');
const Razorpay = require('razorpay');
const WebsiteOrder = require('../models/WebsiteOrder');
const WebsiteProduct = require('../models/WebsiteProduct');
const WebsiteCoupon = require('../models/WebsiteCoupon');
const WebsiteShippingRule = require('../models/WebsiteShippingRule');
const WebsiteEvent = require('../models/WebsiteEvent');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');

const getRazorpayKeyId = () => process.env.RAZORPAY_KEY_ID || 'rzp_test_blovit_mock_key';
const getRazorpayKeySecret = () => process.env.RAZORPAY_KEY_SECRET || 'rzp_test_blovit_mock_secret';
const getRazorpayWebhookSecret = () => process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_blovit_webhook_secret_2026';

// POST /api/website/razorpay/create-order
const createRazorpayOrder = async (req, res) => {
  try {
    const { items, shippingAddress, couponCode, guestDetails } = req.body;
    const customerId = req.websiteCustomer?.id || null;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required.' });
    }

    if (!shippingAddress) {
      return res.status(400).json({ success: false, message: 'Shipping address is required.' });
    }

    // Calculate subtotal from DB product prices to prevent price tampering
    let subtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
      const product = await WebsiteProduct.findByPk(item.productId);
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product ID ${item.productId} is no longer available.`,
        });
      }

      if (product.stock < item.qty) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for product "${product.name}".`,
        });
      }

      const itemTotal = Number(product.price) * Number(item.qty);
      subtotal += itemTotal;
      verifiedItems.push({
        productId: product.id,
        name: product.name,
        slug: product.slug,
        price: Number(product.price),
        qty: Number(item.qty),
        total: itemTotal,
        image: (() => {
          try { return JSON.parse(product.images || '[]')[0] || ''; } catch { return ''; }
        })(),
      });
    }

    // Calculate discount
    let discountAmount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      appliedCoupon = await WebsiteCoupon.findOne({
        where: { code: couponCode.toUpperCase(), isActive: true },
      });
      if (appliedCoupon) {
        const isNotExpired = !appliedCoupon.expiryDate || new Date(appliedCoupon.expiryDate) > new Date();
        const isWithinUsageLimit = appliedCoupon.usedCount < appliedCoupon.usageLimit;
        const meetsMinOrder = subtotal >= Number(appliedCoupon.minOrderValue);
        const customerMatches = !appliedCoupon.websiteCustomerId || (customerId && appliedCoupon.websiteCustomerId === customerId);

        if (isNotExpired && isWithinUsageLimit && meetsMinOrder && customerMatches) {
          if (appliedCoupon.type === 'percentage') {
            discountAmount = (subtotal * Number(appliedCoupon.value)) / 100;
          } else {
            discountAmount = Number(appliedCoupon.value);
          }
          discountAmount = Math.min(discountAmount, subtotal);
        }
      }
    }

    // Calculate shipping
    let shippingCost = 50.0; // Default flat rate
    const shippingRule = await WebsiteShippingRule.findOne({
      where: { isActive: true },
      order: [['freeShippingThreshold', 'ASC']],
    });

    if (shippingRule) {
      if (subtotal >= Number(shippingRule.freeShippingThreshold)) {
        shippingCost = 0.0;
      } else {
        shippingCost = Number(shippingRule.rate);
      }
    } else if (subtotal >= 999.0) {
      shippingCost = 0.0;
    }

    const totalAmount = Math.max(0, subtotal - discountAmount + shippingCost);
    const amountPaise = Math.round(totalAmount * 100);
    const orderNumber = `BLO-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const keyId = getRazorpayKeyId();
    const keySecret = getRazorpayKeySecret();

    // Create Razorpay Order ID
    let razorpayOrderId = `order_${Math.random().toString(36).substring(2, 15)}`;
    if (keyId && keySecret && !keyId.includes('placeholder') && !keyId.includes('mock')) {
      try {
        const instance = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });
        const razorpayOrder = await instance.orders.create({
          amount: amountPaise, // amount in paise
          currency: 'INR',
          receipt: orderNumber,
          notes: {
            orderNumber,
            websiteCustomerId: customerId ? String(customerId) : 'guest',
          },
        });
        razorpayOrderId = razorpayOrder.id;
      } catch (rzpErr) {
        console.warn('Razorpay API call failed, fallback to mock order ID:', rzpErr.message);
      }
    }

    // Save pending WebsiteOrder
    const newOrder = await WebsiteOrder.create({
      orderNumber,
      websiteCustomerId: customerId,
      guestName: guestDetails?.fullName || null,
      guestMobile: guestDetails?.mobile || null,
      guestEmail: guestDetails?.email || null,
      shippingAddress: JSON.stringify(shippingAddress),
      subtotal,
      discountAmount,
      shippingCost,
      totalAmount,
      couponCode: appliedCoupon ? appliedCoupon.code : null,
      status: 'Pending',
      paymentStatus: 'Pending',
      razorpayOrderId,
      items: JSON.stringify(verifiedItems),
    });

    res.status(201).json({
      success: true,
      message: 'Order initialized for payment.',
      orderId: newOrder.id,
      orderNumber: newOrder.orderNumber,
      razorpayOrderId: newOrder.razorpayOrderId,
      amount: totalAmount,
      amountPaise,
      currency: 'INR',
      keyId,
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    res.status(500).json({ success: false, message: 'Failed to create payment order' });
  }
};

// POST /api/website/razorpay/verify (Fast client-side UX verification)
const verifyPayment = async (req, res) => {
  try {
    const { websiteOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!websiteOrderId || !razorpayPaymentId) {
      return res.status(400).json({ success: false, message: 'Payment verification details missing.' });
    }

    const keySecret = getRazorpayKeySecret();
    const isLiveMode = keySecret && !keySecret.includes('mock') && !keySecret.includes('placeholder');

    // SECURITY: In live mode, signature is mandatory — no exceptions.
    // Allowing a missing signature to pass would let anyone mark any order as Paid
    // by simply omitting the field, bypassing HMAC verification entirely.
    if (isLiveMode) {
      if (!razorpaySignature) {
        return res.status(400).json({
          success: false,
          message: 'Payment signature is required.',
        });
      }
      if (!razorpayOrderId) {
        return res.status(400).json({
          success: false,
          message: 'Razorpay order ID is required for payment verification.',
        });
      }
    }

    const order = await WebsiteOrder.findByPk(websiteOrderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Verify HMAC signature
    let isValidSignature = true;
    if (isLiveMode && razorpaySignature && razorpayOrderId) {
      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
      isValidSignature = generatedSignature === razorpaySignature;
    }

    if (!isValidSignature) {
      console.warn(`[Razorpay] Signature mismatch for order ${websiteOrderId}. Possible tampering attempt.`);
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }

    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature || 'DEV_BYPASS';
    await order.save();

    res.json({
      success: true,
      message: 'Payment verification recorded.',
      orderNumber: order.orderNumber,
      status: order.status,
    });
  } catch (err) {
    console.error('Error verifying payment:', err);
    res.status(500).json({ success: false, message: 'Payment verification failed' });
  }
};


// POST /api/website/razorpay/webhook (PRIMARY SOURCE OF TRUTH)
const handleWebhook = async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = getRazorpayWebhookSecret();

    // Verify HMAC SHA256 Signature using raw request body
    if (webhookSignature && webhookSecret && !webhookSecret.includes('placeholder')) {
      const rawBody = req.rawBody 
        ? (Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : req.rawBody) 
        : (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));

      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(rawBody)
        .digest('hex');

      if (expectedSignature !== webhookSignature) {
        console.warn('Razorpay Webhook Invalid Signature rejected');
        return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'payment.captured' || event === 'order.paid') {
      const paymentEntity = payload?.payment?.entity || payload?.order?.entity;
      const razorpayOrderId = paymentEntity?.order_id || paymentEntity?.id;
      const razorpayPaymentId = paymentEntity?.id;

      if (razorpayOrderId) {
        const order = await WebsiteOrder.findOne({
          where: { razorpayOrderId },
        });

        if (order && order.paymentStatus !== 'Captured') {
          order.status = 'Paid';
          order.paymentStatus = 'Captured';
          if (razorpayPaymentId) order.razorpayPaymentId = razorpayPaymentId;
          await order.save();

          // Auto-decrement central Management & Billing product stock
          try {
            const items = JSON.parse(order.items || '[]');
            for (const item of items) {
              if ((item.productId || item.managementProductId) && item.qty) {
                const websiteProduct = await WebsiteProduct.findByPk(item.productId);
                const masterId = websiteProduct?.managementProductId || item.managementProductId || item.productId;
                const masterProduct = await Product.findByPk(masterId);
                
                if (masterProduct) {
                  const oldStock = Number(masterProduct.stock || 0);
                  const qtyNum = Number(item.qty || 1);
                  const newStock = Math.max(0, oldStock - qtyNum);
                  masterProduct.stock = newStock;
                  await masterProduct.save();

                  if (websiteProduct) {
                    websiteProduct.stock = newStock;
                    await websiteProduct.save();
                  }

                  try {
                    await StockMovement.create({
                      productId: masterProduct.id,
                      type: 'OUT',
                      quantity: qtyNum,
                      referenceId: order.id,
                      referenceModel: 'WebsiteOrder',
                      notes: `eCommerce Sale (Order #${order.orderNumber || order.id})`,
                    });
                  } catch (e) {}
                  console.log(`✓ Product Master stock decremented for Product ID ${masterProduct.id} (${masterProduct.name}) by ${qtyNum}. New stock: ${newStock}`);
                }
              }
            }
          } catch (stockErr) {
            console.error('Error updating Product Master stock on order completion:', stockErr);
          }

          // If a coupon code was used, increment coupon used count
          if (order.couponCode) {
            try {
              const coupon = await WebsiteCoupon.findOne({ where: { code: order.couponCode } });
              if (coupon) {
                coupon.usedCount += 1;
                await coupon.save();
              }
            } catch (couponErr) {
              console.error('Error updating coupon usage:', couponErr);
            }
          }

          // Log order completed event
          await WebsiteEvent.create({
            eventType: 'order_completed',
            customerId: order.websiteCustomerId,
            eventData: JSON.stringify({
              orderNumber: order.orderNumber,
              totalAmount: order.totalAmount,
              razorpayPaymentId,
            }),
          });

          console.log(`✓ Webhook successfully confirmed Order #${order.orderNumber} as Paid.`);
        }
      }
    } else if (event === 'payment.failed') {
      const paymentEntity = payload?.payment?.entity;
      const razorpayOrderId = paymentEntity?.order_id;
      const errorCode = paymentEntity?.error_code || 'PAYMENT_FAILED';
      const errorDescription = paymentEntity?.error_description || 'Payment was unsuccessful';

      if (razorpayOrderId) {
        const order = await WebsiteOrder.findOne({ where: { razorpayOrderId } });
        if (order && order.paymentStatus !== 'Captured') {
          order.status = 'Failed';
          order.paymentStatus = 'Failed';
          order.notes = `Payment Failed: [${errorCode}] ${errorDescription}`;
          await order.save();
          console.warn(`⚠️ Webhook recorded payment failure for Order #${order.orderNumber}: ${errorDescription}`);
        }
      }
    } else if (event === 'refund.processed' || event === 'refund.created') {
      const refundEntity = payload?.refund?.entity;
      const paymentId = refundEntity?.payment_id;
      const refundId = refundEntity?.id;
      const refundAmount = refundEntity?.amount ? (Number(refundEntity.amount) / 100) : 0;

      if (paymentId) {
        const order = await WebsiteOrder.findOne({ where: { razorpayPaymentId: paymentId } });
        if (order) {
          order.paymentStatus = 'Refunded';
          order.status = 'Cancelled';
          order.notes = `Refund Processed (${refundId}): ₹${refundAmount}`;
          await order.save();
          console.log(`✓ Webhook recorded refund for Order #${order.orderNumber}: ID ${refundId}, Amount ₹${refundAmount}`);
        }
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error('Error handling Razorpay webhook:', err);
    res.status(500).json({ success: false, message: 'Webhook processing failed' });
  }
};

module.exports = {
  createRazorpayOrder,
  verifyPayment,
  handleWebhook,
};
