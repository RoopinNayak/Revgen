// ─────────────────────────────────────────────
// RevGen — Stage 3 AI Campaign Recommendation Test Suite
// ─────────────────────────────────────────────
//
// Tests all 20+ requirements:
// 1. Valid selected opportunity processing
// 2. Zero opportunities handling (no_opportunity)
// 3. Single opportunity handling
// 4. Multiple opportunities handling
// 5. Successful AI recommendation
// 6. AI recommendation structure validation
// 7. Invalid JSON handling -> fallback
// 8. Ollama unavailable -> fallback
// 9. LLM Timeout -> fallback
// 10. Missing AI field -> fallback
// 11. Invalid segment -> fallback
// 12. Discount > 20% -> fallback
// 13. Negative discount -> fallback
// 14. Budget > ₹5,000 -> fallback
// 15. Negative budget -> fallback
// 16. Deterministic baseline comparison
// 17. Deterministic opportunity metrics preserved
// 18. Merchant approval remains mandatory
// 19. Auto execution remains disabled
// 20. Database non-mutation (read-only verification)
// 21. validateAIRecommendation helper unit tests
// ─────────────────────────────────────────────

require('dotenv').config();
const assert = require('assert');
const pool = require('../src/db');
const {
  generateCampaignRecommendation,
  validateAIRecommendation,
} = require('../src/ai/campaignRecommendationAgent');
const { selectOpportunity } = require('../src/ai/opportunitySelector');

