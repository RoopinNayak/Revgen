// ─────────────────────────────────────────────
// RevGen — Growth Agent Campaign Recommendation Module (Day 6 Stage 3)
// ─────────────────────────────────────────────
//
// Pipeline:
// Opportunity Analytics → Growth Agent Analysis → Recommendation Engine → Guardrails
//
// Integrates AI Growth Agent analytical reasoning with safe, bounded
// campaign recommendations, explicit decision rationales, and Historical Merchant Context.
//
// Safety Guardrails:
// - Max Discount: 20% (Strictly enforced)
// - Max Budget Limit: ₹5,000 (Strictly enforced)
// - Merchant Approval Required: true
// - Auto Execution Allowed: false
// ─────────────────────────────────────────────

const { runGrowthAgent } = require('./growthAgent');

const MAX_DISCOUNT_PERCENT = 20;
const MAX_CAMPAIGN_BUDGET = 5000;

/**
 * Generates a Growth Agent powered campaign recommendation with explicit decision rationale and memory context.
 *
 * @param {Object} opportunity - Opportunity object from analytics pipeline.
 * @param {Object} [memorySummary] - Optional pre-summarized merchant decision memory.
 * @returns {Object} Structured contract combining Growth Agent analysis, recommendation proposal, rationale, evidence, memory, and guardrails.
 */
function generateGrowthRecommendation(opportunity, memorySummary = null) {
  if (!opportunity || typeof opportunity !== 'object') {
    throw new Error('Invalid opportunity: Opportunity object is required.');
  }

  if (!opportunity.productA || !opportunity.productB) {
    throw new Error('Invalid opportunity: Valid productA and productB objects are required.');
  }

  // 1. Run Growth Agent Analytical Layer
  const agentResult = runGrowthAgent(opportunity);
  const oppData = agentResult.opportunity;
  const analysisData = agentResult.analysis;

  const pA = oppData.productA;
  const pB = oppData.productB;

  // 2. Campaign Recommendation Engine Rules
  const type = 'cross_sell';

  // Target customer segment rule & rationale
  let targetSegment = 'regular';
  let segmentReason = '';

  if (pB.price >= 200) {
    targetSegment = 'premium';
    segmentReason = `Premium segment selected because target product price (₹${pB.price.toFixed(2)}) exceeds the ₹200 premium threshold.`;
  } else if (pB.price >= 50) {
    targetSegment = 'regular';
    segmentReason = `Regular segment selected because target product price (₹${pB.price.toFixed(2)}) falls in the ₹50–₹200 regular range.`;
  } else {
    targetSegment = 'all';
    segmentReason = `All segment selected because target product (₹${pB.price.toFixed(2)}) is an accessible impulse purchase.`;
  }

  // Bounded discount percent rule & rationale
  let recommendedDiscount = 10;
  let discountReason = '';

  if (analysisData.priority === 'HIGH' || analysisData.opportunityStrength === 'VERY_STRONG') {
    recommendedDiscount = 10;
    discountReason = '10% promotional discount proposed for HIGH priority opportunity to maximize customer conversion while preserving merchant margin.';
  } else if (analysisData.priority === 'MEDIUM' || analysisData.opportunityStrength === 'STRONG') {
    recommendedDiscount = 10;
    discountReason = '10% promotional discount proposed for MEDIUM priority opportunity to incentivize co-purchase behavior.';
  } else {
    recommendedDiscount = 5;
    discountReason = 'Conservative 5% promotional discount proposed for LOW priority opportunity to test customer conversion safely.';
  }

  // HARD SAFETY CLAMP (0 to 20%)
  const discountPercent = Math.min(MAX_DISCOUNT_PERCENT, Math.max(0, recommendedDiscount));

  // Bounded budget limit rule & rationale
  let recommendedBudget = 5000;
  let budgetReason = '';

  if (oppData.estimatedRevenueOpportunity && oppData.estimatedRevenueOpportunity > 0) {
    const estVal = Math.round((oppData.estimatedRevenueOpportunity * 0.08) / 500) * 500;
    recommendedBudget = Math.min(MAX_CAMPAIGN_BUDGET, Math.max(1000, estVal));
    budgetReason = `Budget limit of ₹${recommendedBudget.toLocaleString('en-IN')} proposed based on an 8% expected yield from ₹${oppData.estimatedRevenueOpportunity.toFixed(2)} estimated revenue opportunity, clamped to the ₹5,000 safety ceiling.`;
  } else {
    budgetReason = 'Default ₹5,000 safety budget limit assigned.';
  }

  // HARD SAFETY CLAMP (0 to ₹5,000)
  const budgetLimit = Math.min(MAX_CAMPAIGN_BUDGET, Math.max(0, recommendedBudget));

  // Generated title & reasoning-backed description
  const title = `Cross-sell ${pB.name} to ${pA.name} buyers`;
  const confidencePct = (oppData.confidence * 100).toFixed(1);
  const description = `Offer ${pB.name} to customers who previously purchased ${pA.name}, supported by ${confidencePct}% co-purchase confidence.`;

  // 3. Assemble Output Contract
  return {
    agent: agentResult.agent,

    opportunity: oppData,

    analysis: analysisData,

    recommendation: {
      productA: {
        id: pA.id,
        name: pA.name,
        price: pA.price,
      },
      productB: {
        id: pB.id,
        name: pB.name,
        price: pB.price,
      },
      type,
      targetSegment,
      discountPercent,
      budgetLimit,
      title,
      description,
      estimatedRevenueOpportunity: oppData.estimatedRevenueOpportunity,
    },

    recommendationRationale: {
      segmentReason,
      discountReason,
      budgetReason,
    },

    memory: memorySummary || {
      available: false,
      relevantMemoryCount: 0,
      summary: 'No relevant merchant decision history is available yet.',
      insights: [],
      historicalDecisions: [],
    },

    // 4. Immutable Safety Guarantees
    guardrails: {
      maxDiscountPercent: MAX_DISCOUNT_PERCENT,
      maxBudgetLimit: MAX_CAMPAIGN_BUDGET,
      merchantApprovalRequired: true,
      autoExecutionAllowed: false,
    },
  };
}

module.exports = {
  generateGrowthRecommendation,
  MAX_DISCOUNT_PERCENT,
  MAX_CAMPAIGN_BUDGET,
};
