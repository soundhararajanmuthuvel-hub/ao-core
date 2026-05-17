const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  qty: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true },
  gstPercent: { type: Number, default: 0 },
  lineTotal: { type: Number, required: true },
  purchasePrice: { type: Number, default: 0 },
});

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    date: { type: Date, default: Date.now },
    items: [invoiceItemSchema],
    subtotal: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    gstTotal: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['cash', 'card', 'upi', 'bank', 'credit'], default: 'cash' },
    paymentStatus: { type: String, enum: ['paid', 'partial', 'pending'], default: 'paid' },
    amountPaid: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
