const WebsiteApiKey = require('../models/WebsiteApiKey');
const WebsiteProduct = require('../models/WebsiteProduct');
const ProductPackSize = require('../models/ProductPackSize');
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
   2. PRODUCT MANAGEMENT (CRUD) - LINKED TO PRODUCT MASTER
   ========================================================= */
const getAdminProducts = async (req, res) => {
  try {
    const masterProducts = await Product.findAll({
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

    const data = masterProducts.map((p) => {
      const primaryImageUrl = p.imageUrl || p.image || '';
      let galleryArr = formatJsonField(p.galleryImages || p.images, true);
      if (galleryArr.length === 0 && primaryImageUrl) galleryArr = [primaryImageUrl];

      const isPublishedVal = p.isPublished !== undefined ? !!p.isPublished : (p.publishToWebsite !== undefined ? !!p.publishToWebsite : true);

      return {
        id: p.id,
        productId: p.id,
        managementProductId: p.id,
        isLinkedToManagement: true,
        name: p.name,
        productName: p.name,
        slug: p.slug || generateSlug(`${p.name}-${p.sku || p.id}`),
        sku: p.sku || '',
        barcode: p.barcode || '',
        brand: p.brand || 'Blovit Organics',
        category: p.category || 'General',
        price: Number(p.sellingPrice || p.price || 0),
        sellingPrice: Number(p.sellingPrice || p.price || 0),
        compareAtPrice: Number(p.mrp || p.compareAtPrice || 0),
        mrp: Number(p.mrp || p.compareAtPrice || 0),
        gstPercent: Number(p.gstPercent || 5),
        gstRate: Number(p.gstPercent || 5),
        stock: Number(p.stock || 0),
        stockQuantity: Number(p.stock || 0),
        unit: p.unit || 'pcs',
        imageUrl: primaryImageUrl,
        masterStatus: p.isActive ? 'Active' : 'Inactive',
        masterIsActive: !!p.isActive,
        isActive: !!p.isActive,
        status: p.status || (isPublishedVal ? 'Published' : 'Draft'),
        shortDescription: p.shortDescription || '',
        description: p.description || '',
        benefits: formatJsonField(p.benefits, true),
        ingredients: formatJsonField(p.ingredients, true),
        nutritionFacts: formatJsonField(p.nutritionFacts, false),
        usageInstructions: p.usageInstructions || '',
        faqs: formatJsonField(p.faqs, true),
        seoTitle: p.seoTitle || p.name,
        seoDescription: p.seoDescription || p.shortDescription || p.name,
        seoKeywords: p.seoKeywords || '',
        badges: formatJsonField(p.badges, true),
        healthGoals: formatJsonField(p.healthGoals, true),
        isFeatured: !!p.isFeatured,
        isBestseller: !!p.isBestseller,
        isTrending: !!p.isTrending,
        isPublished: isPublishedVal,
        availabilityState: p.availabilityState || (Number(p.stock || 0) > 0 ? 'In Stock' : 'Out of Stock'),
        sortOrder: Number(p.sortOrder || 0),
        images: galleryArr,
        galleryImages: galleryArr,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    res.json({ success: true, count: data.length, data, managementProductsList: data });
  } catch (err) {
    console.error('Error fetching admin products:', err);
    res.status(200).json({ success: true, count: 0, data: [], managementProductsList: [] });
  }
};

const ProductAuditLog = require('../models/ProductAuditLog');

// Helper for automatic slug conflict resolution
const resolveUniqueSlug = async (rawSlug, currentProductId = null) => {
  const baseSlug = generateSlug(rawSlug || 'product');
  let candidateSlug = baseSlug;
  let counter = 1;

  while (true) {
    const whereClause = { slug: candidateSlug };
    if (currentProductId) {
      whereClause.id = { [Op.ne]: currentProductId };
    }
    const existing = await Product.findOne({ where: whereClause });
    if (!existing) {
      return candidateSlug;
    }
    counter++;
    candidateSlug = `${baseSlug}-${counter}`;
  }
};
const createAdminProduct = async (req, res) => {
  try {
    const {
      name,
      slug,
      sku,
      barcode,
      category,
      subCategory,
      brand,
      price,
      compareAtPrice,
      mrp,
      stock,
      unit,
      gstPercent,
      status,
      availabilityState,
      isPublished,
      isActive,
      shortDescription,
      description,
      benefits,
      ingredients,
      nutritionFacts,
      usageInstructions,
      faqs,
      seoTitle,
      seoDescription,
      seoKeywords,
      badges,
      healthGoals,
      isFeatured,
      isBestseller,
      isTrending,
      sortOrder,
      images,
      galleryImages,
      imageUrl,
      relatedProductIds,
      upsellProductIds,
      crossSellProductIds,
      managementProductId,
      productId,
      // New master columns
      productType,
      hsnCode,
      purchasePrice,
      costPrice,
      wholesalePrice,
      distributorPrice,
      dealerPrice,
      openingStock,
      minStock,
      maxStock,
      reorderLevel,
      bom,
      recipe,
      shelfLife,
      batchTracking,
      expiryTracking,
      highlights,
      videoUrl,
      canonicalUrl,
      openGraphImage,
      schemaData,
      websiteLabels,
    } = req.body;

    // 1. Enterprise Validation Rules
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Product Name is required.' });
    }

    const numericPrice = Number(price !== undefined && price !== null ? price : 0);
    if (isNaN(numericPrice) || numericPrice <= 0) {
      return res.status(400).json({ success: false, message: 'Price must be a valid positive number.' });
    }

    const finalSku = sku?.trim() || `SKU-${Date.now()}`;
    if (sku?.trim()) {
      const existingSku = await Product.findOne({ where: { sku: sku.trim() } });
      if (existingSku) {
        return res.status(400).json({ success: false, message: `Duplicate SKU "${sku}" already exists. SKU must be unique.` });
      }
    }

    if (barcode?.trim()) {
      const existingBarcode = await Product.findOne({ where: { barcode: barcode.trim() } });
      if (existingBarcode) {
        return res.status(400).json({ success: false, message: `Duplicate Barcode "${barcode}" already exists.` });
      }
    }

    const finalIsPublished = isPublished !== undefined ? !!isPublished : (status === 'Published');
    const finalIsActive = isActive !== undefined ? !!isActive : true;

    // Validate storefront publication fields
    const galleryArr = Array.isArray(galleryImages || images)
      ? (galleryImages || images)
      : (() => {
          try { return JSON.parse(galleryImages || images || '[]'); } catch { return []; }
        })();
    const galleryArrJson = JSON.stringify(galleryArr);
    const primaryImgUrl = imageUrl || (galleryArr.length > 0 ? galleryArr[0] : '');

    if (finalIsPublished) {
      if (!primaryImgUrl) {
        return res.status(400).json({ success: false, message: 'At least one product image is required when Show on Website is ON.' });
      }
      if (!shortDescription || !shortDescription.trim()) {
        return res.status(400).json({ success: false, message: 'Short description is required when Show on Website is ON.' });
      }
      if (!category || !category.trim() || category === 'General') {
        return res.status(400).json({ success: false, message: 'A specific Category is required when Show on Website is ON.' });
      }
      if (slug && slug.trim()) {
        const existingSlug = await Product.findOne({ where: { slug: slug.trim() } });
        if (existingSlug) {
          return res.status(400).json({ success: false, message: `SEO Slug "${slug}" is already in use by another product.` });
        }
      }
    }

    // 2. Automatic Slug Conflict Resolution
    const uniqueSlug = await resolveUniqueSlug(slug || name);

    const formatArrayJson = (val) => {
      if (Array.isArray(val)) return JSON.stringify(val);
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[')) return trimmed;
        return JSON.stringify(trimmed ? [trimmed] : []);
      }
      return '[]';
    };

    // Initial Version Snapshot
    const initialVersion = {
      version: 1,
      savedAt: new Date().toISOString(),
      name,
      price: numericPrice,
      stock: Number(stock || 0),
      isPublished: finalIsPublished,
      status: status || (finalIsPublished ? 'Published' : 'Draft'),
    };

    // 3. Atomic Single Record Save into Core Product Model
    const masterProduct = await Product.create({
      name: name.trim(),
      slug: uniqueSlug,
      sku: finalSku,
      barcode: barcode?.trim() || null,
      category: category?.trim() || 'General',
      subCategory: subCategory?.trim() || null,
      brand: brand?.trim() || 'Blovit Organics',
      price: numericPrice,
      sellingPrice: numericPrice,
      salePrice: numericPrice,
      compareAtPrice: Number(compareAtPrice || mrp || 0),
      mrp: Number(mrp || compareAtPrice || 0),
      stock: Math.max(0, Number(stock || 0)),
      unit: unit?.trim() || 'pcs',
      gstPercent: Number(gstPercent || 5),
      productType: productType || 'trading',
      imageUrl: primaryImgUrl,
      image: primaryImgUrl,
      images: galleryArrJson,
      galleryImages: galleryArrJson,
      shortDescription: shortDescription || '',
      description: description || '',
      benefits: formatArrayJson(benefits),
      ingredients: formatArrayJson(ingredients),
      nutritionFacts: typeof nutritionFacts === 'object' ? JSON.stringify(nutritionFacts) : (nutritionFacts || '{}'),
      usageInstructions: usageInstructions || '',
      faqs: formatArrayJson(faqs),
      seoTitle: seoTitle || name,
      seoDescription: seoDescription || shortDescription || name,
      seoKeywords: seoKeywords || '',
      badges: formatArrayJson(badges),
      healthGoals: formatArrayJson(healthGoals),
      isFeatured: !!isFeatured,
      isBestseller: !!isBestseller,
      isTrending: !!isTrending,
      isPublished: finalIsPublished,
      publishToWebsite: finalIsPublished,
      status: status || (finalIsPublished ? 'Published' : 'Draft'),
      availabilityState: availabilityState || (Number(stock || 0) > 0 ? 'In Stock' : 'Out of Stock'),
      sortOrder: Number(sortOrder || 0),
      relatedProductIds: formatArrayJson(relatedProductIds),
      upsellProductIds: formatArrayJson(upsellProductIds),
      crossSellProductIds: formatArrayJson(crossSellProductIds),
      versionHistory: JSON.stringify([initialVersion]),
      isActive: finalIsActive,
      isArchived: false,
      // New master columns
      hsnCode: hsnCode?.trim() || null,
      costPrice: Number(costPrice || 0),
      dealerPrice: Number(dealerPrice || 0),
      distributorPrice: Number(distributorPrice || 0),
      purchasePrice: Number(purchasePrice || 0),
      openingStock: Number(openingStock || 0),
      minStock: Number(minStock || 0),
      maxStock: Number(maxStock || 0),
      reorderLevel: Number(reorderLevel || 0),
      recipe: recipe || null,
      bom: bom || null,
      shelfLife: shelfLife || null,
      batchTracking: !!batchTracking,
      expiryTracking: !!expiryTracking,
      highlights: highlights || '',
      videoUrl: videoUrl || null,
      canonicalUrl: canonicalUrl || null,
      openGraphImage: openGraphImage || null,
      schemaData: schemaData || null,
      websiteLabels: formatArrayJson(websiteLabels),
    });

    // 4. Safely Link WebsiteProduct Setting Record if present
    try {
      await WebsiteProduct.create({
        managementProductId: masterProduct.id,
        name: masterProduct.name,
        sku: masterProduct.sku,
        slug: masterProduct.slug,
        price: numericPrice,
        compareAtPrice: masterProduct.mrp,
        stock: masterProduct.stock,
        category: masterProduct.category,
        shortDescription: masterProduct.shortDescription,
        description: masterProduct.description,
        benefits: masterProduct.benefits,
        ingredients: masterProduct.ingredients,
        nutritionFacts: masterProduct.nutritionFacts,
        usageInstructions: masterProduct.usageInstructions,
        faqs: masterProduct.faqs,
        seoTitle: masterProduct.seoTitle,
        seoDescription: masterProduct.seoDescription,
        seoKeywords: masterProduct.seoKeywords,
        badges: masterProduct.badges,
        healthGoals: masterProduct.healthGoals,
        isFeatured: masterProduct.isFeatured,
        isBestseller: masterProduct.isBestseller,
        isTrending: masterProduct.isTrending,
        isPublished: masterProduct.isPublished,
        isActive: masterProduct.isActive,
        sortOrder: masterProduct.sortOrder,
        images: galleryArrJson,
        galleryImages: galleryArrJson,
        imageUrl: primaryImgUrl,
      });
    } catch (wpErr) {
      console.warn('WebsiteProduct secondary sync skipped:', wpErr.message);
    }

    // 5. Audit Log Entry
    try {
      await ProductAuditLog.create({
        productId: masterProduct.id,
        userId: req.user?.id || 1,
        userName: req.user?.name || 'Admin',
        action: finalIsPublished ? 'publish' : 'create',
        newValues: JSON.stringify(masterProduct.toJSON()),
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Browser',
      });
    } catch (auditErr) {
      console.warn('Audit log write skipped:', auditErr.message);
    }

    try {
      const catalogController = require('../controllers/catalogController');
      catalogController.clearCatalogCache();
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: `Product "${masterProduct.name}" created successfully!`,
      data: {
        ...masterProduct.toJSON(),
        productId: masterProduct.id,
        managementProductId: masterProduct.id,
      }
    });
  } catch (err) {
    console.error('Error creating unified product:', err);
    res.status(500).json({ success: false, message: 'Failed to create product: ' + err.message });
  }
};

const updateAdminProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      slug,
      sku,
      barcode,
      category,
      subCategory,
      brand,
      price,
      compareAtPrice,
      mrp,
      stock,
      unit,
      gstPercent,
      status,
      availabilityState,
      isPublished,
      isActive,
      shortDescription,
      description,
      benefits,
      ingredients,
      nutritionFacts,
      usageInstructions,
      faqs,
      seoTitle,
      seoDescription,
      seoKeywords,
      badges,
      healthGoals,
      isFeatured,
      isBestseller,
      isTrending,
      sortOrder,
      images,
      galleryImages,
      imageUrl,
      relatedProductIds,
      upsellProductIds,
      crossSellProductIds,
      managementProductId,
      productId,
      // New master columns
      productType,
      hsnCode,
      purchasePrice,
      costPrice,
      wholesalePrice,
      distributorPrice,
      dealerPrice,
      openingStock,
      minStock,
      maxStock,
      reorderLevel,
      bom,
      recipe,
      shelfLife,
      batchTracking,
      expiryTracking,
      highlights,
      videoUrl,
      canonicalUrl,
      openGraphImage,
      schemaData,
      websiteLabels,
    } = req.body;

    let wp = await WebsiteProduct.findByPk(id);
    let targetMasterId = wp?.managementProductId || managementProductId || productId || id;
    let masterProduct = await Product.findByPk(targetMasterId);

    if (!masterProduct) {
      // If master product doesn't exist, route to createAdminProduct
      return createAdminProduct(req, res);
    }

    // 1. Enterprise Validation Rules
    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ success: false, message: 'Product Name cannot be empty.' });
    }

    if (price !== undefined) {
      const numericPrice = Number(price);
      if (isNaN(numericPrice) || numericPrice <= 0) {
        return res.status(400).json({ success: false, message: 'Price must be a valid positive number.' });
      }
    }

    if (sku && sku.trim() !== masterProduct.sku) {
      const existingSku = await Product.findOne({ where: { sku: sku.trim(), id: { [Op.ne]: masterProduct.id } } });
      if (existingSku) {
        return res.status(400).json({ success: false, message: `Duplicate SKU "${sku}" already exists.` });
      }
    }

    if (barcode && barcode.trim() !== masterProduct.barcode) {
      const existingBarcode = await Product.findOne({ where: { barcode: barcode.trim(), id: { [Op.ne]: masterProduct.id } } });
      if (existingBarcode) {
        return res.status(400).json({ success: false, message: `Duplicate Barcode "${barcode}" already exists.` });
      }
    }

    const finalIsPublished = isPublished !== undefined ? !!isPublished : (status === 'Published' || status === 'published' ? true : masterProduct.isPublished);

    if (finalIsPublished) {
      const checkImg = imageUrl || masterProduct.imageUrl || (galleryImages && galleryImages.length > 0 && galleryImages !== '[]') || (masterProduct.galleryImages && masterProduct.galleryImages !== '[]');
      if (!checkImg) {
        return res.status(400).json({ success: false, message: 'At least one product image is required when Show on Website is ON.' });
      }
      const checkDesc = shortDescription !== undefined ? shortDescription : masterProduct.shortDescription;
      if (!checkDesc || !checkDesc.trim()) {
        return res.status(400).json({ success: false, message: 'Short description is required when Show on Website is ON.' });
      }
      const checkCat = category !== undefined ? category : masterProduct.category;
      if (!checkCat || !checkCat.trim() || checkCat === 'General') {
        return res.status(400).json({ success: false, message: 'A specific Category is required when Show on Website is ON.' });
      }
      if (slug && slug.trim() && slug !== masterProduct.slug) {
        const existingSlug = await Product.findOne({ where: { slug: slug.trim(), id: { [Op.ne]: masterProduct.id } } });
        if (existingSlug) {
          return res.status(400).json({ success: false, message: `SEO Slug "${slug}" is already in use by another product.` });
        }
      }
    }

    // 2. Automatic Slug Conflict Resolution if slug changed
    let uniqueSlug = masterProduct.slug;
    if (slug && slug !== masterProduct.slug) {
      uniqueSlug = await resolveUniqueSlug(slug, masterProduct.id);
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

    const oldSnapshot = masterProduct.toJSON();

    // 3. Update Unified Product Master
    if (name !== undefined) masterProduct.name = name.trim();
    masterProduct.slug = uniqueSlug;
    if (sku !== undefined) masterProduct.sku = sku.trim();
    if (barcode !== undefined) masterProduct.barcode = barcode ? barcode.trim() : null;
    if (category !== undefined) masterProduct.category = category.trim();
    if (subCategory !== undefined) masterProduct.subCategory = subCategory ? subCategory.trim() : null;
    if (brand !== undefined) masterProduct.brand = brand.trim();
    if (price !== undefined) {
      const numericPrice = Number(price);
      masterProduct.price = numericPrice;
      masterProduct.sellingPrice = numericPrice;
      masterProduct.salePrice = numericPrice;
    }
    if (compareAtPrice !== undefined || mrp !== undefined) {
      masterProduct.mrp = Number(mrp || compareAtPrice || 0);
      masterProduct.compareAtPrice = Number(compareAtPrice || mrp || 0);
    }
    if (stock !== undefined) masterProduct.stock = Math.max(0, Number(stock || 0));
    if (unit !== undefined) masterProduct.unit = unit.trim();
    if (gstPercent !== undefined) masterProduct.gstPercent = Number(gstPercent);
    if (shortDescription !== undefined) masterProduct.shortDescription = shortDescription;
    if (description !== undefined) masterProduct.description = description;
    if (benefits !== undefined) masterProduct.benefits = formatArrayJson(benefits);
    if (ingredients !== undefined) masterProduct.ingredients = formatArrayJson(ingredients);
    if (nutritionFacts !== undefined) masterProduct.nutritionFacts = typeof nutritionFacts === 'object' ? JSON.stringify(nutritionFacts) : (nutritionFacts || '{}');
    if (usageInstructions !== undefined) masterProduct.usageInstructions = usageInstructions;
    if (faqs !== undefined) masterProduct.faqs = formatArrayJson(faqs);
    if (seoTitle !== undefined) masterProduct.seoTitle = seoTitle;
    if (seoDescription !== undefined) masterProduct.seoDescription = seoDescription;
    if (seoKeywords !== undefined) masterProduct.seoKeywords = seoKeywords;
    if (badges !== undefined) masterProduct.badges = formatArrayJson(badges);
    if (healthGoals !== undefined) masterProduct.healthGoals = formatArrayJson(healthGoals);
    if (isFeatured !== undefined) masterProduct.isFeatured = !!isFeatured;
    if (isBestseller !== undefined) masterProduct.isBestseller = !!isBestseller;
    if (isTrending !== undefined) masterProduct.isTrending = !!isTrending;
    if (sortOrder !== undefined) masterProduct.sortOrder = Number(sortOrder);
    if (availabilityState !== undefined) masterProduct.availabilityState = availabilityState;
    if (status !== undefined) masterProduct.status = status;

    // New master columns
    if (productType !== undefined) masterProduct.productType = productType;
    if (hsnCode !== undefined) masterProduct.hsnCode = hsnCode ? hsnCode.trim() : null;
    if (costPrice !== undefined) masterProduct.costPrice = Number(costPrice || 0);
    if (dealerPrice !== undefined) masterProduct.dealerPrice = Number(dealerPrice || 0);
    if (distributorPrice !== undefined) masterProduct.distributorPrice = Number(distributorPrice || 0);
    if (purchasePrice !== undefined) masterProduct.purchasePrice = Number(purchasePrice || 0);
    if (openingStock !== undefined) masterProduct.openingStock = Number(openingStock || 0);
    if (minStock !== undefined) masterProduct.minStock = Number(minStock || 0);
    if (maxStock !== undefined) masterProduct.maxStock = Number(maxStock || 0);
    if (reorderLevel !== undefined) masterProduct.reorderLevel = Number(reorderLevel || 0);
    if (recipe !== undefined) masterProduct.recipe = recipe;
    if (bom !== undefined) masterProduct.bom = bom;
    if (shelfLife !== undefined) masterProduct.shelfLife = shelfLife;
    if (batchTracking !== undefined) masterProduct.batchTracking = !!batchTracking;
    if (expiryTracking !== undefined) masterProduct.expiryTracking = !!expiryTracking;
    if (highlights !== undefined) masterProduct.highlights = highlights;
    if (videoUrl !== undefined) masterProduct.videoUrl = videoUrl;
    if (canonicalUrl !== undefined) masterProduct.canonicalUrl = canonicalUrl;
    if (openGraphImage !== undefined) masterProduct.openGraphImage = openGraphImage;
    if (schemaData !== undefined) masterProduct.schemaData = schemaData;
    if (websiteLabels !== undefined) masterProduct.websiteLabels = formatArrayJson(websiteLabels);

    if (isPublished !== undefined) {
      masterProduct.isPublished = !!isPublished;
      masterProduct.publishToWebsite = !!isPublished;
    } else if (status !== undefined) {
      masterProduct.isPublished = (status === 'Published');
      masterProduct.publishToWebsite = (status === 'Published');
    }

    if (isActive !== undefined) masterProduct.isActive = !!isActive;

    const galleryArr = Array.isArray(galleryImages || images)
      ? (galleryImages || images)
      : (() => {
          try { return JSON.parse(galleryImages || images || '[]'); } catch { return []; }
        })();
    if (images !== undefined || galleryImages !== undefined) {
      const galleryArrJson = JSON.stringify(galleryArr);
      masterProduct.images = galleryArrJson;
      masterProduct.galleryImages = galleryArrJson;
      if (galleryArr.length > 0) {
        masterProduct.imageUrl = imageUrl || galleryArr[0];
        masterProduct.image = imageUrl || galleryArr[0];
      }
    }

    // Versioning Snapshot
    let versionList = [];
    try { versionList = JSON.parse(masterProduct.versionHistory || '[]'); } catch {}
    const newVersion = {
      version: versionList.length + 1,
      savedAt: new Date().toISOString(),
      name: masterProduct.name,
      price: masterProduct.price,
      stock: masterProduct.stock,
      isPublished: masterProduct.isPublished,
      status: masterProduct.status,
    };
    versionList.push(newVersion);
    masterProduct.versionHistory = JSON.stringify(versionList);

    await masterProduct.save();

    // 4. Update WebsiteProduct Settings Link Record
    // 4. Safely Link / Update WebsiteProduct Setting Record if present
    try {
      if (!wp) {
        wp = await WebsiteProduct.findOne({ where: { managementProductId: masterProduct.id } });
      }
      if (wp) {
        wp.name = masterProduct.name;
        wp.slug = masterProduct.slug;
        wp.sku = masterProduct.sku;
        wp.price = masterProduct.price;
        wp.compareAtPrice = masterProduct.mrp;
        wp.stock = masterProduct.stock;
        wp.category = masterProduct.category;
        wp.shortDescription = masterProduct.shortDescription;
        wp.description = masterProduct.description;
        wp.benefits = masterProduct.benefits;
        wp.ingredients = masterProduct.ingredients;
        wp.nutritionFacts = masterProduct.nutritionFacts;
        wp.usageInstructions = masterProduct.usageInstructions;
        wp.faqs = masterProduct.faqs;
        wp.seoTitle = masterProduct.seoTitle;
        wp.seoDescription = masterProduct.seoDescription;
        wp.seoKeywords = masterProduct.seoKeywords;
        wp.badges = masterProduct.badges;
        wp.healthGoals = masterProduct.healthGoals;
        wp.isFeatured = masterProduct.isFeatured;
        wp.isBestseller = masterProduct.isBestseller;
        wp.isTrending = masterProduct.isTrending;
        wp.isPublished = masterProduct.isPublished;
        wp.isActive = masterProduct.isActive;
        wp.sortOrder = masterProduct.sortOrder;
        wp.images = masterProduct.images;
        wp.galleryImages = masterProduct.galleryImages;
        wp.imageUrl = masterProduct.imageUrl;
        await wp.save();
      }
    } catch (wpErr) {
      console.warn('WebsiteProduct secondary update skipped:', wpErr.message);
    }

    // 5. Audit Log Entry
    try {
      const actionType = isPublished !== undefined ? (isPublished ? 'publish' : 'unpublish') : 'update';
      await ProductAuditLog.create({
        productId: masterProduct.id,
        userId: req.user?.id || 1,
        userName: req.user?.name || 'Admin',
        action: actionType,
        oldValues: JSON.stringify(oldSnapshot),
        newValues: JSON.stringify(masterProduct.toJSON()),
        ipAddress: req.ip || '127.0.0.1',
        userAgent: req.headers['user-agent'] || 'Browser',
      });
    } catch (auditErr) {
      console.warn('Audit log write skipped:', auditErr.message);
    }

    try {
      const catalogController = require('../controllers/catalogController');
      catalogController.clearCatalogCache();
    } catch (e) {}

    res.json({
      success: true,
      message: `Product "${masterProduct.name}" updated successfully!`,
      data: {
        ...masterProduct.toJSON(),
        productId: masterProduct.id,
        managementProductId: masterProduct.id,
      }
    });
  } catch (err) {
    console.error('Error updating unified product:', err);
    res.status(500).json({ success: false, message: 'Failed to update product: ' + err.message });
  }
};

