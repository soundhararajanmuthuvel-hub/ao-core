const WebsiteProduct = require('../models/WebsiteProduct');
const WebsiteProductReview = require('../models/WebsiteProductReview');
const { Op } = require('sequelize');

// GET /api/website/products
const getProducts = async (req, res) => {
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

    const products = await WebsiteProduct.findAll({
      where,
      order: [['isBestseller', 'DESC'], ['createdAt', 'DESC']],
    });

    const formattedProducts = products.map((p) => {
      let imagesArr = [];
      try {
        imagesArr = JSON.parse(p.images || '[]');
      } catch {
        imagesArr = p.images ? [p.images] : [];
      }
      return {
        ...p.toJSON(),
        images: imagesArr,
      };
    });

    res.json({
      success: true,
      count: formattedProducts.length,
      data: formattedProducts,
    });
  } catch (err) {
    console.error('Error fetching website products:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products' });
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
        ...product.toJSON(),
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
