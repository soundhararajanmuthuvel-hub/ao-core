const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    type: {
      type: String,
      enum: ['sale', 'purchase', 'adjustment', 'repack', 'manufacturing'],
      required: true,
    },
    quantity: { type: Number, required: true },
    referenceId: { type: mongoose.Schema.Types.ObjectId },
    referenceModel: { type: String },
    notes: { type: String, trim: true },
    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockMovement', stockMovementSchema);
