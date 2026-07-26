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

const dataFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  // Explicitly reject dangerous extensions
  const dangerousExts = ['.php', '.exe', '.dll', '.js', '.ts', '.sh', '.bat', '.cmd', '.ps1', '.asp', '.aspx', '.jsp'];
  if (dangerousExts.includes(ext)) {
    return cb(new Error('Dangerous file types are strictly prohibited.'));
  }

  // Allow list: PDF, CSV, Excel, Zip
  const allowedExts = ['.pdf', '.csv', '.xls', '.xlsx', '.zip'];
  const allowedMimes = [
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip',
    'application/x-zip-compressed'
  ];

  if (allowedExts.includes(ext) && allowedMimes.includes(mime)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, CSV, Excel, or ZIP files up to 10MB are allowed.'));
  }
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

const uploadDataFile = multer({
  storage: memoryStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB Max
  fileFilter: dataFileFilter,
}).single('file');

module.exports = {
  uploadLogo,
  uploadProduct,
  uploadMultipleProductImages,
  uploadPurchaseInvoice,
  uploadDataFile,
};
