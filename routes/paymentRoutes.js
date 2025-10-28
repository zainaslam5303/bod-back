const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");
const {
  getAllPayments,
  addPayment,
  getPaymentById,
  updatePayment,
  deletePayment,
  getAdjustmentData,
  adjustData
} = require("../controllers/paymentController");

router.get("/get-adjustment-data", verifyToken, getAdjustmentData);
router.post("/adjust-data", verifyToken, adjustData);
router.get("/", verifyToken, getAllPayments);
router.post("/", verifyToken, addPayment);
router.get("/:id", verifyToken, getPaymentById);
router.put("/:id", verifyToken, updatePayment);
router.delete("/:id", verifyToken, deletePayment);

module.exports = router;
