// ─────────────────────────────────────────────
// RevGen — Relevant Agent Memory Retrieval (Day 1 Stage 5)
// ─────────────────────────────────────────────
//
// Responsibilities:
// 1. Deterministically queries `agent_memory` in PostgreSQL for historical merchant decisions
//    relevant to a given growth opportunity.
// 2. Scores relevance based on:
//    - Exact Product Pair match (Product A + Product B): Highest Priority (+5)
//    - Same Opportunity Type (+2)
//    - Same Opportunity Priority / Strength (+1)
// 3. Produces a compact, structured memory context suitable for Qwen3:8b and explainability contracts.
// 4. Guarantees:
//    - 100% READ-ONLY — zero writes to `agent_memory` or any other table during retrieval.
//    - Fail-safe — database connectivity errors gracefully return empty memory without crashing.
//    - Never passes raw customers, orders, or PII.
// ─────────────────────────────────────────────

const defaultPool = require('../db');

/**
 * Retrieves and formats relevant merchant decision memory for an opportunity.
 *
 * @param {Object} opportunity - Validated opportunity object.
 * @param {Object} [dbPool] - Optional database pool for dependency injection.
 * @returns {Promise<Object>} Structured memory context contract.
 */
async function getRelevantMemoryContext(opportunity, dbPool = defaultPool) {
  if (!opportunity || typeof opportunity !== 'object') {
    return buildEmptyMemoryContext();
  }

  const pAId = opportunity.productA ? opportunity.productA.id : null;
  const pBId = opportunity.productB ? opportunity.productB.id : null;
  const oppType = opportunity.type || 'cross_sell';
  const oppPriority = opportunity.priority || 'MEDIUM';
  const oppStrength = opportunity.opportunityStrength || 'STRONG';

  try {
    const res = await dbPool.query(
      `SELECT 
         id, campaign_id, product_a_id, product_b_id, opportunity_type, 
         opportunity_strength, priority, recommended_segment, final_segment, 
         recommended_discount, final_discount, recommended_budget, final_budget, 
         merchant_decision, decision_reason, created_at 
       FROM agent_memory 
       ORDER BY created_at DESC 
       LIMIT 50;`
    );

    const rows = res.rows || [];
    if (rows.length === 0) {
      return buildEmptyMemoryContext();
    }

    // Deterministic relevance scoring
    const scored = rows.map((m) => {
      let score = 0;
      const isExactPair = pAId && pBId && m.product_a_id === pAId && m.product_b_id === pBId;
      if (isExactPair) {
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
      return { ...m, isExactPair, relevanceScore: score };
    });

    const relevant = scored
      .filter((m) => m.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore || b.id - a.id)
      .slice(0, 5);

    if (relevant.length === 0) {
      return buildEmptyMemoryContext();
    }

    const approvedCount = relevant.filter((m) => m.merchant_decision === 'approved').length;
    const rejectedCount = relevant.filter((m) => m.merchant_decision === 'rejected').length;
    const submittedCount = relevant.filter((m) => m.merchant_decision === 'submitted').length;

    const insights = [];
    const exactPairMemory = relevant.find((m) => m.isExactPair);

    if (exactPairMemory) {
      const dec = exactPairMemory.merchant_decision.toUpperCase();
      const disc = exactPairMemory.final_discount ? `${exactPairMemory.final_discount}%` : 'default';
      insights.push(
        `Direct historical match: Merchant previously ${dec} a campaign for this exact product pair (Discount: ${disc}, Segment: ${exactPairMemory.final_segment}).`
      );
    }

    const lastApproved = relevant.find((m) => m.merchant_decision === 'approved');
    if (lastApproved && (!exactPairMemory || exactPairMemory.merchant_decision !== 'approved')) {
      insights.push(
        `Previous similar ${oppPriority} priority campaign was approved with ${lastApproved.final_discount}% discount.`
      );
    }

    const lastRejected = relevant.find((m) => m.merchant_decision === 'rejected');
    if (lastRejected) {
      const reasonSuffix = lastRejected.decision_reason ? ` (Reason: "${lastRejected.decision_reason}")` : '';
      insights.push(`Previous merchant feedback noted a rejection${reasonSuffix}.`);
    }

    const historicalDecisions = relevant.map((m) => ({
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

    const historicalContext = exactPairMemory
      ? `Merchant previously ${exactPairMemory.merchant_decision} this exact pair with ${exactPairMemory.final_discount}% discount and ₹${exactPairMemory.final_budget} budget.`
      : `Found ${relevant.length} relevant merchant decisions (${approvedCount} approved, ${rejectedCount} rejected) across similar ${oppPriority} priority opportunities.`;

    return {
      memoryAvailable: true,
      relevantDecisionCount: relevant.length,
      approvedCount,
      rejectedCount,
      submittedCount,
      summary: `Found ${relevant.length} relevant historical merchant decisions (${approvedCount} approved, ${rejectedCount} rejected).`,
      insights,
      historicalContext,
      historicalDecisions,
    };
  } catch (err) {
    console.warn('[Relevant Agent Memory] Error querying agent_memory table:', err.message);
    return buildEmptyMemoryContext();
  }
}

/**
 * Constructs a fallback/empty memory context contract when no historical decisions exist.
 *
 * @returns {Object} Empty memory context contract.
 */
function buildEmptyMemoryContext() {
  return {
    memoryAvailable: false,
    relevantDecisionCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    submittedCount: 0,
    summary: 'No relevant merchant decision history is available yet.',
    insights: [],
    historicalContext: 'No relevant merchant history found. Recommendation is based purely on current opportunity evidence.',
    historicalDecisions: [],
  };
}

module.exports = {
  getRelevantMemoryContext,
  buildEmptyMemoryContext,
};
