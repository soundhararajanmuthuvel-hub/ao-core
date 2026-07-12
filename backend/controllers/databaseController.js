const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { sequelize } = require('../config/db');

// Models
const User = require('../models/User');
const Settings = require('../models/Settings');
const ActivityLog = require('../models/ActivityLog');

// Counts of current records
exports.getCounts = async (req, res) => {
  try {
    const Customer = require('../models/Customer');
    const Product = require('../models/Product');
    const Order = require('../models/Order');
    const Invoice = require('../models/Invoice');
    const Payment = require('../models/Payment');
    const ManufacturingEntry = require('../models/ManufacturingEntry');
    const RepackEntry = require('../models/RepackEntry');
    const RawMaterial = require('../models/RawMaterial');
    const Lead = require('../models/Lead');
    const Visit = require('../models/Visit');

    const customerCount = await Customer.count();
    const productCount = await Product.count();
    const orderCount = await Order.count();
    const invoiceCount = await Invoice.count();
    const paymentCount = await Payment.count();
    const manufacturingCount = await ManufacturingEntry.count();
    const repackCount = await RepackEntry.count();
    const rawMaterialCount = await RawMaterial.count();
    const leadCount = await Lead.count();
    const visitCount = await Visit.count();

    res.json({
      success: true,
      counts: {
        customers: customerCount,
        products: productCount,
        orders: orderCount,
        invoices: invoiceCount,
        payments: paymentCount,
        productionEntries: manufacturingCount + repackCount,
        rawMaterials: rawMaterialCount,
        leads: leadCount,
        visits: visitCount,
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve database counts', error: err.message });
  }
};

// Password validation
exports.verifyPassword = async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }
  try {
    const user = await User.scope('withPassword').findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid admin password' });
    }
    res.json({ success: true, message: 'Password verified successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Password verification failed', error: err.message });
  }
};

