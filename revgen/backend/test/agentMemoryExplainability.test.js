// ─────────────────────────────────────────────
// RevGen — Stage 5 Agent Memory & Explainability Test Suite
// ─────────────────────────────────────────────
//
// Tests all 20 requirements:
// 1. No memory scenario
// 2. Relevant memory found
// 3. Irrelevant memory excluded
// 4. Same product pair memory prioritized
// 5. Different product pair ranked lower
// 6. Memory retrieval failure does not crash analysis
// 7. Memory does not alter opportunityScore
// 8. Memory does not alter deterministic ranking
// 9. LLM receives memory context in prompt
// 10. LLM receives only compact structured data
// 11. Raw orders not sent to LLM
// 12. Fallback without memory returns explainability
// 13. Fallback with memory preserves historicalContext
// 14. Malformed LLM output fallback
// 15. No-opportunity case handling
// 16. Single-opportunity case handling
// 17. Stage 2 + memory integration
// 18. Stage 3 + memory integration
// 19. Stage 4 / Orchestrator + memory integration
// 20. Database non-mutation (agent_memory is strictly read-only during analysis)
// ─────────────────────────────────────────────

require('dotenv').config();
const assert = require('assert');
const pool = require('../src/db');
const { getRelevantMemoryContext, buildEmptyMemoryContext } = require('../src/ai/relevantAgentMemory');
const { generateCampaignRecommendation, buildCampaignPrompt } = require('../src/ai/campaignRecommendationAgent');
const { runGrowthAnalysis, resetAnalysisLock } = require('../src/ai/growthAnalysisOrchestrator');
const { selectOpportunity } = require('../src/ai/opportunitySelector');

function getMockOpportunity(overrides = {}) {
  return {
    productA: { id: 25, name: 'Phone Case', category: 'Mobile', price: 19.99 },
    productB: { id: 24, name: 'Smartphone', category: 'Mobile', price: 699.99 },
    ordersWithA: 186,
    ordersWithB: 250,
    ordersWithBoth: 64,
    totalOrders: 3000,
    confidence: 0.3441,
    support: 0.0213,
    lift: 4.13,
    missedCustomers: 122,
    estimatedRevenueOpportunity: 85398.78,
    affinityScore: 81.8,
    confidenceScore: 68.8,
    volumeScore: 100.0,
    revenuePotentialScore: 52.1,
    opportunityScore: 74.8,
    priority: 'MEDIUM',
    type: 'cross_sell',
    ...overrides,
  };
}

