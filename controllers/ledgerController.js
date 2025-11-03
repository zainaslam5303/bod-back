const { Op, Sequelize } = require("sequelize");
const sequelize = require("../config/db");

const Payment = require("../models/Payment");
const Ledger = require("../models/Ledger");
const Merchant = require("../models/Merchant");
const Invoice = require("../models/Invoice");
const InvoiceSettlement = require("../models/InvoiceSettlement");

exports.getAllLedger = async (req, res) => {
  try {
    const { merchantId, oilType } = req.query;

    const whereCondition = {};

    if (merchantId) {
      whereCondition.merchant_id = merchantId;
    }

    if (oilType) {
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
          attributes: ["date", "invoice_id"],
        },
      ],
      order: [
        [
          Sequelize.literal('COALESCE(`Invoice`.`date`, `Payment`.`date`)'),
          'ASC',
        ],
      ],
    });

    res.json({ success: true, ledger });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};
