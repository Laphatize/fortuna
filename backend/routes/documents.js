// Enhance your existing documents.js route
const express = require('express');
const router = express.Router();
const Document = require('../models/Document');
const DocumentRun = require('../models/DocumentRun');
const dedalusService = require('../services/dedalusService');

// Your existing upload endpoint - ADD Dedalus processing
router.post('/upload', async (req, res) => {
  try {
    const { file, type } = req.body;

    // Create document (your existing logic)
    const document = new Document({
      type,
      filename: file.name,
      uploadedAt: new Date(),
      uploadedBy: req.user.id, // from auth
      status: 'pending',
      rawData: file
    });

    await document.save();

    // NEW: Start Dedalus multi-agent processing
    processDocumentWithDedalus(document._id);

    res.json({
      success: true,
      documentId: document._id,
      status: 'processing'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NEW: Process document with Dedalus (async)
async function processDocumentWithDedalus(documentId) {
  const startTime = Date.now();
  
  try {
    const document = await Document.findById(documentId);
    
    // Update status
    document.status = 'processing';
    await document.save();

    // Create DocumentRun for tracking
    const documentRun = new DocumentRun({
      documentId,
      status: 'running',
      startedAt: new Date(),
      agentWorkflow: {
        totalAgents: 3,
        completed: 0,
        agents: []
      }
    });
    await documentRun.save();

    // Run multi-agent analysis with Dedalus
    const analysis = await dedalusService.analyzeDocument(
      document.rawData,
      document.type
    );

    // Update document with results
    document.aiAnalysis = {
      extraction: analysis.extraction,
      compliance: analysis.compliance,
      risk: analysis.risk,
      consensus: analysis.consensus,
      agents: [
        {
          agentName: 'extraction-specialist',
          model: 'anthropic/claude-opus-4-5',
          result: analysis.extraction,
          confidence: 0.95,
          timestamp: new Date()
        },
        {
          agentName: 'compliance-checker',
          model: 'openai/gpt-4-turbo',
          result: analysis.compliance,
          confidence: 0.92,
          timestamp: new Date()
        },
        {
          agentName: 'risk-assessor',
          model: 'anthropic/claude-sonnet-4-5',
          result: analysis.risk,
          confidence: 0.88,
          timestamp: new Date()
        }
      ],
      processingTime: Date.now() - startTime
    };

    document.status = analysis.consensus === 'approved' ? 'completed' : 'flagged';
    await document.save();

    // Update DocumentRun
    documentRun.status = 'completed';
    documentRun.completedAt = new Date();
    documentRun.metrics = {
      totalProcessingTime: Date.now() - startTime
    };
    await documentRun.save();

    console.log(`Document ${documentId} processed with Dedalus`);
  } catch (error) {
    console.error('Dedalus processing error:', error);
    
    await Document.findByIdAndUpdate(documentId, {
      status: 'failed',
      error: error.message
    });
  }
}

// NEW: Get document with AI analysis
router.get('/:id', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      document,
      // Include AI analysis if available
      aiInsights: document.aiAnalysis ? {
        consensus: document.aiAnalysis.consensus,
        riskLevel: document.aiAnalysis.risk?.level,
        complianceStatus: document.aiAnalysis.compliance?.status,
        processingTime: document.aiAnalysis.processingTime
      } : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NEW: Get agent activity for a document
router.get('/:id/agent-activity', async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);
    
    res.json({
      thoughts: document.agentThoughts || [],
      agents: document.aiAnalysis?.agents || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;