const express = require("express");
const router = express.Router();
const openai = require("../lib/openai");
const RiskDataset = require("../models/RiskDataset");
const RiskRun = require("../models/RiskRun");

async function getOrCreateDataset() {
  let dataset = await RiskDataset.findOne();
  if (!dataset) dataset = await RiskDataset.create({ portfolio: [], scenarios: [] });
  return dataset;
}

// GET /api/risk/dataset
router.get("/dataset", async (_req, res) => {
  const dataset = await getOrCreateDataset();
  res.json(dataset);
});

// PUT /api/risk/dataset
router.put("/dataset", async (req, res) => {
  const { portfolio, scenarios } = req.body;
  if (!Array.isArray(portfolio) || !Array.isArray(scenarios)) {
    return res.status(400).json({ error: "portfolio and scenarios arrays required" });
  }
  const dataset = await getOrCreateDataset();
  dataset.portfolio = portfolio;
  dataset.scenarios = scenarios;
  await dataset.save();
  res.json(dataset);
});

// GET /api/risk/runs
router.get("/runs", async (_req, res) => {
  const runs = await RiskRun.find().sort({ createdAt: -1 }).lean();
  res.json(runs);
});

// POST /api/risk/analyze
router.post("/analyze", async (req, res) => {
  try {
    const { portfolio, scenarios } = req.body;

    if (!process.env.DEDALUS_API_KEY && !process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: "DEDALUS_API_KEY or OPENAI_API_KEY not set" });
    }

    const response = await openai.chat.completions.create({
      model: "openai/gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a financial risk assessment AI. Analyze the provided portfolio and run stress tests.
Evaluate:
- Value at Risk (VaR) at 95% confidence
- Expected Shortfall (CVaR)
- Portfolio Sharpe ratio estimate
- Maximum drawdown assessment
- Exposure concentration risk
- Stress test each scenario provided

Return a JSON object with:
- "metrics": object with "var_95" (dollar string), "expected_shortfall" (dollar string), "sharpe_ratio" (number string), "max_drawdown" (percentage string)
- "exposures": array of objects with "asset", "exposure", "percentage", "risk_level" (Low/Medium/High)
- "stress_tests": array of objects with "scenario", "impact" (dollar string), "severity" (high/medium/low), "detail"
- "recommendations": array of risk mitigation suggestions
Return ONLY valid JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Analyze this portfolio:\n${JSON.stringify(portfolio || [])}\n\nStress scenarios:\n${JSON.stringify(scenarios || [])}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    const dataset = await getOrCreateDataset();
    dataset.portfolio = portfolio || [];
    dataset.scenarios = scenarios || [];
    await dataset.save();
    const run = await RiskRun.create({
      datasetId: dataset._id,
      portfolio: portfolio || [],
      scenarios: scenarios || [],
      metrics: parsed.metrics || null,
      exposures: parsed.exposures || [],
      stressTests: parsed.stress_tests || [],
      recommendations: parsed.recommendations || [],
      status: "success",
    });

    res.json({ ...parsed, runId: run._id });
  } catch (error) {
    console.error("Risk analysis error:", error);
    await RiskRun.create({
      portfolio: req.body?.portfolio || [],
      scenarios: req.body?.scenarios || [],
      status: "error",
      error: error.message,
    });
    res.status(500).json({ error: "Failed to run risk analysis" });
  }
});

module.exports = router;
