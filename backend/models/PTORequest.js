const mongoose = require("mongoose");

const PTORequestSchema = new mongoose.Schema(
  {
    employeeName: { type: String, required: true },
    employeeEmail: { type: String, default: "" },
    employeePhone: { type: String, default: "" },
    source: { type: String, enum: ["web", "phone"], default: "web" },
    callId: { type: String, default: "" },
    transcript: { type: String, default: "" },
    type: {
      type: String,
      enum: ["vacation", "sick", "personal", "bereavement", "other"],
      default: "vacation",
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    days: { type: Number, required: true },
    reason: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "approved", "denied"],
      default: "pending",
    },
    reviewNote: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("PTORequest", PTORequestSchema);
