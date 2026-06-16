const Settings = require('../models/Settings');
const { getSettings, logActivity } = require('../utils/helpers');
const WooCommerceService = require('../utils/wooService');
const fs = require('fs');

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

exports.uploadLogoToWordPress = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const settings = await getSettings();
    if (!settings.wooConnected || !settings.wooUrl) {
      return res.status(400).json({ message: 'WordPress/WooCommerce is not connected. Please configure and connect it in WooCommerce Settings first.' });
    }

    const wooService = new WooCommerceService(settings);
    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const mimeType = req.file.mimetype;

    const wpMedia = await wooService.uploadMedia(filePath, fileName, mimeType);

    // Clean up temporary local file
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.error('Failed to delete temp logo file:', err.message);
    }

    if (wpMedia && wpMedia.source_url) {
      return res.json({ success: true, url: wpMedia.source_url });
    } else {
      return res.status(500).json({ message: 'Failed to upload media to WordPress' });
    }
  } catch (err) {
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (_) {}
    }
    next(err);
  }
};
