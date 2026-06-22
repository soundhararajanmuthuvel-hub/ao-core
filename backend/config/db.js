const { Sequelize } = require('sequelize');
const path = require('path');

let dialect = process.env.DB_DIALECT || 'sqlite';
if (process.env.MYSQLHOST || process.env.DATABASE_URL || process.env.MYSQL_URL) {
  dialect = 'mysql';
}

let sequelize;

if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
  console.log('Using MySQL database connection URL...');
  sequelize = new Sequelize(process.env.DATABASE_URL || process.env.MYSQL_URL, {
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? (msg) => console.log(`[Sequelize] ${msg}`) : false,
    define: {
      timestamps: true,
    },
  });
} else if (dialect === 'mysql') {
  console.log('Using MySQL database configuration...');
  sequelize = new Sequelize(
    process.env.MYSQLDATABASE || process.env.DB_NAME || 'ao_core',
    process.env.MYSQLUSER || process.env.DB_USER || 'root',
    process.env.MYSQLPASSWORD || process.env.DB_PASSWORD || '',
    {
      host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
      port: process.env.MYSQLPORT || process.env.DB_PORT || 3306,
      dialect: 'mysql',
      logging: process.env.NODE_ENV === 'development' ? (msg) => console.log(`[Sequelize] ${msg}`) : false,
      define: {
        timestamps: true,
      },
    }
  );
} else {
  console.log('Using local SQLite database configuration (zero-setup)...');
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '..', 'database.sqlite'),
    logging: process.env.NODE_ENV === 'development' ? (msg) => console.log(`[Sequelize] ${msg}`) : false,
    define: {
      timestamps: true,
    },
  });
}

const dropStaleSqliteBackupTables = async () => {
  if (dialect !== 'sqlite') {
    return;
  }

  const backupTables = await sequelize.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND substr(name, -7) = '_backup' ORDER BY name;",
    { type: Sequelize.QueryTypes.SELECT }
  );

  if (backupTables.length === 0) {
    return;
  }

  const queryInterface = sequelize.getQueryInterface();
  for (const { name } of backupTables) {
    const quotedName = queryInterface.queryGenerator.quoteIdentifier(name);
    console.log(`Dropping stale SQLite backup table: ${name}`);
    await sequelize.query(`DROP TABLE IF EXISTS ${quotedName}`);
  }
};

const runSqliteSyncSafely = async (syncOptions) => {
  if (dialect !== 'sqlite') {
    return sequelize.sync(syncOptions);
  }

  await sequelize.query('PRAGMA foreign_keys = OFF;');
  try {
    return await sequelize.sync(syncOptions);
  } finally {
    await sequelize.query('PRAGMA foreign_keys = ON;');
  }
};

