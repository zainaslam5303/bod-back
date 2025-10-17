const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");
const {
  getAllLedger,
  
} = require("../controllers/ledgerController");

router.get("/", verifyToken, getAllLedger);
// router.post("/", verifyToken, addInvoice);
// router.get("/:id", verifyToken, getInvoiceById);
// router.put("/:id", verifyToken, updateInvoice);
// router.delete("/:id", verifyToken, deleteInvoice);

module.exports = router;
