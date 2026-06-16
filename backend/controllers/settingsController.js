const Settings = require('../models/Settings');
const { getSettings, logActivity } = require('../utils/helpers');

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
};

exports.updateSettings = async (req, res, next) => {
  try {
    let settings = await getSettings();
    Object.assign(settings, req.body);
    await settings.save();
    await logActivity(req.user.id, 'update', 'settings', 'Updated company settings');
    res.json({ settings });
  } catch (err) {
    next(err);
  }
};

exports.uploadLogo = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    let settings = await getSettings();
    settings.logo = `/uploads/logos/${req.file.filename}`;
    await settings.save();
    res.json({ settings });
  } catch (err) {
    next(err);
  }
};
