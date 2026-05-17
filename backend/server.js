require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

const app = express();

/* =========================
   DATABASE CONNECTION
========================= */
connectDB().catch((err) => {
  console.error('DB connection failed:', err.message);
  process.exit(1);
});

/* =========================
   MIDDLEWARES
========================= */
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   STATIC FILES
========================= */
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* =========================
   HOME ROUTE
========================= */
app.get('/', (req, res) => {
  res.send(`
    <h1>🚀 AO Core ERP API Running Successfully</h1>
    <p>Backend deployed successfully on Render.</p>

    <h3>Available API Routes:</h3>
    <ul>
      <li>/api/health</li>
      <li>/api/auth</li>
      <li>/api/users</li>
      <li>/api/products</li>
      <li>/api/customers</li>
      <li>/api/sales</li>
      <li>/api/purchases</li>
      <li>/api/inventory</li>
      <li>/api/suppliers</li>
      <li>/api/settings</li>
      <li>/api/analytics</li>
      <li>/api/reports</li>
      <li>/api/notifications</li>
      <li>/api/activity</li>
      <li>/api/search</li>
    </ul>
  `);
});

/* =========================
   HEALTH CHECK
========================= */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'AO Core ERP',
    server: 'running',
    time: new Date(),
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
    message: 'API Route Not Found',
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