const connectDB = require('./config/db');
const User = require('./models/User');
const Visit = require('./models/Visit');
const Customer = require('./models/Customer');
const SalesmanLocation = require('./models/SalesmanLocation');
const { getLiveTracking } = require('./controllers/sfaController');

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

async function verify() {
  console.log('--- STARTING SFA LIVE TRACKING API VERIFICATION ---');
  await connectDB();

  // Find or create test salesman
  let salesman = await User.findOne({ where: { role: 'Salesman' } });
  if (!salesman) {
    salesman = await User.create({
      name: 'Test Salesman Map',
      email: 'sales_map@ao.com',
      password: 'password123',
      role: 'Salesman'
    });
    console.log(`✓ Created test salesman: ${salesman.email}`);
  } else {
    console.log(`✓ Using existing salesman: ${salesman.name} (${salesman.email})`);
  }

  // Create test customer
  let customer = await Customer.findOne();
  if (!customer) {
    customer = await Customer.create({
      name: 'Test Customer Geofence',
      email: 'cust_geo@ao.com',
      phone: '9876543210',
      address: 'Coimbatore, Tamil Nadu',
      latitude: 11.0180,
      longitude: 76.9640,
      customerType: 'Retail Shop',
      paymentTerms: 'COD'
    });
    console.log(`✓ Created test customer: ${customer.name}`);
  }

  // Cleanup old visits and pings for today to get a clean baseline
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  await Visit.destroy({ where: { salesmanId: salesman.id } });
  await SalesmanLocation.destroy({ where: { salesmanId: salesman.id } });

  console.log('\n1. Verifying getLiveTracking with no initial activity...');
  {
    const req = {};
    const res = makeMockRes();
    await getLiveTracking(req, res, (err) => { throw err; });
    
    const record = res.data.find(r => r.salesman.id === salesman.id);
    console.log(`✓ Found salesman tracking record: ${!!record}`);
    console.log(`✓ Current Customer: ${record?.currentCustomer} (Expected: None (Idle))`);
    console.log(`✓ Last Activity: ${record?.lastActivity} (Expected: No activity today)`);
    console.log(`✓ Distance Covered: ${record?.distanceCoveredToday} KM (Expected: 0.0)`);
    
    if (!record || record.currentCustomer !== 'None (Idle)' || record.lastActivity !== 'No activity today' || record.distanceCoveredToday !== 0) {
      console.error('❌ Failed baseline checks');
      process.exit(1);
    }
  }

  console.log('\n2. Simulating salesman movement (pings)...');
  // Ping 1: Gandhipuram (11.0180, 76.9640)
  const p1 = await SalesmanLocation.create({
    salesmanId: salesman.id,
    latitude: 11.0180,
    longitude: 76.9640,
    timestamp: new Date()
  });

  // Wait 10 ms to ensure sequential order in SQLite timestamp comparisons
  await new Promise(r => setTimeout(r, 10));

  // Ping 2: Peelamedu (11.0260, 76.9950) ~ 3.5 km away
  const p2 = await SalesmanLocation.create({
    salesmanId: salesman.id,
    latitude: 11.0260,
    longitude: 76.9950,
    timestamp: new Date()
  });

  console.log('✓ Salesman location pings simulated.');

  console.log('\n3. Verifying getLiveTracking after GPS movement pings...');
  {
    const req = {};
    const res = makeMockRes();
    await getLiveTracking(req, res, (err) => { throw err; });
    
    const record = res.data.find(r => r.salesman.id === salesman.id);
    console.log(`✓ Last Activity: ${record?.lastActivity}`);
    console.log(`✓ Distance Covered Today: ${record?.distanceCoveredToday} KM (Expected: ~3.5 KM)`);
    
    if (!record || record.distanceCoveredToday < 3.0 || record.distanceCoveredToday > 4.0) {
      console.error(`❌ Failed distance checks: distance resolved to ${record?.distanceCoveredToday} KM`);
      process.exit(1);
    }
  }

  console.log('\n4. Simulating Active Customer Check-In visit...');
  const visit = await Visit.create({
    salesmanId: salesman.id,
    customerId: customer.id,
    checkInTime: new Date(),
    checkOutTime: null,
    latitude: 11.0260,
    longitude: 76.9950,
    status: 'Visited'
  });
  console.log(`✓ Simulated Active Check-In to customer: ${customer.name}`);

  console.log('\n5. Verifying getLiveTracking active check-in stats...');
  {
    const req = {};
    const res = makeMockRes();
    await getLiveTracking(req, res, (err) => { throw err; });
    
    const record = res.data.find(r => r.salesman.id === salesman.id);
    console.log(`✓ Current Customer: ${record?.currentCustomer} (Expected: ${customer.name})`);
    console.log(`✓ Last Activity: ${record?.lastActivity}`);
    
    if (!record || record.currentCustomer !== customer.name || !record.lastActivity.includes('Checked in')) {
      console.error('❌ Failed active check-in checks');
      process.exit(1);
    }
  }

  // Cleanup
  await visit.destroy();
  await p1.destroy();
  await p2.destroy();
  if (salesman.email === 'sales_map@ao.com') {
    await salesman.destroy();
    console.log('\n✓ Cleaned up temporary test salesman.');
  }

  console.log('\n--------------------------------------------------');
  console.log('🎉 ALL SFA LIVE TRACKING BACKEND TESTS PASSED!');
  console.log('--------------------------------------------------');
  process.exit(0);
}

verify().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
