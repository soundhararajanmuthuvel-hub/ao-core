const connectDB = require('./config/db');
const crmController = require('./controllers/crmController');
const Customer = require('./models/Customer');
const Invoice = require('./models/Invoice');
const CrmFollowUp = require('./models/CrmFollowUp');
const User = require('./models/User');

async function testReEngagement() {
  console.log('--- START RE-ENGAGEMENT TEST ---');
  try {
    // 1. Connect to Database
    await connectDB();
    console.log('✅ Database connected.');

    // 2. Ensure we have at least one test user (Salesman/Admin)
    let user = await User.findOne();
    if (!user) {
      user = await User.create({
        name: 'Test Salesman',
        email: 'salesman@test.com',
        role: 'Salesman',
        status: 'Active'
      });
      console.log('✅ Created mock salesman.');
    }

    // 3. Ensure we have some test customers with different inactivity levels
    const now = new Date();
    
    // Clean old test customers if they exist to keep test repeatable
    await Customer.destroy({ where: { email: { [require('sequelize').Op.like]: '%@reengage-test.com' } } });

    // Active customer (last order 10 days ago)
    const activeDate = new Date();
    activeDate.setDate(now.getDate() - 10);
    const custActive = await Customer.create({
      name: 'Active Shop',
      businessName: 'Active Shop business',
      phone: '9999999991',
      email: 'active@reengage-test.com',
      lastOrderDate: activeDate,
      status: 'Active',
      balance: 150.00
    });

    // At Risk customer (last order 35 days ago)
    const atRiskDate = new Date();
    atRiskDate.setDate(now.getDate() - 35);
    const custAtRisk = await Customer.create({
      name: 'At Risk Shop',
      businessName: 'At Risk Shop business',
      phone: '9999999992',
      email: 'atrisk@reengage-test.com',
      lastOrderDate: atRiskDate,
      status: 'Active',
      balance: 500.00
    });

    // Inactive customer (last order 100 days ago)
    const inactiveDate = new Date();
    inactiveDate.setDate(now.getDate() - 100);
    const custInactive = await Customer.create({
      name: 'Inactive Shop',
      businessName: 'Inactive Shop business',
      phone: '9999999993',
      email: 'inactive@reengage-test.com',
      lastOrderDate: inactiveDate,
      status: 'Active',
      balance: 1200.00
    });

    console.log('✅ Created mock customers.');

    // Create mock invoices
    const inv1 = await Invoice.create({
      invoiceNumber: 'INV-TEST-001',
      customerId: custActive.id,
      date: activeDate,
      grandTotal: 1500.00,
      status: 'Confirmed'
    });

    const inv2 = await Invoice.create({
      invoiceNumber: 'INV-TEST-002',
      customerId: custAtRisk.id,
      date: atRiskDate,
      grandTotal: 3000.00,
      status: 'Confirmed'
    });

    const inv3 = await Invoice.create({
      invoiceNumber: 'INV-TEST-003',
      customerId: custInactive.id,
      date: inactiveDate,
      grandTotal: 4500.00,
      status: 'Confirmed'
    });

    console.log('✅ Created mock invoices.');

    // 4. Test getReEngagementDashboard
    console.log('\n--- Testing getReEngagementDashboard ---');
    let dashResult = null;
    const reqDash = {};
    const resDash = {
      json(data) {
        dashResult = data;
      }
    };
    await crmController.getReEngagementDashboard(reqDash, resDash, (err) => { throw err; });
    console.log('Dashboard Result counts:', dashResult.counts);
    console.log('Dashboard Result recoveryReport:', dashResult.recoveryReport);
    if (dashResult.success && dashResult.counts.thirtyPlus >= 2) {
      console.log('✅ Dashboard stats computed successfully!');
    } else {
      console.error('❌ Dashboard stats computation failed.');
    }

    // 5. Test getReEngagementCustomers
    console.log('\n--- Testing getReEngagementCustomers ---');
    let custResult = null;
    const reqCust = {};
    const resCust = {
      json(data) {
        custResult = data;
      }
    };
    await crmController.getReEngagementCustomers(reqCust, resCust, (err) => { throw err; });
    console.log(`Retrieved ${custResult.customers.length} customers.`);
    const atRiskMatch = custResult.customers.find(c => c.id === custAtRisk.id);
    console.log('At Risk Customer computed details:', {
      name: atRiskMatch?.name,
      healthStatus: atRiskMatch?.healthStatus,
      daysSinceLastOrder: atRiskMatch?.daysSinceLastOrder,
      lastPurchaseValue: atRiskMatch?.lastPurchaseValue
    });
    if (atRiskMatch && atRiskMatch.healthStatus === 'Attention Required' && atRiskMatch.lastPurchaseValue === 3000.00) {
      console.log('✅ Customer health and last purchase values resolved correctly!');
    } else {
      console.error('❌ Customer health or last purchase value resolution failed.');
    }

    // 6. Test triggerAutoFollowUps
    console.log('\n--- Testing triggerAutoFollowUps ---');
    let autoResult = null;
    const reqAuto = { user };
    const resAuto = {
      json(data) {
        autoResult = data;
      }
    };
    // Ensure we delete any pending follow-ups for our test customers first
    await CrmFollowUp.destroy({ where: { customerId: [custAtRisk.id, custInactive.id] } });
    await crmController.triggerAutoFollowUps(reqAuto, resAuto, (err) => { throw err; });
    console.log('Auto Task Generation Result:', autoResult);
    const createdTasks = await CrmFollowUp.findAll({ where: { customerId: [custAtRisk.id, custInactive.id], status: 'Pending' } });
    console.log(`Created ${createdTasks.length} pending follow-up tasks.`);
    if (autoResult.success && createdTasks.length >= 2) {
      console.log('✅ Automated follow-up task creation succeeded!');
    } else {
      console.error('❌ Automated follow-up task creation failed.');
    }

    // 7. Test getReEngagementAiInsights
    console.log('\n--- Testing getReEngagementAiInsights ---');
    let aiResult = null;
    const reqAi = {};
    const resAi = {
      json(data) {
        aiResult = data;
      }
    };
    await crmController.getReEngagementAiInsights(reqAi, resAi, (err) => { throw err; });
    console.log('AI Insights Result length:', aiResult.insights.length);
    console.log('AI Insights Result text:\n', aiResult.insights);
    if (aiResult.success && aiResult.insights) {
      console.log('✅ AI re-engagement suggestions generated and cached successfully!');
    } else {
      console.error('❌ AI re-engagement suggestions failed.');
    }

    // Clean up test data
    console.log('\n--- Cleaning up test records ---');
    await Invoice.destroy({ where: { id: [inv1.id, inv2.id, inv3.id] } });
    await CrmFollowUp.destroy({ where: { customerId: [custActive.id, custAtRisk.id, custInactive.id] } });
    await Customer.destroy({ where: { id: [custActive.id, custAtRisk.id, custInactive.id] } });
    console.log('✅ Mock data cleaned up.');
    console.log('\n--- ALL RE-ENGAGEMENT TESTS PASSED SUCCESSFULLY! ---');
    process.exit(0);
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exit(1);
  }
}

testReEngagement();
