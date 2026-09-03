// ─────────────────────────────────────────────
// RevGen — Autonomous Opportunity Selection Layer (Day 1 Stage 2)
// ─────────────────────────────────────────────
//
// Responsibilities:
// 1. Ingests full opportunity dataset from deterministic analytics (PostgreSQL).
// 2. Extracts and filters top candidate opportunities (bounded limit, default 15).
// 3. Handles edge cases autonomously (0 candidates, 1 candidate, multiple candidates).
// 4. Delegates candidate arbitration to Qwen3:8b (via LLM Growth Agent).
// 5. Performs rigorous deterministic validation on AI output:
//    - Guarantees selected opportunity belongs to the actual candidate set.
//    - Rejects hallucinations / invalid IDs / out-of-bounds indices.
//    - Preserves deterministic numerical metrics as the authoritative source of truth.
//    - Never allows LLM to overwrite confidence, lift, revenue, or opportunityScore.
// 6. Handles AI vs deterministic disagreement cleanly with full transparency.
// 7. Provides graceful fallback to deterministicTopPick if LLM is unavailable/fails/times out.
// 8. 100% READ-ONLY — zero database mutations, no campaign creation, no approval bypass.
// ─────────────────────────────────────────────

const { getProductPairAnalytics: defaultGetProductPairAnalytics } = require('../analytics/productPairs');
const { scoreOpportunities: defaultScoreOpportunities } = require('../analytics/opportunityScoring');
const { analyzeOpportunities: defaultAnalyzeOpportunities } = require('./llmGrowthAgent');

const DEFAULT_CANDIDATE_LIMIT = 15;
const MAX_CANDIDATE_LIMIT = 50;

/**
 * Validates a candidate opportunity object to ensure deterministic numerical integrity.
 *
 * @param {Object} opp - Candidate opportunity object.
 * @returns {boolean} True if all required fields are valid.
 */
function isValidOpportunity(opp) {
  if (!opp || typeof opp !== 'object') return false;
  if (!opp.productA || typeof opp.productA.id !== 'number' || !opp.productA.name) return false;
  if (!opp.productB || typeof opp.productB.id !== 'number' || !opp.productB.name) return false;
  if (typeof opp.opportunityScore !== 'number' || isNaN(opp.opportunityScore)) return false;
  if (typeof opp.confidence !== 'number' || opp.confidence < 0) return false;
  if (typeof opp.lift !== 'number' || opp.lift < 0) return false;
  if (typeof opp.estimatedRevenueOpportunity !== 'number' || opp.estimatedRevenueOpportunity < 0) return false;
  return true;
}

/**
 * Executes the Autonomous Opportunity Selection pipeline.
 *
 * @param {Object} [options] - Selection configuration options.
 * @param {number} [options.candidateLimit=15] - Maximum candidates sent to LLM for comparison.
 * @param {number} [options.minOrdersWithBoth=1] - Minimum co-purchase count for analytics.
 * @param {number} [options.minConfidence=0.01] - Minimum confidence threshold.
 * @param {number} [options.minLift=1.0] - Minimum lift threshold.
 * @param {boolean} [options.forceFallback=false] - For testing fallback behavior.
 * @param {Object} [dependencies] - Dependency injection for testing.
 * @returns {Promise<Object>} Standardized Stage 2 Selection Result Contract.
 */
