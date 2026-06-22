const connectDB = require('./config/db');
const IntegrationExportCredential = require('./models/IntegrationExportCredential');
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Invoice = require('./models/Invoice');
const Payment = require('./models/Payment');
const IntegrationConnection = require('./models/IntegrationConnection');
const IntegrationSyncJob = require('./models/IntegrationSyncJob');
const IntegrationFieldMapping = require('./models/IntegrationFieldMapping');
const User = require('./models/User');

const externalController = require('./controllers/externalController');
const externalAuth = require('./middleware/externalAuth');
const universalApiService = require('./services/universalApiService');

async function testExternalApis() {
  console.log('=== STARTING EXTERNAL DEVS API & SECURE EXPORTS VERIFICATION ===');
  try {
    await connectDB();
    console.log('✅ Database connected.');

    // Prepare mock Super Admin user for session admin credentials CRUD
    let testAdmin = await User.findOne({ where: { role: 'Super Admin' } });
    if (!testAdmin) {
      testAdmin = await User.create({
        name: 'Dev Admin User',
        email: 'devadmin@marketplace-test.com',
        password: 'password123',
        role: 'Super Admin',
        status: 'Active'
      });
    }

    // Clear old credentials
    await IntegrationExportCredential.destroy({ where: { name: 'Automated Test Client' } });

    // ----------------------------------------------------
    // TEST 1: CREDENTIALS GENERATION & REGENERATION
    // ----------------------------------------------------
    console.log('\n--- 1. Testing Developer API Key Generation CRUD ---');
    let createRes = null;
    const reqCreate = {
      user: testAdmin,
      body: {
        name: 'Automated Test Client',
        allowedIps: '127.0.0.1, ::1',
        rateLimitCount: 5
      }
    };
    const resCreate = {
      status(code) {
        return this;
      },
      json(data) {
        createRes = data;
      }
    };

    await externalController.createExportCredential(reqCreate, resCreate, (err) => { if (err) throw err; });
    console.log('Create Key Response success:', createRes?.success);
    
    if (createRes && createRes.success && createRes.credential) {
      console.log('Generated Key prefix:', createRes.credential.apiKey.substring(0, 12));
      console.log('Generated Secret prefix:', createRes.credential.apiSecret.substring(0, 10));
      console.log('✅ Developer API Key created successfully.');
    } else {
      throw new Error('API Key creation failed!');
    }

    const credId = createRes.credential.id;
    const initialApiKey = createRes.credential.apiKey;

    // Test List export credentials
    let listRes = null;
    const reqList = { user: testAdmin };
    const resList = {
      json(data) {
        listRes = data;
      }
    };
    await externalController.listExportCredentials(reqList, resList, (err) => { if (err) throw err; });
    const matched = listRes?.credentials?.find(c => c.id === credId);
    if (matched) {
      console.log('✅ API key listed in admin dashboard successfully.');
    } else {
      throw new Error('Key not found in list response!');
    }

    // Test Key Regeneration
    let regenRes = null;
    const reqRegen = { user: testAdmin, params: { id: credId } };
    const resRegen = {
      json(data) {
        regenRes = data;
      }
    };
    await externalController.regenerateExportCredential(reqRegen, resRegen, (err) => { if (err) throw err; });
    console.log('Regenerated API Key:', regenRes?.credential?.apiKey?.substring(0, 12));
    
    if (regenRes?.success && regenRes.credential.apiKey !== initialApiKey) {
      console.log('✅ API Key and Webhook secret regenerated and rotated.');
    } else {
      throw new Error('API Key rotation failed!');
    }

    const rotatedApiKey = regenRes.credential.apiKey;

    // ----------------------------------------------------
    // TEST 2: AUTH MIDDLEWARE GATES (KEYS, IPS, RATE LIMITS)
    // ----------------------------------------------------
    console.log('\n--- 2. Testing Security Middleware Authentication & IP Filters ---');
    
    // Check Invalid Key
    let authError = null;
    const reqInvalid = { headers: { 'x-api-key': 'ao_live_invalid' } };
    const resInvalid = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        authError = data;
      }
    };
    await externalAuth(reqInvalid, resInvalid, () => {});
    console.log('Invalid key response:', authError);
    if (resInvalid.statusCode === 401) {
      console.log('✅ Invalid Key rejected with 401.');
    } else {
      throw new Error('Failed to block invalid key!');
    }

    // Check Whitelisted IP address
    let ipAllowed = false;
    const reqValidIp = {
      headers: { 'x-api-key': rotatedApiKey, 'x-forwarded-for': '127.0.0.1' },
      socket: {}
    };
    const resValidIp = {
      status(code) {
        return this;
      },
      json(data) {
        throw new Error('Should not return json on allowed request! Info: ' + JSON.stringify(data));
      }
    };
    await externalAuth(reqValidIp, resValidIp, () => {
      ipAllowed = true;
    });
    if (ipAllowed) {
      console.log('✅ Whitelisted IP allowed access.');
    } else {
      throw new Error('Whitelisted IP blocked!');
    }

    // Check Blocked IP address
    let blockedResponse = null;
    const reqBlockedIp = {
      headers: { 'x-api-key': rotatedApiKey, 'x-forwarded-for': '198.51.100.42' },
      socket: {}
    };
    const resBlockedIp = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        blockedResponse = data;
      }
    };
    await externalAuth(reqBlockedIp, resBlockedIp, () => {
      throw new Error('Should not call next middleware on blocked IP!');
    });
    console.log('Blocked IP response:', blockedResponse);
    if (resBlockedIp.statusCode === 403) {
      console.log('✅ Blocked IP correctly rejected with 403.');
    } else {
      throw new Error('Access from unwhitelisted IP allowed!');
    }

    // Check Rate Limiting (Limit configured to 5)
    console.log('Testing rate limit requests limit...');
    let triggerRateLimit = false;
    for (let i = 0; i < 10; i++) {
      let isNextCalled = false;
      const reqRate = {
        headers: { 'x-api-key': rotatedApiKey, 'x-forwarded-for': '127.0.0.1' },
        socket: {}
      };
      const resRate = {
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          if (this.statusCode === 429) {
            triggerRateLimit = true;
          }
        }
      };
      await externalAuth(reqRate, resRate, () => {
        isNextCalled = true;
      });
      if (triggerRateLimit) {
        console.log(`Rate limit correctly triggered on request #${i + 1}`);
        break;
      }
    }
    if (triggerRateLimit) {
      console.log('✅ In-memory Tenant-level Rate limiter verified.');
    } else {
      throw new Error('Rate limit was not enforced!');
    }

    // ----------------------------------------------------
    // TEST 3: OUTSTANDING LEDGER CALCULATOR FORMAT
    // ----------------------------------------------------
    console.log('\n--- 3. Testing Outstanding Ledger Calculations & JSON Layout ---');
    
    // Clear old test customer ledger
    const testCustName = 'Narpavi Honey';
    await Invoice.destroy({ where: { invoiceNumber: ['INV-TEST-01', 'INV-TEST-02'] } });
    await Payment.destroy({ where: { paymentNumber: 'PAY-TEST-01' } });
    await Customer.destroy({ where: { name: testCustName } });
    
    const mockCustomer = await Customer.create({
      name: testCustName,
      phone: '917010602115',
      email: 'narpavi@honey.com',
      tenantId: 1
    });

    const mockInvoice1 = await Invoice.create({
      invoiceNumber: 'INV-TEST-01',
      customerId: mockCustomer.id,
      grandTotal: 5000,
      total: 5000,
      tenantId: 1
    });
    const mockInvoice2 = await Invoice.create({
      invoiceNumber: 'INV-TEST-02',
      customerId: mockCustomer.id,
      grandTotal: 3650,
      total: 3650,
      tenantId: 1
    });

    const mockPayment = await Payment.create({
      paymentNumber: 'PAY-TEST-01',
      customerId: mockCustomer.id,
      amount: 2650,
      date: new Date('2026-06-22'),
      tenantId: 1
    });

    let ledgerResult = null;
    const reqLedger = {
      tenantId: 1,
      query: { customer: '917010602115' }
    };
    const resLedger = {
      json(data) {
        ledgerResult = data;
      }
    };

    await externalController.getOutstanding(reqLedger, resLedger, (err) => { if (err) throw err; });
    console.log('Outstanding Calculation Output Payload:', JSON.stringify(ledgerResult, null, 2));

    if (
      ledgerResult &&
      ledgerResult.customer === 'Narpavi Honey' &&
      ledgerResult.totalSales === 8650 &&
      ledgerResult.receivedAmount === 2650 &&
      ledgerResult.pendingAmount === 6000 &&
      ledgerResult.lastPaymentDate === '2026-06-22'
    ) {
      console.log('✅ Outstanding ledger calculations and JSON formatting verified successfully.');
    } else {
      throw new Error('Outstanding ledger values or JSON schema structure is incorrect!');
    }

    // ----------------------------------------------------
    // TEST 4: BIDIRECTIONAL SYNC & CONFLICT RESOLUTION
    // ----------------------------------------------------
    console.log('\n--- 4. Testing Bidirectional Sync & Conflict Strategies ---');

    await IntegrationConnection.destroy({ where: { name: 'Test Sync Connection' } });
    const mockConnection = await IntegrationConnection.create({
      name: 'Test Sync Connection',
      platformType: 'Custom REST API',
      baseUrl: 'http://localhost:5000',
      syncDirection: 'Bidirectional',
      conflictStrategy: 'ERP',
      tenantId: 1
    });

    // Create a mock job
    const mockJob = await IntegrationSyncJob.create({
      connectionId: mockConnection.id,
      entityType: 'Product',
      status: 'Pending',
      triggerType: 'Manual',
      tenantId: 1
    });

    // Test a mock axios client get response
    const mockClient = {
      get: async (path) => {
        return {
          status: 200,
          data: [
            { id: 'ext-99', name: 'External Product', sku: 'SKU-SYNC-TEST', price: 150, stock: 10 }
          ]
        };
      },
      post: async (path, data) => {
        return { status: 201, data: { id: 'ext-' + Math.floor(Math.random() * 1000), ...data } };
      },
      put: async (path, data) => {
        return { status: 200, data: { id: path.split('/').pop(), ...data } };
      }
    };

    const mockMappings = [
      { entityType: 'Product', internalField: 'name', externalField: 'name' },
      { entityType: 'Product', internalField: 'sku', externalField: 'sku' },
      { entityType: 'Product', internalField: 'price', externalField: 'price' },
      { entityType: 'Product', internalField: 'stock', externalField: 'stock' }
    ];

    // Delete existing product
    await Product.destroy({ where: { sku: 'SKU-SYNC-TEST' } });

    // 1. Initial Import (Record doesn't exist locally, so it must import successfully)
    let syncRes = await universalApiService.syncData(mockConnection, 'Product', 1, mockClient, mockMappings, mockJob);
    console.log('First Import Sync Result:', syncRes);

    const importedProd = await Product.findOne({ where: { sku: 'SKU-SYNC-TEST' } });
    if (importedProd && importedProd.price === 150) {
      console.log('✅ Initial import product created in database.');
    } else {
      throw new Error('Initial import failed!');
    }

    // Modify local record to test conflict strategy 'ERP'
    importedProd.price = 200;
    importedProd.updatedAt = new Date(Date.now() + 10000); // set newer local timestamp
    await importedProd.save();

    // Re-run sync mapping. The external API still returns price 150.
    // Since conflictStrategy is 'ERP' (Local Wins), local should remain 200.
    const secondJob = await IntegrationSyncJob.create({
      connectionId: mockConnection.id,
      entityType: 'Product',
      status: 'Pending',
      triggerType: 'Manual',
      tenantId: 1
    });
    
    let syncRes2 = await universalApiService.syncData(mockConnection, 'Product', 1, mockClient, mockMappings, secondJob);
    console.log('Second Sync (Local ERP Wins check):', syncRes2);

    const recheckProd = await Product.findOne({ where: { sku: 'SKU-SYNC-TEST' } });
    if (recheckProd && recheckProd.price === 200) {
      console.log('✅ Conflict Strategy "ERP" verified: Local version was preserved.');
    } else {
      throw new Error('Conflict Strategy ERP failed: Local changes overwritten by external sync!');
    }

    // Clean up test data
    await IntegrationExportCredential.destroy({ where: { id: credId } });
    await Invoice.destroy({ where: { customerId: mockCustomer.id } });
    await Payment.destroy({ where: { customerId: mockCustomer.id } });
    await Customer.destroy({ where: { id: mockCustomer.id } });
    await IntegrationConnection.destroy({ where: { id: mockConnection.id } });
    await IntegrationSyncJob.destroy({ where: { connectionId: mockConnection.id } });
    await Product.destroy({ where: { sku: 'SKU-SYNC-TEST' } });

    console.log('\n🎉 ALL SECURITY AND SECURE DEVELOPER API TESTS PASSED SUCCESSFULLY!');
    process.exit(0);

  } catch (err) {
    console.error('\n❌ VERIFICATION TEST FAILED:', err.message);
    console.error(err);
    process.exit(1);
  }
}

testExternalApis();
