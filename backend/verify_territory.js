const { sequelize } = require('./config/db');
const connectDB = require('./config/db');
const Customer = require('./models/Customer');
const territoryService = require('./utils/territoryService');

async function verify() {
  console.log('--- STARTING TERRITORY & CUSTOMER ID VERIFICATION ---');
  await connectDB();

  // Test geocoder directly
  console.log('\n1. Testing Geocoding Utility...');
  const tests = [
    { address: '12, Anna Nagar, Madurai', expectedCode: 'MDU-N' },
    { address: 'Periyar, Madurai South, Tamil Nadu', expectedCode: 'MDU-S' },
    { address: 'Srirangam, Trichy', expectedCode: 'TRI-C' },
    { address: 'Adyar, Chennai', expectedCode: 'CHN-C' },
    { address: 'Peelamedu, Coimbatore', expectedCode: 'CBE-E' },
    { address: 'Main Road, Kumbakonam', expectedCode: 'KMU-C' },
    { address: 'Perambalur Town', expectedCode: 'PER-C' },
    { address: 'Tirunelveli High Road', expectedCode: 'TNV-C' },
  ];

  for (const t of tests) {
    const res = territoryService.geocodeAddress(t.address);
    console.log(`Address: "${t.address}" -> Geocoded Zone: ${res ? res.code : 'None'} (Expected: ${t.expectedCode})`);
    if (!res || res.code !== t.expectedCode) {
      console.error(`❌ Geocoding failed for: ${t.address}`);
    }
  }

  // Clean old test customer
  await Customer.destroy({ where: { email: 'territorytest@ao.com' } });
  await Customer.destroy({ where: { email: 'territorytest2@ao.com' } });

  console.log('\n2. Testing Customer Model hook assignment...');

  // Create Madurai North Customer
  const cust1 = await Customer.create({
    name: 'Madurai North Shop',
    email: 'territorytest@ao.com',
    phone: '9876500001',
    customerType: 'Retail Shop',
    address: '100 Feet Road, Anna Nagar, Madurai',
    paymentTerms: 'COD'
  });

  console.log(`✓ Customer 1 Created:`);
  console.log(`  Name: ${cust1.name}`);
  console.log(`  Resolved Territory: ${cust1.territory} (${cust1.routeZone})`);
  console.log(`  Customer Code: ${cust1.customerCode}`);
  console.log(`  Assigned Salesman ID: ${cust1.assignedSalesmanId}`);

  if (cust1.routeZone !== 'MDU-N' || !cust1.customerCode.startsWith('MDU-N-')) {
    console.error('❌ Failed: Customer should be in Madurai North (MDU-N)');
  }

  // Create another customer in same territory to test sequential IDs
  const cust2 = await Customer.create({
    name: 'Madurai North Shop 2',
    email: 'territorytest2@ao.com',
    phone: '9876500002',
    customerType: 'Retail Shop',
    address: 'K.K. Nagar, Madurai',
    paymentTerms: 'COD'
  });

  console.log(`✓ Customer 2 Created in Madurai North:`);
  console.log(`  Name: ${cust2.name}`);
  console.log(`  Customer Code: ${cust2.customerCode}`);

  const code1Num = parseInt(cust1.customerCode.split('-')[2], 10);
  const code2Num = parseInt(cust2.customerCode.split('-')[2], 10);
  if (code2Num !== code1Num + 1) {
    console.error(`❌ Failed: Sequential IDs did not increment correctly. Code 1: ${cust1.customerCode}, Code 2: ${cust2.customerCode}`);
  } else {
    console.log('✓ Sequential ID generation incremented correctly!');
  }

  // Test updating coordinates & address -> should change territory and code format
  console.log('\n3. Testing updating address to Chennai...');
  cust1.address = '15, Adyar, Chennai';
  await cust1.save();

  console.log(`✓ Customer 1 updated address to Chennai:`);
  console.log(`  Resolved Territory: ${cust1.territory} (${cust1.routeZone})`);
  console.log(`  New Customer Code: ${cust1.customerCode}`);
  console.log(`  New Assigned Salesman ID: ${cust1.assignedSalesmanId}`);

  if (cust1.routeZone !== 'CHN-C' || !cust1.customerCode.startsWith('CHN-C-')) {
    console.error('❌ Failed: Customer should have migrated to Chennai Central (CHN-C)');
  } else {
    console.log('✓ Territory migration and ID reassignment passed!');
  }

  // Cleanup
  await cust1.destroy();
  await cust2.destroy();
  console.log('\n--- ALL TERRITORY LOGIC TESTS COMPLETED ---');
  process.exit(0);
}

verify().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
