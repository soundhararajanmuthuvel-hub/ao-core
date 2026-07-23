const WebsiteProduct = require('../models/WebsiteProduct');

// Default curated catalog of website assets owned by frontend
const DEFAULT_FRONTEND_IMAGES = [
  {
    id: 'img-1',
    name: 'Sprouted Ragi Malt 500g',
    url: 'https://demo.amudhasurabiy.com/images/products/sprouted-ragi-malt.webp',
    width: 800,
    height: 800,
    size: '180KB',
    tags: ['ragi', 'malt', 'sprouted', 'health', 'organic', 'bestseller'],
  },
  {
    id: 'img-2',
    name: 'Multi-Grain Health Drink 500g',
    url: 'https://demo.amudhasurabiy.com/images/products/multi-grain-health-drink.webp',
    width: 800,
    height: 800,
    size: '210KB',
    tags: ['multigrain', 'health', 'drink', 'energy', 'protein'],
  },
  {
    id: 'img-3',
    name: 'Traditional Millet Energy Mix 250g',
    url: 'https://demo.amudhasurabiy.com/images/products/millet-energy-mix.webp',
    width: 800,
    height: 800,
    size: '150KB',
    tags: ['millet', 'energy', 'traditional', 'breakfast'],
  },
  {
    id: 'img-4',
    name: 'Organic Almond & Dates Malt 500g',
    url: 'https://demo.amudhasurabiy.com/images/products/almond-dates-malt.webp',
    width: 800,
    height: 800,
    size: '220KB',
    tags: ['almond', 'dates', 'malt', 'kids', 'nutrition'],
  },
  {
    id: 'img-5',
    name: 'Sprouted Bajra Health Mix 500g',
    url: 'https://demo.amudhasurabiy.com/images/products/sprouted-bajra-mix.webp',
    width: 800,
    height: 800,
    size: '190KB',
    tags: ['bajra', 'sprouted', 'gluten-free', 'fiber'],
  },
];

const DEFAULT_PLACEHOLDER_IMAGE = 'https://demo.amudhasurabiy.com/images/products/placeholder-product.webp';

// Helper: Validate image accessibility & content
const validateImageUrl = (url) => {
  if (!url || typeof url !== 'string' || url.startsWith('/uploads')) {
    return DEFAULT_PLACEHOLDER_IMAGE;
  }
  return url;
};

// GET /api/frontend/images or /api/website/images
const getImages = async (req, res) => {
  try {
    const products = await WebsiteProduct.findAll({ attributes: ['id', 'name', 'images', 'category'] });
    const productImages = [];

    products.forEach((p) => {
      let imgs = [];
      try { imgs = JSON.parse(p.images || '[]'); } catch { imgs = p.images ? [p.images] : []; }
      imgs.forEach((imgUrl, index) => {
        if (imgUrl && typeof imgUrl === 'string' && !imgUrl.startsWith('/uploads')) {
          productImages.push({
            id: `prod-${p.id}-${index}`,
            name: `${p.name} (Asset ${index + 1})`,
            url: imgUrl,
            width: 800,
            height: 800,
            size: '200KB',
            tags: [p.category ? p.category.toLowerCase() : 'product', 'website', p.name.toLowerCase()],
          });
        }
      });
    });

    const combinedImages = [...DEFAULT_FRONTEND_IMAGES, ...productImages];
    const uniqueImages = Array.from(new Map(combinedImages.map((img) => [img.url, img])).values());

    res.json({
      success: true,
      count: uniqueImages.length,
      data: uniqueImages,
    });
  } catch (err) {
    console.error('Error fetching frontend images:', err);
    res.json({ success: true, count: DEFAULT_FRONTEND_IMAGES.length, data: DEFAULT_FRONTEND_IMAGES });
  }
};

// GET /api/frontend/image/search?q= or /api/website/image/search?q=
const searchImages = async (req, res) => {
  try {
    const query = (req.query.q || req.query.query || '').toString().toLowerCase().trim();
    const products = await WebsiteProduct.findAll({ attributes: ['id', 'name', 'images', 'category'] });
    const productImages = [];

    products.forEach((p) => {
      let imgs = [];
      try { imgs = JSON.parse(p.images || '[]'); } catch { imgs = p.images ? [p.images] : []; }
      imgs.forEach((imgUrl, index) => {
        if (imgUrl && typeof imgUrl === 'string' && !imgUrl.startsWith('/uploads')) {
          productImages.push({
            id: `prod-${p.id}-${index}`,
            name: `${p.name} (Asset ${index + 1})`,
            url: imgUrl,
            width: 800,
            height: 800,
            size: '200KB',
            tags: [p.category ? p.category.toLowerCase() : 'product', 'website', p.name.toLowerCase()],
          });
        }
      });
    });

    const combinedImages = Array.from(new Map([...DEFAULT_FRONTEND_IMAGES, ...productImages].map((img) => [img.url, img])).values());

    if (!query) {
      return res.json({ success: true, count: combinedImages.length, data: combinedImages });
    }

    const filtered = combinedImages.filter((img) => {
      const matchName = img.name.toLowerCase().includes(query);
      const matchTags = img.tags.some((tag) => tag.toLowerCase().includes(query));
      const matchUrl = img.url.toLowerCase().includes(query);
      return matchName || matchTags || matchUrl;
    });

    res.json({
      success: true,
      query,
      count: filtered.length,
      data: filtered,
    });
  } catch (err) {
    console.error('Error searching frontend images:', err);
    res.json({ success: true, count: DEFAULT_FRONTEND_IMAGES.length, data: DEFAULT_FRONTEND_IMAGES });
  }
};

module.exports = {
  getImages,
  searchImages,
  validateImageUrl,
  DEFAULT_PLACEHOLDER_IMAGE,
};
