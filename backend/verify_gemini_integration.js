require('dotenv').config();
const { sequelize } = require('./config/db');
const aiController = require('./controllers/aiController');

async function test() {
  console.log("Starting AI Integration Verification...");
  console.log("Checking GEMINI_API_KEY environment variable...");
  if (!process.env.GEMINI_API_KEY) {
    console.error("❌ GEMINI_API_KEY is not defined!");
    process.exit(1);
  }
  console.log("✅ GEMINI_API_KEY is configured.");

  try {
    console.log("Connecting to database...");
    await sequelize.authenticate();
    console.log("✅ Database connected successfully.");

    // Helper to mock req/res
    const runController = (handler, body = {}) => {
      return new Promise((resolve, reject) => {
        const req = { body };
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

    console.log("\n1. Testing Lead Analysis CRM Controller...");
    const leadResult = await runController(aiController.analyzeLeads);
    console.log("✅ Lead Analysis Result keys:", Object.keys(leadResult));
    console.log("Snippet:", leadResult.reply ? leadResult.reply.substring(0, 150) + "..." : leadResult);

    console.log("\n2. Testing Customer Intelligence CRM Controller...");
    const custResult = await runController(aiController.customerIntelligence);
    console.log("✅ Customer Intelligence Result keys:", Object.keys(custResult));
    console.log("Snippet:", custResult.reply ? custResult.reply.substring(0, 150) + "..." : custResult);

    console.log("\n3. Testing Sales Assistant Controller...");
    const salesResult = await runController(aiController.salesAssistant, { customerId: 1 });
    console.log("✅ Sales Assistant Result keys:", Object.keys(salesResult));
    console.log("Snippet:", salesResult.reply ? salesResult.reply.substring(0, 150) + "..." : salesResult);

    console.log("\n4. Testing Inventory Intelligence Controller...");
    const invResult = await runController(aiController.inventoryIntelligence);
    console.log("✅ Inventory Intelligence Result keys:", Object.keys(invResult));
    console.log("Snippet:", invResult.reply ? invResult.reply.substring(0, 150) + "..." : invResult);

    console.log("\n5. Testing Accounts Assistant Controller...");
    const accountsResult = await runController(aiController.accountsAssistant);
    console.log("✅ Accounts Assistant Result keys:", Object.keys(accountsResult));
    console.log("Snippet:", accountsResult.reply ? accountsResult.reply.substring(0, 150) + "..." : accountsResult);

    console.log("\n6. Testing Manufacturing Planner Controller...");
    const mfgResult = await runController(aiController.manufacturingAssistant);
    console.log("✅ Manufacturing Assistant Result keys:", Object.keys(mfgResult));
    console.log("Snippet:", mfgResult.reply ? mfgResult.reply.substring(0, 150) + "..." : mfgResult);

    console.log("\n7. Testing AI Chat Assistant Controller...");
    const chatResult = await runController(aiController.chatAI, { message: "Show low stock" });
    console.log("✅ Chat AI Result keys:", Object.keys(chatResult));
    console.log("Snippet:", chatResult.reply ? chatResult.reply.substring(0, 150) + "..." : chatResult);

    console.log("\n🎉 ALL AI INTEGRATION TESTS COMPLETED SUCCESSFULLY!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Test failed with error:", err);
    process.exit(1);
  }
}

test();
