const WebsiteShippingRule = require('../models/WebsiteShippingRule');
const WebsiteCoupon = require('../models/WebsiteCoupon');

// POST /api/website/shipping/calculate
const calculateShipping = async (req, res) => {
  try {
    const { pincode, state, subtotal } = req.body;
    const subtotalNum = Number(subtotal) || 0;

    let shippingRule = null;
    if (state) {
      shippingRule = await WebsiteShippingRule.findOne({
        where: { state, isActive: true },
      });
    }

    if (!shippingRule && pincode) {
      const pincodePrefix = String(pincode).substring(0, 3);
      shippingRule = await WebsiteShippingRule.findOne({
        where: { pincodePrefix, isActive: true },
      });
    }

    if (!shippingRule) {
      shippingRule = await WebsiteShippingRule.findOne({
        where: { isActive: true },
        order: [['createdAt', 'ASC']],
      });
    }

    let rate = 50.0;
    let freeShippingThreshold = 999.0;

    if (shippingRule) {
      rate = Number(shippingRule.rate);
      freeShippingThreshold = Number(shippingRule.freeShippingThreshold);
    }

    const isFree = subtotalNum >= freeShippingThreshold;
    const finalShippingCharge = isFree ? 0.0 : rate;

    res.json({
      success: true,
      subtotal: subtotalNum,
      shippingCharge: finalShippingCharge,
      isFreeShipping: isFree,
      freeShippingThreshold,
      amountNeededForFreeShipping: isFree ? 0 : Math.max(0, freeShippingThreshold - subtotalNum),
    });
  } catch (err) {
    console.error('Error calculating shipping:', err);
    res.status(500).json({ success: false, message: 'Failed to calculate shipping rate' });
  }
};

// POST /api/website/coupons/validate
const validateCoupon = async (req, res) => {
  try {
    const { code, subtotal, customerId } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: 'Coupon code is required.' });
    }

    const coupon = await WebsiteCoupon.findOne({
      where: { code: code.trim().toUpperCase(), isActive: true },
    });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid or expired coupon code.' });
    }

    // Check expiry
    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      return res.status(400).json({ success: false, message: 'This coupon code has expired.' });
    }

    // Check usage limit
    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'This coupon code usage limit has been reached.' });
    }

    // Check minimum order value
    const subtotalNum = Number(subtotal) || 0;
    if (subtotalNum < Number(coupon.minOrderValue)) {
      return res.status(400).json({
        success: false,
        message: `Minimum order value of ₹${coupon.minOrderValue} required for this coupon.`,
      });
    }

    // Check customer restriction if tied to a specific customer
    if (coupon.websiteCustomerId && customerId && Number(coupon.websiteCustomerId) !== Number(customerId)) {
      return res.status(400).json({ success: false, message: 'This referral coupon code is assigned to another customer.' });
    }

    let discountAmount = 0;
    if (coupon.type === 'percentage') {
      discountAmount = (subtotalNum * Number(coupon.value)) / 100;
    } else {
      discountAmount = Number(coupon.value);
    }
    discountAmount = Math.min(discountAmount, subtotalNum);

    res.json({
      success: true,
      valid: true,
      message: 'Coupon applied successfully!',
      coupon: {
        code: coupon.code,
        type: coupon.type,
        value: Number(coupon.value),
        discountAmount,
      },
    });
  } catch (err) {
    console.error('Error validating coupon:', err);
    res.status(500).json({ success: false, message: 'Failed to validate coupon' });
  }
};

module.exports = {
  calculateShipping,
  validateCoupon,
};
