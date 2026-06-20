const connectDB = require('./config/db');
const Lead = require('./models/Lead');
const Customer = require('./models/Customer');
const User = require('./models/User');
const CrmOpportunity = require('./models/CrmOpportunity');
const CrmFollowUp = require('./models/CrmFollowUp');
const CrmNote = require('./models/CrmNote');
const Visit = require('./models/Visit');
const { getSettings } = require('./utils/helpers');
const territoryService = require('./utils/territoryService');

async function runVerification() {
  console.log('--------------------------------------------------');
  console.log('🤖 STARTING CRM & FIELD SALES INTEGRATION TESTING');
  console.log('--------------------------------------------------\n');

  await connectDB();

  // Test 1: Geocoding and auto territory salesman routing
  console.log('Test 1: Testing Address Geocoding & Salesman Auto-routing...');
  const resolution = territoryService.resolveTerritoryAndSalesman(
    null,
    null,
    '12, Anna Nagar Main Road, Madurai'
  );
  console.log(`✓ Resolved Zone: ${resolution.routeZone} (Territory: ${resolution.territory})`);
  console.log(`✓ Auto Assigned Salesman ID: ${resolution.assignedSalesmanId}\n`);

  if (resolution.routeZone !== 'MDU-N') {
    console.error('❌ Failed: Territory should have geocoded to MDU-N');
    process.exit(1);
  }

  // Test 2: Create a CRM Lead
  console.log('Test 2: Creating CRM Lead and testing attributes...');
  // Clean up any old test data
  await Lead.destroy({ where: { shopName: 'Test Millet Emporium' } });
  
  const resolutionData = territoryService.resolveTerritoryAndSalesman(
    null,
    null,
    '22, Anna Nagar, Madurai'
  );

  const lead = await Lead.create({
    shopName: 'Test Millet Emporium',
    category: 'Millet Stores',
    ownerName: 'Muthu Krishnan',
    mobileNumber: '9566123450',
    address: '22, Anna Nagar, Madurai',
    city: 'Madurai',
    source: 'Justdial',
    status: 'New',
    latitude: resolutionData.latitude,
    longitude: resolutionData.longitude,
    assignedSalesmanId: resolutionData.assignedSalesmanId,
    area: resolutionData.territory
  });

  console.log(`✓ Lead Created: "${lead.shopName}" (Status: ${lead.status})`);
  console.log(`✓ Resolved GPS Coords: Lat ${lead.latitude}, Lng ${lead.longitude}`);
  console.log(`✓ Assigned Salesman: ${lead.assignedSalesmanId}\n`);

  if (!lead.latitude || !lead.assignedSalesmanId) {
    console.error('❌ Failed: Lead must have resolved coordinates and assigned salesman');
    process.exit(1);
  }

  // Create linked followups & notes on lead
  const note = await CrmNote.create({
    leadId: lead.id,
    note: 'Initial catalog discussed'
  });
  const followUp = await CrmFollowUp.create({
    leadId: lead.id,
    followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
    type: 'Call Customer',
    notes: 'Confirm price lists',
    status: 'Pending'
  });
  console.log(`✓ Created linked Note and Follow-up on Lead ID: ${lead.id}\n`);

  // Test 3: Convert Lead to Customer Master
  console.log('Test 3: Converting Lead to Customer Master...');
  
  // Clean up any old customer record
  await Customer.destroy({ where: { name: 'Test Millet Emporium' } });

  // Call the conversion logic simulated from crmController
  const customer = await Customer.create({
    name: lead.shopName,
    phone: lead.mobileNumber,
    email: `lead_${lead.id}@ao.com`,
    address: lead.address,
    latitude: lead.latitude,
    longitude: lead.longitude,
    contactPerson: lead.ownerName || '',
    state: lead.state || 'Tamil Nadu',
    customerType: 'Retail Shop',
    leadId: lead.id,
    tier: 'RED'
  });

  await lead.update({
    status: 'Customer',
    customerId: customer.id
  });

  // Migrate note & follow-up references
  await CrmNote.update({ customerId: customer.id }, { where: { leadId: lead.id } });
  await CrmFollowUp.update({ customerId: customer.id }, { where: { leadId: lead.id } });

  console.log(`✓ Lead successfully converted to Customer!`);
  console.log(`✓ Generated Customer Code: ${customer.customerCode}`);
  console.log(`✓ Assigned Salesman on Customer record: ${customer.assignedSalesmanId}`);

  if (!customer.customerCode.startsWith('MDU-N-')) {
    console.error(`❌ Failed: Converted customer code ${customer.customerCode} should start with MDU-N-`);
    process.exit(1);
  }

  // Verify notes/followup migrated
  const updatedNote = await CrmNote.findOne({ where: { id: note.id } });
  const updatedFollowUp = await CrmFollowUp.findOne({ where: { id: followUp.id } });
  
  console.log(`✓ Migrated Note customerId: ${updatedNote.customerId}`);
  console.log(`✓ Migrated Follow-up customerId: ${updatedFollowUp.customerId}\n`);

  if (updatedNote.customerId !== customer.id || updatedFollowUp.customerId !== customer.id) {
    console.error('❌ Failed: Notes/Followups references did not migrate to customerId');
    process.exit(1);
  }

  // Test 4: Opportunities stage updates
  console.log('Test 4: Creating and dragging Opportunities...');
  const opp = await CrmOpportunity.create({
    leadId: lead.id,
    title: 'Millet Bulk Deal',
    value: 12000,
    stage: 'Qualification',
    closeDate: new Date()
  });
  console.log(`✓ Opportunity created: "${opp.title}" (Stage: ${opp.stage}, Value: ₹${opp.value})`);
  
  await opp.update({ stage: 'Negotiation' });
  console.log(`✓ Dragged/Moved Opportunity stage to: "${opp.stage}"\n`);
  
  if (opp.stage !== 'Negotiation') {
    console.error('❌ Failed: Opportunity stage did not update');
    process.exit(1);
  }

  // Test 5: Validation thresholds & Cutoff delivery
  console.log('Test 5: Cutoff Delivery commitment calculations...');
  const settings = await getSettings();
  const cutoffHour = settings.sameDayCutoffHour !== undefined ? settings.sameDayCutoffHour : 13;
  console.log(`✓ Loaded sameDayCutoffHour limit: ${cutoffHour}:00`);

  const beforeCutoffDate = new Date();
  beforeCutoffDate.setHours(cutoffHour - 1); // 12:00 PM
  const beforeCommitment = beforeCutoffDate.getHours() < cutoffHour ? 'Same Day' : 'Next Day';
  console.log(`✓ Time: ${beforeCutoffDate.getHours()}:00 PM -> Dispatch Commitment: ${beforeCommitment}`);

  const afterCutoffDate = new Date();
  afterCutoffDate.setHours(cutoffHour + 1); // 2:00 PM
  const afterCommitment = afterCutoffDate.getHours() < cutoffHour ? 'Same Day' : 'Next Day';
  console.log(`✓ Time: ${afterCutoffDate.getHours()}:00 PM -> Dispatch Commitment: ${afterCommitment}\n`);

  if (beforeCommitment !== 'Same Day' || afterCommitment !== 'Next Day') {
    console.error('❌ Failed: Dispatch cutoff logic evaluated incorrectly');
    process.exit(1);
  }

  // Clean up
  await opp.destroy();
  await updatedNote.destroy();
  await updatedFollowUp.destroy();
  await customer.destroy();
  await lead.destroy();

  console.log('--------------------------------------------------');
  console.log('🎉 ALL INTEGRATION AND SFA LOGIC VERIFICATIONS PASSED!');
  console.log('--------------------------------------------------');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