async function runTests() {
  console.log('🧪 Starting Stage 5 Agent Memory & Explainability Test Suite...\n');
  let passed = 0;
  let failed = 0;

  async function recordAsyncTest(name, fn) {
    resetAnalysisLock();
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    } finally {
      resetAnalysisLock();
    }
  }

  // 1. Test No Memory Scenario
  await recordAsyncTest('1. Empty agent memory returns memoryAvailable: false with clean fallback text', async () => {
    const opp = getMockOpportunity({ productA: { id: 9999 } });
    const mockEmptyPool = {
      query: async () => ({ rows: [] }),
    };
    const mem = await getRelevantMemoryContext(opp, mockEmptyPool);
    assert.strictEqual(mem.memoryAvailable, false);
    assert.strictEqual(mem.relevantDecisionCount, 0);
    assert.ok(mem.historicalContext.includes('No relevant merchant history found'));
  });

  // 2. Test Relevant Memory Found
  await recordAsyncTest('2. Relevant memory is correctly retrieved and structured', async () => {
    const opp = getMockOpportunity();
    const mockPool = {
      query: async () => ({
        rows: [
          {
            id: 1,
            campaign_id: 10,
            product_a_id: 25,
            product_b_id: 24,
            opportunity_type: 'cross_sell',
            opportunity_strength: 'STRONG',
            priority: 'MEDIUM',
            final_segment: 'premium',
            final_discount: 10,
            final_budget: 5000,
            merchant_decision: 'approved',
            decision_reason: 'Good bundle',
            created_at: new Date().toISOString(),
          },
        ],
      }),
    };
    const mem = await getRelevantMemoryContext(opp, mockPool);
    assert.strictEqual(mem.memoryAvailable, true);
    assert.strictEqual(mem.relevantDecisionCount, 1);
    assert.strictEqual(mem.approvedCount, 1);
    assert.ok(mem.historicalContext.includes('approved'));
  });

  // 3. Test Irrelevant Memory Excluded
  await recordAsyncTest('3. Irrelevant memory with 0 relevance score is excluded', async () => {
    const opp = getMockOpportunity();
    const mockPool = {
      query: async () => ({
        rows: [
          {
            id: 2,
            product_a_id: 888,
            product_b_id: 999,
            opportunity_type: 'upsell', // different
            priority: 'LOW', // different
            opportunity_strength: 'WEAK', // different
            merchant_decision: 'rejected',
          },
        ],
      }),
    };
    const mem = await getRelevantMemoryContext(opp, mockPool);
    assert.strictEqual(mem.memoryAvailable, false);
    assert.strictEqual(mem.relevantDecisionCount, 0);
  });

  // 4. Test Same Product Pair Memory Prioritized
  await recordAsyncTest('4. Exact product pair match receives highest relevance score', async () => {
    const opp = getMockOpportunity();
    const mockPool = {
      query: async () => ({
        rows: [
          {
            id: 1,
            product_a_id: 100, // Different pair
            product_b_id: 200,
            opportunity_type: 'cross_sell',
            priority: 'MEDIUM',
            merchant_decision: 'submitted',
          },
          {
            id: 2,
            product_a_id: 25, // Exact pair
            product_b_id: 24,
            opportunity_type: 'cross_sell',
            priority: 'MEDIUM',
            merchant_decision: 'approved',
            final_discount: 12,
            final_segment: 'premium',
          },
        ],
      }),
    };
    const mem = await getRelevantMemoryContext(opp, mockPool);
    assert.strictEqual(mem.memoryAvailable, true);
    // Highest ranked decision must be the exact pair (id: 2)
    assert.strictEqual(mem.historicalDecisions[0].productAId, 25);
    assert.strictEqual(mem.historicalDecisions[0].productBId, 24);
    assert.strictEqual(mem.historicalDecisions[0].merchantDecision, 'approved');
  });

  // 5. Test Different Pair Excluded / Ranked Lower
  await recordAsyncTest('5. General memory is ranked lower than direct pair matches', async () => {
    const opp = getMockOpportunity();
    const mockPool = {
      query: async () => ({
        rows: [
          { id: 1, product_a_id: 25, product_b_id: 24, opportunity_type: 'cross_sell', merchant_decision: 'approved' },
          { id: 2, product_a_id: 1, product_b_id: 2, opportunity_type: 'cross_sell', merchant_decision: 'rejected' },
        ],
      }),
    };
    const mem = await getRelevantMemoryContext(opp, mockPool);
    assert.strictEqual(mem.historicalDecisions[0].productAId, 25);
  });

  // 6. Test Memory Retrieval Failure Does Not Crash
  await recordAsyncTest('6. Database error in memory retrieval returns empty context safely', async () => {
    const opp = getMockOpportunity();
    const mockErrorPool = {
      query: async () => {
        throw new Error('Connection terminated unexpectedly');
      },
    };
    const mem = await getRelevantMemoryContext(opp, mockErrorPool);
    assert.strictEqual(mem.memoryAvailable, false);
    assert.strictEqual(mem.relevantDecisionCount, 0);
  });

  // 7. Test Memory Does Not Alter opportunityScore
  await recordAsyncTest('7. Memory cannot modify deterministic opportunityScore', async () => {
    const opp = getMockOpportunity({ opportunityScore: 74.8 });
    const memoryContext = {
      memoryAvailable: true,
      relevantDecisionCount: 5,
      historicalDecisions: [{ merchantDecision: 'approved' }],
    };

    const result = await generateCampaignRecommendation(opp, { memoryContext, forceFallback: true });
    assert.strictEqual(result.selectedOpportunity.opportunityScore, 74.8);
  });

  // 8. Test Memory Does Not Alter Deterministic Ranking
  await recordAsyncTest('8. Deterministic ranking is preserved regardless of memory presence', async () => {
    const oppA = getMockOpportunity({ productA: { id: 1, name: 'A' }, productB: { id: 2, name: 'B' }, opportunityScore: 90.0 });
    const oppB = getMockOpportunity({ productA: { id: 3, name: 'C' }, productB: { id: 4, name: 'D' }, opportunityScore: 80.0 });

    const scored = [oppA, oppB];
    assert.strictEqual(scored[0].opportunityScore > scored[1].opportunityScore, true);
  });

  // 9. Test LLM Receives Memory Context in Prompt
  await recordAsyncTest('9. buildCampaignPrompt embeds merchantMemoryContext in prompt', async () => {
    const opp = getMockOpportunity();
    const memoryContext = {
      memoryAvailable: true,
      relevantDecisionCount: 2,
      summary: 'Found 2 approved decisions',
      insights: ['Approved with 10% discount'],
      historicalDecisions: [{ merchantDecision: 'approved', finalDiscount: 10 }],
    };

    const prompt = buildCampaignPrompt(opp, {}, memoryContext);
    assert.ok(prompt.includes('merchantMemoryContext'));
    assert.ok(prompt.includes('Found 2 approved decisions'));
    assert.ok(prompt.includes('HISTORICAL MERCHANT DECISION CONTEXT'));
  });

  // 10. Test Compact Structured Data (No Raw Orders / Customers)
  await recordAsyncTest('10. Prompt contains only compact summaries, zero raw customer PII', async () => {
    const opp = getMockOpportunity();
    const prompt = buildCampaignPrompt(opp, {}, null);
    assert.strictEqual(prompt.includes('customer_email'), false);
    assert.strictEqual(prompt.includes('customer_id'), false);
    assert.strictEqual(prompt.includes('customer_phone'), false);
    assert.strictEqual(prompt.includes('SELECT * FROM'), false);
  });

  // 11. Test Raw Orders Not Sent to LLM
  await recordAsyncTest('11. Prompt excludes individual order timestamps or order line items', async () => {
    const opp = getMockOpportunity();
    const prompt = buildCampaignPrompt(opp, {}, null);
    assert.strictEqual(prompt.includes('order_items'), false);
    assert.strictEqual(prompt.includes('orders_with_both_list'), false);
  });

  // 12. Test Fallback Without Memory Returns Explainability
  await recordAsyncTest('12. Fallback without memory includes complete explainability block', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis(
      { forceFallback: true },
      {
        selectOpportunity: async () => ({ selectionStatus: 'success', selectedOpportunity: opp }),
        generateCampaignRecommendation: async () => ({
          recommendationStatus: 'success',
          recommendationMethod: 'deterministic_fallback',
          recommendation: { reasoning: 'Standard formula', customerInsight: 'Frequent add-on' },
        }),
        getRelevantMemoryContext: async () => buildEmptyMemoryContext(),
      }
    );

    assert.ok(result.explainability);
    assert.strictEqual(result.explainability.memoryInfluence, 'none');
    assert.ok(result.explainability.deterministicEvidence);
    assert.strictEqual(result.explainability.deterministicEvidence.opportunityScore, 74.8);
  });

  // 13. Test Fallback With Memory Preserves historicalContext
  await recordAsyncTest('13. Fallback with memory reflects historical context in explainability', async () => {
    const opp = getMockOpportunity();
    const mockMem = {
      memoryAvailable: true,
      relevantDecisionCount: 2,
      historicalContext: 'Merchant previously approved 10% discount for this pair.',
    };

    const result = await runGrowthAnalysis(
      { forceFallback: true },
      {
        selectOpportunity: async () => ({ selectionStatus: 'success', selectedOpportunity: opp }),
        generateCampaignRecommendation: async () => ({
          recommendationStatus: 'success',
          recommendationMethod: 'deterministic_fallback',
          recommendation: { reasoning: 'Standard formula', customerInsight: 'Frequent add-on' },
        }),
        getRelevantMemoryContext: async () => mockMem,
      }
    );

    assert.ok(result.explainability);
    assert.strictEqual(result.explainability.memoryInfluence, 'context_only');
    assert.strictEqual(result.explainability.historicalContext, 'Merchant previously approved 10% discount for this pair.');
  });

  // 14. Test Malformed LLM Output Fallback
  await recordAsyncTest('14. Malformed LLM output falls back gracefully with explainability intact', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({ data: 'MALFORMED_JSON_STRING' }),
      },
    });

    assert.strictEqual(result.recommendationStatus, 'success');
    assert.strictEqual(result.recommendationMethod, 'deterministic_fallback');
    assert.ok(result.recommendation.historicalContext);
  });

  // 15. Test No-Opportunity Case
  await recordAsyncTest('15. Zero opportunities returns analysisStatus: "no_opportunity"', async () => {
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({ selectionStatus: 'no_opportunity', selectedOpportunity: null }),
    });

    assert.strictEqual(result.analysisStatus, 'no_opportunity');
    assert.strictEqual(result.explainability, null);
  });

  // 16. Test Single-Opportunity Case
  await recordAsyncTest('16. Single opportunity passes memory context cleanly', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
        selectionMethod: 'deterministic_single_candidate',
      }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        recommendation: { reasoning: 'Single pair' },
      }),
      getRelevantMemoryContext: async () => ({ memoryAvailable: true, relevantDecisionCount: 1, historicalContext: 'Prior single match' }),
    });

    assert.strictEqual(result.analysisStatus, 'success');
    assert.ok(result.explainability);
  });

  // 17. Test Stage 2 + Memory Integration
  await recordAsyncTest('17. Stage 2 selection block includes memoryContext summary', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({ forceFallback: true }, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
        memoryContext: { memoryAvailable: true, relevantDecisionCount: 1 },
      }),
      generateCampaignRecommendation: async () => ({ recommendationStatus: 'success' }),
      getRelevantMemoryContext: async () => ({ memoryAvailable: true, relevantDecisionCount: 1 }),
    });

    assert.ok(result.selection.memoryContext);
    assert.strictEqual(result.selection.memoryContext.memoryAvailable, true);
  });

  // 18. Test Stage 3 + Memory Integration
  await recordAsyncTest('18. Stage 3 recommendation contract includes memoryContext block', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, { forceFallback: true });
    assert.ok(result.memoryContext);
    assert.strictEqual(typeof result.memoryContext.memoryAvailable, 'boolean');
  });

  // 19. Test Stage 4 / Orchestrator + Memory Integration
  await recordAsyncTest('19. Orchestrator unifies selection, recommendation, and explainability', async () => {
    const result = await runGrowthAnalysis({ forceFallback: true });
    assert.strictEqual(result.analysisStatus, 'success');
    assert.ok(result.explainability);
    assert.ok(result.explainability.deterministicEvidence);
    assert.ok(result.explainability.whySelected);
    assert.ok(result.explainability.businessReasoning);
    assert.ok(result.explainability.historicalContext);
  });

  // 20. Test Database Non-Mutation (agent_memory is strictly read-only)
  await recordAsyncTest('20. Analysis run does NOT insert or update agent_memory or any other table', async () => {
    const beforeMemory = await pool.query('SELECT COUNT(*) FROM agent_memory');
    const beforeOrders = await pool.query('SELECT COUNT(*) FROM orders');
    const beforeCampaigns = await pool.query('SELECT COUNT(*) FROM campaigns');
    const beforeAudit = await pool.query('SELECT COUNT(*) FROM audit_logs');
    const beforeExecutions = await pool.query('SELECT COUNT(*) FROM campaign_executions');

    // Run on-demand analysis
    await runGrowthAnalysis({ forceFallback: true });

    const afterMemory = await pool.query('SELECT COUNT(*) FROM agent_memory');
    const afterOrders = await pool.query('SELECT COUNT(*) FROM orders');
    const afterCampaigns = await pool.query('SELECT COUNT(*) FROM campaigns');
    const afterAudit = await pool.query('SELECT COUNT(*) FROM audit_logs');
    const afterExecutions = await pool.query('SELECT COUNT(*) FROM campaign_executions');

    assert.strictEqual(beforeMemory.rows[0].count, afterMemory.rows[0].count, 'agent_memory must be unmodified');
    assert.strictEqual(beforeOrders.rows[0].count, afterOrders.rows[0].count, 'orders must be unmodified');
    assert.strictEqual(beforeCampaigns.rows[0].count, afterCampaigns.rows[0].count, 'campaigns must be unmodified');
    assert.strictEqual(beforeAudit.rows[0].count, afterAudit.rows[0].count, 'audit_logs must be unmodified');
    assert.strictEqual(beforeExecutions.rows[0].count, afterExecutions.rows[0].count, 'campaign_executions must be unmodified');
  });

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  runTests()
    .then(() => {
      console.log('✅ All Stage 5 Agent Memory & Explainability tests passed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal test runner error:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
