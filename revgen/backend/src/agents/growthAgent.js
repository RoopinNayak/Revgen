// ─────────────────────────────────────────────
// RevGen — AI Growth Agent Foundation (Day 5 Stage 1)
// ─────────────────────────────────────────────
//
// Conceptual orchestration layer sitting between Opportunity Analytics
// and Campaign Recommendation.
//
// Pure analytical agent module:
// - Consumes normalized opportunity data
// - Generates structured, deterministic analysis and reasoning
// - Enforces immutable safety constraints (requiresMerchantApproval = true, autoExecutionAllowed = false)
// - NEVER mutates PostgreSQL database records
// - NO external LLM calls
// ─────────────────────────────────────────────

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

  // 3. Deterministic Reasoning Generation
  let prioritySummary = '';
  if (priority === 'HIGH') {
    prioritySummary = 'High-priority cross-sell opportunity. Strong statistical association and substantial untapped revenue potential.';
  } else if (priority === 'MEDIUM') {
    prioritySummary = 'Moderate-priority cross-sell opportunity. Consistent co-purchase pattern with steady revenue upside.';
  } else {
    prioritySummary = 'Low-priority opportunity. Niche co-purchase pattern suitable for targeted segment testing.';
  }

  const reasoning = `Analysis of historical purchasing behavior reveals that customers who buy ${pAName} have a ${confidencePct}% probability of also purchasing ${pBName}, which is ${liftStr}× higher than baseline random co-purchase expectations. ${prioritySummary}`;

  const recommendedAction = `Formulate a bounded cross-sell campaign offering ${pBName} to customers who purchased ${pAName}. Recommend setting target segment to ${priority === 'HIGH' ? 'PREMIUM' : priority === 'MEDIUM' ? 'REGULAR' : 'ALL'} with a bounded discount (≤20%) and budget limit (≤₹5,000).`;

  const confidenceSummary = `${confidencePct}% conversion confidence based on ${ordersWithBoth.toLocaleString('en-IN')} historical co-purchases out of ${ordersWithA.toLocaleString('en-IN')} total ${pAName} orders.`;

  const revenueSummary = `Targeting ${missedCustomers.toLocaleString('en-IN')} missed customers presents an estimated incremental revenue potential of ${revenueStr}.`;

  // 4. Structured Output Contract
  return {
    agent: {
      name: 'RevGen Growth Agent',
      version: '1.0',
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
      priority,
      reasoning,
      recommendedAction,
      confidenceSummary,
      revenueSummary,
    },

    // 5. Immutable Safety Guarantees (Application-level safety enforcement)
    safety: {
      requiresMerchantApproval: true,
      autoExecutionAllowed: false,
    },
  };
}

module.exports = {
  runGrowthAgent,
};
