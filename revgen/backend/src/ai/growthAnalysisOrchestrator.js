// ─────────────────────────────────────────────
// RevGen — On-Demand Growth Analysis Orchestrator (Day 1 Stage 4)
// ─────────────────────────────────────────────
//
// Single entry point for merchant-triggered on-demand growth analysis:
// [ 🔍 Run Growth Analysis ]
//
// Pipeline:
// Merchant Click
//        ↓
// Fresh PostgreSQL Analytics (ALL Opportunities Evaluated)
//        ↓
// Opportunity Scoring Engine (scoreOpportunities)
//        ↓
// Stage 2 Autonomous Opportunity Selection (opportunitySelector)
//        ↓
// Authoritative Selected Opportunity
//        ↓
// Stage 3 AI Campaign Recommendation (campaignRecommendationAgent)
//        ↓
// Strict Deterministic Safety Validation (discount <= 20%, budget <= ₹5,000)
//        ↓
// Merchant-Reviewable Proposal Contract
//
// Key Guarantees:
// 1. In-memory concurrency lock prevents duplicate parallel runs (returns HTTP 409).
// 2. Guaranteed lock release via `finally` block under all outcomes.
// 3. 100% READ-ONLY — zero database mutations, no campaign creation, no approval, no execution.
// 4. Deterministic analytics evaluate the COMPLETE opportunity dataset before candidate slicing.
// 5. Authoritative opportunity numbers cannot be corrupted by LLM reasoning.
// 6. Graceful deterministic fallback if Qwen/Ollama times out, fails, or produces invalid output.
// ─────────────────────────────────────────────

const { selectOpportunity: defaultSelectOpportunity } = require('./opportunitySelector');
const { generateCampaignRecommendation: defaultGenerateCampaignRecommendation } = require('./campaignRecommendationAgent');
const { getRelevantMemoryContext: defaultGetRelevantMemoryContext } = require('./relevantAgentMemory');
const { MAX_DISCOUNT_PERCENT, MAX_CAMPAIGN_BUDGET } = require('../agents/growthRecommendationAgent');

// In-memory process lock for concurrent analysis protection
let growthAnalysisInProgress = false;

/**
 * Checks if a growth analysis is currently in progress.
 *
 * @returns {boolean} True if an analysis is active.
 */
function isAnalysisInProgress() {
  return growthAnalysisInProgress;
}

/**
 * Resets the in-memory lock (useful for testing).
 */
function resetAnalysisLock() {
  growthAnalysisInProgress = false;
}

/**
 * Executes the complete On-Demand Growth Analysis orchestration pipeline.
 *
 * @param {Object} [options] - Configuration options.
 * @param {number} [options.candidateLimit=15] - Candidates sent to Stage 2 LLM.
 * @param {boolean} [options.forceFallback=false] - Testing flag for deterministic fallback.
 * @param {Object} [dependencies] - Dependency injection for isolated unit testing.
 * @returns {Promise<Object>} Complete Growth Analysis Result Contract.
 */
