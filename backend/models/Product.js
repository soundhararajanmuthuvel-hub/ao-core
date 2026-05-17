const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, trim: true },
    barcode: { type: String, trim: true },
    category: { type: String, trim: true, default: 'General' },
    stock: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    unit: { type: String, default: 'pcs' },
    purchasePrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 0 },
    supplier: { type: String, trim: true },
    image: { type: String, default: '' },
  },
  { timestamps: true }
);

productSchema.virtual('isLowStock').get(function () {
  return this.stock <= this.lowStockThreshold;
});

module.exports = mongoose.model('Product', productSchema);