// Sample deterministic mock opportunity
function getMockOpportunity(overrides = {}) {
  return {
    productA: {
      id: 25,
      name: 'Phone Case',
      category: 'Mobile',
      price: 19.99,
    },
    productB: {
      id: 24,
      name: 'Smartphone',
      category: 'Mobile',
      price: 699.99,
    },
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
  console.log('🧪 Starting AI Campaign Recommendation Test Suite...\n');
  let passed = 0;
  let failed = 0;

  function recordTest(name, fn) {
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  async function recordAsyncTest(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Test Valid Selected Opportunity
  await recordAsyncTest('1. Valid selected opportunity produces successful recommendation contract', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({
          data: {
            targetSegment: 'premium',
            strategy: 'cross_sell',
            offerType: 'bundle',
            recommendedDiscount: 10,
            recommendedBudget: 4000,
            title: 'Upgrade to Smartphone with Case',
            description: 'Exclusive bundle for mobile accessory shoppers.',
            reasoning: 'High ticket conversion incentive for active buyers.',
            customerInsight: 'Case buyers have imminent phone upgrade intent.',
            expectedImpact: { description: '15 incremental conversions', estimatedAdditionalCustomers: 15 },
            riskFactors: ['High value item margin sensitivity'],
          },
          durationMs: 3200,
        }),
      },
    });

    assert.strictEqual(result.recommendationStatus, 'success');
    assert.strictEqual(result.recommendationMethod, 'llm');
    assert.strictEqual(result.recommendation.targetSegment, 'premium');
    assert.strictEqual(result.recommendation.recommendedDiscount, 10);
    assert.strictEqual(result.recommendation.recommendedBudget, 4000);
    assert.strictEqual(result.safety.validated, true);
    assert.strictEqual(result.safety.merchantApprovalRequired, true);
    assert.strictEqual(result.safety.autoExecutionAllowed, false);
  });

  // 2. Test Zero Opportunities Handling
  await recordAsyncTest('2. Zero opportunities (null input) returns recommendationStatus: "no_opportunity"', async () => {
    const result = await generateCampaignRecommendation(null);
    assert.strictEqual(result.recommendationStatus, 'no_opportunity');
    assert.strictEqual(result.recommendationMethod, 'none');
    assert.strictEqual(result.selectedOpportunity, null);
    assert.strictEqual(result.recommendation, null);
  });

  // 3. Test Single Opportunity Pipeline
  await recordAsyncTest('3. Single opportunity generates complete AI recommendation strategy', async () => {
    const opp = getMockOpportunity({ opportunityScore: 90.0 });
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({
          data: {
            targetSegment: 'regular',
            strategy: 'cross_sell',
            offerType: 'discount',
            recommendedDiscount: 12,
            recommendedBudget: 3500,
            title: 'Single Candidate Strategy',
            description: 'Focused cross-sell.',
            reasoning: 'Captures solid co-purchase synergy.',
            customerInsight: 'Direct complementary product pair.',
            expectedImpact: { description: '10 conversions', estimatedAdditionalCustomers: 10 },
            riskFactors: [],
          },
          durationMs: 2500,
        }),
      },
    });

    assert.strictEqual(result.recommendationStatus, 'success');
    assert.strictEqual(result.recommendationMethod, 'llm');
    assert.strictEqual(result.recommendation.recommendedDiscount, 12);
  });

  // 4. Test Multiple Opportunities via Stage 2 Selector Integration
  await recordAsyncTest('4. Stage 2 autonomous selector output feeds directly into Stage 3', async () => {
    const stage2Selection = await selectOpportunity({ forceFallback: true });
    assert.strictEqual(stage2Selection.selectionStatus, 'success');
    assert.ok(stage2Selection.selectedOpportunity);

    const result = await generateCampaignRecommendation(
      stage2Selection.selectedOpportunity,
      { forceFallback: true }
    );

    assert.strictEqual(result.recommendationStatus, 'success');
    assert.strictEqual(result.recommendationMethod, 'deterministic_fallback');
    assert.strictEqual(result.selectedOpportunity.productA.id, stage2Selection.selectedOpportunity.productA.id);
  });

  // 5. Test Successful AI Recommendation Contract Fields
  await recordAsyncTest('5. Successful AI recommendation includes all required strategy fields', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({
          data: {
            targetSegment: 'regular',
            strategy: 'cross_sell',
            offerType: 'bundle',
            recommendedDiscount: 10,
            recommendedBudget: 2500,
            title: 'Special Offer',
            description: 'Bundle promotion.',
            reasoning: 'Solid margin and volume balance.',
            customerInsight: 'Buyers appreciate package deals.',
            expectedImpact: { description: 'High probability', estimatedAdditionalCustomers: 8 },
            riskFactors: ['Inventory limit'],
          },
          durationMs: 1800,
        }),
      },
    });

    const rec = result.recommendation;
    assert.ok(rec.title);
    assert.ok(rec.description);
    assert.ok(rec.reasoning);
    assert.ok(rec.customerInsight);
    assert.ok(rec.expectedImpact);
    assert.ok(Array.isArray(rec.riskFactors));
    assert.strictEqual(typeof rec.recommendedDiscount, 'number');
    assert.strictEqual(typeof rec.recommendedBudget, 'number');
  });

  // 6. Test AI Recommendation Structure Validation
  recordTest('6. validateAIRecommendation correctly approves valid schema', () => {
    const valid = {
      targetSegment: 'regular',
      strategy: 'cross_sell',
      offerType: 'bundle',
      recommendedDiscount: 15,
      recommendedBudget: 3000,
      title: 'Valid Campaign',
      description: 'Valid description.',
      reasoning: 'Valid reasoning.',
      customerInsight: 'Valid insight.',
      expectedImpact: { description: 'Impact', estimatedAdditionalCustomers: 5 },
      riskFactors: ['Risk A'],
    };
    const check = validateAIRecommendation(valid);
    assert.strictEqual(check.valid, true);
    assert.strictEqual(check.sanitized.recommendedDiscount, 15);
    assert.strictEqual(check.sanitized.recommendedBudget, 3000);
  });

  // 7. Test Invalid JSON / Malformed Output -> Fallback
  await recordAsyncTest('7. Malformed AI output falls back to deterministic recommendation', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({
          data: null, // Malformed JSON
        }),
      },
    });

    assert.strictEqual(result.recommendationStatus, 'success');
    assert.strictEqual(result.recommendationMethod, 'deterministic_fallback');
    assert.ok(result.fallbackReason.includes('no valid structured'));
    assert.strictEqual(result.recommendation.recommendedDiscount, 10);
  });

  // 8. Test Ollama Unavailable -> Fallback
  await recordAsyncTest('8. Ollama unavailable triggers clean deterministic fallback', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: false, reason: 'connect ECONNREFUSED 127.0.0.1:11434' }),
        generateCompletion: async () => null,
      },
    });

    assert.strictEqual(result.recommendationStatus, 'success');
    assert.strictEqual(result.recommendationMethod, 'deterministic_fallback');
    assert.ok(result.fallbackReason.includes('Ollama is not available'));
  });

  // 9. Test LLM Timeout -> Fallback
  await recordAsyncTest('9. LLM timeout triggers clean deterministic fallback', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => {
          throw new Error('Request timeout after 180000ms');
        },
      },
    });

    assert.strictEqual(result.recommendationStatus, 'success');
    assert.strictEqual(result.recommendationMethod, 'deterministic_fallback');
    assert.ok(result.fallbackReason.includes('timeout'));
  });

  // 10. Test Missing AI Field -> Fallback
  await recordAsyncTest('10. Missing AI field (missing reasoning) triggers deterministic fallback', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({
          data: {
            targetSegment: 'regular',
            strategy: 'cross_sell',
            recommendedDiscount: 10,
            recommendedBudget: 2000,
            // reasoning is missing
          },
        }),
      },
    });

    assert.strictEqual(result.recommendationMethod, 'deterministic_fallback');
    assert.ok(result.fallbackReason.includes('reasoning'));
  });

  // 11. Test Invalid Target Segment -> Fallback
  await recordAsyncTest('11. Invalid targetSegment (e.g. "vip", "gold") triggers fallback', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({
          data: {
            targetSegment: 'vip_ultra_gold', // Unsupported
            strategy: 'cross_sell',
            recommendedDiscount: 10,
            recommendedBudget: 2000,
            reasoning: 'VIP strategy.',
            customerInsight: 'VIP customers.',
          },
        }),
      },
    });

    assert.strictEqual(result.recommendationMethod, 'deterministic_fallback');
    assert.ok(result.fallbackReason.includes('targetSegment'));
  });

  // 12. Test Discount > 20% -> Fallback
  await recordAsyncTest('12. AI discount > 20% (e.g. 35%) is strictly rejected and falls back', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({
          data: {
            targetSegment: 'regular',
            strategy: 'cross_sell',
            recommendedDiscount: 35, // VIOLATION: max 20%
            recommendedBudget: 2500,
            reasoning: 'Aggressive discount.',
            customerInsight: 'Price sensitive buyers.',
          },
        }),
      },
    });

    assert.strictEqual(result.recommendationMethod, 'deterministic_fallback');
    assert.ok(result.fallbackReason.includes('recommendedDiscount'));
    assert.strictEqual(result.recommendation.recommendedDiscount <= 20, true);
  });

  // 13. Test Negative Discount -> Fallback
  await recordAsyncTest('13. Negative discount is strictly rejected and falls back', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({
          data: {
            targetSegment: 'regular',
            strategy: 'cross_sell',
            recommendedDiscount: -5, // VIOLATION: min 0%
            recommendedBudget: 2500,
            reasoning: 'Negative discount.',
            customerInsight: 'Insight.',
          },
        }),
      },
    });

    assert.strictEqual(result.recommendationMethod, 'deterministic_fallback');
    assert.ok(result.fallbackReason.includes('recommendedDiscount'));
  });

  // 14. Test Budget > ₹5,000 -> Fallback
  await recordAsyncTest('14. AI budget > ₹5,000 (e.g. ₹20,000) is strictly rejected and falls back', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({
          data: {
            targetSegment: 'regular',
            strategy: 'cross_sell',
            recommendedDiscount: 10,
            recommendedBudget: 20000, // VIOLATION: max ₹5,000
            reasoning: 'Massive budget campaign.',
            customerInsight: 'Large scale.',
          },
        }),
      },
    });

    assert.strictEqual(result.recommendationMethod, 'deterministic_fallback');
    assert.ok(result.fallbackReason.includes('recommendedBudget'));
    assert.strictEqual(result.recommendation.recommendedBudget <= 5000, true);
  });

  // 15. Test Negative Budget -> Fallback
  await recordAsyncTest('15. Negative budget is strictly rejected and falls back', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({
          data: {
            targetSegment: 'regular',
            strategy: 'cross_sell',
            recommendedDiscount: 10,
            recommendedBudget: -500, // VIOLATION
            reasoning: 'Negative budget.',
            customerInsight: 'Insight.',
          },
        }),
      },
    });

    assert.strictEqual(result.recommendationMethod, 'deterministic_fallback');
    assert.ok(result.fallbackReason.includes('recommendedBudget'));
  });

  // 16. Test Deterministic Baseline Comparison
  await recordAsyncTest('16. Tracks differences between AI proposal and deterministic baseline', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({
          data: {
            targetSegment: 'all', // Differs from baseline 'premium'
            strategy: 'cross_sell',
            offerType: 'discount',
            recommendedDiscount: 5, // Differs from baseline 10%
            recommendedBudget: 2000, // Differs from baseline 5000
            title: 'Mass Campaign',
            description: 'Broad appeal.',
            reasoning: 'Broader reach approach.',
            customerInsight: 'Broad co-purchase affinity.',
          },
        }),
      },
    });

    assert.strictEqual(result.recommendationMethod, 'llm');
    assert.ok(result.comparison);
    assert.strictEqual(result.comparison.discountChanged, true);
    assert.strictEqual(result.comparison.budgetChanged, true);
    assert.strictEqual(result.comparison.aiDiscount, 5);
    assert.strictEqual(result.comparison.baselineDiscount, 10);
  });

  // 17. Test Deterministic Opportunity Metrics Preserved
  await recordAsyncTest('17. Deterministic opportunity metrics (score, confidence, lift, revenue) cannot be overwritten', async () => {
    const opp = getMockOpportunity();
    const originalScore = opp.opportunityScore;
    const originalRev = opp.estimatedRevenueOpportunity;
    const originalConf = opp.confidence;

    const result = await generateCampaignRecommendation(opp, {}, {
      llmClient: {
        isAvailable: async () => ({ available: true }),
        generateCompletion: async () => ({
          data: {
            targetSegment: 'regular',
            strategy: 'cross_sell',
            recommendedDiscount: 10,
            recommendedBudget: 2500,
            reasoning: 'Valid reasoning.',
            customerInsight: 'Valid insight.',
            // Hallucinated metrics that must be ignored:
            opportunityScore: 99.9,
            confidence: 0.999,
            estimatedRevenueOpportunity: 999999,
          },
        }),
      },
    });

    assert.strictEqual(result.selectedOpportunity.opportunityScore, originalScore);
    assert.strictEqual(result.selectedOpportunity.estimatedRevenueOpportunity, originalRev);
    assert.strictEqual(result.selectedOpportunity.confidence, originalConf);
    assert.strictEqual(result.recommendation.estimatedRevenueOpportunity, originalRev);
  });

  // 18. Test Merchant Approval Remains Mandatory
  await recordAsyncTest('18. Safety guarantees requireMerchantApproval = true', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, { forceFallback: true });
    assert.strictEqual(result.safety.merchantApprovalRequired, true);
  });

  // 19. Test Auto Execution Remains Disabled
  await recordAsyncTest('19. Safety guarantees autoExecutionAllowed = false', async () => {
    const opp = getMockOpportunity();
    const result = await generateCampaignRecommendation(opp, { forceFallback: true });
    assert.strictEqual(result.safety.autoExecutionAllowed, false);
  });

  // 20. Test Database Non-Mutation (Zero State Changes)
  await recordAsyncTest('20. Recommendation endpoint does NOT mutate database rows', async () => {
    const beforeOrders = await pool.query('SELECT COUNT(*) FROM orders');
    const beforeCampaigns = await pool.query('SELECT COUNT(*) FROM campaigns');
    const beforeAudit = await pool.query('SELECT COUNT(*) FROM audit_logs');
    const beforeMemory = await pool.query('SELECT COUNT(*) FROM agent_memory');
    const beforeExecutions = await pool.query('SELECT COUNT(*) FROM campaign_executions');

    const opp = getMockOpportunity();
    await generateCampaignRecommendation(opp, { forceFallback: true });

    const afterOrders = await pool.query('SELECT COUNT(*) FROM orders');
    const afterCampaigns = await pool.query('SELECT COUNT(*) FROM campaigns');
    const afterAudit = await pool.query('SELECT COUNT(*) FROM audit_logs');
    const afterMemory = await pool.query('SELECT COUNT(*) FROM agent_memory');
    const afterExecutions = await pool.query('SELECT COUNT(*) FROM campaign_executions');

    assert.strictEqual(beforeOrders.rows[0].count, afterOrders.rows[0].count, 'Orders unchanged');
    assert.strictEqual(beforeCampaigns.rows[0].count, afterCampaigns.rows[0].count, 'Campaigns unchanged');
    assert.strictEqual(beforeAudit.rows[0].count, afterAudit.rows[0].count, 'Audit logs unchanged');
    assert.strictEqual(beforeMemory.rows[0].count, afterMemory.rows[0].count, 'Agent memory unchanged');
    assert.strictEqual(beforeExecutions.rows[0].count, afterExecutions.rows[0].count, 'Campaign executions unchanged');
  });

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run directly
if (require.main === module) {
  runTests()
    .then(() => {
      console.log('✅ All Stage 3 Campaign Recommendation tests completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal test runner error:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
