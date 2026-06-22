const WooCommerceService = require('./wooService');
const { getSettings, logActivity } = require('./helpers');
const { runTrackingAutoCheck } = require('../controllers/shippingController');

let isSyncing = false;

const runAutoSync = async () => {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const settings = await getSettings();
    if (!settings.wooConnected || !settings.wooUrl) {
      isSyncing = false;
      return;
    }

    const intervalMin = settings.wooSyncInterval || 30; // 15, 30, or 60
    const lastSync = settings.wooLastSyncTime ? new Date(settings.wooLastSyncTime) : new Date(0);
    const now = new Date();
    
    // Check if enough time has passed
    const diffMs = now - lastSync;
    const diffMin = diffMs / (1000 * 60);

    if (diffMin >= intervalMin) {
      console.log(`[Auto Sync] Starting WooCommerce background auto-sync (interval: ${intervalMin}m, last sync: ${lastSync.toISOString()})...`);
      
      const woo = new WooCommerceService(settings);
      
      // 1. Sync Customers
      try {
        const custCount = await woo.syncCustomers();
        console.log(`[Auto Sync] Synced ${custCount} customers.`);
        settings.wooLastCustomerSyncTime = new Date();
      } catch (err) {
        console.error('[Auto Sync] Customer sync failed:', err.message);
      }

      // 2. Sync Products (Import & Stock Sync)
      try {
        const prodCount = await woo.importProducts();
        console.log(`[Auto Sync] Imported/Updated ${prodCount} products.`);
        settings.wooLastProductSyncTime = new Date();
      } catch (err) {
        console.error('[Auto Sync] Product import failed:', err.message);
      }

      // 3. Sync Orders
      try {
        const orderCount = await woo.syncOrders(1); // System user id = 1
        console.log(`[Auto Sync] Synced ${orderCount} orders.`);
        settings.wooLastOrderSyncTime = new Date();
      } catch (err) {
        console.error('[Auto Sync] Order sync failed:', err.message);
      }

      // 4. Sync Inventory (Push stock back)
      try {
        const invCount = await woo.syncInventory();
        console.log(`[Auto Sync] Pushed stock levels for ${invCount} products.`);
        settings.wooLastInventorySyncTime = new Date();
      } catch (err) {
        console.error('[Auto Sync] Inventory sync failed:', err.message);
      }

      // Update last sync time
      settings.wooLastSyncTime = new Date();
      await settings.save();
      
      await logActivity(1, 'sync', 'auto', 'Completed automated WooCommerce synchronization cycle');
      console.log('[Auto Sync] Background auto sync cycle completed successfully.');
    }
  } catch (err) {
    console.error('[Auto Sync] Error during auto sync runner:', err.message);
  } finally {
    isSyncing = false;
  }
};

const runReEngagementCheck = async () => {
  try {
    console.log('[Scheduler] Running Re-Engagement customer activity check...');
    const crmController = require('../controllers/crmController');
    const req = { user: { id: 1 } }; // default system/admin user
    let responseData = null;
    const res = {
      json(data) {
        responseData = data;
      }
    };
    const next = (err) => {
      if (err) console.error('[Scheduler] Re-Engagement runner error in next:', err.message);
    };
    await crmController.triggerAutoFollowUps(req, res, next);
    if (responseData && responseData.success) {
      console.log(`[Scheduler] Re-Engagement activity check completed: ${responseData.message}`);
    }
  } catch (err) {
    console.error('[Scheduler] Re-Engagement runner failed:', err.message);
  }
};

const runAutoPaymentRemindersCheck = async () => {
  try {
    console.log('[Scheduler] Running Auto Payment Reminders activity check...');
    const whatsappService = require('../services/whatsappService');
    const count = await whatsappService.runAutoPaymentReminders();
    console.log(`[Scheduler] Auto Payment Reminders run complete: sent ${count} reminders.`);
  } catch (err) {
    console.error('[Scheduler] Auto Payment Reminders check failed:', err.message);
  }
};

