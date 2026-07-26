const Product = require('../models/Product');
const WebsiteProductReview = require('../models/WebsiteProductReview');
const { Op } = require('sequelize');

// Helper to format JSON fields
const parseJsonField = (val, isArray = true) => {
  if (Array.isArray(val)) return val;
  if (typeof val === 'object' && val !== null) return val;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return isArray ? (val ? [val] : []) : {}; }
  }
  return isArray ? [] : {};
};

// GET /api/website/products
const getProducts = async (req, res) => {
  console.log('[websiteProductController] controller entered: getProducts');
  try {
    const { category, isBestseller, isFeatured, search } = req.query;

    // Filter Product Master for active, non-archived products that are published to website
    const productWhere = { 
      isArchived: false, 
      isActive: true,
      isPublished: true
    };

    if (category && category !== 'All') {
      productWhere.category = category;
    }
    if (search) {
      productWhere[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } },
        { brand: { [Op.like]: `%${search}%` } },
      ];
    }
    if (isBestseller === 'true') {
      productWhere.isBestseller = true;
    }
    if (isFeatured === 'true') {
      productWhere.isFeatured = true;
    }

    const masterProducts = await Product.findAll({
      where: productWhere,
      order: [['createdAt', 'DESC']],
    });

    const formattedProducts = masterProducts.map((p) => {
      const primaryImageUrl = p.imageUrl || p.image || 'https://demo.amudhasurabiy.com/images/products/placeholder-product.webp';
      let galleryArr = parseJsonField(p.galleryImages || p.images, true);
      if (galleryArr.length === 0 && primaryImageUrl) galleryArr = [primaryImageUrl];

      const benefitsArr = parseJsonField(p.benefits, true);
      const ingredientsArr = parseJsonField(p.ingredients, true);

      return {
        id: p.id,
        productId: p.id,
        managementProductId: p.id,
        name: p.name,
        slug: p.slug || `${p.name.toLowerCase().replace(/[\s\W-]+/g, '-')}-${p.id}`,
        sku: p.sku || `SKU-${p.id}`,
        price: Number(p.sellingPrice || p.price || 0),
        compareAtPrice: Number(p.mrp || 0),
        gstPercent: Number(p.gstPercent || 0),
        description: p.description || '',
        shortDescription: p.shortDescription || '',
        stock: Number(p.stock || 0),
        category: p.category || 'General',
        brand: p.brand || 'Blovit',
        imageUrl: primaryImageUrl,
        imagePublicId: p.imagePublicId || null,
        images: galleryArr,
        galleryImages: galleryArr,
        rating: 5.0,
        status: p.isActive ? 'active' : 'inactive',
        isBestseller: !!p.isBestseller,
        isFeatured: !!p.isFeatured,
        isTrending: !!p.isTrending,
        benefits: benefitsArr,
        ingredients: ingredientsArr,
        seoTitle: p.seoTitle || p.name,
        seoDescription: p.seoDescription || p.shortDescription || p.name,
        seoKeywords: p.seoKeywords || '',
      };
    });

    res.json({
      success: true,
      count: formattedProducts.length,
      data: formattedProducts,
    });
  } catch (err) {
    console.error('[websiteProductController Exception]:\n', err.stack || err);
    res.status(500).json({ success: false, message: 'Failed to fetch products', error: err.message });
  }
};

// GET /api/website/products/:slug
const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    // Search Product Master directly by slug / ID / SKU
    const masterProduct = await Product.findOne({
      where: { 
        isArchived: false, 
        isActive: true, 
        isPublished: true,
        [Op.or]: [{ slug }, { sku: slug }, { id: Number(slug) || 0 }] 
      }
    });

    if (!masterProduct) {
      return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
    }

    const primaryImageUrl = masterProduct.imageUrl || masterProduct.image || 'https://demo.amudhasurabiy.com/images/products/placeholder-product.webp';
    let galleryArr = parseJsonField(masterProduct.galleryImages || masterProduct.images, true);
    if (galleryArr.length === 0 && primaryImageUrl) galleryArr = [primaryImageUrl];

    const benefitsArr = parseJsonField(masterProduct.benefits, true);
    const ingredientsArr = parseJsonField(masterProduct.ingredients, true);
    const nutritionFactsObj = parseJsonField(masterProduct.nutritionFacts, false);
    const faqsArr = parseJsonField(masterProduct.faqs, true);

    // Fetch active product reviews
    const reviews = await WebsiteProductReview.findAll({
      where: {
        [Op.or]: [
          { productId: masterProduct.id },
          { productSlug: slug }
        ],
        isActive: true
      },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        id: masterProduct.id,
        productId: masterProduct.id,
        managementProductId: masterProduct.id,
        name: masterProduct.name,
        slug: masterProduct.slug || slug,
        sku: masterProduct.sku || '',
        barcode: masterProduct.barcode || '',
        brand: masterProduct.brand || 'Blovit',
        category: masterProduct.category || 'General',
        price: Number(masterProduct.sellingPrice || masterProduct.price || 0),
        compareAtPrice: Number(masterProduct.mrp || 0),
        mrp: Number(masterProduct.mrp || 0),
        gstPercent: Number(masterProduct.gstPercent || 0),
        stock: Number(masterProduct.stock || 0),
        unit: masterProduct.unit || 'pcs',
        imageUrl: primaryImageUrl,
        images: galleryArr,
        galleryImages: galleryArr,
        description: masterProduct.description || '',
        shortDescription: masterProduct.shortDescription || '',
        benefits: benefitsArr,
        ingredients: ingredientsArr,
        nutritionFacts: nutritionFactsObj,
        usageInstructions: masterProduct.usageInstructions || '',
        faqs: faqsArr,
        seoTitle: masterProduct.seoTitle || masterProduct.name,
        seoDescription: masterProduct.seoDescription || masterProduct.shortDescription || masterProduct.name,
        seoKeywords: masterProduct.seoKeywords || '',
        badges: parseJsonField(masterProduct.badges, true),
        healthGoals: parseJsonField(masterProduct.healthGoals, true),
        isBestseller: !!masterProduct.isBestseller,
        isFeatured: !!masterProduct.isFeatured,
        isTrending: !!masterProduct.isTrending,
        status: masterProduct.isActive ? 'active' : 'inactive',
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
