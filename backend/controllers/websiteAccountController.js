const WebsiteOrder = require('../models/WebsiteOrder');
const WebsiteAddress = require('../models/WebsiteAddress');
const WebsiteWishlist = require('../models/WebsiteWishlist');
const WebsiteCart = require('../models/WebsiteCart');
const WebsiteProduct = require('../models/WebsiteProduct');

// GET /api/website/account/orders
const getMyOrders = async (req, res) => {
  try {
    const customerId = req.websiteCustomer.id;
    const orders = await WebsiteOrder.findAll({
      where: { websiteCustomerId: customerId },
      order: [['createdAt', 'DESC']],
    });

    const formattedOrders = orders.map((o) => {
      let itemsArr = [];
      try { itemsArr = JSON.parse(o.items || '[]'); } catch { itemsArr = []; }
      let addressObj = {};
      try { addressObj = JSON.parse(o.shippingAddress || '{}'); } catch { addressObj = {}; }
      return {
        ...o.toJSON(),
        items: itemsArr,
        shippingAddress: addressObj,
      };
    });

    res.json({ success: true, count: formattedOrders.length, data: formattedOrders });
  } catch (err) {
    console.error('Error fetching customer orders:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch order history' });
  }
};

// GET /api/website/account/orders/:id
const getMyOrderById = async (req, res) => {
  try {
    const customerId = req.websiteCustomer.id;
    const { id } = req.params;

    const order = await WebsiteOrder.findOne({
      where: { id, websiteCustomerId: customerId },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    let itemsArr = [];
    try { itemsArr = JSON.parse(order.items || '[]'); } catch { itemsArr = []; }
    let addressObj = {};
    try { addressObj = JSON.parse(order.shippingAddress || '{}'); } catch { addressObj = {}; }

    res.json({
      success: true,
      data: {
        ...order.toJSON(),
        items: itemsArr,
        shippingAddress: addressObj,
      },
    });
  } catch (err) {
    console.error('Error fetching order details:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch order details' });
  }
};

// GET /api/website/account/addresses
const getAddresses = async (req, res) => {
  try {
    const customerId = req.websiteCustomer.id;
    const addresses = await WebsiteAddress.findAll({
      where: { websiteCustomerId: customerId },
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']],
    });

    res.json({ success: true, count: addresses.length, data: addresses });
  } catch (err) {
    console.error('Error fetching addresses:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch addresses' });
  }
};

// POST /api/website/account/addresses
const addOrUpdateAddress = async (req, res) => {
  try {
    const customerId = req.websiteCustomer.id;
    const { id, fullName, phone, streetAddress, city, state, pincode, isDefault } = req.body;

    if (!fullName || !phone || !streetAddress || !city || !state || !pincode) {
      return res.status(400).json({ success: false, message: 'All address fields are required.' });
    }

    if (isDefault) {
      await WebsiteAddress.update(
        { isDefault: false },
        { where: { websiteCustomerId: customerId } }
      );
    }

    let addressRecord;
    if (id) {
      addressRecord = await WebsiteAddress.findOne({
        where: { id, websiteCustomerId: customerId },
      });
      if (addressRecord) {
        await addressRecord.update({
          fullName,
          phone,
          streetAddress,
          city,
          state,
          pincode,
          isDefault: !!isDefault,
        });
      }
    }

    if (!addressRecord) {
      addressRecord = await WebsiteAddress.create({
        websiteCustomerId: customerId,
        fullName,
        phone,
        streetAddress,
        city,
        state,
        pincode,
        isDefault: !!isDefault,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Address saved successfully.',
      data: addressRecord,
    });
  } catch (err) {
    console.error('Error saving address:', err);
    res.status(500).json({ success: false, message: 'Failed to save address' });
  }
};

// GET /api/website/account/wishlist
const getWishlist = async (req, res) => {
  try {
    const customerId = req.websiteCustomer.id;
    const wishlistItems = await WebsiteWishlist.findAll({
      where: { websiteCustomerId: customerId },
    });

    const productIds = wishlistItems.map((item) => item.productId);
    const products = await WebsiteProduct.findAll({
      where: { id: productIds, isActive: true },
    });

    res.json({
      success: true,
      count: products.length,
      data: products.map((p) => {
        let imagesArr = [];
        try { imagesArr = JSON.parse(p.images || '[]'); } catch { imagesArr = p.images ? [p.images] : []; }
        return { ...p.toJSON(), images: imagesArr };
      }),
    });
  } catch (err) {
    console.error('Error fetching wishlist:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch wishlist' });
  }
};

// POST /api/website/account/wishlist
const toggleWishlist = async (req, res) => {
  try {
    const customerId = req.websiteCustomer.id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required.' });
    }

    const existing = await WebsiteWishlist.findOne({
      where: { websiteCustomerId: customerId, productId },
    });

    let isSaved = false;
    if (existing) {
      await existing.destroy();
      isSaved = false;
    } else {
      await WebsiteWishlist.create({ websiteCustomerId: customerId, productId });
      isSaved = true;
    }

    res.json({
      success: true,
      isSaved,
      message: isSaved ? 'Product added to wishlist' : 'Product removed from wishlist',
    });
  } catch (err) {
    console.error('Error toggling wishlist:', err);
    res.status(500).json({ success: false, message: 'Failed to update wishlist' });
  }
};

// POST /api/website/cart/sync
const syncCart = async (req, res) => {
  try {
    const customerId = req.websiteCustomer?.id || null;
    const { sessionKey, items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: 'Cart items array is required.' });
    }

    let cart;
    if (customerId) {
      cart = await WebsiteCart.findOne({ where: { websiteCustomerId: customerId } });
    } else if (sessionKey) {
      cart = await WebsiteCart.findOne({ where: { sessionKey } });
    }

    if (cart) {
      cart.items = JSON.stringify(items);
      if (customerId) cart.websiteCustomerId = customerId;
      await cart.save();
    } else {
      cart = await WebsiteCart.create({
        websiteCustomerId: customerId,
        sessionKey: sessionKey || null,
        items: JSON.stringify(items),
      });
    }

    res.json({
      success: true,
      message: 'Cart synced successfully.',
      data: {
        cartId: cart.id,
        items: items,
      },
    });
  } catch (err) {
    console.error('Error syncing cart:', err);
    res.status(500).json({ success: false, message: 'Failed to sync cart' });
  }
};

module.exports = {
  getMyOrders,
  getMyOrderById,
  getAddresses,
  addOrUpdateAddress,
  getWishlist,
  toggleWishlist,
  syncCart,
};
