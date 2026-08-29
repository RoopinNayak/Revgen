// ─────────────────────────────────────────────
// RevGen — Opportunity Explanation Engine
// ─────────────────────────────────────────────
//
// Converts quantitative opportunity scores and market basket
// metrics into structured, merchant-readable explanations.
//
// NO LLM is used. All explanations are generated deterministically
// using structured templates, formatting helpers, and directional logic.
// ─────────────────────────────────────────────

/**
 * Formats a decimal probability into a human-readable percentage string (e.g. 0.256 -> "25.6%").
 *
 * @param {number} decimal - Confidence or probability (0 to 1).
 * @returns {string} Formatted percentage string.
 */
function formatPercent(decimal) {
  if (typeof decimal !== 'number' || isNaN(decimal)) return '0.0%';
  return `${(decimal * 100).toFixed(1)}%`;
}

/**
 * Formats a lift multiplier (e.g. 4.13 -> "4.13×").
 *
 * @param {number} lift - Lift ratio (> 0).
 * @returns {string} Formatted lift string.
 */
function formatLift(lift) {
  if (typeof lift !== 'number' || isNaN(lift)) return '1.00×';
  return `${lift.toFixed(2)}×`;
}

/**
 * Formats currency values in INR using en-IN locale (e.g. 3718.14 -> "₹3,718.14").
 *
 * @param {number} amount - Monetary value.
 * @returns {string} Formatted currency string.
 */
function formatCurrency(amount) {
  if (typeof amount !== 'number' || isNaN(amount)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generates a structured, merchant-readable explanation for a single scored opportunity.
 *
 * @param {Object} opp - Scored opportunity object from scoreOpportunities().
 * @returns {Object} Explanation structure containing title, summary, reason, opportunity, recommendation, and disclaimer.
 */
function generateOpportunityExplanation(opp) {
  const nameA = opp.productA?.name || 'Product A';
  const nameB = opp.productB?.name || 'Product B';

  const confidencePct = formatPercent(opp.confidence);
  const liftStr = formatLift(opp.lift);
  const revenueStr = formatCurrency(opp.estimatedRevenueOpportunity);
  const missedCount = opp.missedCustomers.toLocaleString('en-IN');

  const title = `Cross-sell ${nameB} to ${nameA} buyers`;

  const summary = `${nameB} is strongly associated with ${nameA} purchases.`;

  const reason = `${confidencePct} of ${nameA} orders also include ${nameB}, which is ${liftStr} the expected rate based on overall purchasing behavior.`;

  const opportunity = `${missedCount} ${nameA} orders did not include ${nameB}, representing an estimated revenue opportunity of ${revenueStr} at the current catalog price.`;

  const recommendation = `Consider offering ${nameB} as a cross-sell when customers purchase ${nameA}.`;

  const disclaimer =
    'Estimated revenue assumes one additional unit of Product B at the current catalog price for each missed Product A order. Actual results depend on customer conversion and campaign performance.';

  return {
    title,
    summary,
    reason,
    opportunity,
    recommendation,
    disclaimer,
  };
}

/**
 * Enriches a list of scored opportunity objects with structured explanations.
 *
 * @param {Array<Object>} opportunities - List of scored opportunity objects.
 * @returns {Array<Object>} List of opportunity objects with an added `explanation` field.
 */
function explainOpportunities(opportunities) {
  if (!Array.isArray(opportunities)) {
    return [];
  }

  return opportunities.map((opp) => ({
    ...opp,
    explanation: generateOpportunityExplanation(opp),
  }));
}

module.exports = {
  explainOpportunities,
  generateOpportunityExplanation,
  formatPercent,
  formatLift,
  formatCurrency,
};
