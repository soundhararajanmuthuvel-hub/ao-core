const Settings = require('../models/Settings');
const { getSettings, logActivity } = require('../utils/helpers');
const WooCommerceService = require('../utils/wooService');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

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
    const { clearSettingsCache } = require('../utils/helpers');
    clearSettingsCache();
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
    const { clearSettingsCache } = require('../utils/helpers');
    clearSettingsCache();
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

exports.getSettingsLogo = async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({
      logo: settings.logoUrl || settings.logo || "/uploads/default-logo.png"
    });
  } catch (err) {
    next(err);
  }
};

exports.getCompanyLogoImage = async (req, res, next) => {
  try {
    const settings = await getSettings();
    const logoUrl = settings.logoUrl || settings.logo || "/uploads/default-logo.png";

    const cacheDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    const cachePath = path.join(cacheDir, 'company-logo-cached.jpg');

    if (logoUrl.startsWith('/uploads') || logoUrl.startsWith('uploads')) {
      const cleanPath = logoUrl.startsWith('/') ? logoUrl.substring(1) : logoUrl;
      const localPath = path.join(__dirname, '..', cleanPath);
      if (fs.existsSync(localPath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        return res.sendFile(localPath);
      }
    }

    try {
      const response = await axios({
        method: 'get',
        url: logoUrl,
        responseType: 'stream',
        timeout: 5000
      });

      res.setHeader('Content-Type', 'image/jpeg');

      const fileStream = fs.createWriteStream(cachePath);
      response.data.pipe(fileStream);
      response.data.pipe(res);
    } catch (downloadErr) {
      console.error('Failed to download logo server-side:', downloadErr.message);
      if (fs.existsSync(cachePath)) {
        res.setHeader('Content-Type', 'image/jpeg');
        return res.sendFile(cachePath);
      }
      
      const defaultPath = path.join(__dirname, '../uploads/default-logo.png');
      if (fs.existsSync(defaultPath)) {
        res.setHeader('Content-Type', 'image/png');
        return res.sendFile(defaultPath);
      }
      return res.status(404).send('Logo not found');
    }
  } catch (err) {
    next(err);
  }
};