async function selectOpportunity(options = {}, dependencies = {}) {
  const getProductPairAnalytics = dependencies.getProductPairAnalytics || defaultGetProductPairAnalytics;
  const scoreOpportunities = dependencies.scoreOpportunities || defaultScoreOpportunities;
  const analyzeOpportunities = dependencies.analyzeOpportunities || defaultAnalyzeOpportunities;

  const minOrdersWithBoth = options.minOrdersWithBoth ?? 5;
  const minConfidence = options.minConfidence ?? 0.05;
  const minLift = options.minLift ?? 1.0;
  const rawLimit = options.candidateLimit ?? options.limit ?? DEFAULT_CANDIDATE_LIMIT;
  const candidateLimit = Math.max(1, Math.min(MAX_CANDIDATE_LIMIT, parseInt(rawLimit, 10) || DEFAULT_CANDIDATE_LIMIT));

  // 1. Fetch complete opportunity dataset from deterministic analytics
  const pairAnalytics = await getProductPairAnalytics({
    minOrdersWithBoth,
    minConfidence,
    minLift,
    limit: 200,
  });

  // 2. Score and rank all opportunities deterministically (Authoritative ranking)
  const scoredOpportunities = scoreOpportunities(pairAnalytics || []);
  const totalOpportunitiesCount = Array.isArray(scoredOpportunities) ? scoredOpportunities.length : 0;

  // ─── EDGE CASE A: 0 Opportunities ───────────────────────────
  if (totalOpportunitiesCount === 0) {
    return {
      selectionStatus: 'no_opportunity',
      selectedOpportunity: null,
      selectionMethod: 'none',
      deterministicTopPick: null,
      agreesWithDeterministic: true,
      reasoning: null,
      candidateCount: 0,
      totalOpportunitiesCount: 0,
      durationMs: 0,
      fallbackReason: 'No product-pair opportunities found in dataset.',
    };
  }

  // ─── EDGE CASE B: Exactly 1 Opportunity ─────────────────────
  if (totalOpportunitiesCount === 1) {
    const singleOpp = scoredOpportunities[0];
    const pAName = singleOpp.productA?.name || 'Product A';
    const pBName = singleOpp.productB?.name || 'Product B';
    const confPct = ((singleOpp.confidence || 0) * 100).toFixed(1);

    return {
      selectionStatus: 'success',
      selectedOpportunity: singleOpp,
      selectionMethod: 'deterministic_single_candidate',
      deterministicTopPick: singleOpp,
      agreesWithDeterministic: true,
      reasoning: {
        selectionReasoning: `Single candidate opportunity identified for ${pAName} → ${pBName} with opportunity score ${singleOpp.opportunityScore}.`,
        customerInsight: `Customers purchasing ${pAName} exhibit a ${confPct}% co-purchase rate for ${pBName} (${singleOpp.lift}× lift).`,
        strategicContext: 'Autonomous selection defaulted to single available candidate without requiring LLM comparison.',
        strategicRecommendation: `Proceed with formulating a bounded cross-sell campaign offering ${pBName} to ${pAName} buyers.`,
        riskFactors: [],
        rankings: [
          {
            index: 0,
            productPair: `${pAName} → ${pBName}`,
            rank: 1,
            rationale: 'Only available candidate opportunity in catalog.',
          },
        ],
      },
      candidateCount: 1,
      totalOpportunitiesCount: 1,
      durationMs: 0,
      fallbackReason: null,
    };
  }

  // ─── MULTIPLE OPPORTUNITIES: Candidate Slicing & AI Reasoning ──
  const candidates = scoredOpportunities.slice(0, candidateLimit);
  const deterministicTopPick = candidates[0];

  // If forced fallback is requested (e.g. testing or explicit bypass)
  if (options.forceFallback === true) {
    return buildDeterministicFallbackResult(
      candidates,
      totalOpportunitiesCount,
      'Forced deterministic fallback'
    );
  }

  // 3. Delegate to LLM Growth Agent for qualitative multi-opportunity comparison
  try {
    const aiResult = await analyzeOpportunities(candidates);

    // 4. Check if LLM completed successfully
    if (aiResult && aiResult.llmStatus === 'success' && aiResult.selectedOpportunity) {
      const aiSelected = aiResult.selectedOpportunity;

      // 5. Rigorous Selection Validation Checks:
      // Match AI selected opportunity against candidate array by Product IDs
      const matchedIndex = candidates.findIndex(
        (c) =>
          c.productA?.id === aiSelected.productA?.id &&
          c.productB?.id === aiSelected.productB?.id
      );

      if (matchedIndex !== -1 && isValidOpportunity(candidates[matchedIndex])) {
        // Authoritative Source of Truth: Always use original deterministic candidate object
        const validatedSelectedOpportunity = candidates[matchedIndex];
        const agreesWithDeterministic = matchedIndex === 0;

        const aiReasoning = aiResult.llmAnalysis || {};

        return {
          selectionStatus: 'success',
          selectedOpportunity: validatedSelectedOpportunity,
          selectionMethod: 'llm',
          deterministicTopPick,
          agreesWithDeterministic,
          reasoning: {
            selectionReasoning: aiReasoning.selectionReasoning || '',
            customerInsight: aiReasoning.customerInsight || '',
            strategicContext: aiReasoning.strategicRecommendation || '',
            strategicRecommendation: aiReasoning.strategicRecommendation || '',
            riskFactors: Array.isArray(aiReasoning.riskFactors) ? aiReasoning.riskFactors : [],
            rankings: Array.isArray(aiReasoning.rankings) ? aiReasoning.rankings : [],
          },
          candidateCount: candidates.length,
          totalOpportunitiesCount,
          durationMs: aiResult.durationMs || null,
          fallbackReason: null,
        };
      } else {
        console.warn(
          '[Opportunity Selector] AI selected an opportunity that failed validation or was not in candidate set. Falling back to deterministic top pick.'
        );
        return buildDeterministicFallbackResult(
          candidates,
          totalOpportunitiesCount,
          'AI selection failed candidate validation check (invalid index or product ID mismatch)',
          aiResult.durationMs
        );
      }
    }

    // 6. Handle LLM failure / timeout / malformed output -> Graceful Fallback
    const fallbackReason = (aiResult && aiResult.fallbackReason) || 'LLM analysis unavailable';
    return buildDeterministicFallbackResult(
      candidates,
      totalOpportunitiesCount,
      fallbackReason,
      aiResult?.durationMs
    );
  } catch (err) {
    console.error('[Opportunity Selector] Unexpected error in selection pipeline:', err.message);
    return buildDeterministicFallbackResult(
      candidates,
      totalOpportunitiesCount,
      `Unexpected error: ${err.message}`
    );
  }
}

