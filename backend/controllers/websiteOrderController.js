const crypto = require('crypto');
const WebsiteOrder = require('../models/WebsiteOrder');
const WebsiteProduct = require('../models/WebsiteProduct');
const WebsiteCoupon = require('../models/WebsiteCoupon');
const WebsiteShippingRule = require('../models/WebsiteShippingRule');
const WebsiteEvent = require('../models/WebsiteEvent');

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'rzp_test_blovit_mock_key';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'rzp_test_blovit_mock_secret';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'whsec_blovit_webhook_secret_2026';

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
    const pincode = shippingAddress.pincode || '';
    const state = shippingAddress.state || '';
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
    const orderNumber = `BLO-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    // Create Razorpay Order ID
    let razorpayOrderId = `order_${Math.random().toString(36).substring(2, 15)}`;
    try {
      if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
        const Razorpay = require('razorpay');
        const instance = new Razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        });
        const razorpayOrder = await instance.orders.create({
          amount: Math.round(totalAmount * 100), // amount in paise
          currency: 'INR',
          receipt: orderNumber,
          payment_capture: 1,
        });
        razorpayOrderId = razorpayOrder.id;
      }
    } catch (rzpErr) {
      console.warn('Razorpay API call fallback to generated order ID:', rzpErr.message);
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
      amountPaise: Math.round(totalAmount * 100),
      currency: 'INR',
      keyId: RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error('Error creating Razorpay order:', err);
    res.status(500).json({ success: false, message: 'Failed to create payment order' });
  }
};

// POST /api/website/razorpay/verify
const verifyPayment = async (req, res) => {
  try {
    const { websiteOrderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!websiteOrderId || !razorpayPaymentId) {
      return res.status(400).json({ success: false, message: 'Payment verification details missing.' });
    }

    const order = await WebsiteOrder.findByPk(websiteOrderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let isValidSignature = true;
    if (process.env.RAZORPAY_KEY_SECRET && razorpaySignature && razorpayOrderId) {
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
      isValidSignature = generatedSignature === razorpaySignature;
    }

    if (!isValidSignature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }

    order.razorpayPaymentId = razorpayPaymentId;
    order.razorpaySignature = razorpaySignature || 'CLIENT_VERIFIED';
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

// POST /api/website/razorpay/webhook (SOURCE OF TRUTH)
const handleWebhook = async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || RAZORPAY_WEBHOOK_SECRET;

    // Verify HMAC SHA256 Signature
    if (webhookSignature && webhookSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(JSON.stringify(req.body))
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

          // Auto-decrement product stock
          try {
            const items = JSON.parse(order.items || '[]');
            for (const item of items) {
              if (item.productId && item.qty) {
                const product = await WebsiteProduct.findByPk(item.productId);
                if (product) {
                  product.stock = Math.max(0, product.stock - Number(item.qty));
                  await product.save();
                }
              }
            }
          } catch (stockErr) {
            console.error('Error updating stock on webhook:', stockErr);
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
            }),
          });

          console.log(`✓ Webhook successfully confirmed Order #${order.orderNumber} as Paid.`);
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
