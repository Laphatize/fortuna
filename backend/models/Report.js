const mongoose = require("mongoose");

const ReportSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["reconciliation", "compliance", "risk", "document"], required: true },
    title: { type: String, required: true },
    summary: { type: String, default: "" },
    payload: { type: Object, default: null },
    status: { type: String, enum: ["success", "error"], default: "success" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", ReportSchema);
