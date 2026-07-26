const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const ExcelJS = require('exceljs');
const { sequelize } = require('../config/db');

// Models
const User = require('../models/User');
const Customer = require('../models/Customer');
const Product = require('../models/Product');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const Payment = require('../models/Payment');
const Settings = require('../models/Settings');
const ActivityLog = require('../models/ActivityLog');
const Order = require('../models/Order');
const Shipment = require('../models/Shipment');
const StockMovement = require('../models/StockMovement');
const RawMaterial = require('../models/RawMaterial');
const ManufacturingEntry = require('../models/ManufacturingEntry');
const RepackEntry = require('../models/RepackEntry');
const MigrationHistory = require('../models/MigrationHistory');
const MigrationDetailLog = require('../models/MigrationDetailLog');

const parseZohoDate = (dateStr) => {
  if (!dateStr) return new Date();
  const cleaned = dateStr.trim();
  
  // DD-MM-YYYY or DD/MM/YYYY
  const dmyRegex = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/;
  let match = cleaned.match(dmyRegex);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const ymdRegex = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
  match = cleaned.match(ymdRegex);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }

  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const parseZohoNumber = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  if (!str) return 0;
  let isNegative = false;
  let cleaned = str;
  if (cleaned.startsWith('(') && cleaned.endsWith(')')) {
    isNegative = true;
    cleaned = cleaned.slice(1, -1);
  }
  cleaned = cleaned.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  return isNegative ? -parsed : parsed;
};

const extractDocumentFields = (row) => {
  const invoiceNumber = row['Invoice Number'] || row['InvoiceNo'] || row['Invoice #'] ||
                        row['Credit Note Number'] || row['Credit Note #'] || row['Creditnote Number'] || row['Credit Note ID'] ||
                        row['Quote Number'] || row['Quote #'] || row['Quote No'] || row['Estimate Number'] || row['Estimate #'] ||
                        row['Sales Receipt Number'] || row['Receipt Number'] || row['Receipt #'] || row['Sales Receipt #'] ||
                        row['Recurring Invoice Number'] || row['Profile Name'] || row['Recurring Invoice #'] || row['Recurring Invoice ID'] || '';
                        
  const customerName = row['Customer Name'] || row['Customer'] || row['Contact Name'] || '';
  
  const dateStr = row['Invoice Date'] || row['Credit Note Date'] || row['Quote Date'] || row['Estimate Date'] ||
                  row['Date'] || row['Receipt Date'] || row['Start Date'] || row['Created Time'] || row['Refund Date'] || row['Refund Time'] || '';
  
  const dueDateStr = row['Due Date'] || row['Payment Due Date'] || row['Expiry Date'] || row['Valid Until'] || '';

  const grandTotal = parseZohoNumber(
    row['Total'] ||
    row['Invoice Total'] ||
    row['SubTotal'] ||
    row['Sub total'] ||
    row['Net Total'] ||
    row['Grand Total'] ||
    row['Amount'] ||
    row['Refund Amount'] ||
    row['Expense Amount'] ||
    '0'
  );

  const amountPaid = parseZohoNumber(row['Amount Paid'] || row['Paid Amount'] || '0');
  const balance = parseZohoNumber(row['Balance'] || row['Balance Amount'] || '0');

  return {
    invoiceNumber: invoiceNumber.trim(),
    customerName: customerName.trim(),
    dateStr: dateStr.trim(),
    dueDateStr: dueDateStr.trim(),
    grandTotal,
    amountPaid,
    balance
  };
};

const generatePreview = (fileType, records) => {
  if (fileType === 'invoices' || fileType === 'credit_notes' || fileType === 'quotations' || fileType === 'sales_receipts' || fileType === 'recurring_invoices') {
    return records.slice(0, 3).map(r => {
      const fields = extractDocumentFields(r);
      return {
        docNumber: fields.invoiceNumber,
        customer: fields.customerName,
        total: fields.grandTotal
      };
    });
  } else if (fileType === 'customers') {
    return records.slice(0, 3).map(r => {
      return {
        name: r['Customer Name'] || r['Contact Name'] || r['Display Name'] || '',
        email: r['Email'] || r['Email Address'] || '',
        balance: parseZohoNumber(r['Outstanding Balance'] || r['Balance'] || '0')
      };
    });
  }
  return [];
};

// CSV Parser Helper
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];

    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push("");
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [""];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }

  if (lines.length === 0) return [];

  const headers = lines[0].map(h => h.trim());
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const rowValues = lines[i];
    if (rowValues.length < headers.length) continue;
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = rowValues[idx] ? rowValues[idx].trim() : '';
    });
    records.push(record);
  }
  return records;
}

// Excel Parser Helper
async function parseExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.getWorksheet(1);
  const records = [];
  const headers = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      row.eachCell((cell) => {
        headers.push(cell.text ? cell.text.trim() : '');
      });
    } else {
      const record = {};
      headers.forEach((header, idx) => {
        const cell = row.getCell(idx + 1);
        record[header] = cell ? cell.text.trim() : '';
      });
      records.push(record);
    }
  });
  return records;
}

// Smart detection handler
// Filename to module helper
// Smart detection handler
// Filename to module helper
const mapFilenameToModule = (filename) => {
  const nameWithoutExt = filename.replace(/\.(csv|xlsx)$/i, '').toLowerCase();

  // Customers (customers.csv, contacts.csv, customer.csv, Customers Export.csv, CustomerMaster.csv, Client_Master.csv)
  if (/customer|contact|client/i.test(nameWithoutExt) && !/contact_person/i.test(nameWithoutExt)) return 'customers';
  if (/contact_person/i.test(nameWithoutExt)) return 'contact_persons';

  // Invoices & Billing
  if (/invoice|bill|sales_inv|tax_inv/i.test(nameWithoutExt) && !/recurring/i.test(nameWithoutExt)) return 'invoices';
  if (/recurring.*invoice/i.test(nameWithoutExt)) return 'recurring_invoices';
  if (/sales_receipt|receipt/i.test(nameWithoutExt) && !/payment/i.test(nameWithoutExt)) return 'sales_receipts';

  // Payments
  if (/payment|received|amount_rec/i.test(nameWithoutExt)) return 'payments';

  // Products & Inventory
  if (/product|item|sku|goods|master_product/i.test(nameWithoutExt) && !/raw_material/i.test(nameWithoutExt)) return 'products';

  // Credit Notes
  if (/credit_note|creditnote/i.test(nameWithoutExt) && !/link|invoice/i.test(nameWithoutExt)) return 'credit_notes';
  if (/credit.*link|credit.*invoice/i.test(nameWithoutExt)) return 'credit_note_links';

  // Quotations & Estimates
  if (/quote|estimate|quotation/i.test(nameWithoutExt)) return 'quotations';

  // Refunds & Expenses
  if (/refund/i.test(nameWithoutExt)) return 'refunds';
  if (/expense/i.test(nameWithoutExt)) return 'expenses';

  // Raw Materials & Activity Logs
  if (/raw_material|rawmaterial|ingredient|bom/i.test(nameWithoutExt)) return 'raw_materials';
  if (/activity|log/i.test(nameWithoutExt)) return 'activity_logs';

  return null;
};

// CSV Headers helper
function extractCSVHeaders(text) {
  const firstLine = text.split(/\r?\n/)[0];
  if (!firstLine) return [];
  const row = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    const c = firstLine[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else {
      current += c;
    }
  }
  row.push(current.trim());
  return row;
}

// Excel Headers helper
async function extractExcelHeaders(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.getWorksheet(1);
  const headers = [];
  if (worksheet) {
    const firstRow = worksheet.getRow(1);
    if (firstRow) {
      firstRow.eachCell((cell) => {
        headers.push(cell.text ? cell.text.trim() : '');
      });
    }
  }
  return headers;
}

// Fallback detection helper
const detectModuleFromHeaders = (headers) => {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  const matchesCount = (arr) => arr.filter(item => lowerHeaders.some(lh => lh.includes(item))).length;

  if (matchesCount(['customer name', 'display name', 'outstanding balance', 'customer type', 'contact name', 'phone', 'email']) >= 1) return 'customers';
  if (matchesCount(['contact person', 'salutation', 'first name', 'last name']) >= 1) return 'contact_persons';
  if (matchesCount(['invoice number', 'invoice date', 'invoice id', 'invoice #', 'due date', 'total']) >= 1) return 'invoices';
  if (matchesCount(['payment number', 'payment mode', 'payment date', 'amount received', 'reference']) >= 1) return 'payments';
  if (matchesCount(['item name', 'item code', 'sku', 'selling price', 'rate', 'price', 'product name']) >= 1) return 'products';
  if (matchesCount(['credit note', 'credit note number', 'credit note date', 'credit note #']) >= 1) return 'credit_notes';
  if (matchesCount(['credit note id', 'creditnote id', 'invoice number', 'credited amount']) >= 1) return 'credit_note_links';
  if (matchesCount(['quote number', 'quote #', 'quote date', 'expiry date']) >= 1) return 'quotations';
  if (matchesCount(['sales receipt', 'sales receipt number', 'receipt date']) >= 1) return 'sales_receipts';
  if (matchesCount(['refund number', 'refund id', 'amount refunded']) >= 1) return 'refunds';
  if (matchesCount(['recurring invoice', 'profile name', 'recurrence']) >= 1) return 'recurring_invoices';
  if (matchesCount(['expense id', 'expense account', 'expense amount']) >= 1) return 'expenses';
  if (matchesCount(['activity log', 'log time', 'activity description']) >= 1) return 'activity_logs';

  return null;
};

