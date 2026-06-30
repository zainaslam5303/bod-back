const express = require("express");
const { exportDatabase } = require("../controllers/backupController");

const router = express.Router();

// Database export endpoint
router.get("/export", exportDatabase);

module.exports = router;
