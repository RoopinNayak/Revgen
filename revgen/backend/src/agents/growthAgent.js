// ─────────────────────────────────────────────
// RevGen — AI Growth Agent Foundation (Day 6 Stage 1)
// ─────────────────────────────────────────────
//
// Pure analytical agent module:
// - Deterministically classifies Opportunity Strength (VERY_STRONG, STRONG, MODERATE, WEAK)
// - Computes Business Impact Analysis & Risk Assessment
// - Calculates Agent Recommendation Confidence & Label (distinct from purchase confidence)
// - Enforces immutable safety constraints (requiresMerchantApproval = true, autoExecutionAllowed = false)
// - NEVER mutates PostgreSQL database records
// - NO external LLM calls
// ─────────────────────────────────────────────

/**
 * Classifies the opportunity strength deterministically based on analytics metrics.
 *
 * @param {number} score - Opportunity score (0-100).
 * @param {number} confidence - Purchase confidence (0-1).
 * @param {number} lift - Lift ratio (>= 1.0).
 * @param {number} estRev - Estimated revenue opportunity in INR.
 * @returns {string} 'VERY_STRONG' | 'STRONG' | 'MODERATE' | 'WEAK'
 */
function classifyOpportunityStrength(score, confidence, lift, estRev) {
  if (score >= 80 || (confidence >= 0.35 && lift >= 3.5 && estRev >= 25000)) {
    return 'VERY_STRONG';
  }
  if (score >= 65 || (confidence >= 0.25 && lift >= 2.5 && estRev >= 10000)) {
    return 'STRONG';
  }
  if (score >= 45 || (confidence >= 0.15 && lift >= 1.5)) {
    return 'MODERATE';
  }
  return 'WEAK';
}

/**
 * Calculates recommendation confidence (0.0 to 1.0) and label ('HIGH' | 'MEDIUM' | 'LOW').
 * Distinct from historical purchase co-occurrence confidence.
 *
 * @param {number} confidence - Purchase confidence.
 * @param {number} lift - Lift ratio.
 * @param {number} ordersTogether - Historical co-purchase order count.
 * @returns {Object} { score: number, label: string }
 */
function calculateRecommendationConfidence(confidence, lift, ordersTogether) {
  let base = (confidence * 1.2) + ((lift - 1.0) / 10) * 0.8;
  if (ordersTogether >= 20) {
    base += 0.35;
  } else if (ordersTogether >= 10) {
    base += 0.20;
  } else if (ordersTogether >= 5) {
    base += 0.10;
  }

  const score = Math.max(0.10, Math.min(0.99, parseFloat(base.toFixed(2))));
  
  let label = 'LOW';
  if (score >= 0.70) {
    label = 'HIGH';
  } else if (score >= 0.45) {
    label = 'MEDIUM';
  }

  return { score, label };
}

/**
 * Executes the Growth Agent analysis on a normalized opportunity object.
 *
 * @param {Object} rawOpportunity - Opportunity object from opportunity analytics.
 * @returns {Object} Structured agent contract containing analysis, normalized opportunity, and safety rules.
 */