exports.analyzeUploadedFiles = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    const filesFound = [];
    const analysisSummary = {
      customers: 0,
      contact_persons: 0,
      products: 0,
      invoices: 0,
      payments: 0,
      credit_notes: 0,
      credit_note_links: 0,
      quotations: 0,
      sales_receipts: 0,
      refunds: 0,
      recurring_invoices: 0,
      expenses: 0,
      activity_logs: 0,
      unmapped: 0
    };

    let extractedData = {};

    if (ext === '.zip') {
      const zip = new AdmZip(req.file.path);
      const zipEntries = zip.getEntries();

      for (const entry of zipEntries) {
        if (entry.isDirectory) continue;
        const name = path.basename(entry.entryName);
        if (name.startsWith('._') || name.startsWith('__MACOSX')) continue;
        
        const dataText = entry.getData().toString('utf8');
        let fileType = mapFilenameToModule(name);
        let records = [];

        if (name.toLowerCase().endsWith('.csv')) {
          records = parseCSV(dataText);
          if (!fileType) {
            const headers = extractCSVHeaders(dataText);
            fileType = detectModuleFromHeaders(headers);
          }
        } else if (name.toLowerCase().endsWith('.xlsx')) {
          const buffer = entry.getData();
          records = await parseExcel(buffer);
          if (!fileType) {
            const headers = await extractExcelHeaders(buffer);
            fileType = detectModuleFromHeaders(headers);
          }
        } else {
          filesFound.push({
            fileName: name,
            module: 'unmapped',
            recordCount: 0,
            status: 'Unsupported Format'
          });
          continue;
        }

        const count = records.length;
        if (fileType) {
          extractedData[fileType] = records;
          analysisSummary[fileType] = (analysisSummary[fileType] || 0) + count;
          filesFound.push({
            fileName: name,
            module: fileType,
            recordCount: count,
            status: 'Ready For Import',
            preview: generatePreview(fileType, records)
          });
        } else {
          analysisSummary.unmapped = (analysisSummary.unmapped || 0) + count;
          filesFound.push({
            fileName: name,
            module: 'unmapped',
            recordCount: count,
            status: 'Unmapped Module',
            preview: []
          });
        }
      }
    } else if (ext === '.csv' || ext === '.xlsx') {
      const name = req.file.originalname;
      let fileType = mapFilenameToModule(name);
      let records = [];

      if (ext === '.csv') {
        const text = fs.readFileSync(req.file.path, 'utf8');
        records = parseCSV(text);
        if (!fileType) {
          const headers = extractCSVHeaders(text);
          fileType = detectModuleFromHeaders(headers);
        }
      } else {
        const buffer = fs.readFileSync(req.file.path);
        records = await parseExcel(buffer);
        if (!fileType) {
          const headers = await extractExcelHeaders(buffer);
          fileType = detectModuleFromHeaders(headers);
        }
      }

      const count = records.length;
      if (fileType) {
        extractedData[fileType] = records;
        analysisSummary[fileType] = count;
        filesFound.push({
          fileName: name,
          module: fileType,
          recordCount: count,
          status: 'Ready For Import',
          preview: generatePreview(fileType, records)
        });
      } else {
        analysisSummary.unmapped = count;
        filesFound.push({
          fileName: name,
          module: 'unmapped',
          recordCount: count,
          status: 'Unmapped Module',
          preview: []
        });
      }
    }

    // Cache extracted data in a temporary JSON file to avoid uploading again
    const tempFileId = Date.now() + '.json';
    const tempPath = path.join(__dirname, '..', 'uploads', tempFileId);
    fs.writeFileSync(tempPath, JSON.stringify(extractedData), 'utf8');

    // Clean up uploaded file
    try {
      fs.unlinkSync(req.file.path);
    } catch {}

    res.json({
      success: true,
      tempFileId,
      filesFound,
      summary: analysisSummary
    });
  } catch (err) {
    console.error('File analysis failed:', err);
    res.status(500).json({ success: false, message: 'Failed to analyze uploaded backups', error: err.message });
  }
};

const activeMigrationJobs = new Map();

exports.getJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = activeMigrationJobs.get(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Migration background job not found' });
    }
    res.json({ success: true, job });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve job status', error: err.message });
  }
};

