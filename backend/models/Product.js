const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const { makeMongooseCompatible } = require('./compat');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  barcode: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  category: {
    type: DataTypes.STRING,
    defaultValue: 'General',
  },
  stock: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  lowStockThreshold: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 10,
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'pcs',
  },
  purchasePrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  sellingPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  gstPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
  },
  supplier: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  image: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  productType: {
    type: DataTypes.STRING,
    defaultValue: 'BULK_PRODUCT',
  },
  parentProductId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  packSize: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  conversionFactor: {
    type: DataTypes.DECIMAL(10, 4),
    allowNull: true,
    defaultValue: 1.0000,
  },
  reorderQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 100,
  },
  preferredSupplierId: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  weight: {
    type: DataTypes.DECIMAL(10, 3),
    defaultValue: 0.200,
  },
  wooProductId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  woocommerce_product_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  brand: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  galleryImages: {
    type: DataTypes.TEXT,
    defaultValue: '[]',
  },
  dimensions: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  stockStatus: {
    type: DataTypes.STRING,
    defaultValue: 'instock',
  },
  woocommerce_last_modified: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  woocommerce_sync_status: {
    type: DataTypes.STRING,
    defaultValue: 'synced',
  },
  woocommerce_permalink: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  shortDescription: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  salePrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'publish',
  },
  attributes: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  tags: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  gstClass: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  lastModifiedDate: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastSyncTimestamp: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  lastWooUpdateTimestamp: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  mrp: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  greenPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  yellowPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  redPrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  wholesalePrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  ingredients: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  benefits: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  isLowStock: {
    type: DataTypes.VIRTUAL,
    get() {
      // Return true if stock is less than or equal to lowStockThreshold
      return Number(this.stock) <= Number(this.lowStockThreshold);
    },
  },
}, {
  indexes: [
    { fields: ['category'] }
  ]
});

Product.beforeCreate((product) => {
  if (!product.productType) {
    if (product.supplier === 'repack') {
      product.productType = 'repacking';
    } else {
      product.productType = 'manufactured';
    }
  }
});

Product.beforeUpdate((product) => {
  if (!product.productType) {
    if (product.supplier === 'repack') {
      product.productType = 'repacking';
    } else {
      product.productType = 'manufactured';
    }
  }
});

Product.belongsTo(Product, { as: 'parentProduct', foreignKey: 'parentProductId' });
Product.hasMany(Product, { as: 'variants', foreignKey: 'parentProductId' });

Product.belongsTo(require('./Supplier'), { as: 'preferredSupplier', foreignKey: 'preferredSupplierId' });

makeMongooseCompatible(Product, {
  preferredSupplier: 'preferredSupplierId',
  parentProduct: 'parentProductId',
});

Product.addHook('afterCreate', () => {
  try {
    const catalogController = require('../controllers/catalogController');
    catalogController.clearCatalogCache();
  } catch (e) {}
});

Product.addHook('afterUpdate', (product) => {
  try {
    if (
      product.changed('sellingPrice') ||
      product.changed('mrp') ||
      product.changed('greenPrice') ||
      product.changed('yellowPrice') ||
      product.changed('redPrice') ||
      product.changed('wholesalePrice') ||
      product.changed('packSize') ||
      product.changed('image') ||
      product.changed('name') ||
      product.changed('description') ||
      product.changed('ingredients') ||
      product.changed('benefits')
    ) {
      const catalogController = require('../controllers/catalogController');
      catalogController.clearCatalogCache();
    }
  } catch (e) {}
});

Product.addHook('afterDestroy', () => {
  try {
    const catalogController = require('../controllers/catalogController');
    catalogController.clearCatalogCache();
  } catch (e) {}
});

module.exports = Product;
