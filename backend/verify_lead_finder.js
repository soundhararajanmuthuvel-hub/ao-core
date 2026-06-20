const { sequelize } = require('./config/db');
const Lead = require('./models/Lead');
const Customer = require('./models/Customer');
const User = require('./models/User');
const Visit = require('./models/Visit');
const { findSimulatedLeads, createLead, convertLead } = require('./controllers/crmController');
const { checkInVisit, checkOutVisit, getVisits } = require('./controllers/sfaController');

const makeMockRes = () => {
  return {
    statusCode: 200,
    data: null,
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(payload) {
      this.data = payload;
      return this;
    }
  };
};

async function runVerification() {
  console.log('--------------------------------------------------');
  console.log('🤖 STARTING CRM SMART LEAD FINDER & FIELD VISITS INTEGRATION TESTING');
  console.log('--------------------------------------------------\n');

  try {
    // 0. Ensure user (Salesman) exists for assignment
    let salesman = await User.findOne({ where: { role: 'Salesman' } });
    if (!salesman) {
      salesman = await User.create({
        name: 'Test Salesman',
        username: 'test_salesman_' + Date.now(),
        email: 'salesman@ao-test.com',
        password: 'password123',
        role: 'Salesman',
        isActive: true
      });
      console.log(`Created test salesman User with ID: ${salesman.id}`);
    } else {
      console.log(`Using existing salesman: ${salesman.name} (ID: ${salesman.id})`);
    }

    // 1. Test findSimulatedLeads (both normal OSM and Fallback simulated)
    console.log('\n--- Test 1: findSimulatedLeads (Lead Finder Scan) ---');
    const req1 = {
      query: {
        city: 'Madurai',
        radius: '10',
        categories: 'Supermarkets,Organic Stores'
      }
    };
    const res1 = makeMockRes();
    await findSimulatedLeads(req1, res1);

    if (res1.statusCode === 200 && res1.data.success) {
      console.log(`🟢 Lead Finder scan successful! Found ${res1.data.resultsCount} potential leads.`);
      console.log(`   Center coordinates: lat: ${res1.data.center.latitude}, lon: ${res1.data.center.longitude}`);
      console.log(`   Fallback mode active? ${res1.data.isFallback}`);
      if (res1.data.results.length > 0) {
        console.log(`   Sample result: "${res1.data.results[0].shopName}" in ${res1.data.results[0].city}`);
      }
    } else {
      throw new Error(`Lead Finder scan failed with status: ${res1.statusCode}`);
    }

    // 2. Test createLead (validating auto-territory & salesman resolution)
    console.log('\n--- Test 2: createLead (Auto-territory Routing) ---');
    const leadShopName = 'Test Supermarket Lead_' + Date.now();
    const req2 = {
      body: {
        shopName: leadShopName,
        category: 'Supermarkets',
        ownerName: 'Subbiah Pillai',
        mobileNumber: '9845612340',
        address: '45, K.K. Nagar, Madurai',
        latitude: 9.9280,
        longitude: 78.1290,
        source: 'OSM Scan'
      }
    };
    const res2 = makeMockRes();
    await createLead(req2, res2);

    let testLead = null;
    if (res2.statusCode === 201 && res2.data.id) {
      testLead = res2.data;
      console.log(`🟢 Lead created successfully! ID: ${testLead.id}`);
      console.log(`   Resolved Area/Territory: "${testLead.area}"`);
      console.log(`   Assigned Salesman ID: ${testLead.assignedSalesmanId}`);
      if (!testLead.area || !testLead.assignedSalesmanId) {
        throw new Error('Failed to resolve territory or assigned salesman automatically.');
      }
    } else {
      throw new Error(`Lead creation failed with status: ${res2.statusCode}`);
    }

    // 3. Test checkInVisit for Lead targets (Field Sales Ingestion)
    console.log('\n--- Test 3: checkInVisit for Lead targets ---');
    const req3 = {
      user: { id: salesman.id },
      body: {
        leadId: testLead.id,
        latitude: 9.9280,
        longitude: 78.1290
      }
    };
    const res3 = makeMockRes();
    await checkInVisit(req3, res3);

    let activeVisit = null;
    if (res3.statusCode === 201 && res3.data.id) {
      activeVisit = res3.data;
      console.log(`🟢 Check-in to Lead successful! Visit ID: ${activeVisit.id}`);
      console.log(`   Check-in Time: ${activeVisit.checkInTime}`);
      console.log(`   Visit records leadId: ${activeVisit.leadId}, customerId: ${activeVisit.customerId}`);
      if (activeVisit.leadId !== testLead.id) {
        throw new Error('Check-in visit did not link correct leadId!');
      }
    } else {
      throw new Error(`Check-in to Lead failed with status: ${res3.statusCode}`);
    }

    // 4. Test convertLead (conversion of lead to customer, re-linking active visits)
    console.log('\n--- Test 4: convertLead (Lead to Customer Conversion) ---');
    const req4 = {
      params: { id: testLead.id }
    };
    const res4 = makeMockRes();
    await convertLead(req4, res4);

    let customerResult = null;
    if (res4.statusCode === 200 && res4.data.customer) {
      customerResult = res4.data.customer;
      console.log(`🟢 Lead converted successfully to Customer!`);
      console.log(`   Generated Customer Code: "${customerResult.customerCode}"`);
      console.log(`   Linked Customer ID: ${customerResult.id}`);

      // Verify lead status is updated to 'Customer'
      const updatedLead = await Lead.findByPk(testLead.id);
      console.log(`   Lead Status in DB: "${updatedLead.status}"`);
      if (updatedLead.status !== 'Customer' || updatedLead.customerId !== customerResult.id) {
        throw new Error('Lead status or customer ID reference was not updated in DB.');
      }

      // Verify visit is updated to link customerId
      const updatedVisit = await Visit.findByPk(activeVisit.id);
      console.log(`   Visit customerId updated? ${updatedVisit.customerId}`);
      if (updatedVisit.customerId !== customerResult.id) {
        throw new Error('The check-in visit was not successfully re-linked to the new customer record.');
      }
    } else {
      throw new Error(`Lead conversion failed with status: ${res4.statusCode}`);
    }

    // 5. Test checkOutVisit to close session
    console.log('\n--- Test 5: checkOutVisit ---');
    const req5 = {
      user: { id: salesman.id },
      body: {
        visitId: activeVisit.id,
        status: 'Order Taken',
        notes: 'Lead successfully converted to customer. First retailer order taken.',
        photo: 'data:image/png;base64,mockphotodata'
      }
    };
    const res5 = makeMockRes();
    await checkOutVisit(req5, res5);

    if (res5.statusCode === 200 && res5.data.checkOutTime) {
      console.log(`🟢 Check-out successful! Visit duration: ${res5.data.duration} minutes.`);
      console.log(`   Visit Notes: "${res5.data.notes}"`);
      console.log(`   Visit Outcome Status: "${res5.data.status}"`);
    } else {
      throw new Error(`Check-out failed with status: ${res5.statusCode}`);
    }

    // 6. Test getVisits log displays correctly
    console.log('\n--- Test 6: getVisits list view log validation ---');
    const req6 = {
      query: { salesmanId: salesman.id }
    };
    const res6 = makeMockRes();
    await getVisits(req6, res6);

    if (res6.statusCode === 200 && res6.data.length > 0) {
      const loggedVisit = res6.data.find(v => v.id === activeVisit.id);
      if (loggedVisit) {
        console.log(`🟢 getVisits validated! Successfully verified visit log entry.`);
        console.log(`   Linked Customer Name: "${loggedVisit.customer?.name}"`);
        console.log(`   Linked Lead Area/Territory: "${loggedVisit.lead?.area}"`);
      } else {
        throw new Error('Completed visit was not found in the logged visits feed.');
      }
    } else {
      throw new Error(`getVisits failed with status: ${res6.statusCode}`);
    }

    console.log('\n🎉 ALL SMART LEAD FINDER & FIELD VISITS TESTS PASSED SUCCESSFULLY! 🌟');
  } catch (error) {
    console.error('\n🔴 VERIFICATION FAILED:', error);
    process.exit(1);
  }
}

runVerification();