const connectDB = async () => {
  await sequelize.authenticate();
  console.log(`${dialect === 'mysql' ? 'MySQL' : 'SQLite'} connected successfully via Sequelize.`);
  
  // Dynamically require all models to register them with Sequelize before syncing.
  require('../models/User');
  require('../models/Customer');
  require('../models/Supplier');
  require('../models/Product');
  require('../models/Settings');
  require('../models/SyncLog');
  require('../models/ActivityLog');
  require('../models/Notification');
  require('../models/StockMovement');
  require('../models/Invoice');
  require('../models/InvoiceItem');
  require('../models/Purchase');
  require('../models/PurchaseItem');
  require('../models/RepackRecipe');
  require('../models/RepackRecipeMaterial');
  require('../models/RepackEntry');
  require('../models/RepackEntryMaterial');
  require('../models/RawMaterial');
  require('../models/RawMaterialMovement');
  require('../models/ManufacturingRecipe');
  require('../models/ManufacturingRecipeMaterial');
  require('../models/ManufacturingEntry');
  require('../models/ManufacturingEntryMaterial');
  require('../models/Shipment');
  require('../models/ProductPackSize');
  require('../models/Courier');
  require('../models/StockLoss');
  require('../models/Order');
  require('../models/Payment');
  require('../models/MigrationHistory');
  require('../models/MigrationDetailLog');
  require('../models/CrmNote');
  require('../models/CrmFollowUp');
  require('../models/ReminderHistory');
  require('../models/Route');
  require('../models/Visit');
  require('../models/SalesmanLocation');
  require('../models/CustomerReview');
  require('../models/Lead');
  require('../models/CrmOpportunity');
  require('../models/AiSuggestion');
  require('../models/WhatsAppSettings');
  require('../models/WhatsAppLog');
  require('../models/PackingConversion');
  require('../models/PackingConversionItem');
  require('../models/IntegrationConnection');
  require('../models/IntegrationLog');
  require('../models/IntegrationSyncJob');
  require('../models/IntegrationWebhook');
  require('../models/IntegrationFieldMapping');
  require('../models/IntegrationProduct');
  require('../models/IntegrationCustomer');
  require('../models/IntegrationOrder');
  require('../models/IntegrationCatalogue');

  const shouldAlter = false;
  await dropStaleSqliteBackupTables();
  await runSqliteSyncSafely({ alter: shouldAlter });
  console.log('Database models synchronized successfully.');

  // Safe table alterations helper
  const addColumnIfNotExist = async (tableName, columnName, columnDefSql) => {
    try {
      let columnNames = [];
      if (dialect === 'mysql') {
        const columns = await sequelize.query(`SHOW COLUMNS FROM ${tableName};`, { type: Sequelize.QueryTypes.SELECT });
        columnNames = columns.map(col => (col.Field || col.field || '').toLowerCase());
      } else {
        const tableInfo = await sequelize.query(`PRAGMA table_info(${tableName});`, { type: Sequelize.QueryTypes.SELECT });
        columnNames = tableInfo.map(col => (col.name || '').toLowerCase());
      }

      if (!columnNames.includes(columnName.toLowerCase())) {
        console.log(`Adding missing column ${columnName} to table ${tableName}...`);
        await sequelize.query(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefSql};`);
      }
    } catch (err) {
      console.error(`Error adding column ${columnName} to ${tableName}:`, err.message);
    }
  };

  // Run dynamic schema extensions
  await addColumnIfNotExist('Settings', 'email', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Settings', 'gstNumber', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Settings', 'websiteUrl', "VARCHAR(1000) DEFAULT ''");
  await addColumnIfNotExist('Settings', 'logoUrl', "VARCHAR(1000) DEFAULT ''");
  await addColumnIfNotExist('Settings', 'wooStoreDescription', "TEXT DEFAULT ''");
  await addColumnIfNotExist('Settings', 'wooVersion', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Settings', 'wooWordpressVersion', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Settings', 'wooApiStatus', "VARCHAR(255) DEFAULT 'Disconnected'");
  await addColumnIfNotExist('Settings', 'wooProductSyncMode', "VARCHAR(255) DEFAULT 'Two-Way Sync'");
  await addColumnIfNotExist('Settings', 'wooOrderSyncMode', "VARCHAR(255) DEFAULT 'Real-Time'");
  await addColumnIfNotExist('Settings', 'wooInventorySyncMode', "VARCHAR(255) DEFAULT 'Two-Way Sync'");
  await addColumnIfNotExist('Settings', 'wooCurrency', "VARCHAR(255) DEFAULT 'INR'");
  await addColumnIfNotExist('Settings', 'wooLastSyncTime', "DATETIME NULL");
  await addColumnIfNotExist('Settings', 'wooLastProductSyncTime', "DATETIME NULL");
  await addColumnIfNotExist('Settings', 'wooLastOrderSyncTime', "DATETIME NULL");
  await addColumnIfNotExist('Settings', 'wooLastCustomerSyncTime', "DATETIME NULL");
  await addColumnIfNotExist('Settings', 'wooLastInventorySyncTime', "DATETIME NULL");
  await addColumnIfNotExist('Settings', 'wooSyncStockERPToWoo', "TINYINT DEFAULT 1");
  await addColumnIfNotExist('Products', 'description', "TEXT DEFAULT ''");
  await addColumnIfNotExist('Products', 'woocommerce_product_id', "VARCHAR(255) NULL");
  await addColumnIfNotExist('Products', 'brand', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Products', 'galleryImages', "TEXT DEFAULT '[]'");
  await addColumnIfNotExist('Products', 'dimensions', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Products', 'stockStatus', "VARCHAR(255) DEFAULT 'instock'");
  await addColumnIfNotExist('Products', 'woocommerce_last_modified', "DATETIME NULL");
  await addColumnIfNotExist('Products', 'woocommerce_sync_status', "VARCHAR(255) DEFAULT 'synced'");
  await addColumnIfNotExist('Products', 'woocommerce_permalink', "VARCHAR(255) NULL");
  await addColumnIfNotExist('Products', 'shortDescription', "TEXT DEFAULT ''");
  await addColumnIfNotExist('Products', 'price', "DECIMAL(10, 2) DEFAULT 0");
  await addColumnIfNotExist('Products', 'salePrice', "DECIMAL(10, 2) DEFAULT 0");
  await addColumnIfNotExist('Products', 'status', "VARCHAR(255) DEFAULT 'publish'");
  await addColumnIfNotExist('Products', 'attributes', "TEXT DEFAULT ''");
  await addColumnIfNotExist('Products', 'tags', "TEXT DEFAULT ''");
  await addColumnIfNotExist('Products', 'gstClass', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Products', 'lastModifiedDate', "DATETIME NULL");
  await addColumnIfNotExist('Products', 'lastSyncTimestamp', "DATETIME NULL");
  await addColumnIfNotExist('Products', 'lastWooUpdateTimestamp', "DATETIME NULL");
  await addColumnIfNotExist('Products', 'isArchived', "TINYINT DEFAULT 0");
  await addColumnIfNotExist('RepackEntries', 'lossQty', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('StockMovements', 'batchNumber', "VARCHAR(255) NULL");
  await addColumnIfNotExist('StockMovements', 'expiryDate', "DATETIME NULL");
  await addColumnIfNotExist('ManufacturingEntries', 'packagingCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('ManufacturingEntries', 'overheadCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('InvoiceItems', 'freeQty', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('InvoiceItems', 'schemeApplied', "VARCHAR(255) NULL");
  await addColumnIfNotExist('ManufacturingEntries', 'batchNumber', "VARCHAR(255) NULL");
  await addColumnIfNotExist('ManufacturingEntries', 'expiryDate', "DATETIME NULL");
  await addColumnIfNotExist('RawMaterials', 'bagSize', "DECIMAL(10, 2) DEFAULT 1.00");
  await addColumnIfNotExist('Invoices', 'dueDate', "DATETIME NULL");
  await addColumnIfNotExist('Invoices', 'type', "VARCHAR(255) DEFAULT 'invoice'");
  await addColumnIfNotExist('Invoices', 'is_historical_data', "TINYINT DEFAULT 0");
  await addColumnIfNotExist('Orders', 'is_historical_data', "TINYINT DEFAULT 0");
  await addColumnIfNotExist('Settings', 'shippingZoneRates', "TEXT NULL");
  await addColumnIfNotExist('InvoiceItems', 'offerCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('InvoiceItems', 'actualProfit', "DECIMAL(10, 2) DEFAULT 0.00");

  // SFA Customer enhancements
  await addColumnIfNotExist('Customers', 'customerCode', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Customers', 'tier', "VARCHAR(50) DEFAULT 'RED'");
  await addColumnIfNotExist('Customers', 'latitude', "DECIMAL(10, 8) NULL");
  await addColumnIfNotExist('Customers', 'longitude', "DECIMAL(11, 8) NULL");
  await addColumnIfNotExist('Customers', 'territory', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Customers', 'routeZone', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Customers', 'assignedSalesmanId', "INTEGER NULL");
  await addColumnIfNotExist('Customers', 'leadId', "INTEGER NULL");
  await addColumnIfNotExist('Customers', 'lastVisitDate', "DATETIME NULL");
  await addColumnIfNotExist('Customers', 'lastOrderDate', "DATETIME NULL");

  // CRM Follow-up / Notes / Visits enhancements
  await addColumnIfNotExist('CrmFollowUps', 'leadId', "INTEGER NULL");
  await addColumnIfNotExist('CrmFollowUps', 'type', "VARCHAR(255) DEFAULT 'Call Customer'");
  await addColumnIfNotExist('CrmFollowUps', 'status', "VARCHAR(50) DEFAULT 'Pending'");
  await addColumnIfNotExist('CrmNotes', 'leadId', "INTEGER NULL");
  await addColumnIfNotExist('Visits', 'leadId', "INTEGER NULL");

  // SFA Product enhancements
  await addColumnIfNotExist('Products', 'mrp', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Products', 'greenPrice', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Products', 'yellowPrice', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Products', 'redPrice', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Products', 'ingredients', "TEXT NULL");
  await addColumnIfNotExist('Products', 'benefits', "TEXT NULL");

  // SFA Settings enhancements
  await addColumnIfNotExist('Settings', 'minOrderGreen', "DECIMAL(10, 2) DEFAULT 10000.00");
  await addColumnIfNotExist('Settings', 'minOrderYellow', "DECIMAL(10, 2) DEFAULT 5000.00");
  await addColumnIfNotExist('Settings', 'minOrderRed', "DECIMAL(10, 2) DEFAULT 2000.00");
  await addColumnIfNotExist('Settings', 'checkInRadius', "INTEGER DEFAULT 100");
  await addColumnIfNotExist('Settings', 'sameDayCutoffHour', "INTEGER DEFAULT 13");

  // Delivery Shipment enhancements
  await addColumnIfNotExist('Shipments', 'deliveryStaffId', "INTEGER NULL");
  await addColumnIfNotExist('Shipments', 'vehicleNumber', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Shipments', 'deliveryRoute', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Shipments', 'deliveryLatitude', "DECIMAL(10, 8) NULL");
  await addColumnIfNotExist('Shipments', 'deliveryLongitude', "DECIMAL(11, 8) NULL");
  await addColumnIfNotExist('Shipments', 'deliveryCommitment', "VARCHAR(50) DEFAULT 'Same Day'");
  await addColumnIfNotExist('Shipments', 'expectedArrivalTime', "DATETIME NULL");
  await addColumnIfNotExist('Shipments', 'deliverySequence', "INTEGER DEFAULT 0");
  
  // Internal logistics shipping costs columns
  await addColumnIfNotExist('Settings', 'packingCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Settings', 'handlingCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Settings', 'courierCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Settings', 'loadingCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Settings', 'mergeShippingCharges', "TINYINT DEFAULT 0");
  await addColumnIfNotExist('Settings', 'boxWeight', "DECIMAL(10, 3) DEFAULT 0.200");
  await addColumnIfNotExist('Settings', 'packingMaterialWeight', "DECIMAL(10, 3) DEFAULT 0.100");
  await addColumnIfNotExist('Settings', 'logisticsCharge', "DECIMAL(10, 2) DEFAULT 16.00");
  await addColumnIfNotExist('Settings', 'orderCounter', "INTEGER DEFAULT 0");
  await addColumnIfNotExist('Settings', 'paymentCounter', "INTEGER DEFAULT 0");
  await addColumnIfNotExist('Settings', 'upiId', "VARCHAR(255) DEFAULT '7010602115@iob'");
  await addColumnIfNotExist('Settings', 'payeeName', "VARCHAR(255) DEFAULT 'AMUDHASURABIY ORGANICS'");
  await addColumnIfNotExist('Users', 'tourCompleted', "TINYINT DEFAULT 0");

  await addColumnIfNotExist('Invoices', 'packingCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Invoices', 'handlingCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Invoices', 'courierCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Invoices', 'loadingCost', "DECIMAL(10, 2) DEFAULT 0.00");

  await addColumnIfNotExist('Products', 'parentProductId', "INTEGER NULL");
  await addColumnIfNotExist('Products', 'packSize', "VARCHAR(255) NULL");
  await addColumnIfNotExist('Products', 'conversionFactor', "DECIMAL(10, 4) DEFAULT 1.0000");
  await addColumnIfNotExist('Products', 'wholesalePrice', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('ManufacturingRecipes', 'variantProductId', "INTEGER NULL");
  await addColumnIfNotExist('ManufacturingRecipes', 'packSize', "VARCHAR(255) NULL");
  await addColumnIfNotExist('ManufacturingRecipes', 'yieldPacks', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('ManufacturingRecipes', 'packWeight', "DECIMAL(10, 3) DEFAULT 0.000");
  await addColumnIfNotExist('ManufacturingRecipes', 'wastagePercent', "DECIMAL(5, 2) DEFAULT 0.00");

  try {
    if (dialect === 'mysql') {
      console.log('Modifying Products.productType column to VARCHAR(255)...');
      await sequelize.query("ALTER TABLE Products MODIFY COLUMN productType VARCHAR(255) DEFAULT 'BULK_PRODUCT';");
      console.log('Modifying StockMovements.type column to VARCHAR(255)...');
      await sequelize.query("ALTER TABLE StockMovements MODIFY COLUMN type VARCHAR(255) NOT NULL;");
    }
  } catch (err) {
    console.error('Failed to alter column types for mysql:', err.message);
  }

  // Ensure Settings.logo column length is VARCHAR(1000) for URL support in MySQL/SQLite
  try {
    if (dialect === 'mysql') {
      console.log('Modifying Settings.logo column to VARCHAR(1000)...');
      await sequelize.query("ALTER TABLE Settings MODIFY COLUMN logo VARCHAR(1000) DEFAULT '';");
    }
  } catch (err) {
    console.error('Failed to alter Settings.logo column type:', err.message);
  }

  // One-time data correction/migration for existing products
  try {
    const Product = require('../models/Product');
    const products = await Product.findAll();
    let updatedCount = 0;
    for (const p of products) {
      if (!p.productType) {
        p.productType = p.supplier === 'repack' ? 'repacking' : 'manufactured';
        await p.save();
        updatedCount++;
      } else if (p.supplier === 'repack' && p.productType !== 'repacking') {
        p.productType = 'repacking';
        await p.save();
        updatedCount++;
      }
    }
    if (updatedCount > 0) {
      console.log(`✓ Database Data Migration: Corrected productType for ${updatedCount} products.`);
    } else {
      console.log('✓ Database Data Migration: All product types are correct.');
    }
  } catch (err) {
    console.error('Error correcting product types on startup:', err);
  }
};

connectDB.sequelize = sequelize;

module.exports = connectDB;
