const { sequelize } = require('../config/db');
const AccountCategory = require('../models/AccountCategory');
const LedgerAccount = require('../models/LedgerAccount');
const JournalEntry = require('../models/JournalEntry');
const JournalLine = require('../models/JournalLine');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');

// Default Chart of Accounts Categories
const DEFAULT_CATEGORIES = [
  { name: 'Assets', normalBalance: 'Debit' },
  { name: 'Liabilities', normalBalance: 'Credit' },
  { name: 'Equity', normalBalance: 'Credit' },
  { name: 'Revenue', normalBalance: 'Credit' },
  { name: 'Expenses', normalBalance: 'Debit' }
];

// Core System Accounts
const SYSTEM_ACCOUNTS = [
  { code: '1000', name: 'Cash and Bank', systemType: 'Cash', category: 'Assets' },
  { code: '1100', name: 'Accounts Receivable (Control)', systemType: 'AR_Control', category: 'Assets' },
  { code: '1200', name: 'Inventory - Finished Goods', systemType: 'Inventory_FG', category: 'Assets' },
  { code: '1210', name: 'Inventory - Raw Materials', systemType: 'Inventory_RM', category: 'Assets' },
  { code: '2000', name: 'Accounts Payable (Control)', systemType: 'AP_Control', category: 'Liabilities' },
  { code: '2200', name: 'CGST Payable', systemType: 'CGST', category: 'Liabilities' },
  { code: '2201', name: 'SGST Payable', systemType: 'SGST', category: 'Liabilities' },
  { code: '2202', name: 'IGST Payable', systemType: 'IGST', category: 'Liabilities' },
  { code: '4000', name: 'Sales Revenue', systemType: 'Revenue', category: 'Revenue' },
  { code: '5000', name: 'Cost of Goods Sold', systemType: 'COGS', category: 'Expenses' },
  { code: '5100', name: 'Discounts Given', systemType: 'Discount', category: 'Expenses' },
  { code: '5200', name: 'Shipping Expense', systemType: 'Shipping', category: 'Expenses' }
];

let isInitialized = false;
let sysAccountCache = {};

async function initLedgerSystem() {
  if (isInitialized) return;

  try {
    for (const cat of DEFAULT_CATEGORIES) {
      await AccountCategory.findOrCreate({ where: { name: cat.name }, defaults: cat });
    }

    const categories = await AccountCategory.findAll();
    const catMap = {};
    categories.forEach(c => catMap[c.name] = c.id);

    for (const acc of SYSTEM_ACCOUNTS) {
      const [record] = await LedgerAccount.findOrCreate({
        where: { systemType: acc.systemType },
        defaults: {
          code: acc.code,
          name: acc.name,
          categoryId: catMap[acc.category],
          isActive: true
        }
      });
      sysAccountCache[acc.systemType] = record.id;
    }
    isInitialized = true;
  } catch (error) {
    console.error('Failed to initialize GL COA', error);
  }
}

async function getSystemAccount(systemType) {
  if (!isInitialized) await initLedgerSystem();
  return sysAccountCache[systemType];
}

async function getCustomerAccount(customerId, t) {
  if (!isInitialized) await initLedgerSystem();
  let account = await LedgerAccount.findOne({ where: { referenceModel: 'Customer', referenceId: customerId }, transaction: t });
  if (!account) {
    const customer = await Customer.findByPk(customerId, { transaction: t });
    if (!customer) throw new Error('Customer not found for AR Account creation');
    const arCategory = await AccountCategory.findOne({ where: { name: 'Assets' }});
    account = await LedgerAccount.create({
      name: `Accounts Receivable - ${customer.name}`,
      systemType: 'AR',
      categoryId: arCategory.id,
      referenceId: customerId,
      referenceModel: 'Customer',
    }, { transaction: t });
  }
  return account.id;
}

async function getSupplierAccount(supplierId, t) {
  if (!isInitialized) await initLedgerSystem();
  let account = await LedgerAccount.findOne({ where: { referenceModel: 'Supplier', referenceId: supplierId }, transaction: t });
  if (!account) {
    const supplier = await Supplier.findByPk(supplierId, { transaction: t });
    if (!supplier) throw new Error('Supplier not found for AP Account creation');
    const apCategory = await AccountCategory.findOne({ where: { name: 'Liabilities' }});
    account = await LedgerAccount.create({
      name: `Accounts Payable - ${supplier.name}`,
      systemType: 'AP',
      categoryId: apCategory.id,
      referenceId: supplierId,
      referenceModel: 'Supplier',
    }, { transaction: t });
  }
  return account.id;
}

/**
 * Validates and posts a new journal entry
 * @param {Array} lines - Array of { accountId, debit, credit, description }
 */
async function postJournalEntry({ entryDate, referenceId, referenceModel, referenceNumber, description, lines }, transaction = null) {
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of lines) {
    totalDebit += Number(line.debit || 0);
    totalCredit += Number(line.credit || 0);
  }

  // Ensure balance up to 2 decimal precision
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Journal entry unbalanced. Debits: ${totalDebit}, Credits: ${totalCredit}`);
  }

  const exec = async (t) => {
    const entry = await JournalEntry.create({
      entryDate: entryDate || new Date(),
      referenceId,
      referenceModel,
      referenceNumber,
      description,
      status: 'Posted'
    }, { transaction: t });

    for (const line of lines) {
      if (Number(line.debit) === 0 && Number(line.credit) === 0) continue;
      await JournalLine.create({
        journalEntryId: entry.id,
        accountId: line.accountId,
        debit: Number(line.debit || 0),
        credit: Number(line.credit || 0),
        description: line.description
      }, { transaction: t });
    }
    return entry;
  };

  if (transaction) {
    return exec(transaction);
  } else {
    return sequelize.transaction(t => exec(t));
  }
}

module.exports = {
  initLedgerSystem,
  getSystemAccount,
  getCustomerAccount,
  getSupplierAccount,
  postJournalEntry
};
