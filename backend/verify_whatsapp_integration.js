const connectDB = require('./config/db');
const whatsappController = require('./controllers/whatsappController');
const whatsappService = require('./services/whatsappService');
const WhatsAppSettings = require('./models/WhatsAppSettings');
const WhatsAppLog = require('./models/WhatsAppLog');
const Customer = require('./models/Customer');
const User = require('./models/User');
const fs = require('fs');
const path = require('path');

async function testWhatsAppIntegration() {
  console.log('--- START WHATSAPP INTEGRATION TEST ---');
  try {
    // 1. Connect to Database
    await connectDB();
    console.log('✅ Database connected.');

    // 2. Clear old test settings and logs
    await WhatsAppSettings.destroy({ truncate: true });
    await WhatsAppLog.destroy({ where: {} });
    await Customer.destroy({ where: { email: 'test-wa@customer.com' } });
    console.log('✅ Cleaned up old test database rows.');

    // 3. Test Encryption & Settings At-Rest Protection
    console.log('\n--- Testing Encryption System ---');
    const secretKey = 'super-secret-key-123';
    const encryptedKey = whatsappService.encrypt(secretKey);
    const decryptedKey = whatsappService.decrypt(encryptedKey);

    console.log('Original API Key:', secretKey);
    console.log('Encrypted API Key:', encryptedKey);
    console.log('Decrypted API Key:', decryptedKey);

    if (decryptedKey === secretKey) {
      console.log('✅ AES-256-CBC Encryption & Decryption verified.');
    } else {
      throw new Error('Encryption verification failed!');
    }

    // 4. Test Controller Settings Actions (Super Admin check)
    console.log('\n--- Testing Settings Controller Actions ---');
    let testSuperAdmin = await User.findOne({ where: { role: 'Super Admin' } });
    if (!testSuperAdmin) {
      testSuperAdmin = await User.create({
        name: 'Super Admin User',
        email: 'superadmin@wa-test.com',
        password: 'password123',
        role: 'Super Admin',
        status: 'Active'
      });
      console.log('Created mock Super Admin user.');
    }

    let testStaff = await User.findOne({ where: { role: 'staff' } });
    if (!testStaff) {
      testStaff = await User.create({
        name: 'Staff User',
        email: 'staff@wa-test.com',
        password: 'password123',
        role: 'staff',
        status: 'Active'
      });
      console.log('Created mock staff user.');
    }

    // Update settings as Super Admin
    const updateBody = {
      provider: 'WAHA',
      apiUrl: 'http://localhost:3000',
      apiKey: 'test-token-key-abc',
      instanceId: 'test-session-xyz',
      webhookUrl: 'http://localhost:5000/api/whatsapp/webhook'
    };

    let updateRes = null;
    const reqUpdate = { user: testSuperAdmin, body: updateBody };
    const resUpdate = {
      json(data) {
        updateRes = data;
      }
    };
    await whatsappController.updateSettings(reqUpdate, resUpdate, (err) => { if (err) throw err; });
    console.log('Update Settings Result:', updateRes);

    if (updateRes && updateRes.success) {
      console.log('✅ Settings saved successfully.');
    } else {
      throw new Error('Update settings failed');
    }

    // Read settings as Super Admin (should return decrypted values)
    let getAdminRes = null;
    const reqGetAdmin = { user: testSuperAdmin };
    const resGetAdmin = {
      json(data) {
        getAdminRes = data;
      }
    };
    await whatsappController.getSettings(reqGetAdmin, resGetAdmin, (err) => { if (err) throw err; });
    console.log('Get Settings (Super Admin):', getAdminRes.settings);
    if (getAdminRes.settings.apiKey === 'test-token-key-abc' && getAdminRes.settings.instanceId === 'test-session-xyz') {
      console.log('✅ Super Admin can view decrypted keys.');
    } else {
      throw new Error('Super Admin decryption failed');
    }

    // Read settings as Staff (should return masked values)
    let getStaffRes = null;
    const reqGetStaff = { user: testStaff };
    const resGetStaff = {
      json(data) {
        getStaffRes = data;
      }
    };
    await whatsappController.getSettings(reqGetStaff, resGetStaff, (err) => { if (err) throw err; });
    console.log('Get Settings (Staff):', getStaffRes.settings);
    if (getStaffRes.settings.apiKey === '********' && getStaffRes.settings.instanceId === '********') {
      console.log('✅ Non-Super Admin users receive masked keys.');
    } else {
      throw new Error('Staff masking check failed');
    }

    // 5. Test Connection Test Endpoint
    console.log('\n--- Testing Connection Diagnostics Connection check ---');
    let testConnRes = null;
    const reqTestConn = { user: testSuperAdmin };
    const resTestConn = {
      json(data) {
        testConnRes = data;
      }
    };
    await whatsappController.testConnection(reqTestConn, resTestConn, (err) => { if (err) throw err; });
    console.log('Test Connection Response:', testConnRes);
    if (testConnRes && testConnRes.success) {
      console.log('✅ Connection verification executed successfully.');
    } else {
      throw new Error('Connection diagnostics failed');
    }

    // 6. Test Logging and Stats Center API
    console.log('\n--- Testing Logs & Statistics compilation ---');
    const mockCustomer = await Customer.create({
      name: 'Test WA Customer',
      businessName: 'WA Organic Store',
      phone: '919876543210',
      email: 'test-wa@customer.com',
      status: 'Active',
      balance: 1000.00
    });

    await WhatsAppLog.create({
      customerId: mockCustomer.id,
      customerName: mockCustomer.name,
      mobile: mockCustomer.phone,
      messageType: 'Invoice',
      messageText: 'Testing invoice message dispatch',
      status: 'Sent'
    });

    await WhatsAppLog.create({
      customerId: mockCustomer.id,
      customerName: mockCustomer.name,
      mobile: mockCustomer.phone,
      messageType: 'Payment Reminder',
      messageText: 'Testing reminder notification text',
      status: 'Delivered'
    });

    await WhatsAppLog.create({
      customerId: mockCustomer.id,
      customerName: mockCustomer.name,
      mobile: mockCustomer.phone,
      messageType: 'Outstanding Recovery',
      messageText: 'Testing outstanding statement PDF text',
      status: 'Failed',
      error: 'Session not active'
    });

    console.log('✅ Simulated mock log records in database.');

    // Fetch Stats
    let statsRes = null;
    const reqStats = {};
    const resStats = {
      json(data) {
        statsRes = data;
      }
    };
    await whatsappController.getStats(reqStats, resStats, (err) => { if (err) throw err; });
    console.log('Stats Response:', statsRes.stats);
    console.log('7-Day Activity Chart:', statsRes.activityChart);

    if (statsRes && statsRes.success && statsRes.stats.sentToday === 3) {
      console.log('✅ Statistics calculated correctly.');
    } else {
      throw new Error('Statistics compilation failed');
    }

    // Fetch Logs
    let logsRes = null;
    const reqLogs = { query: { page: 1, limit: 10, search: 'Test WA' } };
    const resLogs = {
      json(data) {
        logsRes = data;
      }
    };
    await whatsappController.getLogs(reqLogs, resLogs, (err) => { if (err) throw err; });
    console.log(`Retrieved ${logsRes.logs.length} filtered logs.`);
    if (logsRes && logsRes.success && logsRes.total === 3) {
      console.log('✅ Logs query and search filters completed successfully.');
    } else {
      throw new Error('Logs querying failed');
    }

    // 7. Webhook status receiver test
    console.log('\n--- Testing Webhook ack receiver ---');
    let webhookRes = null;
    const mockWahaWebhookBody = {
      event: 'message.ack',
      payload: {
        id: 'waha-msg-id-12345',
        ack: 3, // Read status
        to: '919876543210'
      }
    };

    const reqWebhook = { body: mockWahaWebhookBody };
    const resWebhook = {
      json(data) {
        webhookRes = data;
      }
    };
    await whatsappController.webhookReceiver(reqWebhook, resWebhook, (err) => { if (err) throw err; });
    console.log('Webhook Response:', webhookRes);
    if (webhookRes && webhookRes.success) {
      console.log('✅ Webhook processor run finished.');
    } else {
      throw new Error('Webhook processing failed');
    }

    // Cleanup mock details
    console.log('\n--- Cleaning up test records ---');
    await Customer.destroy({ where: { id: mockCustomer.id } });
    await WhatsAppLog.destroy({ where: {} });
    console.log('✅ Mock integration test records cleaned.');

    console.log('\n--- ALL WHATSAPP INTEGRATION TESTS PASSED SUCCESSFULLY! ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

testWhatsAppIntegration();
