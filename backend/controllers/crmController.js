const { Op } = require('sequelize');
const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const User = require('../models/User');
const CrmOpportunity = require('../models/CrmOpportunity');
const CrmFollowUp = require('../models/CrmFollowUp');
const CrmNote = require('../models/CrmNote');
const Visit = require('../models/Visit');
const CustomerReview = require('../models/CustomerReview');
const Invoice = require('../models/Invoice');
const territoryService = require('../utils/territoryService');

// MOCK SIMULATED LEADS DATABASE FOR THE LEAD FINDER
const MOCK_LEADS_SOURCE = [
  // Madurai
  { shopName: 'Muthu Organic Millet Stores', category: 'Millet Stores', ownerName: 'Muthuvel S.', mobileNumber: '9443210981', address: '12, Anna Nagar Main Road, Madurai', state: 'Tamil Nadu', city: 'Madurai', district: 'Madurai', pincode: '625020', website: 'muthumillets.com', source: 'Google Business', latitude: 9.9265, longitude: 78.1215 },
  { shopName: 'Vasantham Supermarket', category: 'Supermarkets', ownerName: 'Vasanth Kumar', mobileNumber: '9842109876', address: '45, K.K. Nagar, Madurai', state: 'Tamil Nadu', city: 'Madurai', district: 'Madurai', pincode: '625020', website: 'vasantham.co.in', source: 'Justdial', latitude: 9.9280, longitude: 78.1290 },
  { shopName: 'Pandian Ayurvedic Kadai', category: 'Ayurvedic Shops', ownerName: 'Pandian Pillai', mobileNumber: '9003567812', address: '7, Goripalayam Junction, Madurai', state: 'Tamil Nadu', city: 'Madurai', district: 'Madurai', pincode: '625002', website: '', source: 'IndiaMART', latitude: 9.9320, longitude: 78.1220 },
  { shopName: 'Meenakshi Nattu Marundhu Kadai', category: 'Nattu Marundhu Kadai', ownerName: 'Sundaresan', mobileNumber: '9629123456', address: '102, South Masi Street, Periyar, Madurai', state: 'Tamil Nadu', city: 'Madurai', district: 'Madurai', pincode: '625001', website: '', source: 'Google Business', latitude: 9.9150, longitude: 78.1150 },
  { shopName: 'Nellai Dry Fruits & Nuts', category: 'Dry Fruit Shops', ownerName: 'Nellaiyappan', mobileNumber: '9894123123', address: '18, Thirumangalam Road, Madurai South', state: 'Tamil Nadu', city: 'Madurai', district: 'Madurai', pincode: '625006', website: 'nellaidryfruits.com', source: 'Justdial', latitude: 9.9015, longitude: 78.1105 },

  // Trichy
  { shopName: 'Srirangam Health Food Center', category: 'Health Food Stores', ownerName: 'Ranganathan K.', mobileNumber: '9488123450', address: '54, Srirangam Bazaar Street, Trichy', state: 'Tamil Nadu', city: 'Trichy', district: 'Tiruchirappalli', pincode: '620006', website: 'trichyhealthfoods.org', source: 'Google Business', latitude: 10.8620, longitude: 78.6980 },
  { shopName: 'Cauvery Organic Farms Outlet', category: 'Organic Stores', ownerName: 'Ramarajan', mobileNumber: '9943298765', address: 'B-12, Thillai Nagar, Trichy', state: 'Tamil Nadu', city: 'Trichy', district: 'Tiruchirappalli', pincode: '620018', website: 'cauveryorganics.in', source: 'Facebook', latitude: 10.8120, longitude: 78.6860 },
  { shopName: 'Rockfort Department Store', category: 'Department Stores', ownerName: 'Selvamurugan', mobileNumber: '9843212345', address: 'Bypass Road, Trichy Central', state: 'Tamil Nadu', city: 'Trichy', district: 'Tiruchirappalli', pincode: '620001', website: '', source: 'Justdial', latitude: 10.7910, longitude: 78.7050 },

  // Chennai
  { shopName: 'Adyar Organic Bazaar', category: 'Organic Stores', ownerName: 'Karthik Raja', mobileNumber: '9840912345', address: '19, L.B. Road, Adyar, Chennai', state: 'Tamil Nadu', city: 'Chennai', district: 'Chennai', pincode: '600020', website: 'adyarorganicbazaar.com', source: 'Instagram', latitude: 13.0063, longitude: 80.2520 },
  { shopName: 'Mylapore Ayurvedic & Millet Hub', category: 'Millet Stores', ownerName: 'Subramanian', mobileNumber: '9790123987', address: '3, Luz Church Road, Mylapore, Chennai', state: 'Tamil Nadu', city: 'Chennai', district: 'Chennai', pincode: '600004', website: 'mylaporemillets.com', source: 'Google Business', latitude: 13.0310, longitude: 80.2605 },
  { shopName: 'T. Nagar Health & Herbals', category: 'Health Food Stores', ownerName: 'Suresh Raina', mobileNumber: '9566123459', address: '8, Pondy Bazaar, T. Nagar, Chennai', state: 'Tamil Nadu', city: 'Chennai', district: 'Chennai', pincode: '600017', website: 'tnagarhealth.com', source: 'Justdial', latitude: 13.0400, longitude: 80.2350 },

  // Coimbatore
  { shopName: 'Kovai Millet World', category: 'Millet Stores', ownerName: 'Ganesan K.', mobileNumber: '9444123789', address: '88, Avinashi Road, Peelamedu, Coimbatore', state: 'Tamil Nadu', city: 'Coimbatore', district: 'Coimbatore', pincode: '641004', website: 'kovaimillets.com', source: 'Google Business', latitude: 11.0260, longitude: 76.9950 },
  { shopName: 'Peelamedu Super Food Market', category: 'Supermarkets', ownerName: 'Manikandan', mobileNumber: '9894098765', address: '12, Cross Cut Road, Gandhipuram, Coimbatore', state: 'Tamil Nadu', city: 'Coimbatore', district: 'Coimbatore', pincode: '641012', website: '', source: 'IndiaMART', latitude: 11.0180, longitude: 76.9640 },
  { shopName: 'Western Ghats Organic Farms', category: 'Organic Farms', ownerName: 'Senthil Kumar', mobileNumber: '9003987654', address: 'Outlet road, Coimbatore East', state: 'Tamil Nadu', city: 'Coimbatore', district: 'Coimbatore', pincode: '641015', website: 'wgorfgans.org', source: 'Facebook', latitude: 11.0160, longitude: 76.9560 }
];

