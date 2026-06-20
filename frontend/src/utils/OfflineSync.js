import { sfaApi, ordersApi } from '../api';

export function startOfflineSync() {
  const syncData = async () => {
    if (!navigator.onLine) return;

    // 1. Sync visits
    const offlineVisits = JSON.parse(localStorage.getItem('offline_visits') || '[]');
    if (offlineVisits.length > 0) {
      console.log(`[Offline Sync] Syncing ${offlineVisits.length} visits...`);
      const remainingVisits = [];
      
      for (const visit of offlineVisits) {
        try {
          // Sync checkin
          const checkInRes = await sfaApi.checkIn({
            customerId: visit.customerId,
            latitude: visit.latitude,
            longitude: visit.longitude
          });
          
          const visitId = checkInRes.data.id;
          
          // Sync checkout
          if (visit.checkOutTime) {
            await sfaApi.checkOut({
              visitId,
              status: visit.status,
              notes: visit.notes,
              photo: visit.photo
            });
          }
        } catch (err) {
          console.error('[Offline Sync] Visit sync failed:', err);
          remainingVisits.push(visit); // keep failed ones to retry
        }
      }
      localStorage.setItem('offline_visits', JSON.stringify(remainingVisits));
      if (remainingVisits.length === 0) {
        console.log('[Offline Sync] All visits synced successfully!');
      }
    }

    // 2. Sync orders
    const offlineOrders = JSON.parse(localStorage.getItem('offline_orders') || '[]');
    if (offlineOrders.length > 0) {
      console.log(`[Offline Sync] Syncing ${offlineOrders.length} orders...`);
      const remainingOrders = [];
      
      for (const order of offlineOrders) {
        try {
          await ordersApi.create(order);
        } catch (err) {
          console.error('[Offline Sync] Order sync failed:', err);
          remainingOrders.push(order);
        }
      }
      localStorage.setItem('offline_orders', JSON.stringify(remainingOrders));
      if (remainingOrders.length === 0) {
        console.log('[Offline Sync] All orders synced successfully!');
      }
    }
  };

  // Listen to network status updates
  window.addEventListener('online', syncData);
  
  // Run check initially
  if (navigator.onLine) {
    syncData();
  }
}
