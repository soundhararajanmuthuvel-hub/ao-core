const Supplier = require('../models/Supplier');
const { logActivity } = require('../utils/helpers');

exports.getSuppliers = async (req, res, next) => {
  try {
    const query = { isActive: true };
    if (req.query.type) query.type = req.query.type;
    if (req.query.search) {
      query.name = new RegExp(req.query.search, 'i');
    }
    const suppliers = await Supplier.find(query).sort({ name: 1 });
    res.json({ suppliers });
  } catch (err) {
    next(err);
  }
};

exports.createSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.create(req.body);
    await logActivity(req.user._id, 'create', 'suppliers', `Created supplier ${supplier.name}`);
    res.status(201).json({ supplier });
  } catch (err) {
    next(err);
  }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!supplier) return res.status(404).json({ message: 'Supplier not found' });
    res.json({ supplier });
  } catch (err) {
    next(err);
  }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    await Supplier.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Supplier deactivated' });
  } catch (err) {
    next(err);
  }
};
