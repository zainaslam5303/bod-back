const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");
const {
  getAllInvoices,
  addInvoice,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  getMerchantBalance
} = require("../controllers/invoiceController");

router.get("/", verifyToken, getAllInvoices);
router.get("/merchant-balance",getMerchantBalance)
router.post("/", verifyToken, addInvoice);
router.get("/:id", verifyToken, getInvoiceById);
router.put("/:id", verifyToken, updateInvoice);
router.delete("/:id", verifyToken, deleteInvoice);

module.exports = router;
