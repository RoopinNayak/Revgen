// ─────────────────────────────────────────────
// RevGen — Bounded Campaign Recommendation Engine
// ─────────────────────────────────────────────
//
// Converts data-driven growth opportunities into safe,
// bounded campaign proposal recommendations.
//
// Financial Guardrails:
// - Maximum discount: 20% (Strictly enforced via Math.min)
// - Maximum budget limit: ₹5,000 (Strictly enforced via Math.min)
// - Merchant approval required: true
// - Auto-execution allowed: false
// ─────────────────────────────────────────────

const MAX_DISCOUNT_PERCENT = 20;
const MAX_CAMPAIGN_BUDGET = 5000;

/**
 * Generates a bounded campaign proposal recommendation for a growth opportunity.
 *
 * @param {Object} opportunity - Opportunity object from analytics pipeline.
 * @returns {Object} Deterministic recommendation proposal object with explicit guardrails.
 */
function recommendCampaign(opportunity) {
  if (!opportunity || !opportunity.productA || !opportunity.productB) {
    throw new Error('Valid opportunity object with productA and productB is required.');
  }

  const { productA, productB, priority, opportunityScore } = opportunity;

  // 1. Campaign Type (MVP focuses on cross-sell)
  const type = 'cross_sell';

  // 2. Target Customer Segment & Explanation Logic
  let targetSegment = 'regular';
  let targetSegmentReason = '';

  if (productB.price >= 200) {
    targetSegment = 'premium';
    targetSegmentReason = `Product B (${productB.name}) is a premium product (₹${productB.price.toFixed(2)}), so the campaign targets premium customers.`;
  } else if (productB.price >= 50) {
    targetSegment = 'regular';
    targetSegmentReason = `Product B (${productB.name}) is priced at ₹${productB.price.toFixed(2)}, so the campaign targets regular customers.`;
  } else {
    targetSegment = 'all';
    targetSegmentReason = `Product B (${productB.name}) is an accessible item (₹${productB.price.toFixed(2)}), targeting all customer segments.`;
  }

  // 3. Discount Percentage Calculation
  let recommendedDiscount = 10;
  if (priority === 'HIGH' || (opportunityScore && opportunityScore >= 80)) {
    recommendedDiscount = 10;
  } else if (priority === 'MEDIUM' || (opportunityScore && opportunityScore >= 60)) {
    recommendedDiscount = 10;
  } else {
    recommendedDiscount = 5;
  }

  // ABSOLUTE SAFETY CLAMP (0 to 20%)
  const discountPercent = Math.min(MAX_DISCOUNT_PERCENT, Math.max(0, recommendedDiscount));

  // 4. Budget Limit Calculation
  let recommendedBudget = 5000;
  if (opportunity.estimatedRevenueOpportunity) {
    // Dynamic rounded budget estimate bounded by MAX_CAMPAIGN_BUDGET
    const estVal = Math.round((opportunity.estimatedRevenueOpportunity * 0.08) / 500) * 500;
    recommendedBudget = Math.min(MAX_CAMPAIGN_BUDGET, Math.max(1000, estVal));
  }

  // ABSOLUTE SAFETY CLAMP (0 to 5000)
  const budgetLimit = Math.min(MAX_CAMPAIGN_BUDGET, Math.max(0, recommendedBudget));

  // 5. Title & Description
  const title = `Cross-sell ${productB.name} to ${productA.name} buyers`;
  const description = `Offer ${productB.name} to customers who previously purchased ${productA.name}, using a ${discountPercent}% promotional discount.`;

  return {
    recommendation: {
      productA: {
        id: productA.id,
        name: productA.name,
        price: productA.price,
      },
      productB: {
        id: productB.id,
        name: productB.name,
        price: productB.price,
      },
      type,
      targetSegment,
      targetSegmentReason,
      discountPercent,
      budgetLimit,
      title,
      description,
      estimatedRevenueOpportunity: opportunity.estimatedRevenueOpportunity || 0,
    },
    evidence: {
      confidence: opportunity.confidence,
      lift: opportunity.lift,
      ordersWithA: opportunity.ordersWithA,
      ordersWithBoth: opportunity.ordersWithBoth,
      missedCustomers: opportunity.missedCustomers,
      opportunityScore: opportunity.opportunityScore,
      priority: opportunity.priority,
    },
    guardrails: {
      maxDiscountPercent: MAX_DISCOUNT_PERCENT,
      maxBudgetLimit: MAX_CAMPAIGN_BUDGET,
      merchantApprovalRequired: true,
      autoExecutionAllowed: false,
    },
  };
}

module.exports = {
  recommendCampaign,
  MAX_DISCOUNT_PERCENT,
  MAX_CAMPAIGN_BUDGET,
};
