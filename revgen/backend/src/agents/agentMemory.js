// ─────────────────────────────────────────────
// RevGen — AI Growth Agent Memory Module (Day 6 Stage 3)
// ─────────────────────────────────────────────
//
// Records and queries historical merchant decisions from PostgreSQL.
//
// CRITICAL ARCHITECTURAL GUARANTEES:
// 1. Merchant Memory is recorded ONLY on explicit merchant actions (Submit, Approve, Reject, Reset).
// 2. Preview APIs (growth-preview, growth-recommendation-preview, pipeline) remain 100% READ-ONLY.
// 3. Historical Merchant Context is INFORMATIONAL ONLY and NEVER overrides current analytics or safety guardrails.
// 4. Zero LLM / Zero Machine Learning — Pure deterministic relevance scoring and transparent context formatting.
// ─────────────────────────────────────────────

const pool = require('../db');

/**
 * Records an explicit merchant decision into the agent_memory table.
 * Includes duplicate protection to prevent identical writes within 10 seconds.
 *
 * @param {Object} data - Memory details.
 * @returns {Promise<Object>} Inserted memory record.
 */
async function recordMerchantDecision(data) {
  const {
    campaignId,
    productAId,
    productBId,
    opportunityType = 'cross_sell',
    opportunityStrength = 'STRONG',
    priority = 'MEDIUM',
    recommendedSegment = 'regular',
    finalSegment = 'regular',
    recommendedDiscount = 10,
    finalDiscount = 10,
    recommendedBudget = 5000,
    finalBudget = 5000,
    merchantDecision,
    decisionReason = null,
  } = data;

  if (!merchantDecision || !['submitted', 'approved', 'rejected', 'reset'].includes(merchantDecision)) {
    throw new Error('Invalid merchantDecision: Must be submitted, approved, rejected, or reset.');
  }

  // Duplicate Check: Prevent duplicate record within last 10 seconds
  if (campaignId) {
    const dupCheck = await pool.query(
      `SELECT id FROM agent_memory 
       WHERE campaign_id = $1 
         AND merchant_decision = $2 
         AND created_at > NOW() - INTERVAL '10 seconds'`,
      [campaignId, merchantDecision]
    );

    if (dupCheck.rows.length > 0) {
      // Duplicate entry detected, return existing ID gracefully
      return { id: dupCheck.rows[0].id, duplicate: true };
    }
  }

  const query = `
    INSERT INTO agent_memory (
      campaign_id,
      product_a_id,
      product_b_id,
      opportunity_type,
      opportunity_strength,
      priority,
      recommended_segment,
      final_segment,
      recommended_discount,
      final_discount,
      recommended_budget,
      final_budget,
      merchant_decision,
      decision_reason
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *;
  `;

  const values = [
    campaignId || null,
    productAId || null,
    productBId || null,
    opportunityType,
    opportunityStrength,
    priority,
    recommendedSegment,
    finalSegment,
    recommendedDiscount,
    finalDiscount,
    recommendedBudget,
    finalBudget,
    merchantDecision,
    decisionReason,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Retrieves relevant historical merchant decision memories for an opportunity.
 * Uses a deterministic relevance scoring system:
 * - Same product pair: +5
 * - Same opportunity type: +2
 * - Same priority: +1
 * - Same opportunity strength: +1
 *
 * @param {Object} opportunity - Current opportunity object.
 * @returns {Promise<Array<Object>>} Array of relevant memory objects sorted by relevance.
 */
async function getRelevantMemory(opportunity) {
  if (!opportunity || typeof opportunity !== 'object') {
    return [];
  }

  const pAId = opportunity.productA ? opportunity.productA.id : null;
  const pBId = opportunity.productB ? opportunity.productB.id : null;
  const oppType = opportunity.type || 'cross_sell';
  const oppPriority = opportunity.priority || 'MEDIUM';
  const oppStrength = opportunity.opportunityStrength || 'STRONG';

  try {
    const res = await pool.query(
      `SELECT * FROM agent_memory ORDER BY created_at DESC LIMIT 50;`
    );

    const allMemories = res.rows;
    if (allMemories.length === 0) return [];

    // Calculate deterministic relevance score for each memory
    const scoredMemories = allMemories.map((m) => {
      let score = 0;
      if (pAId && pBId && m.product_a_id === pAId && m.product_b_id === pBId) {
        score += 5;
      }
      if (m.opportunity_type === oppType) {
        score += 2;
      }
      if (m.priority === oppPriority) {
        score += 1;
      }
      if (m.opportunity_strength === oppStrength) {
        score += 1;
      }
      return { ...m, relevanceScore: score };
    });

    // Filter memories with relevanceScore > 0 and sort by relevance score descending
    return scoredMemories
      .filter((m) => m.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore || b.id - a.id)
      .slice(0, 5);
  } catch (err) {
    console.warn('Could not query agent_memory table:', err.message);
    return [];
  }
}

/**
 * Summarizes an array of relevant memory records into a merchant-friendly context structure.
 *
 * @param {Array<Object>} memories - Relevant memory records.
 * @returns {Object} Structured memory summary.
 */
function summarizeMemory(memories) {
  if (!Array.isArray(memories) || memories.length === 0) {
    return {
      available: false,
      relevantMemoryCount: 0,
      summary: 'No relevant merchant decision history is available yet.',
      insights: [],
      historicalDecisions: [],
    };
  }

  const insights = [];
  const approvedCount = memories.filter((m) => m.merchant_decision === 'approved').length;
  const rejectedCount = memories.filter((m) => m.merchant_decision === 'rejected').length;

  if (approvedCount > 0) {
    const lastApp = memories.find((m) => m.merchant_decision === 'approved');
    insights.push(
      `Previous similar campaign (#${lastApp.campaign_id || 'draft'}) was approved with a ${lastApp.final_discount}% discount and ${lastApp.final_segment} segment.`
    );
  }

  if (rejectedCount > 0) {
    const lastRej = memories.find((m) => m.merchant_decision === 'rejected');
    const reasonText = lastRej.decision_reason ? ` (Reason: "${lastRej.decision_reason}")` : '';
    insights.push(`Previous similar campaign was rejected by merchant${reasonText}.`);
  }

  const formattedDecisions = memories.map((m) => ({
    campaignId: m.campaign_id,
    productAId: m.product_a_id,
    productBId: m.product_b_id,
    merchantDecision: m.merchant_decision,
    finalSegment: m.final_segment,
    finalDiscount: parseFloat(m.final_discount || 0),
    finalBudget: parseFloat(m.final_budget || 0),
    decisionReason: m.decision_reason,
    createdAt: m.created_at,
  }));

  return {
    available: true,
    relevantMemoryCount: memories.length,
    summary: `Found ${memories.length} relevant historical merchant decisions (${approvedCount} approved, ${rejectedCount} rejected).`,
    insights,
    historicalDecisions: formattedDecisions,
  };
}

module.exports = {
  recordMerchantDecision,
  getRelevantMemory,
  summarizeMemory,
};
