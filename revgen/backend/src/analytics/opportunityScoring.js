// ─────────────────────────────────────────────
// RevGen — Opportunity Scoring Engine
// ─────────────────────────────────────────────
//
// Converts raw product pair analytics into deterministic,
// weighted opportunity scores (0–100) and priority ranks.
//
// Scoring Components:
// 1. Affinity Score       (30%) - Logarithmic transformation of Lift
// 2. Confidence Score     (25%) - Scaled P(B|A)
// 3. Volume Score         (20%) - Co-purchase order count normalized against max
// 4. Revenue Potential    (25%) - Estimated missed revenue normalized against max
// ─────────────────────────────────────────────

// Priority Threshold Constants
const PRIORITY_THRESHOLDS = {
  HIGH: 80.0,
  MEDIUM: 60.0,
};

/**
 * Calculates deterministic opportunity scores and priority rankings for candidate product pairs.
 *
 * @param {Array<Object>} productPairs - List of product pair analytics objects from getProductPairAnalytics().
 * @returns {Array<Object>} List of scored opportunity objects, sorted by opportunityScore descending.
 */
function scoreOpportunities(productPairs) {
  if (!productPairs || productPairs.length === 0) {
    return [];
  }

  // Find max values across candidate pairs for relative normalization
  let maxOrdersWithBoth = 0;
  let maxEstimatedRevenueOpportunity = 0;

  // Pre-calculate raw missed customers and estimated revenue opportunity per pair
  const enrichedPairs = productPairs.map((pair) => {
    const missedCustomers = Math.max(0, pair.ordersWithA - pair.ordersWithBoth);
    const estimatedRevenueOpportunity = missedCustomers * pair.productB.price;

    if (pair.ordersWithBoth > maxOrdersWithBoth) {
      maxOrdersWithBoth = pair.ordersWithBoth;
    }
    if (estimatedRevenueOpportunity > maxEstimatedRevenueOpportunity) {
      maxEstimatedRevenueOpportunity = estimatedRevenueOpportunity;
    }

    return {
      ...pair,
      missedCustomers,
      estimatedRevenueOpportunity,
    };
  });

  // Calculate component scores and total opportunityScore for each pair
  const scoredOpportunities = enrichedPairs.map((pair) => {
    // 1. Affinity Score (30%) - 50 * ln(lift + 1), capped at 100
    const rawAffinity = 50 * Math.log(pair.lift + 1);
    const affinityScore = Math.min(100, Math.max(0, rawAffinity));

    // 2. Confidence Score (25%) - confidence * 200, capped at 100
    const rawConfidence = pair.confidence * 200;
    const confidenceScore = Math.min(100, Math.max(0, rawConfidence));

    // 3. Volume Score (20%) - normalized against maxOrdersWithBoth
    const volumeScore =
      maxOrdersWithBoth > 0
        ? Math.min(100, Math.max(0, (pair.ordersWithBoth / maxOrdersWithBoth) * 100))
        : 0;

    // 4. Revenue Potential Score (25%) - normalized against maxEstimatedRevenueOpportunity
    const revenuePotentialScore =
      maxEstimatedRevenueOpportunity > 0
        ? Math.min(
            100,
            Math.max(
              0,
              (pair.estimatedRevenueOpportunity / maxEstimatedRevenueOpportunity) * 100
            )
          )
        : 0;

    // Weighted Total Score (0–100)
    const rawOpportunityScore =
      affinityScore * 0.30 +
      confidenceScore * 0.25 +
      volumeScore * 0.20 +
      revenuePotentialScore * 0.25;

    const opportunityScore = Math.min(100, Math.max(0, rawOpportunityScore));

    // Priority Classification
    let priority = 'LOW';
    if (opportunityScore >= PRIORITY_THRESHOLDS.HIGH) {
      priority = 'HIGH';
    } else if (opportunityScore >= PRIORITY_THRESHOLDS.MEDIUM) {
      priority = 'MEDIUM';
    }

    return {
      productA: pair.productA,
      productB: pair.productB,
      ordersWithA: pair.ordersWithA,
      ordersWithB: pair.ordersWithB,
      ordersWithBoth: pair.ordersWithBoth,
      totalOrders: pair.totalOrders,

      confidence: pair.confidence,
      support: pair.support,
      lift: pair.lift,

      missedCustomers: pair.missedCustomers,
      estimatedRevenueOpportunity: parseFloat(pair.estimatedRevenueOpportunity.toFixed(2)),

      affinityScore: parseFloat(affinityScore.toFixed(1)),
      confidenceScore: parseFloat(confidenceScore.toFixed(1)),
      volumeScore: parseFloat(volumeScore.toFixed(1)),
      revenuePotentialScore: parseFloat(revenuePotentialScore.toFixed(1)),

      opportunityScore: parseFloat(opportunityScore.toFixed(1)),
      priority,
    };
  });

  // Sort opportunities by opportunityScore descending
  scoredOpportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return scoredOpportunities;
}

module.exports = {
  scoreOpportunities,
  PRIORITY_THRESHOLDS,
};
