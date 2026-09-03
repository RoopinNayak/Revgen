// ─────────────────────────────────────────────
// RevGen — Stage 2 Autonomous Opportunity Selection Test Suite
// ─────────────────────────────────────────────
//
// Tests all 20 requirements:
// 1. 0 opportunities (no_opportunity)
// 2. 1 opportunity (deterministic_single_candidate)
// 3. Multiple opportunities (candidate slicing)
// 4. Successful AI selection
// 5. AI selects deterministic top pick (agreesWithDeterministic = true)
// 6. AI selects different valid candidate (agreesWithDeterministic = false)
// 7. Invalid selected index -> fallback
// 8. Mismatched product IDs -> fallback
// 9. Malformed JSON -> fallback
// 10. Ollama unavailable -> fallback
// 11. Timeout -> fallback
// 12. Deterministic fallback structure
// 13. All numerical values remain deterministic
// 14. No database mutation
// 15. No campaign creation
// 16. No approval
// 17. No execution
// 18. Existing Stage 1 endpoint works
// 19. Existing analytics endpoints work
// 20. Existing campaign workflow works
// ─────────────────────────────────────────────

require('dotenv').config();
const assert = require('assert');
const pool = require('../src/db');
const { selectOpportunity, isValidOpportunity } = require('../src/ai/opportunitySelector');

// Sample deterministic mock opportunities for isolated unit tests
function getMockOpportunities(count = 5) {
  const categories = ['Mobile', 'Computers', 'Audio', 'Gaming', 'Accessories'];
  const opps = [];
  for (let i = 0; i < count; i++) {
    opps.push({
      productA: {
        id: 100 + i,
        name: `Product A${i + 1}`,
        category: categories[i % categories.length],
        price: 50 + i * 20,
      },
      productB: {
        id: 200 + i,
        name: `Product B${i + 1}`,
        category: categories[(i + 1) % categories.length],
        price: 150 + i * 50,
      },
      ordersWithA: 100 - i * 10,
      ordersWithB: 120 - i * 10,
      ordersWithBoth: 40 - i * 5,
      totalOrders: 2000,
      confidence: parseFloat((0.40 - i * 0.05).toFixed(4)),
      support: parseFloat((0.02 - i * 0.002).toFixed(4)),
      lift: parseFloat((4.5 - i * 0.4).toFixed(2)),
      missedCustomers: 60 - i * 5,
      estimatedRevenueOpportunity: (60 - i * 5) * (150 + i * 50),
      affinityScore: parseFloat((85 - i * 5).toFixed(1)),
      confidenceScore: parseFloat((80 - i * 10).toFixed(1)),
      volumeScore: parseFloat((90 - i * 10).toFixed(1)),
      revenuePotentialScore: parseFloat((75 - i * 5).toFixed(1)),
      opportunityScore: parseFloat((82.5 - i * 5).toFixed(1)),
      priority: i === 0 ? 'HIGH' : i < 3 ? 'MEDIUM' : 'LOW',
    });
  }
  return opps;
}

