const WebsiteApiKey = require('../models/WebsiteApiKey');
const WebsiteProduct = require('../models/WebsiteProduct');
const WebsiteOrder = require('../models/WebsiteOrder');
const WebsiteCustomer = require('../models/WebsiteCustomer');
const WebsiteTestimonial = require('../models/WebsiteTestimonial');
const WebsiteProductReview = require('../models/WebsiteProductReview');
const WebsiteReferral = require('../models/WebsiteReferral');
const WebsiteShippingRule = require('../models/WebsiteShippingRule');
const WebsiteCoupon = require('../models/WebsiteCoupon');
const WebsiteEvent = require('../models/WebsiteEvent');
const WebsiteAddress = require('../models/WebsiteAddress');
const WebsiteWishlist = require('../models/WebsiteWishlist');
const Product = require('../models/Product');
const { Op } = require('sequelize');

// Helper to generate slug
const generateSlug = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, '-');
};

/* =========================================================
   1. API KEY MANAGEMENT
   ========================================================= */
const getApiKey = async (req, res) => {
  try {
    let keyRecord = await WebsiteApiKey.findOne({
      where: { status: 'Active' },
      order: [['createdAt', 'DESC']],
    });

    if (!keyRecord) {
      const randomKey = `blovit_live_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
      keyRecord = await WebsiteApiKey.create({
        name: 'Blovit Storefront Main API Key',
        apiKey: randomKey,
        status: 'Active',
      });
    }

    res.json({ success: true, data: keyRecord });
  } catch (err) {
    console.error('Error fetching API key:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch API key' });
  }
};

const regenerateApiKey = async (req, res) => {
  try {
    // Revoke old active keys
    await WebsiteApiKey.update(
      { status: 'Revoked' },
      { where: { status: 'Active' } }
    );

    const newKey = `blovit_live_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 10)}`;
    const newRecord = await WebsiteApiKey.create({
      name: 'Blovit Storefront Regenerated API Key',
      apiKey: newKey,
      status: 'Active',
    });

    res.json({
      success: true,
      message: 'API Key regenerated successfully. Update Blovit frontend environment settings.',
      data: newRecord,
    });
  } catch (err) {
    console.error('Error regenerating API key:', err);
    res.status(500).json({ success: false, message: 'Failed to regenerate API key' });
  }
};

/* =========================================================
   2. PRODUCT MANAGEMENT (CRUD) - UNIFIED PRODUCT MASTER
   ========================================================= */
const getAdminProducts = async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { isArchived: false },
      order: [['createdAt', 'DESC']],
    });

    const formatJsonField = (val, isArray = true) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return isArray ? (val ? [val] : []) : val; }
      }
      return isArray ? [] : {};
    };

    const data = products.map((p) => {
      const pJson = p.toJSON();
      const imagesArr = formatJsonField(p.images || p.galleryImages, true);

      return {
        ...pJson,
        price: Number(p.sellingPrice) || Number(p.price) || 0,
        compareAtPrice: Number(p.mrp) || 0,
        stock: Number(p.stock) || 0,
        sku: p.sku || '',
        images: imagesArr.length > 0 ? imagesArr : (p.imageUrl ? [p.imageUrl] : []),
        benefits: formatJsonField(p.benefits, true),
        ingredients: formatJsonField(p.ingredients, true),
        isLinkedToManagement: true,
        managementProductId: p.id,
      };
    });

    res.json({ success: true, count: data.length, data, managementProductsList: products });
  } catch (err) {
    console.error('Error fetching admin products:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
  }
};

const createAdminProduct = async (req, res) => {
  try {
    const {
      name,
      slug,
      price,
      compareAtPrice,
      stock,
      images,
      category,
      description,
      shortDescription,
      benefits,
      ingredients,
      nutritionFacts,
      usageInstructions,
      isBestseller,
      isActive,
      sku,
      weight,
      barcode,
      gstPercent,
      unit,
    } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Product Name and Price are required.' });
    }

    const finalSku = sku || `SKU-${Date.now()}`;
    const duplicateSku = await Product.findOne({ where: { sku: finalSku } });
    if (duplicateSku) {
      return res.status(400).json({ success: false, message: `Product with SKU "${finalSku}" already exists.` });
    }

    const finalSlug = slug ? generateSlug(slug) : generateSlug(`${name}-${finalSku}`);
    const formatArrayJson = (val) => {
      if (Array.isArray(val)) return JSON.stringify(val);
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[')) return trimmed;
        return JSON.stringify(trimmed ? [trimmed] : []);
      }
      return '[]';
    };

    const parsedImages = formatArrayJson(images);
    let mainImageUrl = '';
    try {
      const imgArr = JSON.parse(parsedImages);
      mainImageUrl = imgArr[0] || '';
    } catch (e) {}

    const newProduct = await Product.create({
      name,
      sku: finalSku,
      barcode: barcode || '',
      slug: finalSlug,
      sellingPrice: price || 0,
      price: price || 0,
      mrp: compareAtPrice || 0,
      stock: stock || 0,
      gstPercent: gstPercent || 5,
      unit: unit || 'pcs',
      images: parsedImages,
      imageUrl: mainImageUrl,
      image: mainImageUrl,
      category: category || 'General',
      description: description || '',
      shortDescription: shortDescription || '',
      benefits: formatArrayJson(benefits),
      ingredients: formatArrayJson(ingredients),
      nutritionFacts: typeof nutritionFacts === 'object' ? JSON.stringify(nutritionFacts) : nutritionFacts || '{}',
      usageInstructions: usageInstructions || '',
      isBestseller: !!isBestseller,
      isWebsiteVisible: true,
      publishToWebsite: true,
      isActive: isActive !== undefined ? !!isActive : true,
      weight: weight || 0.200,
    });

    try {
      const catalogController = require('../controllers/catalogController');
      catalogController.clearCatalogCache();
    } catch (e) {}

    res.status(201).json({ success: true, message: 'Product created in Unified Product Master', data: newProduct });
  } catch (err) {
    console.error('Error creating admin product:', err);
    res.status(500).json({ success: false, message: 'Failed to create product' });
  }
};

const updateAdminProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found in Product Master' });
    }

    const {
      name,
      slug,
      price,
      compareAtPrice,
      stock,
      images,
      category,
      description,
      shortDescription,
      benefits,
      ingredients,
      nutritionFacts,
      usageInstructions,
      isBestseller,
      isActive,
      sku,
      weight,
      barcode,
      gstPercent,
      unit,
    } = req.body;

    if (sku && sku !== product.sku) {
      const duplicateSku = await Product.findOne({ where: { sku, id: { [Op.ne]: id } } });
      if (duplicateSku) {
        return res.status(400).json({ success: false, message: `Product SKU "${sku}" is used by another product.` });
      }
      product.sku = sku;
    }

    if (slug && slug !== product.slug) {
      product.slug = generateSlug(slug);
    }

    const formatArrayJson = (val) => {
      if (Array.isArray(val)) return JSON.stringify(val);
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[')) return trimmed;
        return JSON.stringify(trimmed ? [trimmed] : []);
      }
      return '[]';
    };

    if (name !== undefined) product.name = name;
    if (price !== undefined) {
      product.price = price;
      product.sellingPrice = price;
    }
    if (compareAtPrice !== undefined) product.mrp = compareAtPrice;
    if (stock !== undefined) product.stock = stock;
    if (images !== undefined) {
      const parsedImages = formatArrayJson(images);
      product.images = parsedImages;
      try {
        const imgArr = JSON.parse(parsedImages);
        if (imgArr[0]) {
          product.imageUrl = imgArr[0];
          product.image = imgArr[0];
        }
      } catch (e) {}
    }
    if (category !== undefined) product.category = category;
    if (description !== undefined) product.description = description;
    if (shortDescription !== undefined) product.shortDescription = shortDescription;
    if (benefits !== undefined) product.benefits = formatArrayJson(benefits);
    if (ingredients !== undefined) product.ingredients = formatArrayJson(ingredients);
    if (nutritionFacts !== undefined) product.nutritionFacts = typeof nutritionFacts === 'object' ? JSON.stringify(nutritionFacts) : nutritionFacts;
    if (usageInstructions !== undefined) product.usageInstructions = usageInstructions;
    if (isBestseller !== undefined) product.isBestseller = !!isBestseller;
    if (isActive !== undefined) product.isActive = !!isActive;
    if (weight !== undefined) product.weight = weight;
    if (barcode !== undefined) product.barcode = barcode;
    if (gstPercent !== undefined) product.gstPercent = gstPercent;
    if (unit !== undefined) product.unit = unit;

    await product.save();

    try {
      const catalogController = require('../controllers/catalogController');
      catalogController.clearCatalogCache();
    } catch (e) {}

    res.json({ success: true, message: 'Product updated in Unified Product Master', data: product });
  } catch (err) {
    console.error('Error updating admin product:', err);
    res.status(500).json({ success: false, message: 'Failed to update product' });
  }
};

const deleteAdminProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    product.isArchived = true;
    product.publishToWebsite = false;
    product.isWebsiteVisible = false;
    await product.save();

    try {
      const catalogController = require('../controllers/catalogController');
      catalogController.clearCatalogCache();
    } catch (e) {}

    res.json({ success: true, message: 'Product removed from Website Storefront & archived in Product Master.' });
  } catch (err) {
    console.error('Error deleting admin product:', err);
    res.status(500).json({ success: false, message: 'Failed to delete product' });
  }
};


/* =========================================================
   3. ORDER MANAGEMENT & REFUNDS
   ========================================================= */
const getAdminOrders = async (req, res) => {
  try {
    const { status, search } = req.query;
    const where = {};
    if (status && status !== 'All') {
      where.status = status;
    }
    if (search) {
      where[Op.or] = [
        { orderNumber: { [Op.like]: `%${search}%` } },
        { guestName: { [Op.like]: `%${search}%` } },
        { guestMobile: { [Op.like]: `%${search}%` } },
        { razorpayOrderId: { [Op.like]: `%${search}%` } },
      ];
    }

    const orders = await WebsiteOrder.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    const data = orders.map((o) => {
      let itemsArr = []; try { itemsArr = JSON.parse(o.items || '[]'); } catch { itemsArr = []; }
      let addressObj = {}; try { addressObj = JSON.parse(o.shippingAddress || '{}'); } catch { addressObj = {}; }
      return { ...o.toJSON(), items: itemsArr, shippingAddress: addressObj };
    });

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Error fetching admin orders:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
};

const updateAdminOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, courierName, notes } = req.body;

    const order = await WebsiteOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (status) order.status = status;
    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber;
    if (courierName !== undefined) order.courierName = courierName;
    if (notes !== undefined) order.notes = notes;

    await order.save();
    res.json({ success: true, message: `Order updated to ${order.status}`, data: order });
  } catch (err) {
    console.error('Error updating order status:', err);
    res.status(500).json({ success: false, message: 'Failed to update order status' });
  }
};

const refundAdminOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body;

    const order = await WebsiteOrder.findByPk(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (!order.razorpayPaymentId) {
      return res.status(400).json({ success: false, message: 'No Razorpay payment ID recorded for this order.' });
    }

    const refundAmount = (amount && Number(amount) > 0) ? Number(amount) : Number(order.totalAmount);
    const refundAmountPaise = Math.round(refundAmount * 100);

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    let refundResult = null;

    if (keyId && keySecret && !keyId.includes('placeholder') && !keyId.includes('mock')) {
      try {
        const Razorpay = require('razorpay');
        const instance = new Razorpay({
          key_id: keyId,
          key_secret: keySecret,
        });
        refundResult = await instance.payments.refund(order.razorpayPaymentId, {
          amount: refundAmountPaise,
          notes: {
            reason: reason || 'Triggered by ERP Admin',
            orderNumber: order.orderNumber,
          },
        });
      } catch (rzpErr) {
        console.error('Razorpay refund API call error:', rzpErr);
        return res.status(400).json({
          success: false,
          message: rzpErr.error?.description || rzpErr.message || 'Razorpay refund request failed',
        });
      }
    } else {
      refundResult = { id: `rfnd_mock_${Date.now()}`, amount: refundAmountPaise, status: 'processed' };
    }

    const isFullRefund = refundAmount >= Number(order.totalAmount);
    order.paymentStatus = isFullRefund ? 'Refunded' : 'Partially Refunded';
    if (isFullRefund) {
      order.status = 'Cancelled';
    }
    order.notes = `Refund of ₹${refundAmount.toFixed(2)} processed (${refundResult.id || 'N/A'}). ${reason || ''}`.trim();
    await order.save();

    res.json({
      success: true,
      message: `Order #${order.orderNumber} successfully refunded ₹${refundAmount.toFixed(2)} via Razorpay.`,
      refundData: refundResult,
      order,
    });
  } catch (err) {
    console.error('Error processing refund:', err);
    res.status(500).json({ success: false, message: 'Refund processing failed' });
  }
};

