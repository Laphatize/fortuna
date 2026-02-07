// Enhance your existing DocumentRun.js
const mongoose = require('mongoose');

const DocumentRunSchema = new mongoose.Schema({
  // Your existing fields...
  documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
  status: String,
  startedAt: Date,
  completedAt: Date,

  // NEW: Add multi-agent workflow tracking
  agentWorkflow: {
    currentAgent: String,
    totalAgents: Number,
    completed: Number,
    
    agents: [{
      name: String,
      model: String,
      startedAt: Date,
      completedAt: Date,
      status: String,
      result: mongoose.Schema.Types.Mixed,
      toolsUsed: [String],
      mcpServersUsed: [String]
    }]
  },

  // NEW: Real-time streaming data
  streamingThoughts: [{
    timestamp: Date,
    agent: String,
    content: String
  }],

  // Performance metrics
  metrics: {
    totalProcessingTime: Number,
    tokenUsage: {
      total: Number,
      byModel: mongoose.Schema.Types.Mixed
    },
    cost: Number
  }
});

module.exports = mongoose.model('DocumentRun', DocumentRunSchema);