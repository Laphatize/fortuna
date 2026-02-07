// Enhance your existing reconciliation.js
const express = require('express');
const router = express.Router();
const ReconciliationRun = require('../models/ReconciliationRun');
const dedalusService = require('../services/dedalusService');

// Your existing reconciliation endpoint - ADD Dedalus
router.post('/run', async (req, res) => {
  try {
    const { dataset } = req.body;

    // Create reconciliation run (your existing logic)
    const run = new ReconciliationRun({
      datasetId: dataset.id,
      status: 'running',
      startedAt: new Date()
    });
    await run.save();

    // NEW: Use Dedalus multi-agent analysis
    processReconciliationWithDedalus(run._id, dataset);

    res.json({
      success: true,
      runId: run._id,
      status: 'processing'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NEW: Dedalus-powered reconciliation analysis
async function processReconciliationWithDedalus(runId, dataset) {
  try {
    const run = await ReconciliationRun.findById(runId);

    // Multi-agent consensus on discrepancies
    const analysis = await dedalusService.analyzeReconciliation(dataset);

    // Update run with multi-agent results
    run.aiAnalysis = {
      agents: analysis.agents,
      consensus: analysis.consensus,
      recommendations: analysis.consensus.decision === 'approved' 
        ? 'Auto-resolve discrepancies'
        : 'Manual review required'
    };

    run.status = 'completed';
    run.completedAt = new Date();
    await run.save();

  } catch (error) {
    console.error('Reconciliation error:', error);
    await ReconciliationRun.findByIdAndUpdate(runId, {
      status: 'failed',
      error: error.message
    });
  }
}

module.exports = router;