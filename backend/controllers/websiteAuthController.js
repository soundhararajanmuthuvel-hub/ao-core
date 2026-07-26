const WebsiteCustomer = require('../models/WebsiteCustomer');
const WebsiteReferral = require('../models/WebsiteReferral');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

// POST /api/website/auth/register
const register = async (req, res) => {
  try {
    const { fullName, mobile, email, city, state, password, referralCode } = req.body;

    if (!fullName || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Mobile Number, and Password are required.',
      });
    }

    const existingCustomer = await WebsiteCustomer.findOne({ where: { mobile } });
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'An account with this mobile number already exists.',
      });
    }

    // Create customer
    const newCustomer = await WebsiteCustomer.create({
      fullName,
      mobile,
      email: email || null,
      city: city || null,
      state: state || null,
      password,
    });

    // Check referral code if supplied
    let referralApplied = false;
    if (referralCode) {
      const referrer = await WebsiteCustomer.findOne({
        where: { referralCode: referralCode.trim().toUpperCase() },
      });

      if (referrer && referrer.id !== newCustomer.id) {
        await WebsiteReferral.create({
          referrerCustomerId: referrer.id,
          referredCustomerId: newCustomer.id,
          referralCodeUsed: referralCode.trim().toUpperCase(),
          status: 'Pending',
        });
        referralApplied = true;
      }
    }

    const token = jwt.sign(
      { customerId: newCustomer.id, mobile: newCustomer.mobile },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      customer: {
        id: newCustomer.id,
        fullName: newCustomer.fullName,
        mobile: newCustomer.mobile,
        email: newCustomer.email,
        city: newCustomer.city,
        state: newCustomer.state,
        referralCode: newCustomer.referralCode,
        accountCredit: newCustomer.accountCredit,
      },
      referralApplied,
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ success: false, message: 'Customer registration failed.' });
  }
};

// POST /api/website/auth/login
const login = async (req, res) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || !password) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and password are required.',
      });
    }

    const customer = await WebsiteCustomer.scope('withPassword').findOne({
      where: { mobile, isActive: true },
    });

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number or password.',
      });
    }

    const isMatch = await customer.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number or password.',
      });
    }

    customer.lastLoginAt = new Date();
    await customer.save();

    const token = jwt.sign(
      { customerId: customer.id, mobile: customer.mobile },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        mobile: customer.mobile,
        email: customer.email,
        city: customer.city,
        state: customer.state,
        referralCode: customer.referralCode,
        accountCredit: customer.accountCredit,
      },
    });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ success: false, message: 'Login failed.' });
  }
};

// POST /api/website/auth/forgot-password
const forgotPassword = async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) {
      return res.status(400).json({ success: false, message: 'Mobile number is required.' });
    }

    const customer = await WebsiteCustomer.findOne({ where: { mobile, isActive: true } });
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'No active account found for this mobile number.',
      });
    }

    res.json({
      success: true,
      message: 'Password reset request received. Please contact customer support or administrator to verify reset.',
    });
  } catch (err) {
    console.error('Forgot Password Error:', err);
    res.status(500).json({ success: false, message: 'Password reset request failed.' });
  }
};

// POST /api/website/auth/reset-password
const resetPassword = async (req, res) => {
  try {
    const { mobile, newPassword } = req.body;
    if (!mobile || !newPassword) {
      return res.status(400).json({ success: false, message: 'Mobile number and new password required.' });
    }

    const customer = await WebsiteCustomer.scope('withPassword').findOne({ where: { mobile } });
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer account not found.' });
    }

    customer.password = newPassword;
    await customer.save();

    res.json({
      success: true,
      message: 'Password has been updated successfully. Please log in with your new password.',
    });
  } catch (err) {
    console.error('Reset Password Error:', err);
    res.status(500).json({ success: false, message: 'Password reset failed.' });
  }
};

// POST /api/website/checkout/guest
const guestCheckout = async (req, res) => {
  try {
    const { fullName, mobile, email, city, state, streetAddress, pincode } = req.body;

    if (!fullName || !mobile || !pincode || !streetAddress) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Mobile Number, Street Address, and Pincode are required for guest checkout.',
      });
    }

    res.json({
      success: true,
      message: 'Guest checkout details validated.',
      guestDetails: {
        fullName,
        mobile,
        email: email || '',
        shippingAddress: {
          fullName,
          phone: mobile,
          streetAddress,
          city: city || '',
          state: state || '',
          pincode,
        },
      },
    });
  } catch (err) {
    console.error('Guest Checkout Error:', err);
    res.status(500).json({ success: false, message: 'Guest checkout validation failed.' });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  guestCheckout,
};
