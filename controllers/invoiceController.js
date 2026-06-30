const Invoice = require("../models/Invoice");
const Ledger = require("../models/Ledger");
const Merchant = require("../models/Merchant");
const InvoiceSettlement = require("../models/InvoiceSettlement");
const { Op } = require("sequelize");
const sequelize = require("../config/db");

exports.getAllInvoices = async (req, res) => {
  try {
    const { merchantId, settleCheck, oilType, page = 1, limit = 25, search = "" } = req.query;

    const whereCondition = {};
    if (merchantId) {
      whereCondition.merchant_id = merchantId;
    }
    if (settleCheck === "1") {
      whereCondition.unsettled_amount = { [Op.gt]: 0 };
    }
    if (oilType) {
      whereCondition.oil_type = oilType;
    }

    const parsedPage = Number.parseInt(page, 10);
    const parsedLimit = Number.parseInt(limit, 10);
    const safePage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const safeLimit = Number.isNaN(parsedLimit) || parsedLimit < 1 ? 25 : Math.min(parsedLimit, 200);
    const offset = (safePage - 1) * safeLimit;
    const trimmedSearch = String(search || "").trim();

    const searchCondition = trimmedSearch
      ? {
          [Op.or]: [
            { description: { [Op.like]: `%${trimmedSearch}%` } },
            { oil_type: { [Op.like]: `%${trimmedSearch}%` } },
            { "$Merchant.name$": { [Op.like]: `%${trimmedSearch}%` } },
          ],
        }
      : {};

    const whereWithSearch = {
      ...whereCondition,
      ...searchCondition,
    };

    const { rows: invoices, count: totalItems } = await Invoice.findAndCountAll({
      where: whereWithSearch,
      include: [
        {
          model: Merchant,
          attributes: ["name"],
        },
      ],
      distinct: true,
      limit: safeLimit,
      offset,
      order: [["date", "DESC"]],
    });

    const totalPages = Math.max(1, Math.ceil(totalItems / safeLimit));

    res.json({
      success: true,
      invoices,
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalItems,
        totalPages,
      },
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

exports.getMerchantBalance = async (req,res)=>{
    try {
      const [results] = await sequelize.query(`
            SELECT 
            m.id AS merchant_id,
            m.name AS merchant_name,
            SUM(CASE WHEN i.oil_type = 'sarso' THEN i.unsettled_amount ELSE 0 END) AS sarsoo,
            SUM(CASE WHEN i.oil_type = 'pakwan' THEN i.unsettled_amount ELSE 0 END) AS pakwan,
            SUM(CASE WHEN i.oil_type = 'tilli' THEN i.unsettled_amount ELSE 0 END) AS tilli,
            SUM(i.unsettled_amount) AS total
        FROM Invoices i
        INNER JOIN Merchants m ON m.id = i.merchant_id and m.status = 1
        WHERE i.unsettled_amount > 0
        GROUP BY m.name
        ORDER BY m.name;
      `);
  
      res.json({ success: true, data: results });
    } catch (err) {
      console.error(err);
      res.json({ success: false, message: err.message });
    }
};

exports.addInvoice = async (req, res) => {
  try {
    // const exists = await Invoice.findOne({ where: { name: req.body.name } });
    // if (exists) return res.json({ success: false, message: "Merchant already exists" });
    const invoiceData = {
        ...req.body,           // req.body ke saare fields include kar lo
        settled_amount: 0,     // nayi fields append karo
        unsettled_amount: req.body.total_amount
        // createdBy: req.user?.id || null  // example
      };
    
    const invoice = await Invoice.create(invoiceData);
    const ledgerData = {
      merchant_id: req.body.merchant_id,
      invoice_id: invoice.id,  
      description: req.body.description,           
      oil_type: req.body.oil_type,
      debit: req.body.total_amount,
    };
    const ledger = await Ledger.create(ledgerData);

    res.json({ success: true, message: "Invoice created", invoice,ledger});
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.json({ success: false, message: "Invoice not found" });
    res.json({ success: true, invoice });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

exports.updateInvoice = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const invoice = await Invoice.findByPk(req.params.id, { transaction: t });
    if (!invoice) {
      await t.rollback();
      return res.json({ success: false, message: "Invoice not found" });
    }

    const {
      merchant_id,
      oil_type,
      date,
      description,
      other_charges,
      weight,
      rate,
    } = req.body;

    const updates = {};
    if (merchant_id !== undefined) updates.merchant_id = merchant_id;
    if (oil_type !== undefined) updates.oil_type = oil_type;
    if (date !== undefined) updates.date = date;
    if (description !== undefined) updates.description = description;
    if (other_charges !== undefined) updates.other_charges = Number(other_charges) || 0;

    // Business rule requested: weight/rate editable only when settled_amount is zero
    if ((weight !== undefined || rate !== undefined) && Number(invoice.settled_amount) !== 0) {
      await t.rollback();
      return res.json({
        success: false,
        message: "Weight and rate can only be edited when settled amount is zero",
      });
    }

    const finalWeight = weight !== undefined ? Number(weight) : Number(invoice.weight);
    const finalRate = rate !== undefined ? Number(rate) : Number(invoice.rate);
    const finalOtherCharges =
      updates.other_charges !== undefined
        ? Number(updates.other_charges)
        : Number(invoice.other_charges || 0);

    if (weight !== undefined) updates.weight = finalWeight;
    if (rate !== undefined) updates.rate = finalRate;

    const newTotalAmount = (finalWeight * finalRate) + finalOtherCharges;
    const settledAmount = Number(invoice.settled_amount || 0);
    if (newTotalAmount < settledAmount) {
      await t.rollback();
      return res.json({
        success: false,
        message: "Total amount cannot be less than settled amount",
      });
    }

    updates.total_amount = newTotalAmount;
    updates.unsettled_amount = newTotalAmount - settledAmount;

    await invoice.update(updates, { transaction: t });

    await Ledger.update(
      {
        merchant_id: updates.merchant_id !== undefined ? updates.merchant_id : invoice.merchant_id,
        oil_type: updates.oil_type !== undefined ? updates.oil_type : invoice.oil_type,
        description: updates.description !== undefined ? updates.description : invoice.description,
        debit: newTotalAmount,
      },
      { where: { invoice_id: invoice.id }, transaction: t }
    );

    await t.commit();
    return res.json({ success: true, message: "Invoice and ledger updated successfully" });
  } catch (err) {
    await t.rollback();
    return res.json({ success: false, message: err.message });
  }
};

exports.deleteInvoice = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const invoice = await Invoice.findByPk(req.params.id, { transaction: t });
    if (!invoice) {
      await t.rollback();
      return res.json({ success: false, message: "Invoice not found" });
    }

    if (Number(invoice.settled_amount || 0) > 0) {
      await t.rollback();
      return res.json({
        success: false,
        message: "Settled invoice cannot be deleted",
      });
    }

    await Ledger.destroy({ where: { invoice_id: req.params.id }, transaction: t });
    await InvoiceSettlement.destroy({ where: { invoice_id: req.params.id }, transaction: t });

    const result = await Invoice.destroy({ where: { id: req.params.id }, transaction: t });

    if (result > 0) {
      await t.commit();
      return res.json({
        success: true,
        message: "Invoice and related ledger entries deleted",
      });
    } else {
      await t.rollback();
      return res.json({ success: false, message: "Invoice not found" });
    }
  } catch (err) {
    await t.rollback();
    return res.json({ success: false, message: err.message });
  }
};

exports.getInvoiceSettlements = async (req, res) => {
  try {
    const invoiceId = req.params.id;
    
    const settlements = await InvoiceSettlement.findAll({
      where: { invoice_id: invoiceId },
      order: [["created_date", "DESC"]],
    });

    res.json({
      success: true,
      settlements,
    });
  } catch (err) {
    console.error("Error in getInvoiceSettlements:", err);
    res.json({ success: false, message: err.message });
  }
};

