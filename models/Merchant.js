const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Merchant = sequelize.define("Merchant", {
  name: { type: DataTypes.STRING, allowNull: false, unique: true },
  mobile_number: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 }, // 1: active, 0: inactive
}, {
  // timestamps: false, // disable both
  createdAt: "created_date", // use custom column
  updatedAt: false, // no updated column
});

module.exports = Merchant;
