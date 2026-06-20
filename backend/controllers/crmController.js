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
const axios = require('axios');

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
    const allLeadsForStats = await Lead.findAll({
      attributes: ['area', 'assignedSalesmanId', 'status', 'createdAt'],
      include: [{ model: User, as: 'salesman', attributes: ['id', 'name'] }]
    });

    // Leads Found Today (local timezone start of day)
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const leadsFoundToday = allLeadsForStats.filter(l => new Date(l.createdAt) >= startOfDay).length;

    const totalLeads = allLeadsForStats.length;
    const newLeads = allLeadsForStats.filter(l => l.status === 'New').length;
    const assignedLeads = allLeadsForStats.filter(l => l.status === 'Assigned').length;
    const convertedLeads = allLeadsForStats.filter(l => l.status === 'Customer').length;
    const conversionRate = totalLeads > 0 ? Number(((convertedLeads / totalLeads) * 100).toFixed(1)) : 0;

    // Top Territories
    const territoryCounts = {};
    allLeadsForStats.forEach(l => {
      if (l.area) {
        territoryCounts[l.area] = (territoryCounts[l.area] || 0) + 1;
      }
    });
    const topTerritories = Object.keys(territoryCounts)
      .map(name => ({ territory: name, count: territoryCounts[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Top Salesmen
    const salesmanCounts = {};
    allLeadsForStats.forEach(l => {
      if (l.assignedSalesmanId) {
        const name = l.salesman ? l.salesman.name : 'Unknown';
        salesmanCounts[name] = (salesmanCounts[name] || 0) + 1;
      }
    });
    const topSalesmen = Object.keys(salesmanCounts)
      .map(name => ({ salesmanName: name, count: salesmanCounts[name] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

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
      const count = allLeadsForStats.filter(l => l.status === stat).length;
      statusBreakdown.push({ status: stat, count });
    }

    // Category breakdown
    const categoryMap = {};
    const sourceMap = {};
    const leadsWithDetails = await Lead.findAll({ attributes: ['category', 'source'] });
    leadsWithDetails.forEach(l => {
      if (l.category) categoryMap[l.category] = (categoryMap[l.category] || 0) + 1;
      if (l.source) sourceMap[l.source] = (sourceMap[l.source] || 0) + 1;
    });

    res.json({
      totalLeads,
      newLeads,
      assignedLeads,
      leadsFoundToday,
      convertedLeads,
      conversionRate,
      topTerritories,
      topSalesmen,
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
    let { city, district, state, radius, categories } = req.query;
    
    // Support backward compatibility (old code sent city and category)
    if (!city && req.query.city) city = req.query.city;
    const singleCategory = req.query.category;
    
    // Standardize input values
    const searchCity = city || 'Madurai';
    const searchDistrict = district || '';
    const searchState = state || 'Tamil Nadu';
    const searchRadiusKm = radius ? parseFloat(radius) : 10;
    
    let searchCategories = [];
    if (categories) {
      if (Array.isArray(categories)) {
        searchCategories = categories;
      } else if (typeof categories === 'string') {
        searchCategories = categories.split(',').map(c => c.trim()).filter(Boolean);
      }
    } else if (singleCategory) {
      searchCategories = [singleCategory];
    } else {
      // Default to all supported categories
      searchCategories = [
        'Organic Stores', 'Supermarkets', 'Department Stores', 'Nattu Marundhu Kadai',
        'Health Food Stores', 'Ayurvedic Shops', 'Millet Stores', 'Dry Fruit Shops', 'Organic Farms'
      ];
    }

    console.log(`Lead Finder: Scan started for ${searchCity}, Radius: ${searchRadiusKm} KM, Categories: ${searchCategories.join(', ')}`);

    // 1. Geocode City, District, State to get center lat, lon
    let lat = null;
    let lon = null;
    
    const geocodeQuery = [searchCity, searchDistrict, searchState, 'India'].filter(Boolean).join(', ');
    
    try {
      const geoRes = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: geocodeQuery,
          format: 'json',
          limit: 1
        },
        headers: {
          'User-Agent': 'AO-ERP-Lead-Finder/1.0 (dines@ao.com)'
        },
        timeout: 6000 // 6 seconds timeout
      });

      if (geoRes.data && geoRes.data.length > 0) {
        lat = parseFloat(geoRes.data[0].lat);
        lon = parseFloat(geoRes.data[0].lon);
        console.log(`Lead Finder: Geocoded "${geocodeQuery}" to lat: ${lat}, lon: ${lon}`);
      }
    } catch (geoErr) {
      console.error('Lead Finder Geocoding failed, using fallbacks:', geoErr.message);
    }

    // Fallback coordinates for common cities in Tamil Nadu
    if (!lat || !lon) {
      const cityLower = searchCity.toLowerCase();
      if (cityLower.includes('madurai')) {
        lat = 9.9252; lon = 78.1198;
      } else if (cityLower.includes('chennai') || cityLower.includes('madras')) {
        lat = 13.0827; lon = 80.2707;
      } else if (cityLower.includes('coimbatore') || cityLower.includes('kovai')) {
        lat = 11.0168; lon = 76.9558;
      } else if (cityLower.includes('trichy') || cityLower.includes('tiruchirappalli')) {
        lat = 10.7905; lon = 78.7047;
      } else if (cityLower.includes('salem')) {
        lat = 11.6643; lon = 78.1460;
      } else if (cityLower.includes('kumbakonam')) {
        lat = 10.9602; lon = 79.3845;
      } else if (cityLower.includes('thirunelveli') || cityLower.includes('tirunelveli')) {
        lat = 8.7139; lon = 77.7567;
      } else {
        // Ultimate fallback
        lat = 9.9252; lon = 78.1198;
      }
      console.log(`Lead Finder: Using fallback coordinates for ${searchCity}: lat: ${lat}, lon: ${lon}`);
    }

    // Map Category names to OSM shop values
    const CATEGORY_MAP = {
      'Organic Stores': 'organic',
      'Supermarkets': 'supermarket',
      'Department Stores': 'department_store',
      'Nattu Marundhu Kadai': 'herbalist',
      'Health Food Stores': 'health_food',
      'Ayurvedic Shops': 'ayurvedic',
      'Millet Stores': 'grains',
      'Dry Fruit Shops': 'dry_fruits',
      'Organic Farms': 'farmland'
    };

    const osmShops = searchCategories
      .map(cat => CATEGORY_MAP[cat])
      .filter(Boolean)
      .join('|');

    const includeFarmland = searchCategories.includes('Organic Farms');
    const radiusMeters = searchRadiusKm * 1000;

    let elements = [];
    let isFallbackMode = false;

    // 2. Query Overpass API
    if (osmShops || includeFarmland) {
      try {
        const overpassQuery = `
          [out:json][timeout:15];
          (
            ${osmShops ? `node["shop"~"${osmShops}"](around:${radiusMeters},${lat},${lon});` : ''}
            ${osmShops ? `way["shop"~"${osmShops}"](around:${radiusMeters},${lat},${lon});` : ''}
            ${includeFarmland ? `node["landuse"="farmland"](around:${radiusMeters},${lat},${lon});` : ''}
            ${includeFarmland ? `way["landuse"="farmland"](around:${radiusMeters},${lat},${lon});` : ''}
          );
          out center;
        `;

        const overpassRes = await axios.post(
          'https://overpass-api.de/api/interpreter',
          `data=${encodeURIComponent(overpassQuery)}`,
          {
            headers: { 
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'AO-ERP-Lead-Finder/1.0 (dines@ao.com)'
            },
            timeout: 10000 // 10 seconds timeout
          }
        );

        if (overpassRes.data && overpassRes.data.elements) {
          elements = overpassRes.data.elements;
          console.log(`Lead Finder: Overpass returned ${elements.length} elements.`);
        }
      } catch (overpassErr) {
        console.error('Lead Finder: Overpass query failed, resorting to simulated fallback:', overpassErr.message);
        isFallbackMode = true;
      }
    }

    let parsedResults = [];

    // Reverse OSM mapping back to our category list
    const getTargetCategory = (shopTag, landuseTag) => {
      if (landuseTag === 'farmland') return 'Organic Farms';
      if (!shopTag) return 'Organic Stores';
      
      const s = shopTag.toLowerCase();
      if (s === 'organic') return 'Organic Stores';
      if (s === 'supermarket') return 'Supermarkets';
      if (s === 'department_store') return 'Department Stores';
      if (s === 'herbalist') return 'Nattu Marundhu Kadai';
      if (s === 'health_food') return 'Health Food Stores';
      if (s === 'ayurvedic') return 'Ayurvedic Shops';
      if (s === 'grains') return 'Millet Stores';
      if (s === 'dry_fruits' || s === 'nuts') return 'Dry Fruit Shops';
      
      return 'Organic Stores'; // Default category
    };

    if (elements.length > 0 && !isFallbackMode) {
      parsedResults = elements.map(el => {
        const tags = el.tags || {};
        const elLat = el.lat !== undefined ? el.lat : (el.center ? el.center.lat : lat);
        const elLon = el.lon !== undefined ? el.lon : (el.center ? el.center.lon : lon);
        
        const dist = territoryService.haversineDistance(lat, lon, elLat, elLon);

        // Build clean address representation
        const street = tags['addr:street'] || '';
        const house = tags['addr:housenumber'] || '';
        const suburb = tags['addr:suburb'] || tags['addr:neighbourhood'] || '';
        const elCity = tags['addr:city'] || searchCity;
        const state = tags['addr:state'] || 'Tamil Nadu';
        const pincode = tags['addr:postcode'] || '';

        const addressParts = [house, street, suburb].filter(Boolean);
        const fullAddress = addressParts.length > 0 
          ? addressParts.join(', ') 
          : `${tags.name || 'Shop'}, ${suburb || 'Local Area'}, ${elCity}`;

        const shopName = tags.name || `${getTargetCategory(tags.shop, tags.landuse)} Shop`;

        return {
          shopName,
          category: getTargetCategory(tags.shop, tags.landuse),
          ownerName: tags.operator || tags.contact || '',
          mobileNumber: tags.phone || tags['contact:phone'] || tags.mobile || '',
          address: fullAddress,
          city: elCity,
          district: tags['addr:district'] || searchDistrict || elCity,
          state: state,
          pincode: pincode,
          latitude: Number(Number(elLat).toFixed(6)),
          longitude: Number(Number(elLon).toFixed(6)),
          website: tags.website || tags['contact:website'] || '',
          source: 'OpenStreetMap',
          distanceFromCenter: Number(dist.toFixed(2))
        };
      });
    }

    // 3. Fallback to Local Mock Database if no Overpass results or if geocoding/overpass failed
    if (parsedResults.length === 0) {
      isFallbackMode = true;
      console.log('Lead Finder: Operating in local database fallback mode.');
      
      // Calculate distances for mock items from the computed center
      const lowerCity = searchCity.toLowerCase();
      
      const filteredMocks = MOCK_LEADS_SOURCE.filter(l => {
        // Match city
        const cityMatch = l.city.toLowerCase().includes(lowerCity) || lowerCity.includes(l.city.toLowerCase());
        // Match category
        const catMatch = searchCategories.some(cat => 
          l.category.toLowerCase().includes(cat.toLowerCase())
        );
        return cityMatch && catMatch;
      });

      parsedResults = filteredMocks.map(m => {
        const dist = territoryService.haversineDistance(lat, lon, m.latitude, m.longitude);
        return {
          ...m,
          distanceFromCenter: Number(dist.toFixed(2)),
          source: m.source + ' (Simulated)'
        };
      });
    }

    // Filter results by radius (since Overpass handles it, this is mainly for the mock fallback)
    parsedResults = parsedResults.filter(r => r.distanceFromCenter <= searchRadiusKm);

    // 4. Check if already imported
    const currentLeads = await Lead.findAll({ attributes: ['shopName', 'id', 'status'] });
    const importedMap = {};
    currentLeads.forEach(l => {
      importedMap[l.shopName.toLowerCase()] = { id: l.id, status: l.status };
    });

    const finalResults = parsedResults.map(r => {
      const match = importedMap[r.shopName.toLowerCase()];
      return {
        ...r,
        isImported: !!match,
        leadId: match ? match.id : null,
        leadStatus: match ? match.status : null
      };
    });

    // Sort by distance ascending
    finalResults.sort((a, b) => a.distanceFromCenter - b.distanceFromCenter);

    res.json({
      success: true,
      center: { latitude: lat, longitude: lon },
      isFallback: isFallbackMode,
      resultsCount: finalResults.length,
      results: finalResults
    });

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

exports.extractTextFromLeadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileBuffer = req.file.buffer;
    const originalName = req.file.originalname || '';
    const isXlsx = originalName.endsWith('.xlsx') || req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    let text = '';

    if (isXlsx) {
      const ExcelJS = require('exceljs');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBuffer);

      workbook.eachSheet((sheet) => {
        sheet.eachRow((row) => {
          const rowValues = [];
          row.eachCell({ includeEmpty: true }, (cell) => {
            const val = cell.text || (cell.value !== null && cell.value !== undefined ? String(cell.value) : '');
            rowValues.push(val.trim());
          });
          // Filter out empty rows
          if (rowValues.filter(Boolean).length > 0) {
            text += rowValues.join(' - ') + '\n';
          }
        });
      });
    } else {
      // Handle CSV or TXT
      text = fileBuffer.toString('utf-8');
    }

    res.json({
      success: true,
      text: text.trim()
    });
  } catch (err) {
    next(err);
  }
};

exports.analyzeLeadsText = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Text content is empty' });
    }

    const { callGemini } = require('./aiController');

    const prompt = `
You are an expert business lead analyzer. Your task is to extract clean, structured lead records from the following raw text list of retailer shops (which may contain messy WhatsApp messages, copied listings, etc.):
---
${text}
---

Please follow these AI ANALYSIS RULES:
1. Read and analyze the entire text block first. Do not split lines blindly. Group related lines describing a single business together.
2. Identify: Shop Name, Mobile Number, Address, Area, City, and Category for each business.
3. SHOP NAME DETECTION:
   - Identify shop names. Use these keywords to help detect them: Store, Stores, Bazaar, Market, Mart, Super Market, Organic, Foods, Traders, Agency, Agencies, Medical, Pharmacy, Wellness, Naturals, Ayurvedic, Herbal. (e.g., "Kurinji Express Bazaar", "Anandam Grand", "Sangam Super Market", "Green Organic Foods").
   - NEVER use a phone number as a shop name.
4. PHONE DETECTION:
   - Extract mobile numbers (like +91XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX).
   - Clean the numbers: remove spaces, remove any leading "+91", "91" (if it makes the number 12 digits), or leading "0" (if it makes it 11 digits) to normalize them to a standard 10-digit format (e.g. "8110000734").
5. ADDRESS DETECTION:
   - Detect streets, roads, nagars, main roads, directions (West, East, North, South), colonies, or cities in the address lines. (e.g. "Nageswaran North Street").
   - Do NOT create separate lead records for address lines; group them under the main shop.
6. CITY DETECTION:
   - Auto-identify the city if mentioned: Madurai, Chennai, Trichy, Coimbatore, Salem, Kumbakonam.
   - Assign the correct city. If city is not explicitly separate but mentioned in the address, infer it.
7. CATEGORY DETECTION:
   - Auto-classify category using these rules (case-insensitive):
     - Contains "Organic", "Naturals", "Green", or "Bio" -> "Organic Store"
     - Contains "Super Market", "Market", or "Mart" -> "Supermarket"
     - Contains "Medical" or "Pharmacy" -> "Medical Shop"
     - Contains "Ayurvedic", "Herbal", or "Siddha" -> "Nattu Marundhu Kadai"
     - Contains "Millet" -> "Millet Store"
     - Contains "Dry Fruit" -> "Dry Fruit Shop"
     - Contains "Wholesale", "Agency", or "Distributor" -> "Wholesale Dealer"
     - Else -> "General Retail Store"
8. CONFIDENCE SCORE:
   - Calculate a match confidence score for each lead:
     - Base score is 70% if Shop Name + Mobile are present.
     - Add +15% if Address is present.
     - Add +10% if City is present.
     - Add +5% if a specific Category (anything other than "General Retail Store") is detected.
     - Format as "XX% Match" (e.g., "95% Match", "85% Match", "70% Match").

Ensure your response is a valid JSON array of objects.
Return ONLY the raw JSON list, no markdown wrapper or explanation.
Example Output Format:
[
  {
    "shopName": "Kurinji Express Bazaar",
    "mobileNumber": "8110000734",
    "address": "Nageswaran North Street",
    "city": "Kumbakonam",
    "category": "General Retail Store",
    "confidenceScore": "95% Match"
  }
]
`;

    let parsedLeads = [];
    let useHeuristics = false;
    let reply = "";
    
    try {
      reply = await callGemini(prompt);
      if (typeof reply === 'string' && reply.includes("AI Assistant Error")) {
        useHeuristics = true;
      } else {
        reply = reply.replace(/```json/gi, '').replace(/```/gi, '').trim();
        parsedLeads = JSON.parse(reply);
        if (!Array.isArray(parsedLeads)) {
          parsedLeads = [parsedLeads];
        }
      }
    } catch (err) {
      console.warn("Gemini lead analysis failed, falling back to heuristics:", err.message);
      useHeuristics = true;
    }

    if (useHeuristics) {
      console.log("Applying block-grouping heuristic parser fallback...");
      const rawLines = text.split('\n').map(line => line.trim());
      const groups = [];
      let currentGroup = [];

      const shopKeywords = [
        'store', 'stores', 'bazaar', 'market', 'mart', 'super market', 
        'organic', 'foods', 'traders', 'agency', 'agencies', 
        'medical', 'pharmacy', 'wellness', 'naturals', 'ayurvedic', 'herbal'
      ];
      const addressKeywords = [
        'street', 'road', 'nagar', 'main road', 'west', 'east', 'north', 'south', 'colony'
      ];
      const cityKeywords = [
        'madurai', 'chennai', 'trichy', 'coimbatore', 'salem', 'kumbakonam'
      ];

      function isPhoneLine(line) {
        const digits = line.replace(/[^0-9]/g, '');
        if (digits.length >= 8 && digits.length <= 15) {
          const nonDigits = line.replace(/[0-9\s+\-()]/g, '');
          if (nonDigits.length === 0) return true;
        }
        return false;
      }

      function hasShopKeyword(line) {
        const lower = line.toLowerCase();
        return shopKeywords.some(kw => lower.includes(kw));
      }

      function hasAddressKeyword(line) {
        const lower = line.toLowerCase();
        return addressKeywords.some(kw => lower.includes(kw));
      }

      function hasCityKeyword(line) {
        const lower = line.toLowerCase();
        return cityKeywords.some(kw => lower.includes(kw));
      }

      // Group lines together
      for (const line of rawLines) {
        if (line === '') {
          if (currentGroup.length > 0) {
            groups.push(currentGroup);
            currentGroup = [];
          }
          continue;
        }

        const isPhone = isPhoneLine(line);
        const hasShop = hasShopKeyword(line);
        const hasAddr = hasAddressKeyword(line);
        const hasCity = hasCityKeyword(line);

        // Does currentGroup already have a shop name line?
        const currentHasShopName = currentGroup.some(gl => {
          return !isPhoneLine(gl) && (hasShopKeyword(gl) || (!hasAddressKeyword(gl) && !hasCityKeyword(gl)));
        });

        const isNewShopNameLine = !isPhone && (hasShop || (!hasAddr && !hasCity));

        if (currentHasShopName && isNewShopNameLine) {
          groups.push(currentGroup);
          currentGroup = [line];
        } else {
          currentGroup.push(line);
        }
      }
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }

      // Process each group into a lead record
      for (const group of groups) {
        // If it's a single line and contains separators like '-' or ',' or '|', split it first to help parser
        let tempGroup = [...group];
        if (group.length === 1 && (group[0].includes('-') || group[0].includes(',') || group[0].includes('|'))) {
          // If it matches a phone number pattern, don't split blindly if it breaks the format
          const parts = group[0].split(/[\-|]/).map(p => p.trim()).filter(Boolean);
          if (parts.length > 1) {
            tempGroup = parts;
          }
        }

        let shopName = '';
        let mobileNumber = '';
        let address = '';
        let city = '';
        let category = 'General Retail Store';
        let addressParts = [];

        // 1. Phone detection and extraction from all lines in group
        for (let i = 0; i < tempGroup.length; i++) {
          const rawLine = tempGroup[i];
          const phoneRegex = /(?:\+91|91)?[-\s]?[6789]\d{4}[-\s]?\d{5}/;
          const match = rawLine.match(phoneRegex);
          if (match) {
            const extracted = match[0].replace(/\D/g, '');
            mobileNumber = extracted.slice(-10);
            tempGroup[i] = rawLine.replace(match[0], '').trim();
          } else {
            const digits = rawLine.replace(/[^0-9]/g, '');
            if (digits.length >= 10 && digits.length <= 12) {
              mobileNumber = digits.slice(-10);
              tempGroup[i] = '';
            }
          }
        }

        // 2. City detection
        for (let i = 0; i < tempGroup.length; i++) {
          const rawLine = tempGroup[i].trim();
          if (!rawLine) continue;

          for (const cKw of cityKeywords) {
            const regex = new RegExp(`\\b${cKw}\\b`, 'i');
            if (regex.test(rawLine)) {
              city = cKw.charAt(0).toUpperCase() + cKw.slice(1);
              const cleanLine = rawLine.replace(/[\s,]/g, '').toLowerCase();
              if (cleanLine === cKw) {
                tempGroup[i] = '';
              }
              break;
            }
          }
        }

        // 3. Shop name detection
        let shopNameIndex = -1;
        for (let i = 0; i < tempGroup.length; i++) {
          const rawLine = tempGroup[i].trim();
          if (!rawLine) continue;

          if (hasShopKeyword(rawLine)) {
            shopName = rawLine;
            shopNameIndex = i;
            break;
          }
        }

        if (!shopName) {
          for (let i = 0; i < tempGroup.length; i++) {
            const rawLine = tempGroup[i].trim();
            if (!rawLine) continue;
            if (!hasAddressKeyword(rawLine)) {
              shopName = rawLine;
              shopNameIndex = i;
              break;
            }
          }
        }

        if (!shopName) {
          for (let i = 0; i < tempGroup.length; i++) {
            const rawLine = tempGroup[i].trim();
            if (rawLine) {
              shopName = rawLine;
              shopNameIndex = i;
              break;
            }
          }
        }

        // 4. Address detection
        for (let i = 0; i < tempGroup.length; i++) {
          const rawLine = tempGroup[i].trim();
          if (rawLine && i !== shopNameIndex) {
            addressParts.push(rawLine);
          }
        }
        address = addressParts.join(', ').replace(/^[\s,]+|[\s,]+$/g, '').trim();

        // 5. Clean shopName
        shopName = shopName.replace(/^[\s\-,;]+|[\s\-,;]+$/g, '').trim();

        // 6. Category classification
        const lowerShop = shopName.toLowerCase();
        const lowerGroup = tempGroup.join(' ').toLowerCase();
        const checkText = (lowerShop + ' ' + lowerGroup);
        if (checkText.includes('organic') || checkText.includes('naturals') || checkText.includes('green') || checkText.includes('bio')) {
          category = 'Organic Store';
        } else if (checkText.includes('super market') || checkText.includes('supermarket') || checkText.includes('market') || checkText.includes('mart')) {
          category = 'Supermarket';
        } else if (checkText.includes('medical') || checkText.includes('pharmacy')) {
          category = 'Medical Shop';
        } else if (checkText.includes('ayurvedic') || checkText.includes('herbal') || checkText.includes('siddha')) {
          category = 'Nattu Marundhu Kadai';
        } else if (checkText.includes('millet')) {
          category = 'Millet Store';
        } else if (checkText.includes('dry fruit')) {
          category = 'Dry Fruit Shop';
        } else if (checkText.includes('wholesale') || checkText.includes('agency') || checkText.includes('distributor')) {
          category = 'Wholesale Dealer';
        }

        if (!city && address) {
          for (const cKw of cityKeywords) {
            const regex = new RegExp(`\\b${cKw}\\b`, 'i');
            if (regex.test(address)) {
              city = cKw.charAt(0).toUpperCase() + cKw.slice(1);
              break;
            }
          }
        }

        let confidenceVal = 70;
        if (address) confidenceVal += 15;
        if (city) confidenceVal += 10;
        if (category !== 'General Retail Store') confidenceVal += 5;
        const confidenceScore = `${confidenceVal}% Match`;

        parsedLeads.push({
          shopName,
          mobileNumber,
          address,
          city,
          category,
          confidenceScore
        });
      }
    }

    const verifiedLeads = [];
    let validCount = 0;
    let duplicateCount = 0;
    let incompleteCount = 0;
    let invalidCount = 0;

    for (const lead of parsedLeads) {
      const shopName = (lead.shopName || '').trim();
      let mobileNumber = (lead.mobileNumber || '').trim();
      const address = (lead.address || '').trim();
      const city = (lead.city || '').trim();
      const category = lead.category || 'General Retail Store';

      // Standardize phone representation to 10 digits
      mobileNumber = mobileNumber.replace(/\D/g, '');
      if (mobileNumber.length > 10) {
        mobileNumber = mobileNumber.slice(-10);
      }

      // Compute or recalculate confidence score to guarantee strict logic consistency
      let confidenceVal = 70;
      if (address) confidenceVal += 15;
      if (city) confidenceVal += 10;
      if (category !== 'General Retail Store') confidenceVal += 5;
      const confidenceScore = `${confidenceVal}% Match`;

      let isInvalid = false;
      let isDuplicate = false;
      let statusText = 'New Lead';
      let reason = '';

      if (!shopName || !mobileNumber) {
        isInvalid = true;
        reason = 'Missing shop name or mobile number';
        statusText = 'Invalid';
        invalidCount++;
      } else if (mobileNumber.length < 9) {
        isInvalid = true;
        reason = 'Mobile number is too short or invalid';
        statusText = 'Invalid';
        invalidCount++;
      } else {
        const duplicateLead = await Lead.findOne({
          where: {
            [Op.or]: [
              { mobileNumber: mobileNumber },
              { shopName: { [Op.like]: shopName } }
            ]
          }
        });

        const duplicateCustomer = await Customer.findOne({
          where: {
            [Op.or]: [
              { phone: mobileNumber },
              { name: { [Op.like]: shopName } }
            ]
          }
        });

        if (duplicateLead) {
          isDuplicate = true;
          reason = `Duplicate: Shop or phone already exists in CRM Leads (Lead #${duplicateLead.id})`;
          statusText = 'Duplicate Lead';
          duplicateCount++;
        } else if (duplicateCustomer) {
          isDuplicate = true;
          reason = `Duplicate: Shop or phone already exists in Customers (Customer #${duplicateCustomer.id})`;
          statusText = 'Existing Customer';
          duplicateCount++;
        } else {
          statusText = 'New Lead';
          validCount++;

          if (!address || !city) {
            incompleteCount++;
          }
        }
      }

      verifiedLeads.push({
        shopName,
        mobileNumber,
        address,
        city,
        category,
        confidenceScore,
        isInvalid,
        isDuplicate,
        statusText,
        reason
      });
    }

    res.json({
      success: true,
      summary: {
        total: verifiedLeads.length,
        valid: validCount,
        duplicates: duplicateCount,
        incomplete: incompleteCount,
        invalid: invalidCount
      },
      leads: verifiedLeads
    });
  } catch (err) {
    next(err);
  }
};

exports.importLeadsList = async (req, res, next) => {
  try {
    const { leads } = req.body;
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ message: 'No leads provided for import' });
    }

    const createdLeads = [];
    for (const item of leads) {
      const newLead = await Lead.create({
        shopName: item.shopName,
        mobileNumber: item.mobileNumber,
        address: item.address || '',
        city: item.city || '',
        area: item.address || '',
        category: item.category || 'General Retail Store',
        status: 'New',
        source: 'AI Lead Importer'
      });
      createdLeads.push(newLead);
    }

    res.status(201).json({
      success: true,
      message: `Successfully imported ${createdLeads.length} leads.`,
      leadsCount: createdLeads.length
    });
  } catch (err) {
    next(err);
  }
};

