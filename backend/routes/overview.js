const express = require("express");
const router = express.Router();
const { dedalus, openai, hasDedalus, hasOpenAI } = require("../lib/openai");
const Document = require("../models/Document");
const ReconciliationRun = require("../models/ReconciliationRun");
const ReconciliationDataset = require("../models/ReconciliationDataset");
const ReconciliationResolution = require("../models/ReconciliationResolution");
const ComplianceRun = require("../models/ComplianceRun");
const ComplianceDataset = require("../models/ComplianceDataset");
const RiskRun = require("../models/RiskRun");
const RiskDataset = require("../models/RiskDataset");
const Report = require("../models/Report");

async function gatherContext() {
  const [
    docCount,
    processedDocs,
    reconDataset,
    reconRuns,
    complianceRuns,
    complianceDataset,
    riskRuns,
    riskDataset,
    resolutionCount,
    recentReports,
  ] = await Promise.all([
    Document.countDocuments(),
    Document.countDocuments({ status: "processed" }),
    ReconciliationDataset.findOne().lean(),
    ReconciliationRun.find().sort({ createdAt: -1 }).limit(3).lean(),
    ComplianceRun.find().sort({ createdAt: -1 }).limit(3).lean(),
    ComplianceDataset.findOne().lean(),
    RiskRun.find().sort({ createdAt: -1 }).limit(3).lean(),
    RiskDataset.findOne().lean(),
    ReconciliationResolution.countDocuments(),
    Report.find().sort({ createdAt: -1 }).limit(10).lean(),
  ]);

  const transactionsProcessed = (reconDataset?.transactions || []).length;

  let complianceScore = null;
  if (complianceRuns.length > 0) {
    const scores = complianceRuns[0].regulatoryScores || [];
    if (scores.length > 0) {
      complianceScore = Math.round(
        scores.reduce((sum, s) => sum + (s.score || 0), 0) / scores.length
      );
    }
  }

  let openExceptions = 0;
  if (reconRuns.length > 0) {
    openExceptions = (reconRuns[0].results || []).filter(
      (r) => r.status === "exception"
    ).length;
  }

  const activity = recentReports.map((r) => ({
    action: r.title,
    detail: r.summary || "",
    time: formatTimeAgo(r.createdAt),
    status: r.status === "error" ? "error" : r.type === "compliance" ? "warning" : "success",
    type: r.type,
  }));

  // Build context string for AI
  const contextParts = [];
  contextParts.push(`Documents: ${docCount} total, ${processedDocs} processed.`);
  contextParts.push(`Reconciliation: ${transactionsProcessed} transactions loaded, ${openExceptions} open exceptions, ${resolutionCount} resolutions.`);

  if (reconRuns.length > 0) {
    const latest = reconRuns[0];
    const summary = latest.summary;
    if (summary) {
      contextParts.push(`Latest reconciliation: ${summary.matched || 0}/${summary.total || 0} matched, ${summary.exceptions || 0} exceptions.`);
    }
    if (latest.recommendations?.length) {
      contextParts.push(`Reconciliation recommendations: ${latest.recommendations.join("; ")}`);
    }
  }

  if (complianceScore !== null) {
    contextParts.push(`Compliance score: ${complianceScore}%.`);
  }
  if (complianceRuns.length > 0) {
    const latest = complianceRuns[0];
    if (latest.summary) contextParts.push(`Compliance assessment: ${latest.summary}`);
    if (latest.alerts?.length) {
      contextParts.push(`Active compliance alerts (${latest.alerts.length}): ${latest.alerts.map(a => `${a.rule} [${a.severity}] - ${a.entity}`).join("; ")}`);
    }
    if (latest.regulatoryScores?.length) {
      contextParts.push(`Regulatory scores: ${latest.regulatoryScores.map(s => `${s.regulation}: ${s.score}% (${s.status})`).join(", ")}`);
    }
  }

  if ((complianceDataset?.entities || []).length) {
    contextParts.push(`Compliance entities: ${complianceDataset.entities.map(e => `${e.name} (${e.type}, ${e.jurisdiction || "N/A"})`).join("; ")}`);
  }

  if (riskRuns.length > 0) {
    const latest = riskRuns[0];
    if (latest.metrics) {
      contextParts.push(`Latest risk metrics: VaR(95%) ${latest.metrics.var_95 || "N/A"}, Expected Shortfall ${latest.metrics.expected_shortfall || "N/A"}, Sharpe ${latest.metrics.sharpe_ratio || "N/A"}, Max Drawdown ${latest.metrics.max_drawdown || "N/A"}.`);
    }
    if (latest.recommendations?.length) {
      contextParts.push(`Risk recommendations: ${latest.recommendations.join("; ")}`);
    }
  }

  if ((riskDataset?.portfolio || []).length) {
    contextParts.push(`Portfolio: ${riskDataset.portfolio.map(p => `${p.asset}: ${p.exposure} (${p.percentage}%)`).join(", ")}`);
  }

  if (activity.length) {
    contextParts.push(`Recent activity: ${activity.slice(0, 5).map(a => `${a.action} - ${a.detail} (${a.time})`).join("; ")}`);
  }

  return {
    stats: {
      transactions_processed: transactionsProcessed,
      compliance_score: complianceScore,
      open_exceptions: openExceptions,
      documents_processed: processedDocs,
    },
    activity,
    contextString: contextParts.join("\n"),
  };
}

// GET /api/overview
router.get("/", async (_req, res) => {
  try {
    const { stats, activity } = await gatherContext();
    res.json({ stats, activity });
  } catch (error) {
    console.error("Overview error:", error);
    res.status(500).json({ error: "Failed to load overview" });
  }
});

// POST /api/overview/chat
router.post("/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: "message required" });

    if (!hasDedalus && !hasOpenAI) {
      return res.status(500).json({ error: "DEDALUS_API_KEY or OPENAI_API_KEY not set" });
    }

    const { contextString } = await gatherContext();

    const chatClient = dedalus || openai;
    const chatModel = hasDedalus ? "openai/gpt-4o-mini" : "gpt-4o-mini";

    const messages = [
      {
        role: "system",
        content: `You are Assisto, an AI assistant for back-office financial operations. You have access to the user's current operational data below. Answer questions about their reconciliation status, compliance alerts, risk metrics, documents, and general operations. Be concise, specific, and reference actual data. If asked to perform an action, explain which page in the dashboard they should navigate to.

Current operational context:
${contextString}`,
      },
      ...(history || []).map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    const response = await chatClient.chat.completions.create({
      model: chatModel,
      messages,
      temperature: 0.3,
    });

    const answer = response.choices[0].message.content;
    res.json({ answer });
  } catch (error) {
    console.error("Overview chat error:", error);
    res.status(500).json({ error: "Failed to process chat" });
  }
});

function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

module.exports = router;
