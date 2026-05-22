require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();

/* =========================
   DATABASE CONNECTION
========================= */
connectDB()
  .then(() => {
    console.log('✅ MongoDB Connected');
  })
  .catch((err) => {
    console.error('❌ DB Connection Failed:', err.message);
    process.exit(1);
  });

/* =========================
   MIDDLEWARE
========================= */
app.use(
  cors({
    origin: process.env.CLIENT_URL || '*',
    credentials: true,
  })
);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATIC FOLDER
========================= */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* =========================
   ROOT ROUTE
========================= */
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🚀 AO Core ERP API Running Successfully',
  });
});

/* =========================
   HEALTH CHECK
========================= */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    app: 'AO Core ERP',
    status: 'OK',
    database:
      mongoose.connection.readyState === 1
        ? 'Connected'
        : 'Disconnected',
    uptime: process.uptime(),
    timestamp: new Date(),
  });
});

/* =========================
   API ROUTES
========================= */
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
app.use('/api/search', require('./routes/searchRoutes'));

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

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 AO Core API running on port ${PORT}`);
});