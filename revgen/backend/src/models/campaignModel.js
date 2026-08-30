// ─────────────────────────────────────────────
// RevGen — Campaign Model & Validation Service
// ─────────────────────────────────────────────
//
// Manages creation, validation, status rules, and querying
// for campaign proposal drafts in PostgreSQL.
// ─────────────────────────────────────────────

const pool = require('../db');

// Valid ENUM Values
const VALID_TYPES = ['upsell', 'cross_sell'];
const VALID_SEGMENTS = ['budget', 'regular', 'premium', 'all'];
const VALID_STATUSES = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'executed',
  'executing',
  'completed',
  'failed',
];

// Allowed Status Workflow Transitions
const ALLOWED_STATUS_TRANSITIONS = {
  draft: ['pending_approval', 'rejected'],
  pending_approval: ['approved', 'rejected'],
  approved: ['executed', 'executing', 'rejected'],
  rejected: ['draft'],
  executed: ['completed', 'failed'],
  executing: ['completed', 'failed'],
};

/**
 * Validates campaign creation parameters.
 * Throws an Error with descriptive message if validation fails.
 */
async function validateCampaignCreation(data) {
  const {
    productAId,
    productBId,
    type,
    targetSegment = 'all',
    discountPercent,
    budgetLimit,
    title,
    description,
    estimatedRevenueOpportunity,
    targetCount = 0,
    missedCustomers,
  } = data;

  // 1. Title validation
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new Error('Campaign title is required.');
  }

  // 2. Description validation
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    throw new Error('Campaign description is required.');
  }

  // 3. Product IDs validation
  const pAId = parseInt(productAId, 10);
  const pBId = parseInt(productBId, 10);

  if (isNaN(pAId) || pAId <= 0) {
    throw new Error('Invalid productAId.');
  }
  if (isNaN(pBId) || pBId <= 0) {
    throw new Error('Invalid productBId.');
  }
  if (pAId === pBId) {
    throw new Error('productAId and productBId cannot be the same product.');
  }

  // Verify products exist in PostgreSQL database
  const productsQuery = `SELECT id, name, category, price FROM products WHERE id IN ($1, $2)`;
  const productsResult = await pool.query(productsQuery, [pAId, pBId]);

  const foundIds = new Set(productsResult.rows.map((r) => r.id));
  if (!foundIds.has(pAId)) {
    throw new Error(`Product A with ID ${pAId} does not exist.`);
  }
  if (!foundIds.has(pBId)) {
    throw new Error(`Product B with ID ${pBId} does not exist.`);
  }

  // 4. Type validation
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`Invalid campaign type. Must be one of: ${VALID_TYPES.join(', ')}`);
  }

  // 5. Target segment validation
  if (!VALID_SEGMENTS.includes(targetSegment)) {
    throw new Error(`Invalid targetSegment. Must be one of: ${VALID_SEGMENTS.join(', ')}`);
  }

  // 6. Discount percent validation (Business Safety Constraint: 0 to 20%)
  const discount = parseFloat(discountPercent);
  if (isNaN(discount) || discount < 0 || discount > 20) {
    throw new Error('discountPercent must be a number between 0 and 20.');
  }

  // 7. Budget limit validation
  const budget = parseFloat(budgetLimit);
  if (isNaN(budget) || budget < 0) {
    throw new Error('budgetLimit must be a non-negative number.');
  }

  // 8. Estimated revenue opportunity validation
  const estRev = parseFloat(estimatedRevenueOpportunity);
  if (isNaN(estRev) || estRev < 0) {
    throw new Error('estimatedRevenueOpportunity must be a non-negative number.');
  }

  // 9. Target count / missed customers resolution
  let resolvedTargetCount = parseInt(targetCount || missedCustomers || 0, 10);
  if (isNaN(resolvedTargetCount) || resolvedTargetCount < 0) {
    resolvedTargetCount = 0;
  }

  return {
    productAId: pAId,
    productBId: pBId,
    type,
    targetSegment,
    discountPercent: discount,
    budgetLimit: budget,
    title: title.trim(),
    description: description.trim(),
    estimatedRevenueOpportunity: estRev,
    targetCount: resolvedTargetCount,
  };
}

/**
 * Creates a new campaign draft in PostgreSQL.
 */
