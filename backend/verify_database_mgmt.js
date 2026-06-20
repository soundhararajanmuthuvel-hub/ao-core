const connectDB = require('./config/db');
const databaseController = require('./controllers/databaseController');
const fs = require('fs');
const path = require('path');

// Models
const User = require('./models/User');
const Settings = require('./models/Settings');
const Customer = require('./models/Customer');
const Product = require('./models/Product');
const Invoice = require('./models/Invoice');
const Payment = require('./models/Payment');
const ActivityLog = require('./models/ActivityLog');

const mockResponse = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  res.download = (filePath, name) => {
    res.downloadPath = filePath;
    res.downloadName = name;
    return res;
  };
  return res;
};

async function runTests() {
  console.log('=== START DATABASE MANAGEMENT TEST ===');
  try {
    await connectDB();
    console.log('✅ Database connected.');

    // 1. Setup a test Super Admin
    const email = 'superadmin-test@aocore.com';
    const password = 'Password@123';
    let admin = await User.scope('withPassword').findOne({ where: { email } });
    if (!admin) {
      admin = await User.create({
        name: 'Test Super Admin',
        email,
        password,
        role: 'Super Admin',
        isActive: true
      });
      console.log('✅ Mock Super Admin created.');
    }

    // 2. Test verifyPassword
    console.log('Testing: verifyPassword');
    const reqVerifyFail = { user: admin, body: { password: 'WrongPassword' } };
    const resVerifyFail = mockResponse();
    await databaseController.verifyPassword(reqVerifyFail, resVerifyFail);
    if (resVerifyFail.statusCode === 400 && resVerifyFail.body.success === false) {
      console.log('  ✅ Wrong password check passed.');
    } else {
      throw new Error(`Wrong password check failed: code ${resVerifyFail.statusCode}, body ${JSON.stringify(resVerifyFail.body)}`);
    }

    const reqVerifySuccess = { user: admin, body: { password } };
    const resVerifySuccess = mockResponse();
    await databaseController.verifyPassword(reqVerifySuccess, resVerifySuccess);
    if (resVerifySuccess.statusCode === 200 && resVerifySuccess.body.success === true) {
      console.log('  ✅ Correct password check passed.');
    } else {
      throw new Error(`Correct password check failed: code ${resVerifySuccess.statusCode}, body ${JSON.stringify(resVerifySuccess.body)}`);
    }

    // Helper to seed sample data for testing resets
    const seedData = async () => {
      await Invoice.destroy({ where: { invoiceNumber: 'INV-TST-101' } });
      await Payment.destroy({ where: { paymentNumber: 'PAY-TST-101' } });
      await Customer.destroy({ where: { email: 'cust@test.com' } });
      await Product.destroy({ where: { sku: 'TST-PROD' } });

      const cust = await Customer.create({ name: 'Test Customer', email: 'cust@test.com', status: 'Active' });
      await Product.create({ name: 'Test Product', sku: 'TST-PROD', sellingPrice: 50 });
      await Invoice.create({ invoiceNumber: 'INV-TST-101', customerId: cust.id, subtotal: 100, grandTotal: 100, status: 'Confirmed' });
      await Payment.create({ paymentNumber: 'PAY-TST-101', customerId: cust.id, amount: 100, status: 'Success' });
    };

    // 3. Test counts
    console.log('Testing: getCounts');
    await seedData();
    const reqCounts = {};
    const resCounts = mockResponse();
    await databaseController.getCounts(reqCounts, resCounts);
    if (resCounts.body.success && resCounts.body.counts.customers > 0) {
      console.log('  ✅ getCounts returned correct counts:', JSON.stringify(resCounts.body.counts));
    } else {
      throw new Error(`getCounts failed: ${JSON.stringify(resCounts.body)}`);
    }

    // 4. Test Backup Database download
    console.log('Testing: backupDatabase');
    const reqBackup = { user: admin, ip: '127.0.0.1' };
    const resBackup = mockResponse();
    await databaseController.backupDatabase(reqBackup, resBackup);
    if (resBackup.downloadPath && fs.existsSync(resBackup.downloadPath)) {
      console.log(`  ✅ backupDatabase created backup at ${resBackup.downloadPath}`);
    } else {
      throw new Error(`backupDatabase failed: no file downloaded`);
    }

    // 5. Test Clear Transactions (Invoices, payments are wiped; customers, products kept)
    console.log('Testing: clearTransactions');
    const reqClear = { user: admin, body: { password }, ip: '127.0.0.1' };
    const resClear = mockResponse();
    await databaseController.clearTransactions(reqClear, resClear);
    
    const remainingCustomers = await Customer.count();
    const remainingProducts = await Product.count();
    const remainingInvoices = await Invoice.count();
    const remainingPayments = await Payment.count();

    if (remainingCustomers > 0 && remainingProducts > 0 && remainingInvoices === 0 && remainingPayments === 0) {
      console.log('  ✅ clearTransactions successfully wiped transactions and kept master records.');
      console.log(`  ✅ Auto-backup saved: ${resClear.body.backupFileName}`);
    } else {
      console.log('  Response status:', resClear.statusCode);
      console.log('  Response body:', JSON.stringify(resClear.body));
      throw new Error(`clearTransactions check failed: Cust:${remainingCustomers}, Prod:${remainingProducts}, Inv:${remainingInvoices}, Pay:${remainingPayments}`);
    }

    // 6. Test Reset Demo Data (Customers, products, invoices wiped; users kept)
    console.log('Testing: resetDemoData');
    await seedData(); // reseed
    const reqResetDemo = { user: admin, body: { password }, ip: '127.0.0.1' };
    const resResetDemo = mockResponse();
    await databaseController.resetDemoData(reqResetDemo, resResetDemo);

    const resetCustomers = await Customer.count();
    const resetProducts = await Product.count();
    const resetUsers = await User.count();

    if (resetCustomers === 0 && resetProducts === 0 && resetUsers > 0) {
      console.log('  ✅ resetDemoData successfully wiped customer and product data but kept user credentials.');
      console.log(`  ✅ Auto-backup saved: ${resResetDemo.body.backupFileName}`);
    } else {
      throw new Error(`resetDemoData check failed: Cust:${resetCustomers}, Prod:${resetProducts}, Users:${resetUsers}`);
    }

    // 7. Test Factory Reset (Everything dropped, default configs re-seeded)
    console.log('Testing: factoryReset');
    const reqFactory = { user: admin, body: { password }, ip: '127.0.0.1' };
    const resFactory = mockResponse();
    await databaseController.factoryReset(reqFactory, resFactory);

    // Re-verify default user exists
    const defaultAdmin = await User.scope('withPassword').findOne({ where: { email: 'admin@aocore.com' } });
    const isDefaultAdminMatch = defaultAdmin && (await defaultAdmin.comparePassword('Admin@123'));
    const seededSettings = await Settings.findOne();
    const customerCountAfterFactory = await Customer.count();

    if (isDefaultAdminMatch && seededSettings && seededSettings.companyName === 'AO Core Organic Products' && customerCountAfterFactory === 0) {
      console.log('  ✅ factoryReset successfully dropped all schemas, re-seeded default users, and restored settings.');
      console.log(`  ✅ Auto-backup saved: ${resFactory.body.backupFileName}`);
      
      // Verify audit log exists
      const logs = await ActivityLog.findAll();
      if (logs.length > 0 && logs[0].action === 'Factory Reset') {
        console.log('  ✅ factoryReset activity/audit logging validated.');
      } else {
        throw new Error('factoryReset activity logging failed to write new log.');
      }
    } else {
      throw new Error(`factoryReset validation check failed. seededSettings:${!!seededSettings}, defaultAdminFound:${!!defaultAdmin}, customersRemaining:${customerCountAfterFactory}`);
    }

    console.log('\n⭐ ALL AUTOMATED VERIFICATION CHECKS COMPLETED SUCCESSFULLY! ⭐');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database Reset System test failed:', err);
    process.exit(1);
  }
}

runTests();