/* ==================================================
   CRM DASHBOARD ANALYTICS
   ================================================== */
exports.crmDashboard = async (req, res, next) => {
  try {
    const totalLeads = await Lead.count();
    const newLeads = await Lead.count({ where: { status: 'New' } });
    const convertedLeads = await Lead.count({ where: { status: 'Customer' } });
    const conversionRate = totalLeads > 0 ? Number(((convertedLeads / totalLeads) * 100).toFixed(1)) : 0;

    const opportunities = await CrmOpportunity.findAll();
    const totalPipelineValue = opportunities
      .filter(o => o.stage !== 'Lost' && o.stage !== 'Won')
      .reduce((sum, o) => sum + Number(o.value || 0), 0);

    const followUps = await CrmFollowUp.findAll();
    const pendingFollowUps = followUps.filter(f => f.status === 'Pending').length;
    const completedFollowUps = followUps.filter(f => f.status === 'Completed').length;
    const missedFollowUps = followUps.filter(f => f.status === 'Missed').length;

    // Status breakdown
    const statuses = ['New', 'Assigned', 'Visited', 'Interested', 'Customer', 'Rejected'];
    const statusBreakdown = [];
    for (const stat of statuses) {
      const count = await Lead.count({ where: { status: stat } });
      statusBreakdown.push({ status: stat, count });
    }

    // Category breakdown
    const leads = await Lead.findAll({ attributes: ['category', 'source'] });
    const categoryMap = {};
    const sourceMap = {};
    leads.forEach(l => {
      if (l.category) categoryMap[l.category] = (categoryMap[l.category] || 0) + 1;
      if (l.source) sourceMap[l.source] = (sourceMap[l.source] || 0) + 1;
    });

    res.json({
      totalLeads,
      newLeads,
      convertedLeads,
      conversionRate,
      totalPipelineValue,
      followUpStats: {
        pending: pendingFollowUps,
        completed: completedFollowUps,
        missed: missedFollowUps
      },
      statusBreakdown,
      categoryBreakdown: Object.keys(categoryMap).map(k => ({ category: k, count: categoryMap[k] })),
      sourceBreakdown: Object.keys(sourceMap).map(k => ({ source: k, count: sourceMap[k] }))
    });
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   LEADS CRUD
   ================================================== */
exports.getLeads = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;
    if (req.query.category) query.category = req.query.category;
    if (req.query.assignedSalesmanId) query.assignedSalesmanId = req.query.assignedSalesmanId;

    if (req.query.search) {
      query[Op.or] = [
        { shopName: { [Op.like]: `%${req.query.search}%` } },
        { ownerName: { [Op.like]: `%${req.query.search}%` } },
        { city: { [Op.like]: `%${req.query.search}%` } }
      ];
    }

    const leads = await Lead.findAll({
      where: query,
      include: [{ model: User, as: 'salesman', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']]
    });

    res.json(leads);
  } catch (err) {
    next(err);
  }
};

exports.getLead = async (req, res, next) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [
        { model: User, as: 'salesman', attributes: ['id', 'name', 'phone'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'customerCode'] }
      ]
    });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json(lead);
  } catch (err) {
    next(err);
  }
};

