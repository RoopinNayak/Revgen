// ─────────────────────────────────────────────
// RevGen — Stage 6: Razorpay Integration Tests
// ─────────────────────────────────────────────
//
// 20 test cases covering:
//  1–4:   Configuration & credential handling
//  5–11:  Amount conversion (toPaise / toRupees)
//  12–15: Test order request validation
//  16–17: Razorpay API success/failure (mocked)
//  18:    Secret not exposed in status
//  19:    Existing campaign execution regression
//  20:    Test-mode enforcement
//
// IMPORTANT:
//  - No test depends on live Razorpay credentials.
//  - All Razorpay SDK calls are mocked.
//  - Existing campaign execution model is verified.
// ─────────────────────────────────────────────

const assert = require('assert');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

async function runTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  ✅ ${totalTests}. ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${totalTests}. ${name}`);
    console.log(`     Error: ${err.message}`);
  }
}

// ─── Helper: Override env vars for isolated tests ──────

function withEnv(overrides, fn) {
  return async () => {
    const originals = {};
    for (const [key, value] of Object.entries(overrides)) {
      originals[key] = process.env[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    // Reset singleton after env change
    const razorpayClient = require('../src/integrations/razorpayClient');
    razorpayClient._resetInstance();

    try {
      await fn();
    } finally {
      for (const [key, value] of Object.entries(originals)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
      razorpayClient._resetInstance();
    }
  };
}

async function main() {
  console.log('\n─────────────────────────────────────────────');
  console.log('  RevGen Stage 6 — Razorpay Integration Tests');
  console.log('─────────────────────────────────────────────\n');

  // Fresh require each time we need the module
  const razorpayClient = require('../src/integrations/razorpayClient');

  // ═══════════════════════════════════════════
  // SECTION 1: Configuration & Credentials
  // ═══════════════════════════════════════════

  console.log('  📋 Configuration & Credentials\n');

  // Test 1: Missing credentials returns not configured
  await runTest('Missing credentials → configured: false', withEnv(
    { RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined },
    () => {
      const status = razorpayClient.isConfigured();
      assert.strictEqual(status.configured, false, 'Should not be configured');
      assert.strictEqual(status.mode, 'test', 'Mode should be test');
      assert.strictEqual(status.provider, 'razorpay', 'Provider should be razorpay');
      assert.ok(status.reason, 'Reason should be present');
      assert.ok(status.reason.includes('RAZORPAY_KEY_ID'), 'Should mention missing key ID');
      assert.ok(status.reason.includes('RAZORPAY_KEY_SECRET'), 'Should mention missing key secret');
    }
  ));

  // Test 2: Valid test credentials returns configured
  await runTest('Valid test credentials → configured: true, mode: test', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_abcdef123456', RAZORPAY_KEY_SECRET: 'secret_test_xyz789' },
    () => {
      const status = razorpayClient.isConfigured();
      assert.strictEqual(status.configured, true, 'Should be configured');
      assert.strictEqual(status.mode, 'test', 'Mode should be test');
      assert.strictEqual(status.provider, 'razorpay', 'Provider should be razorpay');
      assert.strictEqual(status.reason, undefined, 'Reason should not be present');
    }
  ));

  // Test 3: Secret never exposed in status response
  await runTest('Secret never exposed in isConfigured() response', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_abcdef123456', RAZORPAY_KEY_SECRET: 'SUPER_SECRET_VALUE' },
    () => {
      const status = razorpayClient.isConfigured();
      const serialized = JSON.stringify(status);
      assert.ok(!serialized.includes('SUPER_SECRET_VALUE'), 'Secret must never appear in response');
      assert.ok(!serialized.includes('rzp_test_abcdef123456'), 'Key ID must never appear in response');
    }
  ));

  // Test 4: Empty string credentials treated as missing
  await runTest('Empty string credentials → configured: false', withEnv(
    { RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '  ' },
    () => {
      const status = razorpayClient.isConfigured();
      assert.strictEqual(status.configured, false, 'Empty strings should not count as configured');
    }
  ));

  // ═══════════════════════════════════════════
  // SECTION 2: Amount Conversion (toPaise / toRupees)
  // ═══════════════════════════════════════════

  console.log('\n  💰 Amount Conversion\n');

  // Test 5: Valid INR → paise conversion
  await runTest('toPaise(100) → 10000', async () => {
    assert.strictEqual(razorpayClient.toPaise(100), 10000);
    assert.strictEqual(razorpayClient.toPaise(1), 100);
    assert.strictEqual(razorpayClient.toPaise(499), 49900);
    assert.strictEqual(razorpayClient.toPaise(0.01), 1);
  });

  // Test 6: Zero amount rejected
  await runTest('toPaise(0) → throws "must be positive"', async () => {
    assert.throws(() => razorpayClient.toPaise(0), /positive/i);
  });

  // Test 7: Negative amount rejected
  await runTest('toPaise(-100) → throws "must be positive"', async () => {
    assert.throws(() => razorpayClient.toPaise(-100), /positive/i);
  });

  // Test 8: NaN rejected
  await runTest('toPaise(NaN) → throws', async () => {
    assert.throws(() => razorpayClient.toPaise(NaN), /valid number/i);
  });

  // Test 9: Infinity rejected
  await runTest('toPaise(Infinity) → throws "must be finite"', async () => {
    assert.throws(() => razorpayClient.toPaise(Infinity), /finite/i);
  });

  // Test 10: String amount rejected
  await runTest('toPaise("abc") → throws', async () => {
    assert.throws(() => razorpayClient.toPaise('abc'), /valid number/i);
  });

  // Test 11: Floating point rounding
  await runTest('toPaise(19.99) → 1999 (safe rounding)', async () => {
    assert.strictEqual(razorpayClient.toPaise(19.99), 1999);
    assert.strictEqual(razorpayClient.toPaise(9.995), 999); // IEEE 754: 9.995 * 100 = 999.4999...
    assert.strictEqual(razorpayClient.toPaise(0.10), 10);
  });

  // Test 12: toRupees conversion
  await runTest('toRupees(10000) → 100', async () => {
    assert.strictEqual(razorpayClient.toRupees(10000), 100);
    assert.strictEqual(razorpayClient.toRupees(49900), 499);
    assert.strictEqual(razorpayClient.toRupees(1), 0.01);
  });

  // ═══════════════════════════════════════════
  // SECTION 3: Test Order Request Validation
  // ═══════════════════════════════════════════

  console.log('\n  🧾 Test Order Validation\n');

  // Test 13: createTestOrder with missing credentials throws
  await runTest('createTestOrder without credentials → configuration error', withEnv(
    { RAZORPAY_KEY_ID: undefined, RAZORPAY_KEY_SECRET: undefined },
    async () => {
      try {
        await razorpayClient.createTestOrder({ amount: 100 });
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err.message.includes('not configured'), 'Should indicate not configured');
        assert.strictEqual(err.statusCode, 503);
        assert.strictEqual(err.configurationError, true);
      }
    }
  ));

  // Test 14: createTestOrder with invalid amount
  await runTest('createTestOrder({ amount: -50 }) → throws', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_abc', RAZORPAY_KEY_SECRET: 'secret' },
    async () => {
      try {
        await razorpayClient.createTestOrder({ amount: -50 });
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err.message.includes('positive'), 'Should reject negative amount');
      }
    }
  ));

  // Test 15: createTestOrder with missing amount
  await runTest('createTestOrder({}) → throws "Amount is required"', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_abc', RAZORPAY_KEY_SECRET: 'secret' },
    async () => {
      try {
        await razorpayClient.createTestOrder({});
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err.message.includes('required'), 'Should require amount');
      }
    }
  ));

  // ═══════════════════════════════════════════
  // SECTION 4: Mocked Razorpay SDK calls
  // ═══════════════════════════════════════════

  console.log('\n  🔌 Mocked Razorpay API Calls\n');

  // Test 16: Successful mocked order creation
  await runTest('createTestOrder success (mocked SDK)', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_mock123', RAZORPAY_KEY_SECRET: 'mock_secret' },
    async () => {
      // Get the instance and mock orders.create
      const instance = razorpayClient._getInstance();
      assert.ok(instance, 'Instance should be created');

      const originalCreate = instance.orders.create;
      instance.orders.create = async (params) => {
        return {
          id: 'order_MockTest123',
          amount: params.amount,
          currency: params.currency,
          receipt: params.receipt,
          status: 'created',
          created_at: Math.floor(Date.now() / 1000),
        };
      };

      try {
        const result = await razorpayClient.createTestOrder({ amount: 499 });
        assert.strictEqual(result.success, true);
        assert.strictEqual(result.mode, 'test');
        assert.strictEqual(result.order.id, 'order_MockTest123');
        assert.strictEqual(result.order.amount, 49900);
        assert.strictEqual(result.order.amountInRupees, 499);
        assert.strictEqual(result.order.currency, 'INR');
        assert.strictEqual(result.order.status, 'created');

        // Verify no secrets in result
        const serialized = JSON.stringify(result);
        assert.ok(!serialized.includes('mock_secret'), 'Secret must not appear in result');
        assert.ok(!serialized.includes('rzp_test_mock123'), 'Key ID must not appear in result');
      } finally {
        instance.orders.create = originalCreate;
      }
    }
  ));

  // Test 17: Razorpay API failure (mocked)
  await runTest('createTestOrder API failure (mocked) → structured error', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_test_mock123', RAZORPAY_KEY_SECRET: 'mock_secret' },
    async () => {
      const instance = razorpayClient._getInstance();
      const originalCreate = instance.orders.create;

      instance.orders.create = async () => {
        const err = new Error('Bad Request');
        err.statusCode = 400;
        err.error = { description: 'Amount is less than minimum allowed' };
        throw err;
      };

      try {
        await razorpayClient.createTestOrder({ amount: 1 });
        assert.fail('Should have thrown');
      } catch (err) {
        assert.ok(err.message.includes('Razorpay API error'), 'Should wrap as Razorpay API error');
        assert.ok(err.message.includes('Amount is less than minimum'), 'Should include description');
        assert.strictEqual(err.razorpayError, true);
      } finally {
        instance.orders.create = originalCreate;
      }
    }
  ));

  // Test 18: Non-test key detection
  await runTest('Non-test key → mode: "unknown" (not "test")', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_live_abc123', RAZORPAY_KEY_SECRET: 'live_secret' },
    () => {
      const status = razorpayClient.isConfigured();
      assert.strictEqual(status.configured, true);
      assert.strictEqual(status.mode, 'unknown', 'Non-test key should not return mode "test"');
    }
  ));

  // Test 19: createTestOrder rejects non-test key
  await runTest('createTestOrder with live key → rejects with 403', withEnv(
    { RAZORPAY_KEY_ID: 'rzp_live_abc123', RAZORPAY_KEY_SECRET: 'live_secret' },
    async () => {
      try {
        await razorpayClient.createTestOrder({ amount: 100 });
        assert.fail('Should have thrown');
      } catch (err) {
        assert.strictEqual(err.statusCode, 403);
        assert.ok(err.message.includes('Test Mode'), 'Should mention Test Mode');
      }
    }
  ));

  // ═══════════════════════════════════════════
  // SECTION 5: Existing Campaign Execution Regression
  // ═══════════════════════════════════════════

  console.log('\n  🔄 Campaign Execution Regression\n');

  // Test 20: Existing campaign execution model still works
  await runTest('Campaign execution model loads and has expected exports', async () => {
    const campaignExecModel = require('../src/models/campaignExecutionModel');
    assert.ok(typeof campaignExecModel.executeCampaign === 'function', 'executeCampaign must exist');
    assert.ok(typeof campaignExecModel.getExecutionByCampaignId === 'function', 'getExecutionByCampaignId must exist');
    assert.ok(typeof campaignExecModel.getAllExecutions === 'function', 'getAllExecutions must exist');
    assert.strictEqual(campaignExecModel.SIMULATED_CONVERSION_RATE, 0.10, 'Simulation rate must be 10%');
  });

  // ═══════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════

  console.log('\n─────────────────────────────────────────────');
  console.log(`  Results: ${passedTests}/${totalTests} passed`);

  if (failedTests > 0) {
    console.log(`  FAILED: ${failedTests} test(s)`);
    for (const f of failures) {
      console.log(`    ❌ ${f.name}: ${f.error}`);
    }
  }
  console.log('─────────────────────────────────────────────\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test suite error:', err);
  process.exit(1);
});
