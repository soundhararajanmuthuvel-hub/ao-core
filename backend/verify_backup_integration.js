const connectDB = require('./config/db');
const { sequelize } = require('./config/db');
const migrationController = require('./controllers/migrationController');
const fs = require('fs');
const path = require('path');

// Models
const User = require('./models/User');
const Settings = require('./models/Settings');
const Customer = require('./models/Customer');
const Product = require('./models/Product');
const Invoice = require('./models/Invoice');
const InvoiceItem = require('./models/InvoiceItem');
const Payment = require('./models/Payment');
const RawMaterial = require('./models/RawMaterial');

const mockResponse = () => {
  const res = {};
  res.statusCode = 200;
  res.headers = {};
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  res.send = (data) => {
    res.body = data;
    return res;
  };
  res.setHeader = (name, val) => {
    res.headers[name] = val;
    return res;
  };
  return res;
};

async function runTests() {
  console.log('=== START BACKUP & RESTORE INTEGRATION TEST ===');
  const tempZipPath = path.join(__dirname, 'temp_backup_test.zip');
  
  try {
    await connectDB();
    console.log('✅ Database connected.');

    // 1. Setup mock pre-export database state
    // Clear everything first to have a clean slate
    const dialect = sequelize.getDialect();
    if (dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = OFF;');
    } else {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    }
    for (const modelName of Object.keys(sequelize.models)) {
      await sequelize.models[modelName].destroy({ where: {}, force: true });
    }
    if (dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON;');
    } else {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    }
    console.log('✅ Clean database slate initialized.');

    // Create Settings
    const initialSettings = await Settings.create({
      companyName: 'Integrate Corp',
      address: 'Test Blvd 123',
      invoicePrefix: 'INT',
      brandColor: '#123456'
    });

    // Create Admin User (the one performing the restore)
    const adminUser = await User.create({
      name: 'Active Super Admin',
      email: 'activeadmin@aocore.com',
      password: 'SecurePassword123',
      role: 'Super Admin',
      isActive: true
    });

    // Create Custom Test User (should be exported & restored)
    const customUser = await User.create({
      name: 'Custom Team Member',
      email: 'teammember@aocore.com',
      password: 'TeamPassword123',
      role: 'Billing Executive',
      isActive: true
    });

    // Create Customer
    const customer = await Customer.create({
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: '9999999999',
      status: 'Active'
    });

    // Create Product
    const product = await Product.create({
      name: 'Organic Honey',
      sku: 'ORG-HNY',
      sellingPrice: 15.50,
      stock: 100
    });

    // Create Raw Material
    const rawMat = await RawMaterial.create({
      name: 'Raw Wax',
      sku: 'RAW-WX',
      materialCode: 'RAW-WX-101',
      category: 'Wax',
      stock: 50,
      unit: 'kg'
    });

    // Create Invoice & InvoiceItem
    const invoice = await Invoice.create({
      invoiceNumber: 'INT-001',
      customerId: customer.id,
      subtotal: 15.50,
      grandTotal: 15.50,
      status: 'Confirmed'
    });

    await InvoiceItem.create({
      invoiceId: invoice.id,
      productId: product.id,
      qty: 1,
      unitPrice: 15.50,
      lineTotal: 15.50
    });

    // Create Payment
    await Payment.create({
      paymentNumber: 'PAY-INT-001',
      customerId: customer.id,
      amount: 15.50,
      paymentMethod: 'Cash',
      status: 'Success'
    });

    console.log('✅ Pre-export seed data populated.');

    // Capture pre-export states for verification
    const preUsers = await User.findAll({ raw: true, order: [['id', 'ASC']] });
    const preSettings = await Settings.findAll({ raw: true });
    const preCustomers = await Customer.findAll({ raw: true });
    const preProducts = await Product.findAll({ raw: true });
    const preRawMaterials = await RawMaterial.findAll({ raw: true });
    const preInvoices = await Invoice.findAll({ raw: true });
    const preInvoiceItems = await InvoiceItem.findAll({ raw: true });
    const prePayments = await Payment.findAll({ raw: true });

    // 2. Execute /migration/export
    console.log('Executing backup export...');
    const reqExport = {};
    const resExport = mockResponse();
    await migrationController.exportBackup(reqExport, resExport);

    if (resExport.statusCode === 200 && Buffer.isBuffer(resExport.body)) {
      console.log('  ✅ Export completed successfully. Writing buffer to temporary zip file...');
      fs.writeFileSync(tempZipPath, resExport.body);
    } else {
      throw new Error(`Export failed. Code: ${resExport.statusCode}, Body: ${resExport.body}`);
    }

    // 3. Wipe database completely
    console.log('Wiping database tables...');
    if (dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = OFF;');
    } else {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    }
    for (const modelName of Object.keys(sequelize.models)) {
      await sequelize.models[modelName].destroy({ where: {}, force: true });
    }
    if (dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON;');
    } else {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
    }

    // Crucial step: Recreate the admin user to simulate active logged in session doing the restore
    const activeAdminBeforeRestore = await User.create({
      id: adminUser.id,
      name: 'Active Super Admin',
      email: 'activeadmin@aocore.com',
      password: 'SecurePassword123',
      role: 'Super Admin',
      isActive: true
    });
    console.log('  ✅ Database wiped. Re-created current logged in admin user to simulate active restore session.');

    // Verify database is indeed wiped of other elements
    const emptyCustomers = await Customer.count();
    const emptyProducts = await Product.count();
    if (emptyCustomers !== 0 || emptyProducts !== 0) {
      throw new Error(`Database wipe failed. Customers: ${emptyCustomers}, Products: ${emptyProducts}`);
    }
    console.log('  ✅ Verified database is clean.');

    // 4. Execute /migration/restore
    console.log('Executing backup restore...');
    const reqRestore = {
      file: { path: tempZipPath },
      user: activeAdminBeforeRestore
    };
    const resRestore = mockResponse();
    await migrationController.restoreBackup(reqRestore, resRestore);

    if (resRestore.statusCode === 200 && resRestore.body.success) {
      console.log('  ✅ Restore completed successfully.');
    } else {
      throw new Error(`Restore failed. Code: ${resRestore.statusCode}, Body: ${JSON.stringify(resRestore.body)}`);
    }

    // 5. Query and Assert Row-for-Row equality
    console.log('Verifying data integrity...');

    const postUsers = await User.findAll({ raw: true, order: [['id', 'ASC']] });
    const postSettings = await Settings.findAll({ raw: true });
    const postCustomers = await Customer.findAll({ raw: true });
    const postProducts = await Product.findAll({ raw: true });
    const postRawMaterials = await RawMaterial.findAll({ raw: true });
    const postInvoices = await Invoice.findAll({ raw: true });
    const postInvoiceItems = await InvoiceItem.findAll({ raw: true });
    const postPayments = await Payment.findAll({ raw: true });

    // Assertions
    const assertEqual = (actual, expected, description) => {
      if (actual !== expected) {
        throw new Error(`Assertion failed: ${description}. Got ${actual}, expected ${expected}`);
      }
      console.log(`  ✅ Assert: ${description} (Count: ${actual})`);
    };

    assertEqual(postUsers.length, preUsers.length, 'User records count');
    assertEqual(postSettings.length, preSettings.length, 'Settings records count');
    assertEqual(postCustomers.length, preCustomers.length, 'Customer records count');
    assertEqual(postProducts.length, preProducts.length, 'Product records count');
    assertEqual(postRawMaterials.length, preRawMaterials.length, 'RawMaterial records count');
    assertEqual(postInvoices.length, preInvoices.length, 'Invoice records count');
    assertEqual(postInvoiceItems.length, preInvoiceItems.length, 'InvoiceItem records count');
    assertEqual(postPayments.length, prePayments.length, 'Payment records count');

    // Check specific fields of interest
    const recoveredSettings = postSettings[0];
    if (recoveredSettings.companyName !== 'Integrate Corp' || recoveredSettings.brandColor !== '#123456') {
      throw new Error(`Settings mismatch post restore: ${JSON.stringify(recoveredSettings)}`);
    }
    console.log('  ✅ Settings data details match.');

    const recoveredCustomUser = postUsers.find(u => u.email === 'teammember@aocore.com');
    if (!recoveredCustomUser || recoveredCustomUser.name !== 'Custom Team Member') {
      throw new Error(`Custom team member user was not restored correctly: ${JSON.stringify(recoveredCustomUser)}`);
    }
    console.log('  ✅ Custom user details match.');

    const recoveredAdminUser = postUsers.find(u => u.email === 'activeadmin@aocore.com');
    if (!recoveredAdminUser || recoveredAdminUser.name !== 'Active Super Admin') {
      throw new Error(`Active admin session user safeguard failed: ${JSON.stringify(recoveredAdminUser)}`);
    }
    console.log('  ✅ Safeguard admin user details match.');

    console.log('\n⭐ ALL BACKUP/RESTORE INTEGRATION CHECKS PASSED SUCCESSFULLY! ⭐');

    // Cleanup temporary files
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
    process.exit(0);

  } catch (err) {
    console.error('❌ Integration test failed:', err);
    if (fs.existsSync(tempZipPath)) {
      fs.unlinkSync(tempZipPath);
    }
    process.exit(1);
  }
}

runTests();
