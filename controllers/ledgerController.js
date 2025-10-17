const Payment = require("../models/Payment");
const Ledger = require("../models/Ledger");
const Merchant = require("../models/Merchant");
const Invoice = require("../models/Invoice");
const InvoiceSettlement = require("../models/InvoiceSettlement");
const { Op } = require("sequelize");
const sequelize = require("../config/db");
// const { Invoice, Payment, Ledger, InvoiceSettlement } = require("../models");


exports.getAllLedger = async (req, res) => {
  try {
    const { merchantId, oilType } = req.query; // 👈 both from query params

    // Build dynamic where condition
    const whereCondition = {};

    // filter by merchant
    if (merchantId) {
      whereCondition.merchant_id = merchantId;
    }

    if(oilType){
        whereCondition.oil_type = oilType;
    }

    const ledger = await Ledger.findAll({
      where: whereCondition,
      include: [
        {
          model: Merchant,
          attributes: ["name"],
        },
        {
            model: Invoice,
            attributes: ["date"],
        },
        {
            model: Payment,
            attributes: ["date","invoice_id"],
        }
      ],
    });
    res.json({ success: true, ledger });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

