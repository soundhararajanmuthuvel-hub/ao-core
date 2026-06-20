const connectDB = require('./config/db');
const CustomerReview = require('./models/CustomerReview');
const Customer = require('./models/Customer');
const Invoice = require('./models/Invoice');
const User = require('./models/User');
const { getReviewPortal, submitReview } = require('./controllers/sfaController');
const { getReviewsList, sendReviewInvite } = require('./controllers/crmController');

const makeMockRes = () => {
  return {
    statusCode: 200,
    data: null,
    redirectUrl: null,
    headers: {},
    status: function(code) {
      this.statusCode = code;
      return this;
    },
    json: function(payload) {
      this.data = payload;
      return this;
    },
    redirect: function(url) {
      this.redirectUrl = url;
      return this;
    },
    setHeader: function(name, value) {
      this.headers[name] = value;
      return this;
    }
  };
};

async function runVerification() {
  console.log('--------------------------------------------------');
  console.log('🤖 STARTING CUSTOMER REVIEW FEATURE INTEGRATION TESTING');
  console.log('--------------------------------------------------\n');

  await connectDB();

  // Find/Create test customer and invoice
  let customer = await Customer.findOne({ where: { name: 'EcoBrand Wellness' } });
  if (!customer) {
    customer = await Customer.create({
      name: 'EcoBrand Wellness',
      email: 'sarah@ecobrand.com',
      phone: '9876500001',
      address: 'Sector 4, HSR Layout',
      customerType: 'White Label',
      paymentTerms: 'COD'
    });
  }

  let invoice = await Invoice.findOne({ where: { customerId: customer.id } });
  if (!invoice) {
    invoice = await Invoice.create({
      invoiceNumber: 'AO-TEST-INV-1',
      customerId: customer.id,
      date: new Date(),
      subtotal: 5000,
      discount: 0,
      gstTotal: 250,
      grandTotal: 5250,
      paymentMethod: 'bank',
      paymentStatus: 'paid',
      amountPaid: 5250,
      customerType: 'White Label',
      salesChannel: 'White Label'
    });
  }

  // Clean up any old reviews for this invoice
  await CustomerReview.destroy({ where: { invoiceId: invoice.id } });

  // Test 1: Generate Review Token and Invite URL
  console.log('Test 1: Generating review token and WhatsApp link invite...');
  let reviewToken = null;
  {
    const req = {
      body: { invoiceId: invoice.id },
      protocol: 'http',
      get: function(header) {
        if (header === 'host') return 'localhost:5000';
        return '';
      }
    };
    const res = makeMockRes();
    await sendReviewInvite(req, res, (err) => { throw err; });

    console.log(`✓ Review link response status: ${res.statusCode}`);
    console.log(`✓ Generated Token: ${res.data.review.token}`);
    console.log(`✓ WhatsApp URL: ${res.data.whatsappUrl}`);
    
    if (res.statusCode !== 200 || !res.data.review.token || !res.data.whatsappUrl.includes('reviews%2Fportal%2F')) {
      console.error('❌ Failed Test 1: Review generation was unsuccessful');
      process.exit(1);
    }
    reviewToken = res.data.review.token;
  }

  // Test 2: Fetching Review details via token lookup (JSON API mode)
  console.log('\nTest 2: Verifying GET /reviews/portal/:token API endpoint...');
  {
    const req = { params: { token: reviewToken } };
    const res = makeMockRes();
    await getReviewPortal(req, res, (err) => { throw err; });

    console.log(`✓ Token details response status: ${res.statusCode}`);
    console.log(`✓ Associated Customer: ${res.data.customer?.name} (Expected: EcoBrand Wellness)`);
    console.log(`✓ Associated Invoice: ${res.data.invoice?.invoiceNumber} (Expected: ${invoice.invoiceNumber})`);
    
    if (res.statusCode !== 200 || res.data.customer?.id !== customer.id || res.data.invoice?.id !== invoice.id) {
      console.error('❌ Failed Test 2: Could not fetch correct token lookup details');
      process.exit(1);
    }
  }

  // Test 3: Submitting feedback survey ratings and comment text
  console.log('\nTest 3: Submitting customer feedback review form ratings...');
  {
    const req = {
      params: { token: reviewToken },
      body: {
        productRating: 5,
        deliveryRating: 4,
        salesmanRating: 5,
        overallRating: 5,
        reviewText: 'Great product and polite executive!'
      }
    };
    const res = makeMockRes();
    await submitReview(req, res, (err) => { throw err; });

    console.log(`✓ Submit review response status: ${res.statusCode}`);
    console.log(`✓ Message: ${res.data.message}`);

    const updatedReview = await CustomerReview.findOne({ where: { token: reviewToken } });
    console.log(`✓ Saved Review Status: ${updatedReview.status} (Expected: Submitted)`);
    console.log(`✓ Saved Review Overall Rating: ${updatedReview.overallRating} (Expected: 5)`);
    console.log(`✓ Saved Review Text: "${updatedReview.reviewText}" (Expected: "Great product and polite executive!")`);

    if (res.statusCode !== 200 || updatedReview.status !== 'Submitted' || updatedReview.overallRating !== 5 || updatedReview.reviewText !== 'Great product and polite executive!') {
      console.error('❌ Failed Test 3: Review submission failed or stored incorrectly');
      process.exit(1);
    }
  }

  // Test 4: Verify rating analytics calculation (average ratings)
  console.log('\nTest 4: Checking CRM reviews analytics metrics calculations...');
  {
    const req = {};
    const res = makeMockRes();
    await getReviewsList(req, res, (err) => { throw err; });

    console.log(`✓ CRM Reviews stats status: ${res.statusCode}`);
    console.log(`✓ Average Overall Rating: ${res.data.averageOverallRating}`);
    console.log(`✓ Total Reviews Submitted: ${res.data.totalReviewsSubmitted}`);

    if (res.statusCode !== 200 || typeof res.data.averageOverallRating !== 'number' || res.data.totalReviewsSubmitted < 1) {
      console.error('❌ Failed Test 4: CRM review stats computed incorrectly');
      process.exit(1);
    }
  }

  // Test 5: Invalid Token lookup error response
  console.log('\nTest 5: Accessing with invalid token reference...');
  {
    const req = { params: { token: 'invalid_token_1234' } };
    const res = makeMockRes();
    await getReviewPortal(req, res, (err) => { throw err; });

    console.log(`✓ Invalid token response status: ${res.statusCode} (Expected: 404)`);
    console.log(`✓ Message: ${res.data.message}`);

    if (res.statusCode !== 404) {
      console.error('❌ Failed Test 5: Invalid token did not return 404');
      process.exit(1);
    }
  }

  console.log('\n--------------------------------------------------');
  console.log('🎉 ALL CUSTOMER REVIEW PORTAL END-TO-END TESTS PASSED!');
  console.log('--------------------------------------------------');
  process.exit(0);
}

runVerification().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
