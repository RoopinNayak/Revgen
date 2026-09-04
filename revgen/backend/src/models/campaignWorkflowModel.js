// ─────────────────────────────────────────────
// RevGen — Campaign Workflow & Audit Model
// ─────────────────────────────────────────────
//
// Manages safe status transitions and atomic audit logging
// for merchant campaign proposals.
//
// Workflow State Machine:
//   draft -> pending_approval
//   pending_approval -> approved
//   pending_approval -> rejected
//   rejected -> draft
//
// All updates use PostgreSQL transactions (BEGIN / COMMIT / ROLLBACK)
// to guarantee atomic status change + audit log insertion.
// ─────────────────────────────────────────────

const pool = require('../db');
const { getCampaignById } = require('./campaignModel');

// Strict State Machine Transition Rules
const WORKFLOW_TRANSITIONS = {
  draft: ['pending_approval'],
  pending_approval: ['approved', 'rejected'],
  rejected: ['draft'],
  failed: ['draft'],
};

/**
 * Transitions campaign status inside a PostgreSQL transaction and logs the audit event.
 */
async function transitionCampaignStatus(campaignId, targetStatus, action, actor = 'merchant', extraDetails = {}) {
  const cId = parseInt(campaignId, 10);
  if (isNaN(cId) || cId <= 0) {
    const err = new Error('Invalid campaign ID');
    err.statusCode = 400;
    throw err;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch current campaign with lock FOR UPDATE
    const selectRes = await client.query('SELECT * FROM campaigns WHERE id = $1 FOR UPDATE', [cId]);
    if (selectRes.rows.length === 0) {
      await client.query('ROLLBACK');
      const err = new Error('Campaign not found');
      err.statusCode = 404;
      throw err;
    }

    const campaign = selectRes.rows[0];
    const currentStatus = campaign.status;

    // 2. Validate state machine transition
    const allowedNext = WORKFLOW_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(targetStatus)) {
      await client.query('ROLLBACK');
      const err = new Error('Invalid campaign status transition');
      err.statusCode = 400;
      throw err;
    }

    // 3. Update campaign status and timestamp
    const updateQuery = `
      UPDATE campaigns
      SET status = $1, updated_at = NOW()
      WHERE id = $2;
    `;
    await client.query(updateQuery, [targetStatus, cId]);

    // 4. Create structured audit details
    const auditDetails = {
      campaignId: cId,
      previousStatus: currentStatus,
      newStatus: targetStatus,
      ...extraDetails,
    };

    // 5. Insert audit log entry atomically
    const auditQuery = `
      INSERT INTO audit_logs (
        campaign_id,
        action,
        actor,
        status,
        details,
        created_at
      ) VALUES ($1, $2, $3, 'success', $4, NOW());
    `;
    await client.query(auditQuery, [cId, action, actor, auditDetails]);

    // 6. Record Agent Memory atomically
    const decMap = {
      pending_approval: 'submitted',
      approved: 'approved',
      rejected: 'rejected',
      draft: 'reset',
    };
    const merchantDecision = decMap[targetStatus] || 'submitted';

    const memQuery = `
      INSERT INTO agent_memory (
        campaign_id,
        product_a_id,
        product_b_id,
        opportunity_type,
        opportunity_strength,
        priority,
        recommended_segment,
        final_segment,
        recommended_discount,
        final_discount,
        recommended_budget,
        final_budget,
        merchant_decision,
        decision_reason,
        created_at
      ) VALUES ($1, $2, $3, 'cross_sell', 'STRONG', 'MEDIUM', 'regular', $4, 10, $5, 5000, $6, $7, $8, NOW());
    `;

    await client.query(memQuery, [
      cId,
      campaign.product_a_id || null,
      campaign.product_b_id || null,
      campaign.target_segment || 'regular',
      parseFloat(campaign.discount_percent || 10),
      parseFloat(campaign.budget_limit || 5000),
      merchantDecision,
      extraDetails.reason || null,
    ]);

    await client.query('COMMIT');

    // Return updated campaign with populated product information
    return await getCampaignById(cId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Submits a draft campaign for merchant approval (draft -> pending_approval).
 */
async function submitCampaign(campaignId) {
  return await transitionCampaignStatus(campaignId, 'pending_approval', 'campaign_submitted', 'merchant');
}

/**
 * Approves a pending campaign (pending_approval -> approved).
 * DOES NOT execute the campaign or perform external payment/SDK calls.
 */
async function approveCampaign(campaignId) {
  return await transitionCampaignStatus(campaignId, 'approved', 'campaign_approved', 'merchant');
}

/**
 * Rejects a pending campaign (pending_approval -> rejected).
 */
async function rejectCampaign(campaignId, reason) {
  const extra = reason && typeof reason === 'string' ? { reason: reason.trim() } : {};
  return await transitionCampaignStatus(campaignId, 'rejected', 'campaign_rejected', 'merchant', extra);
}

/**
 * Resets a rejected campaign back to draft status (rejected -> draft).
 */
async function resetCampaign(campaignId) {
  return await transitionCampaignStatus(campaignId, 'draft', 'campaign_reset', 'merchant');
}

/**
 * Fetches all audit logs for a specific campaign, ordered oldest to newest.
 * Returns null if campaign does not exist.
 */
async function getCampaignAuditLogs(campaignId) {
  const cId = parseInt(campaignId, 10);
  if (isNaN(cId) || cId <= 0) return null;

  // Verify campaign exists first
  const checkRes = await pool.query('SELECT id FROM campaigns WHERE id = $1', [cId]);
  if (checkRes.rows.length === 0) return null;

  const query = `
    SELECT
      id,
      campaign_id AS "campaignId",
      action,
      actor,
      status,
      details,
      created_at AS "createdAt"
    FROM audit_logs
    WHERE campaign_id = $1
    ORDER BY created_at ASC, id ASC;
  `;

  const result = await pool.query(query, [cId]);

  return result.rows.map((row) => ({
    id: row.id,
    campaignId: row.campaignId,
    action: row.action,
    previousStatus: row.details?.previousStatus || null,
    newStatus: row.details?.newStatus || null,
    actor: row.actor,
    status: row.status,
    details: row.details,
    createdAt: row.createdAt,
  }));
}

module.exports = {
  submitCampaign,
  approveCampaign,
  rejectCampaign,
  resetCampaign,
  getCampaignAuditLogs,
  WORKFLOW_TRANSITIONS,
};
