const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middlewares/authMiddleware");
const {
  getAllMerchants,
  addMerchant,
  getMerchantById,
  updateMerchant,
  deleteMerchant,
  getMerchants
} = require("../controllers/merchantController");

router.get("/", verifyToken, getAllMerchants);
router.get("/merchants", verifyToken, getMerchants);
router.post("/", verifyToken, addMerchant);
router.get("/:id", verifyToken, getMerchantById);
router.put("/:id", verifyToken, updateMerchant);
router.delete("/:id", verifyToken, deleteMerchant);

module.exports = router;
