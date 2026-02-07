const mongoose = require("mongoose");

const ComplianceRunSchema = new mongoose.Schema(
  {
    datasetId: { type: mongoose.Schema.Types.ObjectId, ref: "ComplianceDataset" },
    entities: { type: [Object], default: [] },
    transactions: { type: [Object], default: [] },
    selectedRules: { type: [String], default: ["AML", "KYC", "OFAC", "SOX", "RegW", "Patterns"] },
    alerts: { type: [Object], default: [] },
    regulatoryScores: { type: [Object], default: [] },
    summary: { type: String, default: "" },
    status: { type: String, enum: ["success", "error"], required: true },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ComplianceRun", ComplianceRunSchema);
