const Product = require('../models/Product');
const RawMaterial = require('../models/RawMaterial');
const ManufacturingRecipe = require('../models/ManufacturingRecipe');
const ManufacturingRecipeMaterial = require('../models/ManufacturingRecipeMaterial');
const Supplier = require('../models/Supplier');

const seedAbcMalt = async () => {
  try {
    console.log('Seeding ABC Malt Products and Recipes...');

    // 1. Ensure a supplier exists
    let supplier = await Supplier.findOne({ where: { type: 'raw_material' } });
    if (!supplier) {
      supplier = await Supplier.create({
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
    }

    // 2. Ensure raw materials exist
    const materialsData = [
      { name: 'Apple', materialCode: 'RM-APPLE', category: 'Ingredients', unit: 'Kg', stock: 100, minStock: 10, purchasePrice: 50, supplierId: supplier.id },
      { name: 'Beetroot', materialCode: 'RM-BEET', category: 'Ingredients', unit: 'Kg', stock: 100, minStock: 10, purchasePrice: 40, supplierId: supplier.id },
      { name: 'Carrot', materialCode: 'RM-CARROT', category: 'Ingredients', unit: 'Kg', stock: 100, minStock: 10, purchasePrice: 30, supplierId: supplier.id },
      { name: 'Jaggery Powder', materialCode: 'RM-JAGGERY', category: 'Ingredients', unit: 'Kg', stock: 100, minStock: 10, purchasePrice: 80, supplierId: supplier.id },
      { name: 'Cashew', materialCode: 'RM-CASHEW', category: 'Ingredients', unit: 'Kg', stock: 100, minStock: 10, purchasePrice: 600, supplierId: supplier.id },
      { name: 'Badam', materialCode: 'RM-BADAM', category: 'Ingredients', unit: 'Kg', stock: 100, minStock: 10, purchasePrice: 700, supplierId: supplier.id },
      { name: 'Cardamom', materialCode: 'RM-CARDAMOM', category: 'Ingredients', unit: 'Kg', stock: 100, minStock: 10, purchasePrice: 1500, supplierId: supplier.id },
    ];

    const materialsMap = {};
    for (const mat of materialsData) {
      let existing = await RawMaterial.findOne({ where: { materialCode: mat.materialCode } });
      if (!existing) {
        existing = await RawMaterial.create(mat);
        console.log(`✓ Seeded raw material: ${mat.name}`);
      }
      materialsMap[mat.name] = existing.id;
    }

    // 3. Ensure parent product exists
    let parentProduct = await Product.findOne({ where: { sku: 'ABC-MALT-BULK' } });
    if (!parentProduct) {
      parentProduct = await Product.create({
        name: 'ABC Malt Bulk',
        sku: 'ABC-MALT-BULK',
        productType: 'BULK_PRODUCT',
        unit: 'KG',
        stock: 0.0,
        purchasePrice: 200.00,
        sellingPrice: 0.0,
        lowStockThreshold: 1.0,
      });
      console.log('✓ Seeded parent product: ABC Malt Bulk');
    }

    // 4. Ensure variants exist
    const variantsData = [
      { name: 'ABC Malt 200g', sku: 'ABC-MALT-200G', parentProductId: parentProduct.id, productType: 'RETAIL_PACK', packSize: '200g', conversionFactor: 0.2, unit: 'pcs', stock: 0, sellingPrice: 120, mrp: 150 },
      { name: 'ABC Malt 500g', sku: 'ABC-MALT-500G', parentProductId: parentProduct.id, productType: 'RETAIL_PACK', packSize: '500g', conversionFactor: 0.5, unit: 'pcs', stock: 0, sellingPrice: 250, mrp: 300 },
      { name: 'ABC Malt 1kg', sku: 'ABC-MALT-1KG', parentProductId: parentProduct.id, productType: 'RETAIL_PACK', packSize: '1kg', conversionFactor: 1.0, unit: 'pcs', stock: 0, sellingPrice: 450, mrp: 500 },
    ];

    for (const variant of variantsData) {
      let existing = await Product.findOne({ where: { sku: variant.sku } });
      if (!existing) {
        await Product.create(variant);
        console.log(`✓ Seeded variant: ${variant.name}`);
      }
    }

    // 5. Ensure recipe exists
    let recipe = await ManufacturingRecipe.findOne({ where: { productId: parentProduct.id } });
    if (!recipe) {
      recipe = await ManufacturingRecipe.create({
        name: 'ABC Malt Bulk Recipe',
        productId: parentProduct.id,
        yieldQty: 6.0,
        notes: 'Bulk production formula for ABC Malt',
        status: 'Active',
      });
      console.log('✓ Seeded manufacturing recipe: ABC Malt Bulk Recipe');

      const recipeMaterials = [
        { recipeId: recipe.id, rawMaterialId: materialsMap['Apple'], qty: 1.0 },
        { recipeId: recipe.id, rawMaterialId: materialsMap['Beetroot'], qty: 1.0 },
        { recipeId: recipe.id, rawMaterialId: materialsMap['Carrot'], qty: 1.0 },
        { recipeId: recipe.id, rawMaterialId: materialsMap['Jaggery Powder'], qty: 1.0 },
        { recipeId: recipe.id, rawMaterialId: materialsMap['Cashew'], qty: 1.0 },
        { recipeId: recipe.id, rawMaterialId: materialsMap['Badam'], qty: 1.0 },
        { recipeId: recipe.id, rawMaterialId: materialsMap['Cardamom'], qty: 0.1 },
      ];

      for (const rm of recipeMaterials) {
        await ManufacturingRecipeMaterial.create(rm);
      }
      console.log('✓ Seeded ingredients for ABC Malt Bulk Recipe');
    }

    console.log('ABC Malt Seeding Completed Successfully.');
  } catch (error) {
    console.error('Failed to seed ABC Malt details:', error);
  }
};

module.exports = seedAbcMalt;
