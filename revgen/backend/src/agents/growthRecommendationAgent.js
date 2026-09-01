// ─────────────────────────────────────────────
// RevGen — Growth Agent Campaign Recommendation Module (Day 5 Stage 2)
// ─────────────────────────────────────────────
//
// Pipeline:
// Opportunity Analytics → Growth Agent Analysis → Recommendation Engine → Guardrails
//
// Integrates AI Growth Agent analytical reasoning with safe, bounded
// campaign recommendations.
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
 * Generates a Growth Agent powered campaign recommendation for a given opportunity.
 *
 * @param {Object} opportunity - Opportunity object from analytics pipeline.
 * @returns {Object} Structured contract combining Growth Agent analysis, recommendation proposal, evidence, and guardrails.
 */
function generateGrowthRecommendation(opportunity) {
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

  // Target customer segment rule
  let targetSegment = 'regular';
  if (pB.price >= 200) {
    targetSegment = 'premium';
  } else if (pB.price >= 50) {
    targetSegment = 'regular';
  } else {
    targetSegment = 'all';
  }

  // Bounded discount percent rule
  let recommendedDiscount = 10;
  if (analysisData.priority === 'HIGH' || analysisData.priority === 'MEDIUM') {
    recommendedDiscount = 10;
  } else {
    recommendedDiscount = 5;
  }

  // HARD SAFETY CLAMP (0 to 20%)
  const discountPercent = Math.min(MAX_DISCOUNT_PERCENT, Math.max(0, recommendedDiscount));

  // Bounded budget limit rule
  let recommendedBudget = 5000;
  if (oppData.estimatedRevenueOpportunity && oppData.estimatedRevenueOpportunity > 0) {
    const estVal = Math.round((oppData.estimatedRevenueOpportunity * 0.08) / 500) * 500;
    recommendedBudget = Math.min(MAX_CAMPAIGN_BUDGET, Math.max(1000, estVal));
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
