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

const startScheduler = () => {
  console.log('[Scheduler] Initializing WooCommerce background auto-sync runner (every 1 minute)...');
  setInterval(runAutoSync, 60 * 1000);
  
  console.log('[Scheduler] Initializing Courier Tracking background auto-check runner (every 1 minute)...');
  setInterval(runTrackingAutoCheck, 60 * 1000);
};

module.exports = {
  startScheduler,
  runAutoSync,
  runTrackingAutoCheck
};
