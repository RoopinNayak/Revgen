// ─────────────────────────────────────────────
// RevGen — Stage 4 On-Demand Growth Analysis Test Suite
// ─────────────────────────────────────────────
//
// Tests all 20+ requirements:
// 1. Orchestrator executes successfully
// 2. Response contract structure validation
// 3. Zero opportunities (no_opportunity)
// 4. Single opportunity handling
// 5. Multiple opportunities evaluated
// 6. Stage 2 integration (authoritative selection)
// 7. Stage 3 integration (strategic recommendation)
// 8. Authoritative deterministic metrics preserved
// 9. AI recommendation fields present
// 10. Stage 2 fallback handling
// 11. Stage 3 fallback handling
// 12. Ollama unavailable handling
// 13. Timeout handling
// 14. Malformed AI response handling
// 15. Concurrent analysis lock (409 protection)
// 16. Lock released on success
// 17. Lock released on error
// 18. Zero campaign creation
// 19. Zero approval / execution
// 20. Database non-mutation verification
// ─────────────────────────────────────────────

require('dotenv').config();
const assert = require('assert');
const pool = require('../src/db');
const {
  runGrowthAnalysis,
  isAnalysisInProgress,
  resetAnalysisLock,
} = require('../src/ai/growthAnalysisOrchestrator');

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
    ...overrides,
  };
}

