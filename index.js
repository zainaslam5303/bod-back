const express = require("express");
const cors = require("cors");
const { sequelize } = require("./models");
const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

// Routes
app.use("/auth", require("./routes/authRoutes"));
app.use("/merchants", require("./routes/merchantRoutes"));
app.use("/invoice", require("./routes/invoiceRoutes"));
app.use("/payment", require("./routes/paymentRoutes"));
app.use("/ledger", require("./routes/ledgerRoutes"));

// Sync DB
sequelize.sync()
  .then(() => console.log("✅ Tables created"))
  .catch((err) => console.error("❌ Error creating tables:", err));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
