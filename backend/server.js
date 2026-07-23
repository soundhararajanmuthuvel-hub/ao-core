require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const compression = require('compression');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = [
  "https://erp.amudhasurabiy.com",
  "https://www.erp.amudhasurabiy.com",
  "https://ao-core.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://localhost:5050",
  "http://127.0.0.1:5050",
  process.env.BLOVIT_FRONTEND_URL || ""
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.includes(origin) || 
                      /^http:\/\/localhost:\d+$/.test(origin) || 
                      /^http:\/\/127\.0\.0\.1:\d+$/.test(origin);
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-API-Key", "x-api-key"]
};

const { profileMiddleware } = require('./middleware/profileMiddleware');

/* =========================
   MIDDLEWARE
 ========================= */
app.use(cors(corsOptions));
app.use(compression());
app.use(profileMiddleware);
app.options('*', cors(corsOptions));

// Explicit preflight handler to guarantee OPTIONS requests never fall through or 404
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));
app.use(express.json({ 
  limit: '2mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.get('/api/assets/company-logo', require('./controllers/settingsController').getCompanyLogoImage);
app.get('/api/company/logo', require('./controllers/settingsController').getCompanyLogoImage);
app.get('/api/company/brand', require('./controllers/settingsController').getCompanyBrand);

/* =========================
   ROOT ROUTE
========================= */
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'AO Core ERP API Running Successfully',
  });
});

/* =========================
   HEALTH CHECK
========================= */
app.get('/api/health', async (req, res) => {
  let dbStatus = 'Disconnected';
  try {
    await connectDB.sequelize.authenticate();
    dbStatus = 'Connected';
  } catch {}
  res.json({
    success: true,
    status: 'OK',
    database: dbStatus,
  });
});

app.post('/api/client-error', (req, res) => {
  console.log('\n=== CLIENT-SIDE ERROR RECEIVED ===');
  console.log(JSON.stringify(req.body, null, 2));
  console.log('==================================\n');
  res.json({ success: true });
});

