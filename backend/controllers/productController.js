const { Op, col } = require('sequelize');
const Product = require('../models/Product');
const ProductPackSize = require('../models/ProductPackSize');
const StockMovement = require('../models/StockMovement');
const User = require('../models/User');
const { logActivity } = require('../utils/helpers');
const { recalculateAllProductPrices, recalculateProductPrice } = require('../utils/priceService');

exports.getProducts = async (req, res, next) => {
  try {
    await recalculateAllProductPrices();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const category = req.query.category || '';
    const showArchived = req.query.showArchived === 'true';
    
    const query = {
      isArchived: showArchived ? true : { [Op.ne]: true }
    };
    if (search) {
      query[Op.and] = [
        {
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { sku: { [Op.like]: `%${search}%` } },
            { barcode: { [Op.like]: `%${search}%` } },
          ]
        }
      ];
    }
    if (category) {
      query.category = category;
    }

    const { count: total, rows: products } = await Product.findAndCountAll({
      where: query,
      include: [{ model: ProductPackSize, as: 'packSizes' }],
      order: [['createdAt', 'DESC']],
      offset: (page - 1) * limit,
      limit: limit,
    });

    res.json({ products, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
};

exports.getLowStock = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      where: {
        isArchived: { [Op.ne]: true },
        stock: {
          [Op.lte]: col('lowStockThreshold'),
        },
      },
      order: [['stock', 'ASC']],
    });
    
    res.json({ products, count: products.length });
  } catch (err) {
    next(err);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      where: { isArchived: { [Op.ne]: true } },
      attributes: ['category'],
      group: ['category'],
      raw: true,
    });
    const categories = products.map((p) => p.category).filter(Boolean);
    res.json({ categories });
  } catch (err) {
    next(err);
  }
};

exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [{ model: ProductPackSize, as: 'packSizes' }]
    });
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ product });
  } catch (err) {
    next(err);
  }
};

exports.getStockHistory = async (req, res, next) => {
  try {
    const movements = await StockMovement.findAll({
      where: { productId: req.params.id },
      include: [
        {
          model: User,
          as: 'createdBy',
          attributes: ['name'],
        },
      ],
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json({ movements });
  } catch (err) {
    next(err);
  }
};

exports.createProduct = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = `/uploads/products/${req.file.filename}`;
    
    if (data.preferredSupplierId === '' || data.preferredSupplierId === 'null' || data.preferredSupplierId === null) {
      data.preferredSupplierId = null;
    }
    if (data.parentProductId === '' || data.parentProductId === 'null' || data.parentProductId === null) {
      data.parentProductId = null;
    }
    const dateFields = [
      'woocommerce_last_modified',
      'lastModifiedDate',
      'lastSyncTimestamp',
      'lastWooUpdateTimestamp'
    ];
    dateFields.forEach(field => {
      if (data[field] === '' || data[field] === 'null' || data[field] === 'Invalid date' || data[field] === 'Invalid Date' || data[field] === null) {
        data[field] = null;
      }
    });
    
    let packSizesData = [];
    if (data.packSizes) {
      try {
        packSizesData = typeof data.packSizes === 'string' ? JSON.parse(data.packSizes) : data.packSizes;
      } catch (e) {
        console.error('Failed to parse pack sizes:', e);
      }
    }
    
    const product = await Product.create(data);
    
    if (packSizesData && packSizesData.length > 0) {
      for (const ps of packSizesData) {
        await ProductPackSize.create({ ...ps, productId: product.id });
      }
    }
    
    await logActivity(req.user.id, 'create', 'products', `Created product ${product.name}`);
    await recalculateProductPrice(product.id);
    const updatedProduct = await Product.findByPk(product.id, {
      include: [{ model: ProductPackSize, as: 'packSizes' }]
    });
    res.status(201).json({ product: updatedProduct });
  } catch (err) {
    next(err);
  }
};

