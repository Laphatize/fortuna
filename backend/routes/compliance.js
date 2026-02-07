const express = require("express");
const router = express.Router();
const { dedalus, openai, hasDedalus, hasOpenAI } = require("../lib/openai");
const ComplianceDataset = require("../models/ComplianceDataset");
const ComplianceRun = require("../models/ComplianceRun");
const Report = require("../models/Report");

async function getOrCreateDataset() {
  let dataset = await ComplianceDataset.findOne();
  if (!dataset) dataset = await ComplianceDataset.create({ entities: [], transactions: [] });
  return dataset;
}

// GET /api/compliance/dataset
router.get("/dataset", async (_req, res) => {
  const dataset = await getOrCreateDataset();
  res.json(dataset);
});

// PUT /api/compliance/dataset
router.put("/dataset", async (req, res) => {
  const { entities, transactions } = req.body;
  if (!Array.isArray(entities) || !Array.isArray(transactions)) {
    return res.status(400).json({ error: "entities and transactions arrays required" });
  }
  const dataset = await getOrCreateDataset();
  dataset.entities = entities;
  dataset.transactions = transactions;
  await dataset.save();
  res.json(dataset);
});

// GET /api/compliance/runs
router.get("/runs", async (_req, res) => {
  const runs = await ComplianceRun.find().sort({ createdAt: -1 }).lean();
  res.json(runs);
});

// POST /api/compliance/scan
router.post("/scan", async (req, res) => {
  try {
    const { entities, transactions } = req.body;

    if (!hasDedalus && !hasOpenAI) {
      return res.status(500).json({ error: "DEDALUS_API_KEY or OPENAI_API_KEY not set" });
    }

    const primary = hasDedalus ? dedalus : openai;
    const secondary = hasDedalus && hasOpenAI ? openai : null;
    const primaryModel = hasDedalus ? "openai/gpt-4o-mini" : "gpt-4o-mini";

    const callModel = async (client, model) =>
      client.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: `You are a financial compliance AI. Analyze the provided entities and transactions for regulatory compliance issues.
Check for:
- AML (Anti-Money Laundering) red flags
- KYC (Know Your Customer) issues
- OFAC sanctions screening concerns
- SOX (Sarbanes-Oxley) control violations
- Regulation W affiliate transaction limits
- Unusual transaction patterns

Return a JSON object with:
- "alerts": array of objects with "id" (generate CMP-xxx), "rule", "entity", "severity" (high/medium/low), "detail", "recommended_action"
- "regulatory_scores": array of objects with "regulation", "score" (0-100), "status" (Compliant/Action Required/Monitoring)
- "summary": brief overall compliance assessment
Return ONLY valid JSON, no markdown.`,
          },
          {
            role: "user",
            content: `Scan these for compliance issues:\n\nEntities: ${JSON.stringify(entities || [])}\n\nTransactions: ${JSON.stringify(transactions || [])}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      });

    let response;
    try {
      response = await callModel(primary, primaryModel);
    } catch (err) {
      if (err?.status === 401 && secondary) {
        response = await callModel(secondary, "gpt-4o-mini");
      } else {
        throw err;
      }
    }

    const parsed = JSON.parse(response.choices[0].message.content);
    const dataset = await getOrCreateDataset();
    dataset.entities = entities || [];
    dataset.transactions = transactions || [];
    await dataset.save();
    const run = await ComplianceRun.create({
      datasetId: dataset._id,
      entities: entities || [],
      transactions: transactions || [],
      alerts: parsed.alerts || [],
      regulatoryScores: parsed.regulatory_scores || [],
      summary: parsed.summary || "",
      status: "success",
    });

    await Report.create({
      type: "compliance",
      title: "Compliance Report",
      summary: parsed.summary || `${(parsed.alerts || []).length} alerts`,
      payload: run,
      status: "success",
    });

    res.json({ ...parsed, runId: run._id });
  } catch (error) {
    console.error("Compliance scan error:", error);
    await ComplianceRun.create({
      entities: req.body?.entities || [],
      transactions: req.body?.transactions || [],
      status: "error",
      error: error.message,
    });
    await Report.create({
      type: "compliance",
      title: "Compliance Report (Error)",
      summary: error.message,
      payload: { entities: req.body?.entities || [], transactions: req.body?.transactions || [] },
      status: "error",
    });
    res.status(error.status || 500).json({ error: error.message || "Failed to run compliance scan" });
  }
});

module.exports = router;
