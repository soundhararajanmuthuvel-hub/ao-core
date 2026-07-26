require('dotenv').config();
const { sequelize } = require('../config/db');
const { initLedgerSystem } = require('../services/ledgerService');

async function run() {
  try {
    console.log('Connecting to DB and syncing models...');
    await sequelize.sync(); // Create the 4 new tables
    console.log('Tables created. Initializing Chart of Accounts...');
    await initLedgerSystem();
    console.log('GL Initialization Complete!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
