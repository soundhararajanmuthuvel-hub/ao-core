const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Supplier = require('./Supplier');
const { makeMongooseCompatible } = require('./compat');

const RawMaterial = sequelize.define('RawMaterial', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  materialCode: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  category: {
    type: DataTypes.ENUM(
      'Ingredients',
      'Packaging Materials',
      'Labels',
      'Bottles',
      'Pouches',
      'Cartons',
      'Other Materials'
    ),
    allowNull: false,
  },
  unitType: {
    type: DataTypes.ENUM('Weight', 'Volume', 'Pieces'),
    defaultValue: 'Weight',
  },
  baseUnit: {
    type: DataTypes.STRING,
    defaultValue: 'Kg',
  },
  purchaseUnit: {
    type: DataTypes.STRING,
    defaultValue: 'Kg',
  },
  unit: {
    type: DataTypes.STRING,
    defaultValue: 'Kg',
  },
  stock: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  minStock: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 10,
  },
  purchasePrice: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
  },
  gstPercent: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0,
  },
  warehouse: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('Active', 'Inactive'),
    defaultValue: 'Active',
  },
  reorderQty: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 100,
  },
  bagSize: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 1.00,
  },
  isLowStock: {
    type: DataTypes.VIRTUAL,
    get() {
      return Number(this.stock) <= Number(this.minStock);
    },
  },
});

const syncUnits = (material) => {
  if (material.unit) {
    material.baseUnit = material.unit;
    material.purchaseUnit = material.unit;

    const u = material.unit.toLowerCase().trim();
    if (['kg', 'kilogram', 'g', 'gram', 'grams', 'ton', 't'].includes(u)) {
      material.unitType = 'Weight';
    } else if (['liter', 'l', 'liters', 'ml', 'milliliter', 'milliliters'].includes(u)) {
      material.unitType = 'Volume';
    } else {
      material.unitType = 'Pieces';
    }
  } else if (material.baseUnit) {
    material.unit = material.baseUnit;
  }
};

RawMaterial.beforeCreate((material) => {
  syncUnits(material);
});
RawMaterial.beforeUpdate((material) => {
  syncUnits(material);
});

RawMaterial.belongsTo(Supplier, { as: 'supplier', foreignKey: 'supplierId', onDelete: 'CASCADE' });

makeMongooseCompatible(RawMaterial, {
  supplier: 'supplierId',
});

module.exports = RawMaterial;
