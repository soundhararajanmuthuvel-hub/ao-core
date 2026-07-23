const { Sequelize } = require('sequelize');
const path = require('path');

let dialect = process.env.DB_DIALECT || 'sqlite';
const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
  dialect = 'postgres';
} else if (process.env.MYSQLHOST || process.env.DATABASE_URL || process.env.MYSQL_URL) {
  dialect = 'mysql';
}

const getSequelizeLoggingOptions = () => {
  return {
    benchmark: true,
    logging: (msg, timingMs) => {
      if (process.env.NODE_ENV === 'development' && msg.includes('EXECUTE')) {
        console.log(`[Sequelize] ${msg} (${timingMs}ms)`);
      }
      try {
        const { profileStorage } = require('../middleware/profileMiddleware');
        const context = profileStorage.getStore();
        if (context) {
          context.queryTimeMs += timingMs || 0;
          context.queriesCount += 1;
        }
      } catch (_) {}
    }
  };
};

let sequelize;

if (dialect === 'postgres') {
  console.log('Using Postgres/Supabase database connection URL...');
  sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    ...getSequelizeLoggingOptions(),
    define: {
      timestamps: true,
    },
  });
} else if (process.env.DATABASE_URL || process.env.MYSQL_URL) {
  console.log('Using MySQL database connection URL...');
  sequelize = new Sequelize(process.env.DATABASE_URL || process.env.MYSQL_URL, {
    dialect: 'mysql',
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    ...getSequelizeLoggingOptions(),
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
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000,
      },
      ...getSequelizeLoggingOptions(),
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
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    ...getSequelizeLoggingOptions(),
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

const tableNameMap = {
  User: 'users',
  Customer: 'customers',
  Supplier: 'suppliers',
  Product: 'products',
  Settings: 'settings',
  SyncLog: 'sync_logs',
  ActivityLog: 'activity_logs',
  Notification: 'notifications',
  StockMovement: 'stock_movements',
  Invoice: 'invoices',
  InvoiceItem: 'invoice_items',
  Purchase: 'purchases',
  PurchaseItem: 'purchase_items',
  RepackRecipe: 'repack_recipes',
  RepackRecipeMaterial: 'repack_recipe_materials',
  RepackEntry: 'repack_entries',
  RepackEntryMaterial: 'repack_entry_materials',
  RawMaterial: 'raw_materials',
  RawMaterialMovement: 'raw_material_movements',
  ManufacturingRecipe: 'manufacturing_recipes',
  ManufacturingRecipeMaterial: 'manufacturing_recipe_materials',
  ManufacturingEntry: 'manufacturing_entries',
  ManufacturingEntryMaterial: 'manufacturing_entry_materials',
  Shipment: 'shipments',
  ProductPackSize: 'product_pack_sizes',
  Courier: 'couriers',
  StockLoss: 'stock_losses',
  Order: 'orders',
  Payment: 'payments',
  MigrationHistory: 'migration_histories',
  MigrationDetailLog: 'migration_detail_logs',
  CrmNote: 'crm_notes',
  CrmFollowUp: 'crm_follow_ups',
  ReminderHistory: 'reminder_histories',
  Route: 'routes',
  Visit: 'visits',
  SalesmanLocation: 'salesman_locations',
  CustomerReview: 'customer_reviews',
  Lead: 'leads',
  CrmOpportunity: 'crm_opportunities',
  AiSuggestion: 'ai_suggestions',
  WhatsAppSettings: 'whatsapp_settings',
  WhatsAppLog: 'whatsapp_logs',
  PackingConversion: 'packing_conversions',
  PackingConversionItem: 'packing_conversion_items',
  SalesTarget: 'sales_targets',
  WebsiteApiKey: 'website_api_keys',
  WebsiteProduct: 'website_products',
  WebsiteCustomer: 'website_customers',
  WebsiteAddress: 'website_addresses',
  WebsiteWishlist: 'website_wishlists',
  WebsiteCart: 'website_carts',
  WebsiteOrder: 'website_orders',
  WebsiteTestimonial: 'website_testimonials',
  WebsiteProductReview: 'website_product_reviews',
  WebsiteReferral: 'website_referrals',
  WebsiteShippingRule: 'website_shipping_rules',
  WebsiteCoupon: 'website_coupons',
  WebsiteEvent: 'website_events'
};

// Global hook to enforce lowercase table names mapping to prevent Linux/MySQL case sensitivity issues
sequelize.addHook('afterDefine', (model) => {
  const mappedName = tableNameMap[model.name];
  if (mappedName) {
    model.tableName = mappedName;
  }
});

const runSqliteSyncSafely = async (syncOptions) => {
  if (dialect === 'mysql') {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    try {
      return await sequelize.sync(syncOptions);
    } finally {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    }
  }

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

const renameTablesToLowercaseIfMySql = async (sequelizeInstance) => {
  if (dialect !== 'mysql') {
    return;
  }
  try {
    const dbName = sequelizeInstance.config.database;
    console.log('Detecting and dropping legacy capitalized foreign key constraints (Linux compatibility)...');
    
    await sequelizeInstance.query('SET FOREIGN_KEY_CHECKS = 0;');
    try {
      // Find all constraints referencing mixed-case legacy table names or belonging to mixed-case tables
      const [legacyFks] = await sequelizeInstance.query(`
        SELECT TABLE_NAME, CONSTRAINT_NAME 
        FROM information_schema.KEY_COLUMN_USAGE 
        WHERE TABLE_SCHEMA = '${dbName}' 
          AND REFERENCED_TABLE_NAME IS NOT NULL 
          AND (REFERENCED_TABLE_NAME != LOWER(REFERENCED_TABLE_NAME) OR TABLE_NAME != LOWER(TABLE_NAME));
      `);
      
      for (const fk of legacyFks) {
        const tName = fk.TABLE_NAME || fk.table_name;
        const fkName = fk.CONSTRAINT_NAME || fk.constraint_name;
        if (tName && fkName) {
          console.log(`Dropping legacy foreign key constraint ${fkName} on ${tName}...`);
          try {
            await sequelizeInstance.query(`ALTER TABLE \`${tName}\` DROP FOREIGN KEY \`${fkName}\`;`);
          } catch (dropErr) {
            console.error(`Failed to drop constraint ${fkName} on table ${tName}:`, dropErr.message);
          }
        }
      }
      
      console.log('Checking for mixed-case tables to rename to lowercase...');
      const [tables] = await sequelizeInstance.query('SHOW TABLES;');
      
      for (const row of tables) {
        const tableName = Object.values(row)[0];
        if (tableName && tableName !== tableName.toLowerCase()) {
          const lowerTableName = tableName.toLowerCase();
          console.log(`Renaming table ${tableName} to ${lowerTableName}...`);
          await sequelizeInstance.query(`RENAME TABLE \`${tableName}\` TO \`${lowerTableName}\`;`);
        }
      }
    } finally {
      await sequelizeInstance.query('SET FOREIGN_KEY_CHECKS = 1;');
    }
    console.log('✓ Table renaming and constraint migrations completed.');
  } catch (err) {
    console.error('Failed to migrate tables and constraints:', err.message);
  }
};

const connectDB = async () => {
  let retries = 5;
  while (retries > 0) {
    try {
      await sequelize.authenticate();
      break;
    } catch (err) {
      retries--;
      console.error(`Database connection failed. Retries remaining: ${retries}. Error: ${err.message}`);
      if (retries === 0) {
        throw err;
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  console.log(`${dialect === 'mysql' ? 'MySQL' : 'SQLite'} connected successfully via Sequelize.`);
  
  await renameTablesToLowercaseIfMySql(sequelize);
  
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
  require('../models/SalesTarget');
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
  require('../models/IntegrationExportCredential');
  require('../models/WebhookEndpoint');
  require('../models/WebhookLog');
  require('../models/ApiAuditLog');
  require('../models/WebsiteApiKey');
  require('../models/WebsiteProduct');
  require('../models/WebsiteCustomer');
  require('../models/WebsiteAddress');
  require('../models/WebsiteWishlist');
  require('../models/WebsiteCart');
  require('../models/WebsiteOrder');
  require('../models/WebsiteTestimonial');
  require('../models/WebsiteProductReview');
  require('../models/WebsiteReferral');
  require('../models/WebsiteShippingRule');
  require('../models/WebsiteCoupon');
  require('../models/WebsiteEvent');

  const shouldAlter = false;
  await dropStaleSqliteBackupTables();
  await runSqliteSyncSafely({ alter: shouldAlter });
  console.log('Database models synchronized successfully.');

  // Register API Gateway Webhook Hooks
  try {
    const { registerWebhookHooks } = require('../services/webhookService');
    registerWebhookHooks();
  } catch (webhookHooksErr) {
    console.error('Failed to register webhook hooks:', webhookHooksErr.message);
  }

  // Pre-fetch table columns cache to avoid redundant, slow database queries per column
  const tableColumnsCache = {};
  try {
    if (dialect === 'mysql') {
      const dbName = sequelize.config.database;
      const columns = await sequelize.query(
        `SELECT TABLE_NAME, COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = :dbName`,
        {
          replacements: { dbName },
          type: Sequelize.QueryTypes.SELECT
        }
      );
      for (const col of columns) {
        const tName = (col.TABLE_NAME || '').toLowerCase();
        if (!tableColumnsCache[tName]) tableColumnsCache[tName] = [];
        tableColumnsCache[tName].push((col.COLUMN_NAME || '').toLowerCase());
      }
    } else {
      const tables = await sequelize.query(
        "SELECT name FROM sqlite_master WHERE type='table';",
        { type: Sequelize.QueryTypes.SELECT }
      );
      await Promise.all(tables.map(async ({ name }) => {
        const tName = name.toLowerCase();
        const tableInfo = await sequelize.query(`PRAGMA table_info(${name});`, { type: Sequelize.QueryTypes.SELECT });
        tableColumnsCache[tName] = tableInfo.map(col => (col.name || '').toLowerCase());
      }));
    }
  } catch (cacheErr) {
    console.error('Failed to pre-fetch table columns cache:', cacheErr.message);
  }

  // Safe table alterations helper using memory-cached layout
  const addColumnIfNotExist = async (tableName, columnName, columnDefSql) => {
    const resolvedTableName = (tableNameMap[tableName] || tableNameMap[tableName.replace(/s$/, '')] || tableName).toLowerCase();
    const existingColumns = tableColumnsCache[resolvedTableName] || [];

    if (!existingColumns.includes(columnName.toLowerCase())) {
      try {
        console.log(`Adding missing column ${columnName} to table ${resolvedTableName}...`);
        await sequelize.query(`ALTER TABLE ${resolvedTableName} ADD COLUMN ${columnName} ${columnDefSql};`);
        existingColumns.push(columnName.toLowerCase());
      } catch (err) {
        console.error(`Error adding column ${columnName} to ${resolvedTableName}:`, err.message);
      }
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
  await addColumnIfNotExist('Users', 'mustChangePassword', "TINYINT DEFAULT 0");
  await addColumnIfNotExist('integration_connections', 'syncDirection', "VARCHAR(50) DEFAULT 'Import'");
  await addColumnIfNotExist('integration_connections', 'conflictStrategy', "VARCHAR(50) DEFAULT 'Latest'");
  await addColumnIfNotExist('integration_connections', 'rateLimitCount', "INTEGER DEFAULT 60");
  await addColumnIfNotExist('integration_connections', 'allowedIps', "VARCHAR(1000) NULL");
  
  // Developer credentials v2 enhancements
  await addColumnIfNotExist('integration_export_credentials', 'description', "VARCHAR(1000) NULL");
  await addColumnIfNotExist('integration_export_credentials', 'environment', "VARCHAR(50) DEFAULT 'Live'");
  await addColumnIfNotExist('integration_export_credentials', 'permissions', "TEXT NULL");
  await addColumnIfNotExist('integration_export_credentials', 'createdBy', "VARCHAR(255) NULL");
  await addColumnIfNotExist('integration_export_credentials', 'lastUsed', "DATETIME NULL");
  await addColumnIfNotExist('integration_export_credentials', 'webhookSecret', "VARCHAR(255) NULL");

  // WhatsApp settings & log enhancements
  await addColumnIfNotExist('WhatsAppSettings', 'crmBaseUrl', "VARCHAR(1000) DEFAULT ''");
  await addColumnIfNotExist('WhatsAppSettings', 'crmApiKey', "VARCHAR(1000) DEFAULT ''");
  await addColumnIfNotExist('WhatsAppSettings', 'crmSecret', "VARCHAR(1000) DEFAULT ''");
  await addColumnIfNotExist('WhatsAppLogs', 'invoice', "VARCHAR(255) NULL");
  await addColumnIfNotExist('WhatsAppLogs', 'catalogue', "VARCHAR(255) NULL");
  await addColumnIfNotExist('WhatsAppLogs', 'response', "TEXT NULL");

  await addColumnIfNotExist('Invoices', 'packingCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Invoices', 'handlingCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Invoices', 'courierCost', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Invoices', 'loadingCost', "DECIMAL(10, 2) DEFAULT 0.00");

  // Indian GST Enhancements
  await addColumnIfNotExist('Invoices', 'invoiceType', "VARCHAR(50) DEFAULT 'NON_GST'");
  await addColumnIfNotExist('Invoices', 'gstMode', "VARCHAR(50) DEFAULT 'None'");
  await addColumnIfNotExist('Invoices', 'sellerGSTIN', "VARCHAR(255) NULL");
  await addColumnIfNotExist('Invoices', 'customerGSTIN', "VARCHAR(255) NULL");
  await addColumnIfNotExist('Invoices', 'placeOfSupply', "VARCHAR(255) NULL");
  await addColumnIfNotExist('Invoices', 'gstApplicable', "TINYINT DEFAULT 0");
  await addColumnIfNotExist('Invoices', 'isGSTReportable', "TINYINT DEFAULT 0");
  await addColumnIfNotExist('Invoices', 'isGSTPortalExported', "TINYINT DEFAULT 0");
  await addColumnIfNotExist('Invoices', 'exportedAt', "DATETIME NULL");
  await addColumnIfNotExist('Invoices', 'hsnSummary', "TEXT NULL");
  await addColumnIfNotExist('Invoices', 'taxableAmount', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Invoices', 'cgstAmount', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Invoices', 'sgstAmount', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Invoices', 'igstAmount', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Invoices', 'totalGST', "DECIMAL(10, 2) DEFAULT 0.00");

  await addColumnIfNotExist('Settings', 'pan', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Settings', 'stateCode', "VARCHAR(255) DEFAULT ''");
  await addColumnIfNotExist('Settings', 'bankDetails', "TEXT NULL");
  await addColumnIfNotExist('Settings', 'paperSize', "VARCHAR(255) DEFAULT 'A4'");

  await addColumnIfNotExist('Products', 'parentProductId', "INTEGER NULL");
  await addColumnIfNotExist('Products', 'packSize', "VARCHAR(255) NULL");
  await addColumnIfNotExist('Products', 'conversionFactor', "DECIMAL(10, 4) DEFAULT 1.0000");
  await addColumnIfNotExist('Products', 'wholesalePrice', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('Products', 'publishToWebsite', "TINYINT DEFAULT 0");
  await addColumnIfNotExist('WebsiteProduct', 'managementProductId', "INTEGER NULL");
  await addColumnIfNotExist('ManufacturingRecipes', 'variantProductId', "INTEGER NULL");
  await addColumnIfNotExist('ManufacturingRecipes', 'packSize', "VARCHAR(255) NULL");
  await addColumnIfNotExist('ManufacturingRecipes', 'yieldPacks', "DECIMAL(10, 2) DEFAULT 0.00");
  await addColumnIfNotExist('ManufacturingRecipes', 'packWeight', "DECIMAL(10, 3) DEFAULT 0.000");
  await addColumnIfNotExist('ManufacturingRecipes', 'wastagePercent', "DECIMAL(5, 2) DEFAULT 0.00");

  try {
    if (dialect === 'mysql') {
      console.log('Modifying Products.productType column to VARCHAR(255)...');
      await sequelize.query("ALTER TABLE products MODIFY COLUMN productType VARCHAR(255) DEFAULT 'BULK_PRODUCT';");
      console.log('Modifying StockMovements.type column to VARCHAR(255)...');
      await sequelize.query("ALTER TABLE stock_movements MODIFY COLUMN type VARCHAR(255) NOT NULL;");
    }
  } catch (err) {
    console.error('Failed to alter column types for mysql:', err.message);
  }

  // Ensure Settings.logo column length is VARCHAR(1000) for URL support in MySQL/SQLite
  try {
    if (dialect === 'mysql') {
      console.log('Modifying Settings.logo column to VARCHAR(1000)...');
      await sequelize.query("ALTER TABLE settings MODIFY COLUMN logo VARCHAR(1000) DEFAULT '';");
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

  // Create missing SQL indexes to optimize search and aggregate query execution speeds
  try {
    const createIndexIfNotExist = async (indexName, tableName, columnsArray) => {
      const resolvedTableName = (tableNameMap[tableName] || tableNameMap[tableName.replace(/s$/, '')] || tableName).toLowerCase();
      if (dialect === 'mysql') {
        const existingIndex = await sequelize.query(
          `SHOW INDEX FROM ${resolvedTableName} WHERE Key_name = :indexName`,
          {
            replacements: { indexName },
            type: Sequelize.QueryTypes.SELECT
          }
        );
        if (existingIndex.length === 0) {
          console.log(`Creating index ${indexName} on ${resolvedTableName}...`);
          await sequelize.query(`CREATE INDEX ${indexName} ON ${resolvedTableName} (${columnsArray.join(', ')});`);
        }
      } else {
        const existingIndexes = await sequelize.query(`PRAGMA index_list(${resolvedTableName});`, {
          type: Sequelize.QueryTypes.SELECT
        });
        const hasIndex = existingIndexes.some(idx => idx.name === indexName);
        if (!hasIndex) {
          console.log(`Creating index ${indexName} on ${resolvedTableName}...`);
          await sequelize.query(`CREATE INDEX ${indexName} ON ${resolvedTableName} (${columnsArray.join(', ')});`);
        }
      }
    };

    await createIndexIfNotExist('idx_products_name', 'Product', ['name']);
    await createIndexIfNotExist('idx_products_sku', 'Product', ['sku']);
    await createIndexIfNotExist('idx_customers_name', 'Customer', ['name']);
    await createIndexIfNotExist('idx_customers_phone', 'Customer', ['phone']);
    await createIndexIfNotExist('idx_customers_gstNumber', 'Customer', ['gstNumber']);
    await createIndexIfNotExist('idx_invoices_date', 'Invoice', ['date']);
    await createIndexIfNotExist('idx_invoices_customerId', 'Invoice', ['customerId']);
    await createIndexIfNotExist('idx_invoice_items_invoiceId', 'InvoiceItem', ['invoiceId']);
    await createIndexIfNotExist('idx_invoice_items_productId', 'InvoiceItem', ['productId']);
    await createIndexIfNotExist('idx_stock_movements_productId', 'StockMovement', ['productId']);
    await createIndexIfNotExist('idx_raw_materials_name', 'RawMaterial', ['name']);
    await createIndexIfNotExist('idx_raw_materials_materialCode', 'RawMaterial', ['materialCode']);
    await createIndexIfNotExist('idx_purchase_items_productId', 'PurchaseItem', ['productId']);
  } catch (indexErr) {
    console.error('Failed to ensure database indexes:', indexErr.message);
  }

  // Auto-seed basic admin and developer roles if they don't exist
  try {
    const User = require('../models/User');
    const usersToSeed = [
      { name: 'Super Admin', email: 'admin@aocore.com', password: 'Admin@123', role: 'Super Admin' },
      { name: 'Developer', email: 'developer@aocore.com', password: 'Developer@123', role: 'Super Admin' }
    ];
    for (const u of usersToSeed) {
      const existing = await User.findOne({ where: { email: u.email } });
      if (!existing) {
        await User.create({
          name: u.name,
          email: u.email,
          password: u.password,
          role: u.role,
          isActive: true
        });
        console.log(`✓ Auto-Seeded User on startup: ${u.email}`);
      }
    }
  } catch (err) {
    console.error('Failed to auto-seed default users:', err.message);
  }
};

connectDB.sequelize = sequelize;

module.exports = connectDB;
