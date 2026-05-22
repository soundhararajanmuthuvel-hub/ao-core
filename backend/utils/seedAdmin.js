require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Settings = require('../models/Settings');

const seed = async () => {
  try {
    const uri = (process.env.MONGO_URI || process.env.MONGODB_URI || '').trim();
    if (!uri) {
      throw new Error('MONGO_URI is not defined in environment');
    }

    await mongoose.connect(uri);
    const existing = await User.findOne({ email: 'admin@aocore.com' });
    if (!existing) {
      await User.create({
        name: 'Admin',
        email: 'admin@aocore.com',
        password: 'Admin@123',
        role: 'admin',
        isActive: true,
      });
      console.log('Admin user created: admin@aocore.com / Admin@123');
    } else {
      console.log('Admin user already exists');
    }
    const settings = await Settings.findOne();
    if (!settings) {
      await Settings.create({ companyName: 'AO Core Organic' });
      console.log('Default settings created');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seed();