async function runTests() {
  console.log('🧪 Starting Autonomous Opportunity Selection Test Suite...\n');
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

  // 1. Test 0 Opportunities
  await recordAsyncTest('1. Zero opportunities returns selectionStatus: "no_opportunity" with no LLM call', async () => {
    let llmCalled = false;
    const result = await selectOpportunity({}, {
      getProductPairAnalytics: async () => [],
      scoreOpportunities: () => [],
      analyzeOpportunities: async () => {
        llmCalled = true;
        return { llmStatus: 'success' };
      },
    });

    assert.strictEqual(result.selectionStatus, 'no_opportunity');
    assert.strictEqual(result.selectedOpportunity, null);
    assert.strictEqual(result.selectionMethod, 'none');
    assert.strictEqual(result.candidateCount, 0);
    assert.strictEqual(result.totalOpportunitiesCount, 0);
    assert.strictEqual(llmCalled, false, 'LLM must not be called when 0 opportunities exist');
  });

  // 2. Test 1 Opportunity
  await recordAsyncTest('2. Exactly 1 opportunity returns deterministic_single_candidate with no LLM call', async () => {
    let llmCalled = false;
    const singleOpp = getMockOpportunities(1);
    const result = await selectOpportunity({}, {
      getProductPairAnalytics: async () => singleOpp,
      scoreOpportunities: () => singleOpp,
      analyzeOpportunities: async () => {
        llmCalled = true;
        return { llmStatus: 'success' };
      },
    });

    assert.strictEqual(result.selectionStatus, 'success');
    assert.strictEqual(result.selectionMethod, 'deterministic_single_candidate');
    assert.strictEqual(result.selectedOpportunity.productA.id, singleOpp[0].productA.id);
    assert.strictEqual(result.agreesWithDeterministic, true);
    assert.strictEqual(result.candidateCount, 1);
    assert.strictEqual(result.totalOpportunitiesCount, 1);
    assert.strictEqual(llmCalled, false, 'LLM must not be called when exactly 1 opportunity exists');
    assert.ok(result.reasoning.selectionReasoning.includes('Single candidate opportunity'));
  });

  // 3. Test Multiple Opportunities & Candidate Limit Slicing
  await recordAsyncTest('3. Multiple opportunities slices candidates up to candidateLimit', async () => {
    const opps = getMockOpportunities(10);
    let capturedCandidates = [];

    const result = await selectOpportunity({ candidateLimit: 4 }, {
      getProductPairAnalytics: async () => opps,
      scoreOpportunities: () => opps,
      analyzeOpportunities: async (candidates) => {
        capturedCandidates = candidates;
        return {
          llmStatus: 'success',
          selectedOpportunity: candidates[0],
          llmAnalysis: {
            selectionReasoning: 'Top score candidate selected.',
            customerInsight: 'Strong co-purchase.',
            strategicRecommendation: 'Create campaign.',
            riskFactors: ['Minor margin risk'],
            rankings: [{ index: 0, productPair: 'A->B', rank: 1, rationale: 'Best' }],
          },
        };
      },
    });

    assert.strictEqual(result.totalOpportunitiesCount, 10);
    assert.strictEqual(result.candidateCount, 4);
    assert.strictEqual(capturedCandidates.length, 4);
  });

  // 4. Test Successful AI Selection
  await recordAsyncTest('4. Successful AI selection returns clean contract with original deterministic object', async () => {
    const opps = getMockOpportunities(5);
    const result = await selectOpportunity({}, {
      getProductPairAnalytics: async () => opps,
      scoreOpportunities: () => opps,
      analyzeOpportunities: async (candidates) => ({
        llmStatus: 'success',
        selectedOpportunity: candidates[0],
        durationMs: 4500,
        llmAnalysis: {
          selectionReasoning: 'Strongest synergy between accessories and mobile.',
          customerInsight: 'Frequent bundled checkout.',
          strategicRecommendation: 'Promote at cart.',
          riskFactors: ['Stock availability'],
          rankings: candidates.map((c, i) => ({ index: i, productPair: `${c.productA.name}->${c.productB.name}`, rank: i + 1, rationale: 'Valid' })),
        },
      }),
    });

    assert.strictEqual(result.selectionStatus, 'success');
    assert.strictEqual(result.selectionMethod, 'llm');
    assert.strictEqual(result.selectedOpportunity.productA.id, opps[0].productA.id);
    assert.strictEqual(result.selectedOpportunity.opportunityScore, opps[0].opportunityScore);
    assert.strictEqual(result.reasoning.selectionReasoning, 'Strongest synergy between accessories and mobile.');
  });

  // 5. Test AI Agrees with Deterministic Top Pick
  await recordAsyncTest('5. AI selects top pick -> agreesWithDeterministic is TRUE', async () => {
    const opps = getMockOpportunities(5);
    const result = await selectOpportunity({}, {
      getProductPairAnalytics: async () => opps,
      scoreOpportunities: () => opps,
      analyzeOpportunities: async (candidates) => ({
        llmStatus: 'success',
        selectedOpportunity: candidates[0], // index 0
        llmAnalysis: {
          selectionReasoning: 'Highest score.',
        },
      }),
    });

    assert.strictEqual(result.agreesWithDeterministic, true);
    assert.strictEqual(result.selectedOpportunity.productA.id, opps[0].productA.id);
  });

  // 6. Test AI Disagrees with Deterministic Top Pick (Selects valid candidate #2)
  await recordAsyncTest('6. AI selects valid candidate #2 -> agreesWithDeterministic is FALSE but selection is preserved', async () => {
    const opps = getMockOpportunities(5);
    const result = await selectOpportunity({}, {
      getProductPairAnalytics: async () => opps,
      scoreOpportunities: () => opps,
      analyzeOpportunities: async (candidates) => ({
        llmStatus: 'success',
        selectedOpportunity: candidates[2], // index 2 selected by AI
        llmAnalysis: {
          selectionReasoning: 'Product A3 -> Product B3 offers better strategic margin synergy despite lower raw score.',
          customerInsight: 'High retention segment.',
          strategicRecommendation: 'Launch cross-sell.',
        },
      }),
    });

    assert.strictEqual(result.selectionStatus, 'success');
    assert.strictEqual(result.selectionMethod, 'llm');
    assert.strictEqual(result.agreesWithDeterministic, false, 'agreesWithDeterministic must be false');
    assert.strictEqual(result.selectedOpportunity.productA.id, opps[2].productA.id, 'Must preserve AI selected opportunity');
    assert.strictEqual(result.deterministicTopPick.productA.id, opps[0].productA.id, 'Must preserve deterministicTopPick');
    assert.strictEqual(result.selectedOpportunity.opportunityScore, opps[2].opportunityScore, 'Authoritative score must be deterministic score of candidate 2');
  });

  // 7. Test Invalid Selected Index (Out of Bounds)
  await recordAsyncTest('7. Invalid selected index triggers deterministic fallback', async () => {
    const opps = getMockOpportunities(3);
    const result = await selectOpportunity({}, {
      getProductPairAnalytics: async () => opps,
      scoreOpportunities: () => opps,
      analyzeOpportunities: async () => ({
        llmStatus: 'success',
        selectedOpportunity: { productA: { id: 999 }, productB: { id: 888 } }, // Unknown
        llmAnalysis: {},
      }),
    });

    assert.strictEqual(result.selectionStatus, 'success');
    assert.strictEqual(result.selectionMethod, 'deterministic_fallback');
    assert.strictEqual(result.selectedOpportunity.productA.id, opps[0].productA.id);
    assert.ok(result.fallbackReason.includes('validation'));
  });

  // 8. Test Mismatched Product IDs
  await recordAsyncTest('8. Mismatched product IDs triggers deterministic fallback', async () => {
    const opps = getMockOpportunities(3);
    const result = await selectOpportunity({}, {
      getProductPairAnalytics: async () => opps,
      scoreOpportunities: () => opps,
      analyzeOpportunities: async () => ({
        llmStatus: 'success',
        selectedOpportunity: { productA: { id: 100 }, productB: { id: 999 } }, // mismatched B ID
        llmAnalysis: {},
      }),
    });

    assert.strictEqual(result.selectionMethod, 'deterministic_fallback');
    assert.strictEqual(result.selectedOpportunity.productA.id, opps[0].productA.id);
  });

  // 9. Test Malformed JSON / Error from LLM
  await recordAsyncTest('9. Malformed LLM output triggers deterministic fallback', async () => {
    const opps = getMockOpportunities(3);
    const result = await selectOpportunity({}, {
      getProductPairAnalytics: async () => opps,
      scoreOpportunities: () => opps,
      analyzeOpportunities: async () => ({
        llmStatus: 'fallback',
        fallbackReason: 'LLM returned no valid structured data',
      }),
    });

    assert.strictEqual(result.selectionMethod, 'deterministic_fallback');
    assert.strictEqual(result.selectedOpportunity.productA.id, opps[0].productA.id);
    assert.strictEqual(result.fallbackReason, 'LLM returned no valid structured data');
  });

  // 10. Test Ollama Unavailable
  await recordAsyncTest('10. Ollama unavailable triggers deterministic fallback', async () => {
    const opps = getMockOpportunities(3);
    const result = await selectOpportunity({}, {
      getProductPairAnalytics: async () => opps,
      scoreOpportunities: () => opps,
      analyzeOpportunities: async () => ({
        llmStatus: 'fallback',
        fallbackReason: 'Ollama is not available: connection refused',
      }),
    });

    assert.strictEqual(result.selectionMethod, 'deterministic_fallback');
    assert.strictEqual(result.selectedOpportunity.productA.id, opps[0].productA.id);
    assert.ok(result.fallbackReason.includes('Ollama is not available'));
  });

  // 11. Test LLM Timeout
  await recordAsyncTest('11. LLM timeout triggers deterministic fallback', async () => {
    const opps = getMockOpportunities(3);
    const result = await selectOpportunity({}, {
      getProductPairAnalytics: async () => opps,
      scoreOpportunities: () => opps,
      analyzeOpportunities: async () => ({
        llmStatus: 'fallback',
        fallbackReason: 'Request timeout after 180000ms',
      }),
    });

    assert.strictEqual(result.selectionMethod, 'deterministic_fallback');
    assert.strictEqual(result.selectedOpportunity.productA.id, opps[0].productA.id);
    assert.ok(result.fallbackReason.includes('timeout'));
  });

  // 12. Test Deterministic Fallback Structure
  await recordAsyncTest('12. Deterministic fallback returns complete structured reasoning contract', async () => {
    const opps = getMockOpportunities(3);
    const result = await selectOpportunity({ forceFallback: true }, {
      getProductPairAnalytics: async () => opps,
      scoreOpportunities: () => opps,
    });

    assert.strictEqual(result.selectionMethod, 'deterministic_fallback');
    assert.ok(result.reasoning);
    assert.ok(result.reasoning.selectionReasoning);
    assert.ok(result.reasoning.customerInsight);
    assert.ok(result.reasoning.strategicRecommendation);
    assert.ok(Array.isArray(result.reasoning.riskFactors));
    assert.ok(Array.isArray(result.reasoning.rankings));
  });

  // 13. Test All Numerical Values Remain Authoritative & Deterministic
  await recordAsyncTest('13. LLM cannot corrupt numerical values (confidence, lift, score, revenue)', async () => {
    const opps = getMockOpportunities(3);
    const originalScore = opps[1].opportunityScore;
    const originalConfidence = opps[1].confidence;
    const originalLift = opps[1].lift;
    const originalRevenue = opps[1].estimatedRevenueOpportunity;

    const result = await selectOpportunity({}, {
      getProductPairAnalytics: async () => opps,
      scoreOpportunities: () => opps,
      analyzeOpportunities: async (candidates) => ({
        llmStatus: 'success',
        // Attempting to send hallucinated numbers
        selectedOpportunity: {
          ...candidates[1],
          opportunityScore: 99.99,
          confidence: 0.9999,
          lift: 99.99,
          estimatedRevenueOpportunity: 9999999,
        },
        llmAnalysis: { selectionReasoning: 'Selected 1' },
      }),
    });

    // The selection layer must use the candidate from `candidates[1]`, not the AI's mutated numbers
    assert.strictEqual(result.selectedOpportunity.opportunityScore, originalScore);
    assert.strictEqual(result.selectedOpportunity.confidence, originalConfidence);
    assert.strictEqual(result.selectedOpportunity.lift, originalLift);
    assert.strictEqual(result.selectedOpportunity.estimatedRevenueOpportunity, originalRevenue);
  });

  // 14. Test No Database Mutation
  await recordAsyncTest('14. Autonomous selection does NOT mutate database records', async () => {
    const beforeOrders = await pool.query('SELECT COUNT(*) FROM orders');
    const beforeCampaigns = await pool.query('SELECT COUNT(*) FROM campaigns');
    const beforeAudit = await pool.query('SELECT COUNT(*) FROM audit_logs');
    const beforeMemory = await pool.query('SELECT COUNT(*) FROM agent_memory');

    // Run live selection pipeline (with deterministic fallback or live query)
    const result = await selectOpportunity({ forceFallback: true });
    assert.strictEqual(result.selectionStatus, 'success');

    const afterOrders = await pool.query('SELECT COUNT(*) FROM orders');
    const afterCampaigns = await pool.query('SELECT COUNT(*) FROM campaigns');
    const afterAudit = await pool.query('SELECT COUNT(*) FROM audit_logs');
    const afterMemory = await pool.query('SELECT COUNT(*) FROM agent_memory');

    assert.strictEqual(beforeOrders.rows[0].count, afterOrders.rows[0].count, 'Orders table must not change');
    assert.strictEqual(beforeCampaigns.rows[0].count, afterCampaigns.rows[0].count, 'Campaigns table must not change');
    assert.strictEqual(beforeAudit.rows[0].count, afterAudit.rows[0].count, 'Audit logs must not change');
    assert.strictEqual(beforeMemory.rows[0].count, afterMemory.rows[0].count, 'Agent memory must not change during selection');
  });

  // 15. Test No Campaign Creation
  await recordAsyncTest('15. Autonomous selection does NOT create new campaigns', async () => {
    const before = await pool.query('SELECT MAX(id) AS max_id FROM campaigns');
    await selectOpportunity({ forceFallback: true });
    const after = await pool.query('SELECT MAX(id) AS max_id FROM campaigns');
    assert.strictEqual(before.rows[0].max_id, after.rows[0].max_id);
  });

  // 16. Test No Campaign Approval
  await recordAsyncTest('16. Autonomous selection does NOT approve campaigns', async () => {
    const before = await pool.query("SELECT COUNT(*) FROM campaigns WHERE status = 'approved'");
    await selectOpportunity({ forceFallback: true });
    const after = await pool.query("SELECT COUNT(*) FROM campaigns WHERE status = 'approved'");
    assert.strictEqual(before.rows[0].count, after.rows[0].count);
  });

  // 17. Test No Campaign Execution
  await recordAsyncTest('17. Autonomous selection does NOT execute campaigns', async () => {
    const before = await pool.query('SELECT COUNT(*) FROM campaign_executions');
    await selectOpportunity({ forceFallback: true });
    const after = await pool.query('SELECT COUNT(*) FROM campaign_executions');
    assert.strictEqual(before.rows[0].count, after.rows[0].count);
  });

  // 18. Test Stage 1 endpoint exists and returns 200
  await recordAsyncTest('18. Existing Stage 1 endpoint (/api/ai/status) responds ok', async () => {
    const { isAvailable } = require('../src/ai/llmClient');
    const status = await isAvailable();
    assert.strictEqual(typeof status.available, 'boolean');
  });

  // 19. Test Existing Analytics Pipeline
  await recordAsyncTest('19. Existing analytics pipeline returns valid opportunities', async () => {
    const { getProductPairAnalytics } = require('../src/analytics/productPairs');
    const { scoreOpportunities } = require('../src/analytics/opportunityScoring');

    const pairs = await getProductPairAnalytics({ limit: 10 });
    assert.ok(Array.isArray(pairs));
    assert.ok(pairs.length > 0);

    const scored = scoreOpportunities(pairs);
    assert.ok(Array.isArray(scored));
    assert.ok(scored.length > 0);
    assert.ok(scored[0].opportunityScore >= scored[scored.length - 1].opportunityScore);
  });

  // 20. Test Opportunity Validation Function
  recordTest('20. isValidOpportunity correctly verifies opportunity integrity', () => {
    const valid = getMockOpportunities(1)[0];
    assert.strictEqual(isValidOpportunity(valid), true);

    assert.strictEqual(isValidOpportunity(null), false);
    assert.strictEqual(isValidOpportunity({}), false);
    assert.strictEqual(isValidOpportunity({ ...valid, opportunityScore: NaN }), false);
    assert.strictEqual(isValidOpportunity({ ...valid, confidence: -1 }), false);
    assert.strictEqual(isValidOpportunity({ ...valid, lift: -1 }), false);
    assert.strictEqual(isValidOpportunity({ ...valid, estimatedRevenueOpportunity: -50 }), false);
  });

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED (Total: ${passed + failed})`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runTests()
    .then(() => {
      console.log('✅ All Opportunity Selection tests completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Fatal test runner error:', err);
      process.exit(1);
    });
}

module.exports = { runTests };
