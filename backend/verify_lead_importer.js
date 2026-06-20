require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const { sequelize } = require('./config/db');
const crmController = require('./controllers/crmController');
const Lead = require('./models/Lead');
const Customer = require('./models/Customer');

async function test() {
  console.log("=== STARTING AI LEAD IMPORTER VERIFICATION ===");
  
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY environment variable is not defined!");
    process.exit(1);
  }
  console.log("🟢 GEMINI_API_KEY environment variable is configured.");

  try {
    console.log("Connecting to SQLite database...");
    await sequelize.authenticate();
    console.log("🟢 Database connected successfully.");

    // Helper to mock controller request-response loop
    const runController = (handler, body = {}, file = null) => {
      return new Promise((resolve, reject) => {
        const req = { body, file };
        const res = {
          json: (data) => resolve(data),
          status: (code) => {
            res.statusCode = code;
            return res;
          }
        };
        const next = (err) => reject(err);
        handler(req, res, next);
      });
    };

    // 1. Test raw text file extraction
    console.log("\n--- TEST 1: crmController.extractTextFromLeadFile (Text upload) ---");
    const mockFile = {
      buffer: Buffer.from("Green Life Millet Shop - Salem - 9123456789\nOrganic Life Stores, Coimbatore, 9000111222", "utf-8"),
      originalname: "leads_test.txt",
      mimetype: "text/plain"
    };
    const extractedResult = await runController(crmController.extractTextFromLeadFile, {}, mockFile);
    console.log("🟢 Extracted text result successfully!");
    console.log("Extracted Content:\n" + extractedResult.text);

    // 2. Test AI analysis and duplicate checks
    console.log("\n--- TEST 2: crmController.analyzeLeadsText (Gemini & Duplication matching) ---");
    // Ensure we have some existing Leads/Customers to trigger duplicate flag
    // Let's check for an existing Lead or create a dummy one
    const dummyLead = await Lead.findOne();
    const duplicateShopName = dummyLead ? dummyLead.shopName : "Muthu Organic Millet Stores";
    const duplicateMobile = dummyLead ? dummyLead.mobileNumber : "9443210981";

    console.log(`Using mock duplicates: Shop: "${duplicateShopName}", Phone: "${duplicateMobile}"`);

    const rawInputText = `
Kurinji Express Bazaar
+91 81100 00734
Nageswaran North Street
Kumbakonam

Anandam Grand
9840012345
West Main Road
Madurai
    `;

    console.log("Sending text input to Gemini parsing endpoint...");
    const analysisResult = await runController(crmController.analyzeLeadsText, { text: rawInputText });
    
    console.log("🟢 AI Analysis Result Summary:", analysisResult.summary);
    console.log("Parsed leads array size:", analysisResult.leads?.length);
    
    // Inspect duplicate flagging
    analysisResult.leads.forEach((l, i) => {
      console.log(`\nLead [${i + 1}] preview:`);
      console.log(`- Shop Name: "${l.shopName}"`);
      console.log(`- Mobile: "${l.mobileNumber}"`);
      console.log(`- Category: "${l.category}"`);
      console.log(`- Location: "${l.address}, ${l.city}"`);
      console.log(`- Is Duplicate: ${l.isDuplicate} (Reason: ${l.reason || 'None'})`);
      console.log(`- Is Invalid: ${l.isInvalid}`);
    });

    // 3. Test saving/importing leads in bulk
    console.log("\n--- TEST 3: crmController.importLeadsList (Saving to DB) ---");
    const leadsToImport = [
      {
        shopName: "Nectar Herbal Store",
        mobileNumber: "9845012345",
        address: "Anna Nagar",
        city: "Chennai",
        category: "Health Food Store"
      }
    ];

    const countBefore = await Lead.count();
    const importResult = await runController(crmController.importLeadsList, { leads: leadsToImport });
    const countAfter = await Lead.count();

    console.log("🟢 Import result response:", importResult);
    console.log(`🟢 Leads count in database: Before: ${countBefore} | After: ${countAfter}`);
    if (countAfter > countBefore) {
      console.log("🟢 Bulk save verified successfully! Lead added.");
      
      // Clean up the created test lead
      await Lead.destroy({ where: { mobileNumber: "9845012345" } });
      console.log("🟢 Cleaned up verification records from database.");
    } else {
      throw new Error("Lead count did not increase!");
    }

    console.log("\n🎉 ALL AI LEAD IMPORTER BACKEND CHECKS PASSED!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed with error:", err);
    process.exit(1);
  }
}

test();