function runGrowthAgent(rawOpportunity) {
  // 1. Parameter & Required Field Validation
  if (!rawOpportunity || typeof rawOpportunity !== 'object') {
    throw new Error('Invalid opportunity: Opportunity object is required.');
  }

  const pA = rawOpportunity.productA;
  const pB = rawOpportunity.productB;

  if (!pA || typeof pA !== 'object' || !pA.id || !pA.name) {
    throw new Error('Invalid opportunity: productA with id and name is required.');
  }

  if (!pB || typeof pB !== 'object' || !pB.id || !pB.name) {
    throw new Error('Invalid opportunity: productB with id and name is required.');
  }

  // 2. Input Normalization with Safe Defaults
  const ordersWithA = Math.max(0, parseInt(rawOpportunity.ordersWithA || 0, 10));
  const ordersWithB = Math.max(0, parseInt(rawOpportunity.ordersWithB || 0, 10));
  const ordersWithBoth = Math.max(0, parseInt(rawOpportunity.ordersWithBoth || 0, 10));
  const missedCustomers = Math.max(0, parseInt(rawOpportunity.missedCustomers || 0, 10));

  const confidence = Math.max(0, parseFloat(rawOpportunity.confidence || 0));
  const lift = Math.max(1.0, parseFloat(rawOpportunity.lift || 1.0));
  const opportunityScore = Math.max(0, Math.min(100, parseFloat(rawOpportunity.opportunityScore || 0)));
  const estimatedRevenueOpportunity = Math.max(0, parseFloat(rawOpportunity.estimatedRevenueOpportunity || 0));

  // Determine priority deterministically based on input or score
  let priority = (rawOpportunity.priority || '').toUpperCase();
  if (!['HIGH', 'MEDIUM', 'LOW'].includes(priority)) {
    if (opportunityScore >= 75) {
      priority = 'HIGH';
    } else if (opportunityScore >= 50) {
      priority = 'MEDIUM';
    } else {
      priority = 'LOW';
    }
  }

  const pAName = pA.name.trim();
  const pBName = pB.name.trim();
  const confidencePct = (confidence * 100).toFixed(1);
  const liftStr = lift.toFixed(2);
  const revenueStr = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(estimatedRevenueOpportunity);

  // 3. Opportunity Strength Classification & Recommendation Confidence
  const opportunityStrength = classifyOpportunityStrength(
    opportunityScore,
    confidence,
    lift,
    estimatedRevenueOpportunity
  );

  const recConfidence = calculateRecommendationConfidence(confidence, lift, ordersWithBoth);

  // Conservative Decision Handling
  let recommendationStatus = 'RECOMMEND';
  let reviewReason = null;
  if (opportunityStrength === 'WEAK' || ordersWithBoth < 3 || confidence < 0.10) {
    recommendationStatus = 'REVIEW_REQUIRED';
    reviewReason = 'Opportunity exhibits low co-purchase evidence or small sample size. Merchant review is strongly recommended before proceeding.';
  }

  // 4. Business Impact & Risk Assessment
  const businessImpact = {
    customerBehaviorStrength: `Customers buying ${pAName} demonstrate a ${confidencePct}% co-purchase rate for ${pBName} (${liftStr}× expected baseline rate).`,
    opportunitySize: `A total of ${missedCustomers.toLocaleString('en-IN')} customers purchased ${pAName} without adding ${pBName}.`,
    revenuePotential: `Potential incremental revenue upside of ${revenueStr} at full catalog pricing.`,
    strategicValue: priority === 'HIGH' ? 'High-priority core catalog synergy.' : priority === 'MEDIUM' ? 'Solid complementary product alignment.' : 'Niche or experimental cross-sell pairing.',
  };

  const riskAssessment = `Low financial risk: Discount is capped at 10% (max safety 20%) and campaign budget is strictly capped at ₹5,000 with mandatory merchant approval.`;

  // 5. Deterministic Reasoning Generation
  let prioritySummary = '';
  if (opportunityStrength === 'VERY_STRONG' || priority === 'HIGH') {
    prioritySummary = 'High-priority cross-sell opportunity. Strong statistical association and substantial untapped revenue potential.';
  } else if (opportunityStrength === 'STRONG' || priority === 'MEDIUM') {
    prioritySummary = 'Moderate-priority cross-sell opportunity. Consistent co-purchase pattern with steady revenue upside.';
  } else {
    prioritySummary = 'Low-priority opportunity. Niche co-purchase pattern suitable for targeted segment testing.';
  }

  const reasoning = `Analysis of historical purchasing behavior reveals that customers who buy ${pAName} have a ${confidencePct}% probability of also purchasing ${pBName}, which is ${liftStr}× higher than baseline random co-purchase expectations. ${prioritySummary}`;

  const recommendedAction = `Formulate a bounded cross-sell campaign offering ${pBName} to customers who purchased ${pAName}. Recommend setting target segment to ${priority === 'HIGH' ? 'PREMIUM' : priority === 'MEDIUM' ? 'REGULAR' : 'ALL'} with a bounded discount (≤20%) and budget limit (≤₹5,000).`;

  const confidenceSummary = `${confidencePct}% conversion confidence based on ${ordersWithBoth.toLocaleString('en-IN')} historical co-purchases out of ${ordersWithA.toLocaleString('en-IN')} total ${pAName} orders. (Agent Recommendation Confidence: ${recConfidence.label} - Math Score ${(recConfidence.score * 100).toFixed(0)}%).`;

  const revenueSummary = `Targeting ${missedCustomers.toLocaleString('en-IN')} missed customers presents an estimated incremental revenue potential of ${revenueStr}.`;

  // 6. Structured Output Contract
  return {
    agent: {
      name: 'RevGen Growth Agent',
      version: '1.1',
    },

    opportunity: {
      productA: {
        id: pA.id,
        name: pAName,
        category: pA.category || null,
        price: typeof pA.price === 'number' ? pA.price : parseFloat(pA.price || 0),
      },
      productB: {
        id: pB.id,
        name: pBName,
        category: pB.category || null,
        price: typeof pB.price === 'number' ? pB.price : parseFloat(pB.price || 0),
      },
      ordersWithA,
      ordersWithB,
      ordersWithBoth,
      missedCustomers,
      confidence,
      lift,
      opportunityScore,
      priority,
      estimatedRevenueOpportunity,
    },

    analysis: {
      opportunityType: 'cross_sell',
      opportunityStrength,
      priority,
      reasoning,
      recommendedAction,
      confidenceSummary,
      revenueSummary,
      businessImpact,
      riskAssessment,
      recommendationConfidence: recConfidence.score,
      recommendationConfidenceLabel: recConfidence.label,
      recommendationStatus,
      reviewReason,
    },

    // 7. Immutable Safety Guarantees (Application-level safety enforcement)
    safety: {
      requiresMerchantApproval: true,
      autoExecutionAllowed: false,
    },
  };
}

module.exports = {
  runGrowthAgent,
  classifyOpportunityStrength,
  calculateRecommendationConfidence,
};
