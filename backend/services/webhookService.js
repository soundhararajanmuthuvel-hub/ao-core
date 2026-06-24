const axios = require('axios');
const crypto = require('crypto');
const WebhookEndpoint = require('../models/WebhookEndpoint');
const WebhookLog = require('../models/WebhookLog');

// Dispatches a single webhook delivery log payload to its endpoint URL
const dispatchSingleLog = async (log, endpoint = null) => {
  try {
    let ep = endpoint;
    if (!ep) {
      ep = await WebhookEndpoint.findByPk(log.endpointId);
    }

    if (!ep || ep.status !== 'Active') {
      log.status = 'Dead';
      log.errorMessage = 'Endpoint is inactive or deleted.';
      await log.save();
      return false;
    }

    // Sign body payload using HMAC SHA256 of payload with endpoint's secret
    const signature = crypto.createHmac('sha256', ep.secret)
                            .update(log.payload)
                            .digest('hex');

    const response = await axios.post(ep.url, log.payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Hub-Signature-256': `sha256=${signature}`
      },
      timeout: 8000 // 8 seconds timeout
    });

    // Update log on success
    log.status = 'Success';
    log.responseStatus = response.status;
    log.responseBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    log.errorMessage = null;
    await log.save();

    return true;
  } catch (err) {
    const nextAttempts = log.attempt + 1;
    const retryIntervals = [
      60 * 1000,          // 1 minute
      5 * 60 * 1000,      // 5 minutes
      15 * 60 * 1000,     // 15 minutes
      60 * 60 * 1000,     // 1 hour
      6 * 60 * 60 * 1000, // 6 hours
      24 * 60 * 60 * 1000 // 24 hours
    ];

    log.attempt = nextAttempts;
    log.responseStatus = err.response?.status || null;
    log.responseBody = err.response?.data ? (typeof err.response.data === 'string' ? err.response.data : JSON.stringify(err.response.data)) : null;
    log.errorMessage = err.message;

    if (nextAttempts > retryIntervals.length) {
      log.status = 'Dead';
      log.nextRetryAt = null;
    } else {
      log.status = 'Retrying';
      log.nextRetryAt = new Date(Date.now() + retryIntervals[nextAttempts - 1]);
    }

    await log.save();
    return false;
  }
};

// Creates a log queue entry and attempts first dispatch
const triggerEvent = async (event, payload, tenantId = 1) => {
  try {
    const endpoints = await WebhookEndpoint.findAll({
      where: {
        status: 'Active',
        tenantId
      }
    });

    for (const ep of endpoints) {
      const subscribedEvents = ep.events.split(',').map(e => e.trim());
      if (subscribedEvents.includes(event) || subscribedEvents.includes('*')) {
        const log = await WebhookLog.create({
          endpointId: ep.id,
          event,
          payload: JSON.stringify(payload),
          status: 'Pending',
          attempt: 0,
          nextRetryAt: new Date(),
          tenantId
        });

        // Async execution in background
        dispatchSingleLog(log, ep).catch(err => console.error(`Bg Webhook Dispatch error for endpoint ${ep.url}:`, err.message));
      }
    }
  } catch (err) {
    console.error('Error triggering webhook event:', err.message);
  }
};

// Binds hooks to Sequelize models
const registerWebhookHooks = () => {
  const Product = require('../models/Product');
  const Customer = require('../models/Customer');
  const Order = require('../models/Order');
  const Invoice = require('../models/Invoice');
  const Payment = require('../models/Payment');
  const StockMovement = require('../models/StockMovement');
  const Purchase = require('../models/Purchase');
  const ManufacturingEntry = require('../models/ManufacturingEntry');
  const Shipment = require('../models/Shipment');
  const CrmFollowUp = require('../models/CrmFollowUp');

  // Products
  Product.addHook('afterCreate', 'webhookCreate', (instance) => triggerEvent('product.created', instance.toJSON(), instance.tenantId));
  Product.addHook('afterUpdate', 'webhookUpdate', (instance) => triggerEvent('product.updated', instance.toJSON(), instance.tenantId));
  Product.addHook('afterDestroy', 'webhookDestroy', (instance) => triggerEvent('product.deleted', instance.toJSON(), instance.tenantId));

  // Customers
  Customer.addHook('afterCreate', 'webhookCreate', (instance) => triggerEvent('customer.created', instance.toJSON(), instance.tenantId));
  Customer.addHook('afterUpdate', 'webhookUpdate', (instance) => triggerEvent('customer.updated', instance.toJSON(), instance.tenantId));

  // Orders
  Order.addHook('afterCreate', 'webhookCreate', (instance) => triggerEvent('order.created', instance.toJSON(), instance.tenantId));

  // Invoices
  Invoice.addHook('afterCreate', 'webhookCreate', (instance) => {
    triggerEvent('invoice.created', instance.toJSON(), instance.tenantId);
    if (instance.status === 'Paid' || instance.paymentStatus === 'Paid') {
      triggerEvent('invoice.paid', instance.toJSON(), instance.tenantId);
    }
  });
  Invoice.addHook('afterUpdate', 'webhookUpdate', (instance) => {
    const changes = instance.previous();
    if ((instance.status === 'Paid' || instance.paymentStatus === 'Paid') && 
        changes.status !== 'Paid' && changes.paymentStatus !== 'Paid') {
      triggerEvent('invoice.paid', instance.toJSON(), instance.tenantId);
    }
  });

  // Payments
  Payment.addHook('afterCreate', 'webhookCreate', (instance) => triggerEvent('payment.received', instance.toJSON(), instance.tenantId));

  // Stock
  StockMovement.addHook('afterCreate', 'webhookCreate', (instance) => triggerEvent('stock.updated', instance.toJSON(), instance.tenantId));

  // Purchases
  Purchase.addHook('afterCreate', 'webhookCreate', (instance) => triggerEvent('purchase.created', instance.toJSON(), instance.tenantId));

  // Manufacturing entry
  ManufacturingEntry.addHook('afterCreate', 'webhookCreate', (instance) => triggerEvent('production.completed', instance.toJSON(), instance.tenantId));

  // Shipments
  Shipment.addHook('afterCreate', 'webhookCreate', (instance) => triggerEvent('shipment.created', instance.toJSON(), instance.tenantId));
  Shipment.addHook('afterUpdate', 'webhookUpdate', (instance) => {
    const changes = instance.previous();
    if (instance.status === 'Delivered' && changes.status !== 'Delivered') {
      triggerEvent('delivery.completed', instance.toJSON(), instance.tenantId);
    }
  });

  // CRM followups
  CrmFollowUp.addHook('afterCreate', 'webhookCreate', (instance) => triggerEvent('CRM.followup.created', instance.toJSON(), instance.tenantId));
  
  console.log('✓ API Gateway Webhook Hooks bound to database models successfully.');
};

module.exports = {
  triggerEvent,
  dispatchSingleLog,
  registerWebhookHooks
};