// Helper: Run ZIP/JSON database backup
const performBackup = async (adminName) => {
  const backupsDir = path.join(__dirname, '..', 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
  const cleanedAdminName = adminName.replace(/[^a-zA-Z0-9]/g, '_');
  const backupBaseName = `backup_${timestamp}_${cleanedAdminName}`;
  const zipFilePath = path.join(backupsDir, `${backupBaseName}.zip`);

  const zip = new AdmZip();

  // 1. Copy SQLite database file (if running SQLite)
  let sqliteFileCopied = false;
  if (sequelize.options.dialect === 'sqlite') {
    const sqlitePath = sequelize.options.storage || path.join(__dirname, '..', 'database.sqlite');
    if (fs.existsSync(sqlitePath)) {
      const tempSqlitePath = path.join(backupsDir, `temp_db_${timestamp}.sqlite`);
      fs.copyFileSync(sqlitePath, tempSqlitePath);
      zip.addLocalFile(tempSqlitePath, '', 'database.sqlite');
      sqliteFileCopied = true;
      // Asynchronously delete temp file to avoid locking
      setTimeout(() => {
        try { if (fs.existsSync(tempSqlitePath)) fs.unlinkSync(tempSqlitePath); } catch {}
      }, 2000);
    }
  }

  // 2. Fetch and package JSON table values
  const dbData = {};
  for (const modelName of Object.keys(sequelize.models)) {
    const model = sequelize.models[modelName];
    dbData[modelName] = await model.findAll({ raw: true });
  }
  zip.addFile('database_backup.json', Buffer.from(JSON.stringify(dbData, null, 2), 'utf-8'));

  // 3. Write output ZIP
  zip.writeZip(zipFilePath);

  return {
    zipFilePath,
    backupFileName: `${backupBaseName}.zip`,
    timestamp,
    sqliteFileCopied
  };
};

// Manual Backup Trigger endpoint
exports.backupDatabase = async (req, res) => {
  try {
    const adminName = req.user?.name || 'Super Admin';
    const backup = await performBackup(adminName);

    // Record audit log
    await ActivityLog.create({
      action: 'Backup Database',
      module: 'Database Management',
      details: `Manual backup created: ${backup.backupFileName} by ${req.user.name} from IP ${req.ip}`,
      metadata: {
        ip: req.ip,
        adminName: req.user.name,
        adminEmail: req.user.email,
        backupFile: backup.backupFileName,
        timestamp: new Date()
      },
      userId: req.user.id
    });

    res.download(backup.zipFilePath, backup.backupFileName);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to create database backup', error: err.message });
  }
};

// Reset Demo Data: Wipes sample customer, products, and order entities; keeps user and company profile
exports.resetDemoData = async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  try {
    const user = await User.scope('withPassword').findByPk(req.user.id);
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ success: false, message: 'Invalid admin password' });
    }

    const adminName = req.user?.name || 'Super Admin';
    const backup = await performBackup(adminName);

    const demoModelsToWipe = [
      'Customer', 'Product', 'ProductPackSize', 'Order', 'Invoice', 'InvoiceItem', 
      'Payment', 'Shipment', 'StockMovement', 'RawMaterial', 'RawMaterialMovement', 
      'Supplier', 'ManufacturingEntry', 'ManufacturingEntryMaterial', 'RepackEntry', 
      'RepackEntryMaterial', 'Purchase', 'PurchaseItem', 'StockLoss', 'CrmFollowUp', 
      'CrmNote', 'CrmOpportunity', 'Lead', 'Visit', 'SalesmanLocation', 'CustomerReview', 
      'AiSuggestion', 'ReminderHistory', 'Route', 'Courier', 'ManufacturingRecipe', 
      'ManufacturingRecipeMaterial', 'RepackRecipe', 'RepackRecipeMaterial', 
      'MigrationHistory', 'MigrationDetailLog', 'SyncLog', 'Notification'
    ];

    if (sequelize.options.dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = OFF;');
    } else if (sequelize.options.dialect === 'mysql') {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    }

    try {
      for (const modelName of demoModelsToWipe) {
        if (sequelize.models[modelName]) {
          await sequelize.models[modelName].destroy({ where: {}, force: true });
        }
      }
    } finally {
      if (sequelize.options.dialect === 'sqlite') {
        await sequelize.query('PRAGMA foreign_keys = ON;');
      } else if (sequelize.options.dialect === 'mysql') {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
      }
    }

    // Record audit log
    await ActivityLog.create({
      action: 'Reset Demo Data',
      module: 'Database Management',
      details: `Reset Demo Data executed. Auto-backup file saved: ${backup.backupFileName} by ${req.user.name} from IP ${req.ip}`,
      metadata: {
        ip: req.ip,
        adminName: req.user.name,
        adminEmail: req.user.email,
        backupFile: backup.backupFileName,
        timestamp: new Date()
      },
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Demo data reset successfully completed.',
      backupFileName: backup.backupFileName
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to reset demo data', error: err.message });
  }
};

// Clear Transactions: Wipes sales orders, invoices, payments, production entries, shipments, etc. Keeps customer, product, user masters.
exports.clearTransactions = async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  try {
    const user = await User.scope('withPassword').findByPk(req.user.id);
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ success: false, message: 'Invalid admin password' });
    }

    const adminName = req.user?.name || 'Super Admin';
    const backup = await performBackup(adminName);

    const transactionModelsToWipe = [
      'Order', 'Invoice', 'InvoiceItem', 'Payment', 'Shipment', 'StockMovement',
      'RawMaterialMovement', 'ManufacturingEntry', 'ManufacturingEntryMaterial',
      'RepackEntry', 'RepackEntryMaterial', 'Purchase', 'PurchaseItem', 'StockLoss'
    ];

    if (sequelize.options.dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = OFF;');
    } else if (sequelize.options.dialect === 'mysql') {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    }

    try {
      for (const modelName of transactionModelsToWipe) {
        if (sequelize.models[modelName]) {
          await sequelize.models[modelName].destroy({ where: {}, force: true });
        }
      }
    } finally {
      if (sequelize.options.dialect === 'sqlite') {
        await sequelize.query('PRAGMA foreign_keys = ON;');
      } else if (sequelize.options.dialect === 'mysql') {
        await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
      }
    }

    // Record audit log
    await ActivityLog.create({
      action: 'Clear Transactions',
      module: 'Database Management',
      details: `Clear Transactions executed. Auto-backup file saved: ${backup.backupFileName} by ${req.user.name} from IP ${req.ip}`,
      metadata: {
        ip: req.ip,
        adminName: req.user.name,
        adminEmail: req.user.email,
        backupFile: backup.backupFileName,
        timestamp: new Date()
      },
      userId: req.user.id
    });

    res.json({
      success: true,
      message: 'Transactions cleared successfully.',
      backupFileName: backup.backupFileName
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to clear transactions', error: err.message });
  }
};