exports.updateProduct = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) data.image = `/uploads/products/${req.file.filename}`;
    
    if (data.preferredSupplierId === '' || data.preferredSupplierId === 'null' || data.preferredSupplierId === null) {
      data.preferredSupplierId = null;
    }
    if (data.parentProductId === '' || data.parentProductId === 'null' || data.parentProductId === null) {
      data.parentProductId = null;
    }
    const dateFields = [
      'woocommerce_last_modified',
      'lastModifiedDate',
      'lastSyncTimestamp',
      'lastWooUpdateTimestamp'
    ];
    dateFields.forEach(field => {
      if (data[field] === '' || data[field] === 'null' || data[field] === 'Invalid date' || data[field] === 'Invalid Date' || data[field] === null) {
        data[field] = null;
      }
    });
    
    let packSizesData = [];
    if (data.packSizes) {
      try {
        packSizesData = typeof data.packSizes === 'string' ? JSON.parse(data.packSizes) : data.packSizes;
      } catch (e) {
        console.error('Failed to parse pack sizes:', e);
      }
    }
    
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    
    await product.update(data);
    
    const existingPacks = await ProductPackSize.findAll({ where: { productId: product.id } });
    const stockMap = {};
    existingPacks.forEach(ep => {
      stockMap[ep.packName.toLowerCase().trim()] = ep.stock;
    });

    await ProductPackSize.destroy({ where: { productId: product.id } });
    if (packSizesData && packSizesData.length > 0) {
      for (const ps of packSizesData) {
        const key = ps.packName.toLowerCase().trim();
        const stock = stockMap[key] !== undefined ? stockMap[key] : (ps.stock || 0);
        await ProductPackSize.create({ ...ps, stock, productId: product.id });
      }
    }
    
    await logActivity(req.user.id, 'update', 'products', `Updated product ${product.name}`);
    await recalculateProductPrice(product.id);
    const updatedProduct = await Product.findByPk(product.id, {
      include: [{ model: ProductPackSize, as: 'packSizes' }]
    });
    res.json({ product: updatedProduct });
  } catch (err) {
    next(err);
  }
};

const getProductDependencies = async (productId) => {
  const ProductPackSize = require('../models/ProductPackSize');
  const StockMovement = require('../models/StockMovement');
  const ManufacturingRecipe = require('../models/ManufacturingRecipe');
  const RepackRecipe = require('../models/RepackRecipe');
  const RepackRecipeMaterial = require('../models/RepackRecipeMaterial');
  const InvoiceItem = require('../models/InvoiceItem');
  const PurchaseItem = require('../models/PurchaseItem');
  const ManufacturingEntry = require('../models/ManufacturingEntry');
  const RepackEntry = require('../models/RepackEntry');
  const RepackEntryMaterial = require('../models/RepackEntryMaterial');
  const Shipment = require('../models/Shipment');

  const stockMovementsCount = await StockMovement.count({ where: { productId } });
  const packSizesCount = await ProductPackSize.count({ where: { productId } });
  const mfgRecipesCount = await ManufacturingRecipe.count({ where: { productId } });
  
  const repackRecipesCount = await RepackRecipe.count({ where: { finishedProductId: productId } });
  const repackRecipeIngredientsCount = await RepackRecipeMaterial.count({ where: { productId } });
  
  const invoiceItemsCount = await InvoiceItem.count({ where: { productId } });
  const purchaseItemsCount = await PurchaseItem.count({ where: { productId } });
  
  const mfgEntriesCount = await ManufacturingEntry.count({ where: { productId } });
  const repackEntriesCount = await RepackEntry.count({ where: { finishedProductId: productId } });
  const repackEntryMaterialsCount = await RepackEntryMaterial.count({ where: { productId } });

  // Scan shipment records
  const invoiceItems = await InvoiceItem.findAll({ where: { productId }, attributes: ['invoiceId'] });
  const invoiceIds = [...new Set(invoiceItems.map(item => item.invoiceId).filter(Boolean))];
  const shipmentsCount = invoiceIds.length > 0 ? await Shipment.count({ where: { invoiceId: invoiceIds } }) : 0;

  // Scan WooCommerce links
  const product = await Product.findByPk(productId);
  let wooLinksCount = 0;
  if (product && (product.woocommerce_product_id || product.wooProductId)) {
    wooLinksCount = 1;
  }

  const total = stockMovementsCount + mfgRecipesCount + repackRecipesCount + 
                repackRecipeIngredientsCount + invoiceItemsCount + purchaseItemsCount + 
                mfgEntriesCount + repackEntriesCount + repackEntryMaterialsCount +
                shipmentsCount + wooLinksCount;

  return {
    stockMovements: stockMovementsCount,
    packSizes: packSizesCount,
    mfgRecipes: mfgRecipesCount,
    repackRecipes: repackRecipesCount + repackRecipeIngredientsCount,
    invoiceItems: invoiceItemsCount,
    purchaseItems: purchaseItemsCount,
    mfgEntries: mfgEntriesCount,
    repackEntries: repackEntriesCount + repackEntryMaterialsCount,
    shipments: shipmentsCount,
    wooLinks: wooLinksCount,
    total
  };
};

exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const mode = req.body.mode || 'erp_only'; // erp_only, woo_and_erp, unlink
    
    // 1. If mode is unlink, we just clear the WooCommerce mapping and return (do not archive)
    if (mode === 'unlink') {
      const oldId = product.woocommerce_product_id || product.wooProductId;
      product.woocommerce_product_id = null;
      product.wooProductId = null;
      await product.save();
      
      await logActivity(req.user.id, 'unlink', 'products', `Unlinked product ${product.name} from WooCommerce Product ID ${oldId}`, {
        sku: product.sku,
        productName: product.name,
        action: 'Unlink WooCommerce',
        success: true
      });
      
      return res.json({ success: true, message: 'WooCommerce product unlinked successfully', product });
    }

    // 2. Handle WooCommerce status update to 'draft' if requested
    const isLinkedToWoo = !!(product.woocommerce_product_id || product.wooProductId);
    if (mode === 'woo_and_erp' && isLinkedToWoo) {
      try {
        const Settings = require('../models/Settings');
        const settings = await Settings.findOne();
        const WooCommerceService = require('../utils/wooService');
        const woo = new WooCommerceService(settings);
        const wooId = product.woocommerce_product_id || product.wooProductId;
        await woo.updateProductStatus(wooId, 'draft');
      } catch (err) {
        console.error('[WooCommerce] Product status update failed:', err.message);
        await logActivity(req.user.id, 'woo_archive_failed', 'products', `WooCommerce API archive failed for ${product.name}: ${err.message}`, {
          sku: product.sku,
          productName: product.name,
          action: 'WooCommerce Archive',
          error: err.message,
          success: false
        });
        return res.status(500).json({
          success: false,
          message: `Failed to archive product in WooCommerce: ${err.message}`
        });
      }
    }

    // 3. Perform Soft Delete / Archive
    product.isArchived = true;
    await product.save();

    await logActivity(req.user.id, 'archive', 'products', `Archived product ${product.name}`, {
      sku: product.sku,
      productName: product.name,
      action: 'Archive',
      reason: mode === 'woo_and_erp' ? 'Archived in ERP and moved to Draft in WooCommerce' : 'Archived in ERP only',
      success: true
    });

    res.json({ success: true, message: 'Product archived successfully', product });
  } catch (err) {
    next(err);
  }
};

exports.getProductDependenciesApi = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const dependencies = await getProductDependencies(product.id);
    const ProductPackSize = require('../models/ProductPackSize');
    const packSizesStock = await ProductPackSize.sum('stock', { where: { productId: product.id } }) || 0;
    const totalStock = Number(product.stock) + Number(packSizesStock);

    const Settings = require('../models/Settings');
    const settings = await Settings.findOne();
    const isWooConnected = settings && (settings.wooConnected || settings.wooApiStatus === 'Connected');
    const isLinkedToWoo = !!(product.woocommerce_product_id || product.wooProductId);

    // console debug logs as requested
    console.log('--- PRODUCT DEPENDENCY SCAN DEBUG LOG ---');
    console.log('Product ID:', product.id);
    console.log('Current Stock:', totalStock);
    console.log('Dependency Counts:', dependencies);
    console.log('Reason for delete failure:', totalStock > 0 ? 'Stock exists' : dependencies.total > 0 ? 'Active database dependencies exist' : 'None (Product can be deleted)');
    console.log('-----------------------------------------');

    res.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
        stock: product.stock,
        totalStock,
        unit: product.unit,
        isLinkedToWoo,
        woocommerce_product_id: product.woocommerce_product_id || product.wooProductId
      },
      dependencies,
      wooSyncActive: isWooConnected && isLinkedToWoo
    });
  } catch (err) {
    next(err);
  }
};

