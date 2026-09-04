// ─────────────────────────────────────────────
// RevGen — Revenue / ROI & Transaction Dashboard Model
// ─────────────────────────────────────────────
//
// Read-only analytics module calculating business metrics,
// campaign execution stats, and transaction records.
//
// Critical Revenue Semantics:
// 1. Test Mode executions are NEVER labeled as "real revenue".
// 2. Realized ROI is null until actual captured payment & spend data exists.
// 3. Estimated ROI is clearly separated and mathematically derived from deterministic fields.
// 4. Read-only: Zero inserts, updates, or deletes.
// 5. Zero AI / LLM calls.
// 6. No secret leakage.
// ─────────────────────────────────────────────

const pool = require('../db');

/**
 * Fetches aggregated revenue, campaign ROI, and transaction execution data.
 *
 * @returns {Promise<object>} Structured revenue dashboard metrics and transaction history.
 */
async function getRevenueDashboardMetrics() {
  // 1. Aggregated campaign metrics
  const campaignStatsQuery = `
    SELECT
      COUNT(*)::INTEGER AS total_campaigns,
      COUNT(CASE WHEN status = 'approved' THEN 1 END)::INTEGER AS approved_campaigns,
      COUNT(CASE WHEN status IN ('executing', 'completed') THEN 1 END)::INTEGER AS executed_campaigns,
      COALESCE(SUM(budget_limit), 0)::NUMERIC(12,2) AS total_campaign_budget,
      COALESCE(SUM(CASE WHEN status IN ('executing', 'completed') THEN budget_limit ELSE 0 END), 0)::NUMERIC(12,2) AS executed_campaign_budget,
      COALESCE(SUM(estimated_revenue_opportunity), 0)::NUMERIC(12,2) AS total_estimated_revenue_opportunity,
      COALESCE(SUM(CASE WHEN status IN ('executing', 'completed') THEN estimated_revenue_opportunity ELSE 0 END), 0)::NUMERIC(12,2) AS executed_estimated_revenue_opportunity,
      COALESCE(SUM(target_count), 0)::INTEGER AS total_target_count,
      COALESCE(SUM(CASE WHEN status IN ('executing', 'completed') THEN target_count ELSE 0 END), 0)::INTEGER AS executed_target_count
    FROM campaigns;
  `;

  // 2. Aggregated execution metrics
  const executionStatsQuery = `
    SELECT
      COUNT(*)::INTEGER AS total_executions,
      COUNT(CASE WHEN status = 'completed' THEN 1 END)::INTEGER AS completed_executions,
      COUNT(CASE WHEN status = 'failed' THEN 1 END)::INTEGER AS failed_executions,
      COUNT(CASE WHEN execution_mode = 'razorpay_test' THEN 1 END)::INTEGER AS razorpay_test_executions,
      COUNT(CASE WHEN execution_mode = 'simulation' THEN 1 END)::INTEGER AS simulation_executions,
      COALESCE(SUM(simulated_revenue), 0)::NUMERIC(12,2) AS total_simulated_revenue,
      COALESCE(SUM(simulated_conversions), 0)::INTEGER AS total_simulated_conversions,
      COALESCE(SUM(target_count), 0)::INTEGER AS total_execution_target_count
    FROM campaign_executions;
  `;

  // 3. Fetch detailed transaction/execution list with product & campaign details
  const transactionListQuery = `
    SELECT
      ce.id AS execution_id,
      ce.campaign_id,
      ce.execution_mode,
      ce.status AS execution_status,
      ce.target_count,
      ce.simulated_conversions,
      ce.estimated_revenue_opportunity,
      ce.simulated_revenue,
      ce.details,
      ce.executed_at,
      ce.created_at AS execution_created_at,
      c.name AS campaign_name,
      c.type AS campaign_type,
      c.status AS campaign_status,
      c.discount_percent,
      c.budget_limit,
      c.target_segment,
      pa.id AS product_a_id,
      pa.name AS product_a_name,
      pa.price AS product_a_price,
      pa.category AS product_a_category,
      pb.id AS product_b_id,
      pb.name AS product_b_name,
      pb.price AS product_b_price,
      pb.category AS product_b_category
    FROM campaign_executions ce
    JOIN campaigns c ON ce.campaign_id = c.id
    LEFT JOIN products pa ON c.product_a_id = pa.id
    LEFT JOIN products pb ON c.product_b_id = pb.id
    ORDER BY ce.executed_at DESC, ce.id DESC;
  `;

  // Run all queries concurrently using pool.query
  const [campaignRes, execRes, txRes] = await Promise.all([
    pool.query(campaignStatsQuery),
    pool.query(executionStatsQuery),
    pool.query(transactionListQuery),
  ]);

    const campStats = campaignRes.rows[0];
    const execStats = execRes.rows[0];

    // Format transaction items and calculate aggregate test transaction value
    let totalTestTransactionValue = 0;

    const transactions = txRes.rows.map((row) => {
      const details = row.details || {};
      const razorpayOrderId = details.razorpayOrderId || null;
      const unitPrice = parseFloat(details.unitPrice || row.product_b_price || 0);
      const discountedUnitPrice = parseFloat(
        details.discountedUnitPrice ||
        details.razorpayAmountINR ||
        (unitPrice * (1 - parseFloat(row.discount_percent || 0) / 100)).toFixed(2)
      );
      const transactionAmountINR = details.razorpayAmountINR
        ? parseFloat(details.razorpayAmountINR)
        : discountedUnitPrice;

      if (row.execution_status === 'completed') {
        totalTestTransactionValue += transactionAmountINR;
      }

      return {
        id: row.execution_id,
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        campaignType: row.campaign_type,
        campaignStatus: row.campaign_status,
        executionMode: row.execution_mode,
        executionStatus: row.execution_status,
        productA: row.product_a_id ? {
          id: row.product_a_id,
          name: row.product_a_name,
          category: row.product_a_category,
          price: parseFloat(row.product_a_price || 0),
        } : null,
        productB: row.product_b_id ? {
          id: row.product_b_id,
          name: row.product_b_name,
          category: row.product_b_category,
          price: parseFloat(row.product_b_price || 0),
        } : null,
        targetCount: parseInt(row.target_count, 10),
        simulatedConversions: parseInt(row.simulated_conversions, 10),
        discountPercent: parseFloat(row.discount_percent || 0),
        budgetLimit: parseFloat(row.budget_limit || 0),
        transactionAmountINR: transactionAmountINR,
        unitPrice: unitPrice,
        discountedUnitPrice: discountedUnitPrice,
        currency: 'INR',
        razorpayOrderId: razorpayOrderId,
        razorpayAmountPaise: details.razorpayAmountPaise || null,
        razorpayMode: details.razorpayMode || (row.execution_mode === 'razorpay_test' ? 'test' : null),
        estimatedRevenueOpportunity: parseFloat(row.estimated_revenue_opportunity || 0),
        simulatedRevenue: parseFloat(row.simulated_revenue || 0),
        errorMessage: details.error || null,
        executedAt: row.executed_at,
        createdAt: row.execution_created_at,
      };
    });

    const totalCampaigns = parseInt(campStats.total_campaigns, 10);
    const approvedCampaigns = parseInt(campStats.approved_campaigns, 10);
    const executedCampaigns = parseInt(campStats.executed_campaigns, 10);
    const completedExecutions = parseInt(execStats.completed_executions, 10);
    const failedExecutions = parseInt(execStats.failed_executions, 10);
    const testTransactions = completedExecutions;
    const testRevenue = parseFloat(parseFloat(execStats.total_simulated_revenue).toFixed(2));
    const totalCampaignBudget = parseFloat(parseFloat(campStats.total_campaign_budget).toFixed(2));
    const executedCampaignBudget = parseFloat(parseFloat(campStats.executed_campaign_budget).toFixed(2));
    const estimatedRevenueOpportunity = parseFloat(parseFloat(campStats.total_estimated_revenue_opportunity).toFixed(2));
    const executedEstimatedOpportunity = parseFloat(parseFloat(campStats.executed_estimated_revenue_opportunity).toFixed(2));
    const estimatedAdditionalCustomers = parseInt(campStats.executed_target_count || execStats.total_execution_target_count || 0, 10);

    const averageTransactionValue = testTransactions > 0
      ? parseFloat((totalTestTransactionValue / testTransactions).toFixed(2))
      : 0;

    // ROI Calculations:
    // 1. Realized ROI is null because no real payment captures or realized merchant spend are tracked.
    // 2. Estimated ROI: If executed campaign budget > 0, ((executedEstimatedOpportunity - executedCampaignBudget) / executedCampaignBudget) * 100
    let estimatedRoi = null;
    let estimatedRoiFormula = '((Estimated Revenue Opportunity - Executed Campaign Budget) / Executed Campaign Budget) * 100';
    if (executedCampaignBudget > 0 && executedEstimatedOpportunity > 0) {
      estimatedRoi = parseFloat((((executedEstimatedOpportunity - executedCampaignBudget) / executedCampaignBudget) * 100).toFixed(2));
    } else if (totalCampaignBudget > 0 && estimatedRevenueOpportunity > 0) {
      estimatedRoi = parseFloat((((estimatedRevenueOpportunity - totalCampaignBudget) / totalCampaignBudget) * 100).toFixed(2));
      estimatedRoiFormula = '((Total Estimated Opportunity - Total Campaign Budget) / Total Campaign Budget) * 100';
    }

    return {
      summary: {
        totalCampaigns,
        approvedCampaigns,
        executedCampaigns,
        completedExecutions,
        failedExecutions,
        testTransactions,
        testRevenue,
        testTransactionValue: parseFloat(totalTestTransactionValue.toFixed(2)),
        totalCampaignBudget,
        executedCampaignBudget,
        estimatedRevenueOpportunity,
        executedEstimatedOpportunity,
        estimatedAdditionalCustomers,
        averageTransactionValue,
        currency: 'INR',
        realRevenue: 0, // Explicitly zero — no real merchant revenue claimed
        hasRealRevenueEvidence: false,
      },
      roi: {
        realizedRoi: null,
        realizedRoiNote: 'ROI unavailable until realized revenue and campaign spend are recorded.',
        estimatedRoi: estimatedRoi,
        estimatedRoiPercent: estimatedRoi !== null ? `${estimatedRoi}%` : null,
        formula: estimatedRoiFormula,
        label: 'Estimated ROI',
      },
      semantics: {
        estimatedOpportunity: 'Deterministic analytics prediction before execution based on missed customers and basket affinity.',
        testTransactionValue: 'Sandbox transaction amount executed via Razorpay Test Mode or simulation. No real money was charged.',
        realRevenue: 'Not claimed. Requires actual merchant bank settlement and captured live customer payments.',
      },
      disclaimer: 'Razorpay Test Mode — No real money was charged. Test transaction values reflect sandbox executions and simulated conversion estimates.',
      transactions,
    };
}

module.exports = {
  getRevenueDashboardMetrics,
};
