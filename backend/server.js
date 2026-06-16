require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;
const normalizeOrigin = (value) => value?.trim().replace(/\/$/, '');

const allowedOrigins = [
  normalizeOrigin(process.env.CLIENT_URL),
  'http://localhost:5173',
  'http://127.0.0.1:5173',
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Dynamically match localhost, 127.0.0.1, and local private network subnets (192.168.x.x, 10.x.x.x, 172.16.x.x)
    const isLocalNetwork = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+):\d+$/i.test(origin);
    if (!origin || allowedOrigins.includes(origin) || isLocalNetwork) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

/* =========================
   MIDDLEWARE
========================= */
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/reports', require('./routes/reportsRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/activity', require('./routes/activityRoutes'));
app.use('/api/repack', require('./routes/repackRoutes'));
app.use('/api/raw-materials', require('./routes/rawMaterialRoutes'));
app.use('/api/manufacturing', require('./routes/manufacturingRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/shipping', require('./routes/shippingRoutes'));
app.use('/api/couriers', require('./routes/courierRoutes'));
app.use('/api/search', require('./routes/searchRoutes'));
app.use('/api/integrations', require('./routes/integrationRoutes'));
app.use('/api/webhooks', require('./routes/webhookRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/migration', require('./routes/migrationRoutes'));

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
    
    // Initialize background WooCommerce auto-sync scheduler
    const { startScheduler } = require('./utils/scheduler');
    startScheduler();

    app.listen(PORT, () => {
      console.log(`AO Core API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('DB connection failed:', err);
    process.exit(1);
  }
};

startServer();
