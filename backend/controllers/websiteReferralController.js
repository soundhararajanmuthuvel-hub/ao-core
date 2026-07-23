const WebsiteReferral = require('../models/WebsiteReferral');
const WebsiteCustomer = require('../models/WebsiteCustomer');
const WebsiteCoupon = require('../models/WebsiteCoupon');

// POST /api/website/referrals/submit
const submitReferral = async (req, res) => {
  try {
    const customerId = req.websiteCustomer.id;
    const { referralCode } = req.body;

    if (!referralCode) {
      return res.status(400).json({ success: false, message: 'Referral code is required.' });
    }

    const codeUpper = referralCode.trim().toUpperCase();
    const referrer = await WebsiteCustomer.findOne({ where: { referralCode: codeUpper } });

    if (!referrer) {
      return res.status(404).json({ success: false, message: 'Invalid referral code.' });
    }

    if (referrer.id === customerId) {
      return res.status(400).json({ success: false, message: 'You cannot refer yourself.' });
    }

    const existing = await WebsiteReferral.findOne({
      where: { referredCustomerId: customerId },
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'Referral code already applied for this account.' });
    }

    const referral = await WebsiteReferral.create({
      referrerCustomerId: referrer.id,
      referredCustomerId: customerId,
      referralCodeUsed: codeUpper,
      status: 'Pending',
    });

    res.status(201).json({
      success: true,
      message: 'Referral code submitted successfully! Pending admin approval.',
      data: referral,
    });
  } catch (err) {
    console.error('Error submitting referral:', err);
    res.status(500).json({ success: false, message: 'Failed to submit referral code' });
  }
};

// GET /api/website/referrals/my-referrals
const getMyReferrals = async (req, res) => {
  try {
    const customerId = req.websiteCustomer.id;
    const referrals = await WebsiteReferral.findAll({
      where: { referrerCustomerId: customerId },
      order: [['createdAt', 'DESC']],
    });

    const rewardCoupons = await WebsiteCoupon.findAll({
      where: { websiteCustomerId: customerId, isActive: true },
      order: [['createdAt', 'DESC']],
    });

    const customer = await WebsiteCustomer.findByPk(customerId);

    res.json({
      success: true,
      referralCode: customer.referralCode,
      accountCredit: customer.accountCredit,
      totalReferrals: referrals.length,
      approvedReferrals: referrals.filter((r) => r.status === 'Approved').length,
      pendingReferrals: referrals.filter((r) => r.status === 'Pending').length,
      referralsList: referrals,
      earnedCoupons: rewardCoupons,
    });
  } catch (err) {
    console.error('Error fetching customer referrals:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch referral data' });
  }
};

// GET /api/website/referrals/my-code
const getMyCode = async (req, res) => {
  try {
    const customer = req.websiteCustomer;
    const shareText = `Use my referral code ${customer.referralCode} to get exclusive discounts on Blovit Malts!`;

    res.json({
      success: true,
      referralCode: customer.referralCode,
      shareText,
    });
  } catch (err) {
    console.error('Error fetching referral code:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch referral code' });
  }
};

module.exports = {
  submitReferral,
  getMyReferrals,
  getMyCode,
};
