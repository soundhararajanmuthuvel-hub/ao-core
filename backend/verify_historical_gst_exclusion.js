const connectDB = require('./config/db');
const reportsController = require('./controllers/reportsController');

// Models
const Customer = require('./models/Customer');
const Invoice = require('./models/Invoice');
const InvoiceItem = require('./models/InvoiceItem');
const Product = require('./models/Product');

const mockResponse = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.body = data;
    return res;
  };
  return res;
};

// Require loadSalesGstRows helper
// Note: reportsController has loadSalesGstRows but it might not be exported directly.
// Let's check reportsController exports, if it's not exported we can check salesGstr1Report.
// Actually, we can test salesGstr1Report directly, which calls loadSalesGstRows!

async function runTests() {
  console.log('=== START GST EXCLUSION TEST FOR HISTORICAL DATA ===');
  try {
    await connectDB();
    console.log('✅ Database connected.');

    // 1. Clean up existing test data
    await InvoiceItem.destroy({ where: {} });
    await Invoice.destroy({ where: {} });
    await Customer.destroy({ where: { name: 'GST Test Customer' } });
    await Product.destroy({ where: { sku: 'TEST-GST-PROD' } });

    // 2. Create mock master records
    const customer = await Customer.create({
      name: 'GST Test Customer',
      email: 'gst-test@example.com',
      state: 'Tamil Nadu', // Code 33
      status: 'Active',
      gstNumber: '33AAAAA1111A1Z1'
    });
    const product = await Product.create({
      name: 'Test Product',
      sku: 'TEST-GST-PROD',
      sellingPrice: 100,
      gstPercent: 18
    });

    console.log('✅ Mock Customer & Product created.');

    // 3. Create test cases
    // A: Live Invoice with GST (18%)
    const invLiveWithGst = await Invoice.create({
      invoiceNumber: 'INV-LIVE-GST',
      customerId: customer.id,
      subtotal: 100.00,
      gstTotal: 18.00,
      grandTotal: 118.00,
      status: 'Confirmed',
      is_historical_data: false,
      gstBillingMode: 'exclusive',
      type: 'invoice',
      invoiceType: 'GST',
      customerGSTIN: '33AAAAA1111A1Z1',
      placeOfSupply: 'Tamil Nadu'
    });
    await InvoiceItem.create({
      invoiceId: invLiveWithGst.id,
      productId: product.id,
      name: 'Test Product',
      qty: 1,
      unitPrice: 100.00,
      gstPercent: 18,
      lineTotal: 100.00
    });

    // B: Live Invoice with 0% GST
    const invLiveZeroGst = await Invoice.create({
      invoiceNumber: 'INV-LIVE-ZERO',
      customerId: customer.id,
      subtotal: 100.00,
      gstTotal: 0.00,
      grandTotal: 100.00,
      status: 'Confirmed',
      is_historical_data: false,
      gstBillingMode: 'exclusive',
      type: 'invoice',
      invoiceType: 'GST',
      customerGSTIN: '33AAAAA1111A1Z1',
      placeOfSupply: 'Tamil Nadu'
    });
    await InvoiceItem.create({
      invoiceId: invLiveZeroGst.id,
      productId: product.id,
      name: 'Test Product',
      qty: 1,
      unitPrice: 100.00,
      gstPercent: 0,
      lineTotal: 100.00
    });

    // C: Historical Invoice with GST (18%)
    const invHistWithGst = await Invoice.create({
      invoiceNumber: 'INV-HIST-GST',
      customerId: customer.id,
      subtotal: 100.00,
      gstTotal: 18.00,
      grandTotal: 118.00,
      status: 'Confirmed',
      is_historical_data: true,
      gstBillingMode: 'exclusive',
      type: 'invoice',
      invoiceType: 'GST',
      customerGSTIN: '33AAAAA1111A1Z1',
      placeOfSupply: 'Tamil Nadu'
    });
    await InvoiceItem.create({
      invoiceId: invHistWithGst.id,
      productId: product.id,
      name: 'Test Product',
      qty: 1,
      unitPrice: 100.00,
      gstPercent: 18,
      lineTotal: 100.00
    });

    console.log('✅ Test Invoices (A: Live GST, B: Live 0% GST, C: Historical GST) seeded.');

    // 4. Test GST Reports Exclusion via salesGstr1Report endpoint
    console.log('Testing GST Report Exclusion:');
    const reqGst = { query: {} };
    const resGst = mockResponse();
    await reportsController.salesGstr1Report(reqGst, resGst);

    const gstRows = resGst.body.data || [];
    console.log(`  GST Report returned ${gstRows.length} rows.`);

    const foundLiveWithGst = gstRows.some(r => r.invoiceNumber === 'INV-LIVE-GST');
    const foundLiveZeroGst = gstRows.some(r => r.invoiceNumber === 'INV-LIVE-ZERO');
    const foundHistWithGst = gstRows.some(r => r.invoiceNumber === 'INV-HIST-GST');

    if (foundLiveWithGst && !foundLiveZeroGst && !foundHistWithGst) {
      console.log('  ✅ GST Report exclusions verified successfully: only live GST-applicable records included.');
    } else {
      throw new Error(`GST exclusion failed. LiveGST:${foundLiveWithGst}, LiveZero:${foundLiveZeroGst}, HistGST:${foundHistWithGst}`);
    }

    // 5. Test Sales Report Toggles
    console.log('Testing Sales Report Toggles:');

    // Case A: Include Both
    const reqBoth = { query: { includeLive: 'true', includeHistorical: 'true' } };
    const resBoth = mockResponse();
    await reportsController.salesReport(reqBoth, resBoth);
    const bothSales = resBoth.body.sales || [];
    console.log(`  Both: Returned ${bothSales.length} records.`);
    if (bothSales.length >= 3) {
      console.log('  ✅ Include Live + Historical works.');
    } else {
      throw new Error(`Expected at least 3 records, got ${bothSales.length}`);
    }

    // Case B: Live Only
    const reqLiveOnly = { query: { includeLive: 'true', includeHistorical: 'false' } };
    const resLiveOnly = mockResponse();
    await reportsController.salesReport(reqLiveOnly, resLiveOnly);
    const liveOnlySales = resLiveOnly.body.sales || [];
    console.log(`  Live Only: Returned ${liveOnlySales.length} records.`);
    const hasHistInLive = liveOnlySales.some(s => s.invoiceNumber === 'INV-HIST-GST');
    if (!hasHistInLive && liveOnlySales.some(s => s.invoiceNumber === 'INV-LIVE-GST') && liveOnlySales.some(s => s.invoiceNumber === 'INV-LIVE-ZERO')) {
      console.log('  ✅ Live Only filters correctly.');
    } else {
      throw new Error(`Live-only check failed. Rows: ${JSON.stringify(liveOnlySales.map(x => x.invoiceNumber))}`);
    }

    // Case C: Historical Only
    const reqHistOnly = { query: { includeLive: 'false', includeHistorical: 'true' } };
    const resHistOnly = mockResponse();
    await reportsController.salesReport(reqHistOnly, resHistOnly);
    const histOnlySales = resHistOnly.body.sales || [];
    console.log(`  Historical Only: Returned ${histOnlySales.length} records.`);
    const hasLiveInHist = histOnlySales.some(s => s.invoiceNumber === 'INV-LIVE-GST' || s.invoiceNumber === 'INV-LIVE-ZERO');
    if (!hasLiveInHist && histOnlySales.some(s => s.invoiceNumber === 'INV-HIST-GST')) {
      console.log('  ✅ Historical Only filters correctly.');
    } else {
      throw new Error(`Historical-only check failed. Rows: ${JSON.stringify(histOnlySales.map(x => x.invoiceNumber))}`);
    }

    // Case D: None
    const reqNone = { query: { includeLive: 'false', includeHistorical: 'false' } };
    const resNone = mockResponse();
    await reportsController.salesReport(reqNone, resNone);
    const noneSales = resNone.body.sales || [];
    console.log(`  None: Returned ${noneSales.length} records.`);
    if (noneSales.length === 0) {
      console.log('  ✅ Deselecting both options filters all records.');
    } else {
      throw new Error(`Expected 0 records, got ${noneSales.length}`);
    }

    console.log('\n⭐ ALL AUTOMATED MIGRATION GST EXCLUSION TESTS COMPLETED SUCCESSFULLY! ⭐');
    process.exit(0);
  } catch (err) {
    console.error('❌ GST Exclusion test failed:', err);
    process.exit(1);
  }
}

runTests();