// Factory Reset: Wipes everything, runs full sequelize schema drops, and re-seeds default settings and default role users.
exports.factoryReset = async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  try {
    const user = await User.scope('withPassword').findByPk(req.user.id);
    if (!user || !(await user.comparePassword(password))) {
      return res.status(400).json({ success: false, message: 'Invalid admin password' });
    }

    const adminName = req.user?.name || 'Super Admin';
    const backup = await performBackup(adminName);

    // Disable foreign key checks for dropping tables
    if (sequelize.options.dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = OFF;');
    } else if (sequelize.options.dialect === 'mysql') {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    }

    // Dropping and recreating tables
    await sequelize.sync({ force: true });

    if (sequelize.options.dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON;');
    } else if (sequelize.options.dialect === 'mysql') {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    }

    // Re-seed default settings
    await Settings.create({
      companyName: 'AO Core Organic Products',
      logo: '/uploads/default-logo.png',
      address: '123 Wellness Way, Green Valley',
      phone: '+91 9876543210',
      gstDetails: '29AAAAA1111A1Z1',
      invoicePrefix: 'AO',
      financialYear: '2026-27',
      brandColor: '#ff9800',
      defaultDarkMode: false,
      lowStockThreshold: 10,
      invoiceCounter: 5,
      purchaseCounter: 0,
    });

    // Re-seed default Users
    const defaultUsers = [
      { name: 'Super Admin', email: 'admin@aocore.com', password: 'Admin@123', role: 'Super Admin', isActive: true },
      { name: 'Developer', email: 'developer@aocore.com', password: 'Developer@123', role: 'Super Admin', isActive: true },
      { name: 'Manufacturing Manager', email: 'mfg@aocore.com', password: 'Mfg@123', role: 'Manufacturing Manager', isActive: true },
      { name: 'Billing Executive', email: 'billing@aocore.com', password: 'Billing@123', role: 'Billing Executive', isActive: true },
      { name: 'Store Keeper', email: 'store@aocore.com', password: 'Store@123', role: 'Store Keeper', isActive: true },
      { name: 'Dispatch Executive', email: 'dispatch@aocore.com', password: 'Dispatch@123', role: 'Dispatch Executive', isActive: true },
      { name: 'Sales Executive', email: 'sales@aocore.com', password: 'Sales@123', role: 'Sales Executive', isActive: true },
    ];

    let seededAdminId = 1;
    for (const u of defaultUsers) {
      const newUser = await User.create(u);
      if (u.role === 'Super Admin') {
        seededAdminId = newUser.id;
      }
    }

    // Re-require ActivityLog since sequelize sync wiped context and re-register
    const NewActivityLog = require('../models/ActivityLog');
    await NewActivityLog.create({
      action: 'Factory Reset',
      module: 'Database Management',
      details: `Factory Reset executed. Auto-backup file saved: ${backup.backupFileName} by ${req.user.name} from IP ${req.ip}. ERP returned to first-install state.`,
      metadata: {
        ip: req.ip,
        adminName: req.user.name,
        adminEmail: req.user.email,
        backupFile: backup.backupFileName,
        timestamp: new Date()
      },
      userId: seededAdminId
    });

    res.json({
      success: true,
      message: 'Factory reset successfully completed. ERP returned to first-install state.',
      backupFileName: backup.backupFileName
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to perform factory reset', error: err.message });
  }
};
