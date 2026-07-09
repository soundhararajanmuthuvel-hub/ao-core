const SalesTarget = require('../models/SalesTarget');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const User = require('../models/User');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Payment = require('../models/Payment');
const Visit = require('../models/Visit');
const Settings = require('../models/Settings');
const { Op } = require('sequelize');

// Helper to count remaining working days in active month (excluding Sundays)
function getRemainingWorkingDays(today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let workingDays = 0;
  
  for (let d = today.getDate(); d <= lastDay; d++) {
    const dayOfWeek = new Date(year, month, d).getDay();
    if (dayOfWeek !== 0) { // Skip Sundays
      workingDays++;
    }
  }
  return workingDays > 0 ? workingDays : 1;
}

// Helper to count total working days in active month
function getTotalWorkingDays(today = new Date()) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  let workingDays = 0;
  
  for (let d = 1; d <= lastDay; d++) {
    const dayOfWeek = new Date(year, month, d).getDay();
    if (dayOfWeek !== 0) { // Skip Sundays
      workingDays++;
    }
  }
  return workingDays > 0 ? workingDays : 26;
}

exports.getTargets = async (req, res) => {
  try {
    const targets = await SalesTarget.findAll({
      include: [
        { model: User, as: 'salesman', attributes: ['id', 'name', 'role'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'businessName'] },
        { model: Product, as: 'product', attributes: ['id', 'name', 'sku'] },
      ],
      order: [['createdAt', 'DESC']],
    });
    res.json({ success: true, targets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.createTarget = async (req, res) => {
  try {
    const { targetType, targetPeriod, year, month, valueType, targetValue, productId, customerId, salesmanId, category, brand } = req.body;
    
    // Create primary target record
    const target = await SalesTarget.create({
      targetType,
      targetPeriod,
      year: Number(year),
      month: month ? Number(month) : null,
      valueType,
      targetValue: Number(targetValue),
      productId: productId ? Number(productId) : null,
      customerId: customerId ? Number(customerId) : null,
      salesmanId: salesmanId ? Number(salesmanId) : null,
      category,
      brand
    });

    res.json({ success: true, message: 'Sales target configured successfully', target });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateTarget = async (req, res) => {
  try {
    const target = await SalesTarget.findByPk(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }
    
    await target.update(req.body);
    res.json({ success: true, message: 'Target updated successfully', target });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteTarget = async (req, res) => {
  try {
    const target = await SalesTarget.findByPk(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Target not found' });
    }
    
    await target.destroy();
    res.json({ success: true, message: 'Target deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Target Dashboard Calculations with Auto-Redistribution Logic
exports.getTargetDashboard = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    
    const settings = await Settings.findOne();
    const configWorkingDays = settings?.workingDaysPerMonth || getTotalWorkingDays(today);
    
    // Fetch all targets for this year/month
    const targets = await SalesTarget.findAll({
      where: { year: today.getFullYear() }
    });

    // 1. Fetch Actual Sales figures for this month
    const currentMonthInvoices = await Invoice.findAll({
      where: {
        date: { [Op.between]: [startOfMonth, endOfMonth] },
        status: { [Op.ne]: 'Cancelled' }
      },
      include: [{ model: InvoiceItem, as: 'items' }]
    });

    const monthlyActualRevenue = currentMonthInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal || 0), 0);
    
    // Today's Sales
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    const todayInvoices = currentMonthInvoices.filter(inv => new Date(inv.date) >= startOfToday && new Date(inv.date) <= endOfToday);
    const todayActualRevenue = todayInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal || 0), 0);

    // 2. Resolve Monthly Company Target (Dynamic Split fallback if only Yearly exists)
    let companyMonthlyTargetVal = 300000; // Default fallback 3 Lakhs INR
    const companyMonthly = targets.find(t => t.targetType === 'Company' && t.targetPeriod === 'Monthly' && t.month === (today.getMonth() + 1));
    const companyYearly = targets.find(t => t.targetType === 'Company' && t.targetPeriod === 'Yearly');
    
    if (companyMonthly) {
      companyMonthlyTargetVal = Number(companyMonthly.targetValue);
    } else if (companyYearly) {
      companyMonthlyTargetVal = Number(companyYearly.targetValue) / 12;
    }

    // Dynamic Target Redistribution Calculations
    const remainingDays = getRemainingWorkingDays(today);
    const remainingTarget = Math.max(0, companyMonthlyTargetVal - (monthlyActualRevenue - todayActualRevenue));
    const recalculatedDailyTarget = remainingDays > 0 ? (remainingTarget / remainingDays) : 10000;

    // Company Progress Metrics
    const companyAchievementPercent = companyMonthlyTargetVal > 0 ? Math.round((monthlyActualRevenue / companyMonthlyTargetVal) * 100) : 0;
    
    // 3. Product performance stats (Targets vs Actuals)
    const productTargets = targets.filter(t => t.targetType === 'Product');
    const productPerformance = [];
    
    // Get unique product sales quantities
    const prodSales = {};
    currentMonthInvoices.forEach(inv => {
      inv.items?.forEach(it => {
        const pId = it.productId;
        if (pId) {
          prodSales[pId] = (prodSales[pId] || 0) + Number(it.qty || 0);
        }
      });
    });

    const allProducts = await Product.findAll({ limit: 150 });
    allProducts.forEach(prod => {
      const tRecord = productTargets.find(t => t.productId === prod.id);
      let targetVal = 0;
      if (tRecord) {
        targetVal = tRecord.targetPeriod === 'Yearly' ? Math.round(Number(tRecord.targetValue) / 12) : Number(tRecord.targetValue);
      }
      const actualQty = prodSales[prod.id] || 0;
      const progress = targetVal > 0 ? Math.min(100, Math.round((actualQty / targetVal) * 100)) : 0;
      
      if (targetVal > 0 || actualQty > 0) {
        productPerformance.push({
          id: prod.id,
          name: prod.name,
          sku: prod.sku,
          target: targetVal,
          actual: actualQty,
          remaining: Math.max(0, targetVal - actualQty),
          achievementPercent: progress,
          status: progress >= 100 ? 'GREEN' : progress >= 75 ? 'AMBER' : 'RED'
        });
      }
    });

    const sortedProducts = [...productPerformance].sort((a, b) => b.achievementPercent - a.achievementPercent);
    const bestSelling = sortedProducts[0] || { name: 'N/A', achievementPercent: 0 };
    const worstPerforming = [...productPerformance].filter(p => p.target > 0).sort((a, b) => a.achievementPercent - b.achievementPercent)[0] || { name: 'N/A', achievementPercent: 0 };

    // 4. Salesman Leaderboard
    const salesmanTargets = targets.filter(t => t.targetType === 'Salesman');
    const salesmen = await User.findAll({ where: { role: { [Op.in]: ['Salesman', 'Sales Executive'] } } });
    const salesmanPerformance = [];

    // Salesman actual stats (Revenue, Payments, Visits, Customers Onboarded)
    const salesmenSales = {};
    const salesmenPayments = {};
    const salesmenVisits = {};
    const salesmenCustomers = {};

    currentMonthInvoices.forEach(inv => {
      const sId = inv.assignedSalesmanId || inv.createdBy?.id;
      if (sId) salesmenSales[sId] = (salesmenSales[sId] || 0) + Number(inv.grandTotal || 0);
    });

    const monthlyPayments = await Payment.findAll({
      where: { date: { [Op.between]: [startOfMonth, endOfMonth] } }
    });
    monthlyPayments.forEach(p => {
      const sId = p.createdBy?.id || p.salesmanId;
      if (sId) salesmenPayments[sId] = (salesmenPayments[sId] || 0) + Number(p.amount || 0);
    });

    const monthlyVisits = await Visit.findAll({
      where: { checkInTime: { [Op.between]: [startOfMonth, endOfMonth] } }
    });
    monthlyVisits.forEach(v => {
      const sId = v.salesmanId;
      if (sId) salesmenVisits[sId] = (salesmenVisits[sId] || 0) + 1;
    });

    const monthlyNewCusts = await Customer.findAll({
      where: { createdAt: { [Op.between]: [startOfMonth, endOfMonth] } }
    });
    monthlyNewCusts.forEach(c => {
      const sId = c.assignedSalesmanId;
      if (sId) salesmenCustomers[sId] = (salesmenCustomers[sId] || 0) + 1;
    });

    salesmen.forEach((salesman, idx) => {
      const tRecord = salesmanTargets.find(t => t.salesmanId === salesman.id);
      let targetVal = 150000; // default 1.5 Lakhs target
      if (tRecord) {
        targetVal = tRecord.targetPeriod === 'Yearly' ? Math.round(Number(tRecord.targetValue) / 12) : Number(tRecord.targetValue);
      }
      const actualRev = salesmenSales[salesman.id] || 0;
      const progress = targetVal > 0 ? Math.round((actualRev / targetVal) * 100) : 0;

      salesmanPerformance.push({
        id: salesman.id,
        name: salesman.name,
        target: targetVal,
        actual: actualRev,
        achievementPercent: progress,
        collections: salesmenPayments[salesman.id] || 0,
        visits: salesmenVisits[salesman.id] || 0,
        orders: todayInvoices.filter(i => i.assignedSalesmanId === salesman.id).length,
        newCustomers: salesmenCustomers[salesman.id] || 0,
        status: progress >= 100 ? 'GREEN' : progress >= 75 ? 'AMBER' : 'RED'
      });
    });

    // Sort by achievement percentage to build Leaderboard Rank
    salesmanPerformance.sort((a, b) => b.achievementPercent - a.achievementPercent);
    const rankedSalesmen = salesmanPerformance.map((s, idx) => ({ ...s, rank: idx + 1 }));

    // 5. Intelligent AI Suggestions & Expected achievement
    const expectedAchievementPercent = companyAchievementPercent > 0 
      ? Math.round(companyAchievementPercent * (configWorkingDays / Math.max(1, configWorkingDays - remainingDays))) 
      : 0;

    const aiSuggestionsList = [];
    if (bestSelling.name && bestSelling.achievementPercent > 100) {
      aiSuggestionsList.push(`🔥 Focus on ${bestSelling.name} this week. It is selling faster than planned (${bestSelling.achievementPercent}% achieved).`);
    }
    if (worstPerforming.name && worstPerforming.target > 0) {
      aiSuggestionsList.push(`⚠️ ${worstPerforming.name} is behind target (${worstPerforming.achievementPercent}% achieved). Consider promo offers.`);
    }
    aiSuggestionsList.push(`📈 Expected monthly company target achievement: ${expectedAchievementPercent}%.`);
    
    // Risk indicator
    let upcomingRisk = 'Low Risk';
    if (expectedAchievementPercent < 75) upcomingRisk = 'High Risk - Targets likely missed';
    else if (expectedAchievementPercent < 95) upcomingRisk = 'Moderate Risk';

    // 6. Rewards & Badges calculations
    let rewardBadge = '🥉 Bronze';
    if (companyAchievementPercent >= 100) rewardBadge = '🏆 Platinum';
    else if (companyAchievementPercent >= 90) rewardBadge = '🥇 Gold';
    else if (companyAchievementPercent >= 75) rewardBadge = '🥈 Silver';

    res.json({
      success: true,
      metrics: {
        todayTarget: Math.round(companyMonthlyTargetVal / configWorkingDays),
        todaySales: todayActualRevenue,
        todayRemaining: Math.max(0, Math.round(recalculatedDailyTarget) - todayActualRevenue),
        monthlyTarget: companyMonthlyTargetVal,
        monthlyActual: monthlyActualRevenue,
        monthlyAchievementPercent: companyAchievementPercent,
        recalculatedDailyTarget: Math.round(recalculatedDailyTarget),
        remainingWorkingDays: remainingDays,
        bestSellingProduct: bestSelling.name,
        worstPerformingProduct: worstPerforming.name,
        upcomingTargetRisk: upcomingRisk,
        rewardBadge,
      },
      productPerformance,
      salesmanLeaderboard: rankedSalesmen,
      aiSuggestions: aiSuggestionsList
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
