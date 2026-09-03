// ─────────────────────────────────────────────
// RevGen — LLM Growth Agent: Multi-Opportunity Analyzer (Day 7 Stage 1)
// ─────────────────────────────────────────────
//
// Accepts the COMPLETE scored opportunity set from the existing
// deterministic analytics pipeline and sends it to Qwen3:8b (via Ollama)
// for qualitative comparison, ranking, selection, and business reasoning.
//
// ARCHITECTURAL RULES:
// 1. The existing deterministic opportunityScore is AUTHORITATIVE.
//    The LLM does NOT produce competing numerical scores.
// 2. The LLM receives ONLY compact opportunity summaries — never raw
//    orders, customers, or transaction-level data.
// 3. If Ollama is unavailable or returns invalid data, the system falls
//    back to pure deterministic ordering with llmStatus: 'fallback'.
// 4. This module NEVER mutates the database.
// 5. This module NEVER creates campaigns, triggers approvals, or
//    bypasses safety guardrails.
// ─────────────────────────────────────────────

const { generateCompletion, isAvailable, OLLAMA_MODEL } = require('./llmClient');

/**
 * Builds a compact opportunity summary array suitable for LLM context.
 * Strips unnecessary fields to keep the prompt small and focused.
 *
 * @param {Array<Object>} scoredOpportunities - Full scored opportunity array from scoreOpportunities().
 * @returns {Array<Object>} Compact summary objects for LLM consumption.
 */
function buildOpportunitySummaries(scoredOpportunities) {
  return scoredOpportunities.map((opp, index) => ({
    index,
    productA: {
      id: opp.productA.id,
      name: opp.productA.name,
      category: opp.productA.category,
      price: opp.productA.price,
    },
    productB: {
      id: opp.productB.id,
      name: opp.productB.name,
      category: opp.productB.category,
      price: opp.productB.price,
    },
    coPurchaseOrders: opp.ordersWithBoth,
    missedCustomers: opp.missedCustomers,
    confidence: opp.confidence,
    lift: opp.lift,
    opportunityScore: opp.opportunityScore,
    priority: opp.priority,
    estimatedRevenueINR: opp.estimatedRevenueOpportunity,
  }));
}

/**
 * Constructs the structured prompt for Qwen3 multi-opportunity analysis.
 *
 * @param {Array<Object>} summaries - Compact opportunity summaries.
 * @returns {string} Full prompt string.
 */
function buildAnalysisPrompt(summaries) {
  // Use compact JSON to minimize token count
  const opportunityJSON = JSON.stringify(summaries);

  return `You are an e-commerce growth agent. Analyze these ${summaries.length} cross-sell opportunities and select the best one.

Each opportunity: productA→productB cross-sell. Metrics: opportunityScore (0-100, authoritative), confidence (P(B|A)), lift (vs random), missedCustomers (target audience), estimatedRevenueINR.

DATA: ${opportunityJSON}

Respond with ONLY valid JSON (no markdown fences, no extra text):
{"selectedOpportunityIndex":<int>,"selectedProductAId":<int>,"selectedProductBId":<int>,"selectionReasoning":"<why this is best, 2 sentences>","rankings":[{"index":<int>,"productPair":"A→B","rank":<int>,"rationale":"<1 sentence>"}],"customerInsight":"<1-2 sentences>","strategicRecommendation":"<1-2 sentences>","riskFactors":["<risk>"]}  

Rules: rank all opportunities. rank=1 is best. Do NOT invent scores. Be concise.`;
}

/**
 * Analyzes the complete scored opportunity set using Qwen3:8b via Ollama.
 *
 * Pipeline: scoreOpportunities() output → compact summaries → LLM prompt → structured reasoning
 *
 * On any failure (Ollama down, timeout, malformed response), falls back to
 * deterministic top-pick with llmStatus: 'fallback'.
 *
 * @param {Array<Object>} scoredOpportunities - Full scored opportunity array from scoreOpportunities().
 * @returns {Promise<Object>} Structured analysis contract.
 */
