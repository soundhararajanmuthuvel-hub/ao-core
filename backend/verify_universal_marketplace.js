const connectDB = require('./config/db');
const { encryptCredential, decryptCredential } = require('./utils/encryption');
const IntegrationConnection = require('./models/IntegrationConnection');
const IntegrationFieldMapping = require('./models/IntegrationFieldMapping');
const IntegrationLog = require('./models/IntegrationLog');
const IntegrationSyncJob = require('./models/IntegrationSyncJob');
const IntegrationWebhook = require('./models/IntegrationWebhook');
const integrationController = require('./controllers/integrationController');
const User = require('./models/User');

async function testUniversalMarketplace() {
  console.log('=== STARTING UNIVERSAL MARKETPLACE VERIFICATION TEST ===');
  try {
    // 1. Connect database
    await connectDB();
    console.log('✅ Database connection synced successfully.');

    // 2. Test Encryption & Decryption
    console.log('\n--- 1. Testing Credential Encryption/Decryption ---');
    const secretText = 'ck_1234abcd5678efgh9012ijkl3456';
    const encrypted = encryptCredential(secretText);
    const decrypted = decryptCredential(encrypted);

    console.log('Plain secret token:', secretText);
    console.log('Encrypted secret token:', encrypted);
    console.log('Decrypted secret token:', decrypted);

    if (decrypted === secretText) {
      console.log('✅ AES-256-CBC Encryption & Decryption verified.');
    } else {
      throw new Error('Encryption validation failed! Decrypted token does not match original.');
    }

    // 3. Clear old test data
    await IntegrationConnection.destroy({ where: { name: 'Test WooCommerce Store' } });
    await IntegrationConnection.destroy({ where: { name: 'Test Shopify Store' } });
    console.log('✅ Cleaned up old test database connections.');

    // 4. Test Controller Actions: Create connection
    console.log('\n--- 2. Testing Connection Creation Controller ---');
    let testSuperAdmin = await User.findOne({ where: { role: 'Super Admin' } });
    if (!testSuperAdmin) {
      testSuperAdmin = await User.create({
        name: 'Super Admin User',
        email: 'superadmin@marketplace-test.com',
        password: 'password123',
        role: 'Super Admin',
        status: 'Active'
      });
      console.log('Created mock Super Admin user.');
    }

    const connectionData = {
      name: 'Test Shopify Store',
      platformType: 'Shopify',
      baseUrl: 'https://myshopifytest.myshopify.com/api',
      apiKey: 'shp_api_test_key_123',
      apiSecret: 'shp_secret_key_abc',
      bearerToken: 'token_val_xyz',
      syncFrequency: 'Daily',
      notes: 'Mock integration for automated test validation'
    };

    let createRes = null;
    const reqCreate = { user: testSuperAdmin, body: connectionData };
    const resCreate = {
      status(code) {
        return this;
      },
      json(data) {
        createRes = data;
      }
    };
    await integrationController.createConnection(reqCreate, resCreate, (err) => { if (err) throw err; });
    console.log('Create Connection Response success:', createRes?.success);
    console.log('Created connection details:', createRes?.connection);

    if (createRes && createRes.success) {
      console.log('✅ Connection registered successfully.');
    } else {
      throw new Error('Create connection controller action failed!');
    }

    const createdId = createRes.connection.id;

    // 5. Test Controller Actions: Get connections
    console.log('\n--- 3. Testing Connections Listing (Credential Protection check) ---');
    let getRes = null;
    const reqGet = { user: testSuperAdmin };
    const resGet = {
      json(data) {
        getRes = data;
      }
    };
    await integrationController.getConnections(reqGet, resGet, (err) => { if (err) throw err; });
    console.log('Get Connections list size:', getRes?.connections?.length);
    
    const matched = getRes?.connections?.find(c => c.id === createdId);
    if (matched) {
      console.log('Connection Name:', matched.name);
      console.log('Connection apiKey (masked):', matched.apiKey);
      console.log('Connection apiSecret (masked):', matched.apiSecret);
      console.log('Connection bearerToken (masked):', matched.bearerToken);
      
      if (matched.apiKey === '********' && matched.apiSecret === '********') {
        console.log('✅ Masking check verified: Decrypted credentials are never exposed in list APIs.');
      } else {
        throw new Error('Masking check failed! Raw or decrypted credentials exposed in connection lists.');
      }
    } else {
      throw new Error('Could not find created connection in listing!');
    }

    // 6. Test Controller Actions: Field Mapping Matrix
    console.log('\n--- 4. Testing Mappings Save/Retrieve ---');
    const mappingBody = {
      connectionId: createdId,
      mappings: [
        { entityType: 'Product', internalField: 'sku', externalField: 'variants[0].sku' },
        { entityType: 'Product', internalField: 'name', externalField: 'title' },
        { entityType: 'Product', internalField: 'price', externalField: 'variants[0].price' }
      ]
    };

    let saveMappingRes = null;
    const reqSaveMap = { user: testSuperAdmin, body: mappingBody };
    const resSaveMap = {
      json(data) {
        saveMappingRes = data;
      }
    };
    await integrationController.saveMappings(reqSaveMap, resSaveMap, (err) => { if (err) throw err; });
    console.log('Save Mappings Response:', saveMappingRes);

    if (saveMappingRes && saveMappingRes.success) {
      console.log('✅ Field mappings saved successfully.');
    } else {
      throw new Error('Save mappings controller action failed!');
    }

    let getMappingRes = null;
    const reqGetMap = { user: testSuperAdmin, query: { connectionId: createdId } };
    const resGetMap = {
      json(data) {
        getMappingRes = data;
      }
    };
    await integrationController.getMappings(reqGetMap, resGetMap, (err) => { if (err) throw err; });
    console.log('Mappings retrieved count:', getMappingRes?.mappings?.length);

    if (getMappingRes && getMappingRes.success && getMappingRes.mappings.length > 0) {
      console.log('✅ Mapping retrieval verified.');
    } else {
      throw new Error('Retrieve mappings controller action failed!');
    }

    // 7. Test Stats Controller
    console.log('\n--- 5. Testing Marketplace Stats Calculation ---');
    let statsRes = null;
    const reqStats = { user: testSuperAdmin };
    const resStats = {
      json(data) {
        statsRes = data;
      }
    };
    await integrationController.getMarketplaceStats(reqStats, resStats, (err) => { if (err) throw err; });
    console.log('Stats Response:', statsRes);

    if (statsRes && statsRes.success) {
      console.log('✅ Marketplace stats verified.');
    } else {
      throw new Error('Stats controller action failed!');
    }

    // 8. Test Webhook Ingestion & Job Queue
    console.log('\n--- 6. Testing Incoming Webhook Queue Ingestion ---');
    const webhookPayload = {
      event: 'shopify.product.updated',
      id: 998877,
      title: 'Test Webhook Ingestion Product',
      variants: [{ sku: 'WEB-TEST-SKU', price: '125.00' }]
    };

    let webhookRes = null;
    const reqWebhook = { 
      query: { connectionId: createdId }, 
      body: webhookPayload,
      headers: { 'x-event': 'shopify.product.updated' }
    };
    const resWebhook = {
      json(data) {
        webhookRes = data;
      }
    };
    await integrationController.handleMarketplaceWebhook(reqWebhook, resWebhook, (err) => { if (err) throw err; });
    console.log('Webhook Ingestion Response:', webhookRes);

    if (webhookRes && webhookRes.success) {
      console.log('✅ Webhook logged successfully.');
      
      // Confirm job enqueued inside SQLite
      const jobCount = await IntegrationSyncJob.count({ where: { connectionId: createdId, triggerType: 'Webhook' } });
      const webhookCount = await IntegrationWebhook.count({ where: { connectionId: createdId, event: 'shopify.product.updated' } });
      console.log('Synced Jobs in SQLite Queue:', jobCount);
      console.log('Logged Webhooks in SQLite table:', webhookCount);
      
      if (jobCount > 0 && webhookCount > 0) {
        console.log('✅ Webhook background queue trigger enqueuer verified.');
      } else {
        throw new Error('Sync job or webhook record was not enqueued in database tables.');
      }
    } else {
      throw new Error('Webhook receiver endpoint failed!');
    }

    // Clean up created connection and associated entities
    await IntegrationConnection.destroy({ where: { id: createdId } });
    await IntegrationFieldMapping.destroy({ where: { connectionId: createdId } });
    await IntegrationSyncJob.destroy({ where: { connectionId: createdId } });
    await IntegrationWebhook.destroy({ where: { connectionId: createdId } });
    console.log('\n✅ Cleaned up validation database rows.');

    console.log('\n🎉 ALL UNIVERSAL SaaS MARKETPLACE TESTS PASSED SUCCESSFULY!');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ VERIFICATION TEST ERROR:', err.message);
    console.error(err);
    process.exit(1);
  }
}

testUniversalMarketplace();