/* =========================
   API ROUTES
========================= */
app.use('/api/test', require('./routes/testRoutes'));
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/sales', require('./routes/salesRoutes'));
app.use('/api/sales-targets', require('./routes/salesTargetRoutes'));
app.use('/api/targets', require('./routes/salesTargetRoutes'));
app.get('/api/salesman/dashboard', require('./middleware/auth'), require('./controllers/salesTargetController').getSalesmanTargetDashboard);
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/reports', require('./routes/reportsRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/activity', require('./routes/activityRoutes'));
app.use('/api/repack', require('./routes/repackRoutes'));
app.use('/api/raw-materials', require('./routes/rawMaterialRoutes'));
app.use('/api/manufacturing', require('./routes/manufacturingRoutes'));
app.use('/api/packing-conversion', require('./routes/packingConversionRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/shipping', require('./routes/shippingRoutes'));
app.use('/api/couriers', require('./routes/courierRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/integrations', require('./routes/integrationRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/sfa', require('./routes/sfaRoutes'));
app.use('/api/crm', require('./routes/crmRoutes'));
app.use('/api/migration', require('./routes/migrationRoutes'));
app.use('/api/whatsapp', require('./routes/whatsappRoutes'));
app.use('/api/catalog', require('./routes/catalogRoutes'));
app.use('/api/external', require('./routes/externalRoutes'));

/* =========================
   WEBSITE MODULE ROUTES (BLOVIT ECOMMERCE)
   ========================= */
app.get('/api/website/health', (req, res) => res.json({ success: true, status: 'OK', message: 'Website module is operational' }));
app.use('/api/website/products', require('./routes/websiteProductRoutes'));
app.use('/api/website/auth', require('./routes/websiteAuthRoutes'));
app.use('/api/website/account', require('./routes/websiteAccountRoutes'));
app.use('/api/website/cart', require('./routes/websiteAccountRoutes'));
app.use('/api/website/razorpay', require('./routes/websiteOrderRoutes'));
app.use('/api/website/orders', require('./routes/websiteOrderRoutes'));
app.use('/api/website', require('./routes/websiteReviewRoutes'));
app.use('/api/website/referrals', require('./routes/websiteReferralRoutes'));
app.use('/api/website', require('./routes/websiteShippingCouponRoutes'));
app.use('/api/website', require('./routes/websiteEventRoutes'));
app.use('/api/website-admin', require('./routes/websiteAdminRoutes'));

/* =========================
   PUBLIC REVIEW PORTAL ROUTES
   ========================= */
app.get('/reviews/portal/:token', (req, res, next) => {
  // Redirect to frontend review portal if it's a browser navigation request
  if (req.accepts('html') || !req.headers.accept?.includes('application/json')) {
    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    return res.redirect(`${clientUrl.replace(/\/$/, '')}/reviews/portal/${req.params.token}`);
  }
  next();
}, require('./controllers/sfaController').getReviewPortal);

app.post('/reviews/portal/:token', require('./controllers/sfaController').submitReview);


/* =========================
   404 HANDLER
========================= */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route Not Found: ${req.originalUrl}`,
  });
});

/* =========================
   ERROR HANDLER
========================= */
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDB();
    
    // Clean up seeded ABC Malt data from database (one-time clean up on deployment)
    try {
      const Product = require('./models/Product');
      const RawMaterial = require('./models/RawMaterial');
      const ManufacturingRecipe = require('./models/ManufacturingRecipe');
      const { Op } = require('sequelize');

      const deletedRecipes = await ManufacturingRecipe.destroy({
        where: { name: { [Op.like]: 'ABC Malt%' } }
      });
      const deletedProducts = await Product.destroy({
        where: { sku: { [Op.like]: 'ABC-MALT-%' } }
      });
      const deletedRawMaterials = await RawMaterial.destroy({
        where: { materialCode: { [Op.like]: 'RM-%' } }
      });

      if (deletedProducts > 0 || deletedRawMaterials > 0 || deletedRecipes > 0) {
        console.log(`✓ Cleaned up seeded ABC Malt records from database: ${deletedProducts} products, ${deletedRawMaterials} raw materials, ${deletedRecipes} recipes.`);
      }
    } catch (cleanErr) {
      console.error('Failed to clean up seeded ABC Malt data:', cleanErr);
    }

    // Seed CRM API Key
    try {
      const IntegrationExportCredential = require('./models/IntegrationExportCredential');
      const crmApiKey = 'ao_live_2b2ff0efaa001a57a4fbd643ec64c121eff339f4f2067464';
      const existingKey = await IntegrationExportCredential.findOne({ where: { apiKey: crmApiKey } });
      if (!existingKey) {
        await IntegrationExportCredential.create({
          name: 'Cusman CRM Integration',
          description: 'Auto-generated key for Cusman CRM sync',
          apiKey: crmApiKey,
          apiSecret: 'whsec_2b2ff0efaa001a57a4fbd643ec64c121eff339f4f2067464',
          status: 'Active',
          environment: 'Live',
          permissions: JSON.stringify({
            Products: ['Read', 'Create', 'Update', 'Delete'],
            Customers: ['Read', 'Create', 'Update', 'Delete'],
            Orders: ['Read', 'Create', 'Update', 'Delete'],
            Invoices: ['Read', 'Create', 'Update', 'Delete']
          }),
          tenantId: 1
        });
        console.log('✓ Seeded CRM Integration API Key successfully');
      }
    } catch (seedCrmErr) {
      console.error('CRM API Key seeding failed:', seedCrmErr);
    }
    
    // Initialize background WooCommerce auto-sync scheduler
    const { startScheduler } = require('./utils/scheduler');
    startScheduler();

    // Auto-seed database if no users exist
    try {
      const User = require('./models/User');
      const userCount = await User.count();
      if (userCount === 0) {
        console.log('No users found in database. Running auto-seed...');
        const { exec } = require('child_process');
        exec('node utils/seedAdmin.js', (error, stdout, stderr) => {
          if (error) {
            console.error(`Auto-seed error: ${error}`);
            return;
          }
          console.log(`Auto-seed completed successfully: ${stdout}`);
        });
      }
    } catch (seedErr) {
      console.error('Auto-seed check failed:', seedErr);
    }

    app.listen(PORT, () => {
      console.log(`AO Core API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('DB connection failed:', err);
    process.exit(1);
  }
};

startServer();