async function analyzeOpportunities(scoredOpportunities) {
  // Validate input
  if (!Array.isArray(scoredOpportunities) || scoredOpportunities.length === 0) {
    return {
      llmStatus: 'error',
      fallbackReason: 'No opportunities provided for analysis',
      model: null,
      selectedOpportunity: null,
      llmAnalysis: null,
      allOpportunities: [],
      deterministicTopPick: null,
      agreesWithDeterministic: true,
    };
  }

  // The deterministic top pick is always opportunities[0] (already sorted by opportunityScore desc)
  const deterministicTopPick = scoredOpportunities[0];

  // Build compact summaries for LLM
  const summaries = buildOpportunitySummaries(scoredOpportunities);

  // Attempt LLM analysis
  try {
    // Check Ollama availability first
    const status = await isAvailable();
    if (!status || !status.available) {
      console.warn('[LLM Growth Agent] Ollama is not available:', status?.reason || 'unknown');
      return buildFallbackResponse(
        scoredOpportunities,
        deterministicTopPick,
        `Ollama is not available: ${status?.reason || 'unknown'}`
      );
    }

    // Build and send prompt
    const prompt = buildAnalysisPrompt(summaries);
    console.log(`[LLM Growth Agent] Sending ${summaries.length} opportunities to ${OLLAMA_MODEL}...`);

    const result = await generateCompletion(prompt, {
      temperature: 0.3,
      timeoutMs: 180000, // 180s for multi-opportunity analysis on local hardware
    });

    if (!result || !result.data) {
      console.warn('[LLM Growth Agent] LLM returned no valid data, falling back to deterministic.');
      return buildFallbackResponse(
        scoredOpportunities,
        deterministicTopPick,
        'LLM returned no valid structured data'
      );
    }

    // Validate the LLM response structure
    const llmData = result.data;
    const validated = validateLLMResponse(llmData, scoredOpportunities);

    if (!validated.valid) {
      console.warn('[LLM Growth Agent] LLM response validation failed:', validated.reason);
      return buildFallbackResponse(
        scoredOpportunities,
        deterministicTopPick,
        `LLM response validation failed: ${validated.reason}`
      );
    }

    // Determine which opportunity the LLM selected
    const selectedIndex = llmData.selectedOpportunityIndex;
    const selectedOpportunity = scoredOpportunities[selectedIndex];
    const agreesWithDeterministic = selectedIndex === 0;

    console.log(
      `[LLM Growth Agent] Analysis complete in ${result.durationMs}ms. ` +
      `Selected: index ${selectedIndex} (${selectedOpportunity.productA.name} → ${selectedOpportunity.productB.name}). ` +
      `Agrees with deterministic: ${agreesWithDeterministic}`
    );

    return {
      llmStatus: 'success',
      model: result.model,
      durationMs: result.durationMs,
      selectedOpportunity,
      llmAnalysis: {
        selectionReasoning: llmData.selectionReasoning || '',
        rankings: llmData.rankings || [],
        customerInsight: llmData.customerInsight || '',
        strategicRecommendation: llmData.strategicRecommendation || '',
        riskFactors: llmData.riskFactors || [],
      },
      allOpportunities: scoredOpportunities,
      deterministicTopPick,
      agreesWithDeterministic,
      opportunityCount: scoredOpportunities.length,
    };
  } catch (err) {
    console.error('[LLM Growth Agent] Unexpected error during LLM analysis:', err.message);
    return buildFallbackResponse(
      scoredOpportunities,
      deterministicTopPick,
      `Unexpected error: ${err.message}`
    );
  }
}

/**
 * Validates the structure of the LLM's JSON response.
 *
 * @param {Object} llmData - Parsed JSON from LLM.
 * @param {Array<Object>} opportunities - Original opportunity array for bounds checking.
 * @returns {Object} { valid: boolean, reason?: string }
 */
function validateLLMResponse(llmData, opportunities) {
  if (!llmData || typeof llmData !== 'object') {
    return { valid: false, reason: 'Response is not a valid object' };
  }

  // Check selectedOpportunityIndex exists and is in bounds
  if (typeof llmData.selectedOpportunityIndex !== 'number') {
    return { valid: false, reason: 'Missing or invalid selectedOpportunityIndex' };
  }

  const idx = llmData.selectedOpportunityIndex;
  if (idx < 0 || idx >= opportunities.length || !Number.isInteger(idx)) {
    return { valid: false, reason: `selectedOpportunityIndex ${idx} is out of bounds (0-${opportunities.length - 1})` };
  }

  // Validate product ID cross-reference (if provided)
  if (llmData.selectedProductAId !== undefined) {
    const expected = opportunities[idx];
    if (llmData.selectedProductAId !== expected.productA.id) {
      return { valid: false, reason: `selectedProductAId mismatch: got ${llmData.selectedProductAId}, expected ${expected.productA.id}` };
    }
  }

  if (llmData.selectedProductBId !== undefined) {
    const expected = opportunities[idx];
    if (llmData.selectedProductBId !== expected.productB.id) {
      return { valid: false, reason: `selectedProductBId mismatch: got ${llmData.selectedProductBId}, expected ${expected.productB.id}` };
    }
  }

  // Check that selectionReasoning exists
  if (!llmData.selectionReasoning || typeof llmData.selectionReasoning !== 'string') {
    return { valid: false, reason: 'Missing or invalid selectionReasoning' };
  }

  // Rankings should be an array (can be empty but must exist)
  if (!Array.isArray(llmData.rankings)) {
    return { valid: false, reason: 'Missing or invalid rankings array' };
  }

  return { valid: true };
}

/**
 * Builds the deterministic fallback response when LLM is unavailable or fails.
 *
 * @param {Array<Object>} scoredOpportunities - Full scored opportunity array.
 * @param {Object} deterministicTopPick - The top opportunity by deterministic score.
 * @param {string} reason - Human-readable reason for fallback.
 * @returns {Object} Fallback response contract.
 */
function buildFallbackResponse(scoredOpportunities, deterministicTopPick, reason) {
  return {
    llmStatus: 'fallback',
    fallbackReason: reason,
    model: null,
    durationMs: null,
    selectedOpportunity: deterministicTopPick,
    llmAnalysis: null,
    allOpportunities: scoredOpportunities,
    deterministicTopPick,
    agreesWithDeterministic: true,
    opportunityCount: scoredOpportunities.length,
  };
}

module.exports = {
  analyzeOpportunities,
  buildOpportunitySummaries,
  buildAnalysisPrompt,
  validateLLMResponse,
};
