const Payment = require("../models/Payment");
const Ledger = require("../models/Ledger");
const Merchant = require("../models/Merchant");
const Invoice = require("../models/Invoice");
const InvoiceSettlement = require("../models/InvoiceSettlement");
const { Op } = require("sequelize");
const sequelize = require("../config/db");
// const { Invoice, Payment, Ledger, InvoiceSettlement } = require("../models");


exports.getAllPayments = async (req, res) => {
  try {
    const { merchantId } = req.query; // 👈 Get from query params

    // Build dynamic where condition
    const whereCondition = merchantId ? { merchant_id: merchantId } : {};

    const payments = await Payment.findAll({
      where: whereCondition,
      include: [
        {
          model: Merchant,
          attributes: ["name"],
        },
      ],
    });
    res.json({ success: true, payments });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

exports.addPayment = async (req, res) => {
  const t = await sequelize.transaction(); // 🔹 start transaction
  try {
    const data = req.body;

    if (!data.payment_type) {
      await t.rollback();
      return res.json({ success: false, message: "Payment Type not found" });
    }

    if (data.payment_type === "invoice") {
      if (!data.invoice_id) {
        await t.rollback();
        return res.json({ success: false, message: "Invoice ID not found" });
      }

      const invoice = await Invoice.findByPk(data.invoice_id, { transaction: t });
      if (!invoice) {
        await t.rollback();
        return res.json({ success: false, message: "Invoice not found" });
      }

      const paidAmount = Number(data.amount);
      let settledForPayment = 0;
      let unsettledForPayment = 0;

      if (paidAmount >= invoice.unsettled_amount) {
        settledForPayment = invoice.unsettled_amount;
        unsettledForPayment = paidAmount - invoice.unsettled_amount;
        invoice.settled_amount += invoice.unsettled_amount;
        invoice.unsettled_amount = 0;
      } else {
        settledForPayment = paidAmount;
        unsettledForPayment = 0;
        invoice.settled_amount += paidAmount;
        invoice.unsettled_amount -= paidAmount;
      }

      await invoice.save({ transaction: t });

      const paymentData = {
        merchant_id: data.merchant_id,
        description: data.description,
        oil_type: data.oil_type,
        amount: paidAmount,
        invoice_id: data.invoice_id,
        settled_amount: settledForPayment,
        unsettled_amount: unsettledForPayment,
        date: data.date,
      };

      const payment = await Payment.create(paymentData, { transaction: t });

      const ledgerData = {
        merchant_id: data.merchant_id,
        payment_id: payment.id,
        description: data.description,
        oil_type: data.oil_type,
        credit: data.amount,
      };
      const ledger = await Ledger.create(ledgerData, { transaction: t });

      const invoiceSettlementData = {
        merchant_id: data.merchant_id,
        invoice_id: data.invoice_id,
        payment_id: payment.id,
        settled_amount: settledForPayment,
      };
      await InvoiceSettlement.create(invoiceSettlementData, { transaction: t });

      await t.commit(); // ✅ everything OK — commit transaction
      return res.json({
        success: true,
        message: "Payment created and invoice settled",
        payment,
        ledger,
      });

    } else {
      // 🔥 General payment: settle all invoices for this merchant & oil_type
      const paymentData = {
        merchant_id: data.merchant_id,
        description: data.description,
        oil_type: data.oil_type,
        amount: Number(data.amount),
        date: data.date,
      };
    
      const payment = await Payment.create(paymentData, { transaction: t });
    
      // 🔥 Fetch all unsettled invoices
      const invoices = await Invoice.findAll({
        where: {
          merchant_id: data.merchant_id,
          oil_type: data.oil_type,
          unsettled_amount: { [Op.gt]: 0 },
        },
        transaction: t,
      });
    
      let remainingPayment = Number(data.amount);
      let totalSettled = 0;
    
      for (const inv of invoices) {
        if (remainingPayment <= 0) break;
    
        const unsettled = inv.unsettled_amount;
        const settledNow = Math.min(unsettled, remainingPayment);
    
        inv.settled_amount += settledNow;
        inv.unsettled_amount -= settledNow;
    
        remainingPayment -= settledNow;
        totalSettled += settledNow;
    
        await inv.save({ transaction: t });
    
        // 🧩 Add payment_id here directly
        await InvoiceSettlement.create(
          {
            merchant_id: data.merchant_id,
            payment_id: payment.id, // ✅ Now available
            invoice_id: inv.id,
            settled_amount: settledNow,
          },
          { transaction: t }
        );
      }
    
      // Update payment record with totals
      payment.settled_amount = totalSettled;
      payment.unsettled_amount = remainingPayment;
      await payment.save({ transaction: t });
    
      // Ledger entry
      const ledger = await Ledger.create(
        {
          merchant_id: data.merchant_id,
          payment_id: payment.id,
          description: data.description,
          oil_type: data.oil_type,
          credit: Number(data.amount),
        },
        { transaction: t }
      );
    
      await t.commit();
      return res.json({
        success: true,
        message: "All unsettled invoices settled successfully",
        totalSettled,
        payment,
        ledger,
      });
    }
  } catch (err) {
    await t.rollback(); // ❌ undo all changes
    return res.json({ success: false, message: err.message });
  }
};


exports.getPaymentById = async (req, res) => {
  try {
    res.json({ success: true});
    const payment = await Payment.findByPk(req.params.id);
    if (!payment) return res.json({ success: false, message: "Payment not found" });
    res.json({ success: true, payment });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

exports.updatePayment = async (req, res) => {
  try {
    const result = await Payment.update(req.body, { where: { id: req.params.id } });
    if (result[0] > 0) {
      res.json({ success: true, message: "Payment updated" });
    } else {
      res.json({ success: false, message: "Update failed" });
    }
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

exports.deletePayment = async (req, res) => {
  try {
    // Delete ledger entries first (to maintain FK integrity if any)
    await Ledger.destroy({ where: { payment_id: req.params.id } });

    // Then delete the payment
    const result = await Payment.destroy({ where: { id: req.params.id } });

    if (result > 0) {
      res.json({ success: true, message: "Payment and related ledger entries deleted" });
    } else {
      res.json({ success: false, message: "Payment not found" });
    }
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

exports.getAdjustmentData = async (req, res) => {
  try {
    const { merchantId, oilType } = req.query; // 👈 both from query params

    // Build dynamic where condition
    const whereCondition = {};

    // filter by merchant
    if (merchantId) {
      whereCondition.merchant_id = merchantId;
    }

    // filter by unsettled amount only if settleCheck = 1
    // if (settleCheck === "1") {
      whereCondition.unsettled_amount = { [Op.gt]: 0 }; // only > 0
    // }
    
    if (oilType) {
      whereCondition.oil_type = oilType; // only > 0
    }

    const invoices = await Invoice.findAll({
      where: whereCondition,
      include: [
        {
          model: Merchant,
          attributes: ["name"],
        },
      ],
    });

    const payments = await Payment.findAll({
      where: whereCondition,
      include: [
        {
          model: Merchant,
          attributes: ["name"],
        },
      ],
    });
    console.log(payments);
    res.json({ success: true, invoices,payments });    
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};

exports.adjustData = async (req, res) => {
  const t = await sequelize.transaction(); // 🔹 start transaction
  try {
    const data = req.body;
    if (!data.invoice_id) {
      await t.rollback();
      return res.json({ success: false, message: "Invoice ID not found" });
    }

    const invoice = await Invoice.findByPk(data.invoice_id, { transaction: t });
    if (!invoice) {
      await t.rollback();
      return res.json({ success: false, message: "Invoice not found" });
    }
    const payment = await Payment.findByPk(data.payment_id, { transaction: t });
    if (!payment) {
      await t.rollback();
      return res.json({ success: false, message: "Payment not found" });
    }
    const paidAmount = Number(payment.unsettled_amount);
    let settledForPayment = 0;
    let unsettledForPayment = 0;

    if (paidAmount >= invoice.unsettled_amount) {
      settledAmount = invoice.unsettled_amount;
      settledForPayment = payment.settled_amount + invoice.unsettled_amount;
      unsettledForPayment = payment.unsettled_amount - settledAmount;
      invoice.settled_amount += invoice.unsettled_amount;
      invoice.unsettled_amount = 0;
    } else {
      settledAmount = paidAmount;
      settledForPayment = paidAmount + payment.settled_amount;
      unsettledForPayment = 0;
      invoice.settled_amount += paidAmount;
      invoice.unsettled_amount -= paidAmount;
    }

    await invoice.save({ transaction: t });

 

    payment.unsettled_amount = unsettledForPayment;
    payment.settled_amount = settledForPayment;

    await payment.save({ transaction: t });

    const invoiceSettlementData = {
      merchant_id: data.merchant_id,
      invoice_id: data.invoice_id,
      payment_id: data.payment_id,
      settled_amount: settledAmount,
    };
    await InvoiceSettlement.create(invoiceSettlementData, { transaction: t });

    await t.commit(); // ✅ everything OK — commit transaction
    return res.json({
      success: true,
      message: "Payment settled and invoice settled",
      payment,
    });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
};