exports.restoreProduct = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    product.isArchived = false;
    await product.save();

    await logActivity(req.user.id, 'restore', 'products', `Restored archived product ${product.name}`, {
      sku: product.sku,
      productName: product.name,
      action: 'Restore',
      success: true
    });

    res.json({ success: true, message: 'Product restored successfully', product });
  } catch (err) {
    next(err);
  }
};

exports.deleteProductPermanent = async (req, res, next) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    // Double-check dependencies before permanent delete
    const dependencies = await getProductDependencies(product.id);
    const hasDependencies = (dependencies.invoiceItems > 0) ||
                            (dependencies.mfgRecipes > 0) ||
                            (dependencies.mfgEntries > 0) ||
                            (dependencies.repackRecipes > 0) ||
                            (dependencies.repackEntries > 0) ||
                            (dependencies.purchaseItems > 0) ||
                            (dependencies.shipments > 0);

    if (hasDependencies) {
      // Add console debug logs
      console.log('--- PRODUCT DELETE FAILURE DEBUG LOG ---');
      console.log('Product ID:', product.id);
      console.log('Dependency Counts:', dependencies);
      console.log('Reason for delete failure: Active database dependencies exist');
      console.log('----------------------------------------');

      await logActivity(req.user.id, 'permanent_delete_block', 'products', `Blocked permanent delete for ${product.name} due to active dependencies`, {
        sku: product.sku,
        productName: product.name,
        action: 'Permanent Delete',
        reason: 'Active dependencies exist',
        success: false
      });
      return res.status(400).json({
        success: false,
        message: '❌ Cannot permanently delete product: Active database dependencies exist',
        dependencies
      });
    }

    // Clean up related pack sizes, stock movements and delete the product permanently
    await StockMovement.destroy({ where: { productId: product.id } });
    await ProductPackSize.destroy({ where: { productId: product.id } });

    // Remove images from disk
    if (product.image && product.image.startsWith('/uploads/')) {
      const fs = require('fs');
      const path = require('path');
      const filePath = path.join(__dirname, '..', product.image.substring(1));
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (e) {
          console.error('Failed to delete product image file:', e);
        }
      }
    }

    if (product.galleryImages) {
      try {
        const gallery = JSON.parse(product.galleryImages);
        if (Array.isArray(gallery)) {
          const fs = require('fs');
          const path = require('path');
          gallery.forEach(img => {
            if (img && img.startsWith('/uploads/')) {
              const filePath = path.join(__dirname, '..', img.substring(1));
              if (fs.existsSync(filePath)) {
                try {
                  fs.unlinkSync(filePath);
                } catch (e) {
                  console.error('Failed to delete gallery image file:', e);
                }
              }
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse galleryImages:', e);
      }
    }

    await product.destroy();

    await logActivity(req.user.id, 'delete', 'products', `Deleted Product: ${product.name}`, {
      sku: product.sku,
      productName: product.name,
      action: 'Deleted Product',
      success: true
    });

    res.json({ success: true, message: 'Product deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

exports.adjustProductStockToZero = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const product = await Product.findByPk(productId);
    if (!product) return res.status(404).json({ message: 'Product not found' });

    const ProductPackSize = require('../models/ProductPackSize');
    const { updateStock } = require('../utils/stockService');

    // 1. Adjust main stock to zero if it is non-zero
    const currentStock = Number(product.stock || 0);
    if (currentStock !== 0) {
      await updateStock(product.id, -currentStock, {
        type: 'adjustment',
        notes: 'System adjustment: Reset stock to zero for deletion/archival',
        userId: req.user.id
      });
      product.stock = 0;
      await product.save();
    }

    // 2. Reset all pack sizes stock to 0
    await ProductPackSize.update({ stock: 0 }, { where: { productId } });

    await logActivity(req.user.id, 'adjust', 'products', `Adjusted product ${product.name} and pack sizes stock to zero`);

    res.json({ success: true, message: 'Stock adjusted to zero successfully' });
  } catch (err) {
    next(err);
  }
};

