// Backend service for Dedalus SDK integration
const { AsyncDedalus, DedalusRunner } = require('dedalus_labs');
require('dotenv').config();

class DedalusService {
  constructor() {
    this.client = new AsyncDedalus();
  }

  /**
   * Multi-agent document analysis
   */
  async analyzeDocument(documentData, documentType) {
    const runner = new DedalusRunner(this.client);

    try {
      // Agent 1: Extract structured data
      const extraction = await runner.run({
        input: `Extract all relevant data from this ${documentType}: ${JSON.stringify(documentData)}`,
        model: 'anthropic/claude-opus-4-5',
        tools: [this.extractTableData, this.validateFormat]
      });

      // Agent 2: Compliance check
      const compliance = await runner.run({
        input: `Check if this ${documentType} complies with company policies: ${extraction.final_output}`,
        model: 'openai/gpt-4-turbo',
        mcp_servers: ['compliance-rules-mcp']
      });

      // Agent 3: Risk assessment
      const risk = await runner.run({
        input: `Assess risk level for: ${extraction.final_output}`,
        model: 'anthropic/claude-sonnet-4-5'
      });

      return {
        extraction: extraction.final_output,
        compliance: compliance.final_output,
        risk: risk.final_output,
        consensus: this.determineConsensus(compliance, risk)
      };
    } catch (error) {
      console.error('Dedalus analysis error:', error);
      throw error;
    }
  }

  /**
   * Process document with streaming updates
   */
  async processDocumentStreaming(documentData, onThinking) {
    const runner = new DedalusRunner(this.client);

    const stream = runner.run({
      input: `Analyze this document and provide insights: ${JSON.stringify(documentData)}`,
      model: 'anthropic/claude-opus-4-5',
      stream: true
    });

    // Stream thoughts in real-time
    for await (const chunk of stream) {
      if (chunk.type === 'thinking') {
        onThinking(chunk.content);
      }
    }

    return stream.final_output;
  }

  /**
   * Multi-model reconciliation analysis
   */
  async analyzeReconciliation(reconciliationData) {
    const runner = new DedalusRunner(this.client);

    // Use multiple models for consensus
    const models = [
      'anthropic/claude-opus-4-5',
      'openai/gpt-4-turbo',
      'anthropic/claude-sonnet-4-5'
    ];

    const analyses = await Promise.all(
      models.map(async (model) => {
        const result = await runner.run({
          input: `Analyze these reconciliation discrepancies: ${JSON.stringify(reconciliationData)}`,
          model: model,
          tools: [this.calculateDiscrepancy, this.suggestResolution]
        });
        return {
          model,
          analysis: result.final_output,
          confidence: 0.95
        };
      })
    );

    return {
      agents: analyses,
      consensus: this.buildConsensus(analyses)
    };
  }

  /**
   * Compliance check with multiple agents
   */
  async checkCompliance(data) {
    const runner = new DedalusRunner(this.client);

    const result = await runner.run({
      input: `Check compliance for: ${JSON.stringify(data)}`,
      model: 'anthropic/claude-opus-4-5',
      mcp_servers: ['compliance-rules-mcp', 'regulatory-database-mcp'],
      tools: [this.checkRegulation, this.validatePolicy]
    });

    return result.final_output;
  }

  /**
   * Risk assessment agent
   */
  async assessRisk(data) {
    const runner = new DedalusRunner(this.client);

    const result = await runner.run({
      input: `Assess all risks for: ${JSON.stringify(data)}`,
      model: 'anthropic/claude-opus-4-5',
      tools: [this.calculateRiskScore, this.identifyRedFlags]
    });

    return result.final_output;
  }

  // Tool definitions
  extractTableData = (data) => {
    // Your existing table extraction logic
    return data;
  };

  validateFormat = (data) => {
    // Your existing validation logic
    return { valid: true };
  };

  calculateDiscrepancy = (data) => {
    // Your existing discrepancy calculation
    return { discrepancy: 0 };
  };

  suggestResolution = (discrepancy) => {
    // Your existing resolution logic
    return { suggestion: 'auto-resolve' };
  };

  checkRegulation = (data) => {
    // Check against regulations
    return { compliant: true };
  };

  validatePolicy = (data) => {
    // Check company policies
    return { valid: true };
  };

  calculateRiskScore = (data) => {
    // Risk scoring logic
    return { score: 0.2, level: 'low' };
  };

  identifyRedFlags = (data) => {
    // Identify issues
    return { flags: [] };
  };

  determineConsensus(compliance, risk) {
    // Logic to determine final decision
    if (compliance.final_output.includes('compliant') && risk.final_output.includes('low')) {
      return 'approved';
    }
    return 'review_required';
  }

  buildConsensus(analyses) {
    // Build consensus from multiple analyses
    const approvals = analyses.filter(a => 
      a.analysis.toLowerCase().includes('approve')
    ).length;

    return {
      decision: approvals >= 2 ? 'approved' : 'review_required',
      reasoning: `${approvals} out of ${analyses.length} agents recommend approval`
    };
  }
}

module.exports = new DedalusService();