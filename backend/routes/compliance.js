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

// ============================================
// NEW: Multi-Agent Compliance Analysis
// ============================================

/**
 * Run multiple specialized compliance agents in parallel
 * Each agent focuses on different regulatory areas
 */
async function runMultiAgentComplianceScan(entities, transactions) {
  if (!hasDedalus && !hasOpenAI) {
    return null;
  }

  const chatClient = dedalus || openai;
  
  try {
    // Agent 1: AML & Sanctions Specialist
    const amlPromise = chatClient.chat.completions.create({
      model: hasDedalus ? "anthropic/claude-opus-4-5" : "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an AML (Anti-Money Laundering) and sanctions compliance expert.
Focus on:
- OFAC sanctions list screening
- Suspicious transaction patterns (structuring, rapid movement)
- High-risk jurisdictions
- PEP (Politically Exposed Persons) identification
- Unusual cash transactions

Return JSON with:
- "alerts": array of {id, type, entity, severity, detail, recommended_action}
- "risk_score": 0-100
- "sanctions_hits": array of potential matches
- "summary": brief assessment`
        },
        {
          role: "user",
          content: `Analyze for AML/Sanctions issues:\nEntities: ${JSON.stringify(entities?.slice(0, 20) || [])}\nTransactions: ${JSON.stringify(transactions?.slice(0, 50) || [])}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    // Agent 2: KYC & Entity Risk Specialist
    const kycPromise = chatClient.chat.completions.create({
      model: hasDedalus ? "anthropic/claude-sonnet-4-5" : "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a KYC (Know Your Customer) compliance expert.
Focus on:
- Missing or expired KYC documentation
- Entity verification issues
- Beneficial ownership transparency
- Customer due diligence gaps
- Enhanced due diligence triggers

Return JSON with:
- "alerts": array of {id, type, entity, severity, detail, recommended_action}
- "kyc_gaps": array of entities with issues
- "risk_score": 0-100
- "summary": brief assessment`
        },
        {
          role: "user",
          content: `Check KYC compliance:\nEntities: ${JSON.stringify(entities || [])}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    // Agent 3: Transaction Monitoring Specialist
    const transactionPromise = chatClient.chat.completions.create({
      model: hasDedalus ? "openai/gpt-4o-mini" : "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a transaction monitoring compliance expert.
Focus on:
- SOX (Sarbanes-Oxley) controls
- Regulation W affiliate transaction limits
- Unusual transaction patterns
- Authorization breaches
- Segregation of duties violations
- Transaction velocity anomalies

Return JSON with:
- "alerts": array of {id, type, transaction_id, severity, detail, recommended_action}
- "pattern_anomalies": array of suspicious patterns
- "risk_score": 0-100
- "summary": brief assessment`
        },
        {
          role: "user",
          content: `Monitor transactions:\nTransactions: ${JSON.stringify(transactions || [])}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    // Run all agents in parallel
    console.log('🤖 Running 3 compliance agents in parallel...');
    const [amlResponse, kycResponse, transactionResponse] = await Promise.all([
      amlPromise,
      kycPromise,
      transactionPromise
    ]);

    const amlResult = JSON.parse(amlResponse.choices[0].message.content);
    const kycResult = JSON.parse(kycResponse.choices[0].message.content);
    const transactionResult = JSON.parse(transactionResponse.choices[0].message.content);

    // Combine all alerts
    const allAlerts = [
      ...(amlResult.alerts || []).map(a => ({ ...a, source: 'AML Agent' })),
      ...(kycResult.alerts || []).map(a => ({ ...a, source: 'KYC Agent' })),
      ...(transactionResult.alerts || []).map(a => ({ ...a, source: 'Transaction Agent' }))
    ];

    // Calculate overall risk scores
    const avgRiskScore = Math.round(
      ((amlResult.risk_score || 0) + (kycResult.risk_score || 0) + (transactionResult.risk_score || 0)) / 3
    );

    // Determine regulatory compliance status
    const regulatoryScores = [
      {
        regulation: "AML/BSA",
        score: 100 - (amlResult.risk_score || 0),
        status: (amlResult.risk_score || 0) < 30 ? "Compliant" : (amlResult.risk_score || 0) < 70 ? "Monitoring" : "Action Required",
        agent_summary: amlResult.summary
      },
      {
        regulation: "KYC/CDD",
        score: 100 - (kycResult.risk_score || 0),
        status: (kycResult.risk_score || 0) < 30 ? "Compliant" : (kycResult.risk_score || 0) < 70 ? "Monitoring" : "Action Required",
        agent_summary: kycResult.summary
      },
      {
        regulation: "SOX/Transaction Controls",
        score: 100 - (transactionResult.risk_score || 0),
        status: (transactionResult.risk_score || 0) < 30 ? "Compliant" : (transactionResult.risk_score || 0) < 70 ? "Monitoring" : "Action Required",
        agent_summary: transactionResult.summary
      }
    ];

    // Multi-agent consensus summary
    const criticalAlerts = allAlerts.filter(a => a.severity === 'high').length;
    const overallStatus = avgRiskScore < 30 ? "Compliant" : avgRiskScore < 70 ? "Monitoring Required" : "Immediate Action Required";

    return {
      agents: [
        {
          name: 'AML & Sanctions Agent',
          model: hasDedalus ? "anthropic/claude-opus-4-5" : "gpt-4o-mini",
          result: amlResult,
          timestamp: new Date()
        },
        {
          name: 'KYC Agent',
          model: hasDedalus ? "anthropic/claude-sonnet-4-5" : "gpt-4o-mini",
          result: kycResult,
          timestamp: new Date()
        },
        {
          name: 'Transaction Monitoring Agent',
          model: hasDedalus ? "openai/gpt-4o-mini" : "gpt-4o-mini",
          result: transactionResult,
          timestamp: new Date()
        }
      ],
      consolidatedAlerts: allAlerts,
      regulatoryScores: regulatoryScores,
      riskMetrics: {
        overall_risk_score: avgRiskScore,
        aml_risk: amlResult.risk_score || 0,
        kyc_risk: kycResult.risk_score || 0,
        transaction_risk: transactionResult.risk_score || 0,
        critical_alerts: criticalAlerts,
        total_alerts: allAlerts.length
      },
      consensus: {
        status: overallStatus,
        summary: `Multi-agent analysis complete: ${criticalAlerts} critical alerts identified. Overall risk score: ${avgRiskScore}/100. Status: ${overallStatus}.`
      },
      specializedFindings: {
        sanctions_hits: amlResult.sanctions_hits || [],
        kyc_gaps: kycResult.kyc_gaps || [],
        pattern_anomalies: transactionResult.pattern_anomalies || []
      }
    };

  } catch (error) {
    console.error('Multi-agent compliance error:', error);
    return null;
  }
}

/**
 * Generate compliance recommendations using AI
 */
async function generateComplianceRecommendations(multiAgentAnalysis) {
  if (!multiAgentAnalysis || (!hasDedalus && !hasOpenAI)) {
    return [];
  }

  const chatClient = dedalus || openai;

  try {
    const response = await chatClient.chat.completions.create({
      model: hasDedalus ? "anthropic/claude-opus-4-5" : "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a compliance consultant. Based on findings, provide actionable recommendations. Return JSON with 'recommendations' array of {priority, action, rationale}."
        },
        {
          role: "user",
          content: `Generate recommendations based on: ${JSON.stringify(multiAgentAnalysis.consensus)}\nAlerts: ${multiAgentAnalysis.riskMetrics.total_alerts}`
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const result = JSON.parse(response.choices[0].message.content);
    return result.recommendations || [];
  } catch (error) {
    console.error('Recommendations generation error:', error);
    return [];
  }
}

// ============================================
// Existing Routes (Enhanced)
// ============================================

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

// ============================================
// ENHANCED: POST /api/compliance/scan
// ============================================
router.post("/scan", async (req, res) => {
  try {
    const { entities, transactions, useMultiAgent = true } = req.body;

    if (!hasDedalus && !hasOpenAI) {
      return res.status(500).json({ error: "DEDALUS_API_KEY or OPENAI_API_KEY not set" });
    }

    let multiAgentAnalysis = null;
    let parsed = null;

    // NEW: Multi-agent analysis path
    if (useMultiAgent && (hasDedalus || hasOpenAI)) {
      console.log('🚀 Starting multi-agent compliance scan...');
      multiAgentAnalysis = await runMultiAgentComplianceScan(entities, transactions);
      
      if (multiAgentAnalysis) {
        console.log(`✅ Multi-agent scan complete: ${multiAgentAnalysis.riskMetrics.total_alerts} alerts found`);
        
        // Generate AI recommendations
        const recommendations = await generateComplianceRecommendations(multiAgentAnalysis);
        
        // Use multi-agent results
        parsed = {
          alerts: multiAgentAnalysis.consolidatedAlerts,
          regulatory_scores: multiAgentAnalysis.regulatoryScores,
          summary: multiAgentAnalysis.consensus.summary,
          risk_metrics: multiAgentAnalysis.riskMetrics,
          specialized_findings: multiAgentAnalysis.specializedFindings,
          recommendations: recommendations,
          multi_agent: true
        };
      }
    }

    // Fallback to original single-agent scan
    if (!parsed) {
      console.log('📋 Running standard compliance scan...');
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

      parsed = JSON.parse(response.choices[0].message.content);
      parsed.multi_agent = false;
    }

    // Save to dataset
    const dataset = await getOrCreateDataset();
    dataset.entities = entities || [];
    dataset.transactions = transactions || [];
    await dataset.save();

    // Create compliance run
    const run = await ComplianceRun.create({
      datasetId: dataset._id,
      entities: entities || [],
      transactions: transactions || [],
      alerts: parsed.alerts || [],
      regulatoryScores: parsed.regulatory_scores || [],
      summary: parsed.summary || "",
      status: "success",
      multiAgentAnalysis: multiAgentAnalysis, // NEW: Store multi-agent results
      riskMetrics: parsed.risk_metrics, // NEW: Store risk metrics
      recommendations: parsed.recommendations, // NEW: Store recommendations
    });

    // Create report
    await Report.create({
      type: "compliance",
      title: multiAgentAnalysis 
        ? "Multi-Agent Compliance Report" 
        : "Compliance Report",
      summary: parsed.summary || `${(parsed.alerts || []).length} alerts`,
      payload: run,
      status: "success",
      multiAgent: !!multiAgentAnalysis, // NEW: Flag for multi-agent reports
    });

    res.json({ 
      ...parsed, 
      runId: run._id,
      analysis_type: multiAgentAnalysis ? 'multi-agent' : 'single-agent'
    });
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

// ============================================
// NEW: Get detailed multi-agent analysis
// ============================================
router.get("/runs/:id/analysis", async (req, res) => {
  try {
    const run = await ComplianceRun.findById(req.params.id).lean();
    if (!run) return res.status(404).json({ error: "Run not found" });
    
    res.json({
      runId: run._id,
      status: run.status,
      summary: run.summary,
      alerts: run.alerts || [],
      regulatoryScores: run.regulatoryScores || [],
      multiAgentAnalysis: run.multiAgentAnalysis || null,
      riskMetrics: run.riskMetrics || null,
      recommendations: run.recommendations || [],
      createdAt: run.createdAt
    });
  } catch (error) {
    console.error("Analysis fetch error:", error);
    res.status(500).json({ error: "Failed to fetch analysis" });
  }
});

// ============================================
// NEW: Get risk dashboard metrics
// ============================================
router.get("/dashboard", async (req, res) => {
  try {
    const latestRun = await ComplianceRun.findOne({ status: "success" })
      .sort({ createdAt: -1 })
      .lean();
    
    if (!latestRun) {
      return res.json({
        hasData: false,
        message: "No compliance scans run yet"
      });
    }

    const totalAlerts = latestRun.alerts?.length || 0;
    const criticalAlerts = latestRun.alerts?.filter(a => a.severity === 'high')?.length || 0;
    
    res.json({
      hasData: true,
      latestScan: {
        runId: latestRun._id,
        timestamp: latestRun.createdAt,
        summary: latestRun.summary
      },
      metrics: {
        total_alerts: totalAlerts,
        critical_alerts: criticalAlerts,
        regulatory_scores: latestRun.regulatoryScores || [],
        risk_metrics: latestRun.riskMetrics || null
      },
      multiAgent: !!latestRun.multiAgentAnalysis,
      recommendations: latestRun.recommendations || []
    });
  } catch (error) {
    console.error("Dashboard fetch error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
});

module.exports = router;