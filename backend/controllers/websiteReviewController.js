const WebsiteTestimonial = require('../models/WebsiteTestimonial');
const WebsiteProductReview = require('../models/WebsiteProductReview');
const WebsiteProduct = require('../models/WebsiteProduct');
const { Op } = require('sequelize');

// GET /api/website/testimonials (homepage marquee)
const getTestimonials = async (req, res) => {
  try {
    const testimonials = await WebsiteTestimonial.findAll({
      where: { isActive: true },
      order: [['displayOrder', 'ASC'], ['createdAt', 'DESC']],
    });

    res.json({ success: true, count: testimonials.length, data: testimonials });
  } catch (err) {
    console.error('Error fetching testimonials:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch testimonials' });
  }
};

// GET /api/website/products/:slug/reviews (product detail reviews)
const getProductReviews = async (req, res) => {
  try {
    const { slug } = req.params;
    const product = await WebsiteProduct.findOne({ where: { slug } });

    const where = { isActive: true };
    if (product) {
      where[Op.or] = [{ productId: product.id }, { productSlug: slug }];
    } else {
      where.productSlug = slug;
    }

    const reviews = await WebsiteProductReview.findAll({
      where,
      order: [['createdAt', 'DESC']],
    });

    res.json({ success: true, count: reviews.length, data: reviews });
  } catch (err) {
    console.error('Error fetching product reviews:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch product reviews' });
  }
};

module.exports = {
  getTestimonials,
  getProductReviews,
};