exports.createLead = async (req, res, next) => {
  try {
    const leadData = { ...req.body };

    // Automatically resolve territory, routeZone and salesman
    const resolution = territoryService.resolveTerritoryAndSalesman(
      leadData.latitude,
      leadData.longitude,
      leadData.address
    );

    leadData.latitude = leadData.latitude !== undefined && leadData.latitude !== null ? leadData.latitude : resolution.latitude;
    leadData.longitude = leadData.longitude !== undefined && leadData.longitude !== null ? leadData.longitude : resolution.longitude;
    leadData.assignedSalesmanId = leadData.assignedSalesmanId || resolution.assignedSalesmanId;
    leadData.area = leadData.area || resolution.territory;

    const lead = await Lead.create(leadData);
    res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
};

exports.updateLead = async (req, res, next) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const updateData = { ...req.body };
    if (updateData.address || updateData.latitude !== undefined || updateData.longitude !== undefined) {
      const resolution = territoryService.resolveTerritoryAndSalesman(
        updateData.latitude ?? lead.latitude,
        updateData.longitude ?? lead.longitude,
        updateData.address ?? lead.address
      );
      updateData.latitude = updateData.latitude ?? resolution.latitude;
      updateData.longitude = updateData.longitude ?? resolution.longitude;
      updateData.assignedSalesmanId = updateData.assignedSalesmanId ?? resolution.assignedSalesmanId;
      updateData.area = updateData.area ?? resolution.territory;
    }

    await lead.update(updateData);
    res.json(lead);
  } catch (err) {
    next(err);
  }
};

exports.deleteLead = async (req, res, next) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    await lead.destroy();
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   LEAD FINDER (SIMULATED BUSINESS DIRECTORY)
   ================================================== */
exports.findSimulatedLeads = async (req, res, next) => {
  try {
    const { category, city } = req.query;
    if (!category || !city) {
      return res.status(400).json({ message: 'Please specify category and city to run query.' });
    }

    const catLower = category.toLowerCase();
    const cityLower = city.toLowerCase();

    // Filter our static mock leads database
    const results = MOCK_LEADS_SOURCE.filter(l => 
      l.category.toLowerCase().includes(catLower) && 
      l.city.toLowerCase().includes(cityLower)
    );

    // Filter out mock leads that are already imported into local db
    const currentLeads = await Lead.findAll({ attributes: ['shopName'] });
    const importedNames = currentLeads.map(l => l.shopName.toLowerCase());

    const filteredResults = results.map(r => ({
      ...r,
      isImported: importedNames.includes(r.shopName.toLowerCase())
    }));

    res.json(filteredResults);
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   LEAD TO CUSTOMER CONVERSION
   ================================================== */
exports.convertLead = async (req, res, next) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (lead.status === 'Customer') {
      return res.status(400).json({ message: 'Lead has already been converted to a customer.' });
    }

    // Convert lead: create customer record.
    // Sequential Customer ID generation will occur inside beforeCreate hooks of Customer model
    const customer = await Customer.create({
      name: lead.shopName,
      phone: lead.mobileNumber,
      email: lead.mobileNumber ? `${lead.mobileNumber}@ao-retailer.com` : `lead_${lead.id}@ao.com`,
      address: lead.address,
      latitude: lead.latitude,
      longitude: lead.longitude,
      contactPerson: lead.ownerName || '',
      state: lead.state || 'Tamil Nadu',
      pincode: lead.pincode || '',
      customerType: 'Retail Shop',
      leadId: lead.id,
      tier: 'RED' // Default high-margin pricing tier on conversion
    });

    // Update Lead status and reference
    await lead.update({
      status: 'Customer',
      customerId: customer.id
    });

    // Re-link notes, followups, and visits to the customer record
    await CrmNote.update({ customerId: customer.id }, { where: { leadId: lead.id } });
    await CrmFollowUp.update({ customerId: customer.id }, { where: { leadId: lead.id } });
    await Visit.update({ customerId: customer.id }, { where: { leadId: lead.id } });

    res.json({
      message: `Lead successfully converted to Customer! Code ${customer.customerCode} generated.`,
      customer,
      lead
    });
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   OPPORTUNITIES CRUD
   ================================================== */
exports.getOpportunities = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.stage) query.stage = req.query.stage;

    const opportunities = await CrmOpportunity.findAll({
      where: query,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'shopName', 'ownerName'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'customerCode'] }
      ],
      order: [['closeDate', 'ASC']]
    });
    res.json(opportunities);
  } catch (err) {
    next(err);
  }
};