const deleteAdminProduct = async (req, res) => {
  try {
    const { id } = req.params;
    let masterProduct = await Product.findByPk(id);
    if (!masterProduct) {
      const wp = await WebsiteProduct.findByPk(id);
      if (wp?.managementProductId) {
        masterProduct = await Product.findByPk(wp.managementProductId);
      }
    }

    if (masterProduct) {
      masterProduct.isPublished = false;
      masterProduct.publishToWebsite = false;
      await masterProduct.save();

      try {
        await ProductAuditLog.create({
          productId: masterProduct.id,
          userId: req.user?.id || 1,
          userName: req.user?.name || 'Admin',
          action: 'unpublish',
          oldValues: JSON.stringify({ isPublished: true }),
          newValues: JSON.stringify({ isPublished: false }),
          ipAddress: req.ip || '127.0.0.1',
          userAgent: req.headers['user-agent'] || 'Browser',
        });
      } catch (e) {}
    }

    res.json({ success: true, message: 'Product unpublished from website storefront successfully' });
  } catch (err) {
    console.error('Error in deleteAdminProduct:', err);
    res.status(500).json({ success: false, message: 'Failed to unpublish product' });
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

    const customerIds = [...new Set(referrals.flatMap(r => [r.referrerCustomerId, r.referredCustomerId]).filter(Boolean))];
    const { Op } = require('sequelize');
    const customers = await WebsiteCustomer.findAll({ where: { id: { [Op.in]: customerIds } } });
    const customerMap = new Map(customers.map(c => [c.id.toString(), c]));

    const data = referrals.map(ref => {
      const referrer = customerMap.get(ref.referrerCustomerId?.toString());
      const referred = customerMap.get(ref.referredCustomerId?.toString());
      return {
        ...ref.toJSON(),
        referrerName: referrer?.fullName || 'Unknown',
        referrerMobile: referrer?.mobile || '',
        referredName: referred?.fullName || 'Unknown',
        referredMobile: referred?.mobile || '',
      };
    });

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