// Executing migration background job starter
exports.executeMigration = async (req, res) => {
  const { tempFileId } = req.body;
  const username = req.user?.name || 'Super Admin';

  if (!tempFileId) {
    return res.status(400).json({ success: false, message: 'Temporary session data missing' });
  }

  const tempPath = path.join(__dirname, '..', 'uploads', tempFileId);
  if (!fs.existsSync(tempPath)) {
    return res.status(400).json({ success: false, message: 'Migration session expired or files not analyzed' });
  }

  const extractedData = JSON.parse(fs.readFileSync(tempPath, 'utf8'));

  let migrationHistoryRecord = null;
  try {
    migrationHistoryRecord = await MigrationHistory.create({
      importDate: new Date(),
      user: username,
      source: 'Zoho Books Migration',
      recordCount: {},
      status: 'In Progress',
      snapshotData: { customers: [], products: [], invoices: [], payments: [] }
    });
  } catch (err) {
    console.error('Failed to initiate migration history log:', err);
    return res.status(500).json({ success: false, message: 'Failed to initiate migration log' });
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const totalCount = Object.values(extractedData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);

  const jobState = {
    jobId,
    migrationId: migrationHistoryRecord.id,
    status: 'Processing',
    progress: 5,
    currentStage: 'Initiating Background Migration Job (5%)',
    currentFile: 'Analysis Summary',
    recordsProcessed: 0,
    totalRecords: Math.max(1, totalCount),
    recordsImported: 0,
    recordsUpdated: 0,
    recordsSkipped: 0,
    recordsFailed: 0,
    report: {},
    totals: null,
    error: null,
    details: null,
    fixSuggestion: null,
    startTime: Date.now(),
    endTime: null,
    durationMs: 0
  };

  activeMigrationJobs.set(jobId, jobState);

  // Return HTTP 200 immediately to frontend (< 50ms)!
  res.json({
    success: true,
    jobId,
    migrationId: migrationHistoryRecord.id,
    message: 'Migration job started in background'
  });

  // Launch asynchronous execution in background worker thread
  setImmediate(() => {
    runAsyncMigrationWorker(jobId, tempPath, extractedData, req.body, migrationHistoryRecord, req.user);
  });
};

// Async Background Migration Worker Implementation
const runAsyncMigrationWorker = async (jobId, tempPath, extractedData, bodyOptions, migrationHistoryRecord, userUser) => {
  const jobState = activeMigrationJobs.get(jobId);
  const { duplicatePolicy, customerDuplicatePolicy, productDuplicatePolicy, is_historical_data } = bodyOptions;
  const isHistorical = is_historical_data === true || is_historical_data === 'true';

  const custPolicy = customerDuplicatePolicy || duplicatePolicy || 'merge';
  const prodPolicy = productDuplicatePolicy || duplicatePolicy || 'merge';
  const generalPolicy = duplicatePolicy || 'merge';

  const updateProgress = (stage, percent, fileInfo, processedCount) => {
    if (!jobState) return;
    jobState.currentStage = stage;
    jobState.progress = Math.min(99, Math.max(jobState.progress, percent));
    if (fileInfo) jobState.currentFile = fileInfo;
    if (processedCount !== undefined) jobState.recordsProcessed = processedCount;
  };

  updateProgress('Starting Transaction & File Ingestion (10%)', 10, 'Preparation', 0);

  // Database transaction boundary
  const t = await sequelize.transaction();

  try {
    const logMessages = [];
    const addLog = async (level, message) => {
      logMessages.push({ migrationId: migrationHistoryRecord.id, level, message });
      console.log(`[Migration Log - ${level}] ${message}`);
    };

    const countReport = {
      customers: 0,
      contact_persons: 0,
      products: 0,
      invoices: 0,
      payments: 0,
      credit_notes: 0,
      credit_note_links: 0,
      quotations: 0,
      sales_receipts: 0,
      refunds: 0,
      recurring_invoices: 0,
      expenses: 0,
      activity_logs: 0
    };
    const snapshot = { customers: [], products: [], invoices: [], payments: [] };

    /* ==================================================
       1. CUSTOMER MIGRATION
       ================================================== */
    const importedCustomers = extractedData.customers || [];
    const customerIdMap = {}; // Maps Zoho display name / business name to active DB Customer ID

    const resolveCustomerId = async (customerName) => {
      if (!customerName) return null;
      const key = customerName.toLowerCase();
      if (customerIdMap[key]) {
        return customerIdMap[key];
      }
      const dbCustomer = await Customer.findOne({
        where: { name: customerName },
        transaction: t
      });
      if (dbCustomer) {
        customerIdMap[key] = dbCustomer.id;
        return dbCustomer.id;
      }
      return null;
    };

    for (const cust of importedCustomers) {
      const name = cust['Customer Name'] || cust['Contact Name'] || cust['Display Name'];
      if (!name) continue;

      const businessName = cust['Company Name'] || cust['Business Name'] || '';
      const email = cust['Email'] || cust['Email Address'] || '';
      const phone = cust['Phone'] || cust['Mobile'] || cust['Work Phone'] || '';
      const gstNumber = cust['GSTIN'] || cust['GST Registration Number'] || cust['Tax ID'] || '';
      const address = cust['Billing Address'] || cust['Address'] || '';
      const state = cust['Billing State'] || cust['State'] || '';
      const pincode = cust['Billing Code'] || cust['Pincode'] || cust['Zip Code'] || '';
      
      let customerType = 'Retail Shop';
      const cType = cust['Customer Type'] || '';
      if (/distributor/i.test(cType)) customerType = 'Distributor';
      else if (/stockist/i.test(cType)) customerType = 'Super Stockist';
      else if (/d2c/i.test(cType)) customerType = 'D2C Customer';
      else if (/organic/i.test(cType)) customerType = 'Organic Store';
      else if (/white.*label/i.test(cType)) customerType = 'White Label';
      
      const balance = parseZohoNumber(cust['Outstanding Balance'] || cust['Balance'] || '0');
      const createdAt = cust['Created Time'] || cust['Customer Since'] || cust['Created Date'] || new Date();

      // Check for duplicates
      let existingCustomer = await Customer.findOne({
        where: {
          [sequelize.Sequelize.Op.or]: [
            { name },
            gstNumber ? { gstNumber } : null
          ].filter(Boolean)
        },
        transaction: t
      });

      let activeCustomerId = null;

      if (existingCustomer) {
        if (custPolicy === 'skip') {
          await addLog('DUPLICATE', `Customer "${name}" exists. Skipping.`);
          activeCustomerId = existingCustomer.id;
        } else if (custPolicy === 'update' || custPolicy === 'replace') {
          await addLog('DUPLICATE', `Customer "${name}" exists. Overwriting properties.`);
          await existingCustomer.update({
            businessName, email, phone, gstNumber, address, state, pincode, customerType, balance,
            createdAt: new Date(createdAt)
          }, { transaction: t });
          activeCustomerId = existingCustomer.id;
        } else {
          // Merge
          await addLog('DUPLICATE', `Customer "${name}" exists. Merging empty values.`);
          await existingCustomer.update({
            businessName: existingCustomer.businessName || businessName,
            email: existingCustomer.email || email,
            phone: existingCustomer.phone || phone,
            gstNumber: existingCustomer.gstNumber || gstNumber,
            address: existingCustomer.address || address,
            state: existingCustomer.state || state,
            pincode: existingCustomer.pincode || pincode,
          }, { transaction: t });
          activeCustomerId = existingCustomer.id;
        }
      } else {
        // Create new Customer
        const newCust = await Customer.create({
          name, businessName, email, phone, gstNumber, address, state, pincode, customerType, balance,
          createdAt: new Date(createdAt),
          status: 'Active',
          billToBillEnabled: true
        }, { transaction: t });
        
        activeCustomerId = newCust.id;
        snapshot.customers.push(newCust.id);
        countReport.customers++;
      }

      customerIdMap[name.toLowerCase()] = activeCustomerId;
      if (businessName) {
        customerIdMap[businessName.toLowerCase()] = activeCustomerId;
      }
    }

    /* ==================================================
       2. CONTACT PERSONS MIGRATION
       ================================================== */
    const importedContactPersons = extractedData.contact_persons || [];
    for (const cp of importedContactPersons) {
      const firstName = cp['First Name'] || '';
      const lastName = cp['Last Name'] || '';
      const name = cp['Contact Person Name'] || cp['Name'] || `${firstName} ${lastName}`.trim();
      if (!name) continue;

      const customerName = cp['Customer Name'] || cp['Company Name'] || cp['Display Name'] || '';
      if (!customerName) continue;

      // Find the customer
      const customerId = customerIdMap[customerName.toLowerCase()];
      if (customerId) {
        await Customer.update(
          { contactPerson: name },
          { where: { id: customerId }, transaction: t }
        );
        await addLog('INFO', `Updated contact person "${name}" for customer "${customerName}".`);
        countReport.contact_persons++;
      } else {
        await addLog('WARNING', `Could not map contact person "${name}" to customer "${customerName}".`);
      }
    }

    /* ==================================================
       3. PRODUCT MIGRATION
       ================================================== */
    const importedProducts = extractedData.products || [];
    const productSKUMap = {}; // Maps Zoho SKU or Product Name to active DB Product

    const resolveProduct = async (prodName) => {
      if (!prodName) return null;
      const key = prodName.toLowerCase();
      if (productSKUMap[key]) {
        return productSKUMap[key];
      }
      const dbProduct = await Product.findOne({
        where: {
          [sequelize.Sequelize.Op.or]: [
            { sku: prodName },
            { name: prodName }
          ]
        },
        transaction: t
      });
      if (dbProduct) {
        productSKUMap[key] = dbProduct;
        return dbProduct;
      }
      return null;
    };

    for (const prod of importedProducts) {
      const name = prod['Item Name'] || prod['Product Name'] || prod['Name'];
      if (!name) continue;

      const sku = prod['SKU'] || prod['Item Code'] || `SKU-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const price = parseZohoNumber(prod['Rate'] || prod['Selling Price'] || prod['Price'] || '0');
      const gstPercent = parseZohoNumber(prod['Tax %'] || prod['GST %'] || prod['Tax Percentage'] || '0');
      const category = prod['Category'] || prod['Item Category'] || 'General';
      const stock = parseZohoNumber(prod['Stock'] || prod['Stock on Hand'] || '0');
      const description = prod['Description'] || prod['Item Description'] || '';
      const hsnCode = prod['HSN Code'] || prod['HSN/SAC'] || '';
      const image = prod['Image URL'] || prod['Product Image'] || '';

      // Check duplicates
      let existingProduct = await Product.findOne({ where: { sku }, transaction: t });
      let activeProduct = null;

      if (existingProduct) {
        if (prodPolicy === 'skip') {
          await addLog('DUPLICATE', `Product SKU "${sku}" exists. Skipping.`);
          activeProduct = existingProduct;
        } else if (prodPolicy === 'update' || prodPolicy === 'replace') {
          await addLog('DUPLICATE', `Product SKU "${sku}" exists. Overwriting properties.`);
          await existingProduct.update({
            name, sellingPrice: price, gstPercent, category, stock, description, barcode: hsnCode, image
          }, { transaction: t });
          activeProduct = existingProduct;
        } else {
          // Merge
          await addLog('DUPLICATE', `Product SKU "${sku}" exists. Merging.`);
          await existingProduct.update({
            description: existingProduct.description || description,
            barcode: existingProduct.barcode || hsnCode,
            image: existingProduct.image || image
          }, { transaction: t });
          activeProduct = existingProduct;
        }
      } else {
        const newProd = await Product.create({
          name, sku, sellingPrice: price, price, gstPercent, category, stock, description,
          barcode: hsnCode, image, productType: 'trading'
        }, { transaction: t });
        activeProduct = newProd;
        snapshot.products.push(newProd.id);
        countReport.products++;
      }

      productSKUMap[sku.toLowerCase()] = activeProduct;
      productSKUMap[name.toLowerCase()] = activeProduct;
    }

    /* ==================================================
       4. INVOICE MIGRATION
       ================================================== */
    const importedInvoices = extractedData.invoices || [];
    const groupedInvoices = {};
    for (const inv of importedInvoices) {
      const fields = extractDocumentFields(inv);
      const invNum = fields.invoiceNumber;
      if (!invNum) continue;

      if (!groupedInvoices[invNum]) {
        groupedInvoices[invNum] = [];
      }
      groupedInvoices[invNum].push(inv);
    }

    const invoiceNumberMap = {}; // Map Invoice Number to Database ID

    for (const [invNum, items] of Object.entries(groupedInvoices)) {
      const header = items[0];
      const fields = extractDocumentFields(header);
      const customerName = fields.customerName;
      
      const customerId = await resolveCustomerId(customerName);
      if (!customerId) {
        await addLog('WARNING', `Invoice ${invNum} skipped. Customer "${customerName}" not found.`);
        continue;
      }

      const date = parseZohoDate(fields.dateStr);
      const dueDate = fields.dueDateStr ? parseZohoDate(fields.dueDateStr) : date;

      const grandTotal = fields.grandTotal;
      const amountPaid = fields.amountPaid;
      const balance = fields.balance;

      let paymentStatus = 'pending';
      if (amountPaid >= grandTotal) paymentStatus = 'paid';
      else if (amountPaid > 0) paymentStatus = 'partial';

      let status = 'Confirmed';
      const rawStatus = header['Status'] || '';
      if (/draft/i.test(rawStatus)) status = 'Draft';
      else if (/cancel/i.test(rawStatus)) status = 'Cancelled';
      else if (/sent|shipped/i.test(rawStatus)) status = 'Shipped';
      else if (/delivered/i.test(rawStatus)) status = 'Delivered';

      // Check duplicates
      let existingInvoice = await Invoice.findOne({ where: { invoiceNumber: invNum, type: 'invoice' }, transaction: t });
      if (existingInvoice) {
        if (generalPolicy === 'skip') {
          await addLog('DUPLICATE', `Invoice "${invNum}" exists. Skipping.`);
          invoiceNumberMap[invNum] = existingInvoice.id;
          continue;
        } else if (generalPolicy === 'update' || generalPolicy === 'replace') {
          await addLog('DUPLICATE', `Invoice "${invNum}" exists. Replacing.`);
          // Cascade remove items
          await InvoiceItem.destroy({ where: { invoiceId: existingInvoice.id }, transaction: t });
          await existingInvoice.destroy({ transaction: t });
        } else {
          // Merge
          await addLog('DUPLICATE', `Invoice "${invNum}" exists. Keeping original.`);
          invoiceNumberMap[invNum] = existingInvoice.id;
          continue;
        }
      }

      // Create Invoice Header
      const newInvoice = await Invoice.create({
        invoiceNumber: invNum,
        date,
        dueDate,
        customerId,
        subtotal: grandTotal,
        discount: 0,
        gstTotal: 0,
        grandTotal,
        amountPaid,
        paymentStatus,
        status,
        salesChannel: 'Retail Shop',
        gstBillingMode: 'exclusive',
        type: 'invoice',
        is_historical_data: isHistorical
      }, { transaction: t });

      snapshot.invoices.push(newInvoice.id);
      invoiceNumberMap[invNum] = newInvoice.id;
      countReport.invoices++;

      // Create Invoice Items
      let calculatedSubtotal = 0;
      let calculatedGst = 0;

      for (const item of items) {
        const prodName = item['Item Name'] || item['Product Name'] || item['Description'] || '';
        if (!prodName) continue;
        const qty = parseZohoNumber(item['Quantity'] || item['Qty'] || item['Usage / Quantity'] || '1') || 1;
        const rate = parseZohoNumber(item['Rate'] || item['Unit Price'] || item['Price'] || item['Item Price'] || '0');
        const gst = parseZohoNumber(item['Tax %'] || item['GST %'] || item['Tax Percentage'] || '0');

        const mappedProduct = await resolveProduct(prodName);
        const productId = mappedProduct ? mappedProduct.id : null;

        const lineTotalCol = parseZohoNumber(item['Item Total'] || item['Line Total'] || '0');
        const lineTotal = lineTotalCol > 0 ? lineTotalCol : Number((qty * rate).toFixed(2));
        calculatedSubtotal += lineTotal;
        calculatedGst += Number((lineTotal * (gst / 100)).toFixed(2));

        await InvoiceItem.create({
          invoiceId: newInvoice.id,
          productId,
          name: prodName,
          qty,
          unitPrice: rate,
          gstPercent: gst,
          lineTotal
        }, { transaction: t });
      }

      // Re-update totals dynamically
      if (calculatedSubtotal > 0) {
        await newInvoice.update({
          subtotal: calculatedSubtotal,
          gstTotal: calculatedGst,
          grandTotal: Number((calculatedSubtotal + calculatedGst).toFixed(2))
        }, { transaction: t });
      } else {
        await newInvoice.update({
          subtotal: grandTotal,
          grandTotal: grandTotal
        }, { transaction: t });
      }
    }

    /* ==================================================
       5. QUOTATIONS MIGRATION
       ================================================== */
    const importedQuotes = extractedData.quotations || [];
    const groupedQuotes = {};
    for (const q of importedQuotes) {
      const fields = extractDocumentFields(q);
      const qNum = fields.invoiceNumber;
      if (!qNum) continue;
      if (!groupedQuotes[qNum]) groupedQuotes[qNum] = [];
      groupedQuotes[qNum].push(q);
    }

    for (const [qNum, items] of Object.entries(groupedQuotes)) {
      const header = items[0];
      const fields = extractDocumentFields(header);
      const customerName = fields.customerName;
      const customerId = await resolveCustomerId(customerName);
      if (!customerId) {
        await addLog('WARNING', `Quote ${qNum} skipped. Customer "${customerName}" not found.`);
        continue;
      }

      const date = parseZohoDate(fields.dateStr);
      const dueDate = fields.dueDateStr ? parseZohoDate(fields.dueDateStr) : date;
      const grandTotal = fields.grandTotal;

      // Check duplicate
      let existingQuote = await Invoice.findOne({ where: { invoiceNumber: qNum, type: 'quote' }, transaction: t });
      if (existingQuote) {
        if (generalPolicy === 'skip') {
          await addLog('DUPLICATE', `Quote "${qNum}" exists. Skipping.`);
          continue;
        } else if (generalPolicy === 'update' || generalPolicy === 'replace') {
          await addLog('DUPLICATE', `Quote "${qNum}" exists. Overwriting.`);
          await InvoiceItem.destroy({ where: { invoiceId: existingQuote.id }, transaction: t });
          await existingQuote.destroy({ transaction: t });
        } else {
          await addLog('DUPLICATE', `Quote "${qNum}" exists. Skipping.`);
          continue;
        }
      }

      const newQuote = await Invoice.create({
        invoiceNumber: qNum,
        date,
        dueDate,
        customerId,
        subtotal: grandTotal,
        discount: 0,
        gstTotal: 0,
        grandTotal,
        amountPaid: 0,
        paymentStatus: 'pending',
        status: 'Confirmed',
        salesChannel: 'Retail Shop',
        gstBillingMode: 'exclusive',
        type: 'quote',
        is_historical_data: isHistorical
      }, { transaction: t });

      snapshot.invoices.push(newQuote.id);
      countReport.quotations++;

      let calculatedSubtotal = 0;
      let calculatedGst = 0;

      for (const item of items) {
        const prodName = item['Item Name'] || item['Product Name'] || item['Description'] || '';
        if (!prodName) continue;
        const qty = parseZohoNumber(item['Quantity'] || item['Qty'] || item['Usage / Quantity'] || '1') || 1;
        const rate = parseZohoNumber(item['Rate'] || item['Unit Price'] || item['Price'] || item['Item Price'] || '0');
        const gst = parseZohoNumber(item['Tax %'] || item['GST %'] || item['Tax Percentage'] || '0');

        const mappedProduct = await resolveProduct(prodName);
        const productId = mappedProduct ? mappedProduct.id : null;

        const lineTotalCol = parseZohoNumber(item['Item Total'] || item['Line Total'] || '0');
        const lineTotal = lineTotalCol > 0 ? lineTotalCol : Number((qty * rate).toFixed(2));
        calculatedSubtotal += lineTotal;
        calculatedGst += Number((lineTotal * (gst / 100)).toFixed(2));

        await InvoiceItem.create({
          invoiceId: newQuote.id,
          productId,
          name: prodName,
          qty,
          unitPrice: rate,
          gstPercent: gst,
          lineTotal
        }, { transaction: t });
      }

      if (calculatedSubtotal > 0) {
        await newQuote.update({
          subtotal: calculatedSubtotal,
          gstTotal: calculatedGst,
          grandTotal: Number((calculatedSubtotal + calculatedGst).toFixed(2))
        }, { transaction: t });
      } else {
        await newQuote.update({
          subtotal: grandTotal,
          grandTotal: grandTotal
        }, { transaction: t });
      }
    }

    /* ==================================================
       6. SALES RECEIPTS MIGRATION
       ================================================== */
    const importedReceipts = extractedData.sales_receipts || [];
    const groupedReceipts = {};
    for (const r of importedReceipts) {
      const fields = extractDocumentFields(r);
      const rNum = fields.invoiceNumber;
      if (!rNum) continue;
      if (!groupedReceipts[rNum]) groupedReceipts[rNum] = [];
      groupedReceipts[rNum].push(r);
    }

    for (const [rNum, items] of Object.entries(groupedReceipts)) {
      const header = items[0];
      const fields = extractDocumentFields(header);
      const customerName = fields.customerName;
      const customerId = await resolveCustomerId(customerName);
      if (!customerId) {
        await addLog('WARNING', `Sales Receipt ${rNum} skipped. Customer "${customerName}" not found.`);
        continue;
      }

      const date = parseZohoDate(fields.dateStr);
      const grandTotal = fields.grandTotal;

      // Check duplicate
      let existingReceipt = await Invoice.findOne({ where: { invoiceNumber: rNum, type: 'sales_receipt' }, transaction: t });
      if (existingReceipt) {
        if (generalPolicy === 'skip') {
          await addLog('DUPLICATE', `Sales Receipt "${rNum}" exists. Skipping.`);
          continue;
        } else if (generalPolicy === 'update' || generalPolicy === 'replace') {
          await addLog('DUPLICATE', `Sales Receipt "${rNum}" exists. Overwriting.`);
          await InvoiceItem.destroy({ where: { invoiceId: existingReceipt.id }, transaction: t });
          await existingReceipt.destroy({ transaction: t });
        } else {
          await addLog('DUPLICATE', `Sales Receipt "${rNum}" exists. Skipping.`);
          continue;
        }
      }

      const newReceipt = await Invoice.create({
        invoiceNumber: rNum,
        date,
        dueDate: date,
        customerId,
        subtotal: grandTotal,
        discount: 0,
        gstTotal: 0,
        grandTotal,
        amountPaid: grandTotal,
        paymentStatus: 'paid',
        status: 'Confirmed',
        salesChannel: 'Retail Shop',
        gstBillingMode: 'exclusive',
        type: 'sales_receipt',
        is_historical_data: isHistorical
      }, { transaction: t });

      snapshot.invoices.push(newReceipt.id);
      countReport.sales_receipts++;

      let calculatedSubtotal = 0;
      let calculatedGst = 0;

      for (const item of items) {
        const prodName = item['Item Name'] || item['Product Name'] || item['Description'] || '';
        if (!prodName) continue;
        const qty = parseZohoNumber(item['Quantity'] || item['Qty'] || item['Usage / Quantity'] || '1') || 1;
        const rate = parseZohoNumber(item['Rate'] || item['Unit Price'] || item['Price'] || item['Item Price'] || '0');
        const gst = parseZohoNumber(item['Tax %'] || item['GST %'] || item['Tax Percentage'] || '0');

        const mappedProduct = await resolveProduct(prodName);
        const productId = mappedProduct ? mappedProduct.id : null;

        const lineTotalCol = parseZohoNumber(item['Item Total'] || item['Line Total'] || '0');
        const lineTotal = lineTotalCol > 0 ? lineTotalCol : Number((qty * rate).toFixed(2));
        calculatedSubtotal += lineTotal;
        calculatedGst += Number((lineTotal * (gst / 100)).toFixed(2));

        await InvoiceItem.create({
          invoiceId: newReceipt.id,
          productId,
          name: prodName,
          qty,
          unitPrice: rate,
          gstPercent: gst,
          lineTotal
        }, { transaction: t });
      }

      if (calculatedSubtotal > 0) {
        await newReceipt.update({
          subtotal: calculatedSubtotal,
          gstTotal: calculatedGst,
          grandTotal: Number((calculatedSubtotal + calculatedGst).toFixed(2))
        }, { transaction: t });
      } else {
        await newReceipt.update({
          subtotal: grandTotal,
          grandTotal: grandTotal
        }, { transaction: t });
      }
    }

    /* ==================================================
       7. RECURRING INVOICES MIGRATION
       ================================================== */
    const importedRecInvoices = extractedData.recurring_invoices || [];
    const groupedRecInvoices = {};
    for (const ri of importedRecInvoices) {
      const fields = extractDocumentFields(ri);
      const riNum = fields.invoiceNumber;
      if (!riNum) continue;
      if (!groupedRecInvoices[riNum]) groupedRecInvoices[riNum] = [];
      groupedRecInvoices[riNum].push(ri);
    }

    for (const [riNum, items] of Object.entries(groupedRecInvoices)) {
      const header = items[0];
      const fields = extractDocumentFields(header);
      const customerName = fields.customerName;
      const customerId = await resolveCustomerId(customerName);
      if (!customerId) {
        await addLog('WARNING', `Recurring Invoice ${riNum} skipped. Customer "${customerName}" not found.`);
        continue;
      }

      const date = parseZohoDate(fields.dateStr);
      const grandTotal = fields.grandTotal;

      // Check duplicate
      let existingRecInvoice = await Invoice.findOne({ where: { invoiceNumber: riNum, type: 'recurring_invoice' }, transaction: t });
      if (existingRecInvoice) {
        if (generalPolicy === 'skip') {
          await addLog('DUPLICATE', `Recurring Invoice "${riNum}" exists. Skipping.`);
          continue;
        } else if (generalPolicy === 'update' || generalPolicy === 'replace') {
          await addLog('DUPLICATE', `Recurring Invoice "${riNum}" exists. Overwriting.`);
          await InvoiceItem.destroy({ where: { invoiceId: existingRecInvoice.id }, transaction: t });
          await existingRecInvoice.destroy({ transaction: t });
        } else {
          await addLog('DUPLICATE', `Recurring Invoice "${riNum}" exists. Skipping.`);
          continue;
        }
      }

      const newRecInvoice = await Invoice.create({
        invoiceNumber: riNum,
        date,
        dueDate: date,
        customerId,
        subtotal: grandTotal,
        discount: 0,
        gstTotal: 0,
        grandTotal,
        amountPaid: 0,
        paymentStatus: 'pending',
        status: 'Confirmed',
        salesChannel: 'Retail Shop',
        gstBillingMode: 'exclusive',
        type: 'recurring_invoice',
        is_historical_data: isHistorical
      }, { transaction: t });

      snapshot.invoices.push(newRecInvoice.id);
      countReport.recurring_invoices++;

      let calculatedSubtotal = 0;
      let calculatedGst = 0;

      for (const item of items) {
        const prodName = item['Item Name'] || item['Product Name'] || item['Description'] || '';
        if (!prodName) continue;
        const qty = parseZohoNumber(item['Quantity'] || item['Qty'] || item['Usage / Quantity'] || '1') || 1;
        const rate = parseZohoNumber(item['Rate'] || item['Unit Price'] || item['Price'] || item['Item Price'] || '0');
        const gst = parseZohoNumber(item['Tax %'] || item['GST %'] || item['Tax Percentage'] || '0');

        const mappedProduct = await resolveProduct(prodName);
        const productId = mappedProduct ? mappedProduct.id : null;

        const lineTotalCol = parseZohoNumber(item['Item Total'] || item['Line Total'] || '0');
        const lineTotal = lineTotalCol > 0 ? lineTotalCol : Number((qty * rate).toFixed(2));
        calculatedSubtotal += lineTotal;
        calculatedGst += Number((lineTotal * (gst / 100)).toFixed(2));

        await InvoiceItem.create({
          invoiceId: newRecInvoice.id,
          productId,
          name: prodName,
          qty,
          unitPrice: rate,
          gstPercent: gst,
          lineTotal
        }, { transaction: t });
      }

      if (calculatedSubtotal > 0) {
        await newRecInvoice.update({
          subtotal: calculatedSubtotal,
          gstTotal: calculatedGst,
          grandTotal: Number((calculatedSubtotal + calculatedGst).toFixed(2))
        }, { transaction: t });
      } else {
        await newRecInvoice.update({
          subtotal: grandTotal,
          grandTotal: grandTotal
        }, { transaction: t });
      }
    }

    /* ==================================================
       8. EXPENSES MIGRATION
       ================================================== */
    const importedExpenses = extractedData.expenses || [];
    for (const exp of importedExpenses) {
      const expNum = exp['Expense Number'] || exp['Expense ID'] || exp['Reference Number'] || `EXP-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const dateStr = exp['Date'] || exp['Expense Date'];
      const date = parseZohoDate(dateStr);
      const amount = parseZohoNumber(exp['Amount'] || exp['Expense Amount'] || '0');
      const desc = exp['Description'] || exp['Note'] || '';

      // Check duplicate
      let existingExpense = await Invoice.findOne({ where: { invoiceNumber: expNum, type: 'expense' }, transaction: t });
      if (existingExpense) {
        if (generalPolicy === 'skip') {
          await addLog('DUPLICATE', `Expense "${expNum}" exists. Skipping.`);
          continue;
        } else if (generalPolicy === 'update' || generalPolicy === 'replace') {
          await addLog('DUPLICATE', `Expense "${expNum}" exists. Overwriting.`);
          await existingExpense.destroy({ transaction: t });
        } else {
          await addLog('DUPLICATE', `Expense "${expNum}" exists. Skipping.`);
          continue;
        }
      }

      const newExpense = await Invoice.create({
        invoiceNumber: expNum,
        date,
        dueDate: date,
        customerId: null,
        subtotal: amount,
        discount: 0,
        gstTotal: 0,
        grandTotal: amount,
        amountPaid: amount,
        paymentStatus: 'paid',
        status: 'Confirmed',
        salesChannel: 'Retail Shop',
        gstBillingMode: 'exclusive',
        type: 'expense',
        commitment: desc,
        is_historical_data: isHistorical
      }, { transaction: t });

      snapshot.invoices.push(newExpense.id);
      countReport.expenses++;
    }

    /* ==================================================
       9. REFUNDS MIGRATION
       ================================================== */
    const importedRefunds = extractedData.refunds || [];
    for (const ref of importedRefunds) {
      const refNum = ref['Refund Number'] || ref['Refund ID'] || ref['Refund #'] || `REF-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const dateStr = ref['Refund Date'] || ref['Date'] || ref['Refund Time'];
      const date = parseZohoDate(dateStr);
      const amount = parseZohoNumber(ref['Amount'] || ref['Refund Amount'] || '0');
      const customerName = ref['Customer Name'] || ref['Customer'] || '';
      const customerId = await resolveCustomerId(customerName);
      if (!customerId) {
        await addLog('WARNING', `Refund ${refNum} skipped. Customer "${customerName}" not found.`);
        continue;
      }

      // Check duplicate
      let existingRefund = await Invoice.findOne({ where: { invoiceNumber: refNum, type: 'refund' }, transaction: t });
      if (existingRefund) {
        if (generalPolicy === 'skip') {
          await addLog('DUPLICATE', `Refund "${refNum}" exists. Skipping.`);
          continue;
        } else if (generalPolicy === 'update' || generalPolicy === 'replace') {
          await addLog('DUPLICATE', `Refund "${refNum}" exists. Overwriting.`);
          await existingRefund.destroy({ transaction: t });
        } else {
          await addLog('DUPLICATE', `Refund "${refNum}" exists. Skipping.`);
          continue;
        }
      }

      const newRefund = await Invoice.create({
        invoiceNumber: refNum,
        date,
        dueDate: date,
        customerId,
        subtotal: amount,
        discount: 0,
        gstTotal: 0,
        grandTotal: amount,
        amountPaid: amount,
        paymentStatus: 'paid',
        status: 'Confirmed',
        salesChannel: 'Retail Shop',
        gstBillingMode: 'exclusive',
        type: 'refund',
        is_historical_data: isHistorical
      }, { transaction: t });

      snapshot.invoices.push(newRefund.id);
      countReport.refunds++;
    }

    /* ==================================================
       10. PAYMENT MIGRATION
       ================================================== */
    const importedPayments = extractedData.payments || [];

    for (const pay of importedPayments) {
      const payNum = pay['Payment Number'] || pay['Payment No'] || pay['Payment #'] || `PAY-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const dateStr = pay['Payment Date'] || pay['Date'] || pay['Receipt Date'];
      const date = parseZohoDate(dateStr);
      const method = (pay['Payment Mode'] || pay['Mode'] || 'upi').toLowerCase();
      const reference = pay['Reference Number'] || pay['Reference'] || pay['Ref #'] || '';
      const amount = parseZohoNumber(pay['Amount'] || pay['Amount Received'] || pay['Payment Amount'] || '0');

      const customerName = pay['Customer Name'] || pay['Customer'] || '';
      const customerId = await resolveCustomerId(customerName);

      if (!customerId) {
        await addLog('WARNING', `Payment ${payNum} skipped. Customer "${customerName}" not found.`);
        continue;
      }

      const invoiceNum = pay['Invoice Number'] || pay['Invoice No'] || pay['Invoice #'] || '';
      const invoiceId = invoiceNumberMap[invoiceNum] || null;

      // Check Duplicate
      let existingPayment = await Payment.findOne({ where: { paymentNumber: payNum }, transaction: t });
      if (existingPayment) {
        if (generalPolicy === 'skip') {
          await addLog('DUPLICATE', `Payment "${payNum}" exists. Skipping.`);
          continue;
        } else if (generalPolicy === 'update' || generalPolicy === 'replace') {
          await addLog('DUPLICATE', `Payment "${payNum}" exists. Replacing.`);
          await existingPayment.destroy({ transaction: t });
        } else {
          await addLog('DUPLICATE', `Payment "${payNum}" exists. Skipping.`);
          continue;
        }
      }

      // Build invoice allocations JSON
      let allocations = null;
      if (invoiceNum && invoiceId) {
        allocations = [{
          invoiceId,
          invoiceNumber: invoiceNum,
          amount
        }];
      }

      const newPayment = await Payment.create({
        paymentNumber: payNum,
        date,
        customerId,
        amount,
        paymentMethod: method,
        referenceNumber: reference,
        allocations,
        status: 'Success'
      }, { transaction: t });

      snapshot.payments.push(newPayment.id);
      countReport.payments++;
    }

    /* ==================================================
       11. CREDIT NOTES MIGRATION
       ================================================== */
    const importedCreditNotes = extractedData.credit_notes || [];
    const groupedCreditNotes = {};
    for (const cn of importedCreditNotes) {
      const fields = extractDocumentFields(cn);
      const cnNum = fields.invoiceNumber;
      if (!cnNum) continue;
      if (!groupedCreditNotes[cnNum]) groupedCreditNotes[cnNum] = [];
      groupedCreditNotes[cnNum].push(cn);
    }

    const creditNoteNumberMap = {}; // Maps Credit Note Number to DB ID

    for (const [cnNum, items] of Object.entries(groupedCreditNotes)) {
      const header = items[0];
      const fields = extractDocumentFields(header);
      const customerName = fields.customerName;
      const customerId = await resolveCustomerId(customerName);
      if (!customerId) {
        await addLog('WARNING', `Credit Note ${cnNum} skipped. Customer "${customerName}" not found.`);
        continue;
      }

      const date = parseZohoDate(fields.dateStr);
      const grandTotal = fields.grandTotal;

      // Check duplicate
      let existingCN = await Invoice.findOne({ where: { invoiceNumber: cnNum, type: 'credit_note' }, transaction: t });
      if (existingCN) {
        if (generalPolicy === 'skip') {
          await addLog('DUPLICATE', `Credit Note "${cnNum}" exists. Skipping.`);
          creditNoteNumberMap[cnNum] = existingCN.id;
          continue;
        } else if (generalPolicy === 'update' || generalPolicy === 'replace') {
          await addLog('DUPLICATE', `Credit Note "${cnNum}" exists. Overwriting.`);
          await InvoiceItem.destroy({ where: { invoiceId: existingCN.id }, transaction: t });
          await existingCN.destroy({ transaction: t });
        } else {
          await addLog('DUPLICATE', `Credit Note "${cnNum}" exists. Skipping.`);
          creditNoteNumberMap[cnNum] = existingCN.id;
          continue;
        }
      }

      const newCN = await Invoice.create({
        invoiceNumber: cnNum,
        date,
        dueDate: date,
        customerId,
        subtotal: grandTotal,
        discount: 0,
        gstTotal: 0,
        grandTotal,
        amountPaid: 0,
        paymentStatus: 'pending',
        status: 'Confirmed',
        salesChannel: 'Retail Shop',
        gstBillingMode: 'exclusive',
        type: 'credit_note',
        is_historical_data: isHistorical
      }, { transaction: t });

      snapshot.invoices.push(newCN.id);
      creditNoteNumberMap[cnNum] = newCN.id;
      countReport.credit_notes++;

      let calculatedSubtotal = 0;
      let calculatedGst = 0;

      for (const item of items) {
        const prodName = item['Item Name'] || item['Product Name'] || item['Description'] || '';
        if (!prodName) continue;
        const qty = parseZohoNumber(item['Quantity'] || item['Qty'] || item['Usage / Quantity'] || '1') || 1;
        const rate = parseZohoNumber(item['Rate'] || item['Unit Price'] || item['Price'] || item['Item Price'] || '0');
        const gst = parseZohoNumber(item['Tax %'] || item['GST %'] || item['Tax Percentage'] || '0');

        const mappedProduct = await resolveProduct(prodName);
        const productId = mappedProduct ? mappedProduct.id : null;

        const lineTotalCol = parseZohoNumber(item['Item Total'] || item['Line Total'] || '0');
        const lineTotal = lineTotalCol > 0 ? lineTotalCol : Number((qty * rate).toFixed(2));
        calculatedSubtotal += lineTotal;
        calculatedGst += Number((lineTotal * (gst / 100)).toFixed(2));

        await InvoiceItem.create({
          invoiceId: newCN.id,
          productId,
          name: prodName,
          qty,
          unitPrice: rate,
          gstPercent: gst,
          lineTotal
        }, { transaction: t });
      }

      if (calculatedSubtotal > 0) {
        await newCN.update({
          subtotal: calculatedSubtotal,
          gstTotal: calculatedGst,
          grandTotal: Number((calculatedSubtotal + calculatedGst).toFixed(2))
        }, { transaction: t });
      } else {
        await newCN.update({
          subtotal: grandTotal,
          grandTotal: grandTotal
        }, { transaction: t });
      }
    }

    /* ==================================================
       12. CREDIT NOTE LINKS MIGRATION
       ================================================== */
    const importedCreditNoteLinks = extractedData.credit_note_links || [];
    for (const link of importedCreditNoteLinks) {
      const cnNum = link['Credit Note Number'] || link['Credit Note #'] || link['Creditnote Number'] || '';
      const invNum = link['Invoice Number'] || link['Invoice #'] || link['Invoice ID'] || '';
      const creditedAmount = parseZohoNumber(link['Credited Amount'] || link['Amount'] || link['Credit Amount'] || '0');

      if (!cnNum || !invNum || creditedAmount <= 0) continue;

      const dbInvoice = await Invoice.findOne({ where: { invoiceNumber: invNum, type: 'invoice' }, transaction: t });
      const dbCreditNote = await Invoice.findOne({ where: { invoiceNumber: cnNum, type: 'credit_note' }, transaction: t });

      if (dbInvoice && dbCreditNote) {
        const newInvPaid = Number((parseFloat(dbInvoice.amountPaid || 0) + creditedAmount).toFixed(2));
        let newInvStatus = 'pending';
        if (newInvPaid >= parseFloat(dbInvoice.grandTotal)) newInvStatus = 'paid';
        else if (newInvPaid > 0) newInvStatus = 'partial';

        await dbInvoice.update({
          amountPaid: newInvPaid,
          paymentStatus: newInvStatus
        }, { transaction: t });

        const newCNPaid = Number((parseFloat(dbCreditNote.amountPaid || 0) + creditedAmount).toFixed(2));
        let newCNStatus = 'pending';
        if (newCNPaid >= parseFloat(dbCreditNote.grandTotal)) newCNStatus = 'paid';
        else if (newCNPaid > 0) newCNStatus = 'partial';

        await dbCreditNote.update({
          amountPaid: newCNPaid,
          paymentStatus: newCNStatus
        }, { transaction: t });

        await addLog('INFO', `Linked Credit Note "${cnNum}" to Invoice "${invNum}". Credited ₹${creditedAmount}.`);
        countReport.credit_note_links++;
      } else {
        await addLog('WARNING', `Could not link Credit Note "${cnNum}" to Invoice "${invNum}". Check if both documents exist.`);
      }
    }

    /* ==================================================
       13. ACTIVITY LOGS MIGRATION
       ================================================== */
    const importedLogs = extractedData.activity_logs || [];
    for (const log of importedLogs) {
      const details = log['Activity Description'] || log['Description'] || log['Activity'] || '';
      if (!details) continue;

      const dateStr = log['Log Time'] || log['Activity Time'] || log['Date'] || log['Time'] || '';
      const createdAt = parseZohoDate(dateStr);
      const operator = log['User'] || log['Operator'] || 'Zoho System';

      await ActivityLog.create({
        action: 'Imported Zoho Event',
        module: 'Zoho Books Migration',
        details,
        metadata: { operator, source: 'Zoho Export' },
        createdAt
      }, { transaction: t });

      countReport.activity_logs++;
    }

    /* ==================================================
       14. OUTSTANDING & LEDGER RECONSTRUCTION
       ================================================== */
    await addLog('INFO', 'Starting Outstanding Rebuild & Ledger reconciliation...');

    // Fetch all active customers inside our transaction context
    const allCustomers = await Customer.findAll({ transaction: t });
    for (const cust of allCustomers) {
      // Fetch customer invoices (only type invoice!)
      const customerInvoices = await Invoice.findAll({
        where: { 
          customerId: cust.id, 
          status: { [sequelize.Sequelize.Op.ne]: 'Cancelled' },
          type: 'invoice'
        },
        transaction: t
      });

      // Fetch customer credit notes
      const customerCreditNotes = await Invoice.findAll({
        where: {
          customerId: cust.id,
          status: { [sequelize.Sequelize.Op.ne]: 'Cancelled' },
          type: 'credit_note'
        },
        transaction: t
      });

      // Fetch customer refunds
      const customerRefunds = await Invoice.findAll({
        where: {
          customerId: cust.id,
          status: { [sequelize.Sequelize.Op.ne]: 'Cancelled' },
          type: 'refund'
        },
        transaction: t
      });

      // Fetch customer payments
      const customerPayments = await Payment.findAll({
        where: { customerId: cust.id, status: 'Success' },
        transaction: t
      });

      let totalInvoiced = 0;
      let outstandingBillsCount = 0;
      for (const inv of customerInvoices) {
        totalInvoiced += parseFloat(inv.grandTotal || 0);
        
        // Loop and sum allocations per invoice to verify exact invoice payments allocation
        let amountPaid = 0;
        customerPayments.forEach(p => {
          if (p.allocations) {
            p.allocations.forEach(alloc => {
              if (String(alloc.invoiceId) === String(inv.id)) {
                amountPaid += parseFloat(alloc.amount || 0);
              }
            });
          }
        });

        // Also check if any credit notes linked to this invoice are present (via linked linked link amountPaid)
        const outstanding = Number((inv.grandTotal - inv.amountPaid).toFixed(2));
        
        let paymentStatus = 'pending';
        if (outstanding <= 0) paymentStatus = 'paid';
        else if (inv.amountPaid > 0) paymentStatus = 'partial';

        if (paymentStatus !== 'paid') {
          outstandingBillsCount++;
        }

        await inv.update({
          amountPaid: inv.amountPaid,
          paymentStatus
        }, { transaction: t });
      }

      let totalPaid = 0;
      customerPayments.forEach(p => {
        totalPaid += parseFloat(p.amount || 0);
      });

      let totalCreditNotes = 0;
      customerCreditNotes.forEach(cn => {
        totalCreditNotes += parseFloat(cn.grandTotal || 0);
      });

      let totalRefunds = 0;
      customerRefunds.forEach(rf => {
        totalRefunds += parseFloat(rf.grandTotal || 0);
      });

      // Customer outstanding balance recompute exactly: Invoices - Payments - Credit Notes + Refunds
      const balance = Number((totalInvoiced - totalPaid - totalCreditNotes + totalRefunds).toFixed(2));

      await cust.update({
        balance: Math.max(0, balance),
        invoiceOutstandingCount: outstandingBillsCount
      }, { transaction: t });
    }

    // Sum overall snapshot totals for execution verification screen
    let importedInvoicesValue = 0;
    let importedPaymentsValue = 0;

    const invoicesInSnapshot = await Invoice.findAll({
      where: { id: snapshot.invoices, type: 'invoice' },
      transaction: t
    });
    invoicesInSnapshot.forEach(inv => {
      importedInvoicesValue += parseFloat(inv.grandTotal || 0);
    });

    const paymentsInSnapshot = await Payment.findAll({
      where: { id: snapshot.payments },
      transaction: t
    });
    paymentsInSnapshot.forEach(p => {
      importedPaymentsValue += parseFloat(p.amount || 0);
    });

    const reportTotals = {
      invoiceValue: Number(importedInvoicesValue.toFixed(2)),
      paymentValue: Number(importedPaymentsValue.toFixed(2)),
      outstanding: Number((importedInvoicesValue - importedPaymentsValue).toFixed(2))
    };

    // Save final reports count
    await migrationHistoryRecord.update({
      recordCount: countReport,
      status: 'Completed',
      snapshotData: snapshot
    }, { transaction: t });

    await addLog('INFO', `Migration completed. Invoices Value: ₹${reportTotals.invoiceValue}, Payments Value: ₹${reportTotals.paymentValue}.`);

    // Write all detailed diagnostic logs
    await MigrationDetailLog.bulkCreate(logMessages, { transaction: t });

    // Commit Transaction!
    await t.commit();

    // Clean up temporary cache session file
    try {
      fs.unlinkSync(tempPath);
    } catch {}

    if (jobState) {
      jobState.status = 'Completed';
      jobState.progress = 100;
      jobState.currentStage = 'Migration completed (100%)';
      jobState.report = countReport;
      jobState.totals = reportTotals;
      jobState.endTime = Date.now();
      jobState.durationMs = jobState.endTime - jobState.startTime;
    }

  } catch (err) {
    // Rollback transaction on failure!
    try {
      await t.rollback();
    } catch (rollbackErr) {
      console.error('Transaction rollback failed:', rollbackErr);
    }
    console.error('Migration execution failed:', err);

    const stage = err.stage || 'Data Ingestion';
    const fixSuggestion = err.fixSuggestion || 'Check input data for missing required fields, duplicate keys, or invalid formats and try again.';
    const exactSqlError = err.original ? err.original.message : (err.errors ? err.errors.map(e => e.message).join(', ') : err.message);

    if (migrationHistoryRecord) {
      try {
        await migrationHistoryRecord.update({ status: 'Failed' });
        await MigrationDetailLog.create({
          migrationId: migrationHistoryRecord.id,
          level: 'ERROR',
          message: `[${stage}] Fatal migration error: ${exactSqlError}`
        });
      } catch (logErr) {
        console.error('Failed to write failure log to database:', logErr);
      }
    }

    if (jobState) {
      jobState.status = 'Failed';
      jobState.error = exactSqlError;
      jobState.currentStage = stage;
      jobState.details = err.stack || err.message;
      jobState.fixSuggestion = fixSuggestion;
      jobState.endTime = Date.now();
      jobState.durationMs = jobState.endTime - jobState.startTime;
    }
  }
};

// Rollback migration
exports.rollbackMigration = async (req, res) => {
  const { id } = req.params;
  const t = await sequelize.transaction();

  try {
    const history = await MigrationHistory.findByPk(id, { transaction: t });
    if (!history) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Migration record not found' });
    }

    if (history.status === 'Rolled Back') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Migration has already been rolled back' });
    }

    const { snapshotData } = history;
    if (snapshotData) {
      // 1. Delete imported payments
      if (snapshotData.payments && snapshotData.payments.length > 0) {
        await Payment.destroy({ where: { id: snapshotData.payments }, transaction: t });
      }

      // 2. Delete imported invoices and items
      if (snapshotData.invoices && snapshotData.invoices.length > 0) {
        await InvoiceItem.destroy({ where: { invoiceId: snapshotData.invoices }, transaction: t });
        await Invoice.destroy({ where: { id: snapshotData.invoices }, transaction: t });
      }

      // 3. Delete imported products
      if (snapshotData.products && snapshotData.products.length > 0) {
        await Product.destroy({ where: { id: snapshotData.products }, transaction: t });
      }

      // 4. Delete imported customers
      if (snapshotData.customers && snapshotData.customers.length > 0) {
        await Customer.destroy({ where: { id: snapshotData.customers }, transaction: t });
      }
    }

    // 5. Recalculate balances for all remaining customers
    const remainingCustomers = await Customer.findAll({ transaction: t });
    for (const cust of remainingCustomers) {
      const customerInvoices = await Invoice.findAll({
        where: { 
          customerId: cust.id, 
          status: { [sequelize.Sequelize.Op.ne]: 'Cancelled' },
          type: 'invoice'
        },
        transaction: t
      });

      const customerPayments = await Payment.findAll({
        where: { customerId: cust.id, status: 'Success' },
        transaction: t
      });

      let totalCustomerOutstanding = 0;
      let outstandingBillsCount = 0;

      for (const inv of customerInvoices) {
        let amountPaid = 0;
        customerPayments.forEach(p => {
          if (p.allocations) {
            p.allocations.forEach(alloc => {
              if (String(alloc.invoiceId) === String(inv.id)) {
                amountPaid += parseFloat(alloc.amount || 0);
              }
            });
          }
        });

        const outstanding = Number((inv.grandTotal - amountPaid).toFixed(2));
        
        let paymentStatus = 'pending';
        if (outstanding <= 0) paymentStatus = 'paid';
        else if (amountPaid > 0) paymentStatus = 'partial';

        if (paymentStatus !== 'paid') {
          outstandingBillsCount++;
          totalCustomerOutstanding += outstanding;
        }

        await inv.update({ amountPaid, paymentStatus }, { transaction: t });
      }

      await cust.update({
        balance: totalCustomerOutstanding,
        invoiceOutstandingCount: outstandingBillsCount
      }, { transaction: t });
    }

    // Update status
    await history.update({ status: 'Rolled Back' }, { transaction: t });

    await MigrationDetailLog.create({
      migrationId: id,
      level: 'INFO',
      message: 'Migration rolled back successfully.'
    }, { transaction: t });

    await t.commit();
    res.json({ success: true, message: 'Migration snapshot rolled back successfully' });
  } catch (err) {
    await t.rollback();
    console.error('Rollback failed:', err);
    res.status(500).json({ success: false, message: 'Failed to rollback migration', error: err.message });
  }
};

