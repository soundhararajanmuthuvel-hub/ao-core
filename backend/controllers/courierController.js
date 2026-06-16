const Courier = require('../models/Courier');
const { logActivity } = require('../utils/helpers');

// GET /api/couriers
exports.getCouriers = async (req, res, next) => {
  try {
    const couriers = await Courier.findAll({
      order: [['name', 'ASC']],
    });
    res.json({ couriers });
  } catch (err) {
    next(err);
  }
};

// POST /api/couriers
exports.createCourier = async (req, res, next) => {
  try {
    const { name, phone, website, trackingUrlFormat } = req.body;
    if (!name) {
      return res.status(400).json({ message: 'Courier name is required' });
    }

    const courier = await Courier.create({
      name,
      phone,
      website,
      trackingUrlFormat,
      isActive: true,
    });

    await logActivity(req.user.id, 'CREATE', 'Courier', `Created courier partner ${name}`);
    res.status(201).json({ courier });
  } catch (err) {
    next(err);
  }
};

// PUT /api/couriers/:id
exports.updateCourier = async (req, res, next) => {
  try {
    const { name, phone, website, trackingUrlFormat, isActive } = req.body;
    const courier = await Courier.findByPk(req.params.id);
    if (!courier) {
      return res.status(404).json({ message: 'Courier partner not found' });
    }

    await courier.update({
      name: name !== undefined ? name : courier.name,
      phone: phone !== undefined ? phone : courier.phone,
      website: website !== undefined ? website : courier.website,
      trackingUrlFormat: trackingUrlFormat !== undefined ? trackingUrlFormat : courier.trackingUrlFormat,
      isActive: isActive !== undefined ? isActive : courier.isActive,
    });

    await logActivity(req.user.id, 'UPDATE', 'Courier', `Updated courier partner ${courier.name}`);
    res.json({ courier });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/couriers/:id
exports.deleteCourier = async (req, res, next) => {
  try {
    const courier = await Courier.findByPk(req.params.id);
    if (!courier) {
      return res.status(404).json({ message: 'Courier partner not found' });
    }

    const name = courier.name;
    // We soft-deactivate rather than full hard-delete to maintain history integrity
    courier.isActive = false;
    await courier.save();

    await logActivity(req.user.id, 'DELETE', 'Courier', `Deactivated courier partner ${name}`);
    res.json({ success: true, message: `Courier partner ${name} successfully deactivated.` });
  } catch (err) {
    next(err);
  }
};
