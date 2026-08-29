// ─────────────────────────────────────────────
// RevGen — Market Basket Product Pair Analytics
// ─────────────────────────────────────────────
//
// Analyzes historical order data in PostgreSQL to discover
// co-purchase relationships between products.
//
// Calculates:
// - ordersWithA: distinct orders containing Product A
// - ordersWithB: distinct orders containing Product B
// - ordersWithBoth: distinct orders containing Product A & B
// - confidence: P(B|A) = ordersWithBoth / ordersWithA
// - support: P(A & B) = ordersWithBoth / totalOrders
// - lift: confidence / P(B) = (ordersWithBoth * totalOrders) / (ordersWithA * ordersWithB)
// ─────────────────────────────────────────────

const pool = require('../db');

/**
 * Computes product pair co-purchase analytics using PostgreSQL aggregation.
 *
 * @param {Object} options - Optional filtering and pagination parameters.
 * @param {number} [options.minOrdersWithBoth=5] - Minimum co-purchase order count.
 * @param {number} [options.minConfidence=0.05] - Minimum confidence (5%).
 * @param {number} [options.minLift=1.0] - Minimum lift (> 1.0 indicates positive correlation).
 * @param {number} [options.limit=100] - Max number of product pairs to return.
 * @returns {Promise<Array<Object>>} Structured analytics for qualified product pairs.
 */
async function getProductPairAnalytics(options = {}) {
  const minOrdersWithBoth = options.minOrdersWithBoth ?? 5;
  const minConfidence = options.minConfidence ?? 0.05;
  const minLift = options.minLift ?? 1.0;
  const limit = options.limit ?? 100;

  const query = `
    WITH total_orders_cte AS (
      SELECT COUNT(*)::FLOAT AS total_orders FROM orders
    ),
    distinct_items AS (
      SELECT DISTINCT order_id, product_id
      FROM order_items
    ),
    product_counts AS (
      SELECT product_id, COUNT(*)::FLOAT AS orders_with_product
      FROM distinct_items
      GROUP BY product_id
    ),
    pair_counts AS (
      SELECT
        a.product_id AS product_a_id,
        b.product_id AS product_b_id,
        COUNT(*)::FLOAT AS orders_with_both
      FROM distinct_items a
      JOIN distinct_items b
        ON a.order_id = b.order_id
       AND a.product_id != b.product_id
      GROUP BY a.product_id, b.product_id
    )
    SELECT
      pa.id AS product_a_id,
      pa.name AS product_a_name,
      pa.category AS product_a_category,
      pa.price AS product_a_price,

      pb.id AS product_b_id,
      pb.name AS product_b_name,
      pb.category AS product_b_category,
      pb.price AS product_b_price,

      pc_a.orders_with_product AS orders_with_a,
      pc_b.orders_with_product AS orders_with_b,
      pc_pair.orders_with_both AS orders_with_both,
      t.total_orders,

      (pc_pair.orders_with_both / pc_a.orders_with_product) AS confidence,
      (pc_pair.orders_with_both / t.total_orders) AS support,
      ((pc_pair.orders_with_both / pc_a.orders_with_product) / (pc_b.orders_with_product / t.total_orders)) AS lift
    FROM pair_counts pc_pair
    CROSS JOIN total_orders_cte t
    JOIN product_counts pc_a ON pc_pair.product_a_id = pc_a.product_id
    JOIN product_counts pc_b ON pc_pair.product_b_id = pc_b.product_id
    JOIN products pa ON pc_pair.product_a_id = pa.id
    JOIN products pb ON pc_pair.product_b_id = pb.id
    WHERE pc_pair.orders_with_both >= $1
      AND (pc_pair.orders_with_both / pc_a.orders_with_product) >= $2
      AND ((pc_pair.orders_with_both / pc_a.orders_with_product) / (pc_b.orders_with_product / t.total_orders)) > $3
    ORDER BY lift DESC, pc_pair.orders_with_both DESC
    LIMIT $4;
  `;

  const result = await pool.query(query, [
    minOrdersWithBoth,
    minConfidence,
    minLift,
    limit,
  ]);

  return result.rows.map((row) => ({
    productA: {
      id: row.product_a_id,
      name: row.product_a_name,
      category: row.product_a_category,
      price: parseFloat(row.product_a_price),
    },
    productB: {
      id: row.product_b_id,
      name: row.product_b_name,
      category: row.product_b_category,
      price: parseFloat(row.product_b_price),
    },
    ordersWithA: parseInt(row.orders_with_a, 10),
    ordersWithB: parseInt(row.orders_with_b, 10),
    ordersWithBoth: parseInt(row.orders_with_both, 10),
    totalOrders: parseInt(row.total_orders, 10),
    confidence: parseFloat(parseFloat(row.confidence).toFixed(4)),
    support: parseFloat(parseFloat(row.support).toFixed(4)),
    lift: parseFloat(parseFloat(row.lift).toFixed(2)),
  }));
}

module.exports = {
  getProductPairAnalytics,
};