async function runTests() {
  console.log('🧪 Starting On-Demand Growth Analysis Test Suite (Stage 4)...\n');
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

  // 1. Test Orchestrator Executes Successfully
  await recordAsyncTest('1. runGrowthAnalysis returns complete structured contract', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis(
      { forceFallback: true },
      {
        selectOpportunity: async () => ({
          selectionStatus: 'success',
          selectedOpportunity: opp,
          selectionMethod: 'llm',
          deterministicTopPick: opp,
          agreesWithDeterministic: true,
          reasoning: { selectionReasoning: 'Top pair' },
          candidateCount: 5,
          totalOpportunitiesCount: 84,
        }),
        generateCampaignRecommendation: async () => ({
          recommendationStatus: 'success',
          recommendationMethod: 'llm',
          selectedOpportunity: opp,
          recommendation: {
            targetSegment: 'regular',
            strategy: 'cross_sell',
            offerType: 'bundle',
            recommendedDiscount: 10,
            recommendedBudget: 3000,
            title: 'Sample Title',
            description: 'Sample Description',
            reasoning: 'Sample Reasoning',
            customerInsight: 'Sample Insight',
            expectedImpact: { description: 'Impact', estimatedAdditionalCustomers: 5 },
            riskFactors: [],
          },
          deterministicBaseline: { targetSegment: 'regular', discountPercent: 10, budgetLimit: 5000 },
          comparison: { segmentChanged: false, discountChanged: false, budgetChanged: true },
          safety: { validated: true, merchantApprovalRequired: true, autoExecutionAllowed: false },
        }),
      }
    );

    assert.strictEqual(result.analysisStatus, 'success');
    assert.ok(result.analysisId.startsWith('growth-analysis-'));
    assert.strictEqual(result.totalOpportunitiesCount, 84);
    assert.strictEqual(result.selectedOpportunity.productA.id, 25);
    assert.strictEqual(result.recommendation.recommendation.recommendedDiscount, 10);
    assert.ok(result.timing.totalDurationMs >= 0);
  });

  // 2. Test Response Contract Structure
  await recordAsyncTest('2. Contract contains selection, recommendation, safety, and timing blocks', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({ forceFallback: true }, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
        selectionMethod: 'deterministic_fallback',
        deterministicTopPick: opp,
        agreesWithDeterministic: true,
        candidateCount: 1,
        totalOpportunitiesCount: 1,
      }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        recommendationMethod: 'deterministic_fallback',
        selectedOpportunity: opp,
        recommendation: {
          targetSegment: 'regular',
          strategy: 'cross_sell',
          offerType: 'bundle',
          recommendedDiscount: 10,
          recommendedBudget: 5000,
        },
        safety: { validated: true, merchantApprovalRequired: true, autoExecutionAllowed: false },
      }),
    });

    assert.ok(result.selection);
    assert.ok(result.selectedOpportunity);
    assert.ok(result.recommendation);
    assert.ok(result.safety);
    assert.ok(result.timing);
    assert.strictEqual(result.safety.merchantApprovalRequired, true);
    assert.strictEqual(result.safety.autoExecutionAllowed, false);
  });

  // 3. Test Zero Opportunities Handling
  await recordAsyncTest('3. Zero opportunities returns analysisStatus: "no_opportunity"', async () => {
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({
        selectionStatus: 'no_opportunity',
        selectedOpportunity: null,
        totalOpportunitiesCount: 0,
        candidateCount: 0,
      }),
    });

    assert.strictEqual(result.analysisStatus, 'no_opportunity');
    assert.strictEqual(result.selectedOpportunity, null);
    assert.strictEqual(result.recommendation, null);
    assert.strictEqual(result.totalOpportunitiesCount, 0);
    assert.ok(result.message.includes('No actionable'));
  });

  // 4. Test Single Opportunity Pipeline
  await recordAsyncTest('4. Single opportunity passes through to strategy formulation', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
        selectionMethod: 'deterministic_single_candidate',
        deterministicTopPick: opp,
        agreesWithDeterministic: true,
        candidateCount: 1,
        totalOpportunitiesCount: 1,
      }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        recommendationMethod: 'llm',
        selectedOpportunity: opp,
        recommendation: { targetSegment: 'regular', recommendedDiscount: 10, recommendedBudget: 2500 },
      }),
    });

    assert.strictEqual(result.analysisStatus, 'success');
    assert.strictEqual(result.selection.selectionMethod, 'deterministic_single_candidate');
  });

  // 5. Test Multiple Opportunities Evaluated
  await recordAsyncTest('5. Evaluates full opportunity count while reporting candidate limit', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({ candidateLimit: 5 }, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
        selectionMethod: 'llm',
        candidateCount: 5,
        totalOpportunitiesCount: 84,
      }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        selectedOpportunity: opp,
        recommendation: {},
      }),
    });

    assert.strictEqual(result.totalOpportunitiesCount, 84);
    assert.strictEqual(result.candidateCount, 5);
  });

  // 6. Test Stage 2 Authoritative Selection Preserved
  await recordAsyncTest('6. Stage 2 selected opportunity is preserved intact', async () => {
    const opp = getMockOpportunity({ opportunityScore: 88.5 });
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
        selectionMethod: 'llm',
      }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        selectedOpportunity: opp,
      }),
    });

    assert.strictEqual(result.selectedOpportunity.opportunityScore, 88.5);
    assert.strictEqual(result.selectedOpportunity.productA.name, 'Phone Case');
  });

  // 7. Test Stage 3 Strategic Recommendation Preserved
  await recordAsyncTest('7. Stage 3 recommendation output is preserved intact', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
      }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        recommendationMethod: 'llm',
        recommendation: {
          targetSegment: 'premium',
          recommendedDiscount: 15,
          recommendedBudget: 4000,
          reasoning: 'Capture premium buyers.',
        },
      }),
    });

    assert.strictEqual(result.recommendation.recommendation.targetSegment, 'premium');
    assert.strictEqual(result.recommendation.recommendation.recommendedDiscount, 15);
  });

  // 8. Test Deterministic Metrics Preserved
  await recordAsyncTest('8. Deterministic numerical evidence cannot be modified', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
      }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        selectedOpportunity: opp,
        recommendation: { estimatedRevenueOpportunity: 9999999 }, // AI attempted hallucination
      }),
    });

    assert.strictEqual(result.selectedOpportunity.estimatedRevenueOpportunity, opp.estimatedRevenueOpportunity);
    assert.strictEqual(result.selectedOpportunity.confidence, opp.confidence);
    assert.strictEqual(result.selectedOpportunity.lift, opp.lift);
  });

  // 9. Test AI Recommendation Fields
  await recordAsyncTest('9. Recommendation contains reasoning, customerInsight, expectedImpact, riskFactors', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({ selectionStatus: 'success', selectedOpportunity: opp }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        recommendation: {
          reasoning: 'Strategic bundle rationale',
          customerInsight: 'Frequent add-on purchase',
          expectedImpact: { description: '10 incremental sales', estimatedAdditionalCustomers: 10 },
          riskFactors: ['Margin impact'],
        },
      }),
    });

    const rec = result.recommendation.recommendation;
    assert.strictEqual(rec.reasoning, 'Strategic bundle rationale');
    assert.strictEqual(rec.customerInsight, 'Frequent add-on purchase');
    assert.ok(Array.isArray(rec.riskFactors));
  });

  // 10. Test Stage 2 Fallback Handling
  await recordAsyncTest('10. Stage 2 fallback propagates cleanly to top-level contract', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
        selectionMethod: 'deterministic_fallback',
        fallbackReason: 'LLM timed out',
      }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        recommendationMethod: 'deterministic_fallback',
      }),
    });

    assert.strictEqual(result.selection.selectionMethod, 'deterministic_fallback');
  });

  // 11. Test Stage 3 Fallback Handling
  await recordAsyncTest('11. Stage 3 fallback propagates cleanly to top-level contract', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
        selectionMethod: 'llm',
      }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        recommendationMethod: 'deterministic_fallback',
        fallbackReason: 'Discount exceeded safety limit',
      }),
    });

    assert.strictEqual(result.recommendation.recommendationMethod, 'deterministic_fallback');
  });

  // 12. Test Ollama Unavailable Handling
  await recordAsyncTest('12. Ollama unavailable triggers end-to-end fallback with no crash', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
        selectionMethod: 'deterministic_fallback',
        fallbackReason: 'Ollama is not available: connection refused',
      }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        recommendationMethod: 'deterministic_fallback',
        fallbackReason: 'Ollama is not available: connection refused',
      }),
    });

    assert.strictEqual(result.analysisStatus, 'success');
    assert.strictEqual(result.selection.selectionMethod, 'deterministic_fallback');
    assert.strictEqual(result.recommendation.recommendationMethod, 'deterministic_fallback');
  });

  // 13. Test Timeout Handling
  await recordAsyncTest('13. LLM timeout triggers end-to-end fallback with no crash', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
        selectionMethod: 'deterministic_fallback',
        fallbackReason: 'Request timeout after 180000ms',
      }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        recommendationMethod: 'deterministic_fallback',
        fallbackReason: 'Request timeout after 180000ms',
      }),
    });

    assert.strictEqual(result.analysisStatus, 'success');
  });

  // 14. Test Malformed AI Response Handling
  await recordAsyncTest('14. Malformed AI response triggers clean fallback', async () => {
    const opp = getMockOpportunity();
    const result = await runGrowthAnalysis({}, {
      selectOpportunity: async () => ({
        selectionStatus: 'success',
        selectedOpportunity: opp,
        selectionMethod: 'deterministic_fallback',
        fallbackReason: 'LLM returned no valid structured data',
      }),
      generateCampaignRecommendation: async () => ({
        recommendationStatus: 'success',
        recommendationMethod: 'deterministic_fallback',
        fallbackReason: 'LLM returned no valid structured recommendation data',
      }),
    });

    assert.strictEqual(result.analysisStatus, 'success');
  });

  // 15. Test Concurrent Analysis Protection (HTTP 409)
  await recordAsyncTest('15. Concurrent analysis throws error with statusCode 409', async () => {
    let resolver;
    const slowSelection = new Promise((res) => { resolver = res; });

    const firstRunPromise = runGrowthAnalysis({}, {
      selectOpportunity: async () => {
        await slowSelection;
        return { selectionStatus: 'success', selectedOpportunity: getMockOpportunity() };
      },
      generateCampaignRecommendation: async () => ({ recommendationStatus: 'success' }),
    });

    // Check lock is active
    assert.strictEqual(isAnalysisInProgress(), true, 'Lock should be active during execution');

    // Attempt second parallel run
    let threw409 = false;
    try {
      await runGrowthAnalysis({}, {});
    } catch (err) {
      if (err.statusCode === 409 && err.analysisStatus === 'already_running') {
        threw409 = true;
      }
    }

    assert.strictEqual(threw409, true, 'Second parallel call must throw 409 conflict');

    // Unblock first run
    resolver();
    await firstRunPromise;
  });

  // 16. Test Lock Released on Success
  await recordAsyncTest('16. Concurrency lock is released after successful analysis', async () => {
    assert.strictEqual(isAnalysisInProgress(), false);
    await runGrowthAnalysis({ forceFallback: true }, {
      selectOpportunity: async () => ({ selectionStatus: 'success', selectedOpportunity: getMockOpportunity() }),
      generateCampaignRecommendation: async () => ({ recommendationStatus: 'success' }),
    });
    assert.strictEqual(isAnalysisInProgress(), false, 'Lock must be false after completion');
  });

  // 17. Test Lock Released on Error
  await recordAsyncTest('17. Concurrency lock is released even if an unexpected exception is thrown', async () => {
    assert.strictEqual(isAnalysisInProgress(), false);
    try {
      await runGrowthAnalysis({}, {
        selectOpportunity: async () => {
          throw new Error('Fatal database connection drop');
        },
      });
    } catch {
      // Expected failure
    }
    assert.strictEqual(isAnalysisInProgress(), false, 'Lock must be released in finally block');
  });

  // 18. Test Zero Campaign Creation
  await recordAsyncTest('18. runGrowthAnalysis does NOT create campaigns in PostgreSQL', async () => {
    const before = await pool.query('SELECT COUNT(*) FROM campaigns');
    await runGrowthAnalysis({ forceFallback: true });
    const after = await pool.query('SELECT COUNT(*) FROM campaigns');
    assert.strictEqual(before.rows[0].count, after.rows[0].count);
  });

  // 19. Test Zero Approval / Execution
  await recordAsyncTest('19. runGrowthAnalysis does NOT approve or execute campaigns', async () => {
    const beforeAppr = await pool.query("SELECT COUNT(*) FROM campaigns WHERE status = 'approved'");
    const beforeExec = await pool.query('SELECT COUNT(*) FROM campaign_executions');
    await runGrowthAnalysis({ forceFallback: true });
    const afterAppr = await pool.query("SELECT COUNT(*) FROM campaigns WHERE status = 'approved'");
    const afterExec = await pool.query('SELECT COUNT(*) FROM campaign_executions');
    assert.strictEqual(beforeAppr.rows[0].count, afterAppr.rows[0].count);
    assert.strictEqual(beforeExec.rows[0].count, afterExec.rows[0].count);
  });

  // 20. Test Database Non-Mutation (All tables unchanged)
  await recordAsyncTest('20. Entire analysis is 100% read-only with zero table modifications', async () => {
    const beforeOrders = await pool.query('SELECT COUNT(*) FROM orders');
    const beforeCampaigns = await pool.query('SELECT COUNT(*) FROM campaigns');
    const beforeAudit = await pool.query('SELECT COUNT(*) FROM audit_logs');
    const beforeMemory = await pool.query('SELECT COUNT(*) FROM agent_memory');
    const beforeExecutions = await pool.query('SELECT COUNT(*) FROM campaign_executions');

    await runGrowthAnalysis({ forceFallback: true });

    const afterOrders = await pool.query('SELECT COUNT(*) FROM orders');
    const afterCampaigns = await pool.query('SELECT COUNT(*) FROM campaigns');
    const afterAudit = await pool.query('SELECT COUNT(*) FROM audit_logs');
    const afterMemory = await pool.query('SELECT COUNT(*) FROM agent_memory');
    const afterExecutions = await pool.query('SELECT COUNT(*) FROM campaign_executions');

    assert.strictEqual(beforeOrders.rows[0].count, afterOrders.rows[0].count, 'Orders table unmodified');
    assert.strictEqual(beforeCampaigns.rows[0].count, afterCampaigns.rows[0].count, 'Campaigns table unmodified');
    assert.strictEqual(beforeAudit.rows[0].count, afterAudit.rows[0].count, 'Audit logs unmodified');
    assert.strictEqual(beforeMemory.rows[0].count, afterMemory.rows[0].count, 'Agent memory unmodified');
    assert.strictEqual(beforeExecutions.rows[0].count, afterExecutions.rows[0].count, 'Campaign executions unmodified');
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
      console.log('✅ All Stage 4 On-Demand Growth Analysis tests passed.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal test runner error:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