/* =========================================================
   4. CUSTOMER MANAGEMENT & ADMIN PASSWORD RESET
   ========================================================= */
const getAdminCustomers = async (req, res) => {
  try {
    const customers = await WebsiteCustomer.findAll({
      order: [['createdAt', 'DESC']],
    });

    const data = await Promise.all(
      customers.map(async (c) => {
        const orderCount = await WebsiteOrder.count({ where: { websiteCustomerId: c.id } });
        const referralCount = await WebsiteReferral.count({ where: { referrerCustomerId: c.id, status: 'Approved' } });
        return {
          ...c.toJSON(),
          orderCount,
          referralCount,
        };
      })
    );

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Error fetching admin customers:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch customers' });
  }
};

const resetAdminCustomerPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ success: false, message: 'New password is required.' });
    }

    const customer = await WebsiteCustomer.scope('withPassword').findByPk(id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer account not found.' });
    }

    customer.password = newPassword;
    await customer.save();

    res.json({
      success: true,
      message: `Password for customer "${customer.fullName}" (${customer.mobile}) reset successfully.`,
    });
  } catch (err) {
    console.error('Error resetting customer password:', err);
    res.status(500).json({ success: false, message: 'Failed to reset customer password' });
  }
};

/* =========================================================
   5. REVIEWS & TESTIMONIALS (CURATED BY ADMIN)
   ========================================================= */
