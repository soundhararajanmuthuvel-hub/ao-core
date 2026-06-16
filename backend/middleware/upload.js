const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const storage = (subfolder) =>
  multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(__dirname, '..', 'uploads', subfolder);
      ensureDir(dir);
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) cb(null, true);
  else cb(new Error('Only image files allowed'));
};

const purchaseInvoiceFileFilter = (req, file, cb) => {
  const isPdf = path.extname(file.originalname).toLowerCase() === '.pdf';
  const isPdfMime = file.mimetype === 'application/pdf';
  if (isPdf && isPdfMime) cb(null, true);
  else cb(new Error('Only PDF files are allowed for purchase invoices'));
};

const uploadLogo = multer({
  storage: storage('logos'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
}).single('logo');

const uploadProduct = multer({
  storage: storage('products'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
}).single('image');

const uploadPurchaseInvoice = multer({
  storage: storage('purchase-invoices'),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: purchaseInvoiceFileFilter,
}).single('invoicePdf');

module.exports = { uploadLogo, uploadProduct, uploadPurchaseInvoice };