exports.createOpportunity = async (req, res, next) => {
  try {
    const opportunity = await CrmOpportunity.create(req.body);
    res.status(201).json(opportunity);
  } catch (err) {
    next(err);
  }
};

exports.updateOpportunity = async (req, res, next) => {
  try {
    const opportunity = await CrmOpportunity.findByPk(req.params.id);
    if (!opportunity) return res.status(404).json({ message: 'Opportunity not found' });
    await opportunity.update(req.body);
    res.json(opportunity);
  } catch (err) {
    next(err);
  }
};

exports.deleteOpportunity = async (req, res, next) => {
  try {
    const opportunity = await CrmOpportunity.findByPk(req.params.id);
    if (!opportunity) return res.status(404).json({ message: 'Opportunity not found' });
    await opportunity.destroy();
    res.json({ message: 'Opportunity deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   FOLLOW-UPS MANAGEMENT
   ================================================== */
exports.getFollowUps = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.status) query.status = req.query.status;

    // Run dynamic cron simulation: mark past pending followups as "Missed"
    const now = new Date();
    await CrmFollowUp.update(
      { status: 'Missed' },
      {
        where: {
          status: 'Pending',
          followUpDate: { [Op.lt]: now }
        }
      }
    );

    const followUps = await CrmFollowUp.findAll({
      where: query,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'shopName', 'mobileNumber'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'customerCode'] }
      ],
      order: [['followUpDate', 'ASC']]
    });

    res.json(followUps);
  } catch (err) {
    next(err);
  }
};

exports.createFollowUp = async (req, res, next) => {
  try {
    const data = { ...req.body, createdById: req.user?.id };
    const followUp = await CrmFollowUp.create(data);
    res.status(201).json(followUp);
  } catch (err) {
    next(err);
  }
};

exports.updateFollowUp = async (req, res, next) => {
  try {
    const followUp = await CrmFollowUp.findByPk(req.params.id);
    if (!followUp) return res.status(404).json({ message: 'Follow-up not found' });
    await followUp.update(req.body);
    res.json(followUp);
  } catch (err) {
    next(err);
  }
};

exports.deleteFollowUp = async (req, res, next) => {
  try {
    const followUp = await CrmFollowUp.findByPk(req.params.id);
    if (!followUp) return res.status(404).json({ message: 'Follow-up not found' });
    await followUp.destroy();
    res.json({ message: 'Follow-up deleted successfully' });
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   CUSTOMER REVIEWS (CRM DISPLAY)
   ================================================== */
exports.getReviewsList = async (req, res, next) => {
  try {
    const reviews = await CustomerReview.findAll({
      include: [
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'customerCode'] },
        { model: Invoice, as: 'invoice', attributes: ['id', 'invoiceNumber'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const scores = reviews.filter(r => r.status === 'Submitted');
    const avgOverall = scores.length > 0 ? (scores.reduce((sum, r) => sum + r.overallRating, 0) / scores.length).toFixed(1) : '5.0';

    res.json({
      averageOverallRating: Number(avgOverall),
      totalReviewsSubmitted: scores.length,
      reviews
    });
  } catch (err) {
    next(err);
  }
};

exports.sendReviewInvite = async (req, res, next) => {
  try {
    const { invoiceId } = req.body;
    if (!invoiceId) return res.status(400).json({ message: 'Invoice ID is required' });

    const invoice = await Invoice.findByPk(invoiceId, {
      include: [{ model: Customer, as: 'customer' }]
    });

    if (!invoice) return res.status(404).json({ message: 'Invoice not found' });
    if (!invoice.customer) return res.status(400).json({ message: 'Invoice customer not set' });

    const token = 'rev_' + Math.random().toString(36).substr(2, 9);
    
    // Create pending review session
    const review = await CustomerReview.create({
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      token,
      status: 'Pending'
    });

    // Format WhatsApp text reminder
    const reviewUrl = `${req.protocol}://${req.get('host')}/reviews/portal/${token}`;
    const messageText = `Dear ${invoice.customer.name},\n\nThank you for shopping with Amudhasurabiy Organics! We have delivered invoice ${invoice.invoiceNumber}. We would love to hear your feedback on product quality, delivery experience, and salesman behavior.\n\nPlease complete our 1-minute rating form here:\n${reviewUrl}\n\nHave a great day!`;

    let phone = invoice.customer.phone || '';
    phone = phone.replace(/\D/g, '');
    if (phone.length === 10) phone = '91' + phone;

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(messageText)}`;

    res.json({
      success: true,
      whatsappUrl,
      messageText,
      review
    });
  } catch (err) {
    next(err);
  }
};
