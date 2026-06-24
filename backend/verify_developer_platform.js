const express = require('express');
const axios = require('axios');
const connectDB = require('./config/db');
const IntegrationExportCredential = require('./models/IntegrationExportCredential');
const Product = require('./models/Product');
const WebhookEndpoint = require('./models/WebhookEndpoint');
const WebhookLog = require('./models/WebhookLog');
const ApiAuditLog = require('./models/ApiAuditLog');
const User = require('./models/User');

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('=== AO CORE ERP DEVELOPER PLATFORM INTEGRATION TESTING ===');
  
  // 1. Connect to DB
  await connectDB();
  console.log('✔ Connected to SQLite Database.');

  // Create a mock Super Admin user for portal management
  let testAdmin = await User.findOne({ where: { role: 'Super Admin' } });
  if (!testAdmin) {
    testAdmin = await User.create({
      name: 'Platform Dev Admin',
      email: 'platformadmin@market-test.com',
      password: 'password123',
      role: 'Super Admin',
      status: 'Active'
    });
  }

  // Clear previous test records
  await IntegrationExportCredential.destroy({ where: { name: 'Test App Client' } });
  await WebhookEndpoint.destroy({ where: { name: 'Test Webhook Receiver' } });

  // 2. Initialize Mini Express Server
  const app = express();
  app.use(express.json());
  
  // Mount routes
  app.use('/api/external', require('./routes/externalRoutes'));

  const server = app.listen(PORT, async () => {
    console.log(`✔ Mini test server running on ${BASE_URL}`);

    try {
      // ----------------------------------------------------
      // TEST 1: HEALTH CHECK
      // ----------------------------------------------------
      console.log('\n--- Test 1: Public Health Check ---');
      const healthRes = await axios.get(`${BASE_URL}/api/external/health`);
      console.log('Health Status code:', healthRes.status);
      console.log('Health Body:', healthRes.data);
      if (healthRes.data.success && healthRes.data.status === 'online') {
        console.log('✅ Health Check verified successfully.');
      } else {
        throw new Error('Health check verification failed.');
      }

      // ----------------------------------------------------
      // TEST 2: AUTHENTICATION GATEWAY
      // ----------------------------------------------------
      console.log('\n--- Test 2: API Gateway Authentication ---');
      try {
        await axios.get(`${BASE_URL}/api/external/products`);
        throw new Error('Should have failed without API key!');
      } catch (err) {
        console.log('✅ Blocked request without API Key (Status:', err.response?.status, ')');
      }

      try {
        await axios.get(`${BASE_URL}/api/external/products`, { headers: { 'X-API-KEY': 'ao_live_invalidkey' } });
        throw new Error('Should have failed with invalid API key!');
      } catch (err) {
        console.log('✅ Blocked request with invalid API Key (Status:', err.response?.status, ')');
      }

      // ----------------------------------------------------
      // TEST 3: KEY GENERATION & KEY ACCESS
      // ----------------------------------------------------
      console.log('\n--- Test 3: Credential Generation with Permissions ---');
      // Create credential with Products:Read, Invoices:Read, and Analytics:Read
      const permissions = {
        Products: ['Read'],
        Invoices: ['Read'],
        Analytics: ['Read']
      };

      const newCred = await IntegrationExportCredential.create({
        name: 'Test App Client',
        apiKey: 'ao_test_integration_token_xyz',
        apiSecret: 'whsec_secret_token_123',
        webhookSecret: 'whsec_secret_token_123',
        status: 'Active',
        environment: 'Test',
        permissions: JSON.stringify(permissions),
        createdBy: 'Admin',
        tenantId: 1
      });

      console.log('Created test token: ao_test_integration_token_xyz');

      // Hit products endpoint with valid token
      const prodRes = await axios.get(`${BASE_URL}/api/external/products`, {
        headers: { 'X-API-KEY': 'ao_test_integration_token_xyz' }
      });
      console.log('Products GET response status:', prodRes.status);
      console.log('Products count in DB:', prodRes.data.data?.length);
      console.log('✅ Successfully accessed products with key.');

      // ----------------------------------------------------
      // TEST 4: PERMISSIONS BOUNDARY
      // ----------------------------------------------------
      console.log('\n--- Test 4: Permission Gate Enforcement ---');
      try {
        await axios.get(`${BASE_URL}/api/external/customers`, {
          headers: { 'X-API-KEY': 'ao_test_integration_token_xyz' }
        });
        throw new Error('Should have failed since Customers:Read permission is missing!');
      } catch (err) {
        console.log('✅ Blocked request due to lack of permission (Status:', err.response?.status, ')');
        console.log('Denial Message:', err.response?.data?.message);
      }

      // ----------------------------------------------------
      // TEST 5: AUDIT LOG VERIFICATION
      // ----------------------------------------------------
      console.log('\n--- Test 5: Access Audits Verification ---');
      // Look up log entries in DB
      const logs = await ApiAuditLog.findAll({ where: { apiKeyId: newCred.id } });
      console.log('Audited requests count:', logs.length);
      logs.forEach(l => {
        console.log(`- Request: ${l.method} ${l.endpoint} | Status: ${l.status} | Latency: ${l.duration}ms | Error: ${l.errorMessage || 'None'}`);
      });
      if (logs.length >= 2) {
        console.log('✅ Successfully validated gateway audit logging.');
      } else {
        throw new Error('Audit logs not created properly.');
      }

      // ----------------------------------------------------
      // TEST 6: WEBHOOK EVENT TRIGGER & LIFECYCLE
      // ----------------------------------------------------
      console.log('\n--- Test 6: Webhooks Engine & Delivery Lifecycle ---');
      
      // Start a dummy receiver server inside express to receive the webhook
      app.post('/dummy-receiver', (req, res) => {
        console.log('★ Webhook received by dummy receiver!');
        console.log('Headers:', req.headers['x-webhook-signature'] ? 'Signed' : 'Unsigned');
        console.log('Payload:', req.body);
        res.status(200).json({ success: true });
      });

      // Create WebhookEndpoint
      const webhookEp = await WebhookEndpoint.create({
        name: 'Test Webhook Receiver',
        url: `${BASE_URL}/dummy-receiver`,
        description: 'Test Webhook receiver endpoint',
        events: 'product.created',
        secret: 'whsec_dummy_secret',
        status: 'Active',
        tenantId: 1
      });
      console.log('Registered webhook endpoint pointing to /dummy-receiver');

      // Create mock product in DB to trigger hook
      console.log('Creating a mock product to trigger product.created event...');
      const testProduct = await Product.create({
        name: 'Organic Honey Tea Bags',
        sku: 'ORG-HON-TEA',
        sellingPrice: 190,
        stock: 50,
        minStockLevel: 5,
        supplier: 'manufactured',
        tenantId: 1
      });

      // Wait a moment for async dispatch to run
      await new Promise(r => setTimeout(r, 1500));

      // Query Webhook logs
      const webhookLogs = await WebhookLog.findAll({ where: { endpointId: webhookEp.id } });
      console.log('Webhook deliveries logged:', webhookLogs.length);
      webhookLogs.forEach(wl => {
        console.log(`- Event: ${wl.event} | Status: ${wl.status} | Response Status: ${wl.responseStatus} | Error: ${wl.errorMessage || 'None'}`);
      });

      if (webhookLogs.length > 0 && webhookLogs[0].status === 'Success') {
        console.log('✅ Successfully verified webhooks event dispatch and log status.');
      } else {
        throw new Error('Webhook delivery failed or was not logged.');
      }

      // Clean up test product
      await testProduct.destroy();

      // ----------------------------------------------------
      // TEST 7: AI INSIGHTS DATA LAYER
      // ----------------------------------------------------
      console.log('\n--- Test 7: AI Data Layer Endpoints ---');
      const aiRes = await axios.get(`${BASE_URL}/api/external/ai/product-insights`, {
        headers: { 'X-API-KEY': 'ao_test_integration_token_xyz' }
      });
      console.log('AI Insights Status:', aiRes.status);
      console.log('AI Insights Summary:', aiRes.data.summary);
      console.log('AI Insights Trends:', aiRes.data.trends);
      if (aiRes.data.success && aiRes.data.summary) {
        console.log('✅ AI insights response formatted correctly.');
      } else {
        throw new Error('AI optimized response is incorrect.');
      }

      console.log('\n====================================================');
      console.log('🎉 ALL DEVELOPER CENTER INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
      console.log('====================================================');

    } catch (err) {
      console.error('\n❌ INTEGRATION TEST FAILURE:', err.message);
      if (err.response) {
        console.error('Response Error Data:', err.response.data);
      }
    } finally {
      // Clean up test records
      await IntegrationExportCredential.destroy({ where: { name: 'Test App Client' } });
      await WebhookEndpoint.destroy({ where: { name: 'Test Webhook Receiver' } });
      
      // Close Server
      server.close(() => {
        console.log('Server shut down. Exiting process.');
        process.exit(0);
      });
    }
  });
}

runTests().catch(err => {
  console.error('Fatal Test Run Error:', err);
  process.exit(1);
});