// Retrieve migration logs and history list
exports.getMigrationHistory = async (req, res) => {
  try {
    const history = await MigrationHistory.findAll({
      order: [['importDate', 'DESC']]
    });
    res.json({ success: true, history });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getMigrationLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await MigrationDetailLog.findAll({
      where: { migrationId: id },
      order: [['timestamp', 'ASC']]
    });
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.downloadErrorReport = async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await MigrationDetailLog.findAll({
      where: { migrationId: id },
      order: [['timestamp', 'ASC']]
    });

    let csv = 'Timestamp,Level,Message\n';
    logs.forEach(log => {
      const time = log.timestamp ? new Date(log.timestamp).toISOString() : '';
      const level = log.level || 'INFO';
      const msg = `"${String(log.message || '').replace(/"/g, '""')}"`;
      csv += `${time},${level},${msg}\n`;
    });

    const fileName = `Migration_Error_Report_${id}_${Date.now()}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(Buffer.from(csv, 'utf8'));
  } catch (err) {
    console.error('Failed to generate error report CSV:', err);
    res.status(500).json({ success: false, message: 'Failed to generate error report', error: err.message });
  }
};

// Full system database backup export zip
exports.exportBackup = async (req, res) => {
  try {
    const backupData = {};
    for (const modelName of Object.keys(sequelize.models)) {
      try {
        const model = sequelize.models[modelName];
        if (typeof model.findAll === 'function') {
          if (modelName === 'User') {
            try {
              backupData[modelName] = await model.scope('withPassword').findAll({ raw: true });
            } catch {
              backupData[modelName] = await model.findAll({ raw: true });
            }
          } else {
            backupData[modelName] = await model.findAll({ raw: true });
          }
        }
      } catch (modelErr) {
        console.warn(`[exportBackup] Model ${modelName} fetch skipped:`, modelErr.message);
        backupData[modelName] = [];
      }
    }

    const customers = backupData['Customer'] || [];
    const products = backupData['Product'] || [];
    const invoices = backupData['Invoice'] || [];
    const payments = backupData['Payment'] || [];

    const zip = new AdmZip();
    zip.addFile('db_backup.json', Buffer.from(JSON.stringify(backupData, null, 2), 'utf8'));

    // Export formats under CSV files in the zip too
    const createCSVBuffer = (data, fields) => {
      let csv = fields.join(',') + '\n';
      (data || []).forEach(row => {
        if (!row) return;
        const line = fields.map(f => {
          let val = row[f] === null || row[f] === undefined ? '' : row[f];
          if (typeof val === 'object') val = JSON.stringify(val);
          return `"${String(val).replace(/"/g, '""')}"`;
        });
        csv += line.join(',') + '\n';
      });
      return Buffer.from(csv, 'utf8');
    };

    zip.addFile('customers.csv', createCSVBuffer(customers, ['id', 'name', 'businessName', 'email', 'phone', 'gstNumber', 'balance', 'customerType']));
    zip.addFile('products.csv', createCSVBuffer(products, ['id', 'name', 'sku', 'price', 'sellingPrice', 'gstPercent', 'stock', 'category']));
    zip.addFile('invoices.csv', createCSVBuffer(invoices, ['id', 'invoiceNumber', 'date', 'grandTotal', 'amountPaid', 'paymentStatus', 'status']));
    zip.addFile('payments.csv', createCSVBuffer(payments, ['id', 'paymentNumber', 'date', 'amount', 'paymentMethod', 'referenceNumber']));

    const buffer = zip.toBuffer();
    const fileName = `AO_Core_Backup_${Date.now()}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
    res.send(buffer);
  } catch (err) {
    console.error('Backup export failed:', err);
    res.status(500).json({ success: false, message: 'Failed to create backup ZIP archive', error: err.message });
  }
};

// Full system restore from backup ZIP
exports.restoreBackup = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Backup file missing' });
  }

  const zipPath = req.file.path;
  const dialect = sequelize.getDialect();
  const useTransaction = dialect !== 'sqlite';
  const t = useTransaction ? await sequelize.transaction() : null;
  const opt = t ? { transaction: t } : {};

  try {
    const zip = new AdmZip(zipPath);
    const entry = zip.getEntry('db_backup.json');
    if (!entry) {
      if (t) await t.rollback();
      try { fs.unlinkSync(zipPath); } catch {}
      return res.status(400).json({ success: false, message: 'Invalid AO Core backup: missing db_backup.json file' });
    }

    const backup = JSON.parse(entry.getData().toString('utf8'));

    // Disable SQLite/MySQL foreign keys checks prior to truncate
    if (dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = OFF;');
    } else {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;', opt);
    }

    // Dynamic model iteration
    const { Op } = require('sequelize');
    const modelNames = Object.keys(sequelize.models);

    for (const modelName of modelNames) {
      const model = sequelize.models[modelName];

      // Retrieve records from backup using case-insensitive plural fallback
      let records = backup[modelName];
      if (!records) {
        const pluralKey = modelName.toLowerCase() + 's';
        records = backup[pluralKey];
      }
      if (!records && modelName === 'InvoiceItem') {
        records = backup['invoiceItems'];
      }
      if (!records && modelName === 'StockMovement') {
        records = backup['stockMovements'];
      }
      if (!records && modelName === 'RawMaterial') {
        records = backup['rawMaterials'];
      }
      if (!records && modelName === 'ManufacturingEntry') {
        records = backup['manufacturingEntries'];
      }
      if (!records && modelName === 'RepackEntry') {
        records = backup['repackEntries'];
      }

      if (modelName === 'User') {
        // Safeguard: never destroy or replace the current active admin performing the restore
        await model.destroy({
          where: {
            id: { [Op.ne]: req.user.id }
          },
          force: true,
          ...opt
        });

        if (records && records.length > 0) {
          const usersToInsert = records.filter(u => Number(u.id) !== Number(req.user.id));
          if (usersToInsert.length > 0) {
            await model.bulkCreate(usersToInsert, opt);
          }
        }
      } else {
        // Destroy all rows
        await model.destroy({ where: {}, force: true, ...opt });
        if (records && records.length > 0) {
          await model.bulkCreate(records, opt);
        }
      }
    }

    // Enable foreign keys back
    if (dialect === 'sqlite') {
      await sequelize.query('PRAGMA foreign_keys = ON;');
    } else {
      await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;', opt);
    }

    if (t) await t.commit();
    try { fs.unlinkSync(zipPath); } catch {}

    res.json({ success: true, message: 'Database successfully restored from backup ZIP archive snapshot' });
  } catch (err) {
    if (t) await t.rollback();
    console.error('Database restore crashed:', err);
    try { fs.unlinkSync(zipPath); } catch {}
    res.status(500).json({ success: false, message: 'Backup restoration failed', error: err.message });
  }
};
