// ─────────────────────────────────────────────
// RevGen — Razorpay Campaign Execution Adapter
// ─────────────────────────────────────────────
//
// Connects approved RevGen campaigns to Razorpay Test Mode.
//
// Responsibilities:
// 1. Take an APPROVED campaign and create a Razorpay Test Mode order.
// 2. Validate campaign status, amount, and Razorpay configuration.
// 3. Record execution in campaign_executions with execution_mode = 'razorpay_test'.
// 4. Write audit trail events.
// 5. Maintain idempotency (no duplicate Razorpay orders).
//
// This module does NOT:
// - Select opportunities
// - Call Qwen3 / Ollama
// - Generate recommendations
// - Approve campaigns
// - Modify analytics
// - Make live transactions
// ─────────────────────────────────────────────

const pool = require('../db');
const razorpayClient = require('./razorpayClient');
const { getProductPairAnalytics } = require('../analytics/productPairs');

/**
 * Executes an approved campaign via Razorpay Test Mode.
 *
 * @param {number} campaignId - The campaign to execute.
 * @param {object} [options={}] - Execution options (e.g. forceFail for testing).
 * @returns {Promise<object>} Execution result.
 */
async function executeWithRazorpay(campaignId, options = {}) {
  const cId = parseInt(campaignId, 10);
  if (isNaN(cId) || cId <= 0) {
    const err = new Error('Invalid campaign ID');
    err.statusCode = 400;
    throw err;
  }

  // ── Pre-flight: Check Razorpay configuration ──
  const rzpStatus = razorpayClient.isConfigured();
  if (!rzpStatus.configured) {
    const err = new Error(rzpStatus.reason || 'Razorpay test credentials are not configured');
    err.statusCode = 503;
    err.configurationError = true;
    throw err;
  }

  if (rzpStatus.mode !== 'test') {
    const err = new Error('RevGen only supports Razorpay Test Mode. Live mode keys are not permitted.');
    err.statusCode = 403;
    throw err;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Lock campaign row FOR UPDATE
    const selectRes = await client.query('SELECT * FROM campaigns WHERE id = $1 FOR UPDATE', [cId]);
    if (selectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Campaign not found');
      err.statusCode = 404;
      throw err;
    }

    const campaign = selectRes.rows[0];

    // 2. Idempotency: Check if execution already exists
    const execCheckRes = await client.query(
      'SELECT * FROM campaign_executions WHERE campaign_id = $1',
      [cId]
    );

    if (execCheckRes.rows.length > 0) {
      const existingExec = execCheckRes.rows[0];
      await client.query('COMMIT');

      return {
        execution: mapExecutionRow(existingExec),
        campaign: {
          id: cId,
          status: campaign.status,
        },
        razorpay: {
          provider: 'razorpay',
          mode: 'test',
          isRealTransaction: false,
          razorpayCalled: false,
          idempotent: true,
          razorpayOrderId: existingExec.details?.razorpayOrderId || null,
        },
      };
    }

    // 3. Status gate: ONLY approved campaigns may execute
    if (campaign.status !== 'approved') {
      await client.query('ROLLBACK');
      const err = new Error(`Campaign must be approved before execution. Current status: ${campaign.status}`);
      err.statusCode = 400;
      throw err;
    }

    // 4. Determine transaction amount
    //    The transaction amount is the DISCOUNTED price of Product B (what the customer pays).
    //    This is NOT the campaign budget.
    let productBPrice = 0;
    if (campaign.product_b_id) {
      const pRes = await client.query('SELECT price FROM products WHERE id = $1', [campaign.product_b_id]);
      if (pRes.rows.length > 0) {
        productBPrice = parseFloat(pRes.rows[0].price);
      }
    }

    const discountPercent = parseFloat(campaign.discount_percent || 0);
    const discountedPrice = parseFloat((productBPrice * (1 - discountPercent / 100)).toFixed(2));

    if (discountedPrice <= 0) {
      await client.query('ROLLBACK');
      const err = new Error('Transaction amount must be positive. Product B price or discount configuration is invalid.');
      err.statusCode = 400;
      throw err;
    }

    // 5. Resolve target count
    let targetCount = parseInt(campaign.target_count || 0, 10);
    if (targetCount <= 0 && campaign.product_a_id && campaign.product_b_id) {
      try {
        const pairs = await getProductPairAnalytics({ minOrdersWithBoth: 1, limit: 200 });
        const match = pairs.find(
          (p) => p.productA.id === campaign.product_a_id && p.productB.id === campaign.product_b_id
        );
        if (match && match.missedCustomers) {
          targetCount = match.missedCustomers;
        }
      } catch (err) {
        console.warn('Could not fetch missedCustomers for target count:', err.message);
      }
    }
    if (targetCount <= 0) {
      targetCount = 50;
    }

    // 6. Update status to 'executing'
    await client.query("UPDATE campaigns SET status = 'executing', updated_at = NOW() WHERE id = $1", [cId]);

    // 7. Audit: execution started
    await client.query(
      `INSERT INTO audit_logs (campaign_id, action, actor, status, details, created_at)
       VALUES ($1, 'campaign_execution_started', 'system', 'success', $2, NOW())`,
      [cId, {
        executionMode: 'razorpay_test',
        previousStatus: 'approved',
        newStatus: 'executing',
        transactionAmountINR: discountedPrice,
      }]
    );

    // ── Commit the executing status before calling Razorpay ──
    // This ensures we don't hold a long transaction during the API call.
    await client.query('COMMIT');

    // 8. Call Razorpay Test Mode
    let razorpayResult;
    try {
      if (options.forceFail) {
        const simError = new Error('Simulated Razorpay Test Mode execution failure (forceFail=true)');
        simError.statusCode = 500;
        simError.isSimulatedFailure = true;
        throw simError;
      }

      razorpayResult = await razorpayClient.createTestOrder({
        amount: discountedPrice,
        currency: 'INR',
        receipt: `revgen_campaign_${cId}_${Date.now()}`,
        notes: {
          source: 'revgen',
          campaignId: String(cId),
          productBId: String(campaign.product_b_id || ''),
          executionMode: 'test',
        },
      });
    } catch (rzpError) {
      // Razorpay failed — record failure
      await recordExecutionFailure(cId, {
        error: sanitizeErrorMessage(rzpError.message),
        transactionAmountINR: discountedPrice,
      });
      throw rzpError;
    }

    // 9. Record successful execution
    const razorpayOrderId = razorpayResult.order?.id || null;
    const razorpayAmountPaise = razorpayResult.order?.amount || razorpayClient.toPaise(discountedPrice);

    const SIMULATED_CONVERSION_RATE = 0.10;
    const simulatedConversions = Math.floor(targetCount * SIMULATED_CONVERSION_RATE);
    const simulatedRevenue = parseFloat((simulatedConversions * discountedPrice).toFixed(2));
    const estimatedRevenue = parseFloat(campaign.estimated_revenue_opportunity || 0);

    const client2 = await pool.connect();
    try {
      await client2.query('BEGIN');

      // Insert execution record
      const insertExecQuery = `
        INSERT INTO campaign_executions (
          campaign_id,
          execution_mode,
          status,
          target_count,
          simulated_conversions,
          estimated_revenue_opportunity,
          simulated_revenue,
          details,
          executed_at,
          created_at
        ) VALUES ($1, 'razorpay_test', 'completed', $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING *;
      `;

      const execDetails = {
        executionMode: 'razorpay_test',
        razorpayOrderId,
        razorpayAmountPaise,
        razorpayAmountINR: discountedPrice,
        razorpayCurrency: 'INR',
        razorpayMode: 'test',
        razorpayOrderStatus: razorpayResult.order?.status || 'created',
        discountPercent,
        unitPrice: productBPrice,
        discountedUnitPrice: discountedPrice,
        conversionRate: SIMULATED_CONVERSION_RATE,
      };

      const execRes = await client2.query(insertExecQuery, [
        cId,
        targetCount,
        simulatedConversions,
        estimatedRevenue,
        simulatedRevenue,
        execDetails,
      ]);

      const createdExecution = execRes.rows[0];

      // Update campaign status to 'completed'
      await client2.query("UPDATE campaigns SET status = 'completed', updated_at = NOW() WHERE id = $1", [cId]);

      // Audit: Razorpay test order created
      await client2.query(
        `INSERT INTO audit_logs (campaign_id, action, actor, status, details, created_at)
         VALUES ($1, 'razorpay_test_order_created', 'system', 'success', $2, NOW())`,
        [cId, {
          razorpayOrderId,
          amountPaise: razorpayAmountPaise,
          amountINR: discountedPrice,
          currency: 'INR',
          mode: 'test',
        }]
      );

      // Audit: execution completed
      await client2.query(
        `INSERT INTO audit_logs (campaign_id, action, actor, status, details, created_at)
         VALUES ($1, 'campaign_execution_completed', 'system', 'success', $2, NOW())`,
        [cId, {
          executionMode: 'razorpay_test',
          previousStatus: 'executing',
          newStatus: 'completed',
          razorpayOrderId,
          targetCount,
          simulatedConversions,
          simulatedRevenue,
        }]
      );

      await client2.query('COMMIT');

      return {
        execution: mapExecutionRow(createdExecution),
        campaign: {
          id: cId,
          status: 'completed',
        },
        razorpay: {
          provider: 'razorpay',
          mode: 'test',
          isRealTransaction: false,
          razorpayCalled: true,
          razorpayOrderId,
          amount: razorpayAmountPaise,
          amountINR: discountedPrice,
          currency: 'INR',
          orderStatus: razorpayResult.order?.status || 'created',
          message: 'Razorpay Test Mode order created. No real money was charged.',
        },
      };
    } catch (dbError) {
      await client2.query('ROLLBACK');
      throw dbError;
    } finally {
      client2.release();
    }
  } catch (error) {
    // If we haven't committed yet, rollback
    try { await client.query('ROLLBACK'); } catch (_) { /* already committed or rolled back */ }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Sanitizes error message strings to prevent secret leakage.
 */
function sanitizeErrorMessage(msg) {
  if (!msg) return 'Unknown execution failure';
  return String(msg)
    .replace(/key_secret[^\s,]*/gi, '[REDACTED_SECRET]')
    .replace(/rzp_test_[a-zA-Z0-9]+/g, '[REDACTED_KEY]')
    .replace(/postgres:\/\/[^\s]*/gi, '[REDACTED_DB_URL]');
}

/**
 * Records a failed execution attempt in campaigns and audit_logs.
 */
async function recordExecutionFailure(campaignId, failureDetails) {
  const failClient = await pool.connect();
  try {
    await failClient.query('BEGIN');

    // Update campaign status to 'failed'
    await failClient.query(
      "UPDATE campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1",
      [campaignId]
    );

    // Audit: execution failed
    await failClient.query(
      `INSERT INTO audit_logs (campaign_id, action, actor, status, details, created_at)
       VALUES ($1, 'campaign_execution_failed', 'system', 'failed', $2, NOW())`,
      [campaignId, {
        executionMode: 'razorpay_test',
        previousStatus: 'executing',
        newStatus: 'failed',
        error: sanitizeErrorMessage(failureDetails.error || 'Unknown failure'),
        transactionAmountINR: failureDetails.transactionAmountINR,
      }]
    );

    await failClient.query('COMMIT');
  } catch (err) {
    await failClient.query('ROLLBACK');
    console.error('Failed to record execution failure:', err.message);
  } finally {
    failClient.release();
  }
}

/**
 * Maps raw SQL campaign_executions row to structured API object.
 * (Same structure as campaignExecutionModel.mapExecutionRow)
 */
function mapExecutionRow(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    executionMode: row.execution_mode,
    status: row.status,
    targetCount: row.target_count,
    simulatedConversions: row.simulated_conversions,
    estimatedRevenueOpportunity: parseFloat(row.estimated_revenue_opportunity || 0),
    simulatedRevenue: parseFloat(row.simulated_revenue || 0),
    details: row.details,
    executedAt: row.executed_at,
    createdAt: row.created_at,
  };
}

module.exports = {
  executeWithRazorpay,
};
