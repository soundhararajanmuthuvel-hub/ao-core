const WebsiteProduct = require('../models/WebsiteProduct');
const WebsiteProductReview = require('../models/WebsiteProductReview');
const { Op } = require('sequelize');

// GET /api/website/products
const getProducts = async (req, res) => {
  console.log('[websiteProductController] controller entered: getProducts');
  try {
    const { category, isBestseller, search } = req.query;
    const where = { isActive: true };

    if (category && category !== 'All') {
      where.category = category;
    }
    if (isBestseller === 'true') {
      where.isBestseller = true;
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { shortDescription: { [Op.like]: `%${search}%` } },
      ];
    }

    console.log('[websiteProductController] database query executing with filters:', JSON.stringify(where));
    const products = await WebsiteProduct.findAll({
      where,
      order: [['isBestseller', 'DESC'], ['createdAt', 'DESC']],
    });

    console.log(`[websiteProductController] database query executed. rows returned: ${products.length}`);

    const formattedProducts = products.map((p) => {
      const pJson = p.toJSON();

      let imagesArr = [];
      try { imagesArr = JSON.parse(p.images || '[]'); } catch { imagesArr = p.images ? [p.images] : []; }

      let benefitsArr = [];
      try { benefitsArr = JSON.parse(p.benefits || '[]'); } catch { benefitsArr = p.benefits ? [p.benefits] : []; }

      let ingredientsArr = [];
      try { ingredientsArr = JSON.parse(p.ingredients || '[]'); } catch { ingredientsArr = p.ingredients ? [p.ingredients] : []; }

      return {
        ...pJson,
        stock: Number(p.stock || 0),
        price: Number(p.price || 0),
        images: imagesArr,
        benefits: benefitsArr,
        ingredients: ingredientsArr,
      };
    });

    const responsePayload = {
      success: true,
      count: formattedProducts.length,
      data: formattedProducts,
    };

    console.log('[websiteProductController] JSON returned count:', formattedProducts.length);
    res.json(responsePayload);
  } catch (err) {
    console.error('[websiteProductController Exception] Complete Stack Trace:\n', err.stack || err);
    res.status(500).json({ success: false, message: 'Failed to fetch products', error: err.message });
  }
};

// GET /api/website/products/:slug
const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const product = await WebsiteProduct.findOne({
      where: { slug, isActive: true },
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const pJson = product.toJSON();

    let imagesArr = [];
    try { imagesArr = JSON.parse(product.images || '[]'); } catch { imagesArr = product.images ? [product.images] : []; }

    let benefitsArr = [];
    try { benefitsArr = JSON.parse(product.benefits || '[]'); } catch { benefitsArr = product.benefits ? [product.benefits] : []; }

    let ingredientsArr = [];
    try { ingredientsArr = JSON.parse(product.ingredients || '[]'); } catch { ingredientsArr = product.ingredients ? [product.ingredients] : []; }

    let nutritionFactsObj = {};
    try { nutritionFactsObj = JSON.parse(product.nutritionFacts || '{}'); } catch { nutritionFactsObj = {}; }

    // Fetch active product reviews
    const reviews = await WebsiteProductReview.findAll({
      where: {
        [Op.or]: [
          { productId: product.id },
          { productSlug: product.slug }
        ],
        isActive: true
      },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        ...pJson,
        stock: Number(product.stock || 0),
        price: Number(product.price || 0),
        images: imagesArr,
        benefits: benefitsArr,
        ingredients: ingredientsArr,
        nutritionFacts: nutritionFactsObj,
        reviews,
      },
    });
  } catch (err) {
    console.error('Error fetching product by slug:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch product details' });
  }
};

module.exports = {
  getProducts,
  getProductBySlug,
};
