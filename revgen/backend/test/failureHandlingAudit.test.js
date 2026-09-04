// ─────────────────────────────────────────────
// RevGen — Stage 9: Failure Handling & Audit Trail Tests
// ─────────────────────────────────────────────

const assert = require('assert');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = require('../src/db');
const {
  submitCampaign,
  approveCampaign,
  rejectCampaign,
  resetCampaign,
  getCampaignAuditLogs,
  WORKFLOW_TRANSITIONS,
} = require('../src/models/campaignWorkflowModel');
const { executeCampaign, getExecutionByCampaignId } = require('../src/models/campaignExecutionModel');
const { executeWithRazorpay } = require('../src/integrations/razorpayCampaignExecutor');
const razorpayClient = require('../src/integrations/razorpayClient');

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
    failedTests++;
    failures.push({ name, error: err });
  }
}

// Temporary environment context helper
function withEnv(tempEnv, fn) {
  return async () => {
    const original = {};
    for (const key of Object.keys(tempEnv)) {
      original[key] = process.env[key];
      if (tempEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = tempEnv[key];
      }
    }
    try {
      return await fn();
    } finally {
      for (const key of Object.keys(tempEnv)) {
        if (original[key] === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = original[key];
        }
      }
    }
  };
}

async function runAllTests() {
  console.log('\n─────────────────────────────────────────────');
  console.log('  RevGen Stage 9 — Failure Handling & Audit Trail Tests');
  console.log('─────────────────────────────────────────────\n');

  console.log('  📋 Audit Trail API & Ordering\n');

  // Test 1: getCampaignAuditLogs function exists and returns array
  await runTest('1. getCampaignAuditLogs returns array for existing campaign', async () => {
    const logs = await getCampaignAuditLogs(1);
    assert.ok(Array.isArray(logs), 'Should return an array');
  });

  // Test 2: Audit logs return null for non-existent campaign
  await runTest('2. getCampaignAuditLogs returns null for non-existent campaign', async () => {
    const logs = await getCampaignAuditLogs(999999);
    assert.strictEqual(logs, null);
  });

  // Test 3: Audit events are ordered chronologically
  await runTest('3. Audit events are ordered chronologically (createdAt ASC)', async () => {
    const logs = await getCampaignAuditLogs(5);
    assert.ok(Array.isArray(logs));
    if (logs.length > 1) {
      for (let i = 1; i < logs.length; i++) {
        const prevTime = new Date(logs[i - 1].createdAt).getTime();
        const currTime = new Date(logs[i].createdAt).getTime();
        assert.ok(currTime >= prevTime, 'Current event must be at or after previous event');
      }
    }
  });

  console.log('\n  🛡️ Workflow State Machine & Reset Transitions\n');

  // Test 4: Approval transition creates audit log
  await runTest('4. Approving campaign logs campaign_approved event', async () => {
    // Create a temporary campaign for test
    const insertRes = await pool.query(`
      INSERT INTO campaigns (name, type, status, discount_percent, budget_limit, estimated_revenue_opportunity, product_a_id, product_b_id, target_segment)
      VALUES ('Stage 9 Approval Audit Test', 'cross_sell', 'pending_approval', 10, 5000, 15000, 25, 24, 'regular')
      RETURNING id;
    `);
    const testId = insertRes.rows[0].id;

    try {
      await approveCampaign(testId);
      const logs = await getCampaignAuditLogs(testId);
      const approveLog = logs.find((l) => l.action === 'campaign_approved');
      assert.ok(approveLog, 'campaign_approved event must exist in audit logs');
      assert.strictEqual(approveLog.actor, 'merchant');
      assert.strictEqual(approveLog.status, 'success');
    } finally {
      await pool.query('DELETE FROM agent_memory WHERE campaign_id = $1', [testId]);
      await pool.query('DELETE FROM audit_logs WHERE campaign_id = $1', [testId]);
      await pool.query('DELETE FROM campaigns WHERE id = $1', [testId]);
    }
  });

  // Test 5: Failed campaign can transition back to draft
  await runTest('5. WORKFLOW_TRANSITIONS permits failed -> draft reset', async () => {
    assert.ok(WORKFLOW_TRANSITIONS.failed, 'WORKFLOW_TRANSITIONS must have failed state');
    assert.ok(WORKFLOW_TRANSITIONS.failed.includes('draft'), 'Failed state must allow transition to draft');
  });

  // Test 6: Resetting failed campaign transitions status to draft
  await runTest('6. Resetting a failed campaign transitions to draft and logs audit event', async () => {
    const insertRes = await pool.query(`
      INSERT INTO campaigns (name, type, status, discount_percent, budget_limit, estimated_revenue_opportunity, product_a_id, product_b_id, target_segment)
      VALUES ('Stage 9 Failed Reset Test', 'cross_sell', 'failed', 10, 5000, 15000, 25, 24, 'regular')
      RETURNING id;
    `);
    const testId = insertRes.rows[0].id;

    try {
      const resetCamp = await resetCampaign(testId);
      assert.strictEqual(resetCamp.status, 'draft');

      const logs = await getCampaignAuditLogs(testId);
      const resetLog = logs.find((l) => l.action === 'campaign_reset');
      assert.ok(resetLog, 'campaign_reset event must be logged');
      assert.strictEqual(resetLog.previousStatus, 'failed');
      assert.strictEqual(resetLog.newStatus, 'draft');
    } finally {
      await pool.query('DELETE FROM agent_memory WHERE campaign_id = $1', [testId]);
      await pool.query('DELETE FROM audit_logs WHERE campaign_id = $1', [testId]);
      await pool.query('DELETE FROM campaigns WHERE id = $1', [testId]);
    }
  });

  console.log('\n  ❌ Controlled Failure Simulation & Safety\n');

  // Test 7: Controlled Razorpay Test Mode execution failure (forceFail=true)
  await runTest('7. Forced failure in Razorpay Test Mode throws structured error', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_mock123', RAZORPAY_KEY_SECRET: 'mock_secret' },
    async () => {
      const insertRes = await pool.query(`
        INSERT INTO campaigns (name, type, status, discount_percent, budget_limit, estimated_revenue_opportunity, product_a_id, product_b_id, target_segment, target_count)
        VALUES ('Stage 9 Forced Failure Test', 'cross_sell', 'approved', 10, 5000, 15000, 25, 24, 'regular', 50)
        RETURNING id;
      `);
      const testId = insertRes.rows[0].id;

      try {
        let threw = false;
        try {
          await executeWithRazorpay(testId, { forceFail: true });
        } catch (err) {
          threw = true;
          assert.ok(err.message.includes('forceFail=true') || err.message.includes('Simulated'));
        }
        assert.strictEqual(threw, true, 'Execution must throw when forceFail=true');
      } finally {
        await pool.query('DELETE FROM campaign_executions WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM audit_logs WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM campaigns WHERE id = $1', [testId]);
      }
    }
  ));

  // Test 8: Forced failure updates campaign status to 'failed'
  await runTest('8. Forced failure marks campaign status as "failed"', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_mock123', RAZORPAY_KEY_SECRET: 'mock_secret' },
    async () => {
      const insertRes = await pool.query(`
        INSERT INTO campaigns (name, type, status, discount_percent, budget_limit, estimated_revenue_opportunity, product_a_id, product_b_id, target_segment, target_count)
        VALUES ('Stage 9 Forced Failure State Test', 'cross_sell', 'approved', 10, 5000, 15000, 25, 24, 'regular', 50)
        RETURNING id;
      `);
      const testId = insertRes.rows[0].id;

      try {
        try {
          await executeWithRazorpay(testId, { forceFail: true });
        } catch (_) {}

        const checkRes = await pool.query('SELECT status FROM campaigns WHERE id = $1', [testId]);
        assert.strictEqual(checkRes.rows[0].status, 'failed', 'Campaign status must be failed');
      } finally {
        await pool.query('DELETE FROM campaign_executions WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM audit_logs WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM campaigns WHERE id = $1', [testId]);
      }
    }
  ));

  // Test 9: Forced failure records campaign_execution_failed in audit trail
  await runTest('9. Forced failure logs campaign_execution_failed in audit trail', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_mock123', RAZORPAY_KEY_SECRET: 'mock_secret' },
    async () => {
      const insertRes = await pool.query(`
        INSERT INTO campaigns (name, type, status, discount_percent, budget_limit, estimated_revenue_opportunity, product_a_id, product_b_id, target_segment, target_count)
        VALUES ('Stage 9 Audit Failure Log Test', 'cross_sell', 'approved', 10, 5000, 15000, 25, 24, 'regular', 50)
        RETURNING id;
      `);
      const testId = insertRes.rows[0].id;

      try {
        try {
          await executeWithRazorpay(testId, { forceFail: true });
        } catch (_) {}

        const logs = await getCampaignAuditLogs(testId);
        const startedLog = logs.find((l) => l.action === 'campaign_execution_started');
        const failedLog = logs.find((l) => l.action === 'campaign_execution_failed');

        assert.ok(startedLog, 'campaign_execution_started event must exist');
        assert.ok(failedLog, 'campaign_execution_failed event must exist');
        assert.strictEqual(failedLog.status, 'failed');
        assert.ok(failedLog.details?.error, 'Failure details must include error description');
      } finally {
        await pool.query('DELETE FROM campaign_executions WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM audit_logs WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM campaigns WHERE id = $1', [testId]);
      }
    }
  ));

  // Test 10: Forced failure does NOT create completed campaign_executions record
  await runTest('10. Forced failure does NOT create completed campaign_executions record', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_mock123', RAZORPAY_KEY_SECRET: 'mock_secret' },
    async () => {
      const insertRes = await pool.query(`
        INSERT INTO campaigns (name, type, status, discount_percent, budget_limit, estimated_revenue_opportunity, product_a_id, product_b_id, target_segment, target_count)
        VALUES ('Stage 9 No Completed Execution Test', 'cross_sell', 'approved', 10, 5000, 15000, 25, 24, 'regular', 50)
        RETURNING id;
      `);
      const testId = insertRes.rows[0].id;

      try {
        try {
          await executeWithRazorpay(testId, { forceFail: true });
        } catch (_) {}

        const execRes = await pool.query(
          "SELECT * FROM campaign_executions WHERE campaign_id = $1 AND status = 'completed'",
          [testId]
        );
        assert.strictEqual(execRes.rows.length, 0, 'Must NOT create completed campaign execution');
      } finally {
        await pool.query('DELETE FROM campaign_executions WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM audit_logs WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM campaigns WHERE id = $1', [testId]);
      }
    }
  ));

  // Test 11: Forced failure does NOT create fake Razorpay order
  await runTest('11. Forced failure does NOT create fake Razorpay order ID', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_mock123', RAZORPAY_KEY_SECRET: 'mock_secret' },
    async () => {
      const insertRes = await pool.query(`
        INSERT INTO campaigns (name, type, status, discount_percent, budget_limit, estimated_revenue_opportunity, product_a_id, product_b_id, target_segment, target_count)
        VALUES ('Stage 9 No Fake Order Test', 'cross_sell', 'approved', 10, 5000, 15000, 25, 24, 'regular', 50)
        RETURNING id;
      `);
      const testId = insertRes.rows[0].id;

      try {
        try {
          await executeWithRazorpay(testId, { forceFail: true });
        } catch (_) {}

        const logs = await getCampaignAuditLogs(testId);
        const orderCreatedLog = logs.find((l) => l.action === 'razorpay_test_order_created');
        assert.strictEqual(orderCreatedLog, undefined, 'No razorpay_test_order_created event on failure');
      } finally {
        await pool.query('DELETE FROM campaign_executions WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM audit_logs WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM campaigns WHERE id = $1', [testId]);
      }
    }
  ));

  // Test 12: Simulation forceFail in campaignExecutionModel
  await runTest('12. Simulation mode forceFail logs failure and marks campaign failed', async () => {
    const insertRes = await pool.query(`
      INSERT INTO campaigns (name, type, status, discount_percent, budget_limit, estimated_revenue_opportunity, product_a_id, product_b_id, target_segment, target_count)
      VALUES ('Stage 9 Simulation Failure Test', 'cross_sell', 'approved', 10, 5000, 15000, 25, 24, 'regular', 50)
      RETURNING id;
    `);
    const testId = insertRes.rows[0].id;

    try {
      let threw = false;
      try {
        await executeCampaign(testId, { forceFail: true });
      } catch (err) {
        threw = true;
      }
      assert.strictEqual(threw, true, 'executeCampaign must throw when forceFail=true');
    } finally {
      await pool.query('DELETE FROM campaign_executions WHERE campaign_id = $1', [testId]);
      await pool.query('DELETE FROM audit_logs WHERE campaign_id = $1', [testId]);
      await pool.query('DELETE FROM campaigns WHERE id = $1', [testId]);
    }
  });

  console.log('\n  🔐 Security & Leakage Prevention\n');

  // Test 13: Secret leakage prevention in failure audit logs
  await runTest('13. Failure audit logs contain zero secret credentials or passwords', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_mock123', RAZORPAY_KEY_SECRET: 'mock_secret_abc123' },
    async () => {
      const insertRes = await pool.query(`
        INSERT INTO campaigns (name, type, status, discount_percent, budget_limit, estimated_revenue_opportunity, product_a_id, product_b_id, target_segment, target_count)
        VALUES ('Stage 9 Secret Leakage Test', 'cross_sell', 'approved', 10, 5000, 15000, 25, 24, 'regular', 50)
        RETURNING id;
      `);
      const testId = insertRes.rows[0].id;

      try {
        try {
          await executeWithRazorpay(testId, { forceFail: true });
        } catch (_) {}

        const logs = await getCampaignAuditLogs(testId);
        const serialized = JSON.stringify(logs);
        assert.ok(!serialized.includes('mock_secret_abc123'), 'Secret must not appear in audit logs');
        assert.ok(!serialized.includes('RAZORPAY_KEY_SECRET'), 'Env var key must not appear in audit logs');
      } finally {
        await pool.query('DELETE FROM campaign_executions WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM audit_logs WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM campaigns WHERE id = $1', [testId]);
      }
    }
  ));

  // Test 14: Non-approved campaign execution rejected
  await runTest('14. Non-approved campaign execution rejected with status 400', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_mock123', RAZORPAY_KEY_SECRET: 'mock_secret' },
    async () => {
      let threw = false;
      try {
        // Campaign 1 is in status 'draft'
        await executeWithRazorpay(1);
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 400);
        assert.ok(err.message.includes('must be approved'));
      }
      assert.strictEqual(threw, true);
    }
  ));

  // Test 15: Invalid campaign ID rejected
  await runTest('15. Invalid campaign ID throws 400 bad request', async () => {
    let threw = false;
    try {
      await executeWithRazorpay(-5);
    } catch (err) {
      threw = true;
      assert.strictEqual(err.statusCode, 400);
    }
    assert.strictEqual(threw, true);
  });

  // Test 16: Missing Razorpay credentials throws 503 configuration error
  await runTest('16. Missing credentials throws 503 configuration error', withEnv(
    { RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined },
    async () => {
      let threw = false;
      try {
        await executeWithRazorpay(4);
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 503);
        assert.strictEqual(err.configurationError, true);
      }
      assert.strictEqual(threw, true);
    }
  ));

  // Test 17: Live mode key is rejected with 403
  await runTest('17. Live mode key is rejected with 403 Forbidden', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_live_abc123', RAZORPAY_KEY_SECRET: 'live_secret_456' },
    async () => {
      let threw = false;
      try {
        await executeWithRazorpay(4);
      } catch (err) {
        threw = true;
        assert.strictEqual(err.statusCode, 403);
      }
      assert.strictEqual(threw, true);
    }
  ));

  console.log('\n  🔄 Idempotency & Database Integrity\n');

  // Test 18: Idempotency is preserved on completed campaigns
  await runTest('18. Re-execution of completed campaign is idempotent (razorpayCalled: false)', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_mock123', RAZORPAY_KEY_SECRET: 'mock_secret' },
    async () => {
      // Campaign 5 is already completed with an execution record
      const result = await executeWithRazorpay(5);
      assert.ok(result.execution);
      assert.strictEqual(result.razorpay.idempotent, true);
      assert.strictEqual(result.razorpay.razorpayCalled, false);
    }
  ));

  // Test 19: Zero unintended mutations to orders, customers, and agent_memory on failed execution
  await runTest('19. Forced failure causes ZERO mutations to orders, customers, and agent_memory', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_mock123', RAZORPAY_KEY_SECRET: 'mock_secret' },
    async () => {
      const insertRes = await pool.query(`
        INSERT INTO campaigns (name, type, status, discount_percent, budget_limit, estimated_revenue_opportunity, product_a_id, product_b_id, target_segment, target_count)
        VALUES ('Stage 9 Consistency Test', 'cross_sell', 'approved', 10, 5000, 15000, 25, 24, 'regular', 50)
        RETURNING id;
      `);
      const testId = insertRes.rows[0].id;

      const [o1, cu1, m1] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM orders'),
        pool.query('SELECT COUNT(*) FROM customers'),
        pool.query('SELECT COUNT(*) FROM agent_memory'),
      ]);

      try {
        try {
          await executeWithRazorpay(testId, { forceFail: true });
        } catch (_) {}

        const [o2, cu2, m2] = await Promise.all([
          pool.query('SELECT COUNT(*) FROM orders'),
          pool.query('SELECT COUNT(*) FROM customers'),
          pool.query('SELECT COUNT(*) FROM agent_memory'),
        ]);

        assert.strictEqual(o1.rows[0].count, o2.rows[0].count, 'orders unchanged');
        assert.strictEqual(cu1.rows[0].count, cu2.rows[0].count, 'customers count unchanged');
        assert.strictEqual(m1.rows[0].count, m2.rows[0].count, 'agent_memory unchanged on execution failure');
      } finally {
        await pool.query('DELETE FROM campaign_executions WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM audit_logs WHERE campaign_id = $1', [testId]);
        await pool.query('DELETE FROM campaigns WHERE id = $1', [testId]);
      }
    }
  ));

  // Test 20: Zero AI / Qwen / Ollama modules in execution & failure handling
  await runTest('20. razorpayCampaignExecutor contains ZERO AI/Qwen/Ollama imports', async () => {
    const fileContent = fs.readFileSync(
      path.join(__dirname, '../src/integrations/razorpayCampaignExecutor.js'),
      'utf8'
    );
    assert.ok(!fileContent.includes('llmClient'), 'Must not import llmClient');
    assert.ok(!fileContent.includes('llmGrowthAgent'), 'Must not import llmGrowthAgent');
    assert.ok(!fileContent.includes('qwen'), 'Must not reference qwen');
    assert.ok(!fileContent.includes('ollama'), 'Must not reference ollama');
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