/**
 * Builds standard deterministic fallback response using deterministicTopPick.
 *
 * @param {Array<Object>} candidates - Candidate opportunities list.
 * @param {number} totalOpportunitiesCount - Total opportunities in dataset.
 * @param {string} fallbackReason - Explanation for fallback.
 * @param {number|null} [durationMs] - Execution duration if available.
 * @returns {Object} Selection result contract.
 */
function buildDeterministicFallbackResult(
  candidates,
  totalOpportunitiesCount,
  fallbackReason,
  durationMs = null
) {
  const deterministicTopPick = candidates[0];
  const pAName = deterministicTopPick.productA?.name || 'Product A';
  const pBName = deterministicTopPick.productB?.name || 'Product B';
  const confPct = ((deterministicTopPick.confidence || 0) * 100).toFixed(1);

  return {
    selectionStatus: 'success',
    selectedOpportunity: deterministicTopPick,
    selectionMethod: 'deterministic_fallback',
    deterministicTopPick,
    agreesWithDeterministic: true,
    reasoning: {
      selectionReasoning: `Autonomous selection selected top deterministic opportunity ${pAName} → ${pBName} with opportunity score ${deterministicTopPick.opportunityScore}.`,
      customerInsight: `Historical co-purchase confidence is ${confPct}% with ${deterministicTopPick.lift}× lift across ${deterministicTopPick.ordersWithBoth} orders.`,
      strategicContext: 'Deterministic scoring rule applied as authoritative selector because AI arbitration layer was unavailable or timed out.',
      strategicRecommendation: `Target ${deterministicTopPick.missedCustomers.toLocaleString('en-IN')} missed customers for an estimated revenue upside of ₹${deterministicTopPick.estimatedRevenueOpportunity.toLocaleString('en-IN')}.`,
      riskFactors: [
        'AI qualitative arbitration bypassed; selection based purely on deterministic opportunityScore formula.',
      ],
      rankings: candidates.slice(0, 5).map((c, i) => ({
        index: i,
        productPair: `${c.productA.name} → ${c.productB.name}`,
        rank: i + 1,
        rationale: `Deterministic opportunityScore: ${c.opportunityScore} (${c.priority} priority)`,
      })),
    },
    candidateCount: candidates.length,
    totalOpportunitiesCount,
    durationMs,
    fallbackReason,
  };
}

module.exports = {
  selectOpportunity,
  isValidOpportunity,
  buildDeterministicFallbackResult,
  DEFAULT_CANDIDATE_LIMIT,
  MAX_CANDIDATE_LIMIT,
};
