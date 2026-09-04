// ─────────────────────────────────────────────
// RevGen — Campaign Execution Simulation Engine
// ─────────────────────────────────────────────
//
// Manages safe, deterministic simulation of campaign executions
// for merchant-approved growth proposals.
//
// Important Safety Controls:
// 1. Only campaigns with status 'approved' may be executed.
// 2. Execution NEVER calls Razorpay, creates real payments, or places orders.
// 3. Execution is idempotent (duplicate requests return existing execution).
// 4. All DB updates & audit logs run inside PostgreSQL transactions.
// ─────────────────────────────────────────────

const pool = require('../db');
const { getProductPairAnalytics } = require('../analytics/productPairs');

const SIMULATED_CONVERSION_RATE = 0.10; // 10% assumed simulation conversion rate

/**
 * Executes an approved campaign in simulation mode inside a PostgreSQL transaction.
 */
async function executeCampaign(campaignId, options = {}) {
  const cId = parseInt(campaignId, 10);
  if (isNaN(cId) || cId <= 0) {
    const err = new Error('Invalid campaign ID');
    err.statusCode = 400;
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

    // 2. Idempotency Check: Check if an execution already exists
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
        simulation: {
          conversionRate: SIMULATED_CONVERSION_RATE,
          isRealTransaction: false,
          razorpayCalled: false,
          idempotent: true,
        },
      };
    }

    // 3. Eligibility Check: Status MUST be 'approved'
    if (campaign.status !== 'approved') {
      await client.query('ROLLBACK');
      const err = new Error('Campaign must be approved before execution.');
      err.statusCode = 400;
      throw err;
    }

    // 4. Target Count Resolution (from campaign.target_count or analytics missedCustomers)
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
      targetCount = 50; // Fallback default baseline
    }

    // 5. Fetch Product B details for price calculation
    let productBPrice = 0;
    if (campaign.product_b_id) {
      const pRes = await client.query('SELECT price FROM products WHERE id = $1', [campaign.product_b_id]);
      if (pRes.rows.length > 0) {
        productBPrice = parseFloat(pRes.rows[0].price);
      }
    }

    // 6. Calculate Simulated Revenue & Conversions
    const discountPercent = parseFloat(campaign.discount_percent || 0);
    const simulatedConversions = Math.floor(targetCount * SIMULATED_CONVERSION_RATE);
    const discountedPrice = productBPrice * (1 - discountPercent / 100);
    const simulatedRevenue = parseFloat((simulatedConversions * discountedPrice).toFixed(2));
    const estimatedRevenue = parseFloat(campaign.estimated_revenue_opportunity || 0);

    // 7. Update status to 'executing'
    await client.query("UPDATE campaigns SET status = 'executing', updated_at = NOW() WHERE id = $1", [cId]);

    // Insert start audit log
    await client.query(
      `INSERT INTO audit_logs (campaign_id, action, actor, status, details, created_at)
       VALUES ($1, 'campaign_execution_started', 'system', 'success', $2, NOW())`,
      [cId, { executionMode: 'simulation', previousStatus: 'approved', newStatus: 'executing' }]
    );

    // 8. Controlled Condition for Failure / Rollback Testing
    if (options.forceFail) {
      await client.query("UPDATE campaigns SET status = 'failed', updated_at = NOW() WHERE id = $1", [cId]);
      await client.query(
        `INSERT INTO audit_logs (campaign_id, action, actor, status, details, created_at)
         VALUES ($1, 'campaign_execution_failed', 'system', 'failed', $2, NOW())`,
        [cId, { executionMode: 'simulation', previousStatus: 'executing', newStatus: 'failed', error: 'Simulated execution failure test triggered' }]
      );
      await client.query('COMMIT');
      const failErr = new Error('Simulated execution failure');
      failErr.statusCode = 500;
      throw failErr;
    }

    // 9. Insert completed campaign_executions record
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
      ) VALUES ($1, 'simulation', 'completed', $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *;
    `;

    const execDetails = {
      conversionRate: SIMULATED_CONVERSION_RATE,
      discountPercent,
      unitPrice: productBPrice,
      discountedUnitPrice: parseFloat(discountedPrice.toFixed(2)),
    };

    const execRes = await client.query(insertExecQuery, [
      cId,
      targetCount,
      simulatedConversions,
      estimatedRevenue,
      simulatedRevenue,
      execDetails,
    ]);

    const createdExecution = execRes.rows[0];

    // 10. Update campaign status to 'completed'
    await client.query("UPDATE campaigns SET status = 'completed', updated_at = NOW() WHERE id = $1", [cId]);

    // 11. Insert completion audit log
    const completionDetails = {
      executionMode: 'simulation',
      previousStatus: 'executing',
      newStatus: 'completed',
      targetCount,
      simulatedConversions,
      simulatedRevenue,
    };

    await client.query(
      `INSERT INTO audit_logs (campaign_id, action, actor, status, details, created_at)
       VALUES ($1, 'campaign_execution_completed', 'system', 'success', $2, NOW())`,
      [cId, completionDetails]
    );

    await client.query('COMMIT');

    return {
      execution: mapExecutionRow(createdExecution),
      campaign: {
        id: cId,
        status: 'completed',
      },
      simulation: {
        conversionRate: SIMULATED_CONVERSION_RATE,
        isRealTransaction: false,
        razorpayCalled: false,
      },
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Fetches execution details for a campaign.
 * Returns null if campaign has no execution record.
 */
async function getExecutionByCampaignId(campaignId) {
  const cId = parseInt(campaignId, 10);
  if (isNaN(cId) || cId <= 0) return null;

  // Check if campaign exists first
  const checkRes = await pool.query('SELECT id FROM campaigns WHERE id = $1', [cId]);
  if (checkRes.rows.length === 0) return null;

  const query = `
    SELECT * FROM campaign_executions
    WHERE campaign_id = $1;
  `;

  const result = await pool.query(query, [cId]);
  if (result.rows.length === 0) return null;

  return mapExecutionRow(result.rows[0]);
}

/**
 * Fetches all campaign executions ordered by executed_at DESC.
 */
async function getAllExecutions() {
  const query = `
    SELECT
      e.id,
      e.campaign_id AS "campaignId",
      e.execution_mode AS "executionMode",
      e.status,
      e.target_count AS "targetCount",
      e.simulated_conversions AS "simulatedConversions",
      e.estimated_revenue_opportunity::FLOAT AS "estimatedRevenueOpportunity",
      e.simulated_revenue::FLOAT AS "simulatedRevenue",
      e.details,
      e.executed_at AS "executedAt",
      e.created_at AS "createdAt",
      c.name AS "campaignTitle",
      c.status AS "campaignStatus"
    FROM campaign_executions e
    JOIN campaigns c ON e.campaign_id = c.id
    ORDER BY e.executed_at DESC;
  `;

  const result = await pool.query(query);
  return result.rows.map((row) => ({
    id: row.id,
    campaignId: row.campaignId,
    campaignTitle: row.campaignTitle,
    campaignStatus: row.campaignStatus,
    executionMode: row.executionMode,
    status: row.status,
    targetCount: row.targetCount,
    simulatedConversions: row.simulatedConversions,
    estimatedRevenueOpportunity: row.estimatedRevenueOpportunity,
    simulatedRevenue: row.simulatedRevenue,
    details: row.details,
    executedAt: row.executedAt,
    createdAt: row.createdAt,
  }));
}

/**
 * Maps raw SQL campaign_executions row to structured API object.
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
  executeCampaign,
  getExecutionByCampaignId,
  getAllExecutions,
  SIMULATED_CONVERSION_RATE,
};
