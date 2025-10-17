const sequelize = require("../config/db");
const Invoice = require("./Invoice");
const Ledger = require("./Ledger");
const Merchant = require("./Merchant");
const Payment = require("./Payment");

// ✅ Define associations here (ONLY here)
Merchant.hasMany(Invoice, { foreignKey: "merchant_id" });
Invoice.belongsTo(Merchant, { foreignKey: "merchant_id" });

Merchant.hasMany(Payment, { foreignKey: "merchant_id" });
Payment.belongsTo(Merchant, { foreignKey: "merchant_id" });

Merchant.hasMany(Ledger, { foreignKey: "merchant_id" });
Ledger.belongsTo(Merchant, { foreignKey: "merchant_id" });

Invoice.hasMany(Ledger, { foreignKey: "invoice_id" });
Ledger.belongsTo(Invoice, { foreignKey: "invoice_id" });

Payment.hasMany(Ledger, { foreignKey: "payment_id" });
Ledger.belongsTo(Payment, { foreignKey: "payment_id" });

module.exports = { sequelize, Invoice, Merchant };
