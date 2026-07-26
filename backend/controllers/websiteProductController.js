const WebsiteProduct = require('../models/WebsiteProduct');
const WebsiteProductReview = require('../models/WebsiteProductReview');
const Product = require('../models/Product');
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

    // Filter Product Master for active, non-archived products
    const productWhere = { isArchived: false, isActive: true };
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

    const masterProducts = await Product.findAll({
      where: productWhere,
      include: [{ model: WebsiteProduct, as: 'websiteProduct' }],
      order: [['createdAt', 'DESC']],
    });

    const formattedProducts = masterProducts.map((p) => {
      const wp = p.websiteProduct || {};

      // If website settings explicitly set isPublished to false, check publication
      if (wp.isPublished === false) return null;

      if (isBestseller === 'true' && !wp.isBestseller) return null;
      if (isFeatured === 'true' && !wp.isFeatured) return null;

      const primaryImageUrl = p.imageUrl || p.image || 'https://demo.amudhasurabiy.com/images/products/placeholder-product.webp';
      let galleryArr = parseJsonField(wp.galleryImages || wp.images || p.galleryImages || p.images, true);
      if (galleryArr.length === 0 && primaryImageUrl) galleryArr = [primaryImageUrl];

      const benefitsArr = parseJsonField(wp.benefits || p.benefits, true);
      const ingredientsArr = parseJsonField(wp.ingredients || p.ingredients, true);

      return {
        id: wp.id || p.id,
        productId: p.id,
        managementProductId: p.id,
        name: p.name,
        slug: wp.slug || `${p.name.toLowerCase().replace(/[\s\W-]+/g, '-')}-${p.id}`,
        sku: p.sku || `SKU-${p.id}`,
        price: Number(p.sellingPrice || p.price || 0),
        compareAtPrice: Number(p.mrp || 0),
        gstPercent: Number(p.gstPercent || 0),
        description: wp.description || p.description || '',
        shortDescription: wp.shortDescription || p.shortDescription || '',
        stock: Number(p.stock || 0),
        category: p.category || 'General',
        brand: p.brand || 'Blovit',
        imageUrl: primaryImageUrl,
        imagePublicId: p.imagePublicId || wp.imagePublicId || null,
        images: galleryArr,
        galleryImages: galleryArr,
        rating: 5.0,
        status: p.isActive ? 'active' : 'inactive',
        isBestseller: !!wp.isBestseller,
        isFeatured: !!wp.isFeatured,
        isTrending: !!wp.isTrending,
        benefits: benefitsArr,
        ingredients: ingredientsArr,
        seoTitle: wp.seoTitle || p.name,
        seoDescription: wp.seoDescription || wp.shortDescription || p.name,
        seoKeywords: wp.seoKeywords || '',
      };
    }).filter(Boolean);

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

    // Search WebsiteProduct by slug or Product Master by ID/SKU
    let wp = await WebsiteProduct.findOne({
      where: { slug },
      include: [{ model: Product, as: 'managementProduct' }]
    });

    let masterProduct = wp?.managementProduct;

    if (!wp) {
      // Fallback search Product Master directly by slug / ID
      masterProduct = await Product.findOne({
        where: { isArchived: false, isActive: true, [Op.or]: [{ sku: slug }, { id: Number(slug) || 0 }] },
        include: [{ model: WebsiteProduct, as: 'websiteProduct' }]
      });
      if (masterProduct) {
        wp = masterProduct.websiteProduct;
      }
    }

    if (!masterProduct || masterProduct.isActive === false || masterProduct.isArchived) {
      return res.status(404).json({ success: false, message: 'Product not found or unavailable' });
    }

    if (wp && wp.isPublished === false) {
      return res.status(404).json({ success: false, message: 'Product is currently not published on website' });
    }

    const primaryImageUrl = masterProduct.imageUrl || masterProduct.image || 'https://demo.amudhasurabiy.com/images/products/placeholder-product.webp';
    let galleryArr = parseJsonField(wp?.galleryImages || wp?.images || masterProduct.galleryImages || masterProduct.images, true);
    if (galleryArr.length === 0 && primaryImageUrl) galleryArr = [primaryImageUrl];

    const benefitsArr = parseJsonField(wp?.benefits || masterProduct.benefits, true);
    const ingredientsArr = parseJsonField(wp?.ingredients || masterProduct.ingredients, true);
    const nutritionFactsObj = parseJsonField(wp?.nutritionFacts || masterProduct.nutritionFacts, false);
    const faqsArr = parseJsonField(wp?.faqs, true);

    // Fetch active product reviews
    const reviews = await WebsiteProductReview.findAll({
      where: {
        [Op.or]: [
          { productId: wp?.id || masterProduct.id },
          { productSlug: slug }
        ],
        isActive: true
      },
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        id: wp?.id || masterProduct.id,
        productId: masterProduct.id,
        managementProductId: masterProduct.id,
        name: masterProduct.name,
        slug: wp?.slug || slug,
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
        description: wp?.description || masterProduct.description || '',
        shortDescription: wp?.shortDescription || masterProduct.shortDescription || '',
        benefits: benefitsArr,
        ingredients: ingredientsArr,
        nutritionFacts: nutritionFactsObj,
        usageInstructions: wp?.usageInstructions || masterProduct.usageInstructions || '',
        faqs: faqsArr,
        seoTitle: wp?.seoTitle || masterProduct.name,
        seoDescription: wp?.seoDescription || wp?.shortDescription || masterProduct.name,
        seoKeywords: wp?.seoKeywords || '',
        badges: parseJsonField(wp?.badges, true),
        healthGoals: parseJsonField(wp?.healthGoals, true),
        isBestseller: !!wp?.isBestseller,
        isFeatured: !!wp?.isFeatured,
        isTrending: !!wp?.isTrending,
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
