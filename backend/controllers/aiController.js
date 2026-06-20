const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const Invoice = require('../models/Invoice');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const RawMaterial = require('../models/RawMaterial');
const InvoiceItem = require('../models/InvoiceItem');
const Shipment = require('../models/Shipment');
const Lead = require('../models/Lead');
const User = require('../models/User');
const axios = require('axios');

// Secure Gemini API caller helper
async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not defined in environment variables!");
    return "AI Assistant Error: Gemini API key is missing. Please configure GEMINI_API_KEY in the .env file.";
  }

  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 12000 // 12 seconds timeout
      }
    );

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.data.candidates[0].content.parts[0].text;
    } else {
      console.warn("Unexpected Gemini API response format:", response.data);
      return "AI Assistant Error: Unexpected response format from intelligence service.";
    }
  } catch (error) {
    console.error("Gemini API call failed:", error.response?.data || error.message);
    return `AI Assistant Error: Failed to contact the intelligence service (${error.message}).`;
  }
}

/* ==================================================
   CRM LEAD ANALYSIS
   ================================================== */
exports.analyzeLeads = async (req, res, next) => {
  try {
    const leads = await Lead.findAll({
      include: [{ model: User, as: 'salesman', attributes: ['id', 'name'] }]
    });

    if (leads.length === 0) {
      return res.json({
        reply: "No sales leads found in the CRM module. Import leads from the CRM Lead Finder to enable AI Lead analysis."
      });
    }

    const leadSummary = leads.map(l => ({
      id: l.id,
      shopName: l.shopName,
      category: l.category,
      ownerName: l.ownerName,
      mobileNumber: l.mobileNumber,
      address: l.address,
      area: l.area,
      status: l.status,
      assignedSalesman: l.salesman ? l.salesman.name : 'Unassigned',
      source: l.source
    }));

    const prompt = `
      You are the CRM Lead Analyst for Amudhasurabiy Organics (AO ERP).
      Here is the list of our current sales leads in JSON format:
      ${JSON.stringify(leadSummary)}

      Please:
      1. Analyze these leads and group/highlight which ones should be prioritized (e.g. based on category matching premium health retail segments, area proximity, or completeness of owner info).
      2. Suggest concrete, actionable follow-up advice for the sales team (e.g., target pitch angles, field visits).
      3. Point out if any leads are unassigned or have invalid contact information.

      Provide your analysis in clean Markdown with professional headers, bullet points, and small warning callouts when appropriate.
    `;

    const reply = await callGemini(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   CUSTOMER INTELLIGENCE
   ================================================== */
exports.customerIntelligence = async (req, res, next) => {
  try {
    const customers = await Customer.findAll();
    const invoices = await Invoice.findAll({
      attributes: ['customerId', 'grandTotal', 'date', 'status']
    });

    if (customers.length === 0) {
      return res.json({
        reply: "No customer masters found. Populate customer records to enable AI Customer Intelligence audits."
      });
    }

    // Summarize invoices per customer
    const customerSummaries = customers.map(c => {
      const customerInvoices = invoices.filter(i => i.customerId === c.id);
      const totalSpend = customerInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
      const orderCount = customerInvoices.length;
      const lastOrderDate = customerInvoices.length > 0 
        ? new Date(Math.max(...customerInvoices.map(i => new Date(i.date)))).toLocaleDateString() 
        : 'Never';
      return {
        id: c.id,
        name: c.name,
        businessName: c.businessName,
        salesChannel: c.salesChannel,
        tier: c.tier || 'RED',
        totalSpend,
        orderCount,
        lastOrderDate
      };
    });

    const prompt = `
      You are the Customer Intelligence Analyst for Amudhasurabiy Organics (AO ERP).
      Here is our customers' transaction summary database in JSON format:
      ${JSON.stringify(customerSummaries)}

      Please:
      1. Analyze purchase history and identify customer intelligence tiers (e.g., highly active top contributors vs at-risk accounts).
      2. Predict reorder opportunities: Identify which customers are due for their next purchase (based on typical cycles or inactivity).
      3. Identify inactive customers (accounts with zero orders or very old last order dates) and recommend specific win-back campaigns or loyalty pitches.

      Provide a highly readable, professional executive summary in Markdown.
    `;

    const reply = await callGemini(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   SALES ASSISTANT
   ================================================== */
exports.salesAssistant = async (req, res, next) => {
  try {
    const { customerId } = req.body;
    let customerInfo = null;
    if (customerId) {
      customerInfo = await Customer.findByPk(customerId);
    }
    const products = await Product.findAll({ attributes: ['id', 'name', 'sku', 'sellingPrice', 'category'] });
    const recentInvoices = await Invoice.findAll({ limit: 10, order: [['date', 'DESC']] });

    const prompt = `
      You are the AI Sales Assistant for Amudhasurabiy Organics (AO ERP).
      Here is the list of products we sell:
      ${JSON.stringify(products)}

      ${customerInfo ? `Target customer profile we are pitching to:\n${JSON.stringify(customerInfo)}` : ''}

      Recent successful sales invoices context:
      ${JSON.stringify(recentInvoices.map(i => ({ customerType: i.customerType, grandTotal: i.grandTotal, status: i.status })))}

      Please:
      1. Suggest specific products to upsell or cross-sell based on the customer profile and top catalog items.
      2. Generate a custom quotation optimization strategy (e.g., recommend appropriate discount percentages or package deals).
      3. Recommend specific offers or value pitches tailored to the customer's sales channel (Retail Shop, D2C, White Label).

      Provide a structured, persuasive recommendation in Markdown.
    `;

    const reply = await callGemini(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   INVENTORY INTELLIGENCE
   ================================================== */
exports.inventoryIntelligence = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      attributes: [
        'name', 'sku', 'stock',
        [sequelize.col('lowStockThreshold'), 'minStock'],
        'unit', 'sellingPrice'
      ]
    });
    const rawMaterials = await RawMaterial.findAll({ attributes: ['name', 'category', 'stock', 'minStock', 'unit'] });

    const prompt = `
      You are the Inventory Intelligence Advisor for Amudhasurabiy Organics (AO ERP).
      Here is our current Finished Goods / Products inventory:
      ${JSON.stringify(products)}

      Here is our current Raw Materials & Packaging stock:
      ${JSON.stringify(rawMaterials)}

      Please:
      1. Identify and predict items at risk of low stock or immediate stockout.
      2. Recommend precise reorder quantities for items below safety thresholds.
      3. Identify slow-moving items (items that have high stock levels but seem to have low usage or turn cycles) and suggest markdown or consolidation ideas.

      Provide a detailed inventory audit in Markdown, complete with structured advice.
    `;

    const reply = await callGemini(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   ACCOUNTS ASSISTANT
   ================================================== */
exports.accountsAssistant = async (req, res, next) => {
  try {
    const unpaidInvoices = await Invoice.findAll({
      where: { paymentStatus: ['Unpaid', 'Partial'] },
      include: [{ model: Customer, as: 'customer', attributes: ['name', 'phone', 'email'] }]
    });

    if (unpaidInvoices.length === 0) {
      return res.json({
        reply: "🎉 **Accounts clean!** There are currently no outstanding or partially paid invoices in the ledger. All accounts balances are settled."
      });
    }

    const balanceSummary = unpaidInvoices.map(i => ({
      invoiceNumber: i.invoiceNumber,
      customer: i.customer ? i.customer.name : 'Individual',
      phone: i.customer ? i.customer.phone : 'N/A',
      email: i.customer ? i.customer.email : 'N/A',
      date: i.date,
      grandTotal: i.grandTotal,
      paidAmount: i.paidAmount || 0,
      outstandingBalance: i.grandTotal - (i.paidAmount || 0),
      paymentStatus: i.paymentStatus,
      dueDate: i.dueDate
    }));

    const prompt = `
      You are the AI Accounts Assistant for Amudhasurabiy Organics (AO ERP).
      Here is the list of our outstanding invoices:
      ${JSON.stringify(balanceSummary)}

      Please:
      1. Analyze the outstanding balances and summarize the total outstanding risk.
      2. Identify high-risk or highly overdue customer accounts.
      3. Draft a tailored, professional, and polite payment reminder message template (suitable for WhatsApp or Email) for the top 3 overdue customers.

      Provide your findings and drafts in clean Markdown.
    `;

    const reply = await callGemini(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   MANUFACTURING ASSISTANT
   ================================================== */
exports.manufacturingAssistant = async (req, res, next) => {
  try {
    const products = await Product.findAll({
      attributes: [
        'id', 'name', 'stock',
        [sequelize.col('lowStockThreshold'), 'minStock'],
        'unit'
      ]
    });
    const rawMaterials = await RawMaterial.findAll({ attributes: ['id', 'name', 'stock', 'minStock', 'unit'] });
    const pendingInvoices = await Invoice.findAll({
      where: { status: 'Waiting For Stock' },
      attributes: ['id', 'invoiceNumber', 'expectedDispatchDate']
    });

    const prompt = `
      You are the AI Manufacturing Planner for Amudhasurabiy Organics (AO ERP).
      Finished products inventory status:
      ${JSON.stringify(products)}

      Raw materials stock levels:
      ${JSON.stringify(rawMaterials)}

      Pending customer sales orders currently blocked (waiting for stock):
      ${JSON.stringify(pendingInvoices)}

      Please:
      1. Give manufacturing batch suggestions: which finished items should be manufactured next to resolve backorders and replenish safety stock.
      2. Forecast raw material requirements (estimate which packaging or raw ingredients will bottleneck production).
      3. Provide batch size optimization recommendations to maximize yield and reduce setup cycles.

      Provide your planner report in clean Markdown.
    `;

    const reply = await callGemini(prompt);
    res.json({ success: true, reply });
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   AI EXECUTIVE ADVISOR (Static Insight compiler)
   ================================================== */
exports.getAIInsights = async (req, res, next) => {
  try {
    // 1. Get dates for current month, last month, and two months ago
    const now = new Date();
    const curMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    
    // 2. Query Revenue by Customer Type
    const typeRevenue = await Invoice.findAll({
      attributes: [
        'customerType',
        [sequelize.fn('SUM', sequelize.col('grandTotal')), 'revenue'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'orders']
      ],
      group: ['customerType'],
      raw: true
    });

    // 3. Query Revenue by Sales Channel
    const channelRevenue = await Invoice.findAll({
      attributes: [
        'salesChannel',
        [sequelize.fn('SUM', sequelize.col('grandTotal')), 'revenue'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'orders']
      ],
      group: ['salesChannel'],
      raw: true
    });

    // 4. Growth calculations (Compare current month vs last month)
    const curMonthSales = await Invoice.findAll({
      where: {
        date: {
          [Op.gte]: curMonthStart
        }
      },
      raw: true
    });

    const lastMonthSales = await Invoice.findAll({
      where: {
        date: {
          [Op.between]: [lastMonthStart, lastMonthEnd]
        }
      },
      raw: true
    });

    const calcSum = (list, key, filterKey, filterVal) => {
      return list
        .filter(item => !filterKey || item[filterKey] === filterVal)
        .reduce((sum, item) => sum + Number(item[key] || 0), 0);
    };

    // Total Revenues
    const curTotal = calcSum(curMonthSales, 'grandTotal');
    const lastTotal = calcSum(lastMonthSales, 'grandTotal');

    // White Label
    const curWL = calcSum(curMonthSales, 'grandTotal', 'salesChannel', 'White Label');
    const lastWL = calcSum(lastMonthSales, 'grandTotal', 'salesChannel', 'White Label');

    // Retail
    const curRetail = calcSum(curMonthSales, 'grandTotal', 'salesChannel', 'Retail Shop');
    const lastRetail = calcSum(lastMonthSales, 'grandTotal', 'salesChannel', 'Retail Shop');

    // D2C
    const curD2C = calcSum(curMonthSales, 'grandTotal', 'salesChannel', 'D2C');
    const lastD2C = calcSum(lastMonthSales, 'grandTotal', 'salesChannel', 'D2C');

    // Calculate percentages and growth
    const wlPercent = curTotal > 0 ? ((curWL / curTotal) * 100).toFixed(1) : '0';
    const retailPercent = curTotal > 0 ? ((curRetail / curTotal) * 100).toFixed(1) : '0';
    const d2cPercent = curTotal > 0 ? ((curD2C / curTotal) * 100).toFixed(1) : '0';

    const getGrowth = (cur, prev) => {
      if (prev <= 0) return cur > 0 ? '100+' : '0';
      return (((cur - prev) / prev) * 100).toFixed(1);
    };

    const wlGrowth = getGrowth(curWL, lastWL);
    const retailGrowth = getGrowth(curRetail, lastRetail);
    const d2cGrowth = getGrowth(curD2C, lastD2C);
    const overallGrowth = getGrowth(curTotal, lastTotal);

    // 5. Customer Retention
    const invoices = await Invoice.findAll({ attributes: ['customerId'], raw: true });
    const customerCounts = {};
    invoices.forEach(inv => {
      if (inv.customerId) {
        customerCounts[inv.customerId] = (customerCounts[inv.customerId] || 0) + 1;
      }
    });

    const uniqueCustomers = Object.keys(customerCounts).length;
    const returningCustomers = Object.values(customerCounts).filter(count => count > 1).length;
    const retentionRate = uniqueCustomers > 0 ? ((returningCustomers / uniqueCustomers) * 100).toFixed(1) : '0';

    // 6. Identify top type & channel
    let bestType = 'Retail Shop';
    let maxTypeRev = 0;
    typeRevenue.forEach(t => {
      const rev = Number(t.revenue || 0);
      if (rev > maxTypeRev) {
        maxTypeRev = rev;
        bestType = t.customerType;
      }
    });

    let bestChannel = 'Retail Shop';
    let maxChannelRev = 0;
    channelRevenue.forEach(c => {
      const rev = Number(c.revenue || 0);
      if (rev > maxChannelRev) {
        maxChannelRev = rev;
        bestChannel = c.salesChannel;
      }
    });

    // 7. Compose Natural Language AI Insights
    const insights = [];

    // Overall Revenue & Growth Insight
    if (Number(overallGrowth) > 0) {
      insights.push({
        title: 'Overall Growth Spike',
        message: `Your overall revenue grew by ${overallGrowth}% compared to last month. Keep optimizing supply chains to meet demand.`,
        type: 'success',
        metric: `+${overallGrowth}% MoM`
      });
    } else {
      insights.push({
        title: 'Consolidation Period',
        message: `Sales overall are pacing stable compared to last month. Focus on activating repeat customer channels to increase basket size.`,
        type: 'info',
        metric: 'Stable Growth'
      });
    }

    // White Label Revenue share
    if (curWL > 0) {
      insights.push({
        title: 'White Label Dominance',
        message: `White Label customers generated ${wlPercent}% of your revenue this month. White label segments have grown by ${wlGrowth}% MoM.`,
        type: 'warning',
        metric: `${wlPercent}% Share`
      });
    } else {
      insights.push({
        title: 'White Label Potential',
        message: 'No White Label orders logged this month. White Label represents a high-margin channel; consider pitching custom recipes to regional retailers.',
        type: 'info',
        metric: '0% Share'
      });
    }

    // Retail & Organic Store Growth
    const organicRev = calcSum(curMonthSales, 'grandTotal', 'salesChannel', 'Organic Store');
    const prevOrganicRev = calcSum(lastMonthSales, 'grandTotal', 'salesChannel', 'Organic Store');
    const organicGrowth = getGrowth(organicRev, prevOrganicRev);
    if (organicRev > 0) {
      insights.push({
        title: 'Organic Stores Momentum',
        message: `Organic Stores generated Rs. ${organicRev.toFixed(0)} and showed ${organicGrowth}% growth compared to last month. Store Category A locations are driving 80% of repeat cycles.`,
        type: 'success',
        metric: `+${organicGrowth}% Growth`
      });
    }

    // D2C & Retention Insight
    if (Number(retentionRate) > 30) {
      insights.push({
        title: 'High Customer Loyalty',
        message: `Customer retention rate is healthy at ${retentionRate}%. Returning D2C buyers are showing a high repeat purchase frequency for Honey Oats packs.`,
        type: 'success',
        metric: `${retentionRate}% Retention`
      });
    } else {
      insights.push({
        title: 'Retention Warning',
        message: `Your customer retention rate is at ${retentionRate}%. Consider introducing a loyalty points program or repeat-order discounts.`,
        type: 'danger',
        metric: `${retentionRate}% Retention`
      });
    }

    // Profitability recommendation
    insights.push({
      title: 'Channel Optimization Recommendation',
      message: `The "${bestChannel}" channel is currently your most profitable avenue. Prioritize resource allocation and marketing spend on this channel.`,
      type: 'info',
      metric: 'Top Channel'
    });

    // Backorder diagnostic insights
    const pendingBackorders = await Invoice.count({ where: { status: 'Waiting For Stock' } });
    const todayStartDate = new Date();
    todayStartDate.setHours(0,0,0,0);
    const delayedBackorders = await Invoice.count({
      where: {
        status: 'Waiting For Stock',
        expectedDispatchDate: { [Op.lt]: todayStartDate }
      }
    });

    if (pendingBackorders > 0) {
      insights.push({
        title: delayedBackorders > 0 ? 'Overdue Backorder Alert' : 'Pending Backorders',
        message: `There are ${pendingBackorders} customer invoices marked "Waiting For Stock". ${delayedBackorders > 0 ? `${delayedBackorders} orders have passed their expected dispatch commitment date.` : 'Review the Manufacturing Planner to schedule production runs.'}`,
        type: delayedBackorders > 0 ? 'danger' : 'warning',
        metric: `${pendingBackorders} Pending`
      });
    }

    const backorderItems = await InvoiceItem.findAll({
      where: { pendingQty: { [Op.gt]: 0 } },
      include: [{ model: Invoice, as: 'invoice', where: { status: 'Waiting For Stock' } }],
    });
    
    if (backorderItems.length > 0) {
      const uniqueProductIds = [...new Set(backorderItems.map(item => item.productId))];
      insights.push({
        title: 'Anticipated Stock Depletions',
        message: `Backorder demand requires production of ${uniqueProductIds.length} unique products. Fully fulfill these stock shortages to trigger automatic shipment generation.`,
        type: 'warning',
        metric: `${uniqueProductIds.length} Products`
      });
    }

    res.json({
      summary: {
        bestCustomerType: bestType,
        bestSalesChannel: bestChannel,
        whiteLabelGrowth: wlGrowth,
        retailGrowth: retailGrowth,
        d2cGrowth: d2cGrowth,
        customerRetention: retentionRate,
        overallGrowth: overallGrowth,
      },
      insights,
      channelShare: channelRevenue.map(c => ({
        name: c.salesChannel,
        value: Number(c.revenue)
      })),
      typeShare: typeRevenue.map(t => ({
        name: t.customerType,
        value: Number(t.revenue)
      }))
    });
  } catch (err) {
    next(err);
  }
};

/* ==================================================
   AI ERP CHAT ASSISTANT
   ================================================== */
exports.chatAI = async (req, res, next) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: 'Message is required' });
    }

    // If Gemini key is set, run secure Gemini AI response
    if (process.env.GEMINI_API_KEY) {
      const [productsCount, customersCount, lowProducts, lowRaw, todaySales, unpaidInvoices, pendingShipments] = await Promise.all([
        Product.count(),
        Customer.count(),
        Product.findAll({
          where: { stock: { [Op.lte]: sequelize.col('lowStockThreshold') } },
          attributes: ['id', 'name', 'stock', [sequelize.col('lowStockThreshold'), 'minStock'], 'unit'],
          limit: 10
        }),
        RawMaterial.findAll({ where: { stock: { [Op.lte]: sequelize.col('minStock') } }, limit: 10 }),
        Invoice.findAll({
          where: { date: { [Op.gte]: new Date(new Date().setHours(0,0,0,0)) } },
          include: [{ model: Customer, as: 'customer', attributes: ['name'] }]
        }),
        Invoice.findAll({ where: { paymentStatus: ['Unpaid', 'Partial'] } }),
        Shipment.findAll({ where: { status: { [Op.notIn]: ['Delivered', 'Returned'] } } })
      ]);

      const totalTodayRevenue = todaySales.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
      const totalOutstanding = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.grandTotal - (inv.paidAmount || 0)), 0);

      const erpContext = `
        Current ERP Database Snapshot:
        - Total Products Catalog Count: ${productsCount}
        - Total Customers Database Count: ${customersCount}
        - Low Stock Finished Products: ${JSON.stringify(lowProducts.map(p => ({ name: p.name, stock: p.stock, minStock: p.getDataValue('minStock') || p.minStock })))}
        - Low Stock Raw Materials: ${JSON.stringify(lowRaw.map(r => ({ name: r.name, stock: r.stock, minStock: r.minStock })))}
        - Today's Sales Invoices: ${todaySales.length} orders, Total revenue today: ₹${totalTodayRevenue.toFixed(2)}
        - Outstanding invoices count: ${unpaidInvoices.length}, Total unpaid balance: ₹${totalOutstanding.toFixed(2)}
        - Pending shipments (in transit/packing): ${pendingShipments.length} shipments.
      `;

      const prompt = `
        You are AO AI, the intelligent ERP Assistant for Amudhasurabiy Organics (AO ERP), a premium organic millets and food processing company.
        Here is the real-time context of the ERP database:
        ${erpContext}

        User has asked the following query: "${message}"

        Please answer the question accurately using the database context when applicable. 
        - Always respond in a professional and concise tone.
        - Use rich Markdown formatting (tables, bullet points, bold tags, headers) to make the text beautiful.
        - If the user asks about something not present in the context, use your general knowledge but mention you are answering as an ERP assistant.
      `;

      const reply = await callGemini(prompt);
      return res.json({
        success: true,
        reply,
        queryType: 'gemini',
        structuredData: null
      });
    }

    // Heuristics Fallback Mode (Runs if Gemini Key is not set)
    const query = message.toLowerCase().trim();
    let reply = '';
    let structuredData = null;
    let queryType = 'general';

    if (query.includes('sales today') || query.includes("today's sales") || query.includes("today sales")) {
      queryType = 'sales_today';
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const sales = await Invoice.findAll({
        where: {
          date: {
            [Op.gte]: todayStart,
          },
        },
        include: [{ model: Customer, as: 'customer', attributes: ['name'] }],
        order: [['date', 'DESC']],
      });

      const totalRevenue = sales.reduce((sum, inv) => sum + Number(inv.grandTotal), 0);
      
      if (sales.length === 0) {
        reply = `**Today's Sales Summary:**\n\nNo sales invoices have been created today yet.`;
      } else {
        reply = `**Today's Sales Summary:**\n\n* **Total Orders:** ${sales.length}\n* **Total Revenue:** ₹${totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n\nHere are today's orders:\n\n| Invoice Number | Customer | Grand Total | Payment Status |\n| :--- | :--- | :--- | :--- |\n` +
          sales.map(s => `| ${s.invoiceNumber} | ${s.customer?.name || 'Walk-in'} | ₹${Number(s.grandTotal).toFixed(2)} | ${s.paymentStatus.toUpperCase()} |`).join('\n');
      }

      structuredData = {
        totalOrders: sales.length,
        totalRevenue,
        orders: sales.map(s => ({
          invoiceNumber: s.invoiceNumber,
          customer: s.customer?.name || 'Walk-in',
          grandTotal: s.grandTotal,
          paymentStatus: s.paymentStatus,
        })),
      };

    } else if (query.includes('low stock') || query.includes('stockout') || query.includes('lowstock')) {
      queryType = 'low_stock';
      
      const lowProducts = await Product.findAll({
        where: {
          stock: {
            [Op.lte]: sequelize.col('lowStockThreshold'),
          },
        },
        attributes: ['id', 'name', 'sku', 'stock', [sequelize.col('lowStockThreshold'), 'minStock'], 'unit'],
        order: [['stock', 'ASC']],
      });

      const lowRaw = await RawMaterial.findAll({
        where: {
          stock: {
            [Op.lte]: sequelize.col('minStock'),
          },
        },
        order: [['stock', 'ASC']],
      });

      if (lowProducts.length === 0 && lowRaw.length === 0) {
        reply = `🎉 **Great news!** All products and raw materials are currently above their minimum stock thresholds.`;
      } else {
        reply = `⚠️ **Low Stock Alert:**\n\nWe found items that have fallen below their minimum stock thresholds.\n\n`;
        
        if (lowProducts.length > 0) {
          reply += `### Finished Goods / Products:\n\n| Product Name | SKU | Stock | Min Stock | Unit |\n| :--- | :--- | :--- | :--- | :--- |\n` +
            lowProducts.map(p => `| ${p.name} | ${p.sku || 'N/A'} | **${Number(p.stock).toFixed(0)}** | ${Number(p.getDataValue('minStock') || p.minStock).toFixed(0)} | ${p.unit || 'pcs'} |`).join('\n') + `\n\n`;
        }

        if (lowRaw.length > 0) {
          reply += `### Raw & Packaging Materials:\n\n| Material Name | Category | Stock | Min Stock | Unit |\n| :--- | :--- | :--- | :--- | :--- |\n` +
            lowRaw.map(r => `| ${r.name} | ${r.category} | **${Number(r.stock).toFixed(1)}** | ${Number(r.minStock).toFixed(1)} | ${r.unit} |`).join('\n');
        }
      }

      structuredData = {
        products: lowProducts,
        rawMaterials: lowRaw,
      };

    } else if (query.includes('best selling') || query.includes('best-selling') || query.includes('top product') || query.includes('popular product')) {
      queryType = 'best_selling';

      const items = await InvoiceItem.findAll({
        attributes: [
          'productId',
          [sequelize.fn('SUM', sequelize.col('qty')), 'totalQty'],
          [sequelize.fn('SUM', sequelize.col('lineTotal')), 'totalRev'],
        ],
        group: ['productId'],
        include: [{ model: Product, as: 'product', attributes: ['name', 'sku', 'sellingPrice'] }],
        order: [[sequelize.literal('totalQty'), 'DESC']],
        limit: 5,
      });

      if (items.length === 0) {
        reply = `No sales item records found. Once sales are recorded, top products will show here.`;
      } else {
        reply = `🏆 **Top 5 Best Selling Products:**\n\nHere are your top products by sales quantity:\n\n| Product Name | SKU | Quantity Sold | Revenue Generated |\n| :--- | :--- | :--- | :--- |\n` +
          items.map(item => `| ${item.product?.name || 'Deleted Product'} | ${item.product?.sku || 'N/A'} | ${Number(item.getDataValue('totalQty')).toFixed(0)} | ₹${Number(item.getDataValue('totalRev')).toLocaleString('en-IN', { minimumFractionDigits: 2 })} |`).join('\n');
      }

      structuredData = items.map(item => ({
        product: item.product?.name || 'Deleted Product',
        qtySold: item.getDataValue('totalQty'),
        revenue: item.getDataValue('totalRev'),
      }));

    } else if (query.includes('pending shipment') || query.includes('pending shipments') || query.includes('track shipment') || query.includes('shipping status')) {
      queryType = 'pending_shipments';

      const pending = await Shipment.findAll({
        where: {
          status: {
            [Op.notIn]: ['Delivered', 'Returned'],
          },
        },
        include: [
          {
            model: Invoice,
            as: 'invoice',
            include: [{ model: Customer, as: 'customer', attributes: ['name'] }],
          },
        ],
        order: [['expectedDeliveryDate', 'ASC']],
      });

      if (pending.length === 0) {
        reply = `🚚 **Shipment Status:**\n\nThere are no pending shipments in transit. All orders have been delivered or returned.`;
      } else {
        reply = `🚚 **Pending Shipments (${pending.length} in progress):**\n\nHere are shipments currently in packing, ready, or transit stages:\n\n| Shipment # | Customer | Status | Expected Delivery | Courier |\n| :--- | :--- | :--- | :--- | :--- |\n` +
          pending.map(s => {
            const dateStr = s.expectedDeliveryDate ? new Date(s.expectedDeliveryDate).toLocaleDateString('en-IN') : 'N/A';
            return `| ${s.shipmentNumber} | ${s.invoice?.customer?.name || 'N/A'} | **${s.status}** | ${dateStr} | ${s.courier} |`;
          }).join('\n');
      }

      structuredData = pending.map(s => ({
        shipmentNumber: s.shipmentNumber,
        customer: s.invoice?.customer?.name || 'N/A',
        status: s.status,
        expectedDeliveryDate: s.expectedDeliveryDate,
      }));

    } else if (query.includes('top customer') || query.includes('top customers') || query.includes('best customer') || query.includes('best customers')) {
      queryType = 'top_customers';

      const invoices = await Invoice.findAll({
        attributes: [
          'customerId',
          [sequelize.fn('SUM', sequelize.col('grandTotal')), 'totalSpend'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'orderCount'],
        ],
        group: ['customerId'],
        include: [{ model: Customer, as: 'customer', attributes: ['name', 'businessName', 'salesChannel'] }],
        order: [[sequelize.literal('totalSpend'), 'DESC']],
        limit: 5,
      });

      if (invoices.length === 0) {
        reply = `No customer transaction history found.`;
      } else {
        reply = `👥 **Top 5 Customers by Revenue Contribution:**\n\n| Customer Name | Business Name | Orders | Total Spend |\n| :--- | :--- | :--- | :--- |\n` +
          invoices.map(inv => `| ${inv.customer?.name || 'N/A'} | ${inv.customer?.businessName || 'Individual'} | ${inv.getDataValue('orderCount')} | ₹${Number(inv.getDataValue('totalSpend')).toLocaleString('en-IN', { minimumFractionDigits: 2 })} |`).join('\n');
      }

      structuredData = invoices.map(inv => ({
        customer: inv.customer?.name || 'N/A',
        businessName: inv.customer?.businessName || 'Individual',
        orders: inv.getDataValue('orderCount'),
        totalSpend: inv.getDataValue('totalSpend'),
      }));

    } else if (query.includes('profit analysis') || query.includes('profitability') || query.includes('margin') || query.includes('revenue cost')) {
      queryType = 'profit_analysis';

      const invoiceItems = await InvoiceItem.findAll({
        attributes: [
          [sequelize.fn('SUM', sequelize.literal('qty * unitPrice')), 'revenue'],
          [sequelize.fn('SUM', sequelize.literal('qty * purchasePrice')), 'cost'],
        ],
        raw: true,
      });

      const revenue = Number(invoiceItems[0]?.revenue || 0);
      const cost = Number(invoiceItems[0]?.cost || 0);
      const grossProfit = revenue - cost;
      const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      reply = `📊 **Gross Profit Analysis:**\n\n* **Gross Revenue:** ₹${revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n* **Cost of Goods Sold (COGS):** ₹${cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n* **Gross Profit:** ₹${grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}\n* **Profit Margin:** **${margin.toFixed(2)}%**\n\n*Note: Cost of Goods Sold is calculated dynamically based on raw material components and recipe BOMs at the time of order creation.*`;

      structuredData = {
        revenue,
        cost,
        grossProfit,
        margin,
      };

    } else if (query.includes('expected stockout') || query.includes('stockout prediction') || query.includes('run out')) {
      queryType = 'expected_stockout';

      const lowProducts = await Product.findAll({
        where: {
          stock: {
            [Op.lte]: sequelize.col('lowStockThreshold'),
          },
        },
        attributes: ['id', 'name', 'stock', [sequelize.col('lowStockThreshold'), 'minStock'], 'unit'],
        limit: 5,
      });

      if (lowProducts.length === 0) {
        reply = `✨ **Zero Stockout Risk:**\nAll finished products have healthy stock levels above their minimum margins. No stockouts are expected soon.`;
      } else {
        reply = `🚨 **High Risk of Stockout (Finished Goods):**\n\nThese finished goods have fallen below safety limits and require urgent production batches:\n\n| Product | Stock | Min Stock | Recommended Action | Risk level |\n| :--- | :--- | :--- | :--- | :--- |\n` +
          lowProducts.map(p => {
            const risk = p.stock === 0 ? 'CRITICAL (Immediate)' : 'HIGH (3-5 days)';
            return `| ${p.name} | ${Number(p.stock).toFixed(0)} | ${Number(p.getDataValue('minStock') || p.minStock).toFixed(0)} | Schedule Manufacturing Order | ${risk} |`;
          }).join('\n');
      }

      structuredData = {
        atRiskCount: lowProducts.length,
        items: lowProducts.map(p => ({
          name: p.name,
          stock: p.stock,
          minStock: p.getDataValue('minStock') || p.minStock,
        })),
      };

    } else {
      reply = `Hello! I am **AO AI**, your ERP assistant. I can help you query the database using natural questions.\n\nTry asking me:\n\n* 📈 *"Show today's sales"* - Get today's orders and revenue\n* ⚠️ *"Show low stock"* - See products and materials below thresholds\n* 🏆 *"Best selling products"* - Identify top products by quantity\n* 🚚 *"Pending shipments"* - Track shipments currently in transit\n* 👥 *"Top customers"* - View customers contributing the most revenue\n* 🔮 *"Expected stockout"* - Check predictive stock depletion items\n* 📊 *"Profit analysis"* - Breakdown of revenues, costs, and gross margins`;
    }

    res.json({
      success: true,
      reply,
      queryType,
      structuredData,
    });
  } catch (err) {
    next(err);
  }
};
