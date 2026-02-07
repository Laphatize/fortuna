const express = require("express");
const router = express.Router();
const Report = require("../models/Report");
const ReconciliationRun = require("../models/ReconciliationRun");
const ComplianceRun = require("../models/ComplianceRun");
const RiskRun = require("../models/RiskRun");

// GET /api/reports
router.get("/", async (_req, res) => {
  const reports = await Report.find().sort({ createdAt: -1 }).lean();
  res.json(reports);
});

// POST /api/reports/generate
router.post("/generate", async (req, res) => {
  const { type } = req.body || {};
  let report = null;

  if (type === "reconciliation") {
    const run = await ReconciliationRun.findOne().sort({ createdAt: -1 }).lean();
    if (!run) return res.status(404).json({ error: "No reconciliation runs found" });
    report = await Report.create({
      type,
      title: "Reconciliation Report",
      summary: run.summary
        ? `${run.summary.matched || 0}/${run.summary.total || 0} matched`
        : "Reconciliation run summary",
      payload: run,
      status: run.status || "success",
    });
  } else if (type === "compliance") {
    const run = await ComplianceRun.findOne().sort({ createdAt: -1 }).lean();
    if (!run) return res.status(404).json({ error: "No compliance runs found" });
    report = await Report.create({
      type,
      title: "Compliance Report",
      summary: run.summary || `${(run.alerts || []).length} alerts`,
      payload: run,
      status: run.status || "success",
    });
  } else if (type === "risk") {
    const run = await RiskRun.findOne().sort({ createdAt: -1 }).lean();
    if (!run) return res.status(404).json({ error: "No risk runs found" });
    report = await Report.create({
      type,
      title: "Risk Report",
      summary: run.metrics?.var_95 ? `VaR: ${run.metrics.var_95}` : "Risk run summary",
      payload: run,
      status: run.status || "success",
    });
  } else {
    return res.status(400).json({ error: "type must be reconciliation, compliance, or risk" });
  }

  res.json(report);
});

module.exports = router;