const getAdminTestimonials = async (req, res) => {
  try {
    const data = await WebsiteTestimonial.findAll({ order: [['displayOrder', 'ASC']] });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch testimonials' });
  }
};

const createAdminTestimonial = async (req, res) => {
  try {
    const { name, location, rating, date, reviewText, productMentioned, verified, displayOrder } = req.body;
    const newTestimonial = await WebsiteTestimonial.create({
      name,
      location: location || '',
      rating: rating || 5,
      date: date || new Date().toISOString().split('T')[0],
      reviewText,
      productMentioned: productMentioned || '',
      verified: verified !== undefined ? !!verified : true,
      displayOrder: displayOrder || 0,
    });
    res.status(201).json({ success: true, data: newTestimonial });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create testimonial' });
  }
};

const updateAdminTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await WebsiteTestimonial.findByPk(id);
    if (!record) return res.status(404).json({ success: false, message: 'Testimonial not found' });
    await record.update(req.body);
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update testimonial' });
  }
};

const deleteAdminTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await WebsiteTestimonial.findByPk(id);
    if (!record) return res.status(404).json({ success: false, message: 'Testimonial not found' });
    await record.destroy();
    res.json({ success: true, message: 'Testimonial deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete testimonial' });
  }
};

const getAdminReviews = async (req, res) => {
  try {
    const data = await WebsiteProductReview.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
};

const createAdminReview = async (req, res) => {
  try {
    const { productId, productSlug, reviewerName, rating, reviewText, date, verified } = req.body;
    const newReview = await WebsiteProductReview.create({
      productId: productId || null,
      productSlug: productSlug || '',
      reviewerName,
      rating: rating || 5,
      reviewText,
      date: date || new Date().toISOString().split('T')[0],
      verified: verified !== undefined ? !!verified : true,
    });
    res.status(201).json({ success: true, data: newReview });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create review' });
  }
};

const updateAdminReview = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await WebsiteProductReview.findByPk(id);
    if (!record) return res.status(404).json({ success: false, message: 'Review not found' });
    await record.update(req.body);
    res.json({ success: true, data: record });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update review' });
  }
};

