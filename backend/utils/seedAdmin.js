require('dotenv').config();
const connectDB = require('../config/db');
const User = require('../models/User');
const Settings = require('../models/Settings');
const Supplier = require('../models/Supplier');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const RawMaterial = require('../models/RawMaterial');
const RawMaterialMovement = require('../models/RawMaterialMovement');
const ManufacturingRecipe = require('../models/ManufacturingRecipe');
const ManufacturingRecipeMaterial = require('../models/ManufacturingRecipeMaterial');
const ManufacturingEntry = require('../models/ManufacturingEntry');
const ManufacturingEntryMaterial = require('../models/ManufacturingEntryMaterial');
const Invoice = require('../models/Invoice');
const InvoiceItem = require('../models/InvoiceItem');
const StockMovement = require('../models/StockMovement');
const RepackRecipe = require('../models/RepackRecipe');
const RepackRecipeMaterial = require('../models/RepackRecipeMaterial');
const RepackEntry = require('../models/RepackEntry');
const RepackEntryMaterial = require('../models/RepackEntryMaterial');
const Shipment = require('../models/Shipment');
const ProductPackSize = require('../models/ProductPackSize');
const Courier = require('../models/Courier');

const seed = async () => {
  try {
    // Authenticate and sync schemas
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database synced. Seeding tables...');

    // 1. Seed Default Settings
    const settings = await Settings.findOne();
    if (!settings) {
      await Settings.create({
        companyName: 'AO Core Organic Products',
        logo: '/uploads/default-logo.png',
        address: '123 Wellness Way, Green Valley',
        phone: '+91 9876543210',
        gstDetails: '29AAAAA1111A1Z1',
        invoicePrefix: 'AO',
        financialYear: '2026-27',
        brandColor: '#ff9800',
        defaultDarkMode: false,
        lowStockThreshold: 10,
        invoiceCounter: 5,
        purchaseCounter: 0,
      });
      console.log('✓ Default settings created.');
    }

    // 2. Seed Default Users by Role
    const usersToSeed = [
      { name: 'Super Admin', email: 'admin@aocore.com', password: 'Admin@123', role: 'Super Admin' },
      { name: 'Manufacturing Manager', email: 'mfg@aocore.com', password: 'Mfg@123', role: 'Manufacturing Manager' },
      { name: 'Billing Executive', email: 'billing@aocore.com', password: 'Billing@123', role: 'Billing Executive' },
      { name: 'Store Keeper', email: 'store@aocore.com', password: 'Store@123', role: 'Store Keeper' },
      { name: 'Dispatch Executive', email: 'dispatch@aocore.com', password: 'Dispatch@123', role: 'Dispatch Executive' },
      { name: 'Sales Executive', email: 'sales@aocore.com', password: 'Sales@123', role: 'Sales Executive' },
    ];

    let adminId = 1;
    for (const u of usersToSeed) {
      const existing = await User.scope('withPassword').findOne({ where: { email: u.email } });
      if (!existing) {
        const newUser = await User.create({
          name: u.name,
          email: u.email,
          password: u.password,
          role: u.role,
          isActive: true
        });
        if (u.role === 'Super Admin') {
          adminId = newUser.id;
        }
        console.log(`✓ User created: ${u.email} / ${u.password} (Role: ${u.role})`);
      } else {
        if (u.role === 'Super Admin') {
          adminId = existing.id;
        }
        if (existing.email === 'admin@aocore.com' && existing.role === 'admin') {
          existing.role = 'Super Admin';
          await existing.save();
        }
      }
    }

    // 3. Seed Suppliers
    const suppliers = await Supplier.findAll();
    let supplierRefs = {};
    if (suppliers.length === 0) {
      const s1 = await Supplier.create({
        name: 'Organic Farms Co.',
        phone: '9888812345',
        email: 'farms@organic.com',
        address: 'Karnataka, India',
        type: 'raw_material',
        gstNumber: '29ABCDE1234F1Z1',
        gstRegistrationType: 'Regular',
        state: 'Karnataka',
        stateCode: '29',
        panNumber: 'ABCDE1234F',
        tdsApplicable: false,
      });
      const s2 = await Supplier.create({
        name: 'PackRight Solutions',
        phone: '9777712345',
        email: 'sales@packright.com',
        address: 'Mumbai, India',
        type: 'packaging',
        gstNumber: '27FGHIJ5678K1Z2',
        gstRegistrationType: 'Regular',
        state: 'Maharashtra',
        stateCode: '27',
        panNumber: 'FGHIJ5678K',
        tdsApplicable: false,
      });
      const s3 = await Supplier.create({
        name: 'Labels & Prints Pro',
        phone: '9666612345',
        email: 'orders@labelspro.com',
        address: 'Chennai, India',
        type: 'general',
        gstNumber: '33KLMNO2468P1Z3',
        gstRegistrationType: 'Regular',
        state: 'Tamil Nadu',
        stateCode: '33',
        panNumber: 'KLMNO2468P',
        tdsApplicable: true,
      });
      const s4 = await Supplier.create({
        name: 'Carton Kraft Corp',
        phone: '9555512345',
        email: 'kraft@cartonkraft.com',
        address: 'Delhi, India',
        type: 'general',
        gstNumber: '07ABCDE1357Q1Z4',
        gstRegistrationType: 'Composition',
        state: 'Delhi',
        stateCode: '07',
        panNumber: 'ABCDE1357Q',
        tdsApplicable: false,
      });
      supplierRefs = { raw: s1.id, pack: s2.id, label: s3.id, carton: s4.id };
      console.log('✓ Suppliers seeded.');
    } else {
      supplierRefs = {
        raw: suppliers[0].id,
        pack: suppliers[1]?.id || suppliers[0].id,
        label: suppliers[2]?.id || suppliers[0].id,
        carton: suppliers[3]?.id || suppliers[0].id
      };
    }

    // 4. Seed Raw Materials
    const rawMaterials = await RawMaterial.findAll();
    let rmRefs = {};
    if (rawMaterials.length === 0) {
      const rm1 = await RawMaterial.create({ name: 'Organic Oats Bulk', materialCode: 'RM-OAT-01', category: 'Ingredients', unitType: 'Weight', baseUnit: 'Kg', purchaseUnit: 'Kg', unit: 'Kg', stock: 500.0, minStock: 50.0, purchasePrice: 80.00, gstPercent: 5.0, supplierId: supplierRefs.raw, warehouse: 'Warehouse A' });
      const rm2 = await RawMaterial.create({ name: 'Wild Flower Honey Bulk', materialCode: 'RM-HNY-01', category: 'Ingredients', unitType: 'Weight', baseUnit: 'Kg', purchaseUnit: 'Kg', unit: 'Kg', stock: 200.0, minStock: 20.0, purchasePrice: 150.00, gstPercent: 12.0, supplierId: supplierRefs.raw, warehouse: 'Warehouse A' });
      
      const rm3_200 = await RawMaterial.create({ name: 'Honey Oats 200g Pouch', materialCode: 'RM-PCH-200', category: 'Pouches', unitType: 'Pieces', baseUnit: 'Piece', purchaseUnit: 'Piece', unit: 'Piece', stock: 1000.0, minStock: 100.0, purchasePrice: 1.50, gstPercent: 18.0, supplierId: supplierRefs.pack, warehouse: 'Warehouse B' });
      const rm3_500 = await RawMaterial.create({ name: 'Honey Oats 500g Pouch', materialCode: 'RM-PCH-500', category: 'Pouches', unitType: 'Pieces', baseUnit: 'Piece', purchaseUnit: 'Piece', unit: 'Piece', stock: 1000.0, minStock: 100.0, purchasePrice: 2.50, gstPercent: 18.0, supplierId: supplierRefs.pack, warehouse: 'Warehouse B' });
      const rm3_1000 = await RawMaterial.create({ name: 'Honey Oats 1kg Pouch', materialCode: 'RM-PCH-1000', category: 'Pouches', unitType: 'Pieces', baseUnit: 'Piece', purchaseUnit: 'Piece', unit: 'Piece', stock: 500.0, minStock: 50.0, purchasePrice: 4.00, gstPercent: 18.0, supplierId: supplierRefs.pack, warehouse: 'Warehouse B' });
      
      const rm4_200 = await RawMaterial.create({ name: 'Honey Oats 200g Label', materialCode: 'RM-LBL-200', category: 'Labels', unitType: 'Pieces', baseUnit: 'Piece', purchaseUnit: 'Piece', unit: 'Piece', stock: 1200.0, minStock: 100.0, purchasePrice: 0.80, gstPercent: 18.0, supplierId: supplierRefs.label, warehouse: 'Warehouse B' });
      const rm4_500 = await RawMaterial.create({ name: 'Honey Oats 500g Label', materialCode: 'RM-LBL-500', category: 'Labels', unitType: 'Pieces', baseUnit: 'Piece', purchaseUnit: 'Piece', unit: 'Piece', stock: 1200.0, minStock: 100.0, purchasePrice: 1.20, gstPercent: 18.0, supplierId: supplierRefs.label, warehouse: 'Warehouse B' });
      const rm4_1000 = await RawMaterial.create({ name: 'Honey Oats 1kg Label', materialCode: 'RM-LBL-1000', category: 'Labels', unitType: 'Pieces', baseUnit: 'Piece', purchaseUnit: 'Piece', unit: 'Piece', stock: 600.0, minStock: 50.0, purchasePrice: 1.80, gstPercent: 18.0, supplierId: supplierRefs.label, warehouse: 'Warehouse B' });
      
      const rm5_250 = await RawMaterial.create({ name: 'Organic Honey 250g Jar', materialCode: 'RM-JAR-250', category: 'Bottles', unitType: 'Pieces', baseUnit: 'Piece', purchaseUnit: 'Piece', unit: 'Piece', stock: 500.0, minStock: 50.0, purchasePrice: 8.00, gstPercent: 18.0, supplierId: supplierRefs.pack, warehouse: 'Warehouse B' });
      const rm5_500 = await RawMaterial.create({ name: 'Organic Honey 500g Jar', materialCode: 'RM-JAR-500', category: 'Bottles', unitType: 'Pieces', baseUnit: 'Piece', purchaseUnit: 'Piece', unit: 'Piece', stock: 400.0, minStock: 40.0, purchasePrice: 12.00, gstPercent: 18.0, supplierId: supplierRefs.pack, warehouse: 'Warehouse B' });
      
      const rm6_250 = await RawMaterial.create({ name: 'Organic Honey 250g Label', materialCode: 'RM-LBL-H250', category: 'Labels', unitType: 'Pieces', baseUnit: 'Piece', purchaseUnit: 'Piece', unit: 'Piece', stock: 600.0, minStock: 50.0, purchasePrice: 0.90, gstPercent: 18.0, supplierId: supplierRefs.label, warehouse: 'Warehouse B' });
      const rm6_500 = await RawMaterial.create({ name: 'Organic Honey 500g Label', materialCode: 'RM-LBL-H500', category: 'Labels', unitType: 'Pieces', baseUnit: 'Piece', purchaseUnit: 'Piece', unit: 'Piece', stock: 500.0, minStock: 50.0, purchasePrice: 1.30, gstPercent: 18.0, supplierId: supplierRefs.label, warehouse: 'Warehouse B' });
      
      const rm_box = await RawMaterial.create({ name: 'Standard Shipping Box', materialCode: 'RM-CTN-01', category: 'Cartons', unitType: 'Pieces', baseUnit: 'Piece', purchaseUnit: 'Piece', unit: 'Piece', stock: 400.0, minStock: 40.0, purchasePrice: 12.00, gstPercent: 18.0, supplierId: supplierRefs.carton, warehouse: 'Warehouse B' });
      
      rmRefs = { 
        oats: rm1.id, 
        honey: rm2.id, 
        pouch200: rm3_200.id, 
        pouch500: rm3_500.id, 
        pouch1000: rm3_1000.id, 
        labelOat200: rm4_200.id,
        labelOat500: rm4_500.id,
        labelOat1000: rm4_1000.id,
        jar250: rm5_250.id,
        jar500: rm5_500.id,
        labelH250: rm6_250.id,
        labelH500: rm6_500.id,
        box: rm_box.id 
      };
      
      // Log movements for raw materials
      await RawMaterialMovement.create({ rawMaterialId: rm1.id, type: 'purchase', quantity: 500, price: 80, supplierId: supplierRefs.raw, createdById: adminId, notes: 'Opening stock purchase' });
      await RawMaterialMovement.create({ rawMaterialId: rm2.id, type: 'purchase', quantity: 200, price: 150, supplierId: supplierRefs.raw, createdById: adminId, notes: 'Opening stock purchase' });
      await RawMaterialMovement.create({ rawMaterialId: rm3_500.id, type: 'purchase', quantity: 1000, price: 2.5, supplierId: supplierRefs.pack, createdById: adminId, notes: 'Opening stock purchase' });
      await RawMaterialMovement.create({ rawMaterialId: rm4_500.id, type: 'purchase', quantity: 1200, price: 1.2, supplierId: supplierRefs.label, createdById: adminId, notes: 'Opening stock purchase' });
      
      console.log('✓ Raw materials and opening logs seeded.');
    } else {
      const allRms = await RawMaterial.findAll();
      rmRefs = {
        oats: allRms[0].id,
        honey: allRms[1]?.id || allRms[0].id,
        pouch500: allRms.find(r => r.materialCode === 'RM-PCH-500')?.id || allRms[0].id,
        labelOat500: allRms.find(r => r.materialCode === 'RM-LBL-500')?.id || allRms[0].id,
        box: allRms.find(r => r.materialCode === 'RM-CTN-01')?.id || allRms[0].id
      };
    }

    // 5. Seed Finished Products
    const products = await Product.findAll();
    let prodRefs = {};
    if (products.length === 0) {
      const p1 = await Product.create({ name: 'Honey Oats', sku: 'HO-MALT', barcode: '8901234567890', category: 'Food', stock: 150.0, lowStockThreshold: 15.0, unit: 'Kg', purchasePrice: 120.00, sellingPrice: 240.00, gstPercent: 5.0, supplier: 'repack' });
      const p2 = await Product.create({ name: 'Organic Honey', sku: 'OH-JAR', barcode: '8901234567891', category: 'Food', stock: 80.0, lowStockThreshold: 10.0, unit: 'Kg', purchasePrice: 200.00, sellingPrice: 400.00, gstPercent: 12.0, supplier: 'AO Production' });
      const p3 = await Product.create({ name: 'Organic Oats Bulk 25kg Bag', sku: 'BO-25KG', barcode: '8901234567892', category: 'Bulk', stock: 8.0, lowStockThreshold: 2.0, unit: 'pcs', purchasePrice: 1500.00, sellingPrice: 2200.00, gstPercent: 5.0, supplier: 'AO Production' });
      prodRefs = { ho: p1.id, oh: p2.id, bo: p3.id };
      
      // Seed Pack Sizes
      const packHO_200 = await ProductPackSize.create({ packName: '200g', weightInGrams: 200.0, sellingPrice: 50.0, mrp: 60.0, stock: 100.0, packagingCost: 2.30, barcode: '8901234567820', productId: p1.id });
      const packHO_500 = await ProductPackSize.create({ packName: '500g', weightInGrams: 500.0, sellingPrice: 120.0, mrp: 150.0, stock: 150.0, packagingCost: 3.70, barcode: '8901234567850', productId: p1.id });
      const packHO_1000 = await ProductPackSize.create({ packName: '1kg', weightInGrams: 1000.0, sellingPrice: 220.0, mrp: 280.0, stock: 50.0, packagingCost: 5.80, barcode: '8901234567800', productId: p1.id });
      
      const packOH_250 = await ProductPackSize.create({ packName: '250g Jar', weightInGrams: 250.0, sellingPrice: 100.0, mrp: 120.0, stock: 80.0, packagingCost: 8.90, barcode: '8901234567825', productId: p2.id });
      const packOH_500 = await ProductPackSize.create({ packName: '500g Jar', weightInGrams: 500.0, sellingPrice: 180.0, mrp: 220.0, stock: 40.0, packagingCost: 13.30, barcode: '8901234567855', productId: p2.id });

      prodRefs.packHO_500 = packHO_500.id;
      console.log('✓ Finished products and pack sizes seeded.');
    } else {
      prodRefs = {
        ho: products[0].id,
        oh: products[1]?.id || products[0].id,
        bo: products[2]?.id || products[0].id
      };
      const packs = await ProductPackSize.findAll({ where: { productId: prodRefs.ho } });
      prodRefs.packHO_500 = packs[0]?.id || 1;
    }

    // 6. Seed Recipes
    const repackRecipes = await RepackRecipe.findAll();
    if (repackRecipes.length === 0) {
      const recipe = await RepackRecipe.create({
        recipeName: 'Bulk Oats to 500g Pack',
        finishedProductId: prodRefs.ho,
        finishedQty: 50.00,
        unit: 'pcs',
        wastagePercent: 2.00,
        notes: 'Repack 1 Bag of 25kg Oats Bulk into 50 packs of 500g',
        status: 'active',
      });
      await RepackRecipeMaterial.create({ recipeId: recipe.id, productId: prodRefs.bo, qty: 1.00 });
      console.log('✓ Repack recipe seeded.');
    }

    const mfgRecipes = await ManufacturingRecipe.findAll();
    let mfgRecipeId = 1;
    if (mfgRecipes.length === 0) {
      const recipe = await ManufacturingRecipe.create({
        name: 'Honey Oats Production Formula',
        productId: prodRefs.ho,
        yieldQty: 1.00,
        notes: 'Standard batch recipe for Honey Oats',
        status: 'Active',
      });
      mfgRecipeId = recipe.id;
      await ManufacturingRecipeMaterial.create({ recipeId: recipe.id, rawMaterialId: rmRefs.oats, qty: 0.5000 }); // 500g oats
      await ManufacturingRecipeMaterial.create({ recipeId: recipe.id, rawMaterialId: rmRefs.honey, qty: 0.0500 }); // 50g honey
      await ManufacturingRecipeMaterial.create({ recipeId: recipe.id, rawMaterialId: rmRefs.pouch500, qty: 1.0000 }); // 1 pouch
      await ManufacturingRecipeMaterial.create({ recipeId: recipe.id, rawMaterialId: rmRefs.labelOat500, qty: 1.0000 }); // 1 label
      console.log('✓ Manufacturing recipe seeded.');
    } else {
      mfgRecipeId = mfgRecipes[0].id;
    }

    // 7. Seed Customers
    const customers = await Customer.findAll();
    let custRefs = {};
    if (customers.length === 0) {
      const c1 = await Customer.create({
        name: 'EcoBrand Wellness',
        businessName: 'EcoBrand Wellness Private Limited',
        customerType: 'White Label',
        contactPerson: 'Sarah Jenkins',
        phone: '9876500001',
        email: 'sarah@ecobrand.com',
        gstNumber: '29ABCDE1234F1Z1',
        address: 'Sector 4, HSR Layout',
        state: 'Karnataka',
        pincode: '560102',
        creditLimit: 100000,
        balance: 0,
        paymentTerms: 'Net 30',
        status: 'Active',
        brandName: 'EcoBrand',
        labelDesignRef: 'EB-LBL-V2',
        packagingType: 'Glass Jars',
        moq: 500,
        specialPricing: { 'OH-250G': 85.00 },
        manufacturingNotes: 'Pack only in sterilized premium amber glass jars. Apply gold foil stickers.',
      });

      const c2 = await Customer.create({
        name: 'Green Life Organic Store',
        businessName: 'Green Life Retail Ventures',
        customerType: 'Organic Store',
        contactPerson: 'Ramesh Kumar',
        phone: '9876500002',
        email: 'ramesh@greenlife.com',
        gstNumber: '29ABCDE1234F1Z2',
        address: 'Jayanagar 4th Block',
        state: 'Karnataka',
        pincode: '560011',
        creditLimit: 50000,
        balance: 0,
        paymentTerms: 'COD',
        status: 'Active',
        storeCategory: 'A',
      });

      const c3 = await Customer.create({
        name: 'City Supermarket',
        businessName: 'City Retail Group LLC',
        customerType: 'Retail Shop',
        contactPerson: 'David Miller',
        phone: '9876500003',
        email: 'david@citysuper.com',
        gstNumber: '29ABCDE1234F1Z3',
        address: 'MG Road, Bengaluru',
        state: 'Karnataka',
        pincode: '560001',
        creditLimit: 200000,
        balance: 12000,
        paymentTerms: 'Net 15',
        status: 'Active',
      });

      const c4 = await Customer.create({
        name: 'Aditi Sharma',
        customerType: 'D2C Customer',
        phone: '9876500004',
        email: 'aditi.sharma@outlook.com',
        address: 'Prestige Shantiniketan, Whitefield',
        state: 'Karnataka',
        pincode: '560048',
        balance: 0,
        status: 'Active',
        loyaltyPoints: 340,
      });

      custRefs = { wl: c1.id, org: c2.id, retail: c3.id, d2c: c4.id };
      console.log('✓ Segmented customers seeded.');
    } else {
      custRefs = {
        wl: customers[0].id,
        org: customers[1]?.id || customers[0].id,
        retail: customers[2]?.id || customers[0].id,
        d2c: customers[3]?.id || customers[0].id
      };
    }

    // 8. Seed Manufacturing Entries
    const mfgEntries = await ManufacturingEntry.findAll();
    if (mfgEntries.length === 0) {
      const entry = await ManufacturingEntry.create({
        mfgNumber: 'MFG-2026-0001',
        date: new Date(new Date().setDate(new Date().getDate() - 15)), // 15 days ago
        recipeId: mfgRecipeId,
        productId: prodRefs.ho,
        qtyToProduce: 100.00,
        rawMaterialCost: 5050.00,
        laborCost: 600.00,
        otherCost: 200.00,
        totalCost: 5850.00,
        costPerUnit: 58.50,
        status: 'completed',
        createdById: adminId,
        notes: 'Opening batch of Honey Oats packs',
        productionMode: 'pack',
        packSizeId: prodRefs.packHO_500,
      });

      await ManufacturingEntryMaterial.create({ mfgEntryId: entry.id, rawMaterialId: rmRefs.oats, qtyUsed: 50.0, unitCost: 80, totalCost: 4000 });
      await ManufacturingEntryMaterial.create({ mfgEntryId: entry.id, rawMaterialId: rmRefs.honey, qtyUsed: 5.0, unitCost: 150, totalCost: 750 });
      await ManufacturingEntryMaterial.create({ mfgEntryId: entry.id, rawMaterialId: rmRefs.pouch500, qtyUsed: 100.0, unitCost: 2.5, totalCost: 250 });
      await ManufacturingEntryMaterial.create({ mfgEntryId: entry.id, rawMaterialId: rmRefs.labelOat500, qtyUsed: 100.0, unitCost: 1.2, totalCost: 120 });
      
      // Deduct raw stock
      await RawMaterial.decrement({ stock: 50 }, { where: { id: rmRefs.oats } });
      await RawMaterial.decrement({ stock: 5 }, { where: { id: rmRefs.honey } });
      await RawMaterial.decrement({ stock: 100 }, { where: { id: rmRefs.pouch500 } });
      await RawMaterial.decrement({ stock: 100 }, { where: { id: rmRefs.labelOat500 } });

      console.log('✓ Manufacturing entries seeded.');
    }

    // 8.5 Seed Couriers
    const couriersCount = await Courier.count();
    let courierRefs = {};
    if (couriersCount === 0) {
      const c1 = await Courier.create({ name: 'Professional Couriers', phone: '044-28153344', website: 'https://www.professionalcouriers.in/', trackingUrlFormat: 'https://www.professionalcouriers.in/tracking.aspx?tblno=${trackingNumber}' });
      const c2 = await Courier.create({ name: 'DTDC', phone: '080-26781234', website: 'https://www.dtdc.in/', trackingUrlFormat: 'https://www.dtdc.in/tracking.aspx?txtShipmentNumber=${trackingNumber}' });
      const c3 = await Courier.create({ name: 'Delhivery', phone: '0124-6719500', website: 'https://www.delhivery.com/', trackingUrlFormat: 'https://www.delhivery.com/track/package/${trackingNumber}' });
      const c4 = await Courier.create({ name: 'Blue Dart', phone: '1860-233-1234', website: 'https://www.bluedart.com/', trackingUrlFormat: 'https://www.bluedart.com/tracking?trackid=${trackingNumber}' });
      const c5 = await Courier.create({ name: 'India Post', phone: '1800-266-6868', website: 'https://www.indiapost.gov.in/', trackingUrlFormat: 'https://www.indiapost.gov.in/_layouts/15/dop.portal.tracking/trackconsignment.aspx?consignmentNo=${trackingNumber}' });
      courierRefs = { pc: c1.id, dtdc: c2.id, delhivery: c3.id, bd: c4.id, ip: c5.id };
      console.log('✓ Couriers seeded.');
    } else {
      const allC = await Courier.findAll();
      courierRefs = {
        pc: allC[0]?.id || 1,
        dtdc: allC[1]?.id || 2,
        delhivery: allC[2]?.id || 3,
        bd: allC[3]?.id || 4,
        ip: allC[4]?.id || 5
      };
    }

    // 9. Seed Invoices / Sales (3 months of history for analytics)
    const invoices = await Invoice.findAll();
    if (invoices.length === 0) {
      // Month -2
      const inv1 = await Invoice.create({
        invoiceNumber: 'AO-26-0001',
        customerId: custRefs.wl,
        date: new Date(new Date().setMonth(new Date().getMonth() - 2)),
        subtotal: 42500,
        discount: 0,
        gstTotal: 2500,
        grandTotal: 45000,
        paymentMethod: 'bank',
        paymentStatus: 'paid',
        amountPaid: 45000,
        customerType: 'White Label',
        salesChannel: 'White Label',
        createdById: adminId
      });
      await InvoiceItem.create({ invoiceId: inv1.id, productId: prodRefs.ho, name: 'Honey Oats 500g Pack (WL)', qty: 500, unitPrice: 85, gstPercent: 5, lineTotal: 42500 });

      // Month -1
      const inv2 = await Invoice.create({
        invoiceNumber: 'AO-26-0002',
        customerId: custRefs.org,
        date: new Date(new Date().setMonth(new Date().getMonth() - 1)),
        subtotal: 16071.43,
        discount: 0,
        gstTotal: 1928.57,
        grandTotal: 18000,
        paymentMethod: 'bank',
        paymentStatus: 'paid',
        amountPaid: 18000,
        customerType: 'Organic Store',
        salesChannel: 'Organic Store',
        createdById: adminId
      });
      await InvoiceItem.create({ invoiceId: inv2.id, productId: prodRefs.oh, name: 'Organic Honey 250g Jar', qty: 180, unitPrice: 100, gstPercent: 12, lineTotal: 18000 });

      // Current Month
      const inv3 = await Invoice.create({
        invoiceNumber: 'AO-26-0003',
        customerId: custRefs.retail,
        date: new Date(),
        subtotal: 26666.67,
        discount: 0,
        gstTotal: 1333.33,
        grandTotal: 28000,
        paymentMethod: 'credit',
        paymentStatus: 'partial',
        amountPaid: 16000,
        customerType: 'Retail Shop',
        salesChannel: 'Retail Shop',
        createdById: adminId
      });
      await InvoiceItem.create({ invoiceId: inv3.id, productId: prodRefs.ho, name: 'Honey Oats 500g Pack', qty: 200, unitPrice: 120, gstPercent: 5, lineTotal: 24000 });
      await InvoiceItem.create({ invoiceId: inv3.id, productId: prodRefs.bo, name: 'Organic Oats Bulk 25kg Bag', qty: 2, unitPrice: 2000, gstPercent: 5, lineTotal: 4000 });

      const inv4 = await Invoice.create({
        invoiceNumber: 'AO-26-0004',
        customerId: custRefs.d2c,
        date: new Date(),
        subtotal: 1142.86,
        discount: 0,
        gstTotal: 57.14,
        grandTotal: 1200,
        paymentMethod: 'upi',
        paymentStatus: 'paid',
        amountPaid: 1200,
        customerType: 'D2C Customer',
        salesChannel: 'D2C',
        createdById: adminId
      });
      await InvoiceItem.create({ invoiceId: inv4.id, productId: prodRefs.ho, name: 'Honey Oats 500g Pack', qty: 10, unitPrice: 120, gstPercent: 5, lineTotal: 1200 });

      const inv5 = await Invoice.create({
        invoiceNumber: 'AO-26-0005',
        customerId: custRefs.org,
        date: new Date(),
        subtotal: 19642.86,
        discount: 0,
        gstTotal: 2357.14,
        grandTotal: 22000,
        paymentMethod: 'bank',
        paymentStatus: 'paid',
        amountPaid: 22000,
        customerType: 'Organic Store',
        salesChannel: 'Organic Store',
        createdById: adminId
      });
      await InvoiceItem.create({ invoiceId: inv5.id, productId: prodRefs.oh, name: 'Organic Honey 250g Jar', qty: 220, unitPrice: 100, gstPercent: 12, lineTotal: 22000 });

      // Seed Shipments
      const shipment1 = await Shipment.create({
        shipmentNumber: 'SHP-2026-00001',
        invoiceId: inv3.id,
        trackingNumber: 'TRK982741',
        courier: 'Professional Couriers',
        courierId: courierRefs.pc,
        shipmentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        expectedDeliveryDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
        status: 'Dispatched',
        trackingTimeline: [
          { status: 'Pending', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), details: 'Shipment created.' },
          { status: 'Packed', timestamp: new Date(Date.now() - 2.5 * 24 * 60 * 60 * 1000), details: 'Items packed in standard shipping box.' },
          { status: 'Dispatched', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), details: 'Dispatched from warehouse.' }
        ],
        courierStatus: 'In Transit',
        courierTimeline: [
          { status: 'Booked', timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), location: 'AO Warehouse', details: 'Shipment booked.', courier: 'Professional Couriers' },
          { status: 'In Transit', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), location: 'Bengaluru sorting facility', details: 'Package arrived at sorting facility.', courier: 'Professional Couriers' },
          { status: 'In Transit', timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), location: 'Bengaluru Hub', details: 'Transit hub scan.', courier: 'Professional Couriers' }
        ],
        lastKnownLocation: 'Bengaluru Hub',
        shippingAddress: 'MG Road, Bengaluru, Karnataka - 560001',
        packageWeight: 12.50,
        packageCount: 2,
        remarks: 'Pre-paid order. Standard dispatch.',
        notes: 'Fragile, keep dry.',
        createdById: adminId
      });

      const shipment2 = await Shipment.create({
        shipmentNumber: 'SHP-2026-00002',
        invoiceId: inv4.id,
        trackingNumber: 'TRK254198',
        courier: 'DTDC',
        courierId: courierRefs.dtdc,
        shipmentDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        expectedDeliveryDate: new Date(Date.now() - 4 * 60 * 60 * 1000),
        deliveredDate: new Date(Date.now() - 4 * 60 * 60 * 1000),
        status: 'Dispatched',
        trackingTimeline: [
          { status: 'Pending', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), details: 'Shipment created.' },
          { status: 'Packed', timestamp: new Date(Date.now() - 1.8 * 24 * 60 * 60 * 1000), details: 'Packed in stand-up pouch carton.' },
          { status: 'Dispatched', timestamp: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000), details: 'Dispatched from warehouse.' }
        ],
        courierStatus: 'Delivered',
        courierTimeline: [
          { status: 'Booked', timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), location: 'AO Warehouse', details: 'Shipment booked.', courier: 'DTDC' },
          { status: 'In Transit', timestamp: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000), location: 'Tumkur Facility', details: 'Package in transit.', courier: 'DTDC' },
          { status: 'Out For Delivery', timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), location: 'Tirupattur Delivery Hub', details: 'Out for delivery.', courier: 'DTDC' },
          { status: 'Delivered', timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), location: 'Tirupattur', details: 'Delivered and signed by Aditi Sharma.', courier: 'DTDC' }
        ],
        lastKnownLocation: 'Tirupattur',
        courierDeliveredDate: new Date(Date.now() - 4 * 60 * 60 * 1000),
        shippingAddress: 'Prestige Shantiniketan, Whitefield, Karnataka - 560048',
        packageWeight: 4.20,
        packageCount: 1,
        remarks: 'Direct home delivery.',
        notes: 'Handover to security gate if not available.',
        createdById: adminId
      });

      const shipment3 = await Shipment.create({
        shipmentNumber: 'SHP-2026-00003',
        invoiceId: inv5.id,
        trackingNumber: 'TRK774125',
        courier: 'Delhivery',
        courierId: courierRefs.delhivery,
        shipmentDate: new Date(),
        expectedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        status: 'Packed',
        trackingTimeline: [
          { status: 'Pending', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), details: 'Shipment created.' },
          { status: 'Packed', timestamp: new Date(), details: 'Amber glass jars packed with bubble wrap.' }
        ],
        courierStatus: 'Pending',
        courierTimeline: [
          { status: 'Booked', timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), location: 'AO Warehouse', details: 'Shipment booked with Delhivery.', courier: 'Delhivery' }
        ],
        lastKnownLocation: 'AO Warehouse',
        shippingAddress: 'Jayanagar 4th Block, Bengaluru, Karnataka - 560011',
        packageWeight: 22.00,
        packageCount: 4,
        remarks: 'Heavy glass shipment.',
        createdById: adminId
      });

      // Update settings counters
      const s = await Settings.findOne();
      if (s) {
        s.shipmentCounter = 3;
        await s.save();
      }

      console.log('✓ Invoices, shipments, and sales history seeded.');
    }

    console.log('Database seeding completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Database seeding failed:', err);
    process.exit(1);
  }
};

seed();
