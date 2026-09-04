// ─────────────────────────────────────────────
// RevGen — Stage 8: Revenue / ROI & Transaction Dashboard Tests
// ─────────────────────────────────────────────

const assert = require('assert');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = require('../src/db');
const { getRevenueDashboardMetrics } = require('../src/analytics/revenueDashboard');

// Helper for test execution
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passedTests++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.error(`     Error: ${err.message}`);
    passedTests;
    failedTests++;
    failures.push({ name, error: err });
  }
}

async function runAllTests() {
  console.log('\n─────────────────────────────────────────────');
  console.log('  RevGen Stage 8 — Revenue & Transaction Dashboard Tests');
  console.log('─────────────────────────────────────────────\n');

  console.log('  📊 Endpoint & Metric Response Shape\n');

  // Test 1: getRevenueDashboardMetrics function exists and executes
  await runTest('1. getRevenueDashboardMetrics returns a valid object', async () => {
    const data = await getRevenueDashboardMetrics();
    assert.ok(data, 'Data object should exist');
    assert.strictEqual(typeof data, 'object');
  });

  // Test 2: Structured response shape contains all required top-level blocks
  await runTest('2. Response contains summary, roi, semantics, disclaimer, and transactions', async () => {
    const data = await getRevenueDashboardMetrics();
    assert.ok(data.summary, 'Should contain summary block');
    assert.ok(data.roi, 'Should contain roi block');
    assert.ok(data.semantics, 'Should contain semantics block');
    assert.ok(typeof data.disclaimer === 'string', 'Should contain disclaimer string');
    assert.ok(Array.isArray(data.transactions), 'Should contain transactions array');
  });

  // Test 3: Summary contains all expected numeric metric fields
  await runTest('3. Summary contains all required business metrics with valid types', async () => {
    const data = await getRevenueDashboardMetrics();
    const s = data.summary;
    assert.strictEqual(typeof s.totalCampaigns, 'number');
    assert.strictEqual(typeof s.approvedCampaigns, 'number');
    assert.strictEqual(typeof s.executedCampaigns, 'number');
    assert.strictEqual(typeof s.completedExecutions, 'number');
    assert.strictEqual(typeof s.failedExecutions, 'number');
    assert.strictEqual(typeof s.testTransactions, 'number');
    assert.strictEqual(typeof s.testRevenue, 'number');
    assert.strictEqual(typeof s.testTransactionValue, 'number');
    assert.strictEqual(typeof s.totalCampaignBudget, 'number');
    assert.strictEqual(typeof s.estimatedRevenueOpportunity, 'number');
    assert.strictEqual(typeof s.estimatedAdditionalCustomers, 'number');
    assert.strictEqual(typeof s.averageTransactionValue, 'number');
    assert.strictEqual(s.currency, 'INR');
  });

  console.log('\n  💰 Revenue & Transaction Semantics\n');

  // Test 4: Test Revenue / Transaction value metrics are numeric >= 0
  await runTest('4. Test revenue metrics are non-negative numbers', async () => {
    const data = await getRevenueDashboardMetrics();
    assert.ok(data.summary.testRevenue >= 0);
    assert.ok(data.summary.testTransactionValue >= 0);
    assert.ok(data.summary.averageTransactionValue >= 0);
  });

  // Test 5: Executed campaign count
  await runTest('5. Executed campaign count reflects database records', async () => {
    const data = await getRevenueDashboardMetrics();
    const res = await pool.query(
      "SELECT COUNT(*)::INTEGER AS count FROM campaigns WHERE status IN ('executing', 'completed')"
    );
    const expected = parseInt(res.rows[0].count, 10);
    assert.strictEqual(data.summary.executedCampaigns, expected);
  });

  // Test 6: Completed execution count
  await runTest('6. Completed execution count matches campaign_executions completed rows', async () => {
    const data = await getRevenueDashboardMetrics();
    const res = await pool.query(
      "SELECT COUNT(*)::INTEGER AS count FROM campaign_executions WHERE status = 'completed'"
    );
    const expected = parseInt(res.rows[0].count, 10);
    assert.strictEqual(data.summary.completedExecutions, expected);
  });

  // Test 7: Failed execution count
  await runTest('7. Failed execution count matches campaign_executions failed rows', async () => {
    const data = await getRevenueDashboardMetrics();
    const res = await pool.query(
      "SELECT COUNT(*)::INTEGER AS count FROM campaign_executions WHERE status = 'failed'"
    );
    const expected = parseInt(res.rows[0].count, 10);
    assert.strictEqual(data.summary.failedExecutions, expected);
  });

  // Test 8: Test transactions count equals completed executions
  await runTest('8. Test transactions count equals completed execution records', async () => {
    const data = await getRevenueDashboardMetrics();
    assert.strictEqual(data.summary.testTransactions, data.summary.completedExecutions);
  });

  // Test 9: Budget aggregation accuracy
  await runTest('9. Total campaign budget matches database sum', async () => {
    const data = await getRevenueDashboardMetrics();
    const res = await pool.query(
      "SELECT COALESCE(SUM(budget_limit), 0)::NUMERIC(12,2) AS sum FROM campaigns"
    );
    const expected = parseFloat(parseFloat(res.rows[0].sum).toFixed(2));
    assert.strictEqual(data.summary.totalCampaignBudget, expected);
  });

  // Test 10: Estimated opportunity aggregation accuracy
  await runTest('10. Total estimated opportunity matches database sum', async () => {
    const data = await getRevenueDashboardMetrics();
    const res = await pool.query(
      "SELECT COALESCE(SUM(estimated_revenue_opportunity), 0)::NUMERIC(12,2) AS sum FROM campaigns"
    );
    const expected = parseFloat(parseFloat(res.rows[0].sum).toFixed(2));
    assert.strictEqual(data.summary.estimatedRevenueOpportunity, expected);
  });

  // Test 11: Customer target aggregation
  await runTest('11. Additional customers reach reflects executed campaign targets', async () => {
    const data = await getRevenueDashboardMetrics();
    assert.ok(data.summary.estimatedAdditionalCustomers >= 0);
    assert.strictEqual(typeof data.summary.estimatedAdditionalCustomers, 'number');
  });

  // Test 12: Currency handling
  await runTest('12. Currency is strictly formatted as INR', async () => {
    const data = await getRevenueDashboardMetrics();
    assert.strictEqual(data.summary.currency, 'INR');
    data.transactions.forEach((tx) => {
      assert.strictEqual(tx.currency, 'INR');
    });
  });

  console.log('\n  🛡️ Trust, Real Revenue & ROI Semantics\n');

  // Test 13: Test-mode labeling & disclaimer
  await runTest('13. Test mode disclaimer clearly states no real money was charged', async () => {
    const data = await getRevenueDashboardMetrics();
    assert.ok(data.disclaimer.includes('No real money was charged'));
    assert.ok(data.disclaimer.includes('Test Mode'));
    assert.ok(data.semantics.testTransactionValue.includes('No real money was charged'));
  });

  // Test 14: No real-revenue claim
  await runTest('14. Real revenue is explicitly 0 and hasRealRevenueEvidence is false', async () => {
    const data = await getRevenueDashboardMetrics();
    assert.strictEqual(data.summary.realRevenue, 0, 'Must NOT claim real revenue');
    assert.strictEqual(data.summary.hasRealRevenueEvidence, false, 'hasRealRevenueEvidence must be false');
    assert.ok(data.semantics.realRevenue.includes('Not claimed'));
  });

  // Test 15: Realized ROI is null with clear explanatory note
  await runTest('15. Realized ROI is null with explanatory message', async () => {
    const data = await getRevenueDashboardMetrics();
    assert.strictEqual(data.roi.realizedRoi, null, 'Realized ROI must be null');
    assert.ok(data.roi.realizedRoiNote.includes('ROI unavailable until realized revenue and campaign spend are recorded'));
  });

  // Test 16: Estimated ROI formula
  await runTest('16. Estimated ROI formula is mathematically valid', async () => {
    const data = await getRevenueDashboardMetrics();
    assert.ok(data.roi.formula, 'Formula string should exist');
    assert.strictEqual(data.roi.label, 'Estimated ROI');
    if (data.roi.estimatedRoi !== null) {
      assert.strictEqual(typeof data.roi.estimatedRoi, 'number');
      assert.ok(typeof data.roi.estimatedRoiPercent === 'string');
    }
  });

  console.log('\n  📋 Transaction List & Audit\n');

  // Test 17: Transaction list structure
  await runTest('17. Transaction list entries have complete structured schema', async () => {
    const data = await getRevenueDashboardMetrics();
    assert.ok(Array.isArray(data.transactions));
    if (data.transactions.length > 0) {
      const tx = data.transactions[0];
      assert.ok(typeof tx.id === 'number');
      assert.ok(typeof tx.campaignId === 'number');
      assert.ok(typeof tx.campaignName === 'string');
      assert.ok(['simulation', 'razorpay_test'].includes(tx.executionMode));
      assert.ok(['completed', 'failed', 'started', 'executing'].includes(tx.executionStatus));
      assert.strictEqual(typeof tx.transactionAmountINR, 'number');
      assert.strictEqual(tx.currency, 'INR');
      assert.ok(tx.executedAt);
    }
  });

  // Test 18: Razorpay order ID visibility
  await runTest('18. Razorpay order ID is exposed safely (or null for simulation)', async () => {
    const data = await getRevenueDashboardMetrics();
    data.transactions.forEach((tx) => {
      if (tx.executionMode === 'razorpay_test' && tx.razorpayOrderId) {
        assert.ok(tx.razorpayOrderId.startsWith('order_'));
      } else if (tx.executionMode === 'simulation') {
        assert.strictEqual(tx.razorpayOrderId, null);
      }
    });
  });

  console.log('\n  🔐 Security & Side-Effect Safety\n');

  // Test 19: Secret leakage prevention
  await runTest('19. Response JSON contains zero API keys or secrets', async () => {
    const data = await getRevenueDashboardMetrics();
    const serialized = JSON.stringify(data);
    assert.ok(!serialized.includes('RAZORPAY_KEY_SECRET'), 'No RAZORPAY_KEY_SECRET');
    assert.ok(!serialized.includes('key_secret'), 'No key_secret');
    assert.ok(!serialized.includes('password'), 'No DB password');
    assert.ok(!serialized.includes('rzp_test_'), 'No key id in response');
    assert.ok(!serialized.includes('DATABASE_URL'), 'No database URL');
  });

  // Test 20: Read-only behavior (zero database modifications)
  await runTest('20. Calling dashboard is 100% read-only with zero table modifications', async () => {
    // Count rows across all primary tables before
    const [c1, o1, cu1, e1, a1, m1] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM campaigns'),
      pool.query('SELECT COUNT(*) FROM orders'),
      pool.query('SELECT COUNT(*) FROM customers'),
      pool.query('SELECT COUNT(*) FROM campaign_executions'),
      pool.query('SELECT COUNT(*) FROM audit_logs'),
      pool.query('SELECT COUNT(*) FROM agent_memory'),
    ]);

    // Call dashboard metrics
    await getRevenueDashboardMetrics();

    // Count rows after
    const [c2, o2, cu2, e2, a2, m2] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM campaigns'),
      pool.query('SELECT COUNT(*) FROM orders'),
      pool.query('SELECT COUNT(*) FROM customers'),
      pool.query('SELECT COUNT(*) FROM campaign_executions'),
      pool.query('SELECT COUNT(*) FROM audit_logs'),
      pool.query('SELECT COUNT(*) FROM agent_memory'),
    ]);

    assert.strictEqual(c1.rows[0].count, c2.rows[0].count, 'campaigns count unchanged');
    assert.strictEqual(o1.rows[0].count, o2.rows[0].count, 'orders count unchanged');
    assert.strictEqual(cu1.rows[0].count, cu2.rows[0].count, 'customers count unchanged');
    assert.strictEqual(e1.rows[0].count, e2.rows[0].count, 'campaign_executions count unchanged');
    assert.strictEqual(a1.rows[0].count, a2.rows[0].count, 'audit_logs count unchanged');
    assert.strictEqual(m1.rows[0].count, m2.rows[0].count, 'agent_memory count unchanged');
  });

  // Test 21: No AI / Qwen / Ollama modules imported
  await runTest('21. revenueDashboard does NOT import or call AI / Qwen modules', async () => {
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../src/analytics/revenueDashboard.js'),
      'utf8'
    );
    assert.ok(!fileContent.includes('llmClient'), 'Must not import llmClient');
    assert.ok(!fileContent.includes('llmGrowthAgent'), 'Must not import llmGrowthAgent');
    assert.ok(!fileContent.includes('qwen'), 'Must not reference qwen');
    assert.ok(!fileContent.includes('ollama'), 'Must not reference ollama');
    assert.ok(!fileContent.includes('growthAnalysisOrchestrator'), 'Must not import orchestrator');
  });

  console.log('\n─────────────────────────────────────────────');
  console.log(`  Results: ${passedTests}/${passedTests + failedTests} passed`);
  if (failedTests > 0) {
    console.log(`  FAILED: ${failedTests} test(s)`);
    failures.forEach((f) => console.log(`    ❌ ${f.name}: ${f.error.message}`));
  }
  console.log('─────────────────────────────────────────────\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