const deleteAdminReview = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await WebsiteProductReview.findByPk(id);
    if (!record) return res.status(404).json({ success: false, message: 'Review not found' });
    await record.destroy();
    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete review' });
  }
};

/* =========================================================
   6. REFERRALS MANAGEMENT (WITH AUTO-GENERATED REWARD COUPONS)
   ========================================================= */
const getAdminReferrals = async (req, res) => {
  try {
    const referrals = await WebsiteReferral.findAll({
      order: [['createdAt', 'DESC']],
    });

    const data = await Promise.all(
      referrals.map(async (ref) => {
        const referrer = await WebsiteCustomer.findByPk(ref.referrerCustomerId);
        const referred = await WebsiteCustomer.findByPk(ref.referredCustomerId);
        return {
          ...ref.toJSON(),
          referrerName: referrer?.fullName || 'Unknown',
          referrerMobile: referrer?.mobile || '',
          referredName: referred?.fullName || 'Unknown',
          referredMobile: referred?.mobile || '',
        };
      })
    );

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    console.error('Error fetching admin referrals:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch referrals' });
  }
};

const approveAdminReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const { discountAmount, adminNotes } = req.body;

    const discountVal = Number(discountAmount);
    if (discountAmount === undefined || discountAmount === null || isNaN(discountVal) || discountVal <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Discount amount is required and must be a positive number.',
      });
    }

    const referral = await WebsiteReferral.findByPk(id);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral record not found' });
    }

    const referrer = await WebsiteCustomer.findByPk(referral.referrerCustomerId);
    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Referrer customer account not found' });
    }

    // Auto-generate single-use WebsiteCoupon tied to referrer customer
    const couponCode = `REF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const newCoupon = await WebsiteCoupon.create({
      code: couponCode,
      type: 'flat',
      value: discountVal,
      minOrderValue: 0,
      usageLimit: 1,
      usedCount: 0,
      websiteCustomerId: referrer.id,
      isActive: true,
    });

    referral.status = 'Approved';
    referral.discountAmount = discountVal;
    referral.generatedCouponCode = couponCode;
    referral.adminNotes = adminNotes || '';
    referral.approvedAt = new Date();
    await referral.save();

    res.json({
      success: true,
      message: `Referral approved! Single-use coupon ${couponCode} (₹${discountVal}) generated for customer ${referrer.fullName}.`,
      data: referral,
      coupon: newCoupon,
    });
  } catch (err) {
    console.error('Error approving referral:', err);
    res.status(500).json({ success: false, message: 'Failed to approve referral' });
  }
};

const rejectAdminReferral = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminNotes } = req.body;

    const referral = await WebsiteReferral.findByPk(id);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral record not found' });
    }

    referral.status = 'Rejected';
    referral.adminNotes = adminNotes || '';
    await referral.save();

    res.json({ success: true, message: 'Referral rejected.', data: referral });
  } catch (err) {
    console.error('Error rejecting referral:', err);
    res.status(500).json({ success: false, message: 'Failed to reject referral' });
  }
};

/* =========================================================
   7. SHIPPING RULES & COUPON MANAGEMENT
   ========================================================= */
const getAdminShippingRules = async (req, res) => {
  try {
    const rules = await WebsiteShippingRule.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: rules });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch shipping rules' });
  }
};

const createAdminShippingRule = async (req, res) => {
  try {
    const newRule = await WebsiteShippingRule.create(req.body);
    res.status(201).json({ success: true, data: newRule });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create shipping rule' });
  }
};

const updateAdminShippingRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await WebsiteShippingRule.findByPk(id);
    if (!rule) return res.status(404).json({ success: false, message: 'Shipping rule not found' });
    await rule.update(req.body);
    res.json({ success: true, data: rule });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update shipping rule' });
  }
};

const deleteAdminShippingRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await WebsiteShippingRule.findByPk(id);
    if (!rule) return res.status(404).json({ success: false, message: 'Shipping rule not found' });
    await rule.destroy();
    res.json({ success: true, message: 'Shipping rule deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete shipping rule' });
  }
};

const getAdminCoupons = async (req, res) => {
  try {
    const coupons = await WebsiteCoupon.findAll({ order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: coupons });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch coupons' });
  }
};

const createAdminCoupon = async (req, res) => {
  try {
    const { code, type, value, minOrderValue, expiryDate, usageLimit, isActive } = req.body;
    if (!code || value === undefined) {
      return res.status(400).json({ success: false, message: 'Coupon code and value are required.' });
    }

    const newCoupon = await WebsiteCoupon.create({
      code: code.trim().toUpperCase(),
      type: type || 'flat',
      value,
      minOrderValue: minOrderValue || 0,
      expiryDate: expiryDate || null,
      usageLimit: usageLimit || 100,
      isActive: isActive !== undefined ? !!isActive : true,
    });

    res.status(201).json({ success: true, data: newCoupon });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create coupon' });
  }
};

const updateAdminCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await WebsiteCoupon.findByPk(id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    if (req.body.code) req.body.code = req.body.code.trim().toUpperCase();
    await coupon.update(req.body);
    res.json({ success: true, data: coupon });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update coupon' });
  }
};

const deleteAdminCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await WebsiteCoupon.findByPk(id);
    if (!coupon) return res.status(404).json({ success: false, message: 'Coupon not found' });
    await coupon.destroy();
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete coupon' });
  }
};

/* =========================================================
   8. CRM & ANALYTICS DASHBOARD
   ========================================================= */
const getAdminAnalytics = async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const ordersToday = await WebsiteOrder.count({
      where: { createdAt: { [Op.gte]: todayStart } },
    });

    const totalPaidOrders = await WebsiteOrder.findAll({
      where: { paymentStatus: 'Captured' },
    });

    const totalRevenue = totalPaidOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

    const products = await WebsiteProduct.findAll();
    const productStats = products.map((p) => ({
      name: p.name,
      stock: p.stock,
      price: p.price,
      isBestseller: p.isBestseller,
    }));

    const cartAbandonmentCount = await WebsiteEvent.count({
      where: { eventType: 'checkout_started' },
    });

    const recentEvents = await WebsiteEvent.findAll({
      limit: 20,
      order: [['createdAt', 'DESC']],
    });

    res.json({
      success: true,
      data: {
        ordersToday,
        totalPaidOrdersCount: totalPaidOrders.length,
        totalRevenue,
        cartAbandonmentCount,
        productStats,
        recentEvents,
      },
    });
  } catch (err) {
    console.error('Error fetching admin analytics:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch analytics' });
  }
};

const generateProductAIContent = async (req, res) => {
  try {
    const { callGemini } = require('./aiController');
    const { field, name, category } = req.body;
    const prodName = name || 'Organic Health Drink';
    const prodCat = category || 'Health Foods';
    let prompt = '';

    switch (field) {
      case 'description':
        prompt = `Generate an engaging, SEO-optimized product description for an organic health food product named "${prodName}" in category "${prodCat}". Keep it professional, enticing, and between 80-120 words. Return plain text.`;
        break;
      case 'benefits':
        prompt = `Generate a JSON array of 4 distinct health benefits for product "${prodName}". Return ONLY a raw JSON array like ["100% Organic", "Boosts Energy", "Rich in Fiber", "Immunity Booster"]. No markdown codeblocks.`;
        break;
      case 'ingredients':
        prompt = `Generate a JSON array of 5 natural ingredients for "${prodName}". Return ONLY a raw JSON array like ["Sprouted Ragi", "Almonds", "Cardamom", "Dates", "Cashews"]. No markdown codeblocks.`;
        break;
      case 'nutrition':
        prompt = `Generate a JSON object of nutrition facts per 100g for product "${prodName}". Return ONLY a raw JSON object like {"Calories": "380 kcal", "Protein": "12.5g", "Calcium": "340mg", "Iron": "4.2mg", "Fiber": "8.1g"}. No markdown codeblocks.`;
        break;
      case 'seo':
        prompt = `Generate SEO meta tags for product "${prodName}" in category "${prodCat}". Return ONLY a raw JSON object: {"metaTitle": "${prodName} - Pure Organic Health Drink", "metaDescription": "Buy ${prodName} online. 100% natural, nutrient-dense organic health blend.", "keywords": "${prodName.toLowerCase()}, organic malt, healthy drink, blovit"}. No markdown codeblocks.`;
        break;
      default:
        prompt = `Provide 3 key highlights for product "${prodName}".`;
    }

    const aiResult = await callGemini(prompt, `ai_product_${field}`);
    res.json({ success: true, field, result: aiResult });
  } catch (err) {
    console.error('AI Generation Error:', err);
    res.status(500).json({ success: false, message: 'AI generation failed', error: err.message });
  }
};

module.exports = {
  getApiKey,
  regenerateApiKey,
  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  getAdminOrders,
  updateAdminOrderStatus,
  refundAdminOrder,
  getAdminCustomers,
  resetAdminCustomerPassword,
  getAdminTestimonials,
  createAdminTestimonial,
  updateAdminTestimonial,
  deleteAdminTestimonial,
  getAdminReviews,
  createAdminReview,
  updateAdminReview,
  deleteAdminReview,
  getAdminReferrals,
  approveAdminReferral,
  rejectAdminReferral,
  getAdminShippingRules,
  createAdminShippingRule,
  updateAdminShippingRule,
  deleteAdminShippingRule,
  getAdminCoupons,
  createAdminCoupon,
  updateAdminCoupon,
  deleteAdminCoupon,
  getAdminAnalytics,
  generateProductAIContent,
};