async function runGrowthAnalysis(options = {}, dependencies = {}) {
  // 1. Concurrent Request Protection
  if (growthAnalysisInProgress) {
    const err = new Error('Growth analysis is already running. Please wait for the current analysis to complete.');
    err.statusCode = 409;
    err.analysisStatus = 'already_running';
    throw err;
  }

  // Acquire in-memory lock
  growthAnalysisInProgress = true;

  const startTimeMs = Date.now();
  const startedAt = new Date().toISOString();
  const analysisId = `growth-analysis-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  const selectOpportunity = dependencies.selectOpportunity || defaultSelectOpportunity;
  const generateCampaignRecommendation = dependencies.generateCampaignRecommendation || defaultGenerateCampaignRecommendation;
  const getRelevantMemoryContext = dependencies.getRelevantMemoryContext || defaultGetRelevantMemoryContext;

  try {
    // 2. Stage 2: Autonomous Opportunity Selection
    const selectionResult = await selectOpportunity(options, dependencies);

    // ─── Edge Case: No opportunities found ──────────────────────
    if (!selectionResult || selectionResult.selectionStatus === 'no_opportunity' || !selectionResult.selectedOpportunity) {
      const completedAt = new Date().toISOString();
      const totalDurationMs = Date.now() - startTimeMs;

      return {
        analysisStatus: 'no_opportunity',
        analysisId,
        message: 'No actionable growth opportunities were found in the current merchant data.',
        totalOpportunitiesCount: selectionResult?.totalOpportunitiesCount || 0,
        candidateCount: 0,
        selection: selectionResult || null,
        selectedOpportunity: null,
        recommendation: null,
        deterministicBaseline: null,
        comparison: null,
        explainability: null,
        safety: {
          validated: true,
          merchantApprovalRequired: true,
          autoExecutionAllowed: false,
          maxDiscountPercent: MAX_DISCOUNT_PERCENT,
          maxBudgetLimit: MAX_CAMPAIGN_BUDGET,
        },
        timing: {
          startedAt,
          completedAt,
          totalDurationMs,
        },
      };
    }

    const selectedOpportunity = selectionResult.selectedOpportunity;

    // Retrieve relevant merchant memory context for explainability (read-only)
    let memoryContext = options.memoryContext || null;
    if (!memoryContext) {
      try {
        memoryContext = await getRelevantMemoryContext(selectedOpportunity);
      } catch (memErr) {
        console.warn('[Growth Orchestrator] Memory context notice:', memErr.message);
      }
    }

    // Attach memory context to selection block if not already present
    if (selectionResult && !selectionResult.memoryContext) {
      selectionResult.memoryContext = {
        memoryAvailable: Boolean(memoryContext?.memoryAvailable),
        relevantDecisionCount: memoryContext?.relevantDecisionCount || 0,
      };
    }

    // 3. Stage 3: AI Campaign Recommendation on Selected Opportunity with Memory Context
    const recommendationResult = await generateCampaignRecommendation(
      selectedOpportunity,
      {
        forceFallback: options.forceFallback,
        memoryContext,
        memorySummary: options.memorySummary,
      },
      dependencies
    );

    const completedAt = new Date().toISOString();
    const totalDurationMs = Date.now() - startTimeMs;

    const recDetails = recommendationResult?.recommendation || {};

    // 4. Assemble Structured Explainability Block (Part 6)
    const explainability = {
      deterministicEvidence: {
        opportunityScore: selectedOpportunity.opportunityScore,
        confidence: selectedOpportunity.confidence,
        lift: selectedOpportunity.lift,
        ordersWithBoth: selectedOpportunity.ordersWithBoth,
        missedCustomers: selectedOpportunity.missedCustomers,
        estimatedRevenueOpportunity: selectedOpportunity.estimatedRevenueOpportunity,
        priority: selectedOpportunity.priority,
      },
      whySelected: selectionResult.reasoning?.selectionReasoning || `Top-ranked opportunity with score ${selectedOpportunity.opportunityScore}.`,
      businessReasoning: recDetails.reasoning || recDetails.description || '',
      customerInsight: recDetails.customerInsight || '',
      historicalContext: memoryContext?.historicalContext || recDetails.historicalContext || 'No relevant merchant history found. Recommendation is based purely on current opportunity evidence.',
      memoryInfluence: memoryContext?.memoryAvailable ? 'context_only' : 'none',
    };

    // 5. Assemble Final Combined Contract
    return {
      analysisStatus: 'success',
      analysisId,
      totalOpportunitiesCount: selectionResult.totalOpportunitiesCount,
      candidateCount: selectionResult.candidateCount,
      selection: selectionResult,
      selectedOpportunity,
      recommendation: recommendationResult,
      deterministicBaseline: recommendationResult.deterministicBaseline || null,
      comparison: recommendationResult.comparison || null,
      explainability,
      safety: {
        validated: true,
        merchantApprovalRequired: true,
        autoExecutionAllowed: false,
        maxDiscountPercent: MAX_DISCOUNT_PERCENT,
        maxBudgetLimit: MAX_CAMPAIGN_BUDGET,
      },
      timing: {
        startedAt,
        completedAt,
        totalDurationMs,
      },
    };
  } finally {
    // Guaranteed release of in-memory lock under all conditions (success, error, timeout)
    growthAnalysisInProgress = false;
  }
}

module.exports = {
  runGrowthAnalysis,
  isAnalysisInProgress,
  resetAnalysisLock,
};
