const multer = require('multer');
const path = require('path');

// Memory storage for zero-disk-footprint Cloudinary buffer uploads
const memoryStorage = multer.memoryStorage();

const imageFileFilter = (req, file, cb) => {
  const allowedExts = /jpeg|jpg|png|webp/;
  const allowedMimes = /image\/(jpeg|jpg|png|webp)/;
  const ext = allowedExts.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedMimes.test(file.mimetype.toLowerCase());

  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Invalid image file format. Only JPG, JPEG, PNG, and WEBP images up to 10MB are allowed.'));
  }
};

const purchaseInvoiceFileFilter = (req, file, cb) => {
  const isPdf = path.extname(file.originalname).toLowerCase() === '.pdf';
  const isPdfMime = file.mimetype === 'application/pdf';
  if (isPdf && isPdfMime) cb(null, true);
  else cb(new Error('Only PDF files are allowed for purchase invoices'));
};

const uploadLogo = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB Max
  fileFilter: imageFileFilter,
}).single('logo');

const uploadProduct = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB Max
  fileFilter: imageFileFilter,
}).single('image');

const uploadMultipleProductImages = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB Max per file
  fileFilter: imageFileFilter,
}).array('images', 10);

const uploadPurchaseInvoice = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: purchaseInvoiceFileFilter,
}).single('invoicePdf');

module.exports = {
  uploadLogo,
  uploadProduct,
  uploadMultipleProductImages,
  uploadPurchaseInvoice,
};