const processIntegrationJobs = async () => {
  try {
    const IntegrationSyncJob = require('../models/IntegrationSyncJob');
    const integrationController = require('../controllers/integrationController');

    const job = await IntegrationSyncJob.findOne({
      where: { status: 'Pending' },
      order: [['createdAt', 'ASC']]
    });

    if (job) {
      console.log(`[Queue Worker] Processing integration sync job ${job.id} for connection ${job.connectionId} (${job.entityType})...`);
      
      job.status = 'Processing';
      job.startedAt = new Date();
      await job.save();

      const req = {
        body: {
          id: job.connectionId,
          entityTypes: [job.entityType]
        },
        user: { tenantId: job.tenantId || 1 }
      };

      const res = {
        json(data) {
          console.log(`[Queue Worker] Job ${job.id} completed successfully.`);
        },
        status(code) {
          console.error(`[Queue Worker] Job ${job.id} failed with code ${code}`);
          return this;
        }
      };

      const next = (err) => {
        if (err) {
          console.error(`[Queue Worker] Job ${job.id} failed:`, err.message);
        }
      };

      await integrationController.syncNow(req, res, next);
    }
  } catch (err) {
    console.error('[Queue Worker] Error running processIntegrationJobs:', err.message);
  }
};

const checkAndEnqueueScheduledJobs = async () => {
  try {
    const IntegrationConnection = require('../models/IntegrationConnection');
    const IntegrationSyncJob = require('../models/IntegrationSyncJob');
    const { Op } = require('sequelize');

    const connections = await IntegrationConnection.findAll({
      where: {
        syncFrequency: { [Op.ne]: 'Manual' }
      }
    });

    for (const conn of connections) {
      const freq = conn.syncFrequency;
      let intervalMs = 60 * 60 * 1000; // Hourly
      if (freq === 'Daily') intervalMs = 24 * 60 * 60 * 1000;
      if (freq === 'Weekly') intervalMs = 7 * 24 * 60 * 60 * 1000;
      if (freq === 'Realtime') intervalMs = 5 * 60 * 1000;

      const lastSync = conn.lastSyncTime ? new Date(conn.lastSyncTime) : new Date(0);
      const now = new Date();
      
      if (now - lastSync >= intervalMs) {
        console.log(`[Scheduler] Enqueuing scheduled sync jobs for connection ${conn.name} (Frequency: ${freq})`);
        
        const entities = ['Product', 'Customer', 'Order', 'Catalogue'];
        for (const entityType of entities) {
          const exists = await IntegrationSyncJob.findOne({
            where: {
              connectionId: conn.id,
              entityType,
              status: 'Pending'
            }
          });
          if (!exists) {
            await IntegrationSyncJob.create({
              connectionId: conn.id,
              entityType,
              status: 'Pending',
              triggerType: 'Scheduled',
              tenantId: conn.tenantId
            });
          }
        }

        conn.lastSyncTime = now;
        await conn.save();
      }
    }
  } catch (err) {
    console.error('[Scheduler] Error enqueuing scheduled jobs:', err.message);
  }
};

const startScheduler = () => {
  console.log('[Scheduler] Initializing WooCommerce background auto-sync runner (every 1 minute)...');
  setInterval(runAutoSync, 60 * 1000);
  
  console.log('[Scheduler] Initializing Courier Tracking background auto-check runner (every 1 minute)...');
  setInterval(runTrackingAutoCheck, 60 * 1000);

  console.log('[Scheduler] Initializing Customer Re-Engagement background runner (every 1 hour)...');
  setInterval(runReEngagementCheck, 60 * 60 * 1000);

  console.log('[Scheduler] Initializing Auto Payment Reminders background runner (every 1 hour)...');
  setInterval(runAutoPaymentRemindersCheck, 60 * 60 * 1000);

  console.log('[Scheduler] Initializing Integrations scheduled jobs checker (every 1 minute)...');
  setInterval(checkAndEnqueueScheduledJobs, 60 * 1000);

  console.log('[Scheduler] Initializing Integrations queue worker loop (every 15 seconds)...');
  setInterval(processIntegrationJobs, 15 * 1000);

  // Run once shortly after startup
  setTimeout(runReEngagementCheck, 5000);
  setTimeout(runAutoPaymentRemindersCheck, 10000);
  setTimeout(checkAndEnqueueScheduledJobs, 15000);
};

module.exports = {
  startScheduler,
  runAutoSync,
  runTrackingAutoCheck,
  runReEngagementCheck,
  runAutoPaymentRemindersCheck,
  checkAndEnqueueScheduledJobs,
  processIntegrationJobs
};