async function createCampaign(data) {
  const validated = await validateCampaignCreation(data);

  const insertQuery = `
    INSERT INTO campaigns (
      name,
      product_a_id,
      product_b_id,
      type,
      target_segment,
      target_count,
      status,
      discount_percent,
      budget_limit,
      description,
      estimated_revenue_opportunity,
      created_at,
      updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, $10, NOW(), NOW())
    RETURNING id;
  `;

  const result = await pool.query(insertQuery, [
    validated.title,
    validated.productAId,
    validated.productBId,
    validated.type,
    validated.targetSegment,
    validated.targetCount,
    validated.discountPercent,
    validated.budgetLimit,
    validated.description,
    validated.estimatedRevenueOpportunity,
  ]);

  const newId = result.rows[0].id;
  return await getCampaignById(newId);
}

/**
 * Fetches all campaigns with populated Product A and Product B details, ordered by created_at DESC.
 */
async function getAllCampaigns() {
  const query = `
    SELECT
      c.id,
      c.name AS title,
      c.type,
      c.target_segment AS "targetSegment",
      c.target_count AS "targetCount",
      c.status,
      c.discount_percent::FLOAT AS "discountPercent",
      c.budget_limit::FLOAT AS "budgetLimit",
      c.description,
      c.estimated_revenue_opportunity::FLOAT AS "estimatedRevenueOpportunity",
      c.created_at AS "createdAt",
      c.updated_at AS "updatedAt",

      pa.id AS product_a_id,
      pa.name AS product_a_name,
      pa.category AS product_a_category,
      pa.price::FLOAT AS product_a_price,

      pb.id AS product_b_id,
      pb.name AS product_b_name,
      pb.category AS product_b_category,
      pb.price::FLOAT AS product_b_price
    FROM campaigns c
    LEFT JOIN products pa ON c.product_a_id = pa.id
    LEFT JOIN products pb ON c.product_b_id = pb.id
    ORDER BY c.created_at DESC;
  `;

  const result = await pool.query(query);

  return result.rows.map(mapCampaignRow);
}

/**
 * Fetches a single campaign by ID with populated product details.
 * Returns null if not found.
 */
async function getCampaignById(id) {
  const campaignId = parseInt(id, 10);
  if (isNaN(campaignId) || campaignId <= 0) return null;

  const query = `
    SELECT
      c.id,
      c.name AS title,
      c.type,
      c.target_segment AS "targetSegment",
      c.target_count AS "targetCount",
      c.status,
      c.discount_percent::FLOAT AS "discountPercent",
      c.budget_limit::FLOAT AS "budgetLimit",
      c.description,
      c.estimated_revenue_opportunity::FLOAT AS "estimatedRevenueOpportunity",
      c.created_at AS "createdAt",
      c.updated_at AS "updatedAt",

      pa.id AS product_a_id,
      pa.name AS product_a_name,
      pa.category AS product_a_category,
      pa.price::FLOAT AS product_a_price,

      pb.id AS product_b_id,
      pb.name AS product_b_name,
      pb.category AS product_b_category,
      pb.price::FLOAT AS product_b_price
    FROM campaigns c
    LEFT JOIN products pa ON c.product_a_id = pa.id
    LEFT JOIN products pb ON c.product_b_id = pb.id
    WHERE c.id = $1;
  `;

  const result = await pool.query(query, [campaignId]);

  if (result.rows.length === 0) return null;
  return mapCampaignRow(result.rows[0]);
}

/**
 * Maps a SQL result row into structured API JSON object.
 */
function mapCampaignRow(row) {
  return {
    id: row.id,
    productA: row.product_a_id
      ? {
          id: row.product_a_id,
          name: row.product_a_name,
          category: row.product_a_category,
          price: row.product_a_price,
        }
      : null,
    productB: row.product_b_id
      ? {
          id: row.product_b_id,
          name: row.product_b_name,
          category: row.product_b_category,
          price: row.product_b_price,
        }
      : null,
    type: row.type,
    targetSegment: row.targetSegment,
    targetCount: row.targetCount || 0,
    discountPercent: row.discountPercent,
    budgetLimit: row.budgetLimit,
    status: row.status,
    title: row.title,
    description: row.description,
    estimatedRevenueOpportunity: row.estimatedRevenueOpportunity,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

module.exports = {
  createCampaign,
  getAllCampaigns,
  getCampaignById,
  validateCampaignCreation,
  VALID_STATUSES,
  VALID_TYPES,
  VALID_SEGMENTS,
  ALLOWED_STATUS_TRANSITIONS,
};
